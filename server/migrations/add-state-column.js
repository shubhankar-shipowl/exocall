const { sequelize } = require('../config/database');

async function addStateColumn() {
  try {
    console.log("🔄 Adding 'state' column to contacts table...");
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM contacts LIKE 'state'",
    );
    if (columns.length === 0) {
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN state VARCHAR(255) NULL AFTER address',
      );
      console.log("✅ Added 'state' column to contacts table");
    } else {
      console.log("⚠️  'state' column already exists in contacts table");
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'state' column:", error);
    process.exit(1);
  }
}

addStateColumn();

