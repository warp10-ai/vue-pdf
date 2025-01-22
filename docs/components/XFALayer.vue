<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf';
import '@warp10-ai/vue-pdf/style.css';
import { withBase } from 'vitepress/client';

const { pdf } = usePDF({
  url: withBase('/xfa.pdf'),
  enableXfa: true,
})
</script>

<template>
  <div class="vue-pdf-container">
    <VuePDF :pdf="pdf" />
  </div>
</template>
