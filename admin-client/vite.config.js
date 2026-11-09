import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredApiUrl = env.VITE_API_URL || 'http://127.0.0.1:3000/api'
  // Node may resolve localhost to IPv6 ::1 while the backend listens on IPv4.
  const apiUrl = configuredApiUrl.replace(/\/\/localhost(?=[:/])/i, '//127.0.0.1')

  return {
    plugins: [react()],
    base: './',
    // Set one consistent API URL for all Electron renderer requests.
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: new URL(apiUrl).origin,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'out',
      emptyOutDir: false,
    },
  }
})
