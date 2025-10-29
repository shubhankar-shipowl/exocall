# Quick Fix for VPS Nginx Issues

## Problem

On your VPS (`root@srv512766`), nginx config is not found and ports 8090/8456 are not listening.

## Quick Fix Commands

Run these commands **on your VPS**:

### 1. Find and Update Nginx Config

```bash
# Find nginx config file
sudo find /etc -name "*exocall*" 2>/dev/null
sudo find /etc -name "*.conf" | grep nginx | grep -E "(sites|conf.d)"

# Common locations:
# - /etc/nginx/sites-enabled/exocall.conf
# - /etc/nginx/sites-available/exocall.conf
# - /etc/nginx/conf.d/exocall.conf
```

### 2. Use the Fix Script

```bash
cd ~/exocall
./fix-vps-nginx.sh
```

This script will:

- Auto-detect your nginx config location
- Backup your current config
- Update `server_name` to accept external connections
- Add IPv6 support
- Test and reload nginx

### 3. Manual Fix (if script doesn't work)

**Step 1:** Find your nginx config:

```bash
sudo find /etc -name "*.conf" | xargs grep -l "exocall\|8006\|8090" 2>/dev/null
```

**Step 2:** Edit the config file:

```bash
sudo nano /etc/nginx/sites-enabled/exocall.conf
# or
sudo nano /etc/nginx/sites-available/exocall.conf
```

**Step 3:** Ensure these lines exist:

```nginx
server {
    listen 8090;
    listen [::]:8090;  # Add this line
    server_name localhost _;  # Change from just "localhost" to "localhost _"

    # ... rest of config ...
}
```

**Step 4:** Test and reload:

```bash
sudo nginx -t
sudo nginx -s reload
# Or restart:
sudo systemctl restart nginx
```

### 4. Check Firewall

```bash
# Ubuntu/Debian
sudo ufw allow 8090/tcp
sudo ufw allow 8456/tcp
sudo ufw reload

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8090/tcp
sudo firewall-cmd --permanent --add-port=8456/tcp
sudo firewall-cmd --reload
```

### 5. Verify Everything Works

```bash
# Check ports are listening
sudo netstat -tuln | grep -E "8090|8456"
# Or
sudo ss -tuln | grep -E "8090|8456"

# Test local access
curl http://localhost:8090/health

# Run diagnostic
./check-vps-access.sh
```

## If Still Not Working

### Check Nginx Status

```bash
sudo systemctl status nginx
sudo journalctl -u nginx -n 50
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Verify Backend is Running

```bash
curl http://localhost:8006/health
pm2 status
```

### Check What Ports Nginx is Actually Listening On

```bash
sudo lsof -i -P -n | grep nginx
```

## Expected Result

After fixing, you should see:

- ✅ Port 8090 is listening
- ✅ Port 8456 is listening (HTTPS)
- ✅ Can access backend through nginx
- ✅ External access: `http://srv512766.hstgr.cloud:8090`
