const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Initialize services
const queueService = require('./services/queueService');
const cacheService = require('./services/cacheService');

const app = express();

// Trust proxy for Railway/Vercel deployment (required for rate limiting)
app.set('trust proxy', 1);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased for testing)
});
app.use(limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-meet')
.then(async () => {
  console.log('Connected to MongoDB');
  // Initialize Redis services after DB connection
  await queueService.initialize();
  cacheService.initialize();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRouter = require('./routes/auth');
const meetingsRouter = require('./routes/meetings');
const usersRouter = require('./routes/users');
const { router: chatRouter, setSocketIO } = require('./routes/chat');
const recordingsRouter = require('./routes/recordings');
const meetingMinutesRouter = require('./routes/meetingMinutes');

// Set up socket.io for chat routes
setSocketIO(io);

// Health check endpoint (required for deployment platforms)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/recordings', recordingsRouter);
app.use('/api/meeting-minutes', meetingMinutesRouter);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join meeting room
  socket.on('join-meeting', async (meetingId) => {
    socket.join(meetingId);
    socket.meetingId = meetingId;
    
    // Track online user in Redis
    if (socket.userId) {
      await cacheService.addOnlineUser(meetingId, socket.userId, {
        socketId: socket.id
      });
      
      // Get user info for notification
      try {
        const User = require('./models/User');
        const user = await User.findById(socket.userId).select('username avatar');
        
        // Notify others with user info - include both socketId and odId for WebRTC
        socket.to(meetingId).emit('user-joined', {
          socketId: socket.id,
          odId: socket.userId,
          username: user?.username || 'Someone'
        });
        
        console.log(`User ${user?.username} (${socket.userId}) joined meeting ${meetingId}`);
        
        // Send existing participants to the new user so they can initiate connections
        const room = io.sockets.adapter.rooms.get(meetingId);
        if (room) {
          const existingUsers = [];
          for (const socketId of room) {
            if (socketId !== socket.id) {
              const existingSocket = io.sockets.sockets.get(socketId);
              if (existingSocket && existingSocket.userId) {
                const existingUser = await User.findById(existingSocket.userId).select('username');
                existingUsers.push({
                  socketId: existingSocket.id,
                  odId: existingSocket.userId,
                  username: existingUser?.username || 'Unknown'
                });
              }
            }
          }
          if (existingUsers.length > 0) {
            socket.emit('existing-participants', existingUsers);
          }
        }
      } catch (err) {
        socket.to(meetingId).emit('user-joined', {
          socketId: socket.id,
          odId: socket.userId
        });
      }
    } else {
      socket.to(meetingId).emit('user-joined', {
        socketId: socket.id,
        odId: socket.id
      });
    }
  });

  // WebRTC signaling - route to specific user
  socket.on('offer', (data) => {
    // Send offer to specific user if 'to' is specified, otherwise broadcast
    if (data.to) {
      // Find the socket of the target user
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        s => s.userId === data.to || s.id === data.to
      );
      if (targetSocket) {
        targetSocket.emit('offer', { ...data, from: socket.userId || socket.id });
      }
    } else {
      socket.to(data.meetingId).emit('offer', { ...data, from: socket.userId || socket.id });
    }
  });

  socket.on('answer', (data) => {
    // Send answer to specific user
    if (data.to) {
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        s => s.userId === data.to || s.id === data.to
      );
      if (targetSocket) {
        targetSocket.emit('answer', { ...data, from: socket.userId || socket.id });
      }
    } else {
      socket.to(data.meetingId).emit('answer', { ...data, from: socket.userId || socket.id });
    }
  });

  socket.on('ice-candidate', (data) => {
    // Send ICE candidate to specific user
    if (data.to) {
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        s => s.userId === data.to || s.id === data.to
      );
      if (targetSocket) {
        targetSocket.emit('ice-candidate', { ...data, from: socket.userId || socket.id });
      }
    } else {
      socket.to(data.meetingId).emit('ice-candidate', { ...data, from: socket.userId || socket.id });
    }
  });

  // Meeting controls
  socket.on('toggle-audio', (data) => {
    socket.to(data.meetingId).emit('audio-toggled', data);
  });

  socket.on('toggle-video', (data) => {
    socket.to(data.meetingId).emit('video-toggled', data);
  });

  socket.on('screen-share', (data) => {
    socket.to(data.meetingId).emit('screen-share', data);
  });

  // Host controls
  socket.on('mute-participant', (data) => {
    socket.to(data.participantId).emit('muted-by-host', data);
  });

  socket.on('remove-participant', (data) => {
    socket.to(data.participantId).emit('removed-from-meeting', data);
  });

  // Raise hand
  socket.on('raise-hand', (data) => {
    console.log('Hand raised event received:', data);
    // Broadcast to all others in the meeting with consistent field names
    socket.to(data.meetingId).emit('hand-raised', {
      ...data,
      odId: data.odId || data.userId || socket.userId,
      username: data.username
    });
  });

  // Reactions
  socket.on('reaction', (data) => {
    socket.to(data.meetingId).emit('reaction', data);
  });

  // Chat message via socket (real-time)
  socket.on('chat-message', async (data) => {
    console.log('Chat message received from socket:', socket.id, 'userId:', socket.userId);
    console.log('Chat message data:', data);
    const { meetingId, message } = data;
    
    if (!meetingId || !message) {
      console.log('Invalid chat message - missing meetingId or message');
      return;
    }
    
    try {
      const Meeting = require('./models/Meeting');
      const User = require('./models/User');
      
      // Get sender info
      const sender = await User.findById(socket.userId).select('username avatar');
      console.log('Sender info:', sender?.username);
      
      const chatMessage = {
        sender: {
          _id: socket.userId,
          username: sender?.username || 'Unknown',
          avatar: sender?.avatar || ''
        },
        message,
        type: 'text',
        timestamp: new Date()
      };
      
      // Save to database
      await Meeting.findOneAndUpdate(
        { meetingId },
        { 
          $push: { chat: { sender: socket.userId, message, type: 'text', timestamp: new Date() } },
          $inc: { 'statistics.chatMessages': 1 }
        }
      );
      
      // Broadcast to all in meeting (including sender for confirmation)
      console.log('Broadcasting chat message to room:', meetingId);
      io.to(meetingId).emit('chat-message', chatMessage);
      console.log('Chat message broadcast complete');
    } catch (error) {
      console.error('Chat message error:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, 'userId:', socket.userId);
    if (socket.meetingId) {
      // Send userId for proper cleanup on frontend
      socket.to(socket.meetingId).emit('user-left', {
        socketId: socket.id,
        odId: socket.userId || socket.id
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await queueService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
