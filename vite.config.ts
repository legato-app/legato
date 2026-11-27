import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { phosphor } from './vite.phosphor'

// Tauri dev expects fixed port + no screen clear. `--mode lite` (tauri.lite.conf.json): Legato Lite (shared/edition.ts).
export default defineConfig(({ mode }) => ({
  root: 'ui',
  plugins: [react(), tailwindcss(), phosphor()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2023' },
  define: { __LITE__: JSON.stringify(mode === 'lite') },
}))
