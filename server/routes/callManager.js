const express = require("express");
const {
  startCalls,
  getCallStats,
} = require("../controllers/callManagerController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Start outbound calls
router.post("/start", startCalls);

// Get call statistics
router.get("/stats", getCallStats);

module.exports = router;
