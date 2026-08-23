import type { Express } from "express";
import { verifyMongoConnection } from "./mongo";
import { publicMongoErrorMessage } from "./safe-error";

const SUCCESS_MESSAGE = "MongoDB connection successful";

export function registerMongoHealthRoute(app: Express): void {

  app.get("/health/mongodb", async (_req, res) => {
    try {
      await verifyMongoConnection();
      res.status(200).json({
        status: "ok",
        message: SUCCESS_MESSAGE,
      });
    } catch (error: unknown) {
      res.status(503).json({
        status: "error",
        message: publicMongoErrorMessage(error),
      });
    }
  });
}
