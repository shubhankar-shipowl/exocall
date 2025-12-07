const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/**
 * Fix missing call durations for completed calls by fetching from Exotel API
 */
async function fixMissingDurations() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'call_db',
    });

    console.log('✅ Connected to database:', process.env.DB_NAME);
    console.log('📋 Fixing missing durations for completed calls\n');

    // Find all completed calls with missing duration
    const [callLogs] = await connection.execute(
      `SELECT cl.id, cl.contact_id, cl.exotel_call_sid, cl.status, cl.duration, cl.recording_url, cl.user_id 
       FROM call_logs cl
       WHERE cl.status = 'Completed'
       AND (cl.duration IS NULL OR cl.duration = 0)
       AND cl.exotel_call_sid IS NOT NULL
       AND cl.exotel_call_sid != ''
       ORDER BY cl.createdAt DESC
       LIMIT 50`
    );

    console.log(`📋 Found ${callLogs.length} completed calls with missing duration`);

    if (callLogs.length === 0) {
      console.log('✅ No calls need duration fix');
      return;
    }

    // Get Exotel settings
    const [settingsRows] = await connection.execute(
      `SELECT exotel_sid, api_key, api_token, user_id 
       FROM settings 
       ORDER BY createdAt DESC 
       LIMIT 1`
    );

    if (settingsRows.length === 0) {
      console.error('❌ No Exotel settings found in database');
      return;
    }

    const settings = settingsRows[0];
    const exotelSid = settings.exotel_sid || process.env.EXOTEL_SID;
    const apiKey = settings.api_key || process.env.EXOTEL_API_KEY || process.env.EXOTEL_KEY;
    const apiToken = settings.api_token || process.env.EXOTEL_API_TOKEN || process.env.EXOTEL_TOKEN;

    if (!exotelSid || !apiKey || !apiToken) {
      console.error('❌ Missing Exotel credentials');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const callLog of callLogs) {
      try {
        console.log(`\n🔄 Processing call log ${callLog.id} (CallSid: ${callLog.exotel_call_sid})`);

        const exotelApiUrl = `https://${apiKey}:${apiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/${callLog.exotel_call_sid}.json`;

        const apiResponse = await axios.get(exotelApiUrl, {
          timeout: 10000,
        });

        if (apiResponse.data && apiResponse.data.Call) {
          const callData = apiResponse.data.Call;
          // ONLY use ConversationDuration (actual talk time, matches Exotel dashboard)
          // Do NOT use Duration as it includes ringing time and won't match the dashboard
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

            // Update call log
            await connection.execute(
              `UPDATE call_logs SET duration = ?, updatedAt = NOW() WHERE id = ?`,
              [durationInSeconds, callLog.id]
            );

            // Update contact
            await connection.execute(
              `UPDATE contacts SET duration = ? WHERE exotel_call_sid = ?`,
              [durationInSeconds, callLog.exotel_call_sid]
            );

            console.log(`✅ Updated call log ${callLog.id} with duration: ${durationInSeconds} seconds (${Math.floor(durationInSeconds / 60)}:${(durationInSeconds % 60).toString().padStart(2, '0')})`);
            successCount++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.warn(`⚠️  Duration is 0 or missing for call log ${callLog.id}`);
            failCount++;
          }
        } else {
          console.warn(`⚠️  Unexpected API response format for call log ${callLog.id}`);
          failCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing call log ${callLog.id}:`, error.message);
        if (error.response) {
          console.error(`   API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        failCount++;
      }
    }

    console.log(`\n✅ Process completed!`);
    console.log(`   Successfully updated: ${successCount} calls`);
    console.log(`   Failed: ${failCount} calls`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  fixMissingDurations()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingDurations };

