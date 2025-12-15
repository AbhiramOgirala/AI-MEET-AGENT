# Deployment Guide for AI-Meet

## Prerequisites

### 1. Required External Services

| Service | Purpose | Free Tier | Setup Link |
|---------|---------|-----------|------------|
| MongoDB Atlas | Database | 512MB free | [mongodb.com/atlas](https://mongodb.com/atlas) |
| Redis Cloud | Queues/Cache | 30MB free | [redis.com/cloud](https://redis.com/cloud) |
| Google Gemini | AI Minutes | Free tier | [aistudio.google.com](https://aistudio.google.com) |
| TURN Server | Video calls | 50GB/mo free | [metered.ca](https://metered.ca) |
| Email (SMTP) | Notifications | Free | Gmail App Password |

### 2. Get Your API Keys

#### MongoDB Atlas
1. Create account → Create cluster (M0 Free)
2. Database Access → Add user with password
3. Network Access → Add `0.0.0.0/0` (allow all)
4. Connect → Get connection string

#### Redis Cloud
1. Create account → New subscription (Free)
2. Create database → Copy endpoint, port, password

#### Gemini API
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Get API Key → Copy key

#### TURN Server (Metered.ca)
1. Create account at [metered.ca](https://metered.ca)
2. Create TURN app → Copy credentials

#### Gmail App Password
1. Enable 2FA on Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate app password for "Mail"

---

## Deployment Options

### Option A: Railway (Easiest - Recommended for Hackathon)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Add services: Backend, Frontend
5. Add environment variables from `.env.production.example`
6. Deploy!

### Option B: Render

**Backend:**
1. New Web Service → Connect repo
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Add environment variables

**Frontend:**
1. New Static Site → Connect repo
2. Build Command: `npm run build`
3. Publish Directory: `build`

### Option C: Docker (VPS/Cloud)

```bash
# Clone and configure
git clone <your-repo>
cd ai-meet

# Create production env files
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env

# Edit with your credentials
nano backend/.env

# Deploy
docker-compose up -d
```

### Option D: Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
```bash
cd frontend
npm i -g vercel
vercel
```

**Backend on Railway:**
- Deploy backend folder separately

---

## Environment Variables Checklist

### Backend (.env)
```env
# ✅ Required
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<64-char-random-string>
CLIENT_URL=https://your-frontend.com
GEMINI_API_KEY=<your-key>
REDIS_HOST=<redis-host>
REDIS_PORT=<port>
REDIS_PASSWORD=<password>

# ✅ Required for video calls
TURN_SERVER_URL=turn:global.relay.metered.ca:443
TURN_USERNAME=<metered-username>
TURN_CREDENTIAL=<metered-credential>

# ⚠️ Optional (emails won't work without)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your-email>
EMAIL_PASS=<app-password>
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-backend.com/api
REACT_APP_SOCKET_URL=https://your-backend.com
```

---

## Post-Deployment Checklist

- [ ] Test user registration/login
- [ ] Test creating a meeting
- [ ] Test video call between 2 devices (use phone + laptop)
- [ ] Test screen sharing
- [ ] Test chat functionality
- [ ] Test meeting minutes generation
- [ ] Test email delivery

---

## Troubleshooting

### Video calls not connecting
- TURN server not configured (most common)
- Check browser console for ICE connection errors

### MongoDB connection failed
- Check IP whitelist in Atlas (add 0.0.0.0/0)
- Verify connection string format

### Emails not sending
- Gmail: Use App Password, not regular password
- Check EMAIL_USER and EMAIL_PASS are set

### AI minutes not generating
- Verify GEMINI_API_KEY is valid
- Check API quota at Google AI Studio
