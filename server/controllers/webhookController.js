const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const { sequelize } = require('../config/database');

// Handle Exotel webhook for call status updates
const handleExotelWebhook = async (req, res) => {
  try {
    // Verify connection is alive (uses existing connection pool)
    await sequelize.authenticate();

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

        // Try direct SQL query as fallback (using singleton connection)
        try {
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
    // If there's a status_override, preserve it and keep status as override value
    // If no override, update status from webhook
    const updateData = {
      last_attempt: new Date(),
    };
    
    // Only update status if there's no manual override
    if (!contact.status_override) {
      updateData.status = contactStatus;
    }

    // Only increment attempts for final statuses (not "In Progress" or "Initiated")
    if (contactStatus !== 'In Progress' && contactStatus !== 'Initiated') {
      updateData.attempts = contact.attempts + 1;
    }

    // IMPORTANT: Always fetch exact duration from Exotel API for real-time accuracy
    // Only "Completed" status calls should have duration > 0
    // All other statuses (Failed, Busy, No Answer, etc.) should have duration = 0
    
    // Only "Completed" status calls should have duration > 0 (call actually connected)
    const isCompleted = contactStatus === 'Completed' || 
                        contactStatus === 'completed' ||
                        Status === 'completed' ||
                        Outcome === 'Call was successful' ||
                        Outcome === 'call was successful';
    
    // Force duration to 0 for all non-completed calls (not answered, failed, etc.)
    if (!isCompleted) {
      updateData.duration = 0;
      console.log(`✅ [Webhook] Setting duration to 0 for ${contactStatus} call (call was not answered/completed)`);
    }

    // Add recording URL if provided
    if (RecordingUrl) {
      updateData.recording_url = RecordingUrl;
    }
    
    // ALWAYS fetch duration from Exotel API for completed calls to get exact real-time data
    if (isCompleted) {
      try {
        console.log(`🔄 [Webhook] Fetching exact duration from Exotel API for completed call (CallSid: ${CallSid})...`);
        
        const Settings = require('../models/Settings');
        let settings = null;
        
        // Try to get user-specific settings from the call log
        const [callLogs] = await sequelize.query(
          `SELECT user_id FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid}' LIMIT 1`
        );
        
        if (callLogs.length > 0 && callLogs[0].user_id) {
          settings = await Settings.findOne({
            where: { user_id: callLogs[0].user_id },
            order: [['createdAt', 'DESC']],
          });
        }
        
        // Fallback to global settings or env
        if (!settings) {
          settings = await Settings.findOne({
            order: [['createdAt', 'DESC']],
          });
        }
        
        const exotelSid = settings?.exotel_sid || process.env.EXOTEL_SID;
        const apiKey = settings?.api_key || process.env.EXOTEL_API_KEY || process.env.EXOTEL_KEY;
        const apiToken = settings?.api_token || process.env.EXOTEL_API_TOKEN || process.env.EXOTEL_TOKEN;
        
        if (exotelSid && apiKey && apiToken) {
          // Fetch call details from Exotel API to get exact real-time duration
          const axios = require('axios');
          
          const exotelApiUrl = `https://${apiKey}:${apiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/${CallSid}.json`;
          
          console.log(`📡 [Webhook] Fetching exact call details from Exotel API...`);
          
          const apiResponse = await axios.get(exotelApiUrl, {
            timeout: 10000,
          });
          
          console.log(`📥 [Webhook] Exotel API response:`, JSON.stringify(apiResponse.data, null, 2));
          
          if (apiResponse.data && apiResponse.data.Call) {
            const callData = apiResponse.data.Call;
            
            // ONLY use ConversationDuration (actual talk time, matches Exotel dashboard exactly)
            // This is the exact duration shown in Exotel dashboard
            let fetchedDuration = callData.ConversationDuration || 0;
            
            // If ConversationDuration is not available, try to calculate from StartTime/EndTime
            if (!fetchedDuration && callData.StartTime && callData.EndTime) {
              try {
                const startTime = new Date(callData.StartTime);
                const endTime = new Date(callData.EndTime);
                if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                  const calculatedDuration = Math.floor((endTime - startTime) / 1000);
                  if (calculatedDuration > 0) {
                    fetchedDuration = calculatedDuration;
                    console.log(`   📊 Calculated duration from timestamps: ${fetchedDuration} seconds`);
                  }
                }
              } catch (timeError) {
                console.warn(`   ⚠️  Failed to calculate from timestamps: ${timeError.message}`);
              }
            }
            
            // Last resort: use Duration field (but log a warning as it's not accurate)
            if (!fetchedDuration) {
              const totalDuration = callData.Duration || callData.CallDuration || 0;
              if (totalDuration > 0) {
                console.warn(`   ⚠️  ConversationDuration not available, using Duration (${totalDuration}s) - this may not match Exotel dashboard`);
                fetchedDuration = totalDuration;
              }
            }
            
            if (fetchedDuration && parseInt(fetchedDuration) > 0) {
              const durationInSeconds = parseInt(fetchedDuration);
              updateData.duration = durationInSeconds;
              console.log(`✅ [Webhook] Fetched exact duration from Exotel API: ${durationInSeconds} seconds (matches Exotel dashboard)`);
            } else {
              // If no duration found, set to 0 (call might not have actually connected)
              updateData.duration = 0;
              console.warn(`⚠️ [Webhook] Exotel API returned duration as 0 or missing, setting to 0`);
            }
          } else {
            console.warn(`⚠️ [Webhook] Exotel API response format unexpected:`, apiResponse.data);
            updateData.duration = 0;
          }
        } else {
          console.warn(`⚠️ [Webhook] Missing Exotel credentials to fetch duration`);
          updateData.duration = 0;
        }
      } catch (fetchError) {
        console.error('❌ [Webhook] Failed to fetch duration from Exotel API:', fetchError.message);
        if (fetchError.response) {
          console.error('❌ [Webhook] Exotel API error response:', fetchError.response.status, fetchError.response.data);
        }
        // Set duration to 0 if API fetch fails
        updateData.duration = 0;
      }
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
      // Only "Completed" status calls should have duration > 0
      const isCompletedForLog = contactStatus === 'Completed' || contactStatus === 'completed';
      
      let finalDuration;
      if (isCompletedForLog) {
        // Always use the fetched duration from API (real-time exact data)
        // If duration was fetched from API, use it; otherwise keep existing if > 0
        if (updateData.duration !== undefined) {
          finalDuration = updateData.duration;
        } else if (existingCallLog.duration && existingCallLog.duration > 0) {
          finalDuration = existingCallLog.duration;
        } else {
          finalDuration = 'NULL';
        }
      } else {
        // All non-completed calls (not answered, failed, etc.) should have duration = 0
        finalDuration = 0;
      }
      
      await sequelize.query(
        `UPDATE call_logs SET 
          status = '${contactStatus}', 
          duration = ${finalDuration}, 
          recording_url = ${
            updateData.recording_url ? `'${updateData.recording_url}'` : 'NULL'
          }, 
          updatedAt = '${new Date().toISOString()}' 
        WHERE id = ${existingCallLog.id}`,
      );
      
      if (updateData.duration !== undefined) {
        console.log(`✅ [Webhook] Updated call log ${existingCallLog.id} with duration: ${updateData.duration} seconds (${isCompletedForLog ? 'Completed' : 'Not answered'})`);
      }
    } else {
      // Create new call log entry using raw SQL
      // Only "Completed" status calls should have duration > 0
      const isCompleted = contactStatus === 'Completed' || contactStatus === 'completed';
      
      // Set duration to 0 for all non-completed calls
      if (!isCompleted) {
        updateData.duration = 0;
      }
      
      // Try to find user_id from any existing call log for this contact/exotel_call_sid
      const [userLogs] = await sequelize.query(
        `SELECT user_id FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid}' AND user_id IS NOT NULL ORDER BY createdAt ASC LIMIT 1`
      );
      const userId = userLogs.length > 0 && userLogs[0].user_id ? userLogs[0].user_id : 'NULL';
      
      const attemptNo =
        contact.attempts +
        (contactStatus !== 'In Progress' && contactStatus !== 'Initiated'
          ? 1
          : 0);
      await sequelize.query(
        `INSERT INTO call_logs (contact_id, exotel_call_sid, attempt_no, status, duration, recording_url, user_id, createdAt, updatedAt) 
         VALUES (${
           contact.id
         }, '${CallSid}', ${attemptNo}, '${contactStatus}', ${
          updateData.duration !== undefined ? updateData.duration : 'NULL'
        }, ${
          updateData.recording_url ? `'${updateData.recording_url}'` : 'NULL'
        }, ${userId}, '${new Date().toISOString()}', '${new Date().toISOString()}')`,
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
