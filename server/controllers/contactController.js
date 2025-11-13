const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const axios = require('axios');
const xml2js = require('xml2js');

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json(contacts);
  } catch (error) {
    console.error('❌ [API /api/contacts] - Error fetching contacts:', error);
    res.status(500).json({
      error: 'Failed to fetch contacts',
      details: error.message,
      stack: error.stack,
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

      // Update most recent call log for this contact if any
      const lastLog = await CallLog.findOne({
        where: { contact_id: contact.id },
        order: [['createdAt', 'DESC']],
      });
      if (lastLog) {
        await lastLog.update({ status });
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

    // Validate required environment variables
    const requiredEnvVars = [
      'EXOTEL_KEY',
      'EXOTEL_TOKEN',
      'EXOTEL_SID',
      'AGENT_NUMBER',
      'CALLER_ID',
      'FLOW_URL',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );
    if (missingVars.length > 0) {
      return res.status(500).json({
        error: 'Missing required environment variables',
        missing: missingVars,
      });
    }

    // Prepare Exotel API call for call bridging
    // Use ExoML for proper agent-to-customer bridging
    const exotelUrl = `https://${process.env.EXOTEL_KEY}:${process.env.EXOTEL_TOKEN}@api.exotel.com/v1/Accounts/${process.env.EXOTEL_SID}/Calls/connect`;

    const exotelParams = {
      From: process.env.AGENT_NUMBER, // Agent's number (call agent first)
      To: contact.phone, // Customer's number (then call customer)
      CallerId: process.env.CALLER_ID,
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
};
