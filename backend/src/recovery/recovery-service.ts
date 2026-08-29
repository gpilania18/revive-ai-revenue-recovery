import type { TransactionRepository } from "../db/transaction-repository";
import {
  evaluateRecoveryPolicy,
  type RecoveryPolicyDecision,
} from "./recovery-policy";
import { simulateRecoveryAction } from "../simulator/payment-simulator";
import type {
  PublicTransaction,
  RecoveryActionType,
  SimulationResult,
} from "../simulator/types";

export interface RecoveryServiceResult {
  transaction: PublicTransaction;
  policy: RecoveryPolicyDecision;
  simulation: SimulationResult;
}

function toPublicTransaction(
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

export class RecoveryService {
  constructor(private readonly repository: TransactionRepository) {}

  async recover(
    transactionId: string,
    requestedAction: RecoveryActionType,
  ): Promise<RecoveryServiceResult> {
    const document =
      await this.repository.findByTransactionId(transactionId);

    if (!document) {
      throw new Error("Transaction not found");
    }

    const transaction = toPublicTransaction(document);

    const policy = evaluateRecoveryPolicy(
      transaction,
      requestedAction,
    );

    if (!policy.allowed) {
      return {
        transaction,
        policy,
        simulation: {
          transactionId: transaction.id,
          action: policy.action,
          outcome: "blocked",
          recoveredPaise: 0,
          reason: policy.reason,
        },
      };
    }

    const simulation = simulateRecoveryAction(
      transaction,
      policy.action,
      document.priorActions,
    );

    if (
  simulation.outcome !== "blocked" &&
  simulation.outcome !== "duplicate_prevented"
) {
  await this.repository.applyRecoveryResult(
    transaction.id,
    policy.action,
    simulation.outcome,
  );
}
    return {
      transaction,
      policy,
      simulation,
    };
  }
}