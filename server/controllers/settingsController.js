const Settings = require("../models/Settings");
const mysql = require('mysql2/promise');

// Create a direct MySQL connection for settings queries to bypass Sequelize connection pool issues
const getDirectConnection = async () => {
  const dbName = process.env.DB_NAME || 'call_db';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });
  
  // Verify we're connected to the correct database and the column exists
  try {
    const [dbCheck] = await connection.execute('SELECT DATABASE() as db');
    console.log('🔌 [Settings] Connected to database:', dbCheck[0]?.db);
    
    // Verify user_id column exists
    const [columnCheck] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'settings' AND COLUMN_NAME = 'user_id'`,
      [dbName]
    );
    
    if (columnCheck.length === 0) {
      console.error('❌ [Settings] user_id column does not exist! Attempting to add it...');
      // Try to add the column
      await connection.execute(
        `ALTER TABLE \`${dbName}\`.\`settings\` ADD COLUMN \`user_id\` INT NULL`
      ).catch(err => {
        if (!err.message.includes('Duplicate column')) {
          console.error('❌ [Settings] Failed to add user_id column:', err);
        }
      });
      
      // Add index
      await connection.execute(
        `CREATE INDEX idx_user_id ON \`${dbName}\`.\`settings\`(\`user_id\`)`
      ).catch(err => {
        if (!err.message.includes('Duplicate key')) {
          console.error('❌ [Settings] Failed to add index:', err);
        }
      });
    } else {
      console.log('✅ [Settings] user_id column verified');
    }
  } catch (verifyError) {
    console.error('❌ [Settings] Error verifying connection:', verifyError);
  }
  
  return connection;
};

const getSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use direct MySQL connection to bypass Sequelize connection pool issues
    const connection = await getDirectConnection();
    const dbName = process.env.DB_NAME || 'call_db';
    
    try {
      // First verify the table structure
      const [tableCheck] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'settings'`,
        [dbName]
      );
      console.log('📋 [Settings] Table columns:', tableCheck.map(c => c.COLUMN_NAME));
      
      // Query using direct connection with explicit database name
      const [rows] = await connection.execute(
        `SELECT * FROM \`${dbName}\`.\`settings\` WHERE \`user_id\` = ? ORDER BY \`createdAt\` DESC LIMIT 1`,
        [userId]
      );
      
      const settings = rows[0] || null;

    // If no user-specific settings exist, create default settings from env
    if (!settings) {
      const createData = {
        user_id: userId,
        exotel_sid: process.env.EXOTEL_SID || "",
        api_key: process.env.EXOTEL_API_KEY || "",
        api_token: process.env.EXOTEL_API_TOKEN || "",
        agent_number: process.env.EXOTEL_AGENT_NUMBER || process.env.AGENT_NUMBER || "",
        caller_id: process.env.EXOTEL_CALLER_ID || process.env.CALLER_ID || "",
      };
      
      await connection.execute(
        `INSERT INTO \`${dbName}\`.\`settings\` (\`user_id\`, \`exotel_sid\`, \`api_key\`, \`api_token\`, \`agent_number\`, \`caller_id\`, \`createdAt\`, \`updatedAt\`) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [createData.user_id, createData.exotel_sid, createData.api_key, createData.api_token, createData.agent_number, createData.caller_id]
      );
      
      // Fetch the newly created settings
      const [newRows] = await connection.execute(
        `SELECT * FROM \`${dbName}\`.\`settings\` WHERE \`user_id\` = ? ORDER BY \`createdAt\` DESC LIMIT 1`,
        [userId]
      );
      
      const newSettings = newRows[0];
      
      const responseData = {
        id: newSettings.id,
        user_id: newSettings.user_id,
        exotel_sid: newSettings.exotel_sid || "",
        api_key: newSettings.api_key || "",
        api_token: newSettings.api_token || "",
        agent_number: newSettings.agent_number || "",
        caller_id: newSettings.caller_id || "",
        createdAt: newSettings.createdAt,
        updatedAt: newSettings.updatedAt,
      };
      
      console.log('📋 [Settings] Retrieved user-specific settings:', {
        userId,
        hasAgentNumber: !!responseData.agent_number,
        agentNumberLength: responseData.agent_number?.length || 0,
      });

      return res.json(responseData);
    }

    // Convert raw query result to match expected format
    const responseData = {
      id: settings.id,
      user_id: settings.user_id,
      exotel_sid: settings.exotel_sid || "",
      api_key: settings.api_key || "",
      api_token: settings.api_token || "",
      agent_number: settings.agent_number || "",
      caller_id: settings.caller_id || "",
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    console.log('📋 [Settings] Retrieved user-specific settings:', {
      userId,
      hasAgentNumber: !!responseData.agent_number,
      agentNumberLength: responseData.agent_number?.length || 0,
    });

    res.json(responseData);
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('❌ [Settings] Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Log incoming request data
    console.log('📥 [Settings] Update request received:', {
      userId,
      body: {
        ...req.body,
        agent_number: req.body.agent_number ? `***${req.body.agent_number.slice(-4)}` : 'empty',
      },
    });

    // Normalize agent_number to remove whitespace and hidden characters
    const updateData = { ...req.body };
    
    // Clean agent_number if provided
    if (updateData.agent_number && typeof updateData.agent_number === 'string') {
      const originalValue = updateData.agent_number;
      updateData.agent_number = updateData.agent_number
        .trim()
        .replace(/\0/g, '') // Remove null bytes
        .replace(/\s+/g, '') // Remove all whitespace
        .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
      
      console.log('🧹 [Settings] Cleaned agent_number:', {
        original: originalValue,
        cleaned: updateData.agent_number,
        length: updateData.agent_number.length,
      });
    }
    
    // Use direct MySQL connection to bypass Sequelize connection pool issues
    const connection = await getDirectConnection();
    const dbName = process.env.DB_NAME || 'call_db';
    
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM \`${dbName}\`.\`settings\` WHERE \`user_id\` = ? LIMIT 1`,
        [userId]
      );
      
      const existingSettings = rows[0] || null;

    if (!existingSettings) {
      // Create new user-specific settings using raw query
      try {
        const createData = {
          user_id: userId,
          exotel_sid: process.env.EXOTEL_SID || "",
          api_key: process.env.EXOTEL_API_KEY || "",
          api_token: process.env.EXOTEL_API_TOKEN || "",
          agent_number: updateData.agent_number || process.env.EXOTEL_AGENT_NUMBER || process.env.AGENT_NUMBER || "",
          caller_id: process.env.EXOTEL_CALLER_ID || process.env.CALLER_ID || "",
        };
        
        console.log('📝 [Settings] Creating new settings with data:', {
          ...createData,
          agent_number: createData.agent_number ? '***' : 'empty',
          api_key: createData.api_key ? '***' : 'empty',
          api_token: createData.api_token ? '***' : 'empty',
        });
        
        await connection.execute(
          `INSERT INTO \`${dbName}\`.\`settings\` (\`user_id\`, \`exotel_sid\`, \`api_key\`, \`api_token\`, \`agent_number\`, \`caller_id\`, \`createdAt\`, \`updatedAt\`) 
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [createData.user_id, createData.exotel_sid, createData.api_key, createData.api_token, createData.agent_number, createData.caller_id]
        );
        
        // Fetch the newly created settings
        const [newRows] = await connection.execute(
          `SELECT * FROM \`${dbName}\`.\`settings\` WHERE \`user_id\` = ? ORDER BY \`createdAt\` DESC LIMIT 1`,
          [userId]
        );
        
        const newSettings = newRows[0];
        
        settings = newSettings;
      } catch (createError) {
        console.error('❌ [Settings] Error creating settings:', createError);
        throw createError;
      }
    } else {
      // Update existing user-specific settings using raw query
      try {
        const { user_id, ...dataToUpdate } = updateData;
        
        // Build SET clause dynamically with parameterized queries
        const setParts = [];
        const updateValues = [];
        
        Object.keys(dataToUpdate).forEach(key => {
          if (dataToUpdate[key] !== undefined) {
            setParts.push(`\`${key}\` = ?`);
            updateValues.push(dataToUpdate[key]);
            console.log(`📝 [Settings] Adding to update: ${key} = ${key === 'agent_number' ? '***' : dataToUpdate[key]}`);
          }
        });
        
        if (setParts.length > 0) {
          setParts.push('`updatedAt` = NOW()');
          
          // Add userId for WHERE clause
          updateValues.push(userId);
          
          const updateQuery = `UPDATE \`${dbName}\`.\`settings\` SET ${setParts.join(', ')} WHERE \`user_id\` = ?`;
          console.log('🔧 [Settings] Executing update query:', updateQuery);
          console.log('🔧 [Settings] Update values:', updateValues.map((v, i) => i === updateValues.length - 1 ? `userId=${v}` : '***'));
          
          const [result] = await connection.execute(updateQuery, updateValues);
          console.log('✅ [Settings] Update result:', {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows,
          });
        } else {
          console.log('⚠️ [Settings] No fields to update');
        }
        
        // Fetch updated settings
        const [updatedRows] = await connection.execute(
          `SELECT * FROM \`${dbName}\`.\`settings\` WHERE \`user_id\` = ? LIMIT 1`,
          [userId]
        );
        
        const updatedSettings = updatedRows[0];
        
        settings = updatedSettings;
      } catch (updateError) {
        console.error('❌ [Settings] Error updating settings:', updateError);
        throw updateError;
      }
    }

    console.log('✅ [Settings] Updated user-specific settings:', {
      userId,
      agent_number: settings?.agent_number,
      exotel_sid: settings?.exotel_sid ? '***' : 'empty',
      has_api_key: !!settings?.api_key,
      has_api_token: !!settings?.api_token,
      caller_id: settings?.caller_id ? '***' : 'empty',
    });

    // Convert raw query result to match Sequelize model format
    const responseData = {
      id: settings.id,
      user_id: settings.user_id,
      exotel_sid: settings.exotel_sid || "",
      api_key: settings.api_key || "",
      api_token: settings.api_token || "",
      agent_number: settings.agent_number || "",
      caller_id: settings.caller_id || "",
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    res.json(responseData);
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('❌ [Settings] Error updating:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
