const { sequelize } = require("../config/database");

async function addAssignedToColumn() {
  try {
    console.log("🔄 Adding 'assigned_to' column to contacts table...");

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM contacts LIKE 'assigned_to'"
    );

    if (columns.length === 0) {
      // Add the assigned_to column (foreign key to users table)
      await sequelize.query(
        "ALTER TABLE contacts ADD COLUMN assigned_to INT NULL, ADD CONSTRAINT fk_contacts_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL"
      );
      console.log("✅ Added 'assigned_to' column to contacts table");
    } else {
      console.log("⚠️  'assigned_to' column already exists in contacts table");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding 'assigned_to' column:", error);
    process.exit(1);
  }
}

addAssignedToColumn();

