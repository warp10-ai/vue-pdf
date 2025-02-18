<script setup lang="ts">
import al from "@samples/al.pdf";
import test from "@samples/test.pdf";
import { VuePDF, usePDF } from "@warp10-ai/vue-pdf";
import { ref, onMounted } from "vue";

const resumePdf = ref<any>(null);

const highlightText = ref([
  "Illumina",
  "Genentech",
  "Advaxis Immunotherapies",
  "Covance, Inc.",
  "FGF-8 ligands",
  "CAR T",
  "Checkpoint inhibitors",
  "Antibody-drug conjugates",
  "Companion Diagnostic Assays",
  "Biomarkers and Therapeutic Targets",
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
  resumePdf.value = usePDF(test);

  console.log(resumePdf);
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="border rounded-lg overflow-y-auto relative"
      v-for="page in resumePdf?.pages"
      :key="page"
    >
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
  </div>
</template>

<style>
.custom-pdf-highlight {
  background: linear-gradient(
    0deg,
    rgba(53, 184, 255, 0.2),
    rgba(53, 184, 255, 0.2)
  );
  position: absolute;
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

.custom-active-highlight {
  background-color: #5c15e0;
  cursor: pointer;
  border-radius: 2px;
  box-shadow: 0 0 0 2px #5c15e0;
  position: absolute;
}

/* Container do PDF precisa ser relative */
.vue-pdf {
  position: relative;
}
</style>
