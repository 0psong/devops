import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split large vendor dependencies into smaller cacheable chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react'
          }

          if (
            id.includes('/echarts/') ||
            id.includes('/echarts-for-react/') ||
            id.includes('/zrender/')
          ) {
            return 'vendor-echarts'
          }

          if (id.includes('/dayjs/')) {
            return 'vendor-dayjs'
          }
        },
      },
    },
    // Enable source maps for production debugging (disable if not needed)
    sourcemap: false,
    // Use Vite's default esbuild minifier to avoid requiring terser at build time.
    minify: 'esbuild',
  },
})
