import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import sirv from "sirv";
import { spawn } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  app.use(compression());

  // Start Python Backend (skip if PM2 manages it separately)
  if (process.env.PM2_MANAGED === 'true') {
    console.log("ℹ️ PM2_MANAGED=true — skipping Python backend spawn (PM2 handles it)");
  } else {
    console.log("🚀 Installing Python Dependencies...");

  let pythonExec = "python3";
  const venvPythonPath = path.join(__dirname, "venv", "bin", "python");
  if (fs.existsSync(venvPythonPath)) {
    pythonExec = venvPythonPath;
    console.log(`✅ Virtual environment detected at ${venvPythonPath}`);
  } else {
    console.log(`ℹ️ No venv found. Using system ${pythonExec}`);
  }

  const pipCmd = pythonExec === "python3" 
    ? ["-m", "pip", "install", "-r", path.join(__dirname, "backend", "requirements.txt"), "--break-system-packages"] 
    : ["-m", "pip", "install", "-r", path.join(__dirname, "backend", "requirements.txt")];

  const installProc = spawn(pythonExec, pipCmd, { stdio: "inherit" });
  
  let pythonProcess: any = null;

  installProc.on("close", (code) => {
    if (code !== 0) {
      console.error(`❌ pip install exited with code ${code}. Python backend might fail.`);
    }
    const startBackend = (cmd: string) => {
      const backendPath = path.join(__dirname, "backend", "main.py");
      console.log(`Trying to start backend with ${cmd} at ${backendPath}`);
      const proc = spawn(cmd, [backendPath], {
        stdio: "inherit",
        env: { ...process.env, PYTHONPATH: path.join(__dirname, "backend"), GOOGLE_CLOUD_PROJECT: "myanaichat" }
      });

      proc.on("error", (err: any) => {
        if (err.code === 'ENOENT') {
          console.warn(`⚠️ ${cmd} not found.`);
          if (cmd === pythonExec && pythonExec !== 'python') {
             startBackend('python');
          } else {
             console.error("❌ Python not found in environment. Backend will not work.");
          }
        } else {
          console.error(`❌ Failed to start Python backend with ${cmd}:`, err);
        }
      });
      return proc;
    };
    
    pythonProcess = startBackend(pythonExec);
  });

  // Ensure Python process is killed when Node process exits
  process.on("exit", () => {
    console.log("Stopping Python backend...");
    if (pythonProcess) pythonProcess.kill();
  });
  process.on("SIGINT", () => {
    if (pythonProcess) pythonProcess.kill();
    process.exit();
  });
  process.on("SIGTERM", () => {
    if (pythonProcess) pythonProcess.kill();
    process.exit();
  });
  } // end of PM2_MANAGED else block

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = process.env.PORT || 8000;
  const listenPort = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

  // Global Request logging middleware
  app.use((req, res, next) => {
    if (req.url.includes('webhook')) {
      console.log(`📡 WEBHOOK CALL: ${req.method} ${req.url}`);
    }
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.url.includes('webhook') || req.url.startsWith('/api') || req.url === '/') {
         console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    socket.on("join_room", (room) => {
      socket.join(room);
    });
    socket.on("send_message", (data) => {
      io.to(data.room).emit("receive_message", data);
    });
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy to Python Backend
  const { createProxyMiddleware } = await import("http-proxy-middleware");
  const proxyTarget = "http://127.0.0.1:3001";
  
  const backendProxy = createProxyMiddleware({
    target: proxyTarget,
    changeOrigin: true,
    xfwd: true,
    timeout: 30000,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        if (req.url?.includes('webhook') || req.url?.includes('api')) {
          console.log(`➡️ [Proxy -> Backend]: ${req.method} ${req.url}`);
        }
      },
      error: (err, req, res) => {
        console.error(`❌ [Proxy Error] ${req.url}:`, err.message);
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
          res.status(502).json({ 
            error: "Backend Offline", 
            message: "FastAPI Backend is not reachable on 3001",
            details: err.message
          });
        }
      }
    }
  });

  // Mounting proxy
  app.use((req, res, next) => {
    const p = req.path;
    if (p.startsWith('/webhook') || p.startsWith('/api') || p === '/openapi.json' || p === '/docs') {
      return backendProxy(req, res, next);
    }
    next();
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode...");
    const distPath = path.join(__dirname, "dist");
    app.use(sirv(distPath, { dev: false, single: true }));
  }

  httpServer.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`❌ Port ${listenPort} is busy. Attempting to exit gracefully.`);
      process.exit(1);
    }
  });

  httpServer.listen(listenPort, "0.0.0.0", () => {
    console.log(`✅ Server successfully started on http://0.0.0.0:${listenPort}`);
  });
}

startServer();
