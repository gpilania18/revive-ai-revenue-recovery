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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue at Risk</p>
          <p className="text-xl font-bold text-gray-900">{formatINR(revive.totalRevenueAtRiskPaise)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue Recovered</p>
          <p className="text-xl font-bold text-gray-900">{formatINR(revive.revenueRecoveredPaise)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Incremental Recovery</p>
          <p className={`text-xl font-bold ${comparison.incrementalRecoveryPaise > 0 ? "text-emerald-600" : "text-gray-900"}`}>
            {formatINRSigned(comparison.incrementalRecoveryPaise)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Recovery Rate</p>
          <p className="text-xl font-bold text-gray-900">{formatPercent(revive.recoveryRate)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
