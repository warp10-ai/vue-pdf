# File attachment

```vue
<script setup>
import { ref } from 'vue'
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'

const { pdf } = usePDF('/41.pdf')
function onAnnotation(value) {
  console.log(value)
}
</script>

<template>
  <div>
    <VuePDF :pdf="pdf" annotation-layer image-resources-path="https://unpkg.com/pdfjs-dist@latest/web/images/" @annotation="onAnnotation" />
  </div>
</template>
```
<ClientOnly>
  <AnnoAttachment />
</ClientOnly>
