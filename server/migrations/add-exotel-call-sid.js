const { sequelize } = require("../config/database");

/**
 * Migration script to add exotel_call_sid column to call_logs table
 * Run with: node migrations/add-exotel-call-sid.js
 */

async function addExotelCallSidColumn() {
  try {
    console.log("🔄 Adding exotel_call_sid column to call_logs table...");

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'call_logs' 
      AND COLUMN_NAME = 'exotel_call_sid'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length > 0) {
      console.log(
        "✅ Column exotel_call_sid already exists in call_logs table"
      );
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE call_logs 
      ADD COLUMN exotel_call_sid VARCHAR(255) NULL 
      COMMENT 'Exotel Call SID for tracking'
    `);

    console.log(
      "✅ Successfully added exotel_call_sid column to call_logs table"
    );

    // Verify the column was added
    const [verifyResults] = await sequelize.query(`
      DESCRIBE call_logs
    `);

    const exotelColumn = verifyResults.find(
      (col) => col.Field === "exotel_call_sid"
    );
    if (exotelColumn) {
      console.log("✅ Column verification successful:");
      console.log(`   Field: ${exotelColumn.Field}`);
      console.log(`   Type: ${exotelColumn.Type}`);
      console.log(`   Null: ${exotelColumn.Null}`);
      console.log(`   Comment: ${exotelColumn.Comment || "None"}`);
    } else {
      console.log("❌ Column verification failed - exotel_call_sid not found");
    }
  } catch (error) {
    console.error("❌ Error adding exotel_call_sid column:", error.message);
    throw error;
  }
}

// Run the migration
addExotelCallSidColumn()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
