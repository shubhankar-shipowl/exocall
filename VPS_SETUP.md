# VPS Setup Guide for ExoCall Dashboard

## Problem

The application runs on localhost but is not accessible from external browsers when deployed on VPS.

## Solution Steps

### 1. Update Nginx Configuration for VPS

The current nginx config only listens on `localhost`, which blocks external connections. For VPS access:

#### Option A: Use the VPS-specific config

```bash
# On your VPS, copy the VPS config
sudo cp nginx.exocall.vps.conf /etc/nginx/sites-available/exocall.conf
# Or for Homebrew nginx on macOS:
sudo cp nginx.exocall.vps.conf /opt/homebrew/etc/nginx/servers/exocall.conf
```

#### Option B: Modify existing config manually

Edit your nginx config and change:

```nginx
# Change from:
listen 8090;
server_name localhost;

# To:
listen 8090;
listen [::]:8090;  # IPv6 support
server_name srv512766.hstgr.cloud _;  # Your VPS domain or _ for any domain
```

### 2. Set Environment Variables on VPS

**Critical:** Update your `.env` file in the `server` directory:

```bash
# In server/.env file, add/update:

# Set SERVER_URL to your VPS domain for webhooks
SERVER_URL=http://srv512766.hstgr.cloud:8090

# Or if using HTTPS:
# SERVER_URL=https://srv512766.hstgr.cloud:8456

# If using ngrok, set it to your ngrok URL:
# SERVER_URL=https://your-ngrok-url.ngrok-free.app
```

### 3. Configure Firewall

Open the required ports on your VPS:

**For Ubuntu/Debian:**

```bash
# Allow HTTP on port 8090
sudo ufw allow 8090/tcp

# Allow HTTPS on port 8456 (if using SSL)
sudo ufw allow 8456/tcp

# Reload firewall
sudo ufw reload
```

**For CentOS/RHEL:**

```bash
# Allow HTTP on port 8090
sudo firewall-cmd --permanent --add-port=8090/tcp

# Allow HTTPS on port 8456
sudo firewall-cmd --permanent --add-port=8456/tcp

# Reload firewall
sudo firewall-cmd --reload
```

**For cloud providers (AWS, DigitalOcean, etc.):**

- Go to your cloud provider's security group/firewall settings
- Add inbound rules for:
  - Port 8090 (HTTP)
  - Port 8456 (HTTPS, if using)

### 4. Reload Nginx

After making changes:

```bash
# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo nginx -s reload

# Or restart if reload doesn't work
sudo systemctl restart nginx
# Or for Homebrew:
sudo brew services restart nginx
```

### 5. Verify Services Are Running

Check that all services are accessible:

```bash
# Check backend (should work locally)
curl http://localhost:8006/health

# Check frontend (should work locally)
curl http://localhost:3000

# Check via nginx (should work locally)
curl http://localhost:8090/health

# From another machine, test external access:
curl http://srv512766.hstgr.cloud:8090/health
```

### 6. Check Nginx Status and Logs

If still not working, check:

```bash
# Check nginx status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
# Or:
sudo tail -f /var/log/nginx/exocall_error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### 7. Common Issues and Fixes

#### Issue: "502 Bad Gateway"

**Cause:** Backend service not running or not accessible
**Fix:**

```bash
# Make sure backend is running
pm2 status
# If not running:
pm2 start ecosystem.config.js
# Or:
./start.sh
```

#### Issue: "Connection Timeout"

**Cause:** Firewall blocking port
**Fix:** Configure firewall (Step 3 above)

#### Issue: Webhooks not working (ngrok 502 errors)

**Cause:** SERVER_URL not set correctly
**Fix:** Update `SERVER_URL` in `server/.env` to your public URL

#### Issue: "Connection Refused"

**Cause:** Nginx not listening on external interface
**Fix:** Ensure nginx config has `server_name _;` or your domain, not just `localhost`

### 8. Testing Checklist

- [ ] Backend running on port 8006
- [ ] Frontend running on port 3000
- [ ] Nginx running and configured
- [ ] Firewall allows ports 8090 and 8456
- [ ] SERVER_URL set correctly in `.env`
- [ ] Nginx listening on external interface (not just localhost)
- [ ] Can access `http://srv512766.hstgr.cloud:8090/health` from external browser
- [ ] Webhooks can reach your server (check ngrok/webhook logs)

### 9. Production Deployment

For production, consider:

1. **Use a proper domain** instead of IP:port
2. **Set up SSL/HTTPS** with Let's Encrypt
3. **Configure proper firewall rules**
4. **Set NODE_ENV=production** in your `.env`
5. **Use production PM2 config:**
   ```bash
   npm run build:prod
   npm run start:prod
   ```

### Quick Command Reference

```bash
# Start application
./start.sh

# Check PM2 status
pm2 status

# View logs
pm2 logs

# Reload nginx
sudo nginx -t && sudo nginx -s reload

# Check open ports
sudo netstat -tulpn | grep -E '8090|8456|8006|3000'

# Test local access
curl http://localhost:8090/health

# Test external access (from another machine)
curl http://YOUR_VPS_IP:8090/health
```
