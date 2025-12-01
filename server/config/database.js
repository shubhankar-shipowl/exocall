const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "call_db",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: console.log, // Enable logging for debugging
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
      evict: 1000, // Check for idle connections every second
    },
    // Force fresh connections - no caching
    define: {
      timestamps: true,
    },
    // Reset query timeouts
    dialectOptions: {
      connectTimeout: 60000,
      // Force MySQL to refresh table information
      flags: ['-FOUND_ROWS'],
    },
  }
);

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
};

module.exports = { sequelize, testConnection, Sequelize };
