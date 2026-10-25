import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // the 3D PC model (models/make-pc.py) is imported with ?inline
    assetsInclude: ['**/*.glb'],
    plugins: [react(), tailwindcss()]
  }
})
