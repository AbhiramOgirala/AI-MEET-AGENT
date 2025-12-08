const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-meet')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/recordings', require('./routes/recordings'));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join meeting room
  socket.on('join-meeting', (meetingId) => {
    socket.join(meetingId);
    socket.to(meetingId).emit('user-joined', socket.id);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.meetingId).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.meetingId).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.meetingId).emit('ice-candidate', data);
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

  // Chat messages
  socket.on('chat-message', (data) => {
    socket.to(data.meetingId).emit('chat-message', data);
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
    socket.to(data.meetingId).emit('hand-raised', data);
  });

  // Reactions
  socket.on('reaction', (data) => {
    socket.to(data.meetingId).emit('reaction', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
