import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Drewvidend',
        short_name: 'Drewvidend',
        description: 'Dividendi Borsa Italiana - lista, filtri, watchlist, segnali',
        theme_color: '#14161b',
        background_color: '#14161b',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // /api NON passa dal service worker. Prima c'era un NetworkFirst con
        // networkTimeoutSeconds: 8 — e quella era una ghigliottina: /api/divinfo
        // interroga Yahoo 40 volte per blocco, quindi su rete mobile supera
        // facilmente gli 8s. Al timeout workbox annullava la richiesta e, senza
        // copia in cache, la rigettava: l'app perdeva 20 titoli per volta in
        // silenzio e il calendario si svuotava. Le risposte sono già cachate
        // all'edge Cloudflare (Cache-Control), qui non serve un secondo livello.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  server: { port: 5173 }
})
