import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { verifyMongoConnection } from "./db/mongo";

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Revive AI API listening on port ${port}`);
  const hasKey = Boolean(process.env.AI_PROVIDER_API_KEY && process.env.AI_PROVIDER_API_KEY.trim().length > 0);
  console.log(`[AI] Configured: ${hasKey}`);
  console.log(`[AI] Model: ${process.env.AI_MODEL || "gpt-4o-mini"}`);
  console.log(`[AI] Base URL: ${process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1"}`);
});

void verifyMongoConnection()
  .then(() => {
    console.log("MongoDB connection successful");
  })
  .catch(() => {
    console.error("MongoDB connection failed");
  });
