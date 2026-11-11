<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf';
import '@warp10-ai/vue-pdf/style.css';
import { computed, ref } from 'vue';

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

const eventValue = ref({})
function onHighlight(value) {
  console.log(value)
  eventValue.value = value
}
</script>

<template>
  <div class="vue-pdf-container">
    <table>
      <tr>
        <td colspan="2">
          Text
        </td>
        <td colspan="2">
          <input v-model="highlightText" class="input-example">
        </td>
      </tr>
    </table>

    <VuePDF :scale="1.1" :pdf="pdf" text-layer :highlight-matcher="highlightMatcher" @highlight="onHighlight" />
  </div>
</template>
