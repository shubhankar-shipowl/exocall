const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import database connection and models
const { sequelize, testConnection } = require("./config/database");
const Contact = require("./models/Contact");
const CallLog = require("./models/CallLog");
const Settings = require("./models/Settings");
const User = require("./models/User");

// Associations will be loaded when needed by the controllers

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
// Trust reverse proxy (nginx) so req.secure and X-Forwarded-* work
app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Disable caching for API routes
app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  next();
});

// Serve static files from React app in production
if (process.env.NODE_ENV === "production") {
  const path = require("path");
  app.use(express.static(path.join(__dirname, "../client/dist")));
}

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/contacts", require("./routes/contacts"));
app.use("/api/calls", require("./routes/calls"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/call", require("./routes/callManager"));
app.use("/api/webhook", require("./routes/webhook"));
app.use("/api/contact-detail", require("./routes/contactDetail"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/exotel", require("./routes/exotel"));
app.use("/api/users", require("./routes/users"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/alerts", require("./routes/alerts"));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`📥 REQUEST: ${req.method} ${req.path}`);
  next();
});

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "ExoCall Support Dashboard API" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: err.message,
    });
  }

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "Database Validation Error",
      details: err.errors.map((e) => e.message),
    });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(400).json({
      error: "Duplicate Entry",
      details: "A record with this information already exists",
    });
  }

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === "production") {
  const path = require("path");
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
} else {
  // 404 handler for development
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `Route ${req.originalUrl} not found`,
    });
  });
}

// Database initialization and server start
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Force refresh database connection and verify schema
    console.log("🔄 Verifying database schema...");
    const { sequelize } = require("./config/database");

    // Check if required columns exist
    const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts");
    const hasProductName = columns.some((c) => c.Field === "product_name");
    const hasPrice = columns.some((c) => c.Field === "price");
    const hasAddress = columns.some((c) => c.Field === "address");
    const hasStore = columns.some((c) => c.Field === "store");
    const hasAgentNotes = columns.some((c) => c.Field === "agent_notes");

    if (!hasProductName) {
      console.log("⚠️  Adding product_name column...");
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN product_name VARCHAR(255) NULL"
      );
      console.log("✅ Added product_name");
    }

    if (!hasPrice) {
      console.log("⚠️  Adding price column...");
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN price VARCHAR(100) NULL"
      );
      console.log("✅ Added price");
    }

    if (!hasAddress) {
      console.log("⚠️  Adding address column...");
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN address TEXT NULL"
      );
      console.log("✅ Added address");
    }

    if (!hasStore) {
      console.log("⚠️  Adding store column...");
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN store VARCHAR(255) NULL"
      );
      console.log("✅ Added store");
    }

    if (!hasAgentNotes) {
      console.log("⚠️  Adding agent_notes column...");
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN agent_notes TEXT NULL"
      );
      console.log("✅ Added agent_notes");
    }

    console.log("✅ Database schema verified");

    // Load models and associations
    require("./associations");
    console.log("✅ Database connection established.");
    console.log("⚠️  Schema sync disabled - manage schema manually");

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
