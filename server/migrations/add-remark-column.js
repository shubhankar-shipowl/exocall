const { sequelize } = require('../config/database');

async function addRemarkColumn() {
  try {
    console.log("🔄 Adding 'remark' column to contacts table...");

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM contacts LIKE 'remark'",
    );

    if (columns.length === 0) {
      // Add the remark column
      await sequelize.query(
        'ALTER TABLE contacts ADD COLUMN remark VARCHAR(50) NULL',
      );
      console.log("✅ Added 'remark' column to contacts table");
    } else {
      console.log("⚠️  'remark' column already exists in contacts table");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'remark' column:", error);
    process.exit(1);
  }
}

addRemarkColumn();
