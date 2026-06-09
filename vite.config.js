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
        // non cacheare /api: i dati di mercato devono restare freschi
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 30 },
              networkTimeoutSeconds: 8
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173 }
})
