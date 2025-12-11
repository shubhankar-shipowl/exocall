const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const { sequelize } = require('../config/database');
const {
  fetchDurationFromExotel,
  retryFetchDuration,
} = require('../services/durationSyncService');

// Handle Exotel webhook for call status updates
const handleExotelWebhook = async (req, res) => {
  try {
    // Verify connection is alive (uses existing connection pool)
    await sequelize.authenticate();

    // Log full webhook payload for debugging
    console.log(
      '📥 [Webhook] Received Exotel webhook:',
      JSON.stringify(req.body, null, 2),
    );

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
            // Try to get the actual Sequelize model instance
            contact = await Contact.findByPk(results[0].id);
            if (!contact) {
              // Fallback: Create a plain object (will use raw SQL updates)
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
              };
            }
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

    console.log(
      `🔍 [Webhook] Status mapping - Status: "${Status}", Outcome: "${Outcome}"`,
    );

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

    console.log(
      `✅ [Webhook] Mapped status: "${
        Status || Outcome
      }" -> "${contactStatus}"`,
    );

    // Update contact record
    // IMPORTANT: Always update status from webhook to match Exotel dashboard
    // Only preserve override if it was manually set AND webhook status is not "Completed"
    const updateData = {
      last_attempt: new Date(),
      status: contactStatus, // Always update status from webhook to match Exotel
    };

    // Log if override exists but we're updating anyway
    if (contact.status_override && contactStatus === 'Completed') {
      console.log(
        `⚠️ [Webhook] Override exists but updating to Completed to match Exotel dashboard`,
      );
    }

    // Only increment attempts for final statuses (not "In Progress" or "Initiated")
    if (contactStatus !== 'In Progress' && contactStatus !== 'Initiated') {
      updateData.attempts = contact.attempts + 1;
    }

    // Check if call is completed
    const isCompleted =
      contactStatus === 'Completed' ||
      contactStatus === 'completed' ||
      Status === 'completed' ||
      Status === 'Completed' ||
      Outcome === 'Call was successful' ||
      Outcome === 'call was successful';

    // Add recording URL if provided
    if (RecordingUrl) {
      updateData.recording_url = RecordingUrl;
    }

    // FIRST: Try to get duration directly from webhook body (most reliable)
    // Exotel sends Duration or ConversationDuration in the webhook payload
    let webhookDuration = null;

    // Priority 1: ConversationDuration (actual talk time, matches Exotel dashboard)
    if (ConversationDuration !== undefined && ConversationDuration !== null) {
      webhookDuration = parseInt(ConversationDuration) || 0;
      console.log(
        `📥 [Webhook] Using ConversationDuration from webhook: ${webhookDuration} seconds`,
      );
    }
    // Priority 2: Duration field from webhook
    else if (Duration !== undefined && Duration !== null) {
      webhookDuration = parseInt(Duration) || 0;
      console.log(
        `📥 [Webhook] Using Duration from webhook: ${webhookDuration} seconds`,
      );
    }
    // Priority 3: Calculate from StartTime/EndTime if available
    else if (StartTime && EndTime) {
      try {
        const startTime = new Date(StartTime);
        const endTime = new Date(EndTime);
        if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
          webhookDuration = Math.floor((endTime - startTime) / 1000);
          if (webhookDuration > 0) {
            console.log(
              `📊 [Webhook] Calculated duration from webhook timestamps: ${webhookDuration} seconds`,
            );
          }
        }
      } catch (timeError) {
        console.warn(
          `⚠️ [Webhook] Failed to calculate duration from timestamps: ${timeError.message}`,
        );
      }
    }

    // Set duration based on completion status
    if (isCompleted) {
      // For completed calls, ALWAYS fetch from Exotel API to get exact duration
      // The webhook may not have ConversationDuration, so API is most reliable
      console.log(
        `🔄 [Webhook] Fetching exact duration from Exotel API for completed call (CallSid: ${CallSid})...`,
      );

      // Use webhook duration as fallback if API fails
      let fallbackDuration =
        webhookDuration !== null && webhookDuration > 0
          ? webhookDuration
          : null;
      if (fallbackDuration) {
        console.log(
          `📥 [Webhook] Webhook duration available as fallback: ${fallbackDuration} seconds`,
        );
      }

      try {
        const Settings = require('../models/Settings');
        let settings = null;

        // Try to get user-specific settings from the call log
        const [callLogs] = await sequelize.query(
          `SELECT user_id FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid}' LIMIT 1`,
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
        const apiKey =
          settings?.api_key ||
          process.env.EXOTEL_API_KEY ||
          process.env.EXOTEL_KEY;
        const apiToken =
          settings?.api_token ||
          process.env.EXOTEL_API_TOKEN ||
          process.env.EXOTEL_TOKEN;

        if (exotelSid && apiKey && apiToken) {
          // Fetch call details from Exotel API to get exact real-time duration
          const axios = require('axios');

          const exotelApiUrl = `https://${apiKey}:${apiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/${CallSid}.json`;

          console.log(
            `📡 [Webhook] Fetching exact call details from Exotel API...`,
          );

          const apiResponse = await axios.get(exotelApiUrl, {
            timeout: 10000,
          });

          console.log(
            `📥 [Webhook] Exotel API response:`,
            JSON.stringify(apiResponse.data, null, 2),
          );

          if (apiResponse.data && apiResponse.data.Call) {
            const callData = apiResponse.data.Call;

            // Log all duration-related fields for debugging
            console.log(`🔍 [Webhook] Exotel API call data duration fields:`, {
              ConversationDuration: callData.ConversationDuration,
              Duration: callData.Duration,
              CallDuration: callData.CallDuration,
              StartTime: callData.StartTime,
              EndTime: callData.EndTime,
            });

            // ONLY use ConversationDuration (actual talk time, matches Exotel dashboard exactly)
            // This is the exact duration shown in Exotel dashboard
            let fetchedDuration = callData.ConversationDuration || 0;

            // If ConversationDuration is a string, parse it
            if (typeof fetchedDuration === 'string') {
              fetchedDuration = parseInt(fetchedDuration) || 0;
            }

            // If ConversationDuration is not available, try to calculate from StartTime/EndTime
            if (!fetchedDuration && callData.StartTime && callData.EndTime) {
              try {
                const startTime = new Date(callData.StartTime);
                const endTime = new Date(callData.EndTime);
                if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                  const calculatedDuration = Math.floor(
                    (endTime - startTime) / 1000,
                  );
                  if (calculatedDuration > 0) {
                    fetchedDuration = calculatedDuration;
                    console.log(
                      `   📊 Calculated duration from timestamps: ${fetchedDuration} seconds`,
                    );
                  }
                }
              } catch (timeError) {
                console.warn(
                  `   ⚠️  Failed to calculate from timestamps: ${timeError.message}`,
                );
              }
            }

            // Last resort: use Duration field (but log a warning as it's not accurate)
            if (!fetchedDuration) {
              const totalDuration =
                callData.Duration || callData.CallDuration || 0;
              if (totalDuration > 0) {
                console.warn(
                  `   ⚠️  ConversationDuration not available, using Duration (${totalDuration}s) - this may not match Exotel dashboard`,
                );
                fetchedDuration = totalDuration;
              }
            }

            if (fetchedDuration && parseInt(fetchedDuration) > 0) {
              const durationInSeconds = parseInt(fetchedDuration);
              updateData.duration = durationInSeconds;
              console.log(
                `✅ [Webhook] Fetched duration from Exotel API: ${durationInSeconds} seconds`,
              );
            } else {
              // If API doesn't have duration, try webhook duration as fallback
              if (fallbackDuration !== null && fallbackDuration > 0) {
                updateData.duration = fallbackDuration;
                console.log(
                  `⚠️ [Webhook] Exotel API returned 0, using webhook duration: ${fallbackDuration} seconds`,
                );
              } else {
                // Don't set duration to 0 - leave it NULL so scheduled task can retry
                // Duration will be fetched by retry mechanism or scheduled sync
                console.warn(
                  `⚠️ [Webhook] Exotel API returned duration as 0 and no webhook duration. Will retry fetching duration asynchronously.`,
                );
                // Don't set updateData.duration - leave it undefined so it won't overwrite existing value
              }
            }
          } else {
            console.warn(
              `⚠️ [Webhook] Exotel API response format unexpected:`,
              apiResponse.data,
            );
            // Try fallback duration
            if (fallbackDuration !== null && fallbackDuration > 0) {
              updateData.duration = fallbackDuration;
              console.log(
                `⚠️ [Webhook] Using webhook duration as fallback: ${fallbackDuration} seconds`,
              );
            } else {
              // Don't set duration to 0 - leave it NULL so scheduled task can retry
              console.warn(
                `⚠️ [Webhook] Unexpected API response format and no webhook duration. Will retry fetching duration asynchronously.`,
              );
            }
          }
        } else {
          console.warn(
            `⚠️ [Webhook] Missing Exotel credentials to fetch duration`,
          );
          // Try fallback duration
          if (fallbackDuration !== null && fallbackDuration > 0) {
            updateData.duration = fallbackDuration;
            console.log(
              `⚠️ [Webhook] Using webhook duration as fallback: ${fallbackDuration} seconds`,
            );
          } else {
            // Don't set duration to 0 - leave it NULL so scheduled task can retry
            console.warn(
              `⚠️ [Webhook] Missing Exotel credentials and no webhook duration. Will retry fetching duration asynchronously.`,
            );
          }
        }
      } catch (fetchError) {
        console.error(
          '❌ [Webhook] Failed to fetch duration from Exotel API:',
          fetchError.message,
        );
        if (fetchError.response) {
          console.error(
            '❌ [Webhook] Exotel API error response:',
            fetchError.response.status,
            fetchError.response.data,
          );
        }
        // Use webhook duration as fallback if API fetch fails
        if (fallbackDuration !== null && fallbackDuration > 0) {
          updateData.duration = fallbackDuration;
          console.log(
            `⚠️ [Webhook] API fetch failed, using webhook duration: ${fallbackDuration} seconds`,
          );
        } else {
          // Don't set duration to 0 - schedule retry to fetch from API later
          console.warn(
            `⚠️ [Webhook] API fetch failed and no webhook duration. Will retry fetching duration asynchronously.`,
          );
          // Duration will be fetched by retry mechanism or scheduled sync
        }
      }
    } else {
      // For non-completed calls, duration should be 0
      updateData.duration = 0;
      console.log(
        `✅ [Webhook] Setting duration to 0 for ${contactStatus} call (not completed)`,
      );
    }

    // Update contact table - always use Sequelize for consistency
    const contactId = contact.id;

    // Reload contact as Sequelize model if it's a plain object
    if (typeof contact.update !== 'function') {
      contact = await Contact.findByPk(contactId);
      if (!contact) {
        console.error(
          `❌ [Webhook] Contact ${contactId} not found in database`,
        );
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    // Update contact using Sequelize (handles all fields correctly)
    await contact.update(updateData);
    console.log(
      `✅ [Webhook] Updated contact ${contactId}: status=${
        updateData.status
      }, duration=${updateData.duration}, recording=${
        updateData.recording_url ? 'yes' : 'no'
      }`,
    );

    // Reload contact to verify the update
    await contact.reload();
    console.log(
      `✅ [Webhook] Verified contact update - status: ${
        contact.status
      }, duration: ${contact.duration}, recording_url: ${
        contact.recording_url ? 'present' : 'none'
      }`,
    );

    // Update contact's exotel_call_sid if not already set
    if (!contact.exotel_call_sid) {
      await contact.update({ exotel_call_sid: CallSid });
    }

    // Find the most recent call log for this contact and CallSid to update it
    // IMPORTANT: Use exotel_call_sid to find the exact call log entry
    const [existingLogs] = await sequelize.query(
      `SELECT * FROM call_logs WHERE contact_id = ${contactId} AND exotel_call_sid = '${CallSid.replace(
        /'/g,
        "''",
      )}' ORDER BY createdAt DESC LIMIT 1`,
    );

    console.log(
      `🔍 [Webhook] Searching for call log: contact_id=${contactId}, exotel_call_sid=${CallSid}`,
    );
    console.log(
      `🔍 [Webhook] Found ${existingLogs.length} matching call log(s)`,
    );

    const existingCallLog = existingLogs.length > 0 ? existingLogs[0] : null;

    if (existingCallLog) {
      console.log(
        `📝 [Webhook] Found existing call log ${existingCallLog.id} with status="${existingCallLog.status}", duration=${existingCallLog.duration}`,
      );

      // Update existing call log - use the duration from updateData
      // If duration is missing for completed calls, keep existing value (don't overwrite with 0)
      const finalDuration =
        updateData.duration !== undefined
          ? updateData.duration
          : existingCallLog.duration || null;
      const statusValue = `'${contactStatus.replace(/'/g, "''")}'`;
      const recordingValue = updateData.recording_url
        ? `'${updateData.recording_url.replace(/'/g, "''")}'`
        : 'NULL';

      // Update ALL call logs with this CallSid (not just one) to ensure consistency
      // Format datetime for MySQL (YYYY-MM-DD HH:MM:SS)
      const mysqlDateTime = new Date()
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);
      
      // Build update query - only update duration if we have a valid value
      let updateQuery;
      if (finalDuration !== null && finalDuration !== undefined) {
        updateQuery = `UPDATE call_logs SET 
          status = ${statusValue}, 
          duration = ${finalDuration}, 
          recording_url = ${recordingValue}, 
          updatedAt = '${mysqlDateTime}' 
        WHERE contact_id = ${contactId} AND exotel_call_sid = '${CallSid.replace(
          /'/g,
          "''",
        )}'`;
      } else {
        // Don't update duration if it's null/undefined - keep existing value
        updateQuery = `UPDATE call_logs SET 
          status = ${statusValue}, 
          recording_url = ${recordingValue}, 
          updatedAt = '${mysqlDateTime}' 
        WHERE contact_id = ${contactId} AND exotel_call_sid = '${CallSid.replace(
          /'/g,
          "''",
        )}'`;
      }

      console.log(
        `🔄 [Webhook] Executing call_logs update for ALL matching entries:`,
        updateQuery,
      );

      const [updateResult] = await sequelize.query(updateQuery);
      console.log(
        `📊 [Webhook] Update result - affected rows:`,
        updateResult.affectedRows || 'unknown',
      );

      // Verify the update was successful by reloading from database
      const [verifyLogs] = await sequelize.query(
        `SELECT id, status, duration, recording_url, updatedAt FROM call_logs WHERE id = ${existingCallLog.id}`,
      );
      if (verifyLogs.length > 0) {
        const verified = verifyLogs[0];
        console.log(`✅ [Webhook] Verified call log ${verified.id} update:`, {
          status: verified.status,
          duration: verified.duration,
          recording_url: verified.recording_url ? 'present' : 'none',
          updatedAt: verified.updatedAt,
        });

        // Double-check the status matches what we set
        if (verified.status !== contactStatus) {
          console.error(
            `❌ [Webhook] STATUS MISMATCH! Expected "${contactStatus}" but got "${verified.status}"`,
          );
        } else {
          console.log(
            `✅ [Webhook] Status correctly updated to "${contactStatus}"`,
          );
        }
        } else {
          console.error(
            `❌ [Webhook] Could not verify call log update - call log ${existingCallLog.id} not found after update`,
          );
        }

        // If this is a completed call and duration is still missing, schedule retry
        if (
          isCompleted &&
          (!updateData.duration ||
            updateData.duration === 0 ||
            updateData.duration === null ||
            updateData.duration === undefined)
        ) {
          console.log(
            `🔄 [Webhook] Completed call with missing duration. Scheduling retry for CallSid: ${CallSid}`,
          );
          // Schedule async retry (don't await - let it run in background)
          retryFetchDuration(
            CallSid,
            contactId,
            existingCallLog.id,
            existingCallLog.user_id || null,
            30000, // 30 seconds delay
            3, // Max 3 retries
          ).catch((retryError) => {
            console.error(
              `❌ [Webhook] Retry failed for CallSid ${CallSid}:`,
              retryError.message,
            );
          });
        }
    } else {
      // Create new call log entry using raw SQL
      // For completed calls, don't set duration to 0 if it's missing - leave it NULL
      const finalDuration =
        updateData.duration !== undefined && updateData.duration !== null
          ? updateData.duration
          : null;

      // Try to find user_id from any existing call log for this contact/exotel_call_sid
      const [userLogs] = await sequelize.query(
        `SELECT user_id FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid}' AND user_id IS NOT NULL ORDER BY createdAt ASC LIMIT 1`,
      );
      const userId =
        userLogs.length > 0 && userLogs[0].user_id
          ? userLogs[0].user_id
          : 'NULL';

      const attemptNo =
        contact.attempts +
        (contactStatus !== 'In Progress' && contactStatus !== 'Initiated'
          ? 1
          : 0);

      const recordingUrlSafe = updateData.recording_url
        ? updateData.recording_url.replace(/'/g, "''")
        : null;

      // Format datetime for MySQL (YYYY-MM-DD HH:MM:SS)
      const mysqlDateTime = new Date()
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);
      
      const durationValue =
        finalDuration !== null && finalDuration !== undefined
          ? finalDuration
          : 'NULL';

      await sequelize.query(
        `INSERT INTO call_logs (contact_id, exotel_call_sid, attempt_no, status, duration, recording_url, user_id, createdAt, updatedAt) 
         VALUES (${
           contact.id
         }, '${CallSid}', ${attemptNo}, '${contactStatus}', ${durationValue}, ${
          recordingUrlSafe ? `'${recordingUrlSafe}'` : 'NULL'
        }, ${userId}, '${mysqlDateTime}', '${mysqlDateTime}')`,
      );

      // If this is a completed call and duration is missing, schedule retry
      if (
        isCompleted &&
        (!updateData.duration ||
          updateData.duration === 0 ||
          updateData.duration === null ||
          updateData.duration === undefined)
      ) {
        console.log(
          `🔄 [Webhook] Completed call with missing duration. Scheduling retry for CallSid: ${CallSid}`,
        );
        // Get the newly created call log ID
        const [newLogs] = await sequelize.query(
          `SELECT id FROM call_logs WHERE contact_id = ${contact.id} AND exotel_call_sid = '${CallSid.replace(
            /'/g,
            "''",
          )}' ORDER BY createdAt DESC LIMIT 1`,
        );
        if (newLogs.length > 0) {
          const newCallLogId = newLogs[0].id;
          // Schedule async retry (don't await - let it run in background)
          retryFetchDuration(
            CallSid,
            contact.id,
            newCallLogId,
            userId !== 'NULL' ? userId : null,
            30000, // 30 seconds delay
            3, // Max 3 retries
          ).catch((retryError) => {
            console.error(
              `❌ [Webhook] Retry failed for CallSid ${CallSid}:`,
              retryError.message,
            );
          });
        }
      }

      console.log(
        `✅ [Webhook] Created new call log: status=${contactStatus}, duration=${finalDuration} seconds`,
      );
    }

    // Reload contact to get latest data
    await contact.reload();

    // Get the updated call log
    const [updatedLogs] = await sequelize.query(
      `SELECT * FROM call_logs WHERE contact_id = ${
        contact.id
      } AND exotel_call_sid = '${CallSid.replace(
        /'/g,
        "''",
      )}' ORDER BY createdAt DESC LIMIT 1`,
    );
    const updatedCallLog = updatedLogs.length > 0 ? updatedLogs[0] : null;

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      callSid: CallSid,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        status: contact.status, // Use actual updated status from DB
        duration: contact.duration || 0, // Use actual updated duration from DB
        recording_url: contact.recording_url, // Use actual updated recording_url from DB
        attempts: contact.attempts,
      },
      callLog: updatedCallLog
        ? {
            id: updatedCallLog.id,
            status: updatedCallLog.status,
            duration: updatedCallLog.duration,
            recording_url: updatedCallLog.recording_url,
          }
        : null,
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
