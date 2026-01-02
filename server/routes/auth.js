const express = require("express");
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  updateUserStatus,
} = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.get("/me", authenticate, getProfile); // Alias for backward compatibility
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

// Admin only routes
router.get("/users", authenticate, authorize(["admin"]), getUsers);
router.put(
  "/users/:id/status",
  authenticate,
  authorize(["admin"]),
  updateUserStatus
);

module.exports = router;
