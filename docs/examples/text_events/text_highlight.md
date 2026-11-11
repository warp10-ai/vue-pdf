# Highlight Event

::: warning
Highlight event's payload has too many data to display on screen, open the console to see the results.
:::

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'
import '@warp10-ai/vue-pdf/style.css'
import { computed, ref } from 'vue'

const { pdf } = usePDF('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf')

const highlightText = ref('Trace-based')
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

function onHighlight(value) {
  console.log(value)
}
</script>

<template>
  <div>
    <input v-model="highlightText">
    <VuePDF :pdf="pdf" text-layer :highlight-matcher="highlightMatcher" @highlight="onHighlight" />
  </div>
</template>
```

<ClientOnly>
  <TextHighlight />
</ClientOnly>
