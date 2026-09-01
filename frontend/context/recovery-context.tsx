"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type {
  PublicTransaction,
  ReviveEvaluation,
  RecoveryDecisionResponse,
  RecoveryActionType,
  SimulationResult,
  SimulationOutcome,
  EvaluationMetrics,
  RecoveryDecision,
  ExperimentStatus,
  HumanDecisionType,
  HumanReviewRecord,
  EscalatedTransactionItem,
  EscalationPriority,
  AuditEvent,
  DecisionRecord,
  OutcomeFeedbackMetrics,
  AIAssistantDecision,
} from "@/lib/types";
import {
  fetchSimulatorTransactions,
  fetchExperiment,
  postRecoveryAction,
  fetchAIAnalysis,
} from "@/lib/api";
import {
  evaluateReviveStrategy,
  evaluateRecoveryPolicy,
  getCustomTransactions,
} from "@/lib/csv-importer";

export interface SimulationEvent {
  id: string;
  transactionId: string;
  action: RecoveryActionType;
  outcome: SimulationOutcome;
  recoveredPaise: number;
  reason: string;
  timestamp: string;
  attemptNumber: number;
}

export interface ExperimentState {
  status: ExperimentStatus;
  sampleSize: number;
  seed: number;
  transactionIds: string[];
  baseline: EvaluationMetrics;
  revive: EvaluationMetrics;
  comparison: {
    incrementalRecoveryPaise: number;
    incrementalRecoveryRate: number;
    additionalSuccessfulInterventions: number;
  };
  progress?: {
    current: number;
    total: number;
  };
}

export const ZERO_METRICS: EvaluationMetrics = {
  transactionCount: 0,
  totalRevenueAtRiskPaise: 0,
  revenueRecoveredPaise: 0,
  recoveryRate: 0,
  successfulInterventions: 0,
  blockedActions: 0,
  escalationCount: 0,
  duplicatePreventionCount: 0,
};

const ZERO_EXPERIMENT: ExperimentState = {
  status: "IDLE",
  sampleSize: 0,
  seed: 42,
  transactionIds: [],
  baseline: { ...ZERO_METRICS },
  revive: { ...ZERO_METRICS },
  comparison: {
    incrementalRecoveryPaise: 0,
    incrementalRecoveryRate: 0,
    additionalSuccessfulInterventions: 0,
  },
};

interface RecoveryContextType {
  transactions: PublicTransaction[];
  evaluation: ReviveEvaluation | null;
  baseline: EvaluationMetrics;
  revive: EvaluationMetrics;
  comparison: ReviveEvaluation["comparison"];
  loading: boolean;
  error: string | null;
  simulationEvents: SimulationEvent[];
  activeSimulationResult: SimulationResult | null;
  isSimulating: Record<string, boolean>;
  isAnalyzing: Record<string, boolean>;

  // Experiment State
  experiment: ExperimentState;
  isExperimentActive: boolean;
  runBatchExperiment: (sampleSize: number, seed?: number) => Promise<void>;
  resetExperiment: () => void;

  // Human Review & Escalations
  humanReviews: Record<string, HumanReviewRecord>;
  escalatedTransactions: EscalatedTransactionItem[];
  pendingReviewCount: number;
  highPriorityCount: number;
  resolvedReviewCount: number;
  humanReviewRevenueAtRiskPaise: number;
  submitHumanDecision: (
    transactionId: string,
    decision: HumanDecisionType,
    note?: string
  ) => Promise<SimulationResult | null>;
  getEffectiveStatus: (txn: PublicTransaction) => string;
  getHumanReview: (transactionId: string) => HumanReviewRecord | undefined;

  // Decision Audit Trail & Outcome Feedback
  auditEvents: AuditEvent[];
  decisionRecords: Record<string, DecisionRecord>;
  outcomeMetrics: OutcomeFeedbackMetrics;
  getTransactionAudit: (transactionId: string) => AuditEvent[];
  getDecisionRecord: (transactionId: string) => DecisionRecord | undefined;
  getOutcomeFeedback: (transactionId: string) => DecisionRecord | undefined;

  // AI Assistant Decision Support
  aiAnalyses: Record<string, AIAssistantDecision>;
  aiErrors: Record<string, string>;
  isAnalyzingAI: Record<string, boolean>;
  analyzeTransactionWithAI: (transactionId: string) => Promise<AIAssistantDecision | null>;
  getAIAnalysis: (transactionId: string) => AIAssistantDecision | undefined;
  getAIError: (transactionId: string) => string | undefined;

  // Single Transaction & Core Actions
  analyzeTransaction: (id: string) => Promise<RecoveryDecisionResponse>;
  simulateRecovery: (id: string, action?: RecoveryActionType) => Promise<SimulationResult>;
  getDecision: (id: string) => RecoveryDecisionResponse | null;
  getTransaction: (id: string) => PublicTransaction | undefined;
  getTransactionEvents: (id: string) => SimulationEvent[];
  isTransactionInExperiment: (id: string) => boolean;
  resetSimulation: () => void;
  refetchAll: () => Promise<void>;
}

const RecoveryContext = createContext<RecoveryContextType | null>(null);

const STORAGE_KEY_EXPERIMENT = "revive_experiment_session_v7";
const STORAGE_KEY_SIMULATION_EVENTS = "revive_simulation_events_v7";
const STORAGE_KEY_MUTATED_TXNS = "revive_mutated_transactions_v7";
const STORAGE_KEY_HUMAN_REVIEWS = "revive_human_reviews_v7";
const STORAGE_KEY_AUDIT_EVENTS = "revive_audit_events_v7";
const STORAGE_KEY_DECISION_RECORDS = "revive_decision_records_v7";
const STORAGE_KEY_AI_ANALYSES = "revive_ai_analyses_v7";

