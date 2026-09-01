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

app.use(cors({
  origin: "http://localhost:3000",
}));

app.use(express.json());
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
