const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const axios = require('axios');
const xml2js = require('xml2js');

const getContacts = async (req, res) => {
  try {
    const user = req.user;
    
    // Check if assigned_to column exists
    let hasAssignedToColumn = false;
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
      hasAssignedToColumn = columns.length > 0;
    } catch (err) {
      // If check fails, assume column doesn't exist
      hasAssignedToColumn = false;
    }

    const whereClause = {};

    // If user is an agent, only show contacts assigned to them
    // If column doesn't exist yet, agents see no contacts (empty list)
    // If user is admin, show all contacts
    if (user.role === 'agent') {
      if (hasAssignedToColumn) {
        whereClause.assigned_to = user.id;
      } else {
        // If column doesn't exist, return empty array for agents
        // This ensures agents don't see all contacts before assignment feature is set up
        return res.json([]);
      }
    }

    // Build attributes list, excluding assigned_to if column doesn't exist
    const attributes = [
      'id', 'name', 'phone', 'message', 'schedule_time', 'status', 
      'status_override', 'attempts', 'exotel_call_sid', 'recording_url', 
      'duration', 'agent_notes', 'product_name', 'price', 'address', 
      'state', 'store', 'last_attempt', 'remark', 
      'createdAt', 'updatedAt'
    ];
    
    if (hasAssignedToColumn) {
      attributes.push('assigned_to');
    }

    const contacts = await Contact.findAll({
      where: whereClause,
      attributes,
      order: [['createdAt', 'DESC']],
    });

    res.json(contacts);
  } catch (error) {
    console.error('❌ [API /api/contacts] - Error fetching contacts:', error);
    
    res.status(500).json({
      error: 'Failed to fetch contacts',
      details: error.message,
    });
  }
};

