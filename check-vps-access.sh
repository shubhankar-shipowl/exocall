#!/bin/bash

# VPS Access Diagnostic Script
# This script checks if your VPS is properly configured for external access

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 VPS Access Diagnostic Check"
echo "=============================="
echo ""

# Check if backend is running
echo -e "${BLUE}1. Checking Backend (port 8006)...${NC}"
if curl -s http://localhost:8006/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Backend is running${NC}"
else
    echo -e "   ${RED}❌ Backend is NOT running${NC}"
    echo -e "   ${YELLOW}   Fix: Start backend with ./start.sh or pm2 start${NC}"
fi
echo ""

# Check if frontend is running
echo -e "${BLUE}2. Checking Frontend (port 3000)...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Frontend is running${NC}"
else
    echo -e "   ${RED}❌ Frontend is NOT running${NC}"
    echo -e "   ${YELLOW}   Fix: Start frontend or run ./start.sh${NC}"
fi
echo ""

# Check if nginx is running
echo -e "${BLUE}3. Checking Nginx...${NC}"
if pgrep nginx > /dev/null; then
    echo -e "   ${GREEN}✅ Nginx is running${NC}"
else
    echo -e "   ${RED}❌ Nginx is NOT running${NC}"
    echo -e "   ${YELLOW}   Fix: sudo nginx or sudo systemctl start nginx${NC}"
fi
echo ""

# Check nginx config
echo -e "${BLUE}4. Checking Nginx Configuration...${NC}"
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "   ${GREEN}✅ Nginx config is valid${NC}"
else
    echo -e "   ${RED}❌ Nginx config has errors${NC}"
    echo -e "   ${YELLOW}   Fix: Check nginx config and run: sudo nginx -t${NC}"
fi
echo ""

# Check if nginx listens on external interface
echo -e "${BLUE}5. Checking if Nginx accepts external connections...${NC}"
if grep -q "server_name.*_" /opt/homebrew/etc/nginx/servers/exocall.conf 2>/dev/null || \
   grep -q "server_name.*_" /etc/nginx/sites-available/exocall.conf 2>/dev/null || \
   grep -q "server_name.*_" /etc/nginx/sites-enabled/exocall.conf 2>/dev/null; then
    echo -e "   ${GREEN}✅ Nginx configured to accept external connections (server_name includes _)${NC}"
elif grep -q "server_name localhost" /opt/homebrew/etc/nginx/servers/exocall.conf 2>/dev/null || \
     grep -q "server_name localhost" /etc/nginx/sites-available/exocall.conf 2>/dev/null; then
    echo -e "   ${YELLOW}⚠️  Nginx only configured for localhost${NC}"
    echo -e "   ${YELLOW}   Fix: Add '_' or your domain to server_name in nginx config${NC}"
    echo -e "   ${YELLOW}   Example: server_name localhost _;${NC}"
else
    echo -e "   ${YELLOW}⚠️  Could not check nginx config location${NC}"
    echo -e "   ${YELLOW}   Manually verify server_name allows external access${NC}"
fi
echo ""

# Check if ports are listening
echo -e "${BLUE}6. Checking if ports are listening...${NC}"
if command -v lsof > /dev/null; then
    if lsof -i :8090 > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Port 8090 is listening${NC}"
    else
        echo -e "   ${RED}❌ Port 8090 is NOT listening${NC}"
        echo -e "   ${YELLOW}   Fix: Start nginx or check firewall${NC}"
    fi
    
    if lsof -i :8456 > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Port 8456 is listening${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Port 8456 is NOT listening (HTTPS - optional)${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  lsof not available, skipping port check${NC}"
fi
echo ""

# Check SERVER_URL env variable
echo -e "${BLUE}7. Checking SERVER_URL configuration...${NC}"
if [ -f "server/.env" ]; then
    if grep -q "SERVER_URL" server/.env; then
        SERVER_URL=$(grep "SERVER_URL" server/.env | cut -d '=' -f2 | tr -d ' ')
        echo -e "   ${GREEN}✅ SERVER_URL is set: ${SERVER_URL}${NC}"
        if [[ "$SERVER_URL" == *"localhost"* ]]; then
            echo -e "   ${YELLOW}⚠️  SERVER_URL contains localhost${NC}"
            echo -e "   ${YELLOW}   For VPS, set SERVER_URL to your public domain/IP${NC}"
            echo -e "   ${YELLOW}   Example: SERVER_URL=http://srv512766.hstgr.cloud:8090${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  SERVER_URL not found in server/.env${NC}"
        echo -e "   ${YELLOW}   Add: SERVER_URL=http://srv512766.hstgr.cloud:8090${NC}"
    fi
else
    echo -e "   ${RED}❌ server/.env file not found${NC}"
fi
echo ""

# Check through nginx
echo -e "${BLUE}8. Testing access through Nginx (localhost)...${NC}"
if curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Can access backend through nginx locally${NC}"
else
    echo -e "   ${RED}❌ Cannot access backend through nginx${NC}"
    echo -e "   ${YELLOW}   Check: nginx logs, backend status, nginx config${NC}"
fi
echo ""

# Summary
echo "=============================="
echo -e "${BLUE}Summary & Next Steps:${NC}"
echo ""
echo "To make your VPS accessible:"
echo "1. Ensure nginx config has: server_name _; (accepts any hostname)"
echo "2. Set SERVER_URL in server/.env to your VPS domain/IP"
echo "3. Open firewall ports 8090 (and 8456 for HTTPS)"
echo "4. Reload nginx: sudo nginx -s reload"
echo ""
echo "For detailed instructions, see: VPS_SETUP.md"
echo ""

