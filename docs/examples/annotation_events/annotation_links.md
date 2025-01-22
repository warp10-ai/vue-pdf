# Links

```vue
<script setup>
import { ref } from 'vue'
import { VuePDF, usePDF } from '@warp10-ai/vue-pdf'

const { pdf } = usePDF('/45.pdf')
function onAnnotation(value) {
  console.log(value)
}
</script>

<template>
  <div>
    <VuePDF :pdf="pdf" annotation-layer @annotation="onAnnotation" />
  </div>
</template>
```

<ClientOnly>
  <AnnoLinks />
</ClientOnly>
