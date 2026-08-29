import type { Collection, Db } from "mongodb";

import type {
  RecoveryActionType,
  SimulationOutcome,
} from "../simulator/types";


import type { TransactionDocument } from "./transactions";

export class TransactionRepository {
  private readonly collection: Collection<TransactionDocument>;

  constructor(db: Db) {
    this.collection = db.collection<TransactionDocument>("transactions");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { transactionId: 1 },
      { unique: true, name: "transactionId_unique" },
    );

    await this.collection.createIndex(
      { customerId: 1 },
      { name: "customerId_index" },
    );

    await this.collection.createIndex(
      { merchantId: 1 },
      { name: "merchantId_index" },
    );

    await this.collection.createIndex(
      { failureType: 1 },
      { name: "failureType_index" },
    );
  }

  async count(): Promise<number> {
    return this.collection.countDocuments();
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionDocument | null> {
    return this.collection.findOne({ transactionId });
  }

     async applyRecoveryResult(
    transactionId: string,
    action: RecoveryActionType,
    outcome: SimulationOutcome,
  ): Promise<TransactionDocument | null> {
    const isPaymentAction =
      action === "RETRY_PAYMENT" || action === "WAIT_AND_RETRY";

    const filter = {
      transactionId,
      ...(isPaymentAction
        ? {
            priorActions: {
              $not: {
                $elemMatch: {
                  $in: ["RETRY_PAYMENT", "WAIT_AND_RETRY"],
                },
              },
            },
          }
        : {
            priorActions: {
              $not: {
                $elemMatch: {
                  $eq: action,
                },
              },
            },
          }),
    };

    const update = {
      $push: {
        priorActions: action,
      },
      $set: {
        updatedAt: new Date(),
        ...(outcome === "success"
          ? { status: "captured" as const }
          : {}),
      },
      ...(isPaymentAction ? { $inc: { retryCount: 1 } } : {}),
    };

    return this.collection.findOneAndUpdate(filter, update, {
      returnDocument: "after",
    });
  }

  async insertMany(
    transactions: TransactionDocument[],
  ): Promise<void> {
    if (transactions.length === 0) {
      return;
    }

    await this.collection.insertMany(transactions, {
      ordered: true,
    });
  }

  async deleteAll(): Promise<void> {
    await this.collection.deleteMany({});
  }
}