# Annotations Filter

```vue
<script setup>
import { ref } from 'vue'
import { VuePDF, usePDF } from '@warp10-pauloschussler/vue-pdf'

const { pdf } = usePDF('/14.pdf')

const filters = ref(['Widget', 'Widget.Tx', 'Widget.Btn', 'Widget.Ch'])
const selectedFilter = ref(['Widget'])
const vuePDFRef = ref(null)

function reloadPage() {
  vuePDFRef.value.reload()
}
</script>

<template>
  <div>
    <div>
      <select v-model="selectedFilter[0]" class="select-example" @change="reloadPage">
        <option v-for="flt in filters" :key="flt" :value="flt">
          {{ flt }}
        </option>
      </select>
    </div>
    <VuePDF ref="vuePDFRef" :pdf="pdf" annotation-layer :annotations-filter="selectedFilter" />
  </div>
</template>
```

<ClientOnly>
  <AnnotationFilter />
</ClientOnly>