const createContact = async (req, res) => {
  try {
    const contact = await Contact.create(req.body);
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await contact.update(req.body);
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await contact.destroy();
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Manually override contact status and update latest call log
const setStatusOverride = async (req, res) => {
  try {
    const { status } = req.body;
    const contactId = req.params.id;

    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // If status is provided and not empty, set override
    // If status is empty string or null, clear override (set to null)
    if (status && typeof status === 'string' && status.trim() !== '') {
      // Set override and update status
      await contact.update({ 
        status_override: status,
        status: status 
      });

      // Find or create call log for this contact
      // This ensures overridden statuses appear in call logs even if no call was made
      const lastLog = await CallLog.findOne({
        where: { contact_id: contact.id },
        order: [['createdAt', 'DESC']],
      });
      
      if (lastLog) {
        // Update existing call log with new status
        await lastLog.update({ status });
      } else {
        // Create a new call log entry for the overridden status
        // This ensures it appears in call logs even if no actual call was made
        // Get the maximum attempt number for this contact to set the correct attempt_no
        const maxAttempt = await CallLog.max('attempt_no', {
          where: { contact_id: contact.id },
        });
        
        await CallLog.create({
          contact_id: contact.id,
          attempt_no: (maxAttempt || 0) + 1,
          status: status,
          duration: 0, // No duration since no actual call was made
          recording_url: null,
          user_id: req.user?.id || null, // Store which user made the manual override
        });
      }
    } else {
      // Clear override (set to null), but keep current status
      await contact.update({ status_override: null });
    }

    // Reload contact to get updated data
    await contact.reload();

    res.json({ success: true, contact });
  } catch (error) {
    console.error('Error setting status override:', error);
    res.status(500).json({ error: 'Failed to set status override' });
  }
};

const initiateCall = async (req, res) => {
  try {
    // Fetch contact by ID from MySQL
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Check if already "Completed" or "In Progress"
    if (contact.status === 'In Progress') {
      return res.status(400).json({
        error: 'Call already in progress for this contact',
      });
    }

    if (contact.status === 'Completed') {
      return res.status(400).json({
        error: 'Call already completed for this contact',
      });
    }

    // Get current user ID from request
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get Exotel settings from database for this specific user, with fallback to .env
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']],
    });

    // Helper function to get setting value with fallback
    const getSettingValue = (dbValue, envValue, altEnvValue = null) => {
      if (dbValue && typeof dbValue === 'string' && dbValue.trim().length > 0) {
        return dbValue.trim();
      }
      return envValue || altEnvValue || '';
    };

    // Get settings from database (user-specific), fallback to .env if not set
    const exotelSid = getSettingValue(settings?.exotel_sid, process.env.EXOTEL_SID);
    const apiKey = getSettingValue(settings?.api_key, process.env.EXOTEL_API_KEY, process.env.EXOTEL_KEY);
    const apiToken = getSettingValue(settings?.api_token, process.env.EXOTEL_API_TOKEN, process.env.EXOTEL_TOKEN);
    const agentNumber = getSettingValue(settings?.agent_number, process.env.EXOTEL_AGENT_NUMBER, process.env.AGENT_NUMBER);
    const callerId = getSettingValue(settings?.caller_id, process.env.EXOTEL_CALLER_ID, process.env.CALLER_ID);

    // Log which settings are being used
    console.log('📞 [Call Initiation] User-Specific Settings:', {
      userId: userId,
      userEmail: req.user?.email,
      hasUserSettings: !!settings,
      agentNumberFromDB: settings?.agent_number || '(empty)',
      agentNumberFromEnv: process.env.EXOTEL_AGENT_NUMBER || process.env.AGENT_NUMBER || '(not set)',
      finalAgentNumber: agentNumber || '(MISSING!)',
      usingDBValue: !!(settings?.agent_number && settings.agent_number.trim().length > 0),
      usingEnvValue: !agentNumber || agentNumber === (process.env.EXOTEL_AGENT_NUMBER || process.env.AGENT_NUMBER || '').trim(),
      exotelSid: exotelSid || '(MISSING!)',
      hasApiKey: !!apiKey,
      hasApiToken: !!apiToken,
      callerId: callerId || '(MISSING!)',
      contactPhone: contact.phone,
    });

    // Validate required settings
    if (!exotelSid || !apiKey || !apiToken || !agentNumber || !callerId) {
      console.error('❌ [Call Initiation] Missing configuration:', {
        userId,
        exotelSid: !!exotelSid,
        apiKey: !!apiKey,
        apiToken: !!apiToken,
        agentNumber: !!agentNumber,
        callerId: !!callerId,
      });
      return res.status(400).json({
        error:
          'Incomplete Exotel configuration. Please configure Agent Number in Settings or set EXOTEL_AGENT_NUMBER in .env file. Also check SID, API Key, API Token, and Caller ID.',
      });
    }

    // Clean and format phone numbers
    const cleanAgentNumber = agentNumber.trim().replace(/\s+/g, '');
    const cleanContactPhone = contact.phone.trim().replace(/\s+/g, '');
    const cleanCallerId = callerId.trim().replace(/\s+/g, '');

    // Format phone numbers for Exotel API (E.164 format)
    const formatPhoneForExotel = (phone) => {
      if (!phone) return phone;
      let cleaned = phone.replace(/\s+/g, '');
      if (cleaned.startsWith('+')) return cleaned;
      if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
      if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
      return cleaned;
    };

    const formattedAgentNumber = formatPhoneForExotel(cleanAgentNumber);
    const formattedContactPhone = formatPhoneForExotel(cleanContactPhone);
    
    // CallerId must be a phone number, not a name
    let formattedCallerId = cleanCallerId.replace(/\s+/g, '');
    const isPhoneNumber = /^[\d+]+$/.test(formattedCallerId);
    
    if (!isPhoneNumber) {
      console.warn('⚠️  [Call Initiation] CallerId is not a phone number, using agent number:', formattedCallerId);
      formattedCallerId = formattedAgentNumber;
    } else {
      formattedCallerId = formatPhoneForExotel(formattedCallerId);
    }

    // Validate formatted phone numbers
    if (!formattedAgentNumber || formattedAgentNumber.length < 12 || !formattedAgentNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent number format',
        message: 'Agent number must be in E.164 format with country code (e.g., +919504785931).',
      });
    }

    if (!formattedContactPhone || formattedContactPhone.length < 12 || !formattedContactPhone.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contact phone format',
        message: 'Contact phone number must be in E.164 format with country code.',
      });
    }

    // Prepare Exotel API call for call bridging
    const exotelUrl = `https://${apiKey}:${apiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/connect`;

    // Comprehensive logging of API call with all parameters
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📞 [CALL API REQUEST] Initiating Exotel API Call');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('👤 User Information:');
    console.log('   - User ID:', userId);
    console.log('   - User Email:', req.user?.email);
    console.log('   - User Role:', req.user?.role);
    console.log('');
    console.log('📋 Contact Details:');
    console.log('   - Contact ID:', contact.id);
    console.log('   - Contact Name:', contact.name);
    console.log('   - Contact Phone (raw):', contact.phone);
    console.log('   - Contact Phone (formatted):', formattedContactPhone);
    console.log('');
    console.log('⚙️  Exotel Configuration:');
    console.log('   - Exotel SID:', exotelSid);
    console.log('   - API Key:', apiKey ? '***' + apiKey.slice(-4) : '(missing)');
    console.log('   - API Token:', apiToken ? '***' + apiToken.slice(-4) : '(missing)');
    console.log('   - Exotel URL:', exotelUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    console.log('');
    console.log('📱 Phone Numbers:');
    console.log('   - Agent Number (raw from DB):', settings?.agent_number || '(not in DB)');
    console.log('   - Agent Number (raw from ENV):', process.env.EXOTEL_AGENT_NUMBER || process.env.AGENT_NUMBER || '(not in ENV)');
    console.log('   - Agent Number (final used):', agentNumber);
    console.log('   - Agent Number (formatted for API):', formattedAgentNumber);
    console.log('   - Caller ID (raw):', callerId);
    console.log('   - Caller ID (formatted):', formattedCallerId);
    console.log('');
    console.log('📤 API Request Parameters:');
    console.log('   - From:', formattedAgentNumber);
    console.log('   - To:', formattedContactPhone);
    console.log('   - CallerId:', formattedCallerId);
    console.log('═══════════════════════════════════════════════════════════');

    const exotelParams = {
      From: formattedAgentNumber, // Agent's number (call agent first) - user-specific
      To: formattedContactPhone, // Customer's number (then call customer)
      CallerId: formattedCallerId,
      StatusCallback: `${
        process.env.SERVER_URL || 'http://localhost:8006'
      }/api/webhook/exotel`,
      // StatusCallbackEvents removed - not a valid parameter for Exotel Connect API
      // Exotel will send callbacks automatically for terminal events
      StatusCallbackContentType: 'application/json',
      TimeLimit: '300', // String format
      TimeOut: '30', // String format
      Record: 'true', // String format
      RecordingChannels: 'dual',
      CustomField: `contact_id:${contact.id}`,
    };

    const exotelResponse = await axios.post(exotelUrl, exotelParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000, // 30 second timeout
    });

    // Check if response is successful
    if (exotelResponse.status !== 200) {
      console.error(
        'Exotel API returned non-200 status:',
        exotelResponse.status,
      );
      throw new Error(`Exotel API error: ${exotelResponse.status}`);
    }

    // Parse XML response
    const parser = new xml2js.Parser();
    const parsedResponse = await parser.parseStringPromise(exotelResponse.data);

    // Check if response contains an error
    if (parsedResponse?.TwilioResponse?.RestException) {
      const errorMessage =
        parsedResponse.TwilioResponse.RestException[0].Message[0];
      console.error('Exotel API Error:', errorMessage);
      throw new Error(`Exotel API error: ${errorMessage}`);
    }

    // Extract CallSid from parsed XML response
    const callSid = parsedResponse?.TwilioResponse?.Call?.[0]?.Sid?.[0];
    if (!callSid) {
      console.error(
        'Parsed response structure:',
        JSON.stringify(parsedResponse, null, 2),
      );
      throw new Error('No CallSid received from Exotel API');
    }

    // Update contact with call details
    await contact.update({
      status: 'Initiated', // Set to Initiated when call is first made
      exotel_call_sid: callSid,
      last_attempt: new Date(),
    });

    // Insert into call_logs table
    await CallLog.create({
      contact_id: contact.id,
      exotel_call_sid: callSid,
      status: 'Initiated', // This will be updated by webhook
      attempt_no: (contact.attempts || 0) + 1,
      duration: 0,
      user_id: userId, // Store which user made the call
    });

    // Set a timeout to update status to "Failed" if no webhook comes within 2 minutes
    setTimeout(async () => {
      try {
        const currentContact = await Contact.findByPk(contact.id);
        if (
          currentContact &&
          (currentContact.status === 'Initiated' ||
            currentContact.status === 'In Progress')
        ) {
          await currentContact.update({
            status: 'Failed',
            last_attempt: new Date(),
            attempts: (currentContact.attempts || 0) + 1,
          });

          // Update call log
          await CallLog.update(
            { status: 'Failed', updatedAt: new Date() },
            {
              where: {
                contact_id: contact.id,
                exotel_call_sid: callSid,
              },
            },
          );
        }
      } catch (error) {
        console.error('Error in timeout handler:', error);
      }
    }, 120000); // 2 minutes timeout

    // Return success response
    res.status(200).json({
      success: true,
      message:
        'Call initiated successfully - Agent will be called first, then customer',
      sid: callSid,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        status: 'In Progress',
        attempts: contact.attempts,
        exotel_call_sid: callSid,
      },
    });
  } catch (error) {
    console.error('Error initiating Exotel call:', error);

    // Handle specific Exotel API errors
    if (error.response) {
      console.error('Exotel API Error:', error.response.data);

      const statusCode = error.response.status;
      let errorMessage = 'Failed to initiate call via Exotel';
      let userFriendlyMessage = 'Unable to make the call at this time.';

      // Handle specific error cases
      if (statusCode === 403) {
        // Check for specific error types
        const responseData = error.response.data;
        if (
          typeof responseData === 'string' &&
          responseData.includes('Insufficient balance')
        ) {
          errorMessage = 'Insufficient Exotel account balance';
          userFriendlyMessage =
            'Your Exotel account has insufficient balance to make calls. Please recharge your account to continue.';
        } else if (
          typeof responseData === 'string' &&
          responseData.includes('KYC compliant')
        ) {
          errorMessage = 'Account KYC verification required';
          userFriendlyMessage =
            'Your Exotel account needs KYC verification before making outbound calls. Please contact your administrator.';
        } else {
          errorMessage = 'Access denied by Exotel';
          userFriendlyMessage =
            'Access denied. Please check your Exotel account permissions.';
        }
      } else if (statusCode === 401) {
        errorMessage = 'Exotel authentication failed';
        userFriendlyMessage =
          'Invalid Exotel credentials. Please contact your administrator.';
      } else if (statusCode === 400) {
        errorMessage = 'Invalid request to Exotel';
        userFriendlyMessage = 'Invalid call parameters. Please try again.';
      } else if (statusCode >= 500) {
        errorMessage = 'Exotel service unavailable';
        userFriendlyMessage =
          'Exotel service is temporarily unavailable. Please try again later.';
      }

      // Return 200 with error details instead of 400 to prevent frontend issues
      return res.status(200).json({
        success: false,
        error: errorMessage,
        message: userFriendlyMessage,
        details: error.response.data,
        statusCode: statusCode,
      });
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(200).json({
        success: false,
        error: 'Request timeout',
        message: 'Call initiation timed out. Please try again.',
      });
    }

    // Handle other errors
    res.status(200).json({
      success: false,
      error: 'Failed to initiate call',
      message: 'An unexpected error occurred. Please try again.',
      details: error.message,
    });
  }
};

