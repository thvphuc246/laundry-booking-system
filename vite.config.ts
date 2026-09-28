import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: { outDir: '../../dist', emptyOutDir: true },
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } } },
})
