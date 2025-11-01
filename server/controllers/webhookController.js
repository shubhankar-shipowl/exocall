const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const { sequelize } = require('../config/database');

// Ensure fresh database connection for webhook
const getFreshConnection = async () => {
  try {
    await sequelize.authenticate();
    return sequelize;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

// Handle Exotel webhook for call status updates
const handleExotelWebhook = async (req, res) => {
  try {
    // Ensure fresh database connection
    await getFreshConnection();

    // Extract parameters according to Exotel StatusCallback documentation
    const {
      CallSid,
      Status,
      Duration,
      RecordingUrl,
      Outcome,
      EventType,
      DateCreated,
      DateUpdated,
      To,
      From,
      PhoneNumberSid,
      StartTime,
      EndTime,
      ConversationDuration,
      Direction,
      CustomField,
      Legs,
    } = req.body;

    // Validate required fields
    if (!CallSid || (!Status && !Outcome)) {
      return res.status(400).json({
        error:
          'Missing required fields: CallSid and Status/Outcome are required',
        received: { CallSid, Status, Duration, RecordingUrl, Outcome },
      });
    }

    // Simple contact lookup - try both methods
    let contact = await Contact.findOne({
      where: { exotel_call_sid: CallSid },
    });

    // If not found by CallSid, try to find by CustomField (contact_id)
    if (!contact && CustomField) {
      const contactIdMatch = CustomField.match(/contact_id:(\d+)/);
      if (contactIdMatch) {
        const contactId = contactIdMatch[1];

        // Try direct SQL query as fallback
        try {
          const { sequelize } = require('../config/database');
          const [results] = await sequelize.query(
            'SELECT * FROM contacts WHERE id = ?',
            { replacements: [contactId] },
          );

          if (results.length > 0) {
            // Create a mock contact object from raw data
            contact = {
              id: results[0].id,
              name: results[0].name,
              phone: results[0].phone,
              exotel_call_sid: results[0].exotel_call_sid,
              status: results[0].status,
              attempts: results[0].attempts,
              duration: results[0].duration,
              recording_url: results[0].recording_url,
              last_attempt: results[0].last_attempt,
              update: async function (data) {
                await sequelize.query(
                  'UPDATE contacts SET status = ?, duration = ?, recording_url = ?, last_attempt = ?, attempts = ? WHERE id = ?',
                  {
                    replacements: [
                      data.status,
                      data.duration,
                      data.recording_url,
                      data.last_attempt,
                      data.attempts,
                      this.id,
                    ],
                  },
                );
              },
            };
          }
        } catch (sqlError) {
          console.error('SQL query error:', sqlError.message);
        }
      }
    }

    if (!contact) {
      return res.status(404).json({
        error: 'Contact not found',
        callSid: CallSid,
        customField: CustomField,
      });
    }

    // Map Exotel status/outcome to our contact status
    let contactStatus;

    // Helper: try to infer "Switched Off"/"Unreachable" cases from free-text fields
    const rawTextFields = [
      req.body.StatusMessage,
      req.body.Message,
      req.body.Error,
      req.body.Reason,
      req.body.DialCallStatus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const looksSwitchedOff = () => {
      // If Exotel provides any hint text, use that first
      if (
        rawTextFields.includes('switch') ||
        rawTextFields.includes('unreachable') ||
        rawTextFields.includes('not reachable') ||
        rawTextFields.includes('power off') ||
        rawTextFields.includes('switched off')
      ) {
        return true;
      }

      // Otherwise use a conservative heuristic based on Legs/duration
      try {
        const legStatuses = Array.isArray(Legs) ? Legs : [];
        const leg2 = legStatuses[1];
        const durationIsZero = (ConversationDuration || Duration || 0) == 0;
        const outbound = (Direction || '').toString().startsWith('outbound');
        if (
          outbound &&
          durationIsZero &&
          leg2 &&
          typeof leg2.Status === 'string' &&
          leg2.Status.toLowerCase() === 'failed'
        ) {
          return true;
        }
      } catch (_) {}
      return false;
    };

    // Primary mapping - use Exotel's Status field as-is where possible,
    // but split "failed" into more descriptive buckets when we have signal.
    if (Status) {
      switch (Status.toLowerCase()) {
        case 'completed':
          contactStatus = 'Completed';
          break;
        case 'no-answer':
          contactStatus = 'No Answer';
          break;
        case 'busy':
          contactStatus = 'Busy';
          break;
        case 'failed':
          contactStatus = looksSwitchedOff() ? 'Switched Off' : 'Failed';
          break;
        case 'canceled':
        case 'cancelled':
          contactStatus = 'Cancelled';
          break;
        default:
          contactStatus = 'Failed';
      }
    } else if (Outcome) {
      // Fallback to Outcome field if Status not provided
      switch (Outcome.toLowerCase()) {
        case 'call was successful':
          contactStatus = 'Completed';
          break;
        case 'call failed':
          contactStatus = looksSwitchedOff() ? 'Switched Off' : 'Failed';
          break;
        case 'busy':
          contactStatus = 'Busy';
          break;
        case 'no answer':
          contactStatus = 'No Answer';
          break;
        case 'cancelled':
          contactStatus = 'Cancelled';
          break;
        default:
          contactStatus = 'Failed';
      }
    } else {
      contactStatus = 'Failed';
    }

    // Update contact record
    const updateData = {
      status: contactStatus,
      last_attempt: new Date(),
    };

    // Only increment attempts for final statuses (not "In Progress" or "Initiated")
    if (contactStatus !== 'In Progress' && contactStatus !== 'Initiated') {
      updateData.attempts = contact.attempts + 1;
    }

    // Add duration if provided (use ConversationDuration from StatusCallback or Duration)
    const durationField = ConversationDuration || Duration;
    if (durationField) {
      let durationInSeconds = 0;

      // Handle different duration formats
      if (typeof durationField === 'string' && durationField.includes(':')) {
        // Handle "HH:MM:SS" format from Exotel dashboard
        const timeParts = durationField.split(':');
        if (timeParts.length === 3) {
          const hours = parseInt(timeParts[0]) || 0;
          const minutes = parseInt(timeParts[1]) || 0;
          const seconds = parseInt(timeParts[2]) || 0;
          durationInSeconds = hours * 3600 + minutes * 60 + seconds;
        }
      } else if (!isNaN(parseInt(durationField))) {
        // Handle numeric duration (already in seconds)
        durationInSeconds = parseInt(durationField);
      }

      if (durationInSeconds > 0) {
        updateData.duration = durationInSeconds;
        // Duration parsed successfully
      }
    }

    // Add recording URL if provided
    if (RecordingUrl) {
      updateData.recording_url = RecordingUrl;
    }

    await contact.update(updateData);

    // Update contact's exotel_call_sid if not already set
    if (!contact.exotel_call_sid) {
      await contact.update({ exotel_call_sid: CallSid });
    }

    // Find the most recent call log for this contact to update it (using raw SQL)
    const [existingLogs] = await sequelize.query(
      `SELECT * FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid}' ORDER BY createdAt DESC LIMIT 1`,
    );
    const existingCallLog = existingLogs.length > 0 ? existingLogs[0] : null;

    if (existingCallLog) {
      // Update existing call log using raw SQL
      await sequelize.query(
        `UPDATE call_logs SET 
          status = '${contactStatus}', 
          duration = ${
            updateData.duration || existingCallLog.duration || 'NULL'
          }, 
          recording_url = ${
            updateData.recording_url ? `'${updateData.recording_url}'` : 'NULL'
          }, 
          updatedAt = '${new Date().toISOString()}' 
        WHERE id = ${existingCallLog.id}`,
      );
    } else {
      // Create new call log entry using raw SQL
      const attemptNo =
        contact.attempts +
        (contactStatus !== 'In Progress' && contactStatus !== 'Initiated'
          ? 1
          : 0);
      await sequelize.query(
        `INSERT INTO call_logs (contact_id, exotel_call_sid, attempt_no, status, duration, recording_url, createdAt, updatedAt) 
         VALUES (${
           contact.id
         }, '${CallSid}', ${attemptNo}, '${contactStatus}', ${
          updateData.duration || 'NULL'
        }, ${
          updateData.recording_url ? `'${updateData.recording_url}'` : 'NULL'
        }, '${new Date().toISOString()}', '${new Date().toISOString()}')`,
      );
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      callSid: CallSid,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        status: contactStatus,
        duration: updateData.duration || 0,
        recording_url: updateData.recording_url,
        attempts:
          contact.attempts +
          (contactStatus !== 'In Progress' && contactStatus !== 'Initiated'
            ? 1
            : 0),
      },
    });
  } catch (error) {
    console.error('❌ Error processing Exotel webhook:', error);

    res.status(500).json({
      error: 'Failed to process webhook',
      details: error.message,
    });
  }
};

// Health check endpoint for webhook
const webhookHealth = (req, res) => {
  res.json({
    success: true,
    message: 'Exotel webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  handleExotelWebhook,
  webhookHealth,
};
