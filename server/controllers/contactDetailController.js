const Contact = require('../models/Contact');
const CallLog = require('../models/CallLog');
const Settings = require('../models/Settings');
const { sequelize } = require('../config/database');
const axios = require('axios');
const xml2js = require('xml2js');

// Get detailed contact information with call logs
const getContactDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get all call logs for this contact
    const callLogs = await CallLog.findAll({
      where: { contact_id: id },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      contact,
      callLogs,
    });
  } catch (error) {
    console.error('Error fetching contact details:', error);
    res.status(500).json({ error: 'Failed to fetch contact details' });
  }
};

// Save agent notes for a contact
const saveContactNote = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes || notes.trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Notes cannot be empty' });
    }

    const contact = await Contact.findByPk(id, { transaction });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Update agent notes
    await contact.update({ agent_notes: notes.trim() }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Notes saved successfully',
      contact: {
        id: contact.id,
        agent_notes: contact.agent_notes,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error saving contact notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
};

// Retry a failed call
const retryContactCall = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id, { transaction });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Check if contact is in a retryable state
    if (contact.status === 'In Progress') {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Contact is already in progress. Cannot retry at this time.',
      });
    }

    // Get Exotel settings
    const settings = await Settings.findOne({ transaction });
    if (
      !settings ||
      !settings.exotel_sid ||
      !settings.api_key ||
      !settings.api_token ||
      !settings.agent_number ||
      !settings.caller_id
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Exotel API credentials not configured. Please check settings.',
      });
    }

    // Reset contact status for retry
    await contact.update(
      {
        status: 'Not Called',
        exotel_call_sid: null,
        attempts: 0,
        last_attempt: null,
      },
      { transaction },
    );

    // Make Exotel API call
    try {
      const exotelApiUrl = `https://${settings.exotel_sid}:${settings.api_token}@api.exotel.com/v1/Accounts/${settings.exotel_sid}/Calls/connect`;

      const exotelResponse = await axios.post(
        exotelApiUrl,
        new URLSearchParams({
          From: contact.phone,
          To: settings.agent_number,
          CallerId: settings.caller_id,
          Url: process.env.FLOW_URL,
          StatusCallback: `${
            process.env.SERVER_URL || 'http://localhost:8006'
          }/api/webhook/exotel`,
          StatusCallbackEvents: ['terminal'],
          StatusCallbackContentType: 'application/json',
          TimeLimit: 300,
          TimeOut: 30,
          Record: true,
          RecordingChannels: 'dual',
          CustomField: `contact_id:${contact.id}`,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        },
      );

      // Parse XML response
      const parser = new xml2js.Parser();
      const parsedResponse = await parser.parseStringPromise(
        exotelResponse.data,
      );

      // Extract CallSid from parsed XML response
      const exotelCallSid = parsedResponse?.TwilioResponse?.Call?.[0]?.Sid?.[0];
      if (!exotelCallSid) {
        throw new Error('No CallSid received from Exotel API');
      }

      // Update contact with new call details
      await contact.update(
        {
          status: 'In Progress',
          exotel_call_sid: exotelCallSid,
          last_attempt: new Date(),
        },
        { transaction },
      );

      // Create call log entry
      await CallLog.create(
        {
          contact_id: contact.id,
          attempt_no: 1,
          status: 'In Progress',
          user_id: req.user?.id || null, // Store which user made the call
        },
        { transaction },
      );

      await transaction.commit();

      res.json({
        success: true,
        message: 'Call retry initiated successfully',
        exotelCallSid,
        contact: {
          id: contact.id,
          status: contact.status,
          attempts: contact.attempts,
          exotel_call_sid: contact.exotel_call_sid,
        },
      });
    } catch (exotelError) {
      await transaction.rollback();
      console.error('Exotel API error during retry:', exotelError.message);

      // Update contact as failed
      await contact.update(
        {
          status: 'Failed',
          attempts: contact.attempts + 1,
          last_attempt: new Date(),
          agent_notes: `Retry failed: ${exotelError.message}`,
        },
        { transaction },
      );

      await CallLog.create(
        {
          contact_id: contact.id,
          attempt_no: contact.attempts + 1,
          status: 'Failed',
          user_id: req.user?.id || null, // Store which user made the call
        },
        { transaction },
      );

      res.status(500).json({
        error: 'Failed to initiate call retry',
        details: exotelError.message,
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error('Error retrying contact call:', error);
    res.status(500).json({ error: 'Failed to retry call' });
  }
};

// Mark contact as resolved
const markContactResolved = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { notes } = req.body;

    const contact = await Contact.findByPk(id, { transaction });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Update contact status to completed
    const updateData = {
      status: 'Completed',
      last_attempt: new Date(),
    };

    // Add notes if provided
    if (notes && notes.trim() !== '') {
      updateData.agent_notes = notes.trim();
    }

    await contact.update(updateData, { transaction });

    // Create final call log entry
    await CallLog.create(
      {
        contact_id: contact.id,
        attempt_no: contact.attempts + 1,
        status: 'Completed',
        user_id: req.user?.id || null, // Store which user made the call
      },
      { transaction },
    );

    await transaction.commit();

    res.json({
      success: true,
      message: 'Contact marked as resolved',
      contact: {
        id: contact.id,
        status: contact.status,
        agent_notes: contact.agent_notes,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error marking contact as resolved:', error);
    res.status(500).json({ error: 'Failed to mark contact as resolved' });
  }
};

module.exports = {
  getContactDetails,
  saveContactNote,
  retryContactCall,
  markContactResolved,
};
