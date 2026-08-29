import type { Express } from "express";

import { getMongoClient } from "../db/mongo";
import { TransactionRepository } from "../db/transaction-repository";
import type { RecoveryActionType } from "../simulator/types";
import { RecoveryService } from "./recovery-service";
import { getRecoveryDecision } from "./decision-service";

const VALID_ACTIONS: ReadonlySet<RecoveryActionType> = new Set([
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "REQUEST_PAYMENT_METHOD_UPDATE",
  "DO_NOTHING",
  "ESCALATE",
]);

export function registerRecoveryRoutes(app: Express): void {
  app.get("/recovery/:transactionId/decision", async (req, res) => {
    try {
      const { transactionId } = req.params;

      const decision = await getRecoveryDecision(transactionId);

      res.status(200).json(decision);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "Transaction not found"
      ) {
        res.status(404).json({
          error: "Transaction not found.",
        });
        return;
      }

      console.error("Recovery decision failed:", error);

      res.status(500).json({
        error: "Recovery decision failed.",
      });
    }
  });

  app.post("/recovery/:transactionId", async (req, res) => {
    try {
      const { transactionId } = req.params;
      const requestedAction = req.body?.action;

      if (
        typeof requestedAction !== "string" ||
        !VALID_ACTIONS.has(requestedAction as RecoveryActionType)
      ) {
        res.status(400).json({
          error: "Invalid recovery action.",
        });
        return;
      }

      const mongoClient = await getMongoClient();
      const dbName = process.env.DB_NAME;

      if (!dbName) {
        res.status(500).json({
          error: "MongoDB is not configured.",
        });
        return;
      }

      const repository = new TransactionRepository(
        mongoClient.db(dbName),
      );

      await repository.ensureIndexes();

      const service = new RecoveryService(repository);

      const result = await service.recover(
        transactionId,
        requestedAction as RecoveryActionType,
      );

      res.status(200).json(result);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "Transaction not found"
      ) {
        res.status(404).json({
          error: "Transaction not found.",
        });
        return;
      }

      console.error("Recovery request failed:", error);

      res.status(500).json({
        error: "Recovery request failed.",
      });
    }
  });
}
