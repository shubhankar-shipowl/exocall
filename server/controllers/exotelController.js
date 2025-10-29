const Contact = require("../models/Contact");
const CallLog = require("../models/Call");

/**
 * Get call details by CallSid
 */
const getCallDetails = async (req, res) => {
  try {
    const { callSid } = req.params;

    const callLog = await CallLog.findOne({
      where: { exotel_call_sid: callSid },
      include: [
        {
          model: Contact,
          as: "contact",
        },
      ],
    });

    if (!callLog) {
      return res.status(404).json({ error: "Call not found" });
    }

    res.json({
      success: true,
      call: callLog,
    });
  } catch (error) {
    console.error("Error fetching call details:", error);
    res.status(500).json({
      error: "Failed to fetch call details",
      message: error.message,
    });
  }
};

module.exports = {
  getCallDetails,
};
