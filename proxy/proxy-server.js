import express from 'express';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const BACKEND_TARGET = process.env.BACKEND_URL || "http://localhost:3003";
const APP_CONTEXT = "/aeo-audit-tool";
const FRONTEND_DIR = path.join(__dirname, "../client/build");

const app = express();

// Verify frontend exists
if (!fs.existsSync(FRONTEND_DIR)) {
  console.error("❌ Frontend directory not found:", FRONTEND_DIR);
  console.log("💡 Please run 'npm run build' in the client directory first");
  process.exit(1);
}

// Middleware
app.use(express.json({ 
  limit: "10mb",
  strict: false,
  type: ['application/json', 'text/plain']
}));

// Add CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "aeo-audit-tool-proxy",
    timestamp: new Date().toISOString(),
  });
});

// Root redirect
app.get("/", (req, res) => {
  res.redirect(`${APP_CONTEXT}/`);
});

// API Proxy - Handle ALL /aeo-audit-tool/api/* requests
app.all(`${APP_CONTEXT}/api/*`, (req, res) => {
  const backendPath = req.originalUrl;
  const targetUrl = `${BACKEND_TARGET}${backendPath}`;
  
  console.log(`→ PROXY: ${req.method} ${req.originalUrl} → ${targetUrl}`);
  console.log('Request Headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);

  // Clean headers for forwarding
  const forwardedHeaders = { ...req.headers };
  delete forwardedHeaders.host;
  delete forwardedHeaders['content-length'];

  // Extract hostname from BACKEND_TARGET
  const backendUrl = new URL(BACKEND_TARGET);
  const options = {
    hostname: backendUrl.hostname,
    port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
    path: backendPath,
    method: req.method,
    headers: forwardedHeaders
  };

  const proxy = http.request(options, (proxyRes) => {
    console.log(`← BACKEND: ${req.originalUrl} ← ${proxyRes.statusCode}`);
    
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('❌ Proxy error:', err);
    res.status(502).json({ 
      error: 'Backend unavailable', 
      details: err.message 
    });
  });

  // Handle different content types properly
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('multipart/form-data')) {
    // For file uploads - stream raw request directly
    console.log('Streaming multipart request directly');
    req.pipe(proxy);
  } else if (contentType.includes('application/json')) {
    // For JSON requests - use parsed body
    console.log('Request Body:', req.body);
    if (req.body) {
      let bodyData;
      if (typeof req.body === 'object') {
        bodyData = JSON.stringify(req.body);
        proxy.setHeader('Content-Type', 'application/json');
      } else {
        bodyData = req.body.toString();
      }

      if (bodyData) {
        proxy.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxy.write(bodyData);
      }
    }
    proxy.end();
  } else if (req.body && Object.keys(req.body).length > 0) {
    // For form-encoded or other content types
    console.log('Request Body:', req.body);
    let bodyData = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body.toString();
    
    if (bodyData) {
      proxy.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxy.write(bodyData);
    }
    proxy.end();
  } else {
    // For empty bodies or other content types
    console.log('Empty body or unsupported content type, streaming directly');
    req.pipe(proxy);
  }
});

// Static assets - Serve specific paths first
app.use(`${APP_CONTEXT}/static`, express.static(path.join(FRONTEND_DIR, "static"), {
  maxAge: "1d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    console.log(`[ASSET] ${filePath}`);
  }
}));

// Serve index.html for SPA routes
app.get(`${APP_CONTEXT}/*`, (req, res, next) => {
  // Skip API requests (should be handled by proxy)
  if (req.path.startsWith('/api/')) return next();
  
  // Skip static files with extensions
  if (req.path.includes('.')) return next();
  
  const indexPath = path.join(FRONTEND_DIR, "index.html");
  console.log(`[SPA] Serving index.html for: ${req.originalUrl}`);
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Cannot serve index.html:", err);
      res.status(500).json({ error: "Frontend unavailable" });
    }
  });
});

// Fallback static serving for root files
app.use(APP_CONTEXT, express.static(FRONTEND_DIR, {
  index: "index.html",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/html; charset=UTF-8");
    }
    console.log(`[STATIC] ${filePath}`);
  }
}));

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.originalUrl} not available`,
    available: {
      frontend: `${APP_CONTEXT}/`,
      api: `${APP_CONTEXT}/api/`,
      health: "/health"
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚀 AEO Audit Tool Proxy Server");
  console.log(`Port: ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}${APP_CONTEXT}/`);
  console.log(`API: http://localhost:${PORT}${APP_CONTEXT}/api/`);
  console.log(`Backend: ${BACKEND_TARGET}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log("=================================");
  console.log("🌐 Ready for ngrok tunnel!");
  console.log(`   ngrok http ${PORT}`);
  console.log("=================================");
});
