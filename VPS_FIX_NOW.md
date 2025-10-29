# ⚡ Quick Fix - Run This on Your VPS NOW

## Single Command Solution

```bash
cd ~/exocall
./vps-complete-setup.sh
```

This script will:

1. ✅ Create nginx config (auto-detects if missing)
2. ✅ Start backend and frontend services
3. ✅ Configure firewall
4. ✅ Verify everything works

---

## OR Step-by-Step Manual Fix

### Step 1: Start Backend and Frontend

```bash
cd ~/exocall

# Option A: Use start script
./start.sh

# Option B: Use PM2
pm2 start ecosystem.config.js
pm2 save

# Option C: Manual start
cd server && npm run dev &
cd ../client && npm run dev &
```

**Wait 10 seconds, then verify:**

```bash
curl http://localhost:8006/health
curl http://localhost:3000
```

### Step 2: Fix Nginx Config

```bash
cd ~/exocall

# Run auto-fix script
./fix-vps-nginx.sh

# It will:
# - Find or create nginx config
# - Update server_name to accept external connections
# - Add IPv6 support
# - Test and reload nginx
```

### Step 3: Open Firewall

```bash
sudo ufw allow 8090/tcp
sudo ufw allow 8456/tcp
sudo ufw reload
sudo ufw status
```

### Step 4: Verify Everything

```bash
# Check diagnostic
./check-vps-access.sh

# Test access
curl http://localhost:8090/health

# Check ports
sudo netstat -tuln | grep -E "8090|8456"
```

---

## What Was Fixed

### Issue 1: Nginx Config Not Found

- **Fixed**: `fix-vps-nginx.sh` now automatically creates config if missing
- **Location**: Uses `/etc/nginx/sites-available/exocall.conf` (or auto-detects)

### Issue 2: Backend/Frontend Not Running

- **Fixed**: `vps-complete-setup.sh` starts both services automatically
- **Method**: Uses `./start.sh` or PM2 to start services

### Issue 3: Ports Not Listening

- **Fixed**: Once nginx config exists and services run, ports will listen
- **Required**: Firewall must allow ports 8090 and 8456

---

## Expected Result After Fix

When you run `./check-vps-access.sh`, you should see:

```
✅ Backend is running
✅ Frontend is running
✅ Nginx is running
✅ Nginx config is valid
✅ Nginx configured to accept external connections
✅ Port 8090 is listening
✅ Port 8456 is listening
✅ Can access backend through nginx
```

---

## Troubleshooting

### If backend still won't start:

```bash
# Check logs
cd ~/exocall/server
npm run dev

# Check if port 8006 is in use
sudo lsof -i :8006
```

### If nginx still not listening:

```bash
# Check nginx status
sudo systemctl status nginx

# Check nginx error log
sudo tail -50 /var/log/nginx/error.log

# Verify config exists
sudo ls -la /etc/nginx/sites-available/exocall.conf
sudo ls -la /etc/nginx/sites-enabled/exocall.conf
```

### If firewall issues:

```bash
# Check firewall status
sudo ufw status verbose

# Check what's blocking
sudo iptables -L -n | grep 8090
```

---

## After Everything Works

Access your app at:

- `http://srv512766.hstgr.cloud:8090`
- `https://srv512766.hstgr.cloud:8456` (if SSL configured)
