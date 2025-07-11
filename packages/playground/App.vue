<script setup lang="ts">
import al from "@samples/al.pdf";
import test from "@samples/test.pdf";
import dipietro from "@samples/dipietro.pdf";
import udayan from "@samples/udayan.pdf";
import chao from "@samples/chao.pdf";
import reena from "@samples/reena.pdf";

import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { ref, onMounted } from "vue";

const diPietroPdf = ref<any>(null);

const udayanPdf = ref<any>(null);

const chaoPdf = ref<any>(null);

const reenaPdf = ref<any>(null);

const highlightText = ref([
  "trodelvy (sacituzumab govitecan)",
  "tabrecta (capmatinib)",
]);

const activeHighlightText = ref("AVYCAZ");
const highlightOptions = ref({
  completeWords: false,
  ignoreCase: true,
  ignoreSpecialChars: true,
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

onMounted(() => {
  reenaPdf.value = usePDF(reena);
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in reenaPdf?.pages"
      :key="page"
    >
      <VuePDF
        :pdf="reenaPdf.pdf"
        :page="page"
        text-layer
        :highlight-text="highlightText"
        :highlightOptions="highlightOptions"
        custom-highlight-class="custom-pdf-highlight"
        customActiveHighlightClass="custom-active-highlight"
        :activeHighlightText="activeHighlightText"
        activeHighlightTextColor="white"
        :width="1000"
        @highlight-hover="handleHighlightHover"
        @highlight-leave="handleHighlightLeave"
        @highlight-click="handleHighlightClick"
      />
    </div>
  </div>
</template>

<style>
.custom-pdf-highlight {
  background: linear-gradient(
    90deg,
    rgba(53, 184, 255, 0) 0%,
    rgba(53, 184, 255, 0.3) 20%,
    rgba(53, 184, 255, 0.3) 80%,
    rgba(53, 184, 255, 0) 100%
  );
  cursor: pointer;
}

.custom-active-highlight {
  background: linear-gradient(
    90deg,
    rgba(92, 21, 224, 0) 0%,
    rgba(92, 21, 224, 0.3) 20%,
    rgba(92, 21, 224, 0.3) 80%,
    rgba(92, 21, 224, 0) 100%
  );
  cursor: pointer;
}
</style>
