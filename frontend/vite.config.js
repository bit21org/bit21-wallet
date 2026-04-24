import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { viteObfuscateFile } from "vite-plugin-obfuscator";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    wasm(),
    topLevelAwait(),
    // Obfuscate production builds to prevent reverse engineering
    ...(mode === "production"
      ? [
          viteObfuscateFile({
            exclude: [/biometric/, /native-back/, /capacitor/, /@aparajita/, /@capacitor/],
            options: {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.3,
              deadCodeInjection: false,
              
              debugProtection: false,
              debugProtectionInterval: 0,
              disableConsoleOutput: true,
              identifierNamesGenerator: "hexadecimal",
              renameGlobals: false,
              selfDefending: false,
              stringArray: true,
              stringArrayCallsTransform: true,
              stringArrayEncoding: ["base64"],
              stringArrayIndexShift: true,
              stringArrayRotate: true,
              stringArrayShuffle: true,
              stringArrayWrappersCount: 2,
              stringArrayWrappersType: "function",
              stringArrayThreshold: 0.75,
              splitStrings: true,
              splitStringsChunkLength: 10,
              transformObjectKeys: false,
              unicodeEscapeSequence: false,
            },
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ["tiny-secp256k1"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
}));
