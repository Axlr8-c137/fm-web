import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // Rewrite the Origin header to match the target to bypass backend CORS checks
        headers: {
          Origin: 'http://localhost:8080',
        },
      },
    },
  },
})
