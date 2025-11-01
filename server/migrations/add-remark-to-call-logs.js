const { sequelize } = require('../config/database');

async function addRemarkToCallLogs() {
  try {
    console.log("🔄 Adding 'remark' column to call_logs table...");

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM call_logs LIKE 'remark'",
    );

    if (columns.length === 0) {
      // Add the remark column
      await sequelize.query(
        'ALTER TABLE call_logs ADD COLUMN remark VARCHAR(50) NULL',
      );
      console.log("✅ Added 'remark' column to call_logs table");
    } else {
      console.log("⚠️  'remark' column already exists in call_logs table");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'remark' column:", error);
    process.exit(1);
  }
}

addRemarkToCallLogs();
