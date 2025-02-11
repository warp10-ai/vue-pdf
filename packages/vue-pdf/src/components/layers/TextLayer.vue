<script setup lang="ts">
import * as PDFJS from "pdfjs-dist";
import { onMounted, ref, watch } from "vue";

import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import type {
  HighlightClickPayload,
  HighlightEventPayload,
  HighlightHoverPayload,
  HighlightOptions,
  TextLayerLoadedEventPayload,
} from "../types";
import { findMatches, highlightMatches, resetDivs } from "../utils/highlight";

const props = defineProps<{
  page?: PDFPageProxy;
  viewport?: PageViewport;
  highlightText?:
    | string
    | string[]
    | Array<{ keyword: string; key: string | number }>;
  activeHighlightText?: string;
  highlightOptions?: HighlightOptions;
  highlightPages?: number[];
  customHighlightClass?: string;
  highlightTextColor?: string;
  customActiveHighlightClass?: string;
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

watch(
  () => props.activeHighlightText,
  () => {
    findAndHighlight(true);
  }
);

function getHighlightOptionsWithDefaults(): HighlightOptions {
  return Object.assign(
    {},
    {
      ignoreCase: true,
      completeWords: false,
    },
    props.highlightOptions
  );
}

function normalizeHighlightText(
  highlight:
    | string
    | string[]
    | Array<{ keyword: string; key: string | number }>
) {
  if (!highlight) return [];
  if (typeof highlight === "string") return [highlight];
  return highlight;
}

async function findAndHighlight(reset = false) {
  const page = props.page;
  const textContent = await page?.getTextContent();

  if (!textContent) return;

  if (reset) resetDivs(textContent, textDivs);

  if (
    props.highlightText &&
    page &&
    (!props.highlightPages || props.highlightPages.includes(page.pageNumber))
  ) {
    const normalizedHighlights = normalizeHighlightText(props.highlightText);
    const matches = findMatches(
      normalizedHighlights,
      textContent,
      getHighlightOptionsWithDefaults()
    );

    highlightMatches(
      matches,
      textContent,
      textDivs,
      props.customHighlightClass || "highlight",
      props.highlightTextColor,
      props.customActiveHighlightClass,
      props.activeHighlightText,
      handleHighlightClick,
      handleHighlightMouseEnter,
      handleHighlightMouseLeave
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
  layer.value!.replaceChildren?.();

  const page = props.page;
  const viewport = props.viewport;
  const textStream = page?.streamTextContent({
    includeMarkedContent: true,
    disableNormalization: true,
  });
  const textLayer = new PDFJS.TextLayer({
    container: layer.value!,
    textContentSource: textStream!,
    viewport: viewport!,
  });
  textLayer.render().then(async () => {
    textDivs = textLayer.textDivs;
    const textContent = await page?.getTextContent();
    emit("textLoaded", { textDivs, textContent });
    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    layer.value?.appendChild(endOfContent);
    endContent.value = endOfContent;
    findAndHighlight();
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
  () => [props.highlightText, props.highlightOptions],
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
