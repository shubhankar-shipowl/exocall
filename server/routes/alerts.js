const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Get alerts summary
router.get("/summary", async (req, res) => {
  try {
    // For now, return empty alerts data
    // This can be expanded when alert functionality is needed
    const summary = {
      totalAlerts: 0,
      unreadAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get alerts summary error:", error);
    res.status(500).json({
      error: "Failed to get alerts summary",
      details: error.message,
    });
  }
});

// Get all alerts
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status } = req.query;

    // For now, return empty alerts data
    const alerts = [];
    const total = 0;

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({
      error: "Failed to get alerts",
      details: error.message,
    });
  }
});

module.exports = router;
