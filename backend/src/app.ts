import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { registerMongoHealthRoute } from "./db/health-route";
import { registerTransactionRoutes } from "./db/transaction-route";
import { registerRecoveryRoutes } from "./recovery/recovery-route";
import { registerSimulatorDevRoutes } from "./simulator/dev-routes";
import { registerAIRoutes } from "./ai/ai-routes";

export const app = express();

// Configure CORS for local development and Vercel production deployments
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());

// Seamless prefix normalization for both /api/* (Vercel routed) and direct /* (local dev) requests
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  } else if (req.url === "/api") {
    req.url = "/";
  }
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "revive-ai-api",
  });
});

registerSimulatorDevRoutes(app);
registerTransactionRoutes(app);
registerRecoveryRoutes(app);
registerMongoHealthRoute(app);
registerAIRoutes(app);
