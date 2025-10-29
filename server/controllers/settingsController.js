const Settings = require("../models/Settings");

const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await Settings.create({
        exotel_sid: process.env.EXOTEL_SID || "",
        api_key: process.env.EXOTEL_API_KEY || "",
        api_token: process.env.EXOTEL_API_TOKEN || "",
        agent_number: process.env.EXOTEL_AGENT_NUMBER || "",
        caller_id: process.env.EXOTEL_CALLER_ID || "",
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      await settings.update(req.body);
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
