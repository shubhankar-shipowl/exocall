const { sequelize } = require("../config/database");

async function addProductNameColumn() {
  try {
    console.log("Adding product_name column to contacts table...");

    await sequelize.query(`
      ALTER TABLE contacts 
      ADD COLUMN product_name VARCHAR(255) NULL 
      AFTER agent_notes
    `);

    console.log("✅ product_name column added successfully");

    // Update existing records to extract product name from agent_notes
    console.log("Updating existing records with product names...");

    await sequelize.query(`
      UPDATE contacts 
      SET product_name = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(agent_notes, 'Product: ', -1), ',', 1))
      WHERE agent_notes LIKE '%Product:%' 
      AND product_name IS NULL
    `);

    console.log("✅ Existing records updated with product names");
  } catch (error) {
    console.error("❌ Error adding product_name column:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addProductNameColumn()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = addProductNameColumn;
