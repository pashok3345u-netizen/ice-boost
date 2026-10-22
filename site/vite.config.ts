import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // "/" for Vercel or your own domain; SITE_BASE=/ice-boost/ for GitHub Pages
  base: process.env.SITE_BASE ?? '/',
  plugins: [react(), tailwindcss()]
})
