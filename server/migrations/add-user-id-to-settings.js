const { sequelize } = require('../config/database');

async function addUserIdToSettings() {
  try {
    console.log('🔄 Adding user_id column to settings table...');
    
    await sequelize.query(`
      ALTER TABLE settings 
      ADD COLUMN user_id INT NULL,
      ADD INDEX idx_user_id (user_id),
      ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);
    
    console.log('✅ Successfully added user_id column to settings table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  user_id column already exists, skipping...');
    } else {
      console.error('❌ Error adding user_id column:', error.message);
      throw error;
    }
  }
}

// Run migration
addUserIdToSettings()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

