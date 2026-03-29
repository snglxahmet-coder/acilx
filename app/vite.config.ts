import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'ACİLX',
        short_name: 'ACİLX',
        description: 'Acil Servis Nöbet Yönetim Platformu',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0A0E1A',
        theme_color: '#0A0E1A',
        orientation: 'portrait-primary',
        lang: 'tr',
        categories: ['medical', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\/identitytoolkit/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-api',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/securetoken\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-token',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-images',
              expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  base: '/',
  build: {
    outDir: '../public-react',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase'
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/lucide-react')) {
            return 'vendor-ui'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
