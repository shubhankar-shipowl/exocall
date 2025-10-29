/*
  Cleanup script to gracefully close database connections and clear app caches.
  Run with: node server/scripts/cleanup.js
*/

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/database");

async function safeRm(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      console.log(`Deleted: ${targetPath}`);
    }
  } catch (err) {
    console.warn(`Skip delete (no-op) for ${targetPath}: ${err.message}`);
  }
}

async function main() {
  try {
    // Close Sequelize pool gracefully
    console.log("Closing Sequelize connections...");
    await sequelize.close();
    console.log("✅ Sequelize connections closed.");

    // Clear common caches
    const repoRoot = path.resolve(__dirname, "../../");
    const targets = [
      path.join(repoRoot, "node_modules/.cache"),
      path.join(repoRoot, "client/.vite"),
      path.join(repoRoot, "client/node_modules/.vite"),
      path.join(repoRoot, "client/node_modules/.cache"),
      path.join(repoRoot, "server/node_modules/.cache"),
      path.join(repoRoot, "client/dist"),
      path.join(repoRoot, "temp"),
    ];

    console.log("Deleting caches/build artifacts...");
    for (const t of targets) {
      // Best-effort deletion; ignore failures
      await safeRm(t);
    }

    console.log("✅ Cache cleanup complete.");
  } catch (err) {
    console.error("Cleanup error:", err);
    process.exitCode = 1;
  }
}

main();
