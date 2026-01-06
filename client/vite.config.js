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
          const errorSuppression = new Map(); // Track suppressed errors per path
          const lastErrorTime = new Map(); // Track when errors occurred
          const maxErrors = 2;
          const suppressionWindow = 10000; // 10 seconds
          
          proxy.on('error', (err, req, res) => {
            const path = req.url || '';
            const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
            
            if (isConnectionError) {
              const now = Date.now();
              
              // Track errors per path
              if (!errorSuppression.has(path)) {
                errorSuppression.set(path, { count: 0, firstError: now });
                lastErrorTime.set(path, now);
              }
              
              const errorInfo = errorSuppression.get(path);
              const timeSinceLastError = now - lastErrorTime.get(path);
              
              // Reset count if enough time has passed
              if (timeSinceLastError > suppressionWindow) {
                errorInfo.count = 0;
              }
              
              errorInfo.count++;
              lastErrorTime.set(path, now);
              
              // Suppress if too many errors in short time
              if (errorInfo.count > maxErrors) {
                // Silently suppress - don't respond or log
                return;
              }
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
            const path = req.url || '';
            // Reset error count on successful request
            if (errorSuppression.has(path)) {
              errorSuppression.set(path, { count: 0, firstError: Date.now() });
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            const path = req.url || '';
            // Reset error count on successful response
            if (errorSuppression.has(path)) {
              errorSuppression.set(path, { count: 0, firstError: Date.now() });
            }
          });
        },
      },
    },
  },
  // Suppress proxy error logs in Vite's logger
  logLevel: 'warn',
  customLogger: {
    info: (msg) => {
      // Suppress proxy error messages
      if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
        return;
      }
      console.log(msg);
    },
    warn: (msg) => {
      // Suppress proxy error warnings
      if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
        return;
      }
      console.warn(msg);
    },
    error: (msg) => {
      // Suppress proxy connection errors
      if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
        return;
      }
      console.error(msg);
    },
  },
});