// Add note to contact
const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || note.trim() === '') {
      return res.status(400).json({
        error: 'Note is required and cannot be empty',
      });
    }

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Append new note to existing notes with timestamp
    const timestamp = new Date().toLocaleString();
    const newNote = `[${timestamp}] ${note.trim()}`;

    const updatedNotes = contact.agent_notes
      ? `${contact.agent_notes}\n${newNote}`
      : newNote;

    // Persist update explicitly and verify
    await Contact.update({ agent_notes: updatedNotes }, { where: { id } });
    const refreshed = await Contact.findByPk(id, {
      attributes: ['id', 'name', 'phone', 'agent_notes'],
    });

    res.json({
      success: true,
      message: 'Note added successfully',
      contact: refreshed,
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      error: 'Failed to add note',
      message: error.message,
    });
  }
};

// Get a single contact by ID
const getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);

    if (!contact) {
      return res.status(404).json({
        error: 'Contact not found',
      });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      error: 'Failed to fetch contact',
      details: error.message,
    });
  }
};

// Update remark for a contact
const setRemark = async (req, res) => {
  try {
    const { remark } = req.body;
    const contactId = req.params.id;

    // Validate remark value
    if (
      remark !== null &&
      remark !== '' &&
      remark !== 'accept' &&
      remark !== 'reject' &&
      remark !== 'pending'
    ) {
      return res
        .status(400)
        .json({ error: 'remark must be "accept", "reject", "pending", or empty string' });
    }

    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await contact.update({ remark: remark || null });

    res.json({ success: true, contact });
  } catch (error) {
    console.error('Error setting remark:', error);
    res.status(500).json({ error: 'Failed to set remark' });
  }
};

