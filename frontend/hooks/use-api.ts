"use client";

import { useRecovery } from "@/context/recovery-context";
import type {
  PublicTransaction,
  RecoveryDecisionResponse,
  ReviveEvaluation,
} from "@/lib/types";

/**
 * Re-export context-backed hooks so all components consume the same
 * single authoritative simulation state without making un-synchronized API calls.
 */

export function useEvaluation(): {
  data: ReviveEvaluation | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { evaluation, loading, error, refetchAll } = useRecovery();
  return {
    data: evaluation,
    loading,
    error,
    refetch: refetchAll,
  };
}

export function useTransactions(): {
  data: PublicTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { transactions, loading, error, refetchAll } = useRecovery();
  return {
    data: transactions,
    loading,
    error,
    refetch: refetchAll,
  };
}

export function useRecoveryDecision(transactionId: string | null): {
  data: RecoveryDecisionResponse | null;
  loading: boolean;
  error: string | null;
  fetchDecision: (id: string) => Promise<RecoveryDecisionResponse | null>;
} {
  const { getDecision, isAnalyzing } = useRecovery();
  const data = transactionId ? getDecision(transactionId) : null;
  const loading = transactionId ? !!isAnalyzing[transactionId] : false;

  return {
    data,
    loading,
    error: null,
    fetchDecision: async (id: string) => {
      return getDecision(id);
    },
  };
}
