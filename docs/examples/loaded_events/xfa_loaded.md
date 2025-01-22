# XFA Loaded Event

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'
import '@warp10-ai/vue-pdf/style.css'

const { pdf } = usePDF({
  url: '/xfa.pdf',
  enableXfa: true,
})
function onLoaded() {
  console.log("XFA loaded")
}
</script>

<template>
  <div>
    <VuePDF :pdf="pdf" @xfa-loaded="onLoaded" />
  </div>
</template>
```

<ClientOnly>
  <XFALoaded />
</ClientOnly>
