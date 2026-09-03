"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatINR,
  formatActionLabel,
  formatFailureType,
  formatPaymentMethod,
  formatTimestamp,
  formatDate,
  formatAuditEventType,
  formatAuditActor,
  formatNormalizedOutcome,
  formatDecisionSource,
  formatPercent,
  formatAIFailureCategory,
  formatStatusLabel,
} from "@/lib/format";
import { useRecovery } from "@/context/recovery-context";

export default function TransactionDetailPage({ params }: { params: { id: string } }) {
  const {
    getTransaction,
    getDecision,
    getHumanReview,
    getEffectiveStatus,
    getTransactionAudit,
    getDecisionRecord,
    getAIAnalysis,
    getAIError,
    analyzeTransactionWithAI,
    isAnalyzingAI,
    simulateRecovery,
    isTransactionInExperiment,
    isExperimentActive,
    isSimulating,
    activeSimulationResult,
    refetchAll,
    loading,
  } = useRecovery();

  const txnId = params.id;
  const currentTxn = getTransaction(txnId);
  const decisionRes = getDecision(txnId);
  const auditEvents = getTransactionAudit(txnId);
  const decisionRecord = getDecisionRecord(txnId);
  const aiAnalysis = getAIAnalysis(txnId);
  const aiError = getAIError(txnId);
  const isCurrentAIAnalyzing = !!isAnalyzingAI[txnId];
  const humanReview = getHumanReview(txnId);
  const isCurrentSimulating = !!isSimulating[txnId];
  const inExperiment = isTransactionInExperiment(txnId);

  useEffect(() => {
    if (txnId && !aiAnalysis) {
      analyzeTransactionWithAI(txnId).catch(() => null);
    }
  }, [txnId, aiAnalysis, analyzeTransactionWithAI]);

  const handleSimulate = useCallback(async () => {
    if (!txnId) return;
    try {
      await simulateRecovery(txnId);
    } catch (err: unknown) {
      console.error("Simulation failed:", err);
    }
  }, [txnId, simulateRecovery]);

  const handleRequestAI = useCallback(async () => {
    if (!txnId) return;
    await analyzeTransactionWithAI(txnId, true);
  }, [txnId, analyzeTransactionWithAI]);

  if (loading && !currentTxn) {
    return (
      <DashboardLayout title="Transaction Details">
        <LoadingState message="Loading transaction details..." />
      </DashboardLayout>
    );
  }

  if (!currentTxn) {
    return (
      <DashboardLayout title="Transaction Details">
        <ErrorState message={`Transaction "${txnId}" was not found.`} />
        <div className="mt-4 flex justify-center">
          <Link href="/transactions" className="text-blue-600 hover:underline text-sm font-medium">
            &larr; Back to Transactions
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const decision = decisionRes?.decision;
  const effectiveStatus = getEffectiveStatus(currentTxn);
  const isRecovered = effectiveStatus === "recovered" || effectiveStatus === "captured" || effectiveStatus === "authorized";
  const isResolved =
    isRecovered ||
    effectiveStatus === "approved" ||
    effectiveStatus === "rejected" ||
    effectiveStatus === "resolved" ||
    (humanReview && humanReview.status !== "PENDING") ||
    (decisionRecord && decisionRecord.outcome !== "PENDING");
  const isDuplicate = currentTxn.failureType === "DUPLICATE_PAYMENT";
  const isRetryLimitReached = currentTxn.retryCount >= currentTxn.maxRetries;
  const isHighValue = currentTxn.amountPaise > 5_000_000;

  return (
    <DashboardLayout title="Transaction Details" onRefresh={refetchAll}>
      {/* Back Link */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/transactions" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5">
          <span>&larr;</span>
          <span>Back to Transactions</span>
        </Link>

        {isExperimentActive && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            inExperiment
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
            {inExperiment ? "✓ Evaluated in Current Experiment" : "Not Included in Current Experiment"}
          </span>
        )}
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 items-start md:items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{currentTxn.id}</h1>
            <StatusBadge status={effectiveStatus} className="text-xs px-3 py-0.5" />
            {decisionRecord?.isHumanOverride && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                HUMAN OVERRIDE
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Amount: <span className="font-bold text-gray-900">{formatINR(currentTxn.amountPaise)}</span> ({currentTxn.currency}) · Customer: <span className="font-mono">{currentTxn.customerId}</span>
          </p>
        </div>

        {/* Live Action Button in Header */}
        <div>
          {isRecovered ? (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Captured & Recovered</span>
            </div>
          ) : decision?.allowed ? (
            <button
              onClick={handleSimulate}
              disabled={isCurrentSimulating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isCurrentSimulating ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Executing Simulation...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Simulate Recovery Attempt</span>
                </>
              )}
            </button>
          ) : (
            <Link
              href="/review"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all"
            >
              Inspect in Human Review &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Simulation Feedback Alert */}
      {activeSimulationResult && activeSimulationResult.transactionId === currentTxn.id && (
        <div
          className={`p-4 rounded-2xl mb-6 border animate-in fade-in duration-200 flex items-start justify-between ${
            activeSimulationResult.outcome === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : activeSimulationResult.outcome === "escalated"
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold ${
              activeSimulationResult.outcome === "success" ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800"
            }`}>
              {activeSimulationResult.outcome === "success" ? "✓" : "!"}
            </div>
            <div>
              <p className="font-bold text-sm">
                Simulation Outcome: <span className="uppercase">{activeSimulationResult.outcome}</span>
                {activeSimulationResult.recoveredPaise > 0 && ` · ${formatINR(activeSimulationResult.recoveredPaise)} Recovered`}
              </p>
              <p className="text-xs mt-0.5 opacity-90">{activeSimulationResult.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Resolution & Execution State Card (if transaction has been resolved) */}
      {isResolved && (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-6 mb-8 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-800/40">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  Authoritative Resolution & Current State
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Current Authoritative State
                  </span>
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={effectiveStatus} className="text-xs px-3 py-1 font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Current Effective Status</p>
              <p className="text-base font-bold text-emerald-400 mt-1 capitalize">{formatStatusLabel(effectiveStatus)}</p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Human Resolution</p>
              <p className="text-base font-bold text-white mt-1">
                {humanReview?.decision
                  ? formatActionLabel(humanReview.decision)
                  : decisionRecord?.humanDecision
                  ? formatActionLabel(decisionRecord.humanDecision)
                  : "Operator Authorized"}
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Executed Action</p>
              <p className="text-base font-bold text-blue-400 mt-1">
                {formatActionLabel(decisionRecord?.actualAction || humanReview?.decision || "RETRY_PAYMENT")}
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actual Outcome</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-base font-bold text-emerald-300">
                  {formatNormalizedOutcome(decisionRecord?.outcome || (isRecovered ? "SUCCESS" : "RESOLVED"))}
                </span>
                {decisionRecord && decisionRecord.recoveredPaise > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ({formatINR(decisionRecord.recoveredPaise)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Human Operator Rationale / Notes */}
          {(humanReview?.note || decisionRecord?.humanReason) && (
            <div className="mt-4 p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/80 text-xs">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block mb-1">
                Operator Resolution Rationale:
              </span>
              <p className="text-slate-200">
                &ldquo;{humanReview?.note || decisionRecord?.humanReason}&rdquo;
              </p>
              {humanReview?.reviewedAt && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Resolved at: {formatDate(humanReview.reviewedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Assistant Decision Support Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-2xl p-6 mb-8 text-white shadow-xl border border-indigo-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-800/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isResolved ? "bg-slate-400" : "bg-indigo-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isResolved ? "bg-slate-400" : "bg-indigo-500"}`}></span>
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                {isResolved ? "AI Analysis at Time of Escalation" : "AI Assistant"}
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isResolved
                    ? "bg-slate-700/60 text-slate-300 border-slate-600"
                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                }`}>
                  {isResolved ? "Historical / Advisory" : "Decision Support (Non-authoritative)"}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestAI}
              disabled={isCurrentAIAnalyzing}
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isCurrentAIAnalyzing ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Analyzing Context...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Re-evaluate with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiAnalysis ? (
          <div className="space-y-4 pt-4">
            {/* Row 1: Top Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI Recommendation</p>
                <p className="text-base font-bold text-white mt-1">{formatActionLabel(aiAnalysis.recommendedAction)}</p>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI Recommendation Confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-base font-mono font-bold text-indigo-300">{formatPercent(aiAnalysis.confidence)}</p>
                  <span className="text-[10px] text-slate-400">(Certainty)</span>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Recovery Probability</p>
                {aiAnalysis.failureClassification?.category === "RISK_RELATED" || currentTxn.failureType === "DUPLICATE_PAYMENT" || isDuplicate ? (
                  <div className="mt-1">
                    <p className="text-base font-mono font-bold text-slate-400">N/A</p>
                    <span className="text-[10px] text-amber-400 font-medium block">No safe recovery path</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-base font-mono font-bold text-emerald-300">{formatPercent(aiAnalysis.recoveryProbability)}</p>
                    <span className="text-[10px] text-slate-400">(Est. Success)</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Risk Level</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    aiAnalysis.riskScore === "LOW" ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700" :
                    aiAnalysis.riskScore === "MEDIUM" ? "bg-amber-900/80 text-amber-300 border border-amber-700" :
                    "bg-red-900/80 text-red-300 border border-red-700"
                  }`}>
                    {aiAnalysis.riskScore} RISK
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Failure Classification */}
            {aiAnalysis.failureClassification && (
              <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Failure Classification:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                      {formatAIFailureCategory(aiAnalysis.failureClassification.category)}
                    </span>
                    <span className="text-xs text-slate-400">
                      · Failure Classification Confidence: <span className="font-mono font-bold text-indigo-300">{formatPercent(aiAnalysis.failureClassification.confidence)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{aiAnalysis.failureClassification.reason}</p>
                </div>
              </div>
            )}

            {/* Row 3: Why This Recommendation & Key Factors */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/80 space-y-3">
              <div>
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">Why this recommendation?</p>
                <p className="text-sm text-slate-200 leading-relaxed">{aiAnalysis.reason}</p>
              </div>

              {aiAnalysis.keyFactors && aiAnalysis.keyFactors.length > 0 && (
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Key Factors Analyzed:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {aiAnalysis.keyFactors.map((factor, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Row 4: Expected Outcome & Human Review Guidance Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expected Outcome */}
              {aiAnalysis.expectedOutcome && (
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Likely Outcome</p>
                    {aiAnalysis.failureClassification?.category === "RISK_RELATED" || currentTxn.failureType === "DUPLICATE_PAYMENT" || isDuplicate ? (
                      <span className="text-xs font-mono font-bold text-amber-400">
                        N/A (Double Charge Risk)
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-300">
                        {formatPercent(aiAnalysis.expectedOutcome.successProbability)} Est. Success
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiAnalysis.failureClassification?.category === "RISK_RELATED" || currentTxn.failureType === "DUPLICATE_PAYMENT" || isDuplicate
                      ? "No safe recovery action is available because attempting recovery could result in an unintended double charge."
                      : aiAnalysis.expectedOutcome.summary}
                  </p>
                </div>
              )}

              {/* Human Review Guidance */}
              {aiAnalysis.humanAdvice && (
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      {isResolved ? "Original Reviewer Guidance" : "Reviewer Guidance"}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isResolved
                        ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700"
                        : aiAnalysis.humanAdvice.reviewNeeded
                        ? "bg-amber-900/80 text-amber-300 border border-amber-700"
                        : "bg-emerald-900/80 text-emerald-300 border border-emerald-700"
                    }`}>
                      {isResolved
                        ? "Resolved by Operator"
                        : aiAnalysis.humanAdvice.reviewNeeded
                        ? "Manual Review Required"
                        : "Not Currently Required"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiAnalysis.humanAdvice.summary}
                  </p>
                  {isResolved ? (
                    <p className="text-[11px] text-emerald-400/90 pt-1 font-medium">
                      ✓ This case was reviewed and resolved by operations. Manual review is no longer active.
                    </p>
                  ) : (
                    aiAnalysis.humanAdvice.reviewTriggers && aiAnalysis.humanAdvice.reviewTriggers.length > 0 && (
                      <div className="pt-1.5 flex flex-wrap gap-1">
                        {aiAnalysis.humanAdvice.reviewTriggers.map((trig, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                            {trig}
                          </span>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Subtle Advisory Disclaimer */}
            <div className="pt-1 text-center">
              <p className="text-[11px] text-slate-400">
                AI provides decision support only. REVIVE deterministic policy controls automated recovery.
              </p>
            </div>
          </div>
        ) : isCurrentAIAnalyzing ? (
          <div className="py-8 text-center text-xs text-slate-300">
            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="h-6 w-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <p className="font-semibold text-white">Analyzing transaction context with AI...</p>
              <p className="text-[11px] text-slate-400">Evaluating failure category, customer history, and retry boundaries</p>
            </div>
          </div>
        ) : aiError ? (
          <div className="pt-4">
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-xs text-amber-200">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-1">
                  <p className="font-bold text-amber-300 text-sm">AI Assistant: Unable to analyze transaction</p>
                  <p className="text-xs text-slate-300 leading-relaxed"><span className="font-semibold text-amber-200">Reason:</span> {aiError}</p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    ✓ Deterministic REVIVE decision engine and financial safety guardrails remain fully active.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            <div className="space-y-2">
              <p>AI Assistant is ready. Click &ldquo;Re-evaluate with AI&rdquo; to query contextual decision support.</p>
              <p className="text-[11px] text-slate-500">Deterministic REVIVE engine and safety policies remain fully active.</p>
            </div>
          </div>
        )}
      </div>

      {/* Decision Record & Outcome Feedback Banner */}
      {decisionRecord && (
        <div className="bg-slate-900 rounded-2xl p-6 mb-8 text-white shadow-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              <h2 className="text-base font-bold tracking-tight">Outcome Feedback & Decision Record</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                Source: {formatDecisionSource(decisionRecord.decisionSource)}
              </span>
              {decisionRecord.isHumanOverride && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-purple-900/80 text-purple-300 border border-purple-700">
                  Human Override: YES
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Recommended Action</p>
              <p className="text-sm font-bold text-white mt-0.5">{formatActionLabel(decisionRecord.recommendedAction)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actual Action Executed</p>
              <p className="text-sm font-bold text-blue-400 mt-0.5">{formatActionLabel(decisionRecord.actualAction)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actual Outcome</p>
              <p className={`text-sm font-bold mt-0.5 ${
                decisionRecord.outcome === "SUCCESS" ? "text-emerald-400" :
                decisionRecord.outcome === "ESCALATED" ? "text-amber-400" : "text-slate-300"
              }`}>
                {formatNormalizedOutcome(decisionRecord.outcome)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Revenue Recovered</p>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                {decisionRecord.recoveredPaise > 0 ? `+${formatINR(decisionRecord.recoveredPaise)}` : "₹0"}
              </p>
            </div>
          </div>

          {decisionRecord.humanReason && (
            <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">Operator Override Reason:</span>
              &ldquo;{decisionRecord.humanReason}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Complete Decision Audit Trail */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">Audit Trail</span>
                <h2 className="text-xl font-bold text-gray-900">Decision Audit</h2>
              </div>
              <span className="text-xs font-mono font-semibold text-gray-500">
                {auditEvents.length} events recorded
              </span>
            </div>

            {auditEvents.length > 0 ? (
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
                {auditEvents.map((ev, i) => {
                  const isHuman = ev.actor === "HUMAN_OPERATOR";
                  const isRevive = ev.actor === "REVIVE";
                  const isPolicy = ev.actor === "SAFETY_POLICY";
                  const isAI = ev.eventType === "AI_ANALYSIS";
                  const isSuccess = ev.eventType === "RECOVERY_SUCCEEDED";

                  return (
                    <div key={ev.id || i} className="relative pl-6 animate-in fade-in duration-150">
                      <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                        isSuccess ? "bg-emerald-500" :
                        isAI ? "bg-indigo-600" :
                        isHuman ? "bg-purple-600" :
                        isRevive ? "bg-blue-600" :
                        isPolicy ? "bg-amber-500" : "bg-gray-400"
                      }`} />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">{formatAuditEventType(ev.eventType)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            isAI ? "bg-indigo-100 text-indigo-800" :
                            isHuman ? "bg-purple-100 text-purple-800" :
                            isRevive ? "bg-blue-100 text-blue-800" :
                            isPolicy ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"
                          }`}>
                            {formatAuditActor(ev.actor)}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">{formatDate(ev.timestamp)}</span>
                      </div>

                      {ev.action && (
                        <p className="text-xs text-gray-700 mt-1">
                          Action: <span className="font-semibold text-gray-900">{formatActionLabel(ev.action)}</span>
                        </p>
                      )}

                      {ev.reason && (
                        <p className="text-xs text-gray-600 mt-0.5 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          {ev.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                No decision audit events recorded yet for this transaction. Run an experiment or simulate recovery to generate audit records.
              </div>
            )}
          </div>

          {/* Transaction Metadata Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Transaction ID</p>
                <p className="font-mono font-bold text-gray-900 text-sm mt-0.5">{currentTxn.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Transaction Amount</p>
                <p className="text-gray-900 font-bold text-sm mt-0.5">{formatINR(currentTxn.amountPaise)} {currentTxn.currency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Payment Method</p>
                <p className="text-gray-900 text-sm mt-0.5 font-medium">{formatPaymentMethod(currentTxn.paymentMethod)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Customer Segment</p>
                <p className="text-gray-900 text-sm mt-0.5 capitalize font-medium">{currentTxn.customer?.segment || "Consumer"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Initial Attempt</p>
                <p className="text-gray-900 text-xs mt-0.5">{formatTimestamp(currentTxn.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Last Attempt</p>
                <p className="text-gray-900 text-xs mt-0.5">{formatTimestamp(currentTxn.lastAttemptAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Safety & Diagnostics */}
        <div className="space-y-6">
          {/* Safety Guardrail Checks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Safety Guardrails</h2>
            <ul className="space-y-3.5">
              <li className="flex items-center justify-between text-xs">
                <span className="text-gray-700">Duplicate Prevention:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${isDuplicate ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {isDuplicate ? "TRIGGERED (BLOCKED)" : "PASSED"}
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-gray-700">Retry Limit Protection:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${isRetryLimitReached ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {isRetryLimitReached ? "EXHAUSTED" : "PASSED"}
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-gray-700">₹50,000 High-Value Cap:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${isHighValue ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {isHighValue ? "ESCALATE REQ." : "PASSED"}
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-gray-700">Automation Eligibility:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${decision?.allowed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {decision?.allowed ? "ALLOWED" : "RESTRICTED"}
                </span>
              </li>
            </ul>
          </div>

          {/* Failure Diagnostics Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Failure Diagnosis</h2>
            <div className="space-y-4 text-xs">
              <div>
                <p className="text-gray-500 uppercase font-medium">Failure Classification</p>
                <p className="text-gray-900 font-bold text-sm mt-0.5">{formatFailureType(currentTxn.failureType)}</p>
              </div>
              <div>
                <p className="text-gray-500 uppercase font-medium">Retry Progress</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isRecovered ? "bg-emerald-500" : currentTxn.retryCount >= currentTxn.maxRetries ? "bg-red-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(100, (currentTxn.retryCount / currentTxn.maxRetries) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-gray-700">
                    {currentTxn.retryCount} / {currentTxn.maxRetries}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
