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

      console.log('Login attempt for email:', email);

      // Find user by email
      const user = await User.findOne({ email, isActive: true });
      console.log('User found:', !!user);
      
      if (!user) {
        // Try finding user without isActive filter to check if user exists but is inactive
        const userWithoutFilter = await User.findOne({ email });
        console.log('User exists without isActive filter:', !!userWithoutFilter);
        if (userWithoutFilter) {
          console.log('User isActive status:', userWithoutFilter.isActive);
        }
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      let isPasswordValid = false;
      
      // Handle old users with short/invalid password hashes
      if (user.password && user.password.length < 30) {
        console.log('Detected old password format, attempting direct comparison');
        // For old users with improperly hashed passwords, try direct comparison first
        isPasswordValid = user.password === password;
        
        if (isPasswordValid) {
          console.log('Direct password comparison succeeded, rehashing password');
          // Rehash the password with proper bcrypt
          const bcrypt = require('bcryptjs');
          const salt = bcrypt.genSaltSync(12);
          user.password = bcrypt.hashSync(password, salt);
          await user.save();
          console.log('Password rehashed successfully');
        } else {
          console.log('Direct password comparison failed');
        }
      } else {
        // Normal bcrypt comparison for properly hashed passwords
        isPasswordValid = await user.comparePassword(password);
      }
      
      console.log('Password valid:', isPasswordValid);
      console.log('Stored password hash length:', user.password ? user.password.length : 'no password');
      console.log('Password field exists:', !!user.password);
      
      if (!isPasswordValid) {
        // For debugging: try to understand the password issue
        console.log('Password comparison failed for user:', user._id);
        console.log('User isGuest:', user.isGuest);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      const token = generateToken(user._id);

      console.log('Login successful for user:', user._id);

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
