<script setup lang="ts">
import al from "@samples/al.pdf";
import test from "@samples/test.pdf";
import dipietro from "@samples/dipietro.pdf";
import udayan from "@samples/udayan.pdf";
import chao from "@samples/chao.pdf";
import reena from "@samples/reena.pdf";
import joyson from "@samples/joyson.pdf";
import ingmar from "@samples/ingmar.pdf";

import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { computed, ref, onMounted, watch } from "vue";

const diPietroPdf = ref<any>(null);

const udayanPdf = ref<any>(null);

const chaoPdf = ref<any>(null);

const reenaPdf = ref<any>(null);

const joysonPdf = ref<any>(null);

const ingmarPdf = ref<any>(null);

// const highlightText = ref([
//     'nextcure',//true
//     "tcr2 therapeutics", //true
//     "bristol-myers squibb", //true
//     "crizotinib",//true
//     "medimmune",//false
//     "astrazeneca",//false
//     "nc410",//true
//     "pembrolizumab",//true
//     "bristol myers squibb",//true
//     "bms-986299",//true
//     "nivolumab",//true
//     "ipilimumab",//true
//     "bms-986340",//true
//     "agenus",//true
//     "bms",//true
//     "osimertinib",//true
//     "az",//true
//     "m6620",//true
//     "topotecan",//true
//     "selumetinib",//true
//     "erlotinib",//true
//     "sunitinib",//true
//     "sepantronium bromide",//true
//     "ym155",//true
//     "paclitaxel",//true
//     "carboplatin",//true
//     "calcitonin"  //true
// ]);

const keywords = ref(["ifosfamide"]);

const highlightMatcher = computed(() => {
  const words = keywords.value;
  return (text: string) =>
    words.flatMap((keyword) =>
      [...text.matchAll(new RegExp(`\\b${keyword}\\b`, "gi"))].map(
        (match) => ({
          start: match.index!,
          end: match.index! + match[0].length,
          keyword,
          key: keyword,
        })
      )
    );
});

const activeHighlightText = ref(["ifosfamide", "astrazeneca", "bms"]);

const handleHighlightHover = (event: any) => {
  console.log("handleHighlightHover", event);
};

const handleHighlightLeave = () => {
  console.log("handleHighlightLeave");
};

const handleHighlightClick = (payload: any) => {
  console.log(payload);
  const active = activeHighlightText.value;
  if (active.includes(payload.key)) {
    activeHighlightText.value = active.filter((key) => key !== payload.key);
    return;
  }
  activeHighlightText.value = [...active, payload.key];
};

const pagesRef = ref<HTMLElement>();

const updateActiveHighlights = () => {
  if (!pagesRef.value) return;
  const highlights = pagesRef.value.querySelectorAll<HTMLElement>("[data-highlight-id]");
  for (const highlight of highlights) {
    const id = highlight.dataset.highlightId;
    const isActive = id !== undefined && activeHighlightText.value.includes(id);
    highlight.classList.toggle("custom-active-highlight", isActive);
  }
};

watch(activeHighlightText, updateActiveHighlights);

onMounted(() => {
  ingmarPdf.value = usePDF(ingmar);
});
</script>

<template>
  <div ref="pagesRef" class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in ingmarPdf?.pages"
      :key="page"
    >
      <VuePDF
        :pdf="ingmarPdf.pdf"
        :page="page"
        text-layer
        :highlight-matcher="highlightMatcher"
        highlight-class="custom-pdf-highlight"
        :width="1000"
        @highlight-hover="handleHighlightHover"
        @highlight-leave="handleHighlightLeave"
        @highlight-click="handleHighlightClick"
        @highlight="updateActiveHighlights"
      />
    </div>
  </div>
</template>

<style>
.custom-pdf-highlight,
.custom-active-highlight {
  border-radius: 0.1875rem;
  color: inherit;
}

.custom-pdf-highlight {
  background: #d7b2ff80;
}

.custom-active-highlight {
  background: #5c15e080;
}

.textLayer:has(mark[data-hovered]) span {
  cursor: pointer;
}
</style>
