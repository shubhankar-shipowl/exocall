const { sequelize } = require('../config/database');
const axios = require('axios');
const Settings = require('../models/Settings');

/**
 * Fetch duration from Exotel API for a specific call
 * @param {string} callSid - Exotel Call SID
 * @param {number} userId - Optional user ID for user-specific settings
 * @returns {Promise<number|null>} Duration in seconds or null if not available
 */
async function fetchDurationFromExotel(callSid, userId = null) {
  try {
    let settings = null;

    // Try to get user-specific settings
    if (userId) {
      settings = await Settings.findOne({
        where: { user_id: userId },
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

    if (!exotelSid || !apiKey || !apiToken) {
      console.warn(
        `⚠️ [DurationSync] Missing Exotel credentials to fetch duration for CallSid: ${callSid}`,
      );
      return null;
    }

    const exotelApiUrl = `https://${apiKey}:${apiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/${callSid}.json`;

    const apiResponse = await axios.get(exotelApiUrl, {
      timeout: 10000,
    });

    if (apiResponse.data && apiResponse.data.Call) {
      const callData = apiResponse.data.Call;

      // Priority 1: ConversationDuration (actual talk time, matches Exotel dashboard)
      let fetchedDuration = callData.ConversationDuration || 0;

      // If ConversationDuration is a string, parse it
      if (typeof fetchedDuration === 'string') {
        fetchedDuration = parseInt(fetchedDuration) || 0;
      }

      // Priority 2: Calculate from StartTime/EndTime if available
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
                `📊 [DurationSync] Calculated duration from timestamps: ${fetchedDuration} seconds`,
              );
            }
          }
        } catch (timeError) {
          console.warn(
            `⚠️ [DurationSync] Failed to calculate from timestamps: ${timeError.message}`,
          );
        }
      }

      // Priority 3: Use Duration field as last resort
      if (!fetchedDuration) {
        const totalDuration = callData.Duration || callData.CallDuration || 0;
        if (totalDuration > 0) {
          console.warn(
            `⚠️ [DurationSync] ConversationDuration not available, using Duration (${totalDuration}s)`,
          );
          fetchedDuration = totalDuration;
        }
      }

      if (fetchedDuration && parseInt(fetchedDuration) > 0) {
        return parseInt(fetchedDuration);
      }
    }

    return null;
  } catch (error) {
    console.error(
      `❌ [DurationSync] Failed to fetch duration from Exotel API for CallSid ${callSid}:`,
      error.message,
    );
    if (error.response) {
      console.error(
        `❌ [DurationSync] Exotel API error response:`,
        error.response.status,
        error.response.data,
      );
    }
    return null;
  }
}

/**
 * Update call log and contact with duration
 * @param {number} callLogId - Call log ID
 * @param {number} contactId - Contact ID
 * @param {string} callSid - Exotel Call SID
 * @param {number} duration - Duration in seconds
 */
async function updateCallDuration(callLogId, contactId, callSid, duration) {
  try {
    const mysqlDateTime = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Update call log
    await sequelize.query(
      `UPDATE call_logs SET duration = ${duration}, updatedAt = '${mysqlDateTime}' WHERE id = ${callLogId}`,
    );

    // Update contact
    await sequelize.query(
      `UPDATE contacts SET duration = ${duration}, updatedAt = '${mysqlDateTime}' WHERE id = ${contactId} AND exotel_call_sid = '${callSid.replace(
        /'/g,
        "''",
      )}'`,
    );

    console.log(
      `✅ [DurationSync] Updated call log ${callLogId} and contact ${contactId} with duration: ${duration} seconds`,
    );
    return true;
  } catch (error) {
    console.error(
      `❌ [DurationSync] Failed to update duration for call log ${callLogId}:`,
      error.message,
    );
    return false;
  }
}

/**
 * Sync missing durations for completed calls
 * This function finds all completed calls with missing or zero duration
 * and fetches the duration from Exotel API
 */
