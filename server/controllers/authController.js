const User = require("../models/User");
const { generateToken } = require("../middleware/auth");
const { Op } = require("sequelize");

// Simple rate limiting store (in production, use Redis)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Cleanup expired rate limit entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts.entries()) {
    if (now - attempts.lastAttempt > LOCKOUT_TIME) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password, role = "agent" } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["username", "email", "password"],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Validate username format (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-30 characters long and contain only letters, numbers, and underscores",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Validate role
    if (role && !["admin", "agent", "supervisor"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Must be 'admin', 'agent', or 'supervisor'",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists",
        field: existingUser.email === email ? "email" : "username",
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      role,
    });

    // Generate token
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Failed to register user",
      details: error.message,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP =
      req.ip ||
      req.connection?.remoteAddress ||
      (req.headers && req.headers["x-forwarded-for"]) ||
      "127.0.0.1";

    // Check rate limiting
    const attemptKey = `${email}-${clientIP}`;
    const attempts = loginAttempts.get(attemptKey) || {
      count: 0,
      lastAttempt: 0,
    };

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < LOCKOUT_TIME) {
        const remainingTime = Math.ceil(
          (LOCKOUT_TIME - timeSinceLastAttempt) / 60000
        );
        return res.status(429).json({
          error: "Too many login attempts",
          message: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
        });
      } else {
        // Reset attempts after lockout period
        loginAttempts.delete(attemptKey);
      }
    }

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Check password
    const isPasswordValid = await user.checkPassword(password);

    if (!isPasswordValid) {
      // Increment failed attempts
      attempts.count += 1;
      attempts.lastAttempt = Date.now();
      loginAttempts.set(attemptKey, attempts);

      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Clear failed attempts on successful login
    loginAttempts.delete(attemptKey);

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: "",
        lastName: "",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Handle database errors specifically
    if (error.name === "SequelizeDatabaseError") {
      return res.status(500).json({
        error: "Database error occurred",
        message: "Please contact support or try again later",
      });
    }

    res.status(500).json({
      error: "Failed to login",
      message: "An unexpected error occurred. Please try again.",
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Failed to get profile",
      details: error.message,
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: { email, id: { [Op.ne]: userId } },
      });

      if (existingUser) {
        return res.status(400).json({
          error: "Email already in use",
        });
      }
    }

    // Update user
    await user.update({
      first_name: firstName || user.first_name,
      last_name: lastName || user.last_name,
      email: email || user.email,
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      error: "Failed to update profile",
      details: error.message,
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.checkPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: "Current password is incorrect",
      });
    }

    // Update password
    await user.update({ password: newPassword });

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      error: "Failed to change password",
      details: error.message,
    });
  }
};

// Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      error: "Failed to get users",
      details: error.message,
    });
  }
};

// Update user status (admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        error: "isActive must be a boolean value",
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent admin from deactivating themselves
    if (user.id === req.user.id && !isActive) {
      return res.status(400).json({
        error: "Cannot deactivate your own account",
      });
    }

    await user.update({ isActive: isActive });

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      error: "Failed to update user status",
      details: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUsers,
  updateUserStatus,
};
