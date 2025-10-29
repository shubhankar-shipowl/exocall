# ExoCall Support Dashboard

A modern full-stack web application for managing call campaigns and contacts using Exotel API.

## Tech Stack

- **Frontend**: React + TailwindCSS + ShadCN/UI
- **Backend**: Node.js + Express.js
- **Database**: MySQL (via Sequelize ORM)
- **Integration**: Exotel API

## Project Structure

```
exocall/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node.js backend
│   ├── routes/            # API routes
│   ├── controllers/       # Business logic
│   ├── models/           # Database models
│   ├── config/           # Database configuration
│   ├── package.json
│   └── index.js          # Server entry point
└── README.md
```

## Quick Start

### One-Command Setup

1. **Install all dependencies**:

   ```bash
   npm run install-all
   ```

2. **Create the database**:

   ```bash
   mysql -u root -e "CREATE DATABASE IF NOT EXISTS exocall;"
   ```

3. **Create environment file**:
   Create a `.env` file in the `server` directory with your database and Exotel credentials (see Backend Setup below).

4. **Initialize the database**:

   ```bash
   cd server && npm run init-db && cd ..
   ```

5. **Start both frontend and backend**:

   - **With PM2 (Recommended)**:

     ```bash
     ./start.sh
     # or
     npm run dev:pm2
     ```

   - **Without PM2 (Traditional)**:
     ```bash
     npm run dev
     ```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the server directory with the following variables:

   ```
   # Database Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=exocall
   DB_PORT=3306

   # Server Configuration
   PORT=8006
   NODE_ENV=development

   # Exotel API Configuration
   EXOTEL_SID=your_exotel_sid
   EXOTEL_API_KEY=your_exotel_api_key
   EXOTEL_API_TOKEN=your_exotel_api_token
   EXOTEL_AGENT_NUMBER=your_agent_number
   EXOTEL_CALLER_ID=your_caller_id
   ```

4. Initialize the database:

   ```bash
   npm run init-db
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the client directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Database Setup

1. Create a MySQL database named `exocall`
2. The application will automatically create the necessary tables when you start the server

## Running with PM2 and Reverse Proxy

This project now supports PM2 for process management and reverse proxy for unified entry point:

- **Auto-restart**: Automatically restarts crashed processes
- **Log management**: Centralized logs in `./logs/` directory
- **Resource monitoring**: Track CPU and memory usage
- **Hot reload**: Development mode with automatic reloading
- **Reverse Proxy**: Unified frontend and API from single port in production

### PM2 Commands

**Development:**

```bash
# Start services with PM2
npm run dev:pm2

# Stop services
npm run stop:pm2

# Restart services
npm run restart:pm2

# View status
npm run status:pm2

# View live logs
npm run logs:pm2

# Monitor resources
npm run monitor:pm2

# Delete all PM2 processes
npm run delete:pm2

# Interactive menu
./pm2-manager.sh
```

**Production:**

```bash
# Build and deploy
./deploy.sh

# Or manually:
npm run build:prod    # Build frontend
npm run start:prod    # Start production server

# Reload without downtime
npm run reload:pm2
```

### SSL / HTTPS (Optional)

- Recommended: Use nginx with Let's Encrypt to terminate TLS and proxy to the Node server
- Example config: see `nginx.conf` (includes HTTP→HTTPS redirect and strong TLS settings)
- For local testing without a domain:
  - Generate self-signed certs: `./ssl-selfsigned.sh`
  - Point nginx `ssl_certificate` and `ssl_certificate_key` to files in `ssl/`

### PM2 Configuration

**Development** (`ecosystem.config.js`):

- **exocall-server**: Backend API (port 8006)
- **exocall-client**: Frontend React app (port 3000)
- Vite proxy forwards `/api/*` to backend

**Production** (`ecosystem.config.prod.js`):

- **exocall-prod**: Single server serving both frontend and API (port 8006)
- **Cluster Mode**: 2 instances for load balancing
- Express serves built React app + handles API routes

Logs are automatically saved to:

- `./logs/server-error.log` - Server errors
- `./logs/server-out.log` - Server output
- `./logs/client-error.log` - Client errors (dev only)
- `./logs/client-out.log` - Client output (dev only)
- `./logs/prod-*.log` - Production logs

### Using the Startup Script

**Development:**

```bash
./start.sh
```

This will:

1. Check for required `.env` file
2. Create logs directory
3. Start both services with PM2 (separate ports)
4. Display useful management commands

**Production:**

```bash
./deploy.sh
```

This will:

1. Build the React frontend
2. Create logs directory
3. Start production server with reverse proxy (single port)
4. Display management commands

### Reverse Proxy Architecture

- **Development**: Frontend (port 3000) + Backend (port 8006)
  - Vite proxies `/api/*` to backend automatically
- **Production**: Single port (8006) serving both frontend and API
  - Express serves built React files as static assets
  - API routes handled by Express
  - No CORS issues, simpler deployment

For detailed reverse proxy documentation, see [REVERSE_PROXY_GUIDE.md](./REVERSE_PROXY_GUIDE.md).

## Features

- **Dashboard**: Overview of call statistics and recent activity
- **Upload Contacts**: CSV file upload for contact management
- **Call Logs**: View and manage call history
- **Settings**: Configure Exotel API and database settings

## Database Schema

### Contacts Table

- `id` (PK) - Auto-incrementing primary key
- `name` - Contact name
- `phone` - Phone number (unique)
- `message` - Message to be sent
- `schedule_time` - Scheduled call time
- `status` - ENUM: Not Called, In Progress, Completed, Failed
- `attempts` - Number of call attempts
- `exotel_call_sid` - Exotel call session ID
- `recording_url` - URL to call recording
- `duration` - Call duration in seconds
- `agent_notes` - Notes from agent
- `last_attempt` - Last attempt timestamp
- `created_at`, `updated_at` - Timestamps

### Call Logs Table

- `id` (PK) - Auto-incrementing primary key
- `contact_id` (FK) - Reference to contacts table
- `attempt_no` - Attempt number
- `status` - Call status
- `recording_url` - URL to call recording
- `duration` - Call duration in seconds
- `created_at` - Creation timestamp

### Settings Table

- `id` (PK) - Auto-incrementing primary key
- `exotel_sid` - Exotel SID
- `api_key` - Exotel API key
- `api_token` - Exotel API token
- `agent_number` - Agent phone number
- `caller_id` - Caller ID
- `created_at` - Creation timestamp

## API Endpoints

### Contacts

- `GET /api/contacts` - Get all contacts
- `POST /api/contacts` - Create a new contact
- `PUT /api/contacts/:id` - Update a contact
- `DELETE /api/contacts/:id` - Delete a contact

### Call Logs

- `GET /api/calls` - Get all call logs
- `POST /api/calls` - Create a new call log
- `GET /api/calls/contact/:contactId` - Get call logs for specific contact

### Settings

- `GET /api/settings` - Get application settings
- `PUT /api/settings` - Update application settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
