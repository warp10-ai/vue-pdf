<script setup lang="ts">
import al from "@samples/al.pdf";
import test from "@samples/test.pdf";
import dipietro from "@samples/dipietro.pdf";
import udayan from "@samples/udayan.pdf";
import chao from "@samples/chao.pdf";

import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { ref, onMounted } from "vue";

const diPietroPdf = ref<any>(null);

const udayanPdf = ref<any>(null);

const chaoPdf = ref<any>(null);

const highlightText = ref([
  "diverse geographies" ,
  "durvalumab",
  "axitinib",
  "sunitinib",
  "torisel",
  "avelumab",
  "astrazeneca",
  "tremelimumab",
  "ipilimumab",
  "roche",
  "gsk",
  "bevacizumab",
  "e7080",
  "paclitaxel",
  "eisai",
  "novartis",
  "ab science",
  "science",
  "abraxane",
  "taxol",
  "italfarmaco",
  "letrozole",
  "anastrozole",
  "msb0010718c",
  "medi4736",
  "dabrafenib",
  "trametinib",
  "cisplatin",
  "doxorubicin",
  "gefitinib",
  "nextcure inc.",
  "bristol-myers squibb",
  "crizotinib",
  "pembrolizumab",
  "nivolumab",
  "agenus",
  "osimertinib",
  "pdx",
  "epidermal growth factor",
  "tyrosine",
  "m6620",
  "topotecan",
  "pas",
  "selumetinib",
  "erlotinib",
  "sepantronium bromide",
  "ym155",
  "carboplatin",
  "eli lilly and company",
  "cyramza",
  "ramucirumab",
  "sintilimab",
  "retevmo",
  "selpercatinib",
  "alisertib",
  "mln8237",
  "puma biotechnology",
  "merck",
  "pegilodecakin",
  "eli lilly",
  "ap26113",
  "sunitinib malate",
  "alectinib",
  "atezolizumab",
  "heparin",
  "cetuximab",
  "neratinib",
  "temsirolimus",
  "mpdl3280a",
  "necitumumab",
  "azd9291",
  "pemetrexed",
  "gemcitabine hydrochloride",
  "pemetrexed disodium",
  "celecoxib",
  "ly3009806",
  "mk-3475",
  "imatinib",
  "ch5424802",
  "nintedanib",
  "am0010",
  "loxo-292",
  "thyroid",
  "vorinostat",
  "ponatinib",
  "oct",
  "reolysin",
  "aqua",
  "peg",
  "platinum",
]);

const activeHighlightText = ref("axitinib");
const highlightOptions = ref({
  completeWords: true,
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

onMounted(() => {
  diPietroPdf.value = usePDF(dipietro);

  udayanPdf.value = usePDF(udayan);

  chaoPdf.value = usePDF(chao);
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in diPietroPdf?.pages"
      :key="page"
    >
      <VuePDF
        :pdf="diPietroPdf.pdf"
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

  <hr />

  <div class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in udayanPdf?.pages"
      :key="page"
    >
      <VuePDF
        :pdf="udayanPdf.pdf"
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

  <hr />

  <div class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in chaoPdf?.pages"
      :key="page"
    >
      <VuePDF
        :pdf="chaoPdf.pdf"
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
