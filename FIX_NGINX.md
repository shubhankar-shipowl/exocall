# Fix Nginx HTTPS Connection Issue

## Problem

Accessing `https://localhost:8456/` shows "Connection Refused" error.

## Solution

The nginx configuration has been updated with:

- Backend port: **8006** ✅
- HTTPS port: **8456** ✅
- Frontend port: **3000** ✅

### Step 1: Reload Nginx

Run this command to reload nginx with the new configuration:

```bash
sudo nginx -s reload
```

Or if nginx is not running:

```bash
sudo nginx
```

### Step 2: Verify Services Are Running

Make sure both backend and frontend are running:

**Backend (port 8006):**

```bash
curl http://localhost:8006/health
```

**Frontend (port 3000):**

```bash
curl http://localhost:3000
```

If either is not running, start them with:

```bash
./start.sh
```

Or manually:

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

### Step 3: Test HTTPS Access

After reloading nginx, try accessing:

- **HTTPS:** https://localhost:8456
- **HTTP:** http://localhost:8090

**Note:** For self-signed certificates, your browser will show a security warning. Click "Advanced" → "Proceed to localhost (unsafe)" to continue.

### Quick Fix Script

You can also use the setup script:

```bash
./setup-nginx.sh
```

This script will:

1. Copy the nginx config to the correct location
2. Generate SSL certificates if needed
3. Test the configuration
4. Reload nginx

### Troubleshooting

If issues persist:

1. **Check nginx error logs:**

   ```bash
   tail -f /tmp/nginx_exocall_ssl_error.log
   ```

2. **Check nginx status:**

   ```bash
   ps aux | grep nginx
   ```

3. **Verify config is loaded:**

   ```bash
   cat /opt/homebrew/etc/nginx/servers/exocall.conf | grep -E "8006|8456"
   ```

4. **Restart nginx completely:**
   ```bash
   sudo nginx -s stop
   sudo nginx
   ```
