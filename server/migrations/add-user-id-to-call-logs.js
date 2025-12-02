const { sequelize } = require('../config/database');

async function addUserIdToCallLogs() {
  try {
    console.log('🔄 Adding user_id column to call_logs table...');

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM call_logs LIKE 'user_id'"
    );

    if (columns.length === 0) {
      await sequelize.query(`
        ALTER TABLE call_logs 
        ADD COLUMN user_id INT NULL,
        ADD INDEX idx_user_id (user_id),
        ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✅ Successfully added user_id column to call_logs table');
    } else {
      console.log('ℹ️  user_id column already exists, skipping...');
    }
  } catch (error) {
    console.error('❌ Error adding user_id column:', error.message);
    throw error;
  }
}

// Run migration
addUserIdToCallLogs()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

