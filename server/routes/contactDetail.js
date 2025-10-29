const express = require("express");
const {
  getContactDetails,
  saveContactNote,
  retryContactCall,
  markContactResolved,
} = require("../controllers/contactDetailController");

const router = express.Router();

// Get detailed contact information with call logs
router.get("/:id", getContactDetails);

// Save agent notes for a contact
router.post("/:id/note", saveContactNote);

// Retry a failed call
router.post("/:id/retry", retryContactCall);

// Mark contact as resolved
router.post("/:id/resolve", markContactResolved);

module.exports = router;
