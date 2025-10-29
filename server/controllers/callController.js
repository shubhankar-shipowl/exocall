const { CallLog, Contact } = require("../associations");

const getCalls = async (req, res) => {
  try {
    const calls = await CallLog.findAll({
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: [
            "name",
            "phone",
            "message",
            "agent_notes",
            "product_name",
            "price",
            "address",
            "store",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(calls);
  } catch (error) {
    console.error("Error getting calls:", error);
    res.status(500).json({ error: error.message });
  }
};

const createCall = async (req, res) => {
  try {
    const call = await CallLog.create(req.body);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCallLogsByContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const callLogs = await CallLog.findAll({
      where: { contact_id: contactId },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: [
            "name",
            "phone",
            "message",
            "agent_notes",
            "product_name",
            "price",
            "address",
            "store",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(callLogs);
  } catch (error) {
    console.error("Error getting call logs by contact:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteCallLog = async (req, res) => {
  try {
    const { callLogId } = req.params;

    // Find the call log first
    const callLog = await CallLog.findByPk(callLogId);
    if (!callLog) {
      return res.status(404).json({ error: "Call log not found" });
    }

    // Delete the call log
    await CallLog.destroy({
      where: { id: callLogId },
    });

    res.json({
      success: true,
      message: "Call log deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting call log:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCalls,
  createCall,
  getCallLogsByContact,
  deleteCallLog,
};
