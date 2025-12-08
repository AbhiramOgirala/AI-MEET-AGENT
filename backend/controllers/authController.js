const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authController = {
  // Register new user
  async register(req, res) {
    try {
      const { username, email, password, profile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or username already exists'
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        profile: profile || {}
      });

      await user.save();

      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toPublicJSON(),
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toPublicJSON(),
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Join as guest
  async joinAsGuest(req, res) {
    try {
      const { username } = req.body;

      if (!username || username.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long'
        });
      }

      // Create guest user
      const guestUser = new User({
        username: `${username}-${uuidv4().slice(0, 8)}`,
        email: `guest-${uuidv4()}@guest.local`,
        isGuest: true,
        profile: {
          firstName: username
        }
      });

      await guestUser.save();

      const token = generateToken(guestUser._id);

      res.status(201).json({
        success: true,
        message: 'Joined as guest successfully',
        data: {
          user: guestUser.toPublicJSON(),
          token
        }
      });
    } catch (error) {
      console.error('Guest join error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toPublicJSON()
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { profile, preferences } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (profile) {
        user.profile = { ...user.profile, ...profile };
      }

      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
      }

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toPublicJSON()
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Logout user
  async logout(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (user) {
        user.lastSeen = new Date();
        await user.save();
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

module.exports = authController;
