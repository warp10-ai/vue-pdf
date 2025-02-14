<script setup lang="ts">
import * as PDFJS from "pdfjs-dist";
import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { ref } from "vue";

// Primeiro configurar o worker legacy
PDFJS.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${PDFJS.version}/legacy/build/pdf.worker.min.mjs`;

// Polyfill para Promise.withResolvers
if (typeof Promise.withResolvers === "undefined") {
  if (typeof window !== "undefined") {
    // @ts-expect-error This does not exist outside of polyfill
    window.Promise.withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

const { pdf } = usePDF(
  "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf",
  {
    onError: (error) => {
      console.error("PDF processing error:", error);
    },
  }
);

const highlightText = ref(["javascript", "such"]);
const activeHighlightText = ref("such");
const highlightOptions = ref({
  completeWords: false,
  ignoreCase: true,
});

const handleHighlightHover = (event: any) => {
  console.log("handleHighlightHover", event);
};

const handleHighlightLeave = () => {
  console.log("handleHighlightLeave");
};

const handleHighlightClick = (payload: any) => {
  console.log(payload);
};
</script>

<template>
  <div class="relative">
    <VuePDF
      :pdf="pdf"
      text-layer
      fit-parent
      :highlight-text="highlightText"
      :highlightOptions="highlightOptions"
      custom-highlight-class="custom"
      customActiveHighlightClass="custom-active"
      :activeHighlightText="activeHighlightText"
      activeHighlightTextColor="white"
      @highlight-hover="handleHighlightHover"
      @highlight-leave="handleHighlightLeave"
      @highlight-click="handleHighlightClick"
    />
  </div>
</template>

<style>
.custom {
  background: linear-gradient(
    0deg,
    rgba(53, 184, 255, 0.2),
    rgba(53, 184, 255, 0.2)
  );
  background-color: transparent;
  border: 2px solid;
  border-image-source: linear-gradient(147.05deg, #a095ff 0%, #e294ff 100%);
  border-image-slice: 1;
  cursor: pointer;
}

.custom-active {
  background-color: blue;
  position: relative;
  padding: 2px;
  border-radius: 4px;
}
.absolute {
  z-index: 9999 !important;
}
</style>
