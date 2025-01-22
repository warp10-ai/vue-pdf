# XFA Forms

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'
import '@warp10-ai/vue-pdf/style.css'

const { pdf } = usePDF({
  url: '/xfa.pdf',
  enableXfa: true,
})
</script>

<template>
  <div class="container">
    <VuePDF :pdf="pdf" />
  </div>
</template>
```
<ClientOnly>
  <XFALayer />
</ClientOnly>
