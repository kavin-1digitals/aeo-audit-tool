# AEO Audit Tool - Ngrok Deployment Setup

## 🚀 Quick Start for Ngrok Proxy

### Prerequisites
- Node.js 16+ installed
- Backend server running on port 8000
- Ngrok account (for custom subdomain)

### Setup Steps

1. **Install Dependencies**
```bash
# Install proxy server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

2. **Build Frontend**
```bash
npm run build-client
```

3. **Start Backend Server**
```bash
cd server
source .venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

4. **Start Proxy Server**
```bash
npm start
```

5. **Setup Ngrok**
```bash
# Install ngrok (if not already installed)
# Then run:
ngrok http 3001
```

## 📁 Project Structure

```
aeo-audit-tool/
├── client/                 # React frontend
│   ├── build/             # Built frontend files
│   ├── src/               # React source code
│   └── .env               # Environment variables
├── server/                # Python FastAPI backend
├── proxy-server.js        # Express proxy server
├── package.json          # Proxy server dependencies
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables
Create `.env` file in client directory:
```env
REACT_APP_API_URL=http://localhost:3001/aeo-audit-tool/api
REACT_APP_BASE_URL=/aeo-audit-tool/
PUBLIC_URL=/aeo-audit-tool/
```

### Proxy Server Configuration
- **Port**: 3001 (configurable via PORT env var)
- **Context**: `/aeo-audit-tool`
- **Backend Target**: `http://localhost:8000`
- **Frontend Target**: `client/build`

## 🌐 Ngrok Setup

### Basic Ngrok
```bash
ngrok http 3001
```

### Custom Domain (Recommended)
```bash
ngrok http 3001 --domain=your-custom-domain.ngrok.io
```

### Access URLs
Once ngrok is running:
- **Frontend**: `https://your-ngrok-url.ngrok.io/aeo-audit-tool/`
- **API**: `https://your-ngrok-url.ngrok.io/aeo-audit-tool/api/`
- **Health**: `https://your-ngrok-url.ngrok.io/health`

## 🔍 Features

### Proxy Server
- ✅ Handles API requests to backend
- ✅ Serves static frontend files
- ✅ Supports SPA routing
- ✅ CORS enabled
- ✅ Request logging
- ✅ Error handling

### Frontend
- ✅ Built with React 18
- ✅ Tailwind CSS styling
- ✅ Responsive design
- ✅ API integration with context path

### Backend Integration
- ✅ Forwards all `/aeo-audit-tool/api/*` requests
- ✅ Maintains request headers and body
- ✅ Handles different content types
- ✅ Proper error forwarding

## 🛠️ Development

### Development Mode
```bash
# Terminal 1 - Backend
cd server
source .venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Frontend (for development)
cd client
npm start

# Terminal 3 - Proxy (for testing)
npm start
```

### Production Build
```bash
# Build and start everything
npm run start-proxy
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### API Test
```bash
curl http://localhost:3001/aeo-audit-tool/api/audit
```

## 🔒 Security Notes

- Ngrok provides HTTPS automatically
- CORS is enabled for all origins
- Consider restricting CORS in production
- Backend should validate requests

## 🐛 Troubleshooting

### Frontend Not Loading
1. Check if frontend is built: `ls client/build/`
2. Verify proxy server is running on port 3001
3. Check browser console for errors

### API Not Working
1. Verify backend is running on port 8000
2. Check proxy server logs for forwarding errors
3. Test backend directly: `curl http://localhost:8000/aeo-audit-tool/api/audit`

### Ngrok Issues
1. Ensure ngrok is properly authenticated
2. Check ngrok dashboard for connection status
3. Verify port 3001 is accessible

## 📞 Support

For issues with:
- **Frontend**: Check React console errors
- **Backend**: Check Python server logs
- **Proxy**: Check proxy server logs
- **Ngrok**: Check ngrok dashboard

---

**1Digitals AI AUDITOR** - Complete AI Search Engine Readiness Platform
