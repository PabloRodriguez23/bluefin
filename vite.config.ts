import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE permite publicar en una subruta, p. ej. GitHub Pages: BASE=/mis-finanzas/
const base = process.env.BASE ?? '/'

export default defineConfig({
  base,
  // Recharts ocupa la mayor parte del bundle; aun así son ~200 kB gzip
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png'],
      manifest: {
        name: 'Mis Finanzas',
        short_name: 'Finanzas',
        description: 'Controla tus gastos fijos, variables e ingresos de forma sencilla y visual.',
        lang: 'es',
        theme_color: '#1c5cab',
        background_color: '#eef4fc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
