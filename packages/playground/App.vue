<!-- eslint-disable unused-imports/no-unused-imports -->
<!-- Use this component to play with the main components -->
<script setup lang="ts">
import pdf14 from "@samples/45.pdf";
import { VuePDF, usePDF } from "@tato30/vue-pdf";
import { ref } from "vue";

const { pdf } = usePDF(
  "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"
);

const highlightText = ref("javascript");
const highlightOptions = ref({
  completeWords: false,
  ignoreCase: true,
});
</script>

<template>
  <div>
    <VuePDF
      :pdf="pdf"
      text-layer
      :highlight-text="highlightText"
      :highlightOptions="highlightOptions"
      custom-highlight-class="custom"
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
</style>
