const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getUserStats,
} = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(["admin"]));

// User management routes
router.get("/", getUsers);
router.get("/stats", getUserStats);
router.get("/:id", getUserById);
router.put("/:id/role", updateUserRole);
router.delete("/:id", deleteUser);

module.exports = router;
