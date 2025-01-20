# Annotation Loaded Event

::: warning
Annotation loaded event's payload has too many data to display on screen, open the console to see the results.
:::

```vue
<script setup>
import { VuePDF, usePDF } from '@warp10-pauloschussler/vue-pdf'

const { pdf } = usePDF('/14.pdf')
function onLoaded(value) {
  console.log(value)
}
</script>

<template>
  <div>
    <VuePDF :pdf="pdf" annotation-layer @annotation-loaded="onLoaded" />
  </div>
</template>
```

<ClientOnly>
  <AnnotationLoaded />
</ClientOnly>
