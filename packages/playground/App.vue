<script setup lang="ts">
import { ref } from "vue";
import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";

const { pdf } = usePDF(
  "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"
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
