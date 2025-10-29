const express = require("express");
const router = express.Router();
const { getCallDetails } = require("../controllers/exotelController");

// Get call details by CallSid
router.get("/calls/:callSid", getCallDetails);

module.exports = router;
