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

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      whereClause.user_id = req.user.id;
      console.log(`🔒 [CallStatistics] Filtering statistics for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [CallStatistics] Admin user - showing all statistics`);
    }

    // Build include clause for store filtering
    // Use case-insensitive store comparison to match export function behavior
    const includeClause = store && store !== 'all' ? [
      {
        model: Contact,
        as: 'contact',
        attributes: [],
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('store'))),
              store.toLowerCase().trim()
            )
          ]
        },
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
    // Use raw query to avoid MySQL only_full_group_by error (Sequelize adds id column automatically)
    let avgDuration = 0;
    try {
      // Build the WHERE clause manually for the raw query
      const whereConditions = [];
      const replacements = [];
      
      // Add date range conditions
      if (whereClause.createdAt) {
        if (whereClause.createdAt[Op.between]) {
          whereConditions.push('`CallLog`.`createdAt` BETWEEN ? AND ?');
          replacements.push(whereClause.createdAt[Op.between][0]);
          replacements.push(whereClause.createdAt[Op.between][1]);
        } else if (whereClause.createdAt[Op.gte]) {
          whereConditions.push('`CallLog`.`createdAt` >= ?');
          replacements.push(whereClause.createdAt[Op.gte]);
        } else if (whereClause.createdAt[Op.lte]) {
          whereConditions.push('`CallLog`.`createdAt` <= ?');
          replacements.push(whereClause.createdAt[Op.lte]);
        }
      }
      
      // Add status condition
      if (whereClause.status) {
        whereConditions.push('`CallLog`.`status` = ?');
        replacements.push(whereClause.status);
      }
      
      // Add user_id condition
      if (whereClause.user_id) {
        whereConditions.push('`CallLog`.`user_id` = ?');
        replacements.push(whereClause.user_id);
      }
      
      // Add duration not null condition
      whereConditions.push('`CallLog`.`duration` IS NOT NULL');
      
      // Build the JOIN clause for store filter
      let joinClause = '';
      if (store && store !== 'all') {
        joinClause = `INNER JOIN \`contacts\` AS \`contact\` ON \`CallLog\`.\`contact_id\` = \`contact\`.\`id\` AND (LOWER(TRIM(\`contact\`.\`store\`)) = ?)`;
        replacements.unshift(store.toLowerCase().trim()); // Add store at the beginning
      }
      
      const whereClauseSQL = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT AVG(\`CallLog\`.\`duration\`) AS \`avgDuration\`
        FROM \`call_logs\` AS \`CallLog\`
        ${joinClause}
        ${whereClauseSQL}
      `;
      
      const [results] = await sequelize.query(query, {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      });
      
      avgDuration = results?.avgDuration || 0;
    } catch (error) {
      console.error('Error calculating average duration:', error);
      avgDuration = 0;
    }

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

    // Helper function to parse date string (handles both YYYY-MM-DD and DD/MM/YYYY formats)
    const parseDate = (dateString) => {
      if (!dateString) return null;
      
      // Try YYYY-MM-DD format first (standard HTML date input format)
      if (dateString.includes('-')) {
        return new Date(dateString);
      }
      
      // Try DD/MM/YYYY format
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // Assume DD/MM/YYYY format
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
      }
      
      // Fallback to default Date parsing
      return new Date(dateString);
    };

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

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      whereClause.user_id = req.user.id;
      console.log(`🔒 [ExportCalls] Filtering exports for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [ExportCalls] Admin user - exporting all call logs`);
    }

    // Build include clause with store filter if provided
    // Use required: false to ensure we get call logs even if contact doesn't match store filter
    // We'll filter by store later to ensure accuracy
    const includeClause = [
      {
        model: Contact,
        as: 'contact',
        attributes: ['name', 'phone', 'message', 'remark', 'store', 'agent_notes'],
        required: false, // LEFT JOIN to include all call logs
      },
    ];

    // When both store and date filters are provided, get ALL contacts for that store and date first
    // Then match them with call logs to ensure we include all contacts
    let allContactsForStoreAndDate = [];
    let callLogsMap = new Map(); // Map contact_id to latest call log
    
    if (store && store !== 'all' && (startDate || endDate)) {
      // Build date range for filtering (reuse the same date parsing logic)
      let dateFilter = {};
      if (startDate && endDate) {
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.error(`Invalid date format: startDate=${startDate}, endDate=${endDate}`);
          return res.status(400).json({ error: 'Invalid date format' });
        }
        
        start.setHours(0, 0, 0, 0);
        const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
        
        end.setHours(23, 59, 59, 999);
        const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
        
        dateFilter = {
          [Op.between]: [startUTC, endUTC],
        };
      } else if (startDate) {
        const start = parseDate(startDate);
        if (isNaN(start.getTime())) {
          console.error(`Invalid start date format: ${startDate}`);
          return res.status(400).json({ error: 'Invalid start date format' });
        }
        start.setHours(0, 0, 0, 0);
        const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
        dateFilter = {
          [Op.gte]: startUTC,
        };
      } else if (endDate) {
        const end = parseDate(endDate);
        if (isNaN(end.getTime())) {
          console.error(`Invalid end date format: ${endDate}`);
          return res.status(400).json({ error: 'Invalid end date format' });
        }
        end.setHours(23, 59, 59, 999);
        const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
        dateFilter = {
          [Op.lte]: endUTC,
        };
      }

      // Use case-insensitive store comparison
      const storeCondition = sequelize.where(
        sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('store'))),
        store.toLowerCase().trim()
      );

      // STEP 1: Get all call logs for this store within the date range
      // IMPORTANT: When status is "all", we need to fetch ALL call logs (including "Not Connect")
      // Build call log where clause without status filter to get all call logs
      const callLogDateFilter = {};
      if (startDate && endDate) {
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          start.setHours(0, 0, 0, 0);
          const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
          end.setHours(23, 59, 59, 999);
          const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          callLogDateFilter.createdAt = {
            [Op.between]: [startUTC, endUTC],
          };
        }
      } else if (startDate) {
        const start = parseDate(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
          callLogDateFilter.createdAt = {
            [Op.gte]: startUTC,
          };
        }
      } else if (endDate) {
        const end = parseDate(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          callLogDateFilter.createdAt = {
            [Op.lte]: endUTC,
          };
        }
      }
      
      // Role-based filtering: Add user_id filter for agents
      if (req.user && req.user.role !== 'admin') {
        callLogDateFilter.user_id = req.user.id;
      }

      // Fetch ALL call logs for the date range (no status filter) to ensure we get all contacts
      const callLogsWithStore = await CallLog.findAll({
        where: callLogDateFilter,
        include: [{
          model: Contact,
          as: 'contact',
          where: {
            [Op.and]: [storeCondition],
          },
          required: true, // INNER JOIN - only get call logs with matching store
          attributes: ['id', 'name', 'phone', 'message', 'remark', 'store', 'agent_notes', 'createdAt', 'status'],
        }],
        order: [['createdAt', 'DESC']],
      });

      console.log(`Found ${callLogsWithStore.length} call logs for store "${store}" within date range (all statuses)`);

      // Map call logs to contacts (only latest call log per contact)
      // IMPORTANT: Include ALL call logs, regardless of status, so we can match all contacts
      const contactIdsFromCallLogs = new Set();
      for (const log of callLogsWithStore) {
        if (log.contact_id && !callLogsMap.has(log.contact_id)) {
          callLogsMap.set(log.contact_id, log);
          contactIdsFromCallLogs.add(log.contact_id);
        }
      }

      // STEP 2: Get all contacts created on this date for this store
      const contactWhereConditions = [storeCondition];
      if (Object.keys(dateFilter).length > 0) {
        contactWhereConditions.push({ createdAt: dateFilter });
      }
      
      const contactWhereClause = {
        [Op.and]: contactWhereConditions,
      };

      const contactsCreatedOnDate = await Contact.findAll({
        where: contactWhereClause,
        attributes: ['id', 'name', 'phone', 'message', 'remark', 'store', 'agent_notes', 'createdAt', 'status'],
      });

      console.log(`Found ${contactsCreatedOnDate.length} contacts created on date for store "${store}"`);

      // STEP 3: Combine contacts from both sources (union)
      // - Contacts that have call logs on the selected date
      // - Contacts created on the selected date
      const allContactIds = new Set();
      const contactsMap = new Map();

      // Add contacts from call logs
      for (const log of callLogsWithStore) {
        if (log.contact && !allContactIds.has(log.contact.id)) {
          allContactIds.add(log.contact.id);
          contactsMap.set(log.contact.id, log.contact);
        }
      }

      // Add contacts created on the date
      for (const contact of contactsCreatedOnDate) {
        if (!allContactIds.has(contact.id)) {
          allContactIds.add(contact.id);
          contactsMap.set(contact.id, contact);
        }
      }

      // Convert to array
      allContactsForStoreAndDate = Array.from(contactsMap.values());

      console.log(`Total unique contacts for store "${store}" on date: ${allContactsForStoreAndDate.length} (${contactIdsFromCallLogs.size} with call logs, ${contactsCreatedOnDate.length} created on date)`);
    } else {
      // Role-based filtering: Add user_id filter for agents (if not already in whereClause)
      if (req.user && req.user.role !== 'admin' && !whereClause.user_id) {
        whereClause.user_id = req.user.id;
      }

      // Original logic when store filter is not provided or no date filter
      const allCallLogs = await CallLog.findAll({
        where: whereClause,
        include: includeClause,
        order: [['createdAt', 'DESC']],
      });

      // Filter call logs by store if store filter is provided, and get only latest per contact
      // Use case-insensitive comparison to match export function behavior
      const seenContactIds = new Set();
      for (const log of allCallLogs) {
        if (!log.contact_id) continue;
        
        if (store && store !== 'all') {
          const logStore = log.contact?.store?.toLowerCase().trim() || '';
          const filterStore = store.toLowerCase().trim();
          if (!log.contact || logStore !== filterStore) {
            continue;
          }
        }
        
        if (!seenContactIds.has(log.contact_id)) {
          seenContactIds.add(log.contact_id);
          callLogsMap.set(log.contact_id, log);
        }
      }
    }

    // Separate contacts into those with call logs and those without
    const callLogs = [];
    const notCalledContacts = [];
    
    if (allContactsForStoreAndDate.length > 0) {
      // We have all contacts for store and date, separate them
      // IMPORTANT: Only include contacts that are relevant to the selected date
      // - Contacts with call logs on the selected date (regardless of when contact was created)
      // - Contacts created on the selected date (even if no call logs)
      
      // Build date range to check if contact was created on selected date
      // This ensures we only include contacts from the selected date, not past dates
      let dateStartUTC = null;
      let dateEndUTC = null;
      
      if (store && store !== 'all' && (startDate || endDate)) {
        if (startDate && endDate) {
          const start = parseDate(startDate);
          const end = parseDate(endDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            start.setHours(0, 0, 0, 0);
            dateStartUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
            end.setHours(23, 59, 59, 999);
            dateEndUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          }
        } else if (startDate) {
          const start = parseDate(startDate);
          if (!isNaN(start.getTime())) {
            start.setHours(0, 0, 0, 0);
            dateStartUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            dateEndUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          }
        } else if (endDate) {
          const end = parseDate(endDate);
          if (!isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            dateEndUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
            dateStartUTC = new Date(0); // Start from epoch if only endDate provided
          }
        }
      }
      
      // IMPORTANT: When both store and date filters are provided, export ONLY call logs (actual call data)
      // Do not include contacts without call logs - only export actual call data for that store and date range
      for (const contact of allContactsForStoreAndDate) {
        const callLog = callLogsMap.get(contact.id);
        
        if (callLog) {
          // Contact has a call log on the selected date
          // Apply status filter only if status is not "all"
          if (status && status !== 'all' && callLog.status !== status) {
            // If status filter doesn't match, skip this call log
            continue;
          } else {
            // Include this call log data
            // This includes ALL statuses when status is "all" (including "Not Connect")
            callLog.contact = contact;
            callLogs.push(callLog);
          }
        }
        // Skip contacts without call logs when both store and date filters are provided
        // Only export actual call data, not contacts without calls
      }
      
      console.log(`Export Summary: Store="${store}", Date="${startDate} to ${endDate}", Status="${status || 'all'}"`);
      console.log(`  - ${callLogs.length} call logs exported (matching store, date range, and status filter)`);
      console.log(`  - Only call data is exported (contacts without call logs are excluded when both store and date filters are provided)`);
    } else {
      // Convert map to array
      callLogs.push(...Array.from(callLogsMap.values()));
      
      // Get "Not Called" contacts if store filter is provided
      // Use case-insensitive comparison to match export function behavior
      if (store && store !== 'all') {
        const contactWhereClause = {
          [Op.and]: [
            sequelize.where(
              sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('store'))),
              store.toLowerCase().trim()
            ),
            { status: 'Not Called' }
          ],
        };

        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
          
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          
          contactWhereClause.createdAt = {
            [Op.between]: [startUTC, endUTC],
          };
        } else if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
          contactWhereClause.createdAt = {
            [Op.gte]: startUTC,
          };
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
          contactWhereClause.createdAt = {
            [Op.lte]: endUTC,
          };
        }

        const notCalledContactsList = await Contact.findAll({
          where: contactWhereClause,
          attributes: ['id', 'name', 'phone', 'message', 'remark', 'store', 'agent_notes', 'createdAt'],
        });

        const contactIdsWithCallLogs = new Set(
          callLogs.map((log) => log.contact_id).filter((id) => id !== null && id !== undefined)
        );

        notCalledContacts.push(...notCalledContactsList.filter(
          (contact) => !contactIdsWithCallLogs.has(contact.id)
        ));
      }
    }

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

    // Helper function to extract only the note text after timestamp from agent_notes
    const extractNoteText = (agentNotes) => {
      if (!agentNotes) return '';
      
      // Pattern to match timestamp like [11/12/2025, 9:40:43 AM] or similar formats
      // Matches: [date, time AM/PM] followed by note text
      const timestampPattern = /\[\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\]\s*/gi;
      
      // Find all matches to get the last one
      let match;
      let lastMatchIndex = -1;
      let lastMatchLength = 0;
      
      while ((match = timestampPattern.exec(agentNotes)) !== null) {
        lastMatchIndex = match.index;
        lastMatchLength = match[0].length;
      }
      
      if (lastMatchIndex > -1) {
        // Extract text after the last timestamp
        const noteText = agentNotes.substring(lastMatchIndex + lastMatchLength).trim();
        return noteText;
      }
      
      // If no timestamp pattern found, return empty string
      return '';
    };

    // Helper function to normalize status values to exact format
    const normalizeStatus = (status) => {
      if (!status) return status;
      
      const statusLower = status.toLowerCase().trim();
      
      // Map common variations to exact format
      if (statusLower === 'not connect' || statusLower === 'notconnect' || statusLower === 'not_connect') {
        return 'Not Connect';
      }
      if (statusLower === 'not called' || statusLower === 'notcalled' || statusLower === 'not_called') {
        return 'Not Called';
      }
      if (statusLower === 'no answer' || statusLower === 'noanswer' || statusLower === 'no_answer') {
        return 'No Answer';
      }
      if (statusLower === 'switched off' || statusLower === 'switchedoff' || statusLower === 'switched_off') {
        return 'Switched Off';
      }
      if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'in_progress') {
        return 'In Progress';
      }
      
      // For other statuses, capitalize first letter of each word
      return status
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    // Prepare data for export from call logs
    const callLogData = callLogs.map((log) => {
      const messageData = parseMessage(log.contact?.message);

      // Format duration
      const durationFormatted = log.duration
        ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s`
        : '0:00';

      // Only include recording URL if duration is not 0
      const hasDuration = log.duration && log.duration > 0;
      const recordingURL = hasDuration ? log.recording_url || 'N/A' : 'N/A';

      return {
        'S.No': null, // Will be set later
        'Contact Name': log.contact?.name || 'N/A',
        Phone: log.contact?.phone || 'N/A',
        Order: messageData.Order || 'N/A',
        Product: messageData.Product || 'N/A',
        Qty: messageData.Qty || 'N/A',
        Value: messageData.Value || 'N/A',
        Address: messageData.Address || 'N/A',
        Pincode: messageData.Pincode || 'N/A',
        Store: log.contact?.store || 'N/A',
        'Attempt No': log.attempt_no,
        Status: normalizeStatus(log.status),
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
        Description: extractNoteText(log.contact?.agent_notes) || '',
      };
    });

    // Prepare data for export from "Not Called" contacts
    const notCalledData = notCalledContacts.map((contact) => {
      const messageData = parseMessage(contact.message);

      return {
        'S.No': null, // Will be set later
        'Contact Name': contact.name || 'N/A',
        Phone: contact.phone || 'N/A',
        Order: messageData.Order || 'N/A',
        Product: messageData.Product || 'N/A',
        Qty: messageData.Qty || 'N/A',
        Value: messageData.Value || 'N/A',
        Address: messageData.Address || 'N/A',
        Pincode: messageData.Pincode || 'N/A',
        Store: contact.store || 'N/A',
        'Attempt No': 0,
        Status: 'Not Called',
        'Duration (formatted)': '0:00',
        'Recording URL': 'N/A',
        Remark: contact.remark || '-',
        'Call Date': new Date(contact.createdAt).toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        Description: extractNoteText(contact.agent_notes) || '',
      };
    });

    // Combine both datasets and assign serial numbers
    const exportData = [...callLogData, ...notCalledData].map((item, index) => ({
      ...item,
      'S.No': index + 1,
    }));

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
      { wch: 20 }, // Store
      { wch: 12 }, // Attempt No
      { wch: 15 }, // Status
      { wch: 18 }, // Duration (formatted)
      { wch: 40 }, // Recording URL
      { wch: 12 }, // Remark
      { wch: 25 }, // Call Date
      { wch: 40 }, // Description
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
    const whereConditions = [];
    
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
      
      whereConditions.push({
        createdAt: {
          [Op.between]: [startUTC, endUTC],
        },
      });
    } else if (startDate) {
      // Set startDate to beginning of day in IST
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const startUTC = new Date(start.getTime() - 5.5 * 60 * 60 * 1000);
      whereConditions.push({
        createdAt: {
          [Op.gte]: startUTC,
        },
      });
    } else if (endDate) {
      // Set endDate to end of day in IST
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endUTC = new Date(end.getTime() - 5.5 * 60 * 60 * 1000);
      whereConditions.push({
        createdAt: {
          [Op.lte]: endUTC,
        },
      });
    }

    if (status && status !== 'all') {
      // Normalize status filter to handle case variations
      // Use case-insensitive comparison using LOWER() function
      const statusLower = status.toLowerCase().trim();
      whereConditions.push(
        sequelize.where(
          sequelize.fn('LOWER', sequelize.col('CallLog.status')),
          statusLower
        )
      );
    }

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      // For agents and other non-admin roles, filter by user_id
      whereConditions.push({
        user_id: req.user.id,
      });
      console.log(`🔒 [CallLogs] Filtering call logs for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [CallLogs] Admin user - showing all call logs`);
    }
    
    // Build final where clause
    const whereClause = whereConditions.length > 0 ? { [Op.and]: whereConditions } : {};

    // Build include clause with store filter if provided
    // Use case-insensitive store comparison to match export function behavior
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
        ...(store && store !== 'all' ? {
          where: {
            [Op.and]: [
              sequelize.where(
                sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('store'))),
                store.toLowerCase().trim()
              )
            ]
          },
          required: true
        } : {}),
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email'],
        required: false, // LEFT JOIN - include even if no user
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

    // Debug: Log first few call logs to verify user data is included
    if (callLogs.length > 0) {
      console.log('📋 [CallLogs] Total call logs found:', count);
      console.log('📋 [CallLogs] Sample call logs with user data:');
      callLogs.slice(0, 3).forEach((log, index) => {
        console.log(`  [${index + 1}] ID: ${log.id}, user_id: ${log.user_id}, hasUser: ${!!log.user}, user:`, 
          log.user ? { id: log.user.id, username: log.user.username, email: log.user.email } : 'null');
      });
    } else {
      console.log('📋 [CallLogs] No call logs found');
    }

    // Calculate pagination info
    const totalPages = usePagination ? Math.ceil(count / limitValue) : 1;
    const hasNextPage = usePagination ? page < totalPages : false;
    const hasPrevPage = usePagination ? page > 1 : false;

    // Ensure user data is properly serialized
    const serializedCallLogs = callLogs.map(log => {
      const logData = log.toJSON ? log.toJSON() : log;
      // Ensure user data is included
      if (logData.user_id && !logData.user) {
        console.warn(`⚠️ [CallLogs] Call log ${logData.id} has user_id ${logData.user_id} but no user data`);
      }
      return logData;
    });

    res.json({
      success: true,
      data: {
        callLogs: serializedCallLogs,
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

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      whereClause.user_id = req.user.id;
      console.log(`🔒 [DashboardSummary] Filtering summary for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [DashboardSummary] Admin user - showing all summary`);
    }

    // Get call statistics first (needed for response)
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
        ...whereClause,
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

    // Build contact where clause for agents (filter by assigned_to)
    let contactWhereClause = {};
    if (req.user && req.user.role === 'agent') {
      // Check if assigned_to column exists
      try {
        const [columns] = await sequelize.query("SHOW COLUMNS FROM contacts LIKE 'assigned_to'");
        if (columns.length > 0) {
          contactWhereClause.assigned_to = req.user.id;
          console.log(`🔒 [DashboardSummary] Filtering contacts for agent ${req.user.id} by assigned_to`);
        } else {
          // If column doesn't exist, return empty stats for agents
          return res.json({
            success: true,
            summary: {
              contacts: {
                total: 0,
                byStatus: [],
              },
              calls: {
                total: totalCalls,
                completed: completedCalls,
                today: todayCalls,
                successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100 * 100) / 100 : 0,
                avgDuration: Math.round(avgDuration),
              },
            },
          });
        }
      } catch (err) {
        // If check fails, return empty stats for agents
        return res.json({
          success: true,
          summary: {
            contacts: {
              total: 0,
              byStatus: [],
            },
            calls: {
              total: totalCalls,
              completed: completedCalls,
              today: todayCalls,
              successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100 * 100) / 100 : 0,
              avgDuration: Math.round(avgDuration),
            },
          },
        });
      }
    }

    // Get contact statistics (filtered by assigned_to for agents)
    const contactStats = await Contact.findAll({
      where: contactWhereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
    });

    const totalContacts = contactStats.reduce(
      (sum, item) => sum + parseInt(item.dataValues.count),
      0,
    );
    const byStatus = contactStats.map((item) => ({
      status: item.status,
      count: parseInt(item.dataValues.count),
    }));

    console.log(`📊 [DashboardSummary] Contact stats for ${req.user?.role || 'unknown'}:`, {
      total: totalContacts,
      byStatus: byStatus,
      filterApplied: req.user?.role === 'agent' ? `assigned_to = ${req.user.id}` : 'none (admin)',
    });

    res.json({
      success: true,
      summary: {
        contacts: {
          total: totalContacts,
          byStatus: byStatus,
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

    // Build where clause with role-based filtering
    const whereClause = {
      createdAt: {
        [Op.gte]: new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
      },
    };

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      whereClause.user_id = req.user.id;
      console.log(`🔒 [DailyTrends] Filtering trends for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [DailyTrends] Admin user - showing all trends`);
    }

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
      where: whereClause,
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

    // Build where clause with role-based filtering
    const whereClause = {
      createdAt: {
        [Op.between]: [startOfDay, endOfDay],
      },
    };

    // Role-based filtering: Agents can only see their own call logs
    if (req.user && req.user.role !== 'admin') {
      whereClause.user_id = req.user.id;
      console.log(`🔒 [HourlyTrends] Filtering trends for user ${req.user.id} (role: ${req.user.role})`);
    } else if (req.user && req.user.role === 'admin') {
      console.log(`👑 [HourlyTrends] Admin user - showing all trends`);
    }

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
      where: whereClause,
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
