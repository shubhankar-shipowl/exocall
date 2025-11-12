const { Contact, CallLog, User } = require('../associations');
const { sequelize, Sequelize } = require('../config/database');
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const axios = require('axios');

// Get call statistics for reports
const getCallStatistics = async (req, res) => {
  try {
    const { startDate, endDate, status, store, agentId } = req.query;

    // Build where clause for date range with proper timezone handling
    // Helper function to convert IST date string to UTC Date object
    // IST is UTC+5:30, so midnight IST = 18:30 UTC of previous day
    const istToUTC = (dateString, isEndOfDay = false) => {
      // Parse date string (format: YYYY-MM-DD)
      const [year, month, day] = dateString.split('-').map(Number);
      // Create UTC date for the specified IST time
      // For start of day: 00:00:00 IST = 18:30:00 UTC of previous day
      // For end of day: 23:59:59 IST = 18:29:59 UTC of same day
      if (isEndOfDay) {
        // End of day: 23:59:59.999 IST
        // IST is UTC+5:30, so 23:59:59.999 IST = 18:29:59.999 UTC on the same day
        // To ensure we capture all records, we'll use 23:59:59.999 of the day in UTC terms
        // which means: day at 18:29:59.999 UTC, but to be safe, use next day 05:29:59.999
        // Actually: 23:59:59.999 IST = 18:29:59.999 UTC same day
        return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
      } else {
        // Start of day: 00:00:00 IST = 18:30:00 UTC of previous day
        const date = new Date(Date.UTC(year, month - 1, day, 18, 30, 0, 0));
        // Subtract one day to get previous day
        date.setUTCDate(date.getUTCDate() - 1);
        return date;
      }
    };

    let whereClause = {};
    if (startDate && endDate) {
      const startUTC = istToUTC(startDate, false);
      const endUTC = istToUTC(endDate, true);
      whereClause.createdAt = {
        [Op.between]: [startUTC, endUTC],
      };
    } else if (startDate) {
      const startUTC = istToUTC(startDate, false);
      whereClause.createdAt = {
        [Op.gte]: startUTC,
      };
    } else if (endDate) {
      const endUTC = istToUTC(endDate, true);
      whereClause.createdAt = {
        [Op.lte]: endUTC,
      };
    }

    // Add status filter if provided
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Build include clause for store filtering
    const includeClause = store && store !== 'all' ? [
      {
        model: Contact,
        as: 'contact',
        attributes: [],
        where: { store: store },
        required: true,
      },
    ] : [];

    // Get total calls (with store filter if provided)
    const totalCalls = await CallLog.count({
      where: whereClause,
      include: includeClause,
      distinct: true,
    });

    // Get calls by status
    const callsByStatus = await CallLog.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('CallLog.id')), 'count'],
      ],
      where: whereClause,
      include: includeClause,
      group: ['CallLog.status'],
    });

    // Get success rate
    const completedCalls = await CallLog.count({
      where: {
        ...whereClause,
        status: 'Completed',
      },
      include: includeClause,
      distinct: true,
    });

    const successRate =
      totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

    // Get average duration
    const avgDurationResult = await CallLog.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('CallLog.duration')), 'avgDuration'],
      ],
      where: {
        ...whereClause,
        duration: { [Op.ne]: null },
      },
      include: includeClause,
    });

    const avgDuration = avgDurationResult?.dataValues?.avgDuration || 0;

    // Get calls by day (for charts)
    const callsByDay = await CallLog.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('CallLog.createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('CallLog.id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('CallLog.duration')), 'avgDuration'],
      ],
      where: whereClause,
      include: includeClause,
      group: [sequelize.fn('DATE', sequelize.col('CallLog.createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('CallLog.createdAt')), 'ASC']],
    });

    // Get top performing agents (if agentId filter is not applied)
    let topAgents = [];
    if (!agentId) {
      topAgents = await CallLog.findAll({
        attributes: [
          'contact_id',
          [sequelize.fn('COUNT', sequelize.col('CallLog.id')), 'totalCalls'],
          [
            sequelize.fn(
              'SUM',
              sequelize.literal(
                "CASE WHEN CallLog.status = 'Completed' THEN 1 ELSE 0 END",
              ),
            ),
            'successfulCalls',
          ],
        ],
        where: whereClause,
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['name', 'phone'],
            ...(store && store !== 'all' ? { where: { store: store }, required: true } : {}),
          },
        ],
        group: ['contact_id'],
        order: [[sequelize.literal('successfulCalls'), 'DESC']],
        limit: 10,
      });
    }

    res.json({
      success: true,
      statistics: {
        totalCalls,
        callsByStatus: callsByStatus.map((item) => ({
          status: item.status,
          count: parseInt(item.dataValues.count),
        })),
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round(avgDuration),
        callsByDay: callsByDay.map((item) => ({
          date: item.dataValues.date,
          count: parseInt(item.dataValues.count),
          avgDuration: Math.round(item.dataValues.avgDuration || 0),
        })),
        topAgents: topAgents.map((item) => ({
          contactName: item.Contact?.name || 'Unknown',
          contactPhone: item.Contact?.phone || 'Unknown',
          totalCalls: parseInt(item.dataValues.totalCalls),
          successfulCalls: parseInt(item.dataValues.successfulCalls),
          successRate:
            item.dataValues.totalCalls > 0
              ? Math.round(
                  (item.dataValues.successfulCalls /
                    item.dataValues.totalCalls) *
                    100 *
                    100,
                ) / 100
              : 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting call statistics:', error);
    res.status(500).json({
      error: 'Failed to get call statistics',
      details: error.message,
    });
  }
};

// Export calls to Excel
const exportCallsToExcel = async (req, res) => {
  try {
    const { startDate, endDate, status, store, format = 'xlsx' } = req.query;

    // Build where clause with proper date range handling
    let whereClause = {};
    if (startDate && endDate) {
      // Set startDate to beginning of day (00:00:00) in IST
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      // Convert to UTC for database comparison (IST is UTC+5:30)
      const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
      
      // Set endDate to end of day (23:59:59.999) in IST
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // Convert to UTC for database comparison
      const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
      
      whereClause.createdAt = {
        [Op.between]: [startUTC, endUTC],
      };
    } else if (startDate) {
      // Set startDate to beginning of day in IST
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
      whereClause.createdAt = {
        [Op.gte]: startUTC,
      };
    } else if (endDate) {
      // Set endDate to end of day in IST
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
      whereClause.createdAt = {
        [Op.lte]: endUTC,
      };
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Build include clause with store filter if provided
    const includeClause = [
      {
        model: Contact,
        as: 'contact',
        attributes: ['name', 'phone', 'message', 'remark', 'store'],
        ...(store && store !== 'all' ? { where: { store: store } } : {}),
      },
    ];

    // Get call logs with contact information
    const callLogs = await CallLog.findAll({
      where: whereClause,
      include: includeClause,
      order: [['createdAt', 'DESC']],
    });

    // Helper function to parse message
    const parseMessage = (message) => {
      if (!message) return {};

      const parts = message.split(' | ');
      const data = {};

      parts.forEach((part) => {
        if (part.includes(':')) {
          const [key, value] = part.split(':').map((s) => s.trim());
          data[key] = value;
        }
      });

      return data;
    };

    // Prepare data for export
    const exportData = callLogs.map((log, index) => {
      const messageData = parseMessage(log.contact?.message);

      // Format duration
      const durationFormatted = log.duration
        ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s`
        : '0:00';

      // Only include recording URL if duration is not 0
      const hasDuration = log.duration && log.duration > 0;
      const recordingURL = hasDuration ? log.recording_url || 'N/A' : 'N/A';

      return {
        'S.No': index + 1,
        'Contact Name': log.contact?.name || 'N/A',
        Phone: log.contact?.phone || 'N/A',
        Order: messageData.Order || 'N/A',
        Product: messageData.Product || 'N/A',
        Qty: messageData.Qty || 'N/A',
        Value: messageData.Value || 'N/A',
        Address: messageData.Address || 'N/A',
        Pincode: messageData.Pincode || 'N/A',
        'Attempt No': log.attempt_no,
        Status: log.status,
        'Duration (formatted)': durationFormatted,
        'Recording URL': recordingURL,
        Remark: log.contact?.remark || log.remark || '-',
        'Call Date': new Date(log.createdAt).toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const columnWidths = [
      { wch: 8 }, // S.No
      { wch: 20 }, // Contact Name
      { wch: 15 }, // Phone
      { wch: 15 }, // Order
      { wch: 30 }, // Product
      { wch: 8 }, // Qty
      { wch: 15 }, // Value
      { wch: 40 }, // Address
      { wch: 12 }, // Pincode
      { wch: 12 }, // Attempt No
      { wch: 15 }, // Status
      { wch: 18 }, // Duration (formatted)
      { wch: 40 }, // Recording URL
      { wch: 12 }, // Remark
      { wch: 25 }, // Call Date
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Call Logs');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `call_logs_${timestamp}.${format}`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Convert to buffer and send
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: format === 'csv' ? 'csv' : 'xlsx',
    });

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting calls to Excel:', error);
    res.status(500).json({
      error: 'Failed to export calls',
      details: error.message,
    });
  }
};

// Get detailed call logs for reports
const getCallLogs = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      store,
      page = 1,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // If no limit is specified, fetch all records (no pagination)
    // Otherwise use the specified limit with pagination
    const usePagination = limit !== undefined && limit !== null && limit !== '';
    const limitValue = usePagination ? parseInt(limit) : null;
    const offset = usePagination ? (page - 1) * limitValue : 0;

    // Build where clause with proper date range handling
    let whereClause = {};
    if (startDate && endDate) {
      // Set startDate to beginning of day (00:00:00) in IST
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      // Convert to UTC for database comparison (IST is UTC+5:30)
      const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
      
      // Set endDate to end of day (23:59:59.999) in IST
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // Convert to UTC for database comparison
      const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
      
      whereClause.createdAt = {
        [Op.between]: [startUTC, endUTC],
      };
    } else if (startDate) {
      // Set startDate to beginning of day in IST
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
      whereClause.createdAt = {
        [Op.gte]: startUTC,
      };
    } else if (endDate) {
      // Set endDate to end of day in IST
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
      whereClause.createdAt = {
        [Op.lte]: endUTC,
      };
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Build include clause with store filter if provided
    const includeClause = [
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
          'remark',
          'store',
        ],
        ...(store && store !== 'all' ? { where: { store: store }, required: true } : {}),
      },
    ];

    // Get call logs with or without pagination
    const queryOptions = {
      where: whereClause,
      include: includeClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
    };

    // Only apply limit and offset if pagination is requested
    if (usePagination) {
      queryOptions.limit = limitValue;
      queryOptions.offset = offset;
    }

    const { count, rows: callLogs } = await CallLog.findAndCountAll(queryOptions);

    // Calculate pagination info
    const totalPages = usePagination ? Math.ceil(count / limitValue) : 1;
    const hasNextPage = usePagination ? page < totalPages : false;
    const hasPrevPage = usePagination ? page > 1 : false;

    res.json({
      success: true,
      data: {
        callLogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: usePagination ? parseInt(limit) : count,
          hasNextPage,
          hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error('Error getting call logs:', error);
    res.status(500).json({
      error: 'Failed to get call logs',
      details: error.message,
    });
  }
};

// Get dashboard summary for reports
const getDashboardSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build where clause for date range
    let whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate),
      };
    }

    // Get contact statistics
    const contactStats = await Contact.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
    });

    // Get call statistics
    const totalCalls = await CallLog.count({ where: whereClause });
    const completedCalls = await CallLog.count({
      where: {
        ...whereClause,
        status: 'Completed',
      },
    });

    // Get today's calls
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCalls = await CallLog.count({
      where: {
        createdAt: {
          [Op.between]: [todayStart, todayEnd],
        },
      },
    });

    // Get average duration for completed calls only (Per successful call)
    const avgDurationResult = await CallLog.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration'],
      ],
      where: {
        ...whereClause,
        duration: { [Op.ne]: null },
        status: 'Completed', // Only include completed calls
      },
    });

    const avgDuration = avgDurationResult?.dataValues?.avgDuration || 0;

    res.json({
      success: true,
      summary: {
        contacts: {
          total: contactStats.reduce(
            (sum, item) => sum + parseInt(item.dataValues.count),
            0,
          ),
          byStatus: contactStats.map((item) => ({
            status: item.status,
            count: parseInt(item.dataValues.count),
          })),
        },
        calls: {
          total: totalCalls,
          completed: completedCalls,
          today: todayCalls,
          successRate:
            totalCalls > 0
              ? Math.round((completedCalls / totalCalls) * 100 * 100) / 100
              : 0,
          avgDuration: Math.round(avgDuration),
        },
      },
    });
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    res.status(500).json({
      error: 'Failed to get dashboard summary',
      details: error.message,
    });
  }
};

// Get daily call trends for charts
const getDailyTrends = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Get daily call counts for the last N days
    const dailyTrends = await CallLog.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [
          sequelize.fn(
            'SUM',
            sequelize.literal(
              'CASE WHEN status = "Completed" THEN 1 ELSE 0 END',
            ),
          ),
          'completed',
        ],
        [
          sequelize.fn(
            'SUM',
            sequelize.literal('CASE WHEN status = "Failed" THEN 1 ELSE 0 END'),
          ),
          'failed',
        ],
      ],
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
        },
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    // Format data for charts
    const formattedTrends = dailyTrends.map((trend) => ({
      date: trend.date,
      calls: parseInt(trend.count) || 0,
      completed: parseInt(trend.completed) || 0,
      failed: parseInt(trend.failed) || 0,
      dayName: new Date(trend.date).toLocaleDateString('en-US', {
        weekday: 'short',
      }),
    }));

    res.json({
      success: true,
      data: formattedTrends,
    });
  } catch (error) {
    console.error('Error getting daily trends:', error);
    res.status(500).json({
      error: 'Failed to get daily trends',
      details: error.message,
    });
  }
};

// Get hourly call trends for charts
const getHourlyTrends = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const hourlyTrends = await CallLog.findAll({
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('createdAt')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [
          sequelize.fn(
            'SUM',
            sequelize.literal(
              'CASE WHEN status = "Completed" THEN 1 ELSE 0 END',
            ),
          ),
          'completed',
        ],
      ],
      where: {
        createdAt: {
          [Op.between]: [startOfDay, endOfDay],
        },
      },
      group: [sequelize.fn('HOUR', sequelize.col('createdAt'))],
      order: [[sequelize.fn('HOUR', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    // Fill in missing hours with zero values
    const hourlyData = [];
    for (let hour = 0; hour < 24; hour++) {
      const existingData = hourlyTrends.find((trend) => trend.hour === hour);
      hourlyData.push({
        hour: hour,
        calls: existingData ? parseInt(existingData.count) : 0,
        completed: existingData ? parseInt(existingData.completed) : 0,
        timeLabel: `${hour.toString().padStart(2, '0')}:00`,
      });
    }

    res.json({
      success: true,
      data: hourlyData,
    });
  } catch (error) {
    console.error('Error getting hourly trends:', error);
    res.status(500).json({
      error: 'Failed to get hourly trends',
      details: error.message,
    });
  }
};

// Proxy Exotel recording URL to bypass authentication
const proxyRecording = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      console.error('❌ Missing recording URL parameter');
      return res.status(400).json({ error: 'Missing recording URL parameter' });
    }

    // Extract Exotel credentials from environment
    const exotelSid = process.env.EXOTEL_SID;
    const exotelToken = process.env.EXOTEL_TOKEN;

    if (!exotelSid || !exotelToken) {
      console.error('❌ Missing Exotel credentials in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      // Fetch the recording with Exotel authentication
      const response = await axios.get(url, {
        auth: {
          username: exotelSid,
          password: exotelToken,
        },
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          Accept: 'audio/*',
        },
      });

      // Set appropriate headers for audio streaming
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'audio/mpeg');
      }

      res.setHeader('Content-Disposition', `inline; filename="recording.mp3"`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Stream the audio data to the client
      response.data.pipe(res);

      response.data.on('error', (err) => {
        console.error('❌ Error streaming recording:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming audio' });
        }
      });

      res.on('close', () => {
        console.log('✅ Recording stream completed');
      });
    } catch (error) {
      console.error('❌ Error fetching recording:', error.message);
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      console.error('   Response:', error.response?.data);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to fetch recording',
          details: error.message,
        });
      }
    }
  } catch (error) {
    console.error('Error in proxyRecording:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to proxy recording',
        details: error.message,
      });
    }
  }
};

module.exports = {
  getCallStatistics,
  exportCallsToExcel,
  getCallLogs,
  getDashboardSummary,
  getDailyTrends,
  getHourlyTrends,
  proxyRecording,
};
