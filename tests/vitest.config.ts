import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import commonConfig from "../vite.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default mergeConfig(
  commonConfig,
  defineConfig({
    test: {
      browser: {
        enabled: true,
        name: "chrome",
        headless: true,
      },
      deps: {
        inline: ["@warp10-ai/vue-pdf"],
      },
    },
    resolve: {
      alias: {
        "@warp10-ai/vue-pdf": path.resolve(
          __dirname,
          "../packages/vue-pdf"
        ),
      },
    },
  })
);
