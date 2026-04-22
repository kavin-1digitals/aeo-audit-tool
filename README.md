# AEO Audit Tool

## Local Development

### Prerequisites
- Node.js 16+
- Python 3.8+
- Git

### Quick Start

#### 1. Clone & Setup
```bash
git clone <repository-url>
cd aeo-audit-tool
```

#### 2. Backend Setup
```bash
cd server
python -m venv .venv
source .venv/bin/activate  # Linux/MacOS
# .venv\scripts\activate   # Windows
pip install -r requirements.txt
python -m src.main
```

#### 3. Frontend Setup
```bash
cd client
npm install
npm start
```

#### 4. Access Application
- **Local**: http://localhost:3000/aeo-audit-tool

### Production Deployment

#### Option 1: Proxy Server
```bash
# Build frontend
cd client && npm run build

# Start proxy server
cd proxy && npm start
```

#### Option 2: Ngrok Tunnel
```bash
# Start ngrok tunnel
ngrok http 3001
```

#### Access
- **With Proxy**: http://localhost:3001/aeo-audit-tool
- **Ngrok**: <ngrok-url>/aeo-audit-tool


## Demostore

### Setup
- Remove the REACT_APP_API_URL from .env file in the client folder

### Backend
```bash
cd server
python -m venv .venv
source .venv/bin/activate  # Linux/MacOS
# .venv\scripts\activate   # Windows
pip install -r requirements.txt
python -m src.main
```

### Frontend
```bash
cd client
npm run build
```

- Copy the build folder to the Demostore's AI-Auditor folder and rename it to dist

### Access
https://wff.demo.botstore.in/aeo-audit-tool/