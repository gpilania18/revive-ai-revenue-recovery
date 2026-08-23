import type { Collection, Db } from "mongodb";

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