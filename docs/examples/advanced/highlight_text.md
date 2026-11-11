# Highlight Text

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf';
import '@warp10-ai/vue-pdf/style.css';
import { computed, ref } from 'vue';

const { pdf } = usePDF('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf')

const highlightText = ref('javascript')
const highlightMatcher = computed(() => {
  const query = highlightText.value.trim().toLowerCase()
  return (text) => {
    const ranges = []
    if (!query) return ranges
    const lower = text.toLowerCase()
    for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, i + query.length))
      ranges.push({ start: i, end: i + query.length, keyword: query, key: query })
    return ranges
  }
})
</script>

<template>
  <div>
    <div>
      <input v-model="highlightText">
    </div>
    <VuePDF :pdf="pdf" text-layer :highlight-matcher="highlightMatcher" />
  </div>
</template>
```
<ClientOnly>
  <HighlightText />
</ClientOnly>
