import { resolve } from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import commonConfig from '../../vite.config';

export default mergeConfig(
  commonConfig,
  defineConfig({
    resolve: {
      alias: {
        "@warp10-pauloschussler/vue-pdf": resolve(__dirname, "../vue-pdf/src"),
      },
    },
  })
);
