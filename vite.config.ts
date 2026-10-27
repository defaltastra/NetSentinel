import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    proxy: {
      // Proxy API requests to Python FastAPI backend
      '/api': {
        target: process.env.VITE_API_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_WS_BACKEND_URL || 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
  preview: {
    port: parseInt(process.env.PORT || '4173'),
    host: true,
  },
})
