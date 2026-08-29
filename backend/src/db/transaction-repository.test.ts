import assert from "node:assert/strict";
import test from "node:test";

import type { Collection, Db } from "mongodb";

import type {
  RecoveryActionType,
  SimulationOutcome,
} from "../simulator/types";
import { TransactionRepository } from "./transaction-repository";
import type { TransactionDocument } from "./transactions";

function makeTransaction(
  overrides: Partial<TransactionDocument> = {},
): TransactionDocument {
  return {
    transactionId: "txn_test",
    customerId: "cust_test",
    merchantId: "merchant_test",
    amountPaise: 49_900,
    currency: "INR",
    paymentMethod: "CARD",
    status: "failed",
    failureType: "TEMPORARY_ISSUER_FAILURE",
    retryCount: 0,
    maxRetries: 3,
    priorActions: [],
    customer: {
      segment: "consumer",
      previousSuccessfulPayments: 5,
      previousFailedPayments: 1,
      lifetimeValuePaise: 249_500,
      previousRecoveryCount: 0,
      lastPaymentAt: "2026-07-31T00:00:00.000Z",
    },
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastAttemptAt: new Date("2026-08-01T00:01:00.000Z"),
    updatedAt: new Date("2026-08-01T00:01:00.000Z"),
    source: "SIMULATOR",
    seed: 42,
    ...overrides,
  };
}

function makeFakeCollection(
  initial: TransactionDocument[] = [],
) {
  const documents = [...initial];

  const indexes: Array<{
    keys: Record<string, unknown>;
    options: Record<string, unknown>;
  }> = [];

  const collection = {
    createIndex: async (
      keys: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      indexes.push({ keys, options });
      return String(indexes.length);
    },

    countDocuments: async () => documents.length,

    findOne: async (filter: { transactionId: string }) =>
      documents.find(
        (document) => document.transactionId === filter.transactionId,
      ) ?? null,

    insertMany: async (items: TransactionDocument[]) => {
      documents.push(...items);
      return {
        acknowledged: true,
        insertedCount: items.length,
      };
    },

    deleteMany: async () => {
      const deletedCount = documents.length;
      documents.length = 0;
      return {
        acknowledged: true,
        deletedCount,
      };
    },

    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      update: {
        $push?: { priorActions: RecoveryActionType };
        $set?: Partial<TransactionDocument>;
        $inc?: { retryCount: number };
      },
    ) => {
      const transactionId = filter.transactionId;

      const document = documents.find(
        (item) => item.transactionId === transactionId,
      );

      if (!document) {
        return null;
      }

      const priorActionsFilter = filter.priorActions as
        | {
            $not: {
              $elemMatch: {
                $in?: RecoveryActionType[];
                $eq?: RecoveryActionType;
              };
            };
          }
        | undefined;

      if (priorActionsFilter?.$not?.$elemMatch?.$in) {
        const alreadyUsed = document.priorActions.some((action) =>
          priorActionsFilter.$not.$elemMatch.$in?.includes(action),
        );

        if (alreadyUsed) {
          return null;
        }
      }

      if (priorActionsFilter?.$not?.$elemMatch?.$eq) {
        if (
          document.priorActions.includes(
            priorActionsFilter.$not.$elemMatch.$eq,
          )
        ) {
          return null;
        }
      }

      if (update.$push?.priorActions) {
        document.priorActions.push(update.$push.priorActions);
      }

      if (update.$inc?.retryCount) {
        document.retryCount += update.$inc.retryCount;
      }

      if (update.$set) {
        Object.assign(document, update.$set);
      }

      return { ...document };
    },
  } as unknown as Collection<TransactionDocument>;

  return {
    collection,
    documents,
    indexes,
  };
}

function makeDb(
  collection: Collection<TransactionDocument>,
): Db {
  return {
    collection: () => collection,
  } as unknown as Db;
}

test("repository counts stored transactions", async () => {
  const fake = makeFakeCollection([
    makeTransaction(),
    makeTransaction({ transactionId: "txn_002" }),
  ]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  assert.equal(await repository.count(), 2);
});

test("repository finds a transaction by ID", async () => {
  const transaction = makeTransaction();

  const fake = makeFakeCollection([transaction]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.findByTransactionId("txn_test");

  assert.equal(result?.transactionId, "txn_test");
});

test("repository returns null for an unknown transaction", async () => {
  const fake = makeFakeCollection();

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.findByTransactionId("missing_txn");

  assert.equal(result, null);
});

test("repository inserts transactions", async () => {
  const fake = makeFakeCollection();

  const repository = new TransactionRepository(makeDb(fake.collection));

  await repository.insertMany([
    makeTransaction(),
    makeTransaction({ transactionId: "txn_002" }),
  ]);

  assert.equal(await repository.count(), 2);
});

test("repository ignores empty insert batches", async () => {
  const fake = makeFakeCollection();

  const repository = new TransactionRepository(makeDb(fake.collection));

  await repository.insertMany([]);

  assert.equal(await repository.count(), 0);
});

test("repository records successful retry and captures transaction", async () => {
  const fake = makeFakeCollection([makeTransaction()]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.applyRecoveryResult(
    "txn_test",
    "RETRY_PAYMENT",
    "success",
  );

  assert.equal(result?.status, "captured");
  assert.equal(result?.retryCount, 1);
  assert.deepEqual(result?.priorActions, ["RETRY_PAYMENT"]);
});

test("repository prevents duplicate payment recovery actions", async () => {
  const fake = makeFakeCollection([
    makeTransaction({
      priorActions: ["RETRY_PAYMENT"],
    }),
  ]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.applyRecoveryResult(
    "txn_test",
    "RETRY_PAYMENT",
    "success",
  );

  assert.equal(result, null);
});

test("repository prevents duplicate non-payment actions", async () => {
  const fake = makeFakeCollection([
    makeTransaction({
      priorActions: ["REQUEST_PAYMENT_METHOD_UPDATE"],
    }),
  ]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.applyRecoveryResult(
    "txn_test",
    "REQUEST_PAYMENT_METHOD_UPDATE",
    "skipped",
  );

  assert.equal(result, null);
});

test("repository does not persist a recovery result for an unknown transaction", async () => {
  const fake = makeFakeCollection();

  const repository = new TransactionRepository(makeDb(fake.collection));

  const result = await repository.applyRecoveryResult(
    "missing_txn",
    "RETRY_PAYMENT",
    "success",
  );

  assert.equal(result, null);
});

test("repository deletes all transactions", async () => {
  const fake = makeFakeCollection([
    makeTransaction(),
    makeTransaction({ transactionId: "txn_002" }),
  ]);

  const repository = new TransactionRepository(makeDb(fake.collection));

  await repository.deleteAll();

  assert.equal(await repository.count(), 0);
});

test("repository creates required indexes", async () => {
  const fake = makeFakeCollection();

  const repository = new TransactionRepository(makeDb(fake.collection));

  await repository.ensureIndexes();

  assert.equal(fake.indexes.length, 4);

  assert.equal(
    fake.indexes.some(
      (index) => index.options.name === "transactionId_unique",
    ),
    true,
  );

  assert.equal(
    fake.indexes.some(
      (index) => index.options.name === "customerId_index",
    ),
    true,
  );

  assert.equal(
    fake.indexes.some(
      (index) => index.options.name === "merchantId_index",
    ),
    true,
  );

  assert.equal(
    fake.indexes.some(
      (index) => index.options.name === "failureType_index",
    ),
    true,
  );
});
