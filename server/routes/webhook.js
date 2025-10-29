const express = require("express");
const {
  handleExotelWebhook,
  webhookHealth,
} = require("../controllers/webhookController");

const router = express.Router();

// Middleware to log all webhook requests
router.use((req, res, next) => {
  console.log(`🔔 WEBHOOK ROUTE HIT: ${req.method} ${req.path}`);
  next();
});

// Exotel webhook endpoint for call status updates
router.post("/exotel", handleExotelWebhook);

// Health check endpoint
router.get("/health", webhookHealth);

// Test endpoint to manually update contact status (for testing)
router.post("/test-update", async (req, res) => {
  try {
    const { contactId, status, duration } = req.body;

    if (!contactId || !status) {
      return res.status(400).json({
        error: "Missing required fields: contactId and status are required",
      });
    }

    const Contact = require("../models/Contact");
    const contact = await Contact.findByPk(contactId);

    if (!contact) {
      return res.status(404).json({
        error: "Contact not found",
      });
    }

    await contact.update({
      status: status,
      duration: duration || null,
      last_attempt: new Date(),
    });

    res.json({
      success: true,
      message: "Contact status updated successfully",
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        status: status,
      },
    });
  } catch (error) {
    console.error("Error in test update:", error);
    res.status(500).json({
      error: "Failed to update contact status",
      details: error.message,
    });
  }
});

module.exports = router;
