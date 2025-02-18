<script setup lang="ts">
import al from "@samples/al.pdf";
import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { ref, onMounted } from "vue";

const resumePdf = ref<any>(null);

const highlightText = ref([
  "Galunisertib (LY2157299 monohydrate)",
  "Precision for Medicine",
  "Advaxis Immunotherapies",
  "Covance, Inc.",
  "FGF-8 ligands",
  "CAR T",
  "Checkpoint inhibitors",
  "Antibody-drug conjugates",
]);
const activeHighlightText = ref("CAR T");
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

onMounted(() => {
  resumePdf.value = usePDF(al);

  console.log(resumePdf);
});
</script>

<template>
  <div class="border rounded-lg" v-for="page in resumePdf?.pages" :key="page">
    <VuePDF
      :pdf="resumePdf.pdf"
      :page="page"
      text-layer
      :highlight-text="highlightText"
      :highlightOptions="highlightOptions"
      custom-highlight-class="custom-pdf-highlight"
      customActiveHighlightClass="custom-active-highlight"
      :activeHighlightText="activeHighlightText"
      activeHighlightTextColor="white"
      @highlight-hover="handleHighlightHover"
      @highlight-leave="handleHighlightLeave"
      @highlight-click="handleHighlightClick"
    />
  </div>
</template>

<style>
.custom-pdf-highlight {
  background: linear-gradient(
    0deg,
    rgba(53, 184, 255, 0.2),
    rgba(53, 184, 255, 0.2)
  );
  position: relative;
  background-color: transparent;
  cursor: pointer;
  padding: -1px;
}

.custom-pdf-highlight::before {
  content: "";
  position: absolute;
  inset: -2px;
  padding: 2px;
  border-radius: 4px;
  background: linear-gradient(147.05deg, #a095ff 0%, #e294ff 100%);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}

.absolute {
  z-index: 9999 !important;
}
.text-white {
  color: white;
}

.custom-active-highlight {
  background-color: #5c15e0;
  cursor: pointer;
  border-radius: 2px;
  box-shadow: 0 0 0 1px #5c15e0;
}
</style>
