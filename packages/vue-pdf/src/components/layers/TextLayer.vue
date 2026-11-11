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
import { highlightMatches, matchesFromMatcher } from "../utils/highlight";

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

function drawHighlights() {
  const text = renderedText.value;
  const source = highlightSource.value;
  const matches = pageMatches.value;
  const container = layer.value;
  if (!text || !container) return;

  container
    .querySelectorAll(".pdf-highlight")
    .forEach((highlight) => highlight.remove());
  if (!matches || source?.page !== text.page) return;

  highlightMatches(
    matches,
    source.textContent,
    text.textDivs,
    props.customHighlightClass || "highlight",
    handleHighlightClick,
    handleHighlightMouseEnter,
    handleHighlightMouseLeave,
    { glyphs: source.glyphs, layer: container, viewport: text.viewport },
  );

  emit("highlight", {
    matches,
    textContent: source.textContent,
    textDivs: text.textDivs,
    page: source.page.pageNumber,
  });
}

function handleHighlightClick(
  event: MouseEvent,
  text: string,
  key: string | number,
  keyword: string,
) {
  const element = event.currentTarget as HTMLElement;
  const rect = element.getBoundingClientRect();

  emit("highlightClick", {
    text,
    key,
    keyword,
    position: {
      x: rect.left + rect.width / 2,
      y: rect.top,
    },
    pageNumber: props.page?.pageNumber || 1,
  });
}

function handleHighlightMouseEnter(
  event: MouseEvent,
  text: string,
  key: string | number,
  keyword: string,
) {
  const element = event.currentTarget as HTMLElement;
  const rect = element.getBoundingClientRect();

  emit("highlightHover", {
    text,
    key,
    keyword,
    position: {
      x: rect.left + rect.width / 2,
      y: rect.top,
    },
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    pageNumber: props.page?.pageNumber || 1,
  });
}

function handleHighlightMouseLeave() {
  emit("highlightLeave");
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

    const textContent = page.getTextContent();
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

watch(
  [renderedText, pageMatches, () => props.customHighlightClass],
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
  />
</template>
