const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
} = require("../controllers/settingsController");
const { authenticate, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// View settings - both admin and agent can view
router.get("/", getSettings);

// Update settings - both admin and agent can update (user-specific settings)
router.put("/", updateSettings);

module.exports = router;