async function syncMissingDurations() {
  try {
    console.log('🔄 [DurationSync] Starting sync for missing durations...');

    // Find all completed calls with missing duration (limit to recent 100 to avoid overload)
    const [callLogs] = await sequelize.query(
      `SELECT cl.id, cl.contact_id, cl.exotel_call_sid, cl.status, cl.duration, cl.user_id 
       FROM call_logs cl
       WHERE cl.status = 'Completed'
       AND (cl.duration IS NULL OR cl.duration = 0)
       AND cl.exotel_call_sid IS NOT NULL
       AND cl.exotel_call_sid != ''
       AND cl.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY cl.createdAt DESC
       LIMIT 50`,
    );

    if (callLogs.length === 0) {
      console.log('✅ [DurationSync] No calls need duration sync');
      return { success: 0, failed: 0 };
    }

    console.log(
      `📋 [DurationSync] Found ${callLogs.length} completed calls with missing duration`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const callLog of callLogs) {
      try {
        const duration = await fetchDurationFromExotel(
          callLog.exotel_call_sid,
          callLog.user_id,
        );

        if (duration && duration > 0) {
          const updated = await updateCallDuration(
            callLog.id,
            callLog.contact_id,
            callLog.exotel_call_sid,
            duration,
          );

          if (updated) {
            successCount++;
          } else {
            failCount++;
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.warn(
            `⚠️ [DurationSync] Duration not available for call log ${callLog.id} (CallSid: ${callLog.exotel_call_sid})`,
          );
          failCount++;
        }
      } catch (error) {
        console.error(
          `❌ [DurationSync] Error processing call log ${callLog.id}:`,
          error.message,
        );
        failCount++;
      }
    }

    console.log(
      `✅ [DurationSync] Sync completed - Success: ${successCount}, Failed: ${failCount}`,
    );

    return { success: successCount, failed: failCount };
  } catch (error) {
    console.error('❌ [DurationSync] Error in syncMissingDurations:', error);
    return { success: 0, failed: 0 };
  }
}

/**
 * Retry fetching duration for a specific call after a delay
 * This is used when webhook receives a completed call but duration is not yet available
 * @param {string} callSid - Exotel Call SID
 * @param {number} contactId - Contact ID
 * @param {number} callLogId - Call log ID
 * @param {number} userId - Optional user ID
 * @param {number} delayMs - Delay in milliseconds before retry (default: 30 seconds)
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 */
async function retryFetchDuration(
  callSid,
  contactId,
  callLogId,
  userId = null,
  delayMs = 30000,
  maxRetries = 3,
) {
  for (let retryCount = 1; retryCount <= maxRetries; retryCount++) {
    // Wait before retry (except first iteration)
    if (retryCount > 1) {
      // Exponential backoff: 30s, 60s, 120s
      const waitTime = delayMs * Math.pow(2, retryCount - 2);
      console.log(
        `🔄 [DurationSync] Retry ${retryCount}/${maxRetries} for CallSid: ${callSid} (waiting ${waitTime}ms)`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } else {
      console.log(
        `🔄 [DurationSync] Retry ${retryCount}/${maxRetries} for CallSid: ${callSid} (waiting ${delayMs}ms)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const duration = await fetchDurationFromExotel(callSid, userId);

    if (duration && duration > 0) {
      await updateCallDuration(callLogId, contactId, callSid, duration);
      console.log(
        `✅ [DurationSync] Successfully fetched duration on retry ${retryCount}: ${duration} seconds`,
      );
      return true;
    } else {
      console.warn(
        `⚠️ [DurationSync] Retry ${retryCount}/${maxRetries} failed - duration not available yet`,
      );
    }
  }

  console.warn(
    `⚠️ [DurationSync] Max retries (${maxRetries}) reached for CallSid: ${callSid}. Duration still not available.`,
  );
  return false;
}

module.exports = {
  fetchDurationFromExotel,
  updateCallDuration,
  syncMissingDurations,
  retryFetchDuration,
};

