# Text Layer

```vue
<script setup>
import { ref } from 'vue'
import { VuePDF, usePDF } from '@warp10-pauloschussler/vue-pdf'
import '@warp10-pauloschussler/vue-pdf/style.css'

const text_layer = ref(false)
const { pdf } = usePDF('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf')
</script>

<template>
  <div>
    <div>
      <button @click="text_layer = !text_layer">
        Change to {{ !text_layer }}
      </button>
    </div>
    <VuePDF :pdf="pdf" :text-layer="text_layer" />
  </div>
</template>
```
<ClientOnly>
  <TextLayer />
</ClientOnly>
