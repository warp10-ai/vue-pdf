# XFA Forms

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-pauloschussler/vue-pdf'
import '@warp10-pauloschussler/vue-pdf/style.css'

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
