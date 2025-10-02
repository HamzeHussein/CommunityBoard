// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Använd IPv4 explicit för att undvika ::1 (IPv6) problem
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
    },
  },
})
