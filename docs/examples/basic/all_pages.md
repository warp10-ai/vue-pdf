# All pages

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'

const { pdf, pages } = usePDF('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf')
</script>

<template>
  <div v-for="page in pages" :key="page">
    <VuePDF :pdf="pdf" :page="page" />
  </div>
</template>
```

<ClientOnly>
  <AllPages />
</ClientOnly>
