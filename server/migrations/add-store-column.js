const { sequelize } = require("../config/database");

async function addStoreColumn() {
  try {
    console.log("🔄 Adding 'store' column to contacts table...");

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM contacts LIKE 'store'"
    );

    if (columns.length === 0) {
      // Add the store column
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN store VARCHAR(255) NULL"
      );
      console.log("✅ Added 'store' column to contacts table");
    } else {
      console.log("⚠️  'store' column already exists in contacts table");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'store' column:", error);
    process.exit(1);
  }
}

addStoreColumn();
