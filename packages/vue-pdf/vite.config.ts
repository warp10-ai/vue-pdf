import { resolve } from 'node:path'
import { defineConfig, mergeConfig } from 'vite'
import commonConfig from '../../vite.config'

// https://vitejs.dev/config/
export default mergeConfig(
  commonConfig,
  defineConfig({
    build: {
      lib: {
        entry: resolve(__dirname, './src/index.ts'),
        name: '@warp10-pauloschussler/vue-pdf',
        fileName: 'index',
      },
      rollupOptions: {
        external: ['vue', 'pdfjs-dist'],
        output: {
          exports: 'named',
          globals: {
            'vue': 'vue',
            'pdfjs-dist': 'PDFJS',
          },
        },
      },
    },
  }),
)
