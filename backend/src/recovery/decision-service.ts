import { getMongoClient } from "../db/mongo";
import { TransactionRepository } from "../db/transaction-repository";
import { evaluateRecoveryPolicy } from "./recovery-policy";
import { reviveStrategy } from "./revive-strategy";
import type {
  PublicTransaction,
  RecoveryActionType,
} from "../simulator/types";

export interface RecoveryDecision {
  action: RecoveryActionType;
  allowed: boolean;
  reason: string;
}

function toDecisionTransaction(
  transaction: Awaited<
    ReturnType<TransactionRepository["findByTransactionId"]>
  >,
): PublicTransaction {
  if (!transaction) {
    throw new Error("Transaction not found");
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
    createdAt: transaction.createdAt.toISOString(),
    lastAttemptAt: transaction.lastAttemptAt.toISOString(),
    customer: transaction.customer,
  };
}

export function decideRecovery(
  transaction: PublicTransaction,
): RecoveryDecision {
  const recommendedAction = reviveStrategy(transaction);

  return evaluateRecoveryPolicy(
    transaction,
    recommendedAction,
  );
}

export async function getRecoveryDecision(
  transactionId: string,
): Promise<{
  transaction: PublicTransaction;
  decision: RecoveryDecision;
}> {
  const mongoClient = await getMongoClient();
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    throw new Error("MongoDB is not configured.");
  }

  const repository = new TransactionRepository(
    mongoClient.db(dbName),
  );

  const transaction = await repository.findByTransactionId(
    transactionId,
  );

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  const publicTransaction = toDecisionTransaction(transaction);
  const decision = decideRecovery(publicTransaction);

  return {
    transaction: publicTransaction,
    decision,
  };
}