// Assign contacts to agents (admin only)
const assignContacts = async (req, res) => {
  try {
    const { contactIds, agentId } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        error: 'contactIds must be a non-empty array',
      });
    }

    if (!agentId) {
      return res.status(400).json({
        error: 'agentId is required',
      });
    }

    // Verify agent exists and is an agent
    const User = require('../models/User');
    const agent = await User.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.role !== 'agent') {
      return res.status(400).json({ error: 'User is not an agent' });
    }

    // Check if assigned_to column exists
    let hasAssignedToColumn = false;
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
      hasAssignedToColumn = columns.length > 0;
    } catch (err) {
      hasAssignedToColumn = false;
    }

    // Admin can assign contacts even if already assigned to another agent (allow reassignment)
    // Update contacts using raw SQL (try directly, catch column errors)
    const placeholders = contactIds.map(() => '?').join(',');
    try {
      // Allow assignment even if already assigned to another agent (admin can reassign)
      const [result] = await sequelize.query(
        `UPDATE contacts SET assigned_to = ?, updatedAt = NOW() WHERE id IN (${placeholders})`,
        {
          replacements: [agentId, ...contactIds],
        }
      );

      // For MySQL UPDATE, result is a ResultSetHeader with affectedRows property
      const assignedCount = result?.affectedRows || 0;

      if (assignedCount === 0) {
        return res.status(400).json({
          error: 'No contacts were assigned. All selected contacts may already be assigned.',
        });
      }

      res.json({
        success: true,
        message: `Assigned ${assignedCount} contact(s) to agent`,
        assignedCount: assignedCount,
      });
    } catch (updateError) {
      // Check if error is about missing column
      const errorMessage = updateError.message || updateError.parent?.message || '';
      if (errorMessage.includes('assigned_to') && errorMessage.includes('Unknown column')) {
        // Try to add the column if it doesn't exist
        try {
          await sequelize.query(
            'ALTER TABLE contacts ADD COLUMN assigned_to INT NULL'
          );
          await sequelize.query(
            'ALTER TABLE contacts ADD CONSTRAINT fk_contacts_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL'
          );

          // Retry the update - allow assignment even if already assigned to another agent
          const [result] = await sequelize.query(
            `UPDATE contacts SET assigned_to = ?, updatedAt = NOW() WHERE id IN (${placeholders})`,
            {
              replacements: [agentId, ...contactIds],
            }
          );
          const assignedCount = result?.affectedRows || 0;
          
          if (assignedCount === 0) {
            return res.status(400).json({
              error: 'No contacts were assigned. All selected contacts may already be assigned.',
            });
          }

          return res.json({
            success: true,
            message: `Assigned ${assignedCount} contact(s) to agent`,
            assignedCount: assignedCount,
          });
        } catch (alterError) {
          // If column already exists, just retry the update
          if (alterError.message && alterError.message.includes('Duplicate column name')) {
            // Allow assignment even if already assigned to another agent (admin can reassign)
            const [result] = await sequelize.query(
              `UPDATE contacts SET assigned_to = ?, updatedAt = NOW() WHERE id IN (${placeholders})`,
              {
                replacements: [agentId, ...contactIds],
              }
            );
            const assignedCount = result?.affectedRows || 0;
            
            if (assignedCount === 0) {
              return res.status(400).json({
                error: 'No contacts were assigned. All selected contacts may already be assigned.',
              });
            }

            return res.json({
              success: true,
              message: `Assigned ${assignedCount} contact(s) to agent`,
              assignedCount: assignedCount,
            });
          }
          throw alterError;
        }
      }
      throw updateError; // Re-throw if it's a different error
    }

  } catch (error) {
    console.error('Error assigning contacts:', error);
    // If we get here, it means the update failed for a reason other than missing column
    // (which is already handled above)
    res.status(500).json({ error: 'Failed to assign contacts' });
  }
};

