const { CallLog, Contact } = require('../associations');

const getCalls = async (req, res) => {
  try {
    const calls = await CallLog.findAll({
      include: [
        {
          model: Contact,
          as: 'contact',
          attributes: [
            'name',
            'phone',
            'message',
            'agent_notes',
            'product_name',
            'price',
            'address',
            'store',
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(calls);
  } catch (error) {
    console.error('Error getting calls:', error);
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
          as: 'contact',
          attributes: [
            'name',
            'phone',
            'message',
            'agent_notes',
            'product_name',
            'price',
            'address',
            'store',
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(callLogs);
  } catch (error) {
    console.error('Error getting call logs by contact:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update remark for a call log
const setCallLogRemark = async (req, res) => {
  try {
    const { remark } = req.body;
    const callLogId = req.params.id;

    // Validate remark value
    if (
      remark !== null &&
      remark !== '' &&
      remark !== 'accept' &&
      remark !== 'reject'
    ) {
      return res
        .status(400)
        .json({ error: 'remark must be "accept", "reject", or empty string' });
    }

    const callLog = await CallLog.findByPk(callLogId);
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    await callLog.update({ remark: remark || null });

    res.json({ success: true, remark: callLog.remark });
  } catch (error) {
    console.error('Error setting call log remark:', error);
    res.status(500).json({ error: 'Failed to set remark' });
  }
};

const deleteCallLog = async (req, res) => {
  try {
    const { callLogId } = req.params;

    // Find the call log first
    const callLog = await CallLog.findByPk(callLogId);
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    // Delete the call log
    await CallLog.destroy({
      where: { id: callLogId },
    });

    res.json({
      success: true,
      message: 'Call log deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting call log:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCalls,
  createCall,
  getCallLogsByContact,
  deleteCallLog,
  setCallLogRemark,
};
