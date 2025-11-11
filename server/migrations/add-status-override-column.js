const { sequelize } = require('../config/database');

async function addStatusOverrideColumn() {
  try {
    console.log("🔄 Adding 'status_override' column to contacts table...");
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM contacts LIKE 'status_override'",
    );
    if (columns.length === 0) {
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN status_override VARCHAR(50) NULL AFTER status',
      );
      console.log("✅ Added 'status_override' column to contacts table");
    } else {
      console.log("⚠️  'status_override' column already exists in contacts table");
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'status_override' column:", error);
    process.exit(1);
  }
}

addStatusOverrideColumn();

