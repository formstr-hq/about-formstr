import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split three.js core into its own chunk. It's large but stable, so it
        // stays cached across deploys while the (small) scene code changes —
        // and it downloads in parallel with the scene chunk on first load.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
        },
      },
    },
  },
})
