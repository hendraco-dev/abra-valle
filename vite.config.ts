import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const proxy: Record<string, ProxyOptions> = {
  '/geo': {
    target: 'https://geoportal.siata.gov.co',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/geo/, ''),
  },
  '/legacy': {
    target: 'https://siata.gov.co',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/legacy/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
})
