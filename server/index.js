const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection (singleton instance)
const { sequelize, testConnection, closeConnection } = require('./config/database');

// Models will be loaded after schema verification to ensure fresh definitions

const app = express();
const PORT = process.env.PORT || 8006;

// Middleware
// Trust reverse proxy (nginx) so req.secure and X-Forwarded-* work
app.set('trust proxy', 1);
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Disable caching for API routes
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/call', require('./routes/callManager'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/contact-detail', require('./routes/contactDetail'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/exotel', require('./routes/exotel'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/alerts', require('./routes/alerts'));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`📥 REQUEST: ${req.method} ${req.path}`);
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'ExoCall Support Dashboard API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Database Validation Error',
      details: err.errors.map((e) => e.message),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Duplicate Entry',
      details: 'A record with this information already exists',
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message,
  });
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
    });
  });
}

// Database initialization and server start
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Verify schema using the singleton connection
    console.log('🔄 Verifying database schema...');
    // Use the already imported sequelize instance (singleton)

    // Check if required columns exist
    const [columns] = await sequelize.query('SHOW COLUMNS FROM contacts');
    const hasProductName = columns.some((c) => c.Field === 'product_name');
    const hasPrice = columns.some((c) => c.Field === 'price');
    const hasAddress = columns.some((c) => c.Field === 'address');
    const hasState = columns.some((c) => c.Field === 'state');
    const hasStore = columns.some((c) => c.Field === 'store');
    const hasAgentNotes = columns.some((c) => c.Field === 'agent_notes');
    const hasRemark = columns.some((c) => c.Field === 'remark');
    const hasStatusOverride = columns.some((c) => c.Field === 'status_override');

    if (!hasProductName) {
      console.log('⚠️  Adding product_name column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN product_name VARCHAR(255) NULL',
      );
      console.log('✅ Added product_name');
    }

    if (!hasPrice) {
      console.log('⚠️  Adding price column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN price VARCHAR(100) NULL',
      );
      console.log('✅ Added price');
    }

    if (!hasAddress) {
      console.log('⚠️  Adding address column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN address TEXT NULL',
      );
      console.log('✅ Added address');
    }

    if (!hasState) {
      console.log('⚠️  Adding state column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN state VARCHAR(255) NULL AFTER address',
      );
      console.log('✅ Added state');
    }

    if (!hasStore) {
      console.log('⚠️  Adding store column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN store VARCHAR(255) NULL',
      );
      console.log('✅ Added store');
    }

    if (!hasAgentNotes) {
      console.log('⚠️  Adding agent_notes column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN agent_notes TEXT NULL',
      );
      console.log('✅ Added agent_notes');
    }

    if (!hasRemark) {
      console.log('⚠️  Adding remark column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN remark VARCHAR(50) NULL',
      );
      console.log('✅ Added remark');
    }

    if (!hasStatusOverride) {
      console.log('⚠️  Adding status_override column...');
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN status_override VARCHAR(50) NULL AFTER status',
      );
      console.log('✅ Added status_override');
    }

    // Verify call_logs table schema
    console.log('🔄 Verifying call_logs table schema...');
    const [callLogsColumns] = await sequelize.query(
      'SHOW COLUMNS FROM call_logs',
    );
    const hasCallLogRemark = callLogsColumns.some((c) => c.Field === 'remark');

    if (!hasCallLogRemark) {
      console.log('⚠️  Adding remark column to call_logs...');
      await sequelize.query(
        'ALTER TABLE call_logs ADD COLUMN remark VARCHAR(50) NULL',
      );
      console.log('✅ Added remark to call_logs');
    }

    console.log('✅ Database schema verified');

    // Check if user_id column exists in call_logs
    const [callLogColumns] = await sequelize.query('SHOW COLUMNS FROM call_logs');
    const hasUserId = callLogColumns.some((c) => c.Field === 'user_id');
    if (!hasUserId) {
      console.log('⚠️  Adding user_id column to call_logs...');
      await sequelize.query(
        `ALTER TABLE call_logs 
         ADD COLUMN user_id INT NULL,
         ADD INDEX idx_user_id (user_id),
         ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`,
      );
      console.log('✅ Added user_id to call_logs');
    }

    // Force clear module cache for models to ensure fresh model definitions
    const contactModelPath = require.resolve('./models/Contact');
    if (require.cache[contactModelPath]) {
      delete require.cache[contactModelPath];
      console.log('🔄 Cleared Contact model cache');
    }
    const callLogModelPath = require.resolve('./models/CallLog');
    if (require.cache[callLogModelPath]) {
      delete require.cache[callLogModelPath];
      console.log('🔄 Cleared CallLog model cache');
    }
    const callModelPath = require.resolve('./models/Call');
    if (require.cache[callModelPath]) {
      delete require.cache[callModelPath];
      console.log('🔄 Cleared Call model cache');
    }
    const associationsPath = require.resolve('./associations');
    if (require.cache[associationsPath]) {
      delete require.cache[associationsPath];
      console.log('🔄 Cleared associations cache');
    }

    // Load models and associations (fresh from disk)
    require('./associations');
    console.log('✅ Database connection established.');
    console.log('⚠️  Schema sync disabled - manage schema manually');

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      // Stop accepting new requests
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Close database connections
        await closeConnection();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    // Close database connections on startup failure
    await closeConnection().catch(console.error);
    process.exit(1);
  }
};

// Start the server
startServer();
