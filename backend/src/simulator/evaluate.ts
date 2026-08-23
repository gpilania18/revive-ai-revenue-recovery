import { simulateRecoveryAction } from "./payment-simulator";
import { toPublicTransaction } from "./public-transaction";
import type {
  EvaluationMetrics,
  PublicTransaction,
  RecoveryActionType,
  RecoveryStrategy,
  SimulationResult,
  Transaction,
} from "./types";

export function applyStrategy(
  transactions: Transaction[],
  strategy: RecoveryStrategy,
): SimulationResult[] {
  return transactions.map((transaction) => {
    const publicTransaction = toPublicTransaction(transaction);
    const action = strategy(publicTransaction);
    return simulateRecoveryAction(publicTransaction, action);
  });
}

export function evaluateResults(
  transactions: Transaction[],
  results: SimulationResult[],
): EvaluationMetrics {
  const resultById = new Map(results.map((result) => [result.transactionId, result]));

  let totalRevenueAtRiskPaise = 0;
  let revenueRecoveredPaise = 0;
  let successfulInterventions = 0;
  let blockedActions = 0;
  let escalationCount = 0;
  let duplicatePreventionCount = 0;

  for (const transaction of transactions) {
    totalRevenueAtRiskPaise += transaction.amountPaise;
    const result = resultById.get(transaction.id);
    if (!result) {
      continue;
    }
    revenueRecoveredPaise += result.recoveredPaise;
    if (result.outcome === "success") {
      successfulInterventions += 1;
    }
    if (result.outcome === "blocked") {
      blockedActions += 1;
    }
    if (result.outcome === "escalated") {
      escalationCount += 1;
    }
    if (result.outcome === "duplicate_prevented") {
      duplicatePreventionCount += 1;
    }
  }

  const recoveryRate =
    totalRevenueAtRiskPaise === 0 ? 0 : revenueRecoveredPaise / totalRevenueAtRiskPaise;

  return {
    transactionCount: transactions.length,
    totalRevenueAtRiskPaise,
    revenueRecoveredPaise,
    recoveryRate,
    successfulInterventions,
    blockedActions,
    escalationCount,
    duplicatePreventionCount,
  };
}

export function evaluateStrategy(
  transactions: Transaction[],
  strategy: RecoveryStrategy,
): { results: SimulationResult[]; metrics: EvaluationMetrics } {
  const results = applyStrategy(transactions, strategy);
  return {
    results,
    metrics: evaluateResults(transactions, results),
  };
}

export function incrementalRecoveryPaise(
  candidate: EvaluationMetrics,
  baseline: EvaluationMetrics,
): number {
  return candidate.revenueRecoveredPaise - baseline.revenueRecoveredPaise;
}

export function runActionOnPublicTransaction(
  transaction: PublicTransaction,
  action: RecoveryActionType,
  priorActions: readonly RecoveryActionType[] = [],
): SimulationResult {
  return simulateRecoveryAction(transaction, action, priorActions);
}
