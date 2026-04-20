import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_APP_BASE || '/',
  plugins: [react()],
  server: {
    port: 3100,
    host: '0.0.0.0'
  }
})