export function RecoveryProvider({ children }: { children: React.ReactNode }) {
  const [baseTransactions, setBaseTransactions] = useState<PublicTransaction[]>([]);
  const [mutatedTransactions, setMutatedTransactions] = useState<Record<string, Partial<PublicTransaction>>>({});
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const [humanReviews, setHumanReviews] = useState<Record<string, HumanReviewRecord>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [decisionRecords, setDecisionRecords] = useState<Record<string, DecisionRecord>>({});
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, AIAssistantDecision>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<Record<string, boolean>>({});
  const [experiment, setExperiment] = useState<ExperimentState>(ZERO_EXPERIMENT);
  const [activeSimulationResult, setActiveSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<Record<string, boolean>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load dataset on initial mount
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const txData = await fetchSimulatorTransactions().catch((err) => {
        console.warn("Backend transactions fetch failed, using fallback:", err);
        return { seed: 42, transactions: [] };
      });

      setBaseTransactions(txData.transactions || []);

      if (typeof window !== "undefined") {
        try {
          const storedExp = localStorage.getItem(STORAGE_KEY_EXPERIMENT);
          if (storedExp) setExperiment(JSON.parse(storedExp));

          const storedEvents = localStorage.getItem(STORAGE_KEY_SIMULATION_EVENTS);
          if (storedEvents) setSimulationEvents(JSON.parse(storedEvents));

          const storedMutations = localStorage.getItem(STORAGE_KEY_MUTATED_TXNS);
          if (storedMutations) setMutatedTransactions(JSON.parse(storedMutations));

          const storedReviews = localStorage.getItem(STORAGE_KEY_HUMAN_REVIEWS);
          if (storedReviews) setHumanReviews(JSON.parse(storedReviews));

          const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT_EVENTS);
          if (storedAudit) setAuditEvents(JSON.parse(storedAudit));

          const storedDecisions = localStorage.getItem(STORAGE_KEY_DECISION_RECORDS);
          if (storedDecisions) setDecisionRecords(JSON.parse(storedDecisions));

          const storedAI = localStorage.getItem(STORAGE_KEY_AI_ANALYSES);
          if (storedAI) setAiAnalyses(JSON.parse(storedAI));
        } catch (e) {
          console.error("Failed to parse stored experiment state:", e);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load recovery data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Derived unified transactions list
  const transactions = useMemo(() => {
    const customTxns = typeof window !== "undefined" ? getCustomTransactions() : [];
    const seenIds = new Set<string>();
    const list: PublicTransaction[] = [];

    customTxns.forEach((t) => {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        const mutation = mutatedTransactions[t.id];
        list.push(mutation ? { ...t, ...mutation } : t);
      }
    });

    baseTransactions.forEach((t) => {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        const mutation = mutatedTransactions[t.id];
        list.push(mutation ? { ...t, ...mutation } : t);
      }
    });

    return list;
  }, [baseTransactions, mutatedTransactions]);

  const isExperimentActive = experiment.status === "COMPLETED" || experiment.status === "RUNNING";

  // Evaluation metrics strictly reflecting current experiment (or ZERO when reset)
  const evaluation: ReviveEvaluation | null = useMemo(() => {
    return {
      seed: experiment.seed,
      baseline: experiment.baseline,
      revive: experiment.revive,
      comparison: experiment.comparison,
      samplePublicTransaction: transactions[0] || null,
    };
  }, [experiment, transactions]);

  const isTransactionInExperiment = useCallback(
    (id: string): boolean => {
      if (!id || !isExperimentActive) return false;
      return experiment.transactionIds.includes(id);
    },
    [experiment.transactionIds, isExperimentActive]
  );

  // Helper to get transaction by ID
  const getTransaction = useCallback(
    (id: string): PublicTransaction | undefined => {
      if (!id) return undefined;
      return transactions.find((t) => t.id.toLowerCase() === id.trim().toLowerCase());
    },
    [transactions]
  );

  // Helper to evaluate decision for any transaction
  const getDecision = useCallback(
    (id: string): RecoveryDecisionResponse | null => {
      const txn = getTransaction(id);
      if (!txn) return null;
      const recommendedAction = evaluateReviveStrategy(txn);
      const decision = evaluateRecoveryPolicy(txn, recommendedAction);
      return {
        transaction: txn,
        decision,
      };
    },
    [getTransaction]
  );

  const getHumanReview = useCallback(
    (transactionId: string): HumanReviewRecord | undefined => {
      if (!transactionId) return undefined;
      return humanReviews[transactionId];
    },
    [humanReviews]
  );

  // Effective status calculation for any transaction
  const getEffectiveStatus = useCallback(
    (txn: PublicTransaction): string => {
      if (!txn) return "pending";

      if (txn.status === "captured") {
        return "recovered";
      }

      const review = humanReviews[txn.id];
      if (review) {
        if (review.status === "APPROVED" || review.status === "RESOLVED") {
          return "approved";
        }
        if (review.status === "REJECTED") {
          return "rejected";
        }
        if (review.status === "PENDING") {
          return "escalated";
        }
      }

      if (isExperimentActive && experiment.transactionIds.includes(txn.id)) {
        const decRes = getDecision(txn.id);
        const isHighValue = txn.amountPaise > 5_000_000;
        const isExplicitEscalate = decRes?.decision.action === "ESCALATE";
        const isBlocked = decRes ? !decRes.decision.allowed && decRes.decision.action !== "DO_NOTHING" : false;

        if (isHighValue || isExplicitEscalate || isBlocked) {
          return "escalated";
        }
      }

      return txn.status || "failed";
    },
    [humanReviews, isExperimentActive, experiment.transactionIds, getDecision]
  );

  // Derived Escalated Transactions Queue for current session
  const escalatedTransactions: EscalatedTransactionItem[] = useMemo(() => {
    if (!isExperimentActive && simulationEvents.length === 0) {
      return [];
    }

    const activeTxns = isExperimentActive
      ? transactions.filter((t) => experiment.transactionIds.includes(t.id))
      : transactions.filter((t) => simulationEvents.some((e) => e.transactionId === t.id));

    const items: EscalatedTransactionItem[] = [];

    activeTxns.forEach((txn) => {
      const decRes = getDecision(txn.id);
      if (!decRes) return;

      const action = decRes.decision.action;
      const isExplicitEscalate = action === "ESCALATE";
      const isHighValue = txn.amountPaise > 5_000_000;
      const isBlocked = !decRes.decision.allowed && action !== "DO_NOTHING";
      const simEvent = simulationEvents.find((e) => e.transactionId === txn.id);
      const wasEscalatedBySimulation = simEvent?.outcome === "escalated" || simEvent?.outcome === "blocked";

      if (isExplicitEscalate || isHighValue || isBlocked || wasEscalatedBySimulation) {
        const reviewRecord = humanReviews[txn.id];
        let reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED" = "PENDING";

        if (reviewRecord) {
          reviewStatus = reviewRecord.status;
        } else if (txn.status === "captured") {
          reviewStatus = "RESOLVED";
        }

        let priority: EscalationPriority = "LOW";
        if (txn.amountPaise >= 5_000_000 || txn.customer?.segment === "enterprise") {
          priority = "HIGH";
        } else if (txn.failureType === "UNKNOWN_FAILURE" || (txn.customer?.lifetimeValuePaise || 0) > 500_000) {
          priority = "MEDIUM";
        }

        items.push({
          transaction: txn,
          decision: decRes.decision,
          escalationReason: decRes.decision.reason,
          priority,
          reviewStatus,
          reviewedAt: reviewRecord?.reviewedAt,
        });
      }
    });

    return items;
  }, [isExperimentActive, simulationEvents, transactions, experiment.transactionIds, getDecision, humanReviews]);

  const pendingReviewCount = useMemo(() => {
    return escalatedTransactions.filter((item) => item.reviewStatus === "PENDING").length;
  }, [escalatedTransactions]);

  const highPriorityCount = useMemo(() => {
    return escalatedTransactions.filter((item) => item.reviewStatus === "PENDING" && item.priority === "HIGH").length;
  }, [escalatedTransactions]);

  const resolvedReviewCount = useMemo(() => {
    return escalatedTransactions.filter((item) => item.reviewStatus !== "PENDING").length;
  }, [escalatedTransactions]);

  const humanReviewRevenueAtRiskPaise = useMemo(() => {
    return escalatedTransactions
      .filter((item) => item.reviewStatus === "PENDING")
      .reduce((sum, item) => sum + item.transaction.amountPaise, 0);
  }, [escalatedTransactions]);

  // Derived Outcome Feedback Metrics
  const outcomeMetrics: OutcomeFeedbackMetrics = useMemo(() => {
    const records = Object.values(decisionRecords);
    const totalDecisions = records.length;
    const successfulRecoveries = records.filter((r) => r.outcome === "SUCCESS").length;
    const failedRecoveries = records.filter((r) => r.outcome === "FAILED").length;
    const escalations = records.filter((r) => r.escalated).length;
    const humanOverrides = records.filter((r) => r.isHumanOverride).length;
    const decisionSuccessRate = totalDecisions > 0 ? successfulRecoveries / totalDecisions : 0;
    const recoveryRate = experiment.revive.recoveryRate;

    return {
      totalDecisions,
      successfulRecoveries,
      failedRecoveries,
      escalations,
      humanOverrides,
      decisionSuccessRate,
      recoveryRate,
    };
  }, [decisionRecords, experiment.revive.recoveryRate]);

  // Selectors for Transaction Audit & Decision Records
  const getTransactionAudit = useCallback(
    (transactionId: string): AuditEvent[] => {
      if (!transactionId) return [];
      const cleanId = transactionId.trim().toLowerCase();
      return auditEvents.filter((ev) => ev.transactionId.toLowerCase() === cleanId);
    },
    [auditEvents]
  );

  const getDecisionRecord = useCallback(
    (transactionId: string): DecisionRecord | undefined => {
      if (!transactionId) return undefined;
      return decisionRecords[transactionId.trim()];
    },
    [decisionRecords]
  );

  const getAIAnalysis = useCallback(
    (transactionId: string): AIAssistantDecision | undefined => {
      if (!transactionId) return undefined;
      return aiAnalyses[transactionId.trim()];
    },
    [aiAnalyses]
  );

  const getAIError = useCallback(
    (transactionId: string): string | undefined => {
      if (!transactionId) return undefined;
      return aiErrors[transactionId.trim()];
    },
    [aiErrors]
  );

  // Trigger AI Assistant Analysis for any transaction
  const analyzeTransactionWithAI = useCallback(
    async (transactionId: string): Promise<AIAssistantDecision | null> => {
      const cleanId = transactionId.trim();
      const targetTxn = getTransaction(cleanId);
      if (!targetTxn) return null;

      setIsAnalyzingAI((prev) => ({ ...prev, [cleanId]: true }));

      try {
        const result = await fetchAIAnalysis(cleanId, targetTxn).catch((err) => {
          console.warn("[RecoveryContext] AI Analysis fetch failed:", err);
          return {
            available: false as const,
            decision: undefined,
            analysis: undefined,
            error: err instanceof Error ? err.message : "AI Assistant unavailable",
            evaluatedAt: new Date().toISOString(),
          };
        });

        const aiDec = result.decision || result.analysis;

        if (result.available && aiDec) {
          const nextAnalyses = {
            ...aiAnalyses,
            [cleanId]: aiDec,
          };

          const nextErrors = { ...aiErrors };
          delete nextErrors[cleanId];
          setAiErrors(nextErrors);

          // Record AI Analysis Audit Event only on true validated success
          const aiAuditEvent: AuditEvent = {
            id: `aud_${Date.now()}_ai`,
            transactionId: cleanId,
            timestamp: aiDec.evaluatedAt || new Date().toISOString(),
            eventType: "AI_ANALYSIS",
            actor: "REVIVE",
            action: aiDec.recommendedAction,
            reason: aiDec.reason,
            metadata: {
              confidence: aiDec.confidence,
              recoveryProbability: aiDec.recoveryProbability,
              riskScore: aiDec.riskScore,
              keyFactors: aiDec.keyFactors,
            },
          };

          const nextAudit = [aiAuditEvent, ...auditEvents];

          // Update Decision Record with AI predictions
          const existingDec = decisionRecords[cleanId];
          const nextDec: DecisionRecord = existingDec
            ? {
                ...existingDec,
                aiRecommendedAction: aiDec.recommendedAction,
                aiConfidence: aiDec.confidence,
                recoveryProbability: aiDec.recoveryProbability,
                riskScore: aiDec.riskScore,
                aiExplanation: aiDec.reason,
                aiKeyFactors: aiDec.keyFactors,
              }
            : {
                transactionId: cleanId,
                recommendedAction: evaluateReviveStrategy(targetTxn),
                actualAction: evaluateReviveStrategy(targetTxn),
                decisionSource: "RULE_BASED_REVIVE",
                decisionReason: "AI Assisted Evaluation",
                decisionAllowed: evaluateRecoveryPolicy(targetTxn, evaluateReviveStrategy(targetTxn)).allowed,
                escalated: targetTxn.amountPaise > 5_000_000,
                isHumanOverride: false,
                outcome: "PENDING",
                recoveredPaise: 0,
                timestamp: new Date().toISOString(),
                aiRecommendedAction: aiDec.recommendedAction,
                aiConfidence: aiDec.confidence,
                recoveryProbability: aiDec.recoveryProbability,
                riskScore: aiDec.riskScore,
                aiExplanation: aiDec.reason,
                aiKeyFactors: aiDec.keyFactors,
              };

          const nextDecisions = {
            ...decisionRecords,
            [cleanId]: nextDec,
          };

          setAiAnalyses(nextAnalyses);
          setAuditEvents(nextAudit);
          setDecisionRecords(nextDecisions);

          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY_AI_ANALYSES, JSON.stringify(nextAnalyses));
            localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(nextAudit));
            localStorage.setItem(STORAGE_KEY_DECISION_RECORDS, JSON.stringify(nextDecisions));
          }

          return aiDec;
        }

        // Set human-readable error state
        const errMessage = result.error || "AI Assistant is unavailable. Deterministic REVIVE engine remains active.";
        setAiErrors((prev) => ({
          ...prev,
          [cleanId]: errMessage,
        }));
        return null;
      } finally {
        setIsAnalyzingAI((prev) => ({ ...prev, [cleanId]: false }));
      }
    },
    [getTransaction, aiAnalyses, aiErrors, auditEvents, decisionRecords]
  );

  // Analyze single transaction
  const analyzeTransaction = useCallback(
    async (id: string): Promise<RecoveryDecisionResponse> => {
      const cleanId = id.trim();
      setIsAnalyzing((prev) => ({ ...prev, [cleanId]: true }));

      try {
        const decisionRes = getDecision(cleanId);
        if (decisionRes) {
          // Trigger optional non-blocking AI assistance in background
          analyzeTransactionWithAI(cleanId).catch(() => null);
          return decisionRes;
        }
        throw new Error(`Transaction "${cleanId}" not found in dataset.`);
      } finally {
        setIsAnalyzing((prev) => ({ ...prev, [cleanId]: false }));
      }
    },
    [getDecision, analyzeTransactionWithAI]
  );

  // Single-transaction simulate recovery
  const simulateRecovery = useCallback(
    async (id: string, overrideAction?: RecoveryActionType): Promise<SimulationResult> => {
      const cleanId = id.trim();
      setIsSimulating((prev) => ({ ...prev, [cleanId]: true }));

      try {
        const targetTxn = getTransaction(cleanId);
        if (!targetTxn) {
          throw new Error(`Transaction ${cleanId} not found`);
        }

        const actionToExecute =
          overrideAction ||
          evaluateReviveStrategy(targetTxn);

        const policy: RecoveryDecision = evaluateRecoveryPolicy(targetTxn, actionToExecute);
        let simResult: SimulationResult;

        if (!policy.allowed && !overrideAction) {
          simResult = {
            transactionId: targetTxn.id,
            action: policy.action,
            outcome: "blocked",
            recoveredPaise: 0,
            reason: policy.reason,
          };
        } else {
          if (overrideAction) {
            simResult = {
              transactionId: targetTxn.id,
              action: overrideAction,
              outcome: "success",
              recoveredPaise: targetTxn.amountPaise,
              reason: "Authorized recovery simulation executed successfully.",
            };
          } else {
            const backendExecution = await postRecoveryAction(targetTxn.id, actionToExecute).catch(() => null);

            if (backendExecution?.simulation) {
              simResult = backendExecution.simulation;
            } else {
              if (actionToExecute === "DO_NOTHING") {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "skipped",
                  recoveredPaise: 0,
                  reason: "No recovery action requested.",
                };
              } else if (actionToExecute === "ESCALATE") {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "escalated",
                  recoveredPaise: 0,
                  reason: "Case escalated for human review.",
                };
              } else if (actionToExecute === "REQUEST_PAYMENT_METHOD_UPDATE") {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "skipped",
                  recoveredPaise: 0,
                  reason: "Customer prompted to update payment method; no immediate capture.",
                };
              } else if (targetTxn.retryCount >= targetTxn.maxRetries) {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "blocked",
                  recoveredPaise: 0,
                  reason: "Retry limit has been exhausted.",
                };
              } else if (targetTxn.failureType === "INSUFFICIENT_FUNDS") {
                if (actionToExecute === "WAIT_AND_RETRY") {
                  simResult = {
                    transactionId: targetTxn.id,
                    action: actionToExecute,
                    outcome: "success",
                    recoveredPaise: targetTxn.amountPaise,
                    reason: "Funds available after waiting period; payment captured successfully.",
                  };
                } else {
                  simResult = {
                    transactionId: targetTxn.id,
                    action: actionToExecute,
                    outcome: "failure",
                    recoveredPaise: 0,
                    reason: "Immediate retry declined for insufficient funds.",
                  };
                }
              } else if (
                targetTxn.failureType === "TEMPORARY_ISSUER_FAILURE" ||
                targetTxn.failureType === "NETWORK_TIMEOUT"
              ) {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "success",
                  recoveredPaise: targetTxn.amountPaise,
                  reason: "Transient failure resolved on authorized retry; payment captured.",
                };
              } else {
                simResult = {
                  transactionId: targetTxn.id,
                  action: actionToExecute,
                  outcome: "failure",
                  recoveredPaise: 0,
                  reason: "Permanent failure category cannot be resolved via retry.",
                };
              }
            }
          }
        }

        const isPaymentAction =
          actionToExecute === "RETRY_PAYMENT" || actionToExecute === "WAIT_AND_RETRY";
        const newRetryCount = isPaymentAction ? targetTxn.retryCount + 1 : targetTxn.retryCount;
        const newStatus =
          simResult.outcome === "success"
            ? "captured"
            : targetTxn.status;

        const updatedMutation: Partial<PublicTransaction> = {
          status: newStatus,
          retryCount: newRetryCount,
          lastAttemptAt: new Date().toISOString(),
        };

        const nextMutations = {
          ...mutatedTransactions,
          [targetTxn.id]: {
            ...mutatedTransactions[targetTxn.id],
            ...updatedMutation,
          },
        };

        const event: SimulationEvent = {
          id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          transactionId: targetTxn.id,
          action: actionToExecute,
          outcome: simResult.outcome,
          recoveredPaise: simResult.recoveredPaise,
          reason: simResult.reason,
          timestamp: new Date().toISOString(),
          attemptNumber: newRetryCount,
        };

        const nextEvents = [event, ...simulationEvents];

        // Audit Trail generation for single-transaction simulation
        const timestamp = new Date().toISOString();
        const singleAuditEvents: AuditEvent[] = [
          {
            id: `aud_${Date.now()}_1`,
            transactionId: targetTxn.id,
            timestamp: targetTxn.createdAt,
            eventType: "PAYMENT_FAILED",
            actor: "SYSTEM",
            reason: `Payment failed due to ${targetTxn.failureType}`,
          },
          {
            id: `aud_${Date.now()}_2`,
            transactionId: targetTxn.id,
            timestamp,
            eventType: "REVIVE_ANALYSIS",
            actor: "REVIVE",
            action: actionToExecute,
            reason: policy.reason,
          },
          {
            id: `aud_${Date.now()}_3`,
            transactionId: targetTxn.id,
            timestamp,
            eventType: "SAFETY_CHECK",
            actor: "SAFETY_POLICY",
            action: policy.action,
            reason: policy.reason,
            metadata: { allowed: policy.allowed },
          },
          {
            id: `aud_${Date.now()}_4`,
            transactionId: targetTxn.id,
            timestamp,
            eventType: simResult.outcome === "success" ? "RECOVERY_SUCCEEDED" : "RECOVERY_ATTEMPTED",
            actor: simResult.outcome === "success" ? "SYSTEM" : "REVIVE",
            action: actionToExecute,
            reason: simResult.reason,
            metadata: { recoveredPaise: simResult.recoveredPaise },
          },
        ];

        const nextAudit = [...singleAuditEvents, ...auditEvents];

        const existingDec = decisionRecords[targetTxn.id];
        const nextDecisionRecord: DecisionRecord = {
          ...existingDec,
          transactionId: targetTxn.id,
          recommendedAction: evaluateReviveStrategy(targetTxn),
          actualAction: actionToExecute,
          decisionSource: "RULE_BASED_REVIVE",
          decisionReason: policy.reason,
          decisionAllowed: policy.allowed,
          escalated: actionToExecute === "ESCALATE",
          isHumanOverride: false,
          outcome: simResult.outcome === "success" ? "SUCCESS" : "FAILED",
          recoveredPaise: simResult.recoveredPaise,
          timestamp,
        };

        const nextDecisions = {
          ...decisionRecords,
          [targetTxn.id]: nextDecisionRecord,
        };

        // Update single-transaction recovery into active experiment
        const nextRevive: EvaluationMetrics = {
          ...experiment.revive,
          transactionCount: experiment.revive.transactionCount + (experiment.transactionIds.includes(targetTxn.id) ? 0 : 1),
          totalRevenueAtRiskPaise: experiment.revive.totalRevenueAtRiskPaise + (experiment.transactionIds.includes(targetTxn.id) ? 0 : targetTxn.amountPaise),
          revenueRecoveredPaise: experiment.revive.revenueRecoveredPaise + simResult.recoveredPaise,
          successfulInterventions: experiment.revive.successfulInterventions + (simResult.outcome === "success" ? 1 : 0),
          blockedActions: experiment.revive.blockedActions + (simResult.outcome === "blocked" ? 1 : 0),
          escalationCount: experiment.revive.escalationCount + (simResult.outcome === "escalated" ? 1 : 0),
          duplicatePreventionCount: experiment.revive.duplicatePreventionCount + (simResult.outcome === "duplicate_prevented" ? 1 : 0),
          recoveryRate:
            experiment.revive.totalRevenueAtRiskPaise + (experiment.transactionIds.includes(targetTxn.id) ? 0 : targetTxn.amountPaise) > 0
              ? (experiment.revive.revenueRecoveredPaise + simResult.recoveredPaise) /
                (experiment.revive.totalRevenueAtRiskPaise + (experiment.transactionIds.includes(targetTxn.id) ? 0 : targetTxn.amountPaise))
              : 0,
        };

        const nextExp: ExperimentState = {
          ...experiment,
          status: "COMPLETED",
          sampleSize: experiment.sampleSize + (experiment.transactionIds.includes(targetTxn.id) ? 0 : 1),
          transactionIds: Array.from(new Set([...experiment.transactionIds, targetTxn.id])),
          revive: nextRevive,
          comparison: {
            incrementalRecoveryPaise: nextRevive.revenueRecoveredPaise - experiment.baseline.revenueRecoveredPaise,
            incrementalRecoveryRate: nextRevive.recoveryRate - experiment.baseline.recoveryRate,
            additionalSuccessfulInterventions: nextRevive.successfulInterventions - experiment.baseline.successfulInterventions,
          },
        };

        setMutatedTransactions(nextMutations);
        setSimulationEvents(nextEvents);
        setAuditEvents(nextAudit);
        setDecisionRecords(nextDecisions);
        setActiveSimulationResult(simResult);
        setExperiment(nextExp);

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_EXPERIMENT, JSON.stringify(nextExp));
          localStorage.setItem(STORAGE_KEY_MUTATED_TXNS, JSON.stringify(nextMutations));
          localStorage.setItem(STORAGE_KEY_SIMULATION_EVENTS, JSON.stringify(nextEvents));
          localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(nextAudit));
          localStorage.setItem(STORAGE_KEY_DECISION_RECORDS, JSON.stringify(nextDecisions));
        }

        return simResult;
      } finally {
        setIsSimulating((prev) => ({ ...prev, [cleanId]: false }));
      }
    },
    [getTransaction, experiment, mutatedTransactions, simulationEvents, auditEvents, decisionRecords]
  );

  // Authoritative Human Decision Submission with Audit Trail and Decision Recording
  const submitHumanDecision = useCallback(
    async (
      transactionId: string,
      decision: HumanDecisionType,
      note?: string
    ): Promise<SimulationResult | null> => {
      const cleanId = transactionId.trim();
      const targetTxn = getTransaction(cleanId);
      if (!targetTxn) {
        throw new Error(`Transaction ${cleanId} not found`);
      }

      const timestamp = new Date().toISOString();
      const decRes = getDecision(cleanId);
      const originalRecommendation = decRes?.decision.action || "ESCALATE";
      const isOverride =
        (originalRecommendation === "ESCALATE" && decision !== "KEEP_ESCALATED") ||
        (originalRecommendation === "DO_NOTHING" && decision !== "REJECT_RECOVERY") ||
        (decision === "APPROVE_RECOVERY" || decision === "RETRY_PAYMENT");

      let simResult: SimulationResult | null = null;
      let reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED" = "PENDING";
      let updatedStatus = targetTxn.status;
      let newRetryCount = targetTxn.retryCount;
      let recoveredPaise = 0;
      let isSuccess = false;

      if (decision === "APPROVE_RECOVERY" || decision === "RETRY_PAYMENT") {
        reviewStatus = "RESOLVED";
        isSuccess = true;
        recoveredPaise = targetTxn.amountPaise;
        updatedStatus = "captured";
        newRetryCount = targetTxn.retryCount + 1;

        simResult = {
          transactionId: targetTxn.id,
          action: "RETRY_PAYMENT",
          outcome: "success",
          recoveredPaise,
          reason: note || "Human operator authorized and executed payment capture.",
        };
      } else if (decision === "REQUEST_PAYMENT_METHOD_UPDATE") {
        reviewStatus = "RESOLVED";
        updatedStatus = "failed";
        simResult = {
          transactionId: targetTxn.id,
          action: "REQUEST_PAYMENT_METHOD_UPDATE",
          outcome: "skipped",
          recoveredPaise: 0,
          reason: note || "Customer prompted to update payment method.",
        };
      } else if (decision === "REJECT_RECOVERY") {
        reviewStatus = "REJECTED";
        updatedStatus = "failed";
        simResult = {
          transactionId: targetTxn.id,
          action: "DO_NOTHING",
          outcome: "skipped",
          recoveredPaise: 0,
          reason: note || "Human reviewer rejected recovery attempt.",
        };
      } else if (decision === "KEEP_ESCALATED") {
        reviewStatus = "PENDING";
        updatedStatus = "failed";
        simResult = {
          transactionId: targetTxn.id,
          action: "ESCALATE",
          outcome: "escalated",
          recoveredPaise: 0,
          reason: note || "Transaction retained in escalation queue.",
        };
      }

      // Step 1: Update Mutated Transactions
      const nextMutations = {
        ...mutatedTransactions,
        [targetTxn.id]: {
          ...mutatedTransactions[targetTxn.id],
          status: updatedStatus,
          retryCount: newRetryCount,
          lastAttemptAt: timestamp,
        },
      };

      // Step 2: Record Simulation Event
      const reviewEvent: SimulationEvent = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        transactionId: targetTxn.id,
        action: simResult?.action || "DO_NOTHING",
        outcome: simResult?.outcome || "skipped",
        recoveredPaise,
        reason: simResult?.reason || "Human decision recorded.",
        timestamp,
        attemptNumber: newRetryCount,
      };
      const nextEvents = [reviewEvent, ...simulationEvents];

      // Step 3: Record Human Review Record
      const reviewRecord: HumanReviewRecord = {
        transactionId: targetTxn.id,
        decision,
        note,
        reviewedAt: timestamp,
        status: reviewStatus,
      };
      const nextReviews = {
        ...humanReviews,
        [targetTxn.id]: reviewRecord,
      };

      // Step 4: Record Audit Trail Events for Human Review
      const newAuditEvents: AuditEvent[] = [
        {
          id: `aud_${Date.now()}_hr1`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "HUMAN_REVIEW",
          actor: "HUMAN_OPERATOR",
          reason: "Operator opened and inspected escalated case.",
        },
        {
          id: `aud_${Date.now()}_hr2`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "HUMAN_DECISION",
          actor: "HUMAN_OPERATOR",
          action: decision,
          reason: note || `Operator selected ${decision}`,
        },
      ];

      if (isOverride) {
        newAuditEvents.push({
          id: `aud_${Date.now()}_hr3`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "HUMAN_OVERRIDE",
          actor: "HUMAN_OPERATOR",
          action: decision,
          reason: note || "Human operator overrode automated recommendation.",
          metadata: { originalRecommendation },
        });
      }

      if (decision === "APPROVE_RECOVERY" || decision === "RETRY_PAYMENT") {
        newAuditEvents.push({
          id: `aud_${Date.now()}_hr4`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "RECOVERY_ATTEMPTED",
          actor: "HUMAN_OPERATOR",
          action: "RETRY_PAYMENT",
          reason: "Executing authorized recovery simulation.",
        });
        newAuditEvents.push({
          id: `aud_${Date.now()}_hr5`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "RECOVERY_SUCCEEDED",
          actor: "SYSTEM",
          reason: "Payment captured successfully on authorized retry.",
          metadata: { recoveredPaise: targetTxn.amountPaise },
        });
      } else if (decision === "REJECT_RECOVERY") {
        newAuditEvents.push({
          id: `aud_${Date.now()}_hr6`,
          transactionId: targetTxn.id,
          timestamp,
          eventType: "RECOVERY_BLOCKED",
          actor: "HUMAN_OPERATOR",
          reason: note || "Human reviewer declined recovery attempt.",
        });
      }

      const nextAudit = [...newAuditEvents, ...auditEvents];

      // Step 5: Update Decision Record while strictly preserving recommendedAction
      const existingDecRecord = decisionRecords[targetTxn.id];
      const nextDecisionRecord: DecisionRecord = {
        ...existingDecRecord,
        transactionId: targetTxn.id,
        recommendedAction: existingDecRecord?.recommendedAction || originalRecommendation,
        actualAction: decision,
        decisionSource: isOverride ? "HUMAN_OPERATOR" : "RULE_BASED_REVIVE",
        decisionReason: existingDecRecord?.decisionReason || decRes?.decision.reason || "Case escalated",
        decisionAllowed: existingDecRecord?.decisionAllowed ?? (decRes?.decision.allowed || false),
        escalated: true,
        humanDecision: decision,
        humanReason: note,
        isHumanOverride: isOverride,
        outcome: isSuccess ? "SUCCESS" : (decision === "REJECT_RECOVERY" ? "REJECTED" : "PENDING"),
        recoveredPaise,
        timestamp,
      };

      const nextDecisions = {
        ...decisionRecords,
        [targetTxn.id]: nextDecisionRecord,
      };

      // Step 6: Recalculate Central Experiment Metrics
      let nextExp = experiment;
      if (recoveredPaise > 0 || isSuccess) {
        const nextRevive: EvaluationMetrics = {
          ...experiment.revive,
          revenueRecoveredPaise: experiment.revive.revenueRecoveredPaise + recoveredPaise,
          successfulInterventions: experiment.revive.successfulInterventions + (isSuccess ? 1 : 0),
          recoveryRate:
            experiment.revive.totalRevenueAtRiskPaise > 0
              ? (experiment.revive.revenueRecoveredPaise + recoveredPaise) / experiment.revive.totalRevenueAtRiskPaise
              : 0,
        };

        nextExp = {
          ...experiment,
          revive: nextRevive,
          comparison: {
            incrementalRecoveryPaise: nextRevive.revenueRecoveredPaise - experiment.baseline.revenueRecoveredPaise,
            incrementalRecoveryRate: nextRevive.recoveryRate - experiment.baseline.recoveryRate,
            additionalSuccessfulInterventions: nextRevive.successfulInterventions - experiment.baseline.successfulInterventions,
          },
        };
      }

      // Step 7: Synchronously Apply all Updates to State
      setMutatedTransactions(nextMutations);
      setSimulationEvents(nextEvents);
      setHumanReviews(nextReviews);
      setAuditEvents(nextAudit);
      setDecisionRecords(nextDecisions);
      setActiveSimulationResult(simResult);
      if (nextExp !== experiment) {
        setExperiment(nextExp);
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_MUTATED_TXNS, JSON.stringify(nextMutations));
        localStorage.setItem(STORAGE_KEY_SIMULATION_EVENTS, JSON.stringify(nextEvents));
        localStorage.setItem(STORAGE_KEY_HUMAN_REVIEWS, JSON.stringify(nextReviews));
        localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(nextAudit));
        localStorage.setItem(STORAGE_KEY_DECISION_RECORDS, JSON.stringify(nextDecisions));
        localStorage.setItem(STORAGE_KEY_EXPERIMENT, JSON.stringify(nextExp));
      }

      return simResult;
    },
    [getTransaction, getDecision, mutatedTransactions, simulationEvents, humanReviews, auditEvents, decisionRecords, experiment]
  );

  // Run Batch Experiment with structured Decision Auditing & Outcome Feedback Records
  const runBatchExperiment = useCallback(
    async (sampleSize: number, seed = 42) => {
      setExperiment((prev) => ({
        ...prev,
        status: "RUNNING",
        sampleSize,
        seed,
        progress: { current: 0, total: sampleSize },
      }));

      try {
        const expData = await fetchExperiment(sampleSize, seed);

        const stepCount = Math.min(10, sampleSize);
        for (let i = 1; i <= stepCount; i++) {
          const simulatedProgress = Math.round((i / stepCount) * sampleSize);
          setExperiment((prev) => ({
            ...prev,
            progress: { current: simulatedProgress, total: sampleSize },
          }));
          await new Promise((r) => setTimeout(r, 40));
        }

        const newMutations: Record<string, Partial<PublicTransaction>> = {};
        const newEvents: SimulationEvent[] = [];
        const newAuditEvents: AuditEvent[] = [];
        const newDecisionRecords: Record<string, DecisionRecord> = {};
        const now = new Date().toISOString();

        expData.reviveResults.forEach((res, idx) => {
          const txn = expData.transactions.find((t) => t.id === res.transactionId) || baseTransactions.find((t) => t.id === res.transactionId);
          if (!txn) return;

          const isPaymentAction = res.action === "RETRY_PAYMENT" || res.action === "WAIT_AND_RETRY";
          const newRetryCount = isPaymentAction ? txn.retryCount + 1 : txn.retryCount;
          const newStatus = res.outcome === "success" ? "captured" : txn.status;

          newMutations[txn.id] = {
            status: newStatus,
            retryCount: newRetryCount,
            lastAttemptAt: now,
          };

          newEvents.push({
            id: `exp_${Date.now()}_${idx}`,
            transactionId: txn.id,
            action: res.action,
            outcome: res.outcome,
            recoveredPaise: res.recoveredPaise,
            reason: res.reason,
            timestamp: now,
            attemptNumber: newRetryCount,
          });

          // Generate Chronological Decision Audit Trail
          newAuditEvents.push({
            id: `aud_exp_${idx}_1`,
            transactionId: txn.id,
            timestamp: txn.createdAt,
            eventType: "PAYMENT_FAILED",
            actor: "SYSTEM",
            reason: `Payment failed due to ${txn.failureType}`,
          });

          newAuditEvents.push({
            id: `aud_exp_${idx}_2`,
            transactionId: txn.id,
            timestamp: now,
            eventType: "REVIVE_ANALYSIS",
            actor: "REVIVE",
            action: res.action,
            reason: res.reason,
          });

          newAuditEvents.push({
            id: `aud_exp_${idx}_3`,
            transactionId: txn.id,
            timestamp: now,
            eventType: "SAFETY_CHECK",
            actor: "SAFETY_POLICY",
            action: res.action,
            reason: res.reason,
            metadata: {
              allowed: res.outcome !== "blocked",
              amountPaise: txn.amountPaise,
            },
          });

          if (res.outcome === "success") {
            newAuditEvents.push({
              id: `aud_exp_${idx}_4`,
              transactionId: txn.id,
              timestamp: now,
              eventType: "RECOVERY_ATTEMPTED",
              actor: "REVIVE",
              action: res.action,
              reason: "Automated recovery execution attempted.",
            });
            newAuditEvents.push({
              id: `aud_exp_${idx}_5`,
              transactionId: txn.id,
              timestamp: now,
              eventType: "RECOVERY_SUCCEEDED",
              actor: "SYSTEM",
              reason: "Payment captured successfully.",
              metadata: { recoveredPaise: res.recoveredPaise },
            });
          } else if (res.outcome === "escalated" || txn.amountPaise > 5_000_000) {
            newAuditEvents.push({
              id: `aud_exp_${idx}_6`,
              transactionId: txn.id,
              timestamp: now,
              eventType: "ESCALATED",
              actor: "REVIVE",
              reason: res.reason,
            });
          } else if (res.outcome === "blocked") {
            newAuditEvents.push({
              id: `aud_exp_${idx}_7`,
              transactionId: txn.id,
              timestamp: now,
              eventType: "RECOVERY_BLOCKED",
              actor: "SAFETY_POLICY",
              reason: res.reason,
            });
          }

          // Preserve Initial Decision Record
          newDecisionRecords[txn.id] = {
            transactionId: txn.id,
            recommendedAction: res.action,
            actualAction: res.action,
            decisionSource: "RULE_BASED_REVIVE",
            decisionReason: res.reason,
            decisionAllowed: res.outcome !== "blocked",
            escalated: res.outcome === "escalated" || txn.amountPaise > 5_000_000,
            isHumanOverride: false,
            outcome: res.outcome === "success" ? "SUCCESS" : (res.outcome === "escalated" ? "ESCALATED" : (res.outcome === "blocked" ? "BLOCKED" : "FAILED")),
            recoveredPaise: res.recoveredPaise,
            timestamp: now,
          };
        });

        const completedState: ExperimentState = {
          status: "COMPLETED",
          sampleSize: expData.sampleSize,
          seed: expData.seed,
          transactionIds: expData.transactionIds,
          baseline: expData.baseline,
          revive: expData.revive,
          comparison: expData.comparison,
          progress: { current: expData.sampleSize, total: expData.sampleSize },
        };

        setMutatedTransactions(newMutations);
        setSimulationEvents(newEvents);
        setAuditEvents(newAuditEvents);
        setDecisionRecords(newDecisionRecords);
        setAiAnalyses({});
        setHumanReviews({});
        setExperiment(completedState);

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_EXPERIMENT, JSON.stringify(completedState));
          localStorage.setItem(STORAGE_KEY_MUTATED_TXNS, JSON.stringify(newMutations));
          localStorage.setItem(STORAGE_KEY_SIMULATION_EVENTS, JSON.stringify(newEvents));
          localStorage.setItem(STORAGE_KEY_AUDIT_EVENTS, JSON.stringify(newAuditEvents));
          localStorage.setItem(STORAGE_KEY_DECISION_RECORDS, JSON.stringify(newDecisionRecords));
          localStorage.removeItem(STORAGE_KEY_HUMAN_REVIEWS);
          localStorage.removeItem(STORAGE_KEY_AI_ANALYSES);
        }
      } catch (err: unknown) {
        setExperiment((prev) => ({
          ...prev,
          status: "ERROR",
        }));
        throw err;
      }
    },
    [baseTransactions]
  );

  const getTransactionEvents = useCallback(
    (id: string): SimulationEvent[] => {
      if (!id) return [];
      return simulationEvents.filter((e) => e.transactionId.toLowerCase() === id.trim().toLowerCase());
    },
    [simulationEvents]
  );

  // Synchronous and complete Reset back to ZERO
  const resetExperiment = useCallback(() => {
    setMutatedTransactions({});
    setSimulationEvents([]);
    setHumanReviews({});
    setAuditEvents([]);
    setDecisionRecords({});
    setAiAnalyses({});
    setAiErrors({});
    setActiveSimulationResult(null);
    setExperiment(ZERO_EXPERIMENT);

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_EXPERIMENT);
      localStorage.removeItem(STORAGE_KEY_MUTATED_TXNS);
      localStorage.removeItem(STORAGE_KEY_SIMULATION_EVENTS);
      localStorage.removeItem(STORAGE_KEY_HUMAN_REVIEWS);
      localStorage.removeItem(STORAGE_KEY_AUDIT_EVENTS);
      localStorage.removeItem(STORAGE_KEY_DECISION_RECORDS);
      localStorage.removeItem(STORAGE_KEY_AI_ANALYSES);
    }
  }, []);

  return (
    <RecoveryContext.Provider
      value={{
        transactions,
        evaluation,
        baseline: experiment.baseline,
        revive: experiment.revive,
        comparison: experiment.comparison,
        loading,
        error,
        simulationEvents,
        activeSimulationResult,
        isSimulating,
        isAnalyzing,
        experiment,
        isExperimentActive,
        runBatchExperiment,
        resetExperiment,
        humanReviews,
        escalatedTransactions,
        pendingReviewCount,
        highPriorityCount,
        resolvedReviewCount,
        humanReviewRevenueAtRiskPaise,
        submitHumanDecision,
        getEffectiveStatus,
        getHumanReview,
        auditEvents,
        decisionRecords,
        outcomeMetrics,
        getTransactionAudit,
        getDecisionRecord,
        getOutcomeFeedback: getDecisionRecord,
        aiAnalyses,
        aiErrors,
        isAnalyzingAI,
        analyzeTransactionWithAI,
        getAIAnalysis,
        getAIError,
        analyzeTransaction,
        simulateRecovery,
        getDecision,
        getTransaction,
        getTransactionEvents,
        isTransactionInExperiment,
        resetSimulation: resetExperiment,
        refetchAll: loadInitialData,
      }}
    >
      {children}
    </RecoveryContext.Provider>
  );
}

export function useRecovery() {
  const context = useContext(RecoveryContext);
  if (!context) {
    throw new Error("useRecovery must be used within a RecoveryProvider");
  }
  return context;
}
