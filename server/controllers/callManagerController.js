const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const Settings = require('../models/Settings');
const { sequelize, Sequelize } = require('../config/database');
const axios = require('axios');
const xml2js = require('xml2js');

// Start outbound calls for contacts with status "Not Called"
const startCalls = async (req, res) => {
  try {
    // Get Exotel settings
    const settings = await Settings.findOne({
      order: [['createdAt', 'DESC']],
    });

    if (!settings) {
      return res.status(400).json({
        error:
          'Exotel settings not configured. Please configure settings first.',
      });
    }

    // Validate required settings
    if (
      !settings.exotel_sid ||
      !settings.api_token ||
      !settings.agent_number ||
      !settings.caller_id
    ) {
      return res.status(400).json({
        error:
          'Incomplete Exotel configuration. Please check SID, API Token, Agent Number, and Caller ID.',
      });
    }

    // Get contacts with status "Not Called"
    const contacts = await Contact.findAll({
      where: {
        status: 'Not Called',
      },
      limit: 10, // Limit to 10 calls at a time for safety
    });

    if (contacts.length === 0) {
      return res.json({
        success: true,
        message: "No contacts with 'Not Called' status found.",
        callsStarted: 0,
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each contact
    for (const contact of contacts) {
      try {
        // Prepare Exotel API request
        const exotelUrl = `https://${settings.exotel_sid}:${settings.api_token}@api.exotel.com/v1/Accounts/${settings.exotel_sid}/Calls/connect`;

        const callData = {
          From: contact.phone,
          To: settings.agent_number,
          CallerId: settings.caller_id,
          Url: process.env.FLOW_URL,
          StatusCallback: `${
            process.env.SERVER_URL || 'http://localhost:8006'
          }/api/webhook/exotel`,
          StatusCallbackEvents: ['terminal'],
          StatusCallbackContentType: 'application/json',
          TimeLimit: 300, // 5 minutes max call duration
          TimeOut: 30, // 30 seconds ring timeout
          Record: true, // Record the call
          RecordingChannels: 'dual', // Separate channels for caller and callee
          CustomField: `contact_id:${contact.id}`,
        };

        console.log(
          `Starting call for contact: ${contact.name} (${contact.phone})`,
        );

        // Make API call to Exotel
        const response = await axios.post(exotelUrl, callData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // 10 second timeout
        });

        // Parse XML response
        const parser = new xml2js.Parser();
        const parsedResponse = await parser.parseStringPromise(response.data);

        // Extract CallSid from parsed XML response
        const callSid = parsedResponse?.TwilioResponse?.Call?.[0]?.Sid?.[0];

        if (callSid) {
          // Update contact status
          await contact.update({
            status: 'In Progress',
            exotel_call_sid: callSid,
            last_attempt: new Date(),
          });

          // Create call log entry
          await CallLog.create({
            contact_id: contact.id,
            attempt_no: contact.attempts + 1,
            status: 'Initiated',
            exotel_call_sid: callSid,
            user_id: req.user?.id || null, // Store which user made the call
          });

          results.push({
            contactId: contact.id,
            contactName: contact.name,
            phone: contact.phone,
            callSid: callSid,
            status: 'success',
          });

          successCount++;
          console.log(
            `✅ Call started successfully for ${contact.name}: ${callSid}`,
          );
        } else {
          throw new Error('Invalid response from Exotel API');
        }
      } catch (error) {
        console.error(
          `❌ Failed to start call for ${contact.name}:`,
          error.message,
        );

        // Update contact with error status
        await contact.update({
          status: 'Failed',
          last_attempt: new Date(),
          agent_notes: `${contact.agent_notes || ''}\nCall initiation failed: ${
            error.message
          }`,
        });

        // Create call log entry for failed attempt
        await CallLog.create({
          contact_id: contact.id,
          attempt_no: contact.attempts + 1,
          status: 'Failed',
          user_id: req.user?.id || null, // Store which user made the call
        });

        results.push({
          contactId: contact.id,
          contactName: contact.name,
          phone: contact.phone,
          status: 'error',
          error: error.message,
        });

        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Calling process completed. ${successCount} calls started, ${errorCount} failed.`,
      callsStarted: successCount,
      callsFailed: errorCount,
      results: results,
    });
  } catch (error) {
    console.error('Error in startCalls:', error);
    res.status(500).json({
      error: 'Failed to start calls',
      details: error.message,
    });
  }
};

// Get call statistics
const getCallStats = async (req, res) => {
  try {
    // Build contact where clause for agents (filter by assigned_to)
    let contactWhereClause = {};
    if (req.user && req.user.role === 'agent') {
      // Check if assigned_to column exists
      try {
        const { sequelize } = require('../config/database');
        const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
        if (columns.length > 0) {
          contactWhereClause.assigned_to = req.user.id;
          console.log(`🔒 [CallStats] Filtering contacts for agent ${req.user.id} by assigned_to`);
        } else {
          // If column doesn't exist, agents see no contacts
          contactWhereClause.id = { [Sequelize.Op.eq]: null }; // This will return 0 results
        }
      } catch (err) {
        // If check fails, agents see no contacts
        contactWhereClause.id = { [Sequelize.Op.eq]: null }; // This will return 0 results
      }
    }

    const stats = await Contact.findAll({
      where: contactWhereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    // Build call log where clause for agents
    let callLogWhereClause = {};
    if (req.user && req.user.role === 'agent') {
      callLogWhereClause.user_id = req.user.id;
    }

    const totalCalls = await CallLog.count({ where: callLogWhereClause });
    const todayCalls = await CallLog.count({
      where: {
        ...callLogWhereClause,
        createdAt: {
          [Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const totalContacts = stats.reduce(
      (sum, item) => sum + parseInt(item.count || 0),
      0
    );

    console.log(`📊 [CallStats] Response for ${req.user?.role || 'unknown'} user ${req.user?.id || 'N/A'}:`, {
      totalContacts,
      statusBreakdown: stats,
      totalCalls,
      todayCalls,
      filterApplied: req.user?.role === 'agent' ? `assigned_to = ${req.user.id}` : 'none (admin)',
    });

    res.json({
      statusBreakdown: stats,
      totalCalls,
      todayCalls,
    });
  } catch (error) {
    console.error('Error getting call stats:', error);
    res.status(500).json({
      error: 'Failed to get call statistics',
      details: error.message,
    });
  }
};

module.exports = {
  startCalls,
  getCallStats,
};
