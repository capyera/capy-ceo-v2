import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/capy-ceo-v2/',
  server: {
    allowedHosts: true,
    proxy: {
      // Proxy Shopify API calls in development
      '/api/shopify': {
        target: 'https://152919-65.myshopify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/shopify/, '/admin/api/2024-01'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Add Shopify access token header
            // In production, use Cloudflare Worker with secrets
            proxyReq.setHeader('X-Shopify-Access-Token', process.env.SHOPIFY_ACCESS_TOKEN || '');
          });
        },
      },
    },
  },
})
