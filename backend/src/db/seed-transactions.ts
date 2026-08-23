import { getMongoClient } from "./mongo";
import { TransactionRepository } from "./transaction-repository";
import type { TransactionDocument } from "./transactions";
import { generateDataset } from "../simulator/generate-dataset";
import type { Transaction } from "../simulator/types";

const DEFAULT_SEED = 42;

function toDocument(
  transaction: Transaction,
  seed: number,
): TransactionDocument {
  const now = new Date();

  return {
    transactionId: transaction.id,
    customerId: transaction.customerId,
    merchantId: transaction.merchantId,

    amountPaise: transaction.amountPaise,
    currency: transaction.currency,

    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    failureType: transaction.failureType,

    retryCount: transaction.retryCount,
    maxRetries: transaction.maxRetries,
    priorActions: [],

    customer: transaction.customer,

    createdAt: new Date(transaction.createdAt),
    lastAttemptAt: new Date(transaction.lastAttemptAt),
    updatedAt: now,

    source: "SIMULATOR",
    seed,
  };
}

export async function seedTransactions(
  seed = DEFAULT_SEED,
): Promise<{ inserted: number; total: number }> {
  const client = await getMongoClient();

  const dbName = process.env.DB_NAME;

  if (!dbName) {
    throw new Error("MongoDB is not configured");
  }

  const repository = new TransactionRepository(client.db(dbName));

  await repository.ensureIndexes();

  const existing = await repository.count();

  if (existing > 0) {
    return {
      inserted: 0,
      total: existing,
    };
  }

  const dataset = generateDataset(seed);

  const documents = dataset.map((transaction) =>
    toDocument(transaction, seed),
  );

  await repository.insertMany(documents);

  return {
    inserted: documents.length,
    total: await repository.count(),
  };
}

if (process.argv[1]?.endsWith("seed-transactions.ts")) {
  seedTransactions()
    .then((result) => {
      console.log(
        `Seed complete: inserted=${result.inserted}, total=${result.total}`,
      );
    })
    .catch((error: unknown) => {
      console.error("Seed failed:", error);
      process.exitCode = 1;
    });
}