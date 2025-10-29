const { sequelize } = require("../config/database");

async function addPriceColumn() {
  try {
    console.log("Adding price column to contacts table...");

    await sequelize.query(`
      ALTER TABLE contacts 
      ADD COLUMN price VARCHAR(100) NULL 
      AFTER product_name
    `);

    console.log("✅ price column added successfully");

    // Update existing records to extract price from agent_notes
    console.log("Updating existing records with price information...");

    await sequelize.query(`
      UPDATE contacts 
      SET price = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(agent_notes, 'Value: ₹', -1), ',', 1))
      WHERE agent_notes LIKE '%Value: ₹%' 
      AND price IS NULL
    `);

    console.log("✅ Existing records updated with price information");
  } catch (error) {
    console.error("❌ Error adding price column:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addPriceColumn()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = addPriceColumn;
