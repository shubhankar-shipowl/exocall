#!/bin/bash

# Complete VPS Setup Script
# This script fixes all issues found in the diagnostic

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Complete VPS Setup for ExoCall"
echo "=================================="
echo ""

# Check if running as root (optional, but useful)
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Note: Some commands may require sudo${NC}"
fi

# Step 1: Fix Nginx Configuration
echo -e "${BLUE}Step 1: Setting up Nginx...${NC}"
echo ""

# Run the nginx fix script
if [ -f "./fix-vps-nginx.sh" ]; then
    ./fix-vps-nginx.sh
else
    echo -e "${RED}fix-vps-nginx.sh not found. Running nginx setup manually...${NC}"
    
    # Find or create nginx config
    NGINX_CONFIG="/etc/nginx/sites-available/exocall.conf"
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        echo "Creating nginx config..."
        if [ -f "nginx.exocall.vps.conf" ]; then
            sudo cp nginx.exocall.vps.conf "$NGINX_CONFIG"
        elif [ -f "nginx.exocall.conf" ]; then
            sudo cp nginx.exocall.conf "$NGINX_CONFIG"
        else
            echo -e "${RED}Could not find nginx config template${NC}"
            exit 1
        fi
        
        # Enable it
        if [ -d "/etc/nginx/sites-enabled" ]; then
            sudo ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/exocall.conf"
        fi
    fi
    
    # Test and reload
    sudo nginx -t && sudo nginx -s reload
fi

echo ""

# Step 2: Start Backend and Frontend
echo -e "${BLUE}Step 2: Starting Backend and Frontend services...${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing...${NC}"
    npm install -g pm2
fi

# Check if services are already running
if pm2 list | grep -q "exocall"; then
    echo -e "${YELLOW}Services already running. Restarting...${NC}"
    pm2 restart exocall
else
    echo "Starting services..."
    
    # Check if start.sh exists and use it, otherwise use PM2 directly
    if [ -f "./start.sh" ]; then
        echo "Using ./start.sh to start services..."
        ./start.sh
    elif [ -f "ecosystem.config.js" ]; then
        echo "Starting with PM2..."
        pm2 start ecosystem.config.js
        pm2 save
    else
        echo -e "${RED}Could not find start script or ecosystem config${NC}"
        echo "Please start services manually:"
        echo "  Backend: cd server && npm run dev &"
        echo "  Frontend: cd client && npm run dev &"
    fi
fi

echo ""
sleep 3

# Step 3: Check if services are running
echo -e "${BLUE}Step 3: Verifying services...${NC}"
echo ""

# Check backend
if curl -s http://localhost:8006/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on port 8006${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo "   Trying to start backend..."
    cd server && npm run dev > /tmp/backend.log 2>&1 &
    sleep 3
    if curl -s http://localhost:8006/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend started${NC}"
    else
        echo -e "${RED}❌ Failed to start backend. Check: /tmp/backend.log${NC}"
    fi
    cd ..
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on port 3000${NC}"
else
    echo -e "${RED}❌ Frontend is NOT running${NC}"
    echo "   Trying to start frontend..."
    cd client && npm run dev > /tmp/frontend.log 2>&1 &
    sleep 3
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend started${NC}"
    else
        echo -e "${RED}❌ Failed to start frontend. Check: /tmp/frontend.log${NC}"
    fi
    cd ..
fi

echo ""

# Step 4: Configure Firewall
echo -e "${BLUE}Step 4: Configuring Firewall...${NC}"
echo ""

if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    sudo ufw allow 8090/tcp
    sudo ufw allow 8456/tcp
    sudo ufw reload
    echo -e "${GREEN}✅ Firewall configured${NC}"
    sudo ufw status | grep -E "8090|8456"
elif command -v firewall-cmd &> /dev/null; then
    echo "Configuring firewalld..."
    sudo firewall-cmd --permanent --add-port=8090/tcp
    sudo firewall-cmd --permanent --add-port=8456/tcp
    sudo firewall-cmd --reload
    echo -e "${GREEN}✅ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠️  No firewall detected. Please configure manually:${NC}"
    echo "   Allow ports 8090 and 8456 in your firewall"
fi

echo ""

# Step 5: Final Verification
echo -e "${BLUE}Step 5: Final Verification...${NC}"
echo ""

# Check ports
if netstat -tuln 2>/dev/null | grep -q ":8090.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":8090.*LISTEN"; then
    echo -e "${GREEN}✅ Port 8090 is listening${NC}"
else
    echo -e "${RED}❌ Port 8090 is NOT listening${NC}"
fi

if netstat -tuln 2>/dev/null | grep -q ":8456.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":8456.*LISTEN"; then
    echo -e "${GREEN}✅ Port 8456 is listening${NC}"
fi

# Test nginx access
if curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Can access backend through nginx${NC}"
else
    echo -e "${RED}❌ Cannot access backend through nginx${NC}"
fi

echo ""
echo "=============================="
echo -e "${GREEN}Setup Complete!${NC}"
echo ""
echo "Run diagnostic: ./check-vps-access.sh"
echo ""
echo "Your app should be accessible at:"
VPS_IP=$(hostname -I | awk '{print $1}')
echo "  http://$VPS_IP:8090"
echo "  http://srv512766.hstgr.cloud:8090"
echo ""

