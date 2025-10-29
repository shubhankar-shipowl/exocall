#!/bin/bash

# Setup script for nginx configuration
# This script copies the nginx config to the servers directory and reloads nginx

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

NGINX_SERVERS_DIR="/opt/homebrew/etc/nginx/servers"
CONFIG_FILE="nginx.exocall.conf"
SOURCE_FILE="${CONFIG_FILE}"

echo "🔧 Setting up nginx configuration..."

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ nginx is not installed. Please install nginx first.${NC}"
    echo "   On macOS: brew install nginx"
    exit 1
fi

# Check if config file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo -e "${RED}❌ Config file $SOURCE_FILE not found in current directory${NC}"
    exit 1
fi

# Check if SSL certificates exist
if [ ! -f "ssl/selfsigned.crt" ] || [ ! -f "ssl/selfsigned.key" ]; then
    echo -e "${YELLOW}⚠️  SSL certificates not found. Generating...${NC}"
    ./ssl-selfsigned.sh
fi

# Create servers directory if it doesn't exist
if [ ! -d "$NGINX_SERVERS_DIR" ]; then
    echo -e "${YELLOW}⚠️  Creating nginx servers directory...${NC}"
    sudo mkdir -p "$NGINX_SERVERS_DIR"
fi

# Copy config file
echo "📋 Copying nginx config to $NGINX_SERVERS_DIR..."
sudo cp "$SOURCE_FILE" "$NGINX_SERVERS_DIR/exocall.conf"
sudo chown root:wheel "$NGINX_SERVERS_DIR/exocall.conf"

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
if sudo nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    exit 1
fi

# Reload nginx
echo "🔄 Reloading nginx..."
if sudo nginx -s reload; then
    echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to reload nginx. Trying to start nginx...${NC}"
    if ! pgrep nginx > /dev/null; then
        sudo nginx
        echo -e "${GREEN}✅ Nginx started${NC}"
    else
        echo -e "${RED}❌ Could not reload or start nginx${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🎉 Nginx setup complete!${NC}"
echo ""
echo "Your application should now be accessible at:"
echo "  - HTTPS: https://localhost:8456"
echo "  - HTTP:  http://localhost:8090"
echo ""
echo "Note: If you see a SSL certificate warning, click 'Advanced' and 'Proceed anyway'"
echo "      (this is expected for self-signed certificates)"
echo ""

