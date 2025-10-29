# VPS-Only Fix Guide

## Problem Summary

✅ **Local machine**: Everything works fine  
❌ **VPS server (`srv512766.hstgr.cloud`)**: Nginx not listening on ports 8090/8456

## What to Do on Your VPS

### Step 1: SSH into Your VPS

```bash
ssh root@srv512766.hstgr.cloud
# or use your SSH method
cd ~/exocall
```

### Step 2: Check Current Nginx Setup

```bash
# Find nginx config
sudo find /etc -name "*exocall*" -o -name "*.conf" | grep nginx

# Check if nginx is running
sudo systemctl status nginx

# Check what ports nginx is actually listening on
sudo netstat -tuln | grep nginx
# Or
sudo ss -tuln | grep nginx
```

### Step 3: Fix Nginx Configuration

**Option A: Use Auto-Fix Script (Recommended)**

```bash
./fix-vps-nginx.sh
```

**Option B: Manual Fix**

1. **If config doesn't exist, create it:**

```bash
# Copy the VPS-ready config
sudo cp nginx.exocall.vps.conf /etc/nginx/sites-available/exocall.conf

# Enable it
sudo ln -sf /etc/nginx/sites-available/exocall.conf /etc/nginx/sites-enabled/exocall.conf
```

2. **If config exists, update it:**

```bash
sudo nano /etc/nginx/sites-available/exocall.conf
```

Make sure it has:

```nginx
server {
    listen 8090;
    listen [::]:8090;  # IPv6 support - IMPORTANT for VPS
    server_name srv512766.hstgr.cloud _;  # Accept your domain and any hostname

    # ... rest of your config ...
}
```

3. **Test and apply:**

```bash
sudo nginx -t
sudo nginx -s reload
# Or if reload doesn't work:
sudo systemctl restart nginx
```

### Step 4: Configure Firewall (Critical for VPS!)

```bash
# Ubuntu/Debian
sudo ufw allow 8090/tcp
sudo ufw allow 8456/tcp
sudo ufw reload
sudo ufw status

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8090/tcp
sudo firewall-cmd --permanent --add-port=8456/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

**Important**: If using cloud providers (AWS, DigitalOcean, Hetzner, etc.), also configure their firewall:

- AWS: Security Groups → Add inbound rule for port 8090
- DigitalOcean: Networking → Firewalls → Add rules
- Hetzner: Firewall → Create rule for port 8090

### Step 5: Verify Everything Works

```bash
# Check ports are now listening
sudo netstat -tuln | grep -E "8090|8456"
# Should show:
# tcp  0  0 0.0.0.0:8090  LISTEN
# tcp  0  0 [::]:8090     LISTEN

# Test local access
curl http://localhost:8090/health
# Should return: {"status":"OK",...}

# Test from external (from your local machine)
curl http://srv512766.hstgr.cloud:8090/health

# Run diagnostic
./check-vps-access.sh
```

### Step 6: Update SERVER_URL (For Webhooks)

```bash
nano ~/exocall/server/.env
```

Add or update:

```bash
SERVER_URL=http://srv512766.hstgr.cloud:8090
```

Then restart your backend:

```bash
pm2 restart all
```

## Common VPS-Specific Issues

### Issue: "Permission denied" when accessing ports

**Solution**: Make sure nginx is running as root or has proper permissions

### Issue: "Connection refused" from external browser

**Solution**:

1. Check firewall: `sudo ufw status`
2. Check cloud provider firewall
3. Verify nginx is listening on 0.0.0.0, not just 127.0.0.1

### Issue: "502 Bad Gateway"

**Solution**:

1. Check backend is running: `curl http://localhost:8006/health`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Issue: Nginx config not found

**Solution**:

1. Check if nginx is installed: `which nginx`
2. Find nginx config directory: `nginx -T 2>&1 | grep -E "configuration file|sites-enabled"`
3. Create config in appropriate location

## Quick Checklist for VPS

- [ ] Nginx config exists at `/etc/nginx/sites-available/exocall.conf`
- [ ] Config has `server_name _;` or your domain
- [ ] Config has `listen [::]:8090;` for IPv6
- [ ] Nginx config test passes: `sudo nginx -t`
- [ ] Nginx reloaded/restarted successfully
- [ ] Firewall allows ports 8090 and 8456
- [ ] Cloud provider firewall allows ports 8090 and 8456
- [ ] Port 8090 shows as LISTEN: `sudo netstat -tuln | grep 8090`
- [ ] Can access locally: `curl http://localhost:8090/health`
- [ ] SERVER_URL updated in `server/.env`
- [ ] Backend restarted after SERVER_URL change

## Expected Result

After completing these steps on your VPS:

- ✅ `./check-vps-access.sh` shows all green checkmarks
- ✅ `http://srv512766.hstgr.cloud:8090` is accessible from browser
- ✅ Webhooks work properly

## Still Having Issues?

Run these diagnostics on your VPS:

```bash
# Nginx status
sudo systemctl status nginx

# Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# What's actually listening
sudo lsof -i -P -n | grep -E "8090|8456|nginx"

# Test backend directly
curl http://localhost:8006/health

# Test nginx proxy
curl -v http://localhost:8090/health
```
