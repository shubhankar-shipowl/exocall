const { sequelize } = require("../config/database");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Remove the unique constraint from the phone column
      await queryInterface.removeConstraint("contacts", "contacts_phone_key");
      console.log("✅ Removed unique constraint from phone column");
    } catch (error) {
      console.log(
        "ℹ️  Unique constraint may not exist or already removed:",
        error.message
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Add back the unique constraint to the phone column
      await queryInterface.addConstraint("contacts", {
        fields: ["phone"],
        type: "unique",
        name: "contacts_phone_key",
      });
      console.log("✅ Added unique constraint back to phone column");
    } catch (error) {
      console.log("❌ Error adding unique constraint:", error.message);
    }
  },
};
