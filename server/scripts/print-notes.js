require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const { sequelize } = require("../config/database");

async function main() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(
      `SELECT id, name, phone, LEFT(agent_notes, 200) AS preview, LENGTH(agent_notes) AS len
       FROM contacts
       WHERE agent_notes IS NOT NULL AND TRIM(agent_notes) <> ''
       ORDER BY updatedAt DESC
       LIMIT 20`
    );
    if (!rows.length) {
      console.log("No notes found in database.");
    } else {
      console.log(`Found ${rows.length} contacts with notes:`);
      rows.forEach((r) => {
        console.log(
          `- #${r.id} ${r.name} (${r.phone}) len=${r.len} preview="${r.preview}"`
        );
      });
    }
  } catch (err) {
    console.error("Error reading notes:", err.message);
  } finally {
    await sequelize.close();
  }
}

main();
