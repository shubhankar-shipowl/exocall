// Copy this file to .env in the server directory
// Database Configuration
DB_HOST = localhost;
DB_USER = root;
DB_PASSWORD = your_mysql_password;
DB_NAME = exocall;
DB_PORT = 3306;

// Server Configuration
PORT = 8006;
NODE_ENV = development;

// Server URL for webhooks (set to your VPS domain or ngrok URL)
// For localhost: SERVER_URL=http://localhost:8006
// For VPS: SERVER_URL=http://srv512766.hstgr.cloud:8090
// For ngrok: SERVER_URL=https://your-ngrok-url.ngrok-free.app
SERVER_URL = http://localhost:8006;

// Exotel API Configuration
EXOTEL_SID = your_exotel_sid;
EXOTEL_API_KEY = your_exotel_api_key;
EXOTEL_API_TOKEN = your_exotel_api_token;
EXOTEL_AGENT_NUMBER = your_agent_number;
EXOTEL_CALLER_ID = your_caller_id;
