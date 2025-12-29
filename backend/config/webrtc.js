// WebRTC ICE Server Configuration
// TURN servers are REQUIRED for production - without them, ~30% of users can't connect

const iceServers = [
  // Free STUN servers (for basic connectivity)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // TURN server (REQUIRED for production)
  // Sign up at metered.ca, twilio.com, or xirsys.com
  ...(process.env.TURN_SERVER_URL ? [
    // TCP on port 80 (fallback for restrictive firewalls)
    {
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    },
    // Add TURN over TLS on port 443 for better firewall traversal
    {
      urls: process.env.TURN_SERVER_URL.replace(':80', ':443').replace('turn:', 'turns:'),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    },
    // Add TURN TCP as additional fallback
    {
      urls: process.env.TURN_SERVER_URL.replace('turn:', 'turn:') + '?transport=tcp',
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    }
  ] : [])
];

module.exports = { iceServers };
