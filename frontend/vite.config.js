import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'chaste-tradition-bonsai.ngrok-free.dev']

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5176),
    strictPort: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 4173),
    allowedHosts,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'react-icons', 'react-hot-toast']
        }
      }
    }
  }
})
