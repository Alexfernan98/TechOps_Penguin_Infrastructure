import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: Object.fromEntries(
      ['/api', '/auth', '/users', '/departments', '/locations', '/asset-categories', '/audit', '/assets', '/tickets', '/actas', '/notifications']
        .map(p => [p, { target: 'http://backend:4000', changeOrigin: true }])
    ),
  },
});
