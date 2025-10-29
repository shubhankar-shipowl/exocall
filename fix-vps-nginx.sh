#!/bin/bash

# Fix Nginx Configuration on VPS
# This script helps configure nginx properly on your VPS

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Fixing Nginx Configuration on VPS"
echo "===================================="
echo ""

# Detect nginx config location
NGINX_CONFIG=""
NGINX_DIR=""

# Check common locations
if [ -f "/etc/nginx/sites-enabled/exocall.conf" ]; then
    NGINX_CONFIG="/etc/nginx/sites-enabled/exocall.conf"
    NGINX_DIR="/etc/nginx/sites-enabled"
elif [ -f "/etc/nginx/sites-available/exocall.conf" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/exocall.conf"
    NGINX_DIR="/etc/nginx/sites-available"
elif [ -f "/etc/nginx/conf.d/exocall.conf" ]; then
    NGINX_CONFIG="/etc/nginx/conf.d/exocall.conf"
    NGINX_DIR="/etc/nginx/conf.d"
elif [ -f "/opt/homebrew/etc/nginx/servers/exocall.conf" ]; then
    NGINX_CONFIG="/opt/homebrew/etc/nginx/servers/exocall.conf"
    NGINX_DIR="/opt/homebrew/etc/nginx/servers"
else
    echo -e "${YELLOW}⚠️  Nginx config file not found. Will create it.${NC}"
    echo ""
    echo "Searching for nginx config directory..."
    
    # Try to find nginx config directory
    NGINX_DIR=""
    if [ -d "/etc/nginx/sites-available" ]; then
        NGINX_DIR="/etc/nginx/sites-available"
    elif [ -d "/etc/nginx/conf.d" ]; then
        NGINX_DIR="/etc/nginx/conf.d"
    elif [ -d "/usr/local/etc/nginx/servers" ]; then
        NGINX_DIR="/usr/local/etc/nginx/servers"
    elif [ -d "/opt/homebrew/etc/nginx/servers" ]; then
        NGINX_DIR="/opt/homebrew/etc/nginx/servers"
    else
        echo "Could not find nginx config directory. Please specify:"
        read -p "Nginx config directory: " NGINX_DIR
    fi
    
    if [ -n "$NGINX_DIR" ] && [ -d "$NGINX_DIR" ]; then
        NGINX_CONFIG="$NGINX_DIR/exocall.conf"
        echo -e "${BLUE}Will create config at: $NGINX_CONFIG${NC}"
        
        # Check if we have the source config file
        SOURCE_CONFIG=""
        if [ -f "nginx.exocall.vps.conf" ]; then
            SOURCE_CONFIG="nginx.exocall.vps.conf"
        elif [ -f "nginx.exocall.conf" ]; then
            SOURCE_CONFIG="nginx.exocall.conf"
        else
            echo -e "${RED}❌ Could not find source config file (nginx.exocall.vps.conf or nginx.exocall.conf)${NC}"
            exit 1
        fi
        
        echo "Copying $SOURCE_CONFIG to $NGINX_CONFIG..."
        sudo cp "$SOURCE_CONFIG" "$NGINX_CONFIG"
        
        # If using sites-available, also enable it
        if [[ "$NGINX_DIR" == *"sites-available"* ]]; then
            if [ -d "/etc/nginx/sites-enabled" ]; then
                echo "Enabling config in sites-enabled..."
                sudo ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/exocall.conf"
            fi
        fi
        
        echo -e "${GREEN}✅ Config file created${NC}"
    else
        echo -e "${RED}Invalid directory: $NGINX_DIR${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}Using nginx config: $NGINX_CONFIG${NC}"
echo ""

# Backup current config
echo "📋 Creating backup..."
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

# Check if config needs updating
NEEDS_UPDATE=false

# Check for server_name
if ! grep -q "server_name.*_" "$NGINX_CONFIG" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Config needs update: server_name doesn't allow external access${NC}"
    NEEDS_UPDATE=true
fi

# Check for IPv6 listen
if ! grep -q "listen \[::\]:8090" "$NGINX_CONFIG" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Config needs update: Missing IPv6 listen directive${NC}"
    NEEDS_UPDATE=true
fi

if [ "$NEEDS_UPDATE" = false ]; then
    echo -e "${GREEN}✅ Nginx config looks good!${NC}"
    echo ""
else
    echo ""
    echo "Would you like to update the config automatically? (y/n)"
    read -p "> " UPDATE_CHOICE
    
    if [ "$UPDATE_CHOICE" = "y" ] || [ "$UPDATE_CHOICE" = "Y" ]; then
        echo ""
        echo "Updating config..."
        
        # Update server_name to include _
        if grep -q "server_name localhost;" "$NGINX_CONFIG"; then
            sudo sed -i.bak 's/server_name localhost;/server_name localhost _;/g' "$NGINX_CONFIG"
            echo -e "${GREEN}✅ Updated server_name to accept external connections${NC}"
        fi
        
        # Add IPv6 listen if missing
        if ! grep -q "listen \[::\]:8090" "$NGINX_CONFIG"; then
            # Find the line with listen 8090 and add IPv6 listen after it
            sudo sed -i.bak '/listen 8090;/a\    listen [::]:8090;  # IPv6 support for VPS' "$NGINX_CONFIG"
            echo -e "${GREEN}✅ Added IPv6 listen directive${NC}"
        fi
        
        # Also update HTTPS section if it exists
        if grep -q "listen 8456 ssl" "$NGINX_CONFIG"; then
            if ! grep -q "listen \[::\]:8456" "$NGINX_CONFIG"; then
                sudo sed -i.bak '/listen 8456 ssl;/a\    listen [::]:8456 ssl;  # IPv6 support for VPS' "$NGINX_CONFIG"
                echo -e "${GREEN}✅ Added IPv6 listen for HTTPS${NC}"
            fi
        fi
        
        echo ""
        echo -e "${GREEN}✅ Config updated!${NC}"
    else
        echo "Skipping automatic update. Please update manually:"
        echo "1. Add '_' to server_name: server_name localhost _;"
        echo "2. Add IPv6 listen: listen [::]:8090;"
    fi
fi

echo ""
echo "🔍 Testing nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✅ Nginx config test passed${NC}"
    echo ""
    echo "🔄 Reloading nginx..."
    if sudo nginx -s reload 2>&1; then
        echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Reload failed, trying restart...${NC}"
        if sudo systemctl restart nginx 2>/dev/null || sudo service nginx restart 2>/dev/null; then
            echo -e "${GREEN}✅ Nginx restarted${NC}"
        else
            echo -e "${RED}❌ Failed to restart nginx${NC}"
            echo "Try manually: sudo systemctl restart nginx"
        fi
    fi
else
    echo -e "${RED}❌ Nginx config test failed${NC}"
    echo "Run: sudo nginx -t"
    exit 1
fi

echo ""
echo "⏳ Waiting 2 seconds and checking ports..."
sleep 2

# Check if ports are listening
if netstat -tuln 2>/dev/null | grep -q ":8090.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":8090.*LISTEN"; then
    echo -e "${GREEN}✅ Port 8090 is now listening${NC}"
else
    echo -e "${YELLOW}⚠️  Port 8090 not listening yet${NC}"
    echo "Check nginx status: sudo systemctl status nginx"
fi

if netstat -tuln 2>/dev/null | grep -q ":8456.*LISTEN" || ss -tuln 2>/dev/null | grep -q ":8456.*LISTEN"; then
    echo -e "${GREEN}✅ Port 8456 is now listening${NC}"
fi

echo ""
echo "📋 Testing access..."
if curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend accessible through nginx on port 8090${NC}"
else
    echo -e "${RED}❌ Cannot access backend through nginx${NC}"
    echo "Check:"
    echo "  - Backend running: curl http://localhost:8006/health"
    echo "  - Nginx error logs: sudo tail /var/log/nginx/error.log"
fi

echo ""
echo "=============================="
echo -e "${GREEN}Nginx setup complete!${NC}"
echo ""
echo "⚠️  IMPORTANT: Backend and Frontend services need to be started!"
echo ""
echo "Next steps:"
echo "1. Start backend and frontend:"
echo "   ./start.sh"
echo "   OR"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "2. Open firewall ports:"
echo "   sudo ufw allow 8090/tcp"
echo "   sudo ufw allow 8456/tcp"
echo "   sudo ufw reload"
echo ""
echo "3. Verify everything:"
echo "   ./check-vps-access.sh"
echo ""
echo "4. Test from external:"
echo "   curl http://$(hostname -I | awk '{print $1}'):8090/health"

