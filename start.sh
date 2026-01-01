#!/bin/bash

echo "🚀 Shipowl Connect - Production Setup & Start"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start after $((max_attempts * 2)) seconds"
    return 1
}

# Start of the script
print_step "Starting Shipowl Connect Setup..."

# Check if we're in the right directory
if [ ! -f "ecosystem.config.js" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check required tools
print_step "Checking required tools..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

if ! command_exists pm2; then
    print_warning "PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        print_error "Failed to install PM2. Please install it manually: npm install -g pm2"
        exit 1
    fi
    print_success "PM2 installed successfully!"
fi

print_success "All required tools are available!"

# Check if .env exists
if [ ! -f "server/.env" ]; then
    print_error "server/.env file not found!"
    print_warning "Please create it with your database and Exotel credentials."
    print_warning "See server/config.example.js for reference."
    exit 1
fi

# Create necessary directories
print_step "Creating necessary directories..."
mkdir -p logs temp server/uploads client/dist

# Set proper permissions
chmod 755 logs temp server/uploads client/dist

print_success "Directories created and permissions set!"

# Set NODE_ENV to development for hot reload
export NODE_ENV=development
print_status "Environment set: NODE_ENV=development (Hot reload enabled)"

# Install dependencies if needed
print_step "Checking dependencies..."

if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
    print_status "Installing dependencies..."
    
    if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
        npm install --loglevel=error
    fi
    
    if [ -d "server" ] && [ -f "server/package.json" ] && [ ! -d "server/node_modules" ]; then
        cd server
        npm install --loglevel=error
        cd ..
    fi
    
    if [ -d "client" ] && [ -f "client/package.json" ] && [ ! -d "client/node_modules" ]; then
        cd client
        npm install --loglevel=error
        cd ..
    fi
    
    print_success "Dependencies installed!"
else
    print_success "All dependencies are available!"
fi

# Stop any existing processes
print_step "Cleaning previous PM2 processes..."
pm2 delete exocall 2>/dev/null || echo "No previous exocall process to clean"
pm2 stop ecosystem.config.js 2>/dev/null || true
pm2 delete ecosystem.config.js 2>/dev/null || true
print_success "PM2 processes cleaned"

# Start the application with PM2
print_step "Starting Shipowl Connect with PM2..."
pm2 start ecosystem.config.js

if [ $? -ne 0 ]; then
    print_error "Failed to start application with PM2"
    exit 1
fi

print_success "Application started with PM2!"

# Wait for services to be ready
print_step "Waiting for services to be ready..."

# Wait for backend
if wait_for_service "http://localhost:8006/health" "Backend API"; then
    print_success "Backend is ready and responding!"
else
    print_warning "Backend may not be fully ready yet"
fi

# Wait for frontend
if wait_for_service "http://localhost:3000" "Frontend"; then
    print_success "Frontend is ready and responding!"
else
    print_warning "Frontend may not be fully ready yet"
fi

# Save PM2 configuration
print_step "Saving PM2 configuration..."
pm2 save
print_success "PM2 configuration saved!"

# Display final status
echo ""
echo "🎉 Shipowl Connect Setup Complete!"
echo "========================================"
echo ""

# Show PM2 status
print_status "Current PM2 Status:"
pm2 status

echo ""
print_success "🚀 Application URLs:"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:3000"
echo -e "  ${GREEN}Backend API:${NC} http://localhost:8006"
echo -e "  ${GREEN}Health Check:${NC} http://localhost:8006/health"
echo -e "  ${GREEN}HTTPS (via nginx):${NC} https://localhost:8456"
echo -e "  ${GREEN}HTTP (via nginx):${NC} http://localhost:8090"
echo -e "  ${GREEN}PM2 Process:${NC} exocall (combined backend + frontend)"
echo ""

print_status "📊 Quick Health Check:"
# Test backend API
if curl -s http://localhost:8006/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Backend API:${NC} Working"
else
    echo -e "  ${RED}❌ Backend API:${NC} Not responding"
fi

# Test frontend
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Frontend:${NC} Working"
else
    echo -e "  ${RED}❌ Frontend:${NC} Not responding"
fi

# Test HTTPS (nginx)
if curl -k -s https://localhost:8456 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ HTTPS (nginx):${NC} Working"
else
    echo -e "  ${YELLOW}⚠️  HTTPS (nginx):${NC} Not responding (nginx may not be running)"
fi

# Test HTTP (nginx)
if curl -s http://localhost:8090 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ HTTP (nginx):${NC} Working"
else
    echo -e "  ${YELLOW}⚠️  HTTP (nginx):${NC} Not responding (nginx may not be running)"
fi

echo ""
print_status "🔧 Useful Commands:"
echo "  pm2 status                  - Check application status"
echo "  pm2 logs                    - View all logs"
echo "  pm2 logs exocall            - View combined logs"
echo "  pm2 restart exocall         - Restart application"
echo "  pm2 stop exocall            - Stop application"
echo "  pm2 delete exocall          - Remove from PM2"
echo "  pm2 monit                   - Monitor in real-time"
echo ""

print_status "📁 Log Files:"
echo "  Combined logs: pm2 logs exocall"
echo "  All logs: pm2 logs"
echo ""

print_success "🎯 Your Shipowl Connect is now running in development mode!"
print_status "Access the application via:"
echo -e "  ${BLUE}• Frontend (direct):${NC} http://localhost:3000"
echo -e "  ${BLUE}• HTTPS (via nginx):${NC} https://localhost:8456"
echo -e "  ${BLUE}• HTTP (via nginx):${NC} http://localhost:8090"
echo ""
print_warning "Press Ctrl+C to exit (this won't stop PM2 processes)"
print_warning "To stop the services, run: pm2 stop exocall"
echo ""
