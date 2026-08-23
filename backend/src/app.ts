import express from "express";

export const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "revive-ai-api",
  });
});
