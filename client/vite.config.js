import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections
    allowedHosts: [
      'localhost',
      'srv512766.hstgr.cloud',
      '.hstgr.cloud', // Allow all subdomains of hstgr.cloud
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8006',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy, _options) => {
          let errorCount = 0;
          const maxErrors = 5;
          
          proxy.on('error', (err, req, res) => {
            errorCount++;
            const errorMsg = err.message || 'Unknown error';
            
            // Only log first few errors to avoid spam
            if (errorCount <= maxErrors) {
              if (err.code === 'ECONNREFUSED') {
                console.log('⚠️  Proxy error: Backend server connection refused');
                console.log('💡 The backend server may be starting up. Retrying...');
              } else if (err.code === 'ETIMEDOUT') {
                console.log('⚠️  Proxy error: Backend server timeout');
              } else {
                console.log('⚠️  Proxy error:', errorMsg);
              }
            }
            
            // Suppress error after max errors to avoid console spam
            if (errorCount > maxErrors) {
              return;
            }
            
            // Only send error response if headers haven't been sent
            if (res && !res.headersSent) {
              try {
                res.writeHead(503, { 
                  'Content-Type': 'application/json',
                  'Retry-After': '2'
                });
                res.end(JSON.stringify({
                  error: 'Backend server temporarily unavailable',
                  message: 'The backend server may be starting up. Please try again in a moment.',
                  retry: true
                }));
              } catch (e) {
                // Ignore errors if response already closed
              }
            }
          });
          
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Reset error count on successful request
            if (errorCount > 0) {
              errorCount = 0;
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // Reset error count on successful response
            if (errorCount > 0) {
              errorCount = 0;
            }
          });
        },
      },
    },
  },
});
