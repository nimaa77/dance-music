import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png',
        'icon-192.png',
        'icon-512.png',
        'social-card.png',
        'robots.txt',
        'sitemap.xml',
      ],
      manifest: {
        id: '/',
        name: 'Dance Loop',
        short_name: 'Dance Loop',
        description:
          'Choose any song, mark a section, and repeat it with an optional pause for dance practice.',
        lang: 'en',
        categories: ['music', 'education', 'utilities'],
        theme_color: '#11120f',
        background_color: '#f4f1e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'audio',
                accept: [
                  'audio/*',
                  'application/ogg',
                  '.aac',
                  '.flac',
                  '.m4a',
                  '.mp3',
                  '.oga',
                  '.ogg',
                  '.opus',
                  '.wav',
                  '.webm',
                ],
              },
            ],
          },
        },
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
