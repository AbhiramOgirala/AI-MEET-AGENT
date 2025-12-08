const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Join as guest
router.post('/guest', authController.joinAsGuest);

// Get current user (protected)
router.get('/me', authenticateToken, authController.getCurrentUser);

// Update user profile (protected)
router.put('/profile', authenticateToken, authController.updateProfile);

// Logout user (protected)
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
