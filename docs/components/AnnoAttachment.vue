<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf';
import { withBase } from 'vitepress/client';
import { ref } from 'vue';

const { pdf } = usePDF(withBase('/41.pdf'))
const eventValue = ref({})
function onAnnotation(value) {
  console.log(value)
  eventValue.value = value
}
</script>

<template>
  <div class="language-json" data-ext="json">
    <pre class="language-json"><code>// "content" is a uint8Array<br>{{ eventValue }}</code></pre>
  </div>

  <div class="vue-pdf-container">
    <VuePDF :pdf="pdf" annotation-layer image-resources-path="https://unpkg.com/pdfjs-dist@latest/web/images/" @annotation="onAnnotation" />
  </div>
</template>
