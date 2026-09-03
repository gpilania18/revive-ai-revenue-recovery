"use client";

import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FailureDistributionChart } from "@/components/charts/failure-distribution-chart";
import { OutcomeDistributionChart } from "@/components/charts/outcome-distribution-chart";
import { RecoveryPerformanceChart } from "@/components/charts/recovery-performance-chart";
import { useRecovery } from "@/context/recovery-context";
import { formatINR, formatINRSigned, formatPercent, formatPercentDelta } from "@/lib/format";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function AnalyticsPage() {
  const {
    baseline,
    revive,
    comparison,
    transactions,
    experiment,
    outcomeMetrics,
    aiAnalyses,
    decisionRecords,
    isExperimentActive,
    loading,
    error,
    refetchAll,
  } = useRecovery();

  const evaluatedTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!isExperimentActive) return [];
    return transactions.filter((t) => experiment.transactionIds.includes(t.id));
  }, [transactions, isExperimentActive, experiment.transactionIds]);

  // Authoritative dynamic calculation of AI Outcome Evaluation metrics
  const aiEvaluationMetrics = useMemo(() => {
    const analyzedIds = Object.keys(aiAnalyses || {}).filter((id) => aiAnalyses[id] !== undefined);

    Object.entries(decisionRecords || {}).forEach(([id, rec]) => {
      if (rec.aiConfidence !== undefined && !analyzedIds.includes(id)) {
        analyzedIds.push(id);
      }
    });

    const totalAnalyzed = analyzedIds.length;

    if (totalAnalyzed === 0) {
      return {
        totalAnalyzed: 0,
        predictionsEvaluated: 0,
        correctPredictions: 0,
        accuracy: null as number | null,
        avgConfidence: 0,
        avgRecoveryProbability: 0,
        reviewRecommendedCount: 0,
        unsafeActionsPrevented: 0,
        outcomesBreakdown: {
          successPredictedSuccessObserved: 0,
          successPredictedFailureObserved: 0,
          failurePredictedFailureObserved: 0,
          failurePredictedSuccessObserved: 0,
        },
      };
    }

    let confidenceSum = 0;
    let recoveryProbSum = 0;
    let reviewRecommendedCount = 0;
    let unsafeActionsPrevented = 0;

    let predictionsEvaluated = 0;
    let correctPredictions = 0;

    const breakdown = {
      successPredictedSuccessObserved: 0,
      successPredictedFailureObserved: 0,
      failurePredictedFailureObserved: 0,
      failurePredictedSuccessObserved: 0,
    };

    analyzedIds.forEach((id) => {
      const ai = aiAnalyses?.[id];
      const rec = decisionRecords?.[id];

      const confidence = ai?.confidence ?? rec?.aiConfidence ?? 0;
      const recoveryProb = ai?.recoveryProbability ?? rec?.recoveryProbability ?? 0;
      const reviewNeeded =
        ai?.humanAdvice?.reviewNeeded ??
        rec?.aiHumanReviewNeeded ??
        (ai?.recommendedAction === "ESCALATE" || rec?.aiRecommendedAction === "ESCALATE");

      confidenceSum += confidence;
      recoveryProbSum += recoveryProb;

      if (reviewNeeded) {
        reviewRecommendedCount += 1;
      }

      // Cases where AI suggested executable action but REVIVE safety policy blocked it
      const aiAction = ai?.recommendedAction ?? rec?.aiRecommendedAction;
      const isExecutableAction = aiAction === "RETRY_PAYMENT" || aiAction === "WAIT_AND_RETRY";
      const policyBlocked = rec ? !rec.decisionAllowed || rec.outcome === "BLOCKED" : false;
      if (isExecutableAction && policyBlocked) {
        unsafeActionsPrevented += 1;
      }

      // Check observed terminal outcome (SUCCESS or FAILED)
      const observedOutcome = rec?.outcome;
      if (observedOutcome === "SUCCESS" || observedOutcome === "FAILED") {
        predictionsEvaluated += 1;

        const expectedSuccess = (ai?.expectedOutcome?.successProbability ?? recoveryProb) >= 0.5;
        const observedSuccess = observedOutcome === "SUCCESS";

        if (expectedSuccess && observedSuccess) {
          correctPredictions += 1;
          breakdown.successPredictedSuccessObserved += 1;
        } else if (expectedSuccess && !observedSuccess) {
          breakdown.successPredictedFailureObserved += 1;
        } else if (!expectedSuccess && !observedSuccess) {
          correctPredictions += 1;
          breakdown.failurePredictedFailureObserved += 1;
        } else if (!expectedSuccess && observedSuccess) {
          breakdown.failurePredictedSuccessObserved += 1;
        }
      }
    });

    const avgConfidence = totalAnalyzed > 0 ? confidenceSum / totalAnalyzed : 0;
    const avgRecoveryProbability = totalAnalyzed > 0 ? recoveryProbSum / totalAnalyzed : 0;
    const accuracy = predictionsEvaluated > 0 ? correctPredictions / predictionsEvaluated : null;

    return {
      totalAnalyzed,
      predictionsEvaluated,
      correctPredictions,
      accuracy,
      avgConfidence,
      avgRecoveryProbability,
      reviewRecommendedCount,
      unsafeActionsPrevented,
      outcomesBreakdown: breakdown,
    };
  }, [aiAnalyses, decisionRecords]);

  if (loading) {
    return (
      <DashboardLayout title="Analytics">
        <LoadingState message="Loading analytics data..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Analytics">
        <ErrorState message={error || "Failed to load analytics"} onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" onRefresh={refetchAll}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1 text-sm">Experiment performance analysis and outcome breakdowns.</p>
        </div>
        {isExperimentActive ? (
          <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
            Sample Size: {experiment.sampleSize} Transactions
          </span>
        ) : (
          <span className="text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1 rounded-full self-start sm:self-auto">
            Zero State (No Experiment Active)
          </span>
        )}
      </div>

      {/* Primary Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" title="Total monetary value of failed transactions in the current experiment sample.">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue at Risk</p>
          <p className="text-xl font-bold text-gray-900">{formatINR(revive.totalRevenueAtRiskPaise)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" title="Total transaction value from successfully recovered payments.">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue Recovered</p>
          <p className="text-xl font-bold text-gray-900">{formatINR(revive.revenueRecoveredPaise)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" title="Additional revenue recovered compared to baseline strategy.">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Incremental Recovery</p>
          <p className={`text-xl font-bold ${comparison.incrementalRecoveryPaise > 0 ? "text-emerald-600" : "text-gray-900"}`}>
            {formatINRSigned(comparison.incrementalRecoveryPaise)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" title="Recovered revenue divided by total revenue at risk.">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue Recovery Rate</p>
          <p className="text-xl font-bold text-gray-900">{formatPercent(revive.recoveryRate)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" title="Count of actual successful recovery outcomes across the evaluated sample.">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Successful Interventions</p>
          <p className="text-xl font-bold text-gray-900">{revive.successfulInterventions}</p>
        </div>
      </div>

      {/* Decision & Outcome Effectiveness Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Decision & Outcome Effectiveness</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tracking decision quality, escalation accuracy, and operator overrides.</p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
            {outcomeMetrics.totalDecisions} Evaluated Decisions
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[11px] text-gray-500 uppercase font-semibold">Total Decisions</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{outcomeMetrics.totalDecisions}</p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <p className="text-[11px] text-emerald-800 uppercase font-semibold">Recoveries</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{outcomeMetrics.successfulRecoveries}</p>
          </div>
          <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
            <p className="text-[11px] text-red-800 uppercase font-semibold">Failed Attempts</p>
            <p className="text-xl font-bold text-red-700 mt-1">{outcomeMetrics.failedRecoveries}</p>
          </div>
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
            <p className="text-[11px] text-amber-800 uppercase font-semibold">Escalations</p>
            <p className="text-xl font-bold text-amber-700 mt-1">{outcomeMetrics.escalations}</p>
          </div>
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
            <p className="text-[11px] text-purple-800 uppercase font-semibold">Human Overrides</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{outcomeMetrics.humanOverrides}</p>
          </div>
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <p className="text-[11px] text-blue-800 uppercase font-semibold">Decision Success</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatPercent(outcomeMetrics.decisionSuccessRate)}</p>
          </div>
        </div>
      </div>

      {/* AI Outcome Evaluation Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">AI Outcome Evaluation</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Advisory Layer
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">How AI predictions compare with observed recovery outcomes.</p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 self-start sm:self-auto">
            {aiEvaluationMetrics.totalAnalyzed} Analyzed Cases
          </span>
        </div>

        {aiEvaluationMetrics.totalAnalyzed === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
            <p className="text-sm font-medium text-slate-600">No AI evaluations recorded in this session.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Analyze individual transactions in Transaction Details or the Human Review queue to evaluate AI prediction accuracy against observed outcomes.
            </p>
          </div>
        ) : (
          <div>
            {/* Primary AI Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100" title="Total transactions with recorded AI intelligence analysis.">
                <p className="text-[11px] text-gray-500 uppercase font-semibold">Analyzed</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{aiEvaluationMetrics.totalAnalyzed}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100" title="AI analyses where an actual observed transaction outcome has occurred.">
                <p className="text-[11px] text-slate-600 uppercase font-semibold">Evaluated</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{aiEvaluationMetrics.predictionsEvaluated}</p>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100" title="Correct outcome predictions divided by total evaluated predictions.">
                <p className="text-[11px] text-indigo-800 uppercase font-semibold">Prediction Accuracy</p>
                <p className="text-xl font-bold text-indigo-700 mt-1">
                  {aiEvaluationMetrics.accuracy !== null ? formatPercent(aiEvaluationMetrics.accuracy) : "—"}
                </p>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100" title="Average model confidence across recorded AI analyses.">
                <p className="text-[11px] text-blue-800 uppercase font-semibold">Avg AI Confidence</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{formatPercent(aiEvaluationMetrics.avgConfidence)}</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100" title="Average AI-estimated recovery probability; advisory estimate separate from actual recovered revenue.">
                <p className="text-[11px] text-emerald-800 uppercase font-semibold">Avg Recovery Prob</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatPercent(aiEvaluationMetrics.avgRecoveryProbability)}</p>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100" title="Number of cases where AI recommended human operator review or escalation.">
                <p className="text-[11px] text-amber-800 uppercase font-semibold">Review Advised</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{aiEvaluationMetrics.reviewRecommendedCount}</p>
              </div>
            </div>

            {/* Guardrails & Compact Outcome Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Policy Guardrails Triggered</span>
                  <span className="text-sm font-bold text-slate-900">{aiEvaluationMetrics.unsafeActionsPrevented}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Executable AI suggestions held or blocked by deterministic REVIVE safety rules before financial action.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
                  Prediction vs Observed Outcome Breakdown
                </span>
                {aiEvaluationMetrics.predictionsEvaluated > 0 ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-white border border-slate-100">
                      <span className="text-slate-600">Expected Success &rarr; Success:</span>
                      <span className="font-bold text-emerald-700">{aiEvaluationMetrics.outcomesBreakdown.successPredictedSuccessObserved}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-white border border-slate-100">
                      <span className="text-slate-600">Expected Success &rarr; Failure:</span>
                      <span className="font-bold text-red-700">{aiEvaluationMetrics.outcomesBreakdown.successPredictedFailureObserved}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-white border border-slate-100">
                      <span className="text-slate-600">Expected Failure &rarr; Failure:</span>
                      <span className="font-bold text-emerald-700">{aiEvaluationMetrics.outcomesBreakdown.failurePredictedFailureObserved}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-white border border-slate-100">
                      <span className="text-slate-600">Expected Failure &rarr; Success:</span>
                      <span className="font-bold text-amber-700">{aiEvaluationMetrics.outcomesBreakdown.failurePredictedSuccessObserved}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Awaiting observed terminal outcomes for analyzed transactions to populate prediction breakdown.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Failure Type Distribution</h2>
          <div className="h-[300px]">
            {evaluatedTransactions.length > 0 ? (
              <FailureDistributionChart transactions={evaluatedTransactions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                No experiment data yet
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recovery Outcome Distribution</h2>
          <div className="h-[300px]">
            {isExperimentActive && revive.transactionCount > 0 ? (
              <OutcomeDistributionChart metrics={revive} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                No experiment data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Experiment Performance Comparison</h2>
        <RecoveryPerformanceChart baselineMetrics={baseline} reviveMetrics={revive} />
      </div>

      {/* Detailed Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Detailed Comparison (Baseline vs REVIVE)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="py-3 px-4 text-sm font-semibold text-gray-900">Metric</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">Baseline</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">Revive</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Transaction Count</td>
                <td className="py-3 px-4 text-gray-900 text-right">{baseline.transactionCount}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{revive.transactionCount}</td>
                <td className="py-3 px-4 text-gray-500 text-right">&mdash;</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Revenue at Risk</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatINR(baseline.totalRevenueAtRiskPaise)}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatINR(revive.totalRevenueAtRiskPaise)}</td>
                <td className="py-3 px-4 text-gray-500 text-right">&mdash;</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Revenue Recovered</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatINR(baseline.revenueRecoveredPaise)}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatINR(revive.revenueRecoveredPaise)}</td>
                <td className="py-3 px-4 font-medium text-right text-emerald-600">
                  {formatINRSigned(comparison.incrementalRecoveryPaise)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Recovery Rate</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatPercent(baseline.recoveryRate)}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{formatPercent(revive.recoveryRate)}</td>
                <td className={`py-3 px-4 font-medium text-right ${comparison.incrementalRecoveryRate > 0 ? "text-emerald-600" : "text-gray-500"}`}>
                  {formatPercentDelta(comparison.incrementalRecoveryRate)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Successful Interventions</td>
                <td className="py-3 px-4 text-gray-900 text-right">{baseline.successfulInterventions}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{revive.successfulInterventions}</td>
                <td className="py-3 px-4 font-medium text-right text-emerald-600">
                  +{comparison.additionalSuccessfulInterventions}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Blocked Actions</td>
                <td className="py-3 px-4 text-gray-900 text-right">{baseline.blockedActions}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{revive.blockedActions}</td>
                <td className="py-3 px-4 text-gray-500 text-right">&mdash;</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Escalations</td>
                <td className="py-3 px-4 text-gray-900 text-right">{baseline.escalationCount}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{revive.escalationCount}</td>
                <td className="py-3 px-4 text-gray-500 text-right">&mdash;</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-gray-600 font-medium">Duplicate Prevention</td>
                <td className="py-3 px-4 text-gray-900 text-right">{baseline.duplicatePreventionCount}</td>
                <td className="py-3 px-4 text-gray-900 text-right">{revive.duplicatePreventionCount}</td>
                <td className="py-3 px-4 text-gray-500 text-right">&mdash;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
