import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force the CJS bundle of gedcom — the ESM bundle uses node:module
      // which is not available in the browser.
      'gedcom': path.resolve(__dirname, 'node_modules/gedcom/dist/index.cjs'),
    },
  },
})