// Unassign contacts (admin only)
const unassignContacts = async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        error: 'contactIds must be a non-empty array',
      });
    }

    // Update contacts using raw SQL to remove assignment (column check via try-catch)
    const placeholders = contactIds.map(() => '?').join(',');
    try {
      const [result] = await sequelize.query(
        `UPDATE contacts SET assigned_to = NULL, updatedAt = NOW() WHERE id IN (${placeholders})`,
        {
          replacements: contactIds,
        }
      );

      // For MySQL UPDATE, result is an array: [ResultSetHeader, undefined]
      // ResultSetHeader has affectedRows property
      const unassignedCount = result?.affectedRows || contactIds.length;

      res.json({
        success: true,
        message: `Unassigned ${unassignedCount} contact(s)`,
        unassignedCount: unassignedCount,
      });
    } catch (updateError) {
      // Check if error is about missing column
      if (updateError.message && updateError.message.includes('assigned_to')) {
        return res.status(500).json({ 
          error: 'Assignment feature is not available. Please run the migration to add the assigned_to column.' 
        });
      }
      throw updateError; // Re-throw if it's a different error
    }
  } catch (error) {
    console.error('Error unassigning contacts:', error);
    res.status(500).json({ error: 'Failed to unassign contacts' });
  }
};

// Get contacts by store and product for assignment (admin only)
const getContactsForAssignment = async (req, res) => {
  try {
    const { store, product_name, date } = req.query;

    // Use raw query to avoid Sequelize schema cache issues
    let query = 'SELECT id, name, phone, store, product_name, status, createdAt';
    // Check if assigned_to column exists and include it
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
      if (columns.length > 0) {
        query += ', assigned_to';
      }
    } catch (err) {
      // If check fails, continue without assigned_to
    }
    
    query += ' FROM contacts WHERE 1=1';
    const replacements = {};
    
    if (store) {
      query += ' AND store = :store';
      replacements.store = store;
    }
    
    if (product_name) {
      query += ' AND product_name = :product_name';
      replacements.product_name = product_name;
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query += ' AND createdAt BETWEEN :startDate AND :endDate';
      replacements.startDate = startDate;
      replacements.endDate = endDate;
    }
    
    query += ' ORDER BY createdAt DESC';
    
    const [contacts] = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts for assignment:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

// Get assigned contacts grouped by agent (admin only)
const getAssignedContactsByAgent = async (req, res) => {
  try {
    // Check if assigned_to column exists
    let hasAssignedToColumn = false;
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
      hasAssignedToColumn = columns.length > 0;
    } catch (err) {
      hasAssignedToColumn = false;
    }

    if (!hasAssignedToColumn) {
      return res.json({
        success: true,
        assignments: [],
        unassignedCount: 0,
      });
    }

    // Get all contacts with assigned_to
    const contacts = await Contact.findAll({
      attributes: ['id', 'name', 'phone', 'store', 'product_name', 'status', 'assigned_to', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    // Get all agents
    const User = require('../models/User');
    const agents = await User.findAll({
      where: { role: 'agent' },
      attributes: ['id', 'username', 'email'],
    });

    // Group contacts by agent
    const assignments = agents.map(agent => {
      const assignedContacts = contacts.filter(c => c.assigned_to === agent.id);
      return {
        agent: {
          id: agent.id,
          username: agent.username,
          email: agent.email,
        },
        contacts: assignedContacts,
        count: assignedContacts.length,
      };
    });

    // Get unassigned contacts
    const unassignedContacts = contacts.filter(c => !c.assigned_to || c.assigned_to === null);

    res.json({
      success: true,
      assignments,
      unassignedCount: unassignedContacts.length,
      unassignedContacts: unassignedContacts.slice(0, 100), // Limit to first 100 for performance
    });
  } catch (error) {
    console.error('Error getting assigned contacts by agent:', error);
    res.status(500).json({
      error: 'Failed to get assigned contacts',
      details: error.message,
    });
  }
};

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  initiateCall,
  addNote,
  setStatusOverride,
  setRemark,
  assignContacts,
  unassignContacts,
  getContactsForAssignment,
  getAssignedContactsByAgent,
};
