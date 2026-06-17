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
    // Permite acceso desde localhost, IPs de la LAN y dominios *.nip.io / *.sslip.io
    // (servicios que mapean <IP>.nip.io → IP, usados para que Google OAuth acepte hosts
    // sin TLD .com/.org de un servidor on-premise).
    allowedHosts: ['localhost', '.nip.io', '.sslip.io', '.traefik.me'],
    // Solo /api, /auth (OAuth), /health, /uploads van al backend.
    // El resto (/, /assets, /tickets, /actas, etc.) lo maneja el SPA.
    proxy: Object.fromEntries(
      ['/api', '/auth', '/health', '/uploads']
        .map(p => [p, { target: 'http://backend:4000', changeOrigin: true }])
    ),
  },
});
