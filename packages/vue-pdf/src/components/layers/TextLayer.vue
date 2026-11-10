<script setup lang="ts">
import * as PDFJS from "pdfjs-dist";
import { onMounted, ref, watch } from "vue";

import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import type {
  HighlightClickPayload,
  HighlightEventPayload,
  HighlightHoverPayload,
  HighlightMatcher,
  HighlightOptions,
  TextLayerLoadedEventPayload,
} from "../types";
import { getGlyphs, type GlyphLayer, type PageGlyph } from "../utils/glyphs";
import {
  findMatches,
  highlightMatches,
  matchesFromMatcher,
  resetDivs,
} from "../utils/highlight";

const props = defineProps<{
  page?: PDFPageProxy;
  viewport?: PageViewport;
  highlightText?:
    | string
    | string[]
    | Array<{ keyword: string; key: string | number }>;
  highlightOptions?: HighlightOptions;
  highlightMatcher?: HighlightMatcher;
  highlightPages?: number[];
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
const endContent = ref<HTMLDivElement>();
let textDivs: HTMLElement[] = [];

function getHighlightOptionsWithDefaults(): HighlightOptions {
  return Object.assign(
    {},
    {
      ignoreCase: true,
      completeWords: false,
      ignoreSpecialChars: false,
    },
    props.highlightOptions
  );
}

function normalizeHighlightText(
  highlight?:
    | string
    | string[]
    | Array<{ keyword: string; key: string | number }>
) {
  if (!highlight) return [];
  if (typeof highlight === "string") return [highlight];
  return highlight;
}

function getHighlightText(page: PDFPageProxy) {
  if (props.highlightMatcher) {
    return page.getTextContent({ disableNormalization: true });
  }
  return page.getTextContent();
}

function getGlyphLayer(glyphs: PageGlyph[]): GlyphLayer | undefined {
  if (!layer.value || !props.viewport) return;
  return { glyphs, layer: layer.value, viewport: props.viewport };
}

function getMatches(textContent: TextContent) {
  if (props.highlightMatcher) {
    return matchesFromMatcher(props.highlightMatcher, textContent);
  }
  return findMatches(
    normalizeHighlightText(props.highlightText),
    textContent,
    getHighlightOptionsWithDefaults()
  );
}

async function findAndHighlight(
  reset = false,
  started?: {
    textContent: Promise<TextContent>;
    glyphs?: ReturnType<typeof getGlyphs>;
  }
) {
  const page = props.page;
  if (!page) return;
  const textContent = await (started?.textContent ?? getHighlightText(page));

  if (!textContent) return;

  if (reset) resetDivs(textContent, textDivs);

  if (
    (props.highlightMatcher || props.highlightText) &&
    page &&
    (!props.highlightPages || props.highlightPages.includes(page.pageNumber))
  ) {
    const matches = getMatches(textContent);
    let glyphs: PageGlyph[] = [];
    if (matches.length) glyphs = await (started?.glyphs ?? getGlyphs(page));

    highlightMatches(
      matches,
      textContent,
      textDivs,
      props.customHighlightClass || "highlight",
      handleHighlightClick,
      handleHighlightMouseEnter,
      handleHighlightMouseLeave,
      getGlyphLayer(glyphs)
    );

    emit("highlight", {
      matches,
      textContent,
      textDivs,
      page: page?.pageNumber || 1,
    });
  }
}

function render() {
  const page = props.page;
  const viewport = props.viewport;
  const container = layer.value;
  if (!page || !viewport || !container) return;

  container.replaceChildren?.();
  let glyphs: ReturnType<typeof getGlyphs> | undefined;
  if (props.highlightMatcher || props.highlightText) {
    glyphs = getGlyphs(page);
  }
  const textContentSource = page.streamTextContent({
    includeMarkedContent: true,
    disableNormalization: true,
  });
  const textLayer = new PDFJS.TextLayer({
    container,
    textContentSource,
    viewport,
  });
  textLayer.render().then(() => {
    textDivs = textLayer.textDivs;
    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    layer.value?.appendChild(endOfContent);
    endContent.value = endOfContent;
    const textForHighlights = getHighlightText(page);
    findAndHighlight(false, { textContent: textForHighlights, glyphs });
    (props.highlightMatcher ? page.getTextContent() : textForHighlights).then(
      (textContent) => emit("textLoaded", { textDivs, textContent })
    );
  });
}

function handleHighlightClick(
  event: MouseEvent,
  text: string,
  key: string | number,
  keyword: string
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
  keyword: string
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
  if (!endContent.value) return;
  endContent.value.classList.add("active");
}

function onMouseUp() {
  if (!endContent.value) return;
  endContent.value.classList.remove("active");
}

watch(
  () => props.viewport,
  (_) => {
    if (props.page && props.viewport && layer.value) render();
  }
);

watch(
  () => [props.highlightText, props.highlightOptions, props.highlightMatcher],
  (_) => {
    findAndHighlight(true);
  },
  { deep: true }
);

onMounted(() => {
  if (props.page && props.viewport && layer.value) render();
});
</script>

<template>
  <div
    ref="layer"
    class="textLayer"
    style="display: block"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
  />
</template>
