import type { Express } from "express";

import { getMongoClient } from "./mongo";
import { TransactionRepository } from "./transaction-repository";

function toPublicTransaction(transaction: Awaited<
  ReturnType<TransactionRepository["findByTransactionId"]>
>) {
  if (!transaction) {
    return null;
  }

  return {
    id: transaction.transactionId,
    merchantId: transaction.merchantId,
    customerId: transaction.customerId,
    amountPaise: transaction.amountPaise,
    currency: transaction.currency,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    failureType: transaction.failureType,
    retryCount: transaction.retryCount,
    maxRetries: transaction.maxRetries,
    priorActions: transaction.priorActions,
    createdAt: transaction.createdAt.toISOString(),
    lastAttemptAt: transaction.lastAttemptAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    customer: transaction.customer,
  };
}

export function registerTransactionRoutes(app: Express): void {
  app.get("/transactions/:transactionId", async (req, res) => {
    try {
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

      const transaction = await repository.findByTransactionId(
        req.params.transactionId,
      );

      if (!transaction) {
        res.status(404).json({
          error: "Transaction not found.",
        });
        return;
      }

      res.status(200).json({
        transaction: toPublicTransaction(transaction),
      });
    } catch (error: unknown) {
      console.error("Transaction lookup failed:", error);

      res.status(500).json({
        error: "Transaction lookup failed.",
      });
    }
  });
}