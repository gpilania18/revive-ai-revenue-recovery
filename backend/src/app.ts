import express from "express";
import { registerMongoHealthRoute } from "./db/health-route";
import { registerSimulatorDevRoutes } from "./simulator/dev-routes";

export const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "revive-ai-api",
  });
});

registerSimulatorDevRoutes(app);
registerMongoHealthRoute(app);
