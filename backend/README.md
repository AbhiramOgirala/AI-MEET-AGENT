# AI Meet Backend

A comprehensive video conferencing backend built with Node.js, Express, MongoDB, and Socket.io.

## Features

- **User Authentication**: Register, login, guest access
- **Meeting Management**: Create, join, leave meetings with comprehensive controls
- **Real-time Communication**: WebRTC signaling via Socket.io
- **Chat System**: Real-time messaging with file sharing
- **Recording Management**: Start/stop recordings and file uploads
- **Host Controls**: Mute/remove participants, manage permissions
- **Advanced Features**: Raise hand, reactions, breakout rooms support

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Multer** - File uploads
- **Helmet** - Security headers
- **Rate Limiting** - DDoS protection

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/ai-meet
JWT_SECRET=your-super-secret-jwt-key-here
PORT=5000
CLIENT_URL=http://localhost:3000
```

4. Start the server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/guest` - Join as guest
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout

### Meetings
- `POST /api/meetings` - Create meeting
- `GET /api/meetings/:meetingId` - Get meeting details
- `POST /api/meetings/:meetingId/join` - Join meeting
- `POST /api/meetings/:meetingId/leave` - Leave meeting
- `GET /api/meetings` - Get user meetings
- `PUT /api/meetings/:meetingId/settings` - Update settings (host only)
- `POST /api/meetings/:meetingId/end` - End meeting (host only)

### Chat
- `POST /api/chat/message` - Send message
- `POST /api/chat/upload` - Upload file
- `GET /api/chat/:meetingId` - Get chat history

### Recordings
- `POST /api/recordings/start` - Start recording
- `POST /api/recordings/stop` - Stop recording
- `POST /api/recordings/upload` - Upload recording file
- `GET /api/recordings/my-recordings` - Get user recordings

### Users
- `GET /api/users/profile` - Get user profile
- `GET /api/users/search` - Search users

## Socket.io Events

### Connection Events
- `join-meeting` - Join meeting room
- `disconnect` - User disconnected

### WebRTC Signaling
- `offer` - Send offer
- `answer` - Send answer
- `ice-candidate` - Send ICE candidate

### Meeting Controls
- `toggle-audio` - Toggle audio
- `toggle-video` - Toggle video
- `screen-share` - Screen sharing

### Chat & Interaction
- `chat-message` - Send chat message
- `raise-hand` - Raise hand
- `reaction` - Send reaction

### Host Controls
- `mute-participant` - Mute participant
- `remove-participant` - Remove participant

## Database Schema

### Users
- Authentication info
- Profile details
- Preferences
- Statistics

### Meetings
- Meeting details
- Participants list
- Settings
- Chat history
- Recording info

## Security Features

- JWT authentication
- Rate limiting
- Helmet security headers
- Input validation
- File type restrictions
- Permission-based access control

## Development

The server runs on port 5000 by default. Make sure MongoDB is running before starting the server.

For production deployment, ensure:
- Set strong JWT secrets
- Configure proper CORS origins
- Set up HTTPS
- Configure proper file storage
