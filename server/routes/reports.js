const express = require("express");
const {
  getCallStatistics,
  exportCallsToExcel,
  getCallLogs,
  getDashboardSummary,
  getDailyTrends,
  getHourlyTrends,
  proxyRecording,
} = require("../controllers/reportsController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Proxy recording URL to bypass Exotel authentication (no auth required for audio streaming)
router.get("/proxy-recording", proxyRecording);

// All other routes require authentication
router.use(authenticate);

// Get call statistics
router.get("/statistics", getCallStatistics);

// Export calls to Excel/CSV
router.get("/export", exportCallsToExcel);

// Get detailed call logs with pagination
router.get("/logs", getCallLogs);

// Get dashboard summary
router.get("/summary", getDashboardSummary);

// Get daily trends for charts
router.get("/daily-trends", getDailyTrends);

// Get hourly trends for charts
router.get("/hourly-trends", getHourlyTrends);

module.exports = router;
