import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("node_modules/@firebase/app")) return "firebase-app";
          if (id.includes("node_modules/@firebase/auth")) return "firebase-auth";
          if (id.includes("node_modules/@firebase/firestore")) return "firebase-firestore";
          if (id.includes("node_modules/@firebase/database")) return "firebase-database";
          if (id.includes("node_modules/@firebase/storage")) return "firebase-storage";
          if (id.includes("node_modules/firebase/")) return "firebase-core";
          if (id.includes("node_modules/@mstblockchain/")) return "mst-sdk";
          if (id.includes("node_modules/ethers/") || id.includes("node_modules/@noble/") || id.includes("node_modules/@adraffy/") || id.includes("node_modules/@scure/")) return "ethers";
          if (id.includes("node_modules/micromark") || id.includes("node_modules/mdast") || id.includes("node_modules/unified") || id.includes("node_modules/remark") || id.includes("node_modules/hast") || id.includes("node_modules/vfile")) return "markdown";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@splinetool")) return "spline";
          const packagePath = id.slice(id.lastIndexOf("node_modules/") + "node_modules/".length).split("/");
          const packageName = packagePath[0]?.startsWith("@")
            ? `${packagePath[0]}-${packagePath[1]}`
            : packagePath[0];
          return packageName ? `vendor-${packageName.replace(/[^a-zA-Z0-9_-]/g, "-")}` : "vendor";
        },
      },
    },
  },
});
