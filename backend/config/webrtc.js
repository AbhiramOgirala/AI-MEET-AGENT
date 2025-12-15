// WebRTC ICE Server Configuration
// TURN servers are REQUIRED for production - without them, ~30% of users can't connect

const iceServers = [
  // Free STUN servers (for basic connectivity)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // TURN server (REQUIRED for production)
  // Sign up at metered.ca, twilio.com, or xirsys.com
  ...(process.env.TURN_SERVER_URL ? [{
    urls: process.env.TURN_SERVER_URL,
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_CREDENTIAL
  }] : [])
];

module.exports = { iceServers };
