<script setup lang="ts">
import * as PDFJS from "pdfjs-dist";
import { computed, ref, shallowRef, watch } from "vue";

import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import type {
  HighlightClickPayload,
  HighlightEventPayload,
  HighlightHoverPayload,
  HighlightMatcher,
  TextLayerLoadedEventPayload,
} from "../types";
import { getGlyphs, type PageGlyph } from "../utils/glyphs";
import {
  highlightMatches,
  matchesFromMatcher,
  type DrawnHighlight,
} from "../utils/highlight";

const props = defineProps<{
  page?: PDFPageProxy;
  viewport?: PageViewport;
  highlightMatcher?: HighlightMatcher;
  customHighlightClass?: string;
}>();

const emit = defineEmits<{
  (event: "highlight", payload: HighlightEventPayload): void;
  (event: "textLoaded", payload: TextLayerLoadedEventPayload): void;
  (event: "highlightClick", payload: HighlightClickPayload): void;
  (event: "highlightHover", payload: HighlightHoverPayload): void;
  (event: "highlightLeave"): void;
}>();

const layer = ref<HTMLDivElement>();
const layerWidth = ref(0);
const renderedText = shallowRef<{
  page: PDFPageProxy;
  viewport: PageViewport;
  textDivs: HTMLElement[];
}>();
const highlightSource = shallowRef<{
  page: PDFPageProxy;
  textContent: TextContent;
  glyphs: PageGlyph[];
}>();

const pageMatches = computed(() => {
  const source = highlightSource.value;
  const matcher = props.highlightMatcher;
  if (!source || !matcher) return null;
  return matchesFromMatcher(matcher, source.textContent);
});

let highlights: DrawnHighlight[] = [];

function drawHighlights() {
  const text = renderedText.value;
  const source = highlightSource.value;
  const matches = pageMatches.value;
  const container = layer.value;
  if (!text || !container) return;

  clearHover();
  highlights.forEach(({ element }) => element.remove());
  highlights = [];
  if (!matches || source?.page !== text.page) return;

  highlights = highlightMatches(
    matches,
    source.textContent,
    text.textDivs,
    props.customHighlightClass || "highlight",
    { glyphs: source.glyphs, layer: container, viewport: text.viewport },
  );

  emit("highlight", {
    matches,
    textContent: source.textContent,
    textDivs: text.textDivs,
    page: source.page.pageNumber,
  });
}

function highlightAt(event: MouseEvent) {
  return highlights.find(({ element }) => {
    const rect = element.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  });
}

function describeHighlight({ element, text, key, keyword }: DrawnHighlight) {
  const rect = element.getBoundingClientRect();
  return {
    text,
    key,
    keyword,
    position: { x: rect.left + rect.width / 2, y: rect.top },
    pageNumber: props.page?.pageNumber || 1,
  };
}

let hovered: DrawnHighlight | undefined;

function setHovered(highlight: DrawnHighlight | undefined) {
  hovered?.element.removeAttribute("data-hovered");
  highlight?.element.setAttribute("data-hovered", "");
  hovered = highlight;
}

function onMouseMove(event: MouseEvent) {
  const highlight = highlightAt(event);
  if (highlight === hovered) return;
  if (hovered) emit("highlightLeave");
  setHovered(highlight);
  if (!highlight) return;
  const { element } = highlight;
  const { left, top, width, height } = element.getBoundingClientRect();
  emit("highlightHover", {
    ...describeHighlight(highlight),
    rect: { left, top, width, height },
  });
}

function clearHover() {
  if (!hovered) return;
  setHovered(undefined);
  emit("highlightLeave");
}

function onClick(event: MouseEvent) {
  if (!document.getSelection()?.isCollapsed) return;
  const highlight = highlightAt(event);
  if (highlight) emit("highlightClick", describeHighlight(highlight));
}

function onMouseDown() {
  const container = layer.value;
  if (!container) return;
  container.classList.add("selecting");
  document.addEventListener(
    "mouseup",
    () => container.classList.remove("selecting"),
    { once: true },
  );
}

watch(
  [() => props.page, () => props.viewport, layer],
  ([page, viewport, container], _, onCleanup) => {
    if (!page || !viewport || !container) return;
    let cancelled = false;
    renderedText.value = undefined;
    container.replaceChildren();

    const textLayer = new PDFJS.TextLayer({
      container,
      textContentSource: page.streamTextContent({
        includeMarkedContent: true,
        disableNormalization: true,
      }),
      viewport,
    });
    onCleanup(() => {
      cancelled = true;
      textLayer.cancel();
    });

    const textContent = page.getTextContent({ disableNormalization: true });
    textLayer
      .render()
      .then(async () => {
        if (cancelled) return;
        const textDivs = textLayer.textDivs;
        const endOfContent = document.createElement("div");
        endOfContent.className = "endOfContent";
        container.appendChild(endOfContent);
        renderedText.value = { page, viewport, textDivs };
        const loaded = await textContent;
        if (!cancelled) emit("textLoaded", { textDivs, textContent: loaded });
      })
      .catch((error) => {
        if (!cancelled) throw error;
      });
  },
  { flush: "post" },
);

watch(
  [() => props.page, () => !!props.highlightMatcher],
  async ([page, highlighting], _, onCleanup) => {
    highlightSource.value = undefined;
    if (!page || !highlighting) return;
    let cancelled = false;
    onCleanup(() => (cancelled = true));

    const [textContent, glyphs] = await Promise.all([
      page.getTextContent({ disableNormalization: true }),
      getGlyphs(page),
    ]);
    if (!cancelled) highlightSource.value = { page, textContent, glyphs };
  },
  { immediate: true },
);

watch(layer, (element, _, onCleanup) => {
  if (!element) return;
  const observer = new ResizeObserver(([entry]) => {
    layerWidth.value = entry.contentRect.width;
  });
  observer.observe(element);
  onCleanup(() => observer.disconnect());
});

watch(
  [renderedText, pageMatches, layerWidth, () => props.customHighlightClass],
  drawHighlights,
  { flush: "post" },
);
</script>

<template>
  <div
    ref="layer"
    class="textLayer"
    style="display: block"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseleave="clearHover"
    @click="onClick"
  />
</template>
