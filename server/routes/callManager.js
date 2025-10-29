const express = require("express");
const {
  startCalls,
  getCallStats,
} = require("../controllers/callManagerController");

const router = express.Router();

// Start outbound calls
router.post("/start", startCalls);

// Get call statistics
router.get("/stats", getCallStats);

module.exports = router;
