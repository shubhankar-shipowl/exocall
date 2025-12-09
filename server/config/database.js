const { Sequelize } = require("sequelize");

// Singleton pattern: Ensure only one Sequelize instance exists
let sequelizeInstance = null;

const getSequelizeInstance = () => {
  // Return existing instance if already created
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  // Create new instance only if it doesn't exist
  sequelizeInstance = new Sequelize(
    process.env.DB_NAME || "call_db",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5, // Maximum number of connections in pool
        min: 0, // Minimum number of connections in pool
        acquire: 30000, // Maximum time (ms) to wait for a connection
        idle: 10000, // Maximum time (ms) a connection can be idle before being released
        evict: 1000, // Check for idle connections every second
      },
      define: {
        timestamps: true,
      },
      dialectOptions: {
        connectTimeout: 60000,
        flags: ['-FOUND_ROWS'],
      },
      // Prevent multiple connection attempts
      retry: {
        max: 3,
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/,
        ],
      },
    }
  );

  // Track connection lifecycle
  sequelizeInstance.connectionManager.on('connect', (connection) => {
    console.log('🔌 Database connection opened');
  });

  sequelizeInstance.connectionManager.on('disconnect', (connection) => {
    console.log('🔌 Database connection closed');
  });

  return sequelizeInstance;
};

// Get the singleton instance
const sequelize = getSequelizeInstance();

// Test the connection
const testConnection = async () => {
  try {
    // Use the existing connection pool, don't create new connection
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");
    console.log(`   Connected to: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'call_db'}`);
    console.log(`   Connection pool: max=${sequelize.config.pool.max}, min=${sequelize.config.pool.min}`);
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    throw error;
  }
};

// Graceful shutdown: Close all connections
const closeConnection = async () => {
  if (sequelizeInstance) {
    try {
      await sequelizeInstance.close();
      console.log("✅ Database connections closed gracefully");
      sequelizeInstance = null;
    } catch (error) {
      console.error("❌ Error closing database connections:", error);
    }
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = { 
  sequelize, 
  testConnection, 
  Sequelize,
  closeConnection,
  getSequelizeInstance // Export for testing/debugging
};
