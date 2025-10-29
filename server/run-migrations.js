const addProductNameColumn = require("./migrations/add-product-name");
const addPriceColumn = require("./migrations/add-price-column");

async function runMigrations() {
  try {
    console.log("🔄 Starting database migrations...");

    // Check if columns already exist by trying to add them
    try {
      await addProductNameColumn();
    } catch (error) {
      if (error.message && error.message.includes("Duplicate column name")) {
        console.log("⚠️  product_name column already exists, skipping...");
      } else {
        throw error;
      }
    }

    try {
      await addPriceColumn();
    } catch (error) {
      if (error.message && error.message.includes("Duplicate column name")) {
        console.log("⚠️  price column already exists, skipping...");
      } else {
        throw error;
      }
    }

    console.log("✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("✅ Migrations completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migrations failed:", error);
      process.exit(1);
    });
}

module.exports = runMigrations;
