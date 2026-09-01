"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafetyBadge } from "@/components/ui/safety-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { RecoveryPerformanceChart } from "@/components/charts/recovery-performance-chart";
import { useRecovery } from "@/context/recovery-context";
import {
  formatINR,
  formatINRSigned,
  formatPercent,
  formatActionLabel,
  formatFailureType,
  formatTimestamp,
  formatDate,
  formatAuditEventType,
  formatAuditActor,
  formatNormalizedOutcome,
} from "@/lib/format";
import { evaluateReviveStrategy } from "@/lib/csv-importer";
import type { PublicTransaction, RecoveryActionType } from "@/lib/types";

export default function RecoveryPage() {
  const {
    baseline,
    revive,
    comparison,
    transactions,
    simulationEvents,
    auditEvents,
    outcomeMetrics,
    experiment,
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

  const strategyStats = useMemo(() => {
    const statsMap: Record<string, { count: number; recoveredAmount: number; successCount: number }> = {
      RETRY_PAYMENT: { count: 0, recoveredAmount: 0, successCount: 0 },
      WAIT_AND_RETRY: { count: 0, recoveredAmount: 0, successCount: 0 },
      REQUEST_PAYMENT_METHOD_UPDATE: { count: 0, recoveredAmount: 0, successCount: 0 },
      DO_NOTHING: { count: 0, recoveredAmount: 0, successCount: 0 },
      ESCALATE: { count: 0, recoveredAmount: 0, successCount: 0 },
    };

    evaluatedTransactions.forEach((txn: PublicTransaction) => {
      const action = evaluateReviveStrategy(txn);
      if (statsMap[action]) {
        statsMap[action].count += 1;
        if (txn.status === "captured") {
          statsMap[action].recoveredAmount += txn.amountPaise;
          statsMap[action].successCount += 1;
        }
      }
    });

    const getStatusLabel = (action: string) => {
      switch (action) {
        case "RETRY_PAYMENT": return "Strong";
        case "WAIT_AND_RETRY": return "Matching";
        case "REQUEST_PAYMENT_METHOD_UPDATE": return "Positive";
        case "DO_NOTHING": return "Protected";
        case "ESCALATE": return "Review";
        default: return "Review";
      }
    };

    return Object.entries(statsMap).map(([action, d]) => ({
      action: action as RecoveryActionType,
      count: d.count,
      recoveredAmount: d.recoveredAmount,
      successRate: d.count > 0 ? d.successCount / d.count : 0,
      statusLabel: getStatusLabel(action),
    }));
  }, [evaluatedTransactions]);

  if (loading) {
    return (
      <DashboardLayout title="Recovery">
        <LoadingState message="Loading recovery control center..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Recovery">
        <ErrorState message="Failed to load recovery dashboard." onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  const improvement =
    baseline.revenueRecoveredPaise > 0
      ? (revive.revenueRecoveredPaise - baseline.revenueRecoveredPaise) / baseline.revenueRecoveredPaise
      : 0;
  const rateDelta = revive.recoveryRate - baseline.recoveryRate;

  return (
    <DashboardLayout title="Recovery" onRefresh={refetchAll}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Recovery Control Center</h1>
              {isExperimentActive ? (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Experiment Active ({experiment.sampleSize} txns)
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  No Active Experiment (Zero State)
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">Monitor simulated recovery actions, policy outcomes, and live interventions.</p>
          </div>
          <SafetyBadge />
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue Recovered"
            value={formatINR(revive.revenueRecoveredPaise)}
            detail={`+${formatPercent(improvement)} vs baseline`}
          />
          <MetricCard
            label="Recovery Rate"
            value={formatPercent(revive.recoveryRate)}
            detail={`+${(rateDelta * 100).toFixed(1)} pts vs baseline`}
            emphasis
          />
          <MetricCard
            label="Successful Interventions"
            value={revive.successfulInterventions.toString()}
            detail={`+${comparison.additionalSuccessfulInterventions} vs baseline`}
          />
          <MetricCard
            label="Incremental Recovery"
            value={formatINRSigned(comparison.incrementalRecoveryPaise)}
            detail="vs baseline strategy"
          />
        </div>

        {/* Live Simulation Execution History */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Experiment Activity & Audit Stream</h2>
              <p className="text-xs text-gray-500 mt-0.5">Chronological decisions and execution outcomes from the current experiment.</p>
            </div>
            <span className="text-xs font-semibold text-gray-600 font-mono">
              {simulationEvents.length} executions · {auditEvents.length} audit milestones
            </span>
          </div>

          {simulationEvents.length > 0 ? (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Transaction ID</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Action Executed</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Outcome</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Revenue Impact</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Reason</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-600">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {simulationEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-mono font-bold text-gray-900">
                        <Link href={`/transactions/${ev.transactionId}`} className="text-blue-600 hover:underline">
                          {ev.transactionId}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-blue-700">{formatActionLabel(ev.action)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ev.outcome === "success" ? "bg-emerald-100 text-emerald-800" :
                          ev.outcome === "escalated" ? "bg-purple-100 text-purple-800" :
                          ev.outcome === "blocked" ? "bg-amber-100 text-amber-800" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {ev.outcome === "success" ? "Success" :
                           ev.outcome === "escalated" ? "Escalated" :
                           ev.outcome === "blocked" ? "Blocked" :
                           ev.outcome === "duplicate_prevented" ? "Duplicate Prevented" :
                           ev.outcome === "skipped" ? "Skipped" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">
                        {ev.recoveredPaise > 0 ? `+${formatINR(ev.recoveredPaise)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{ev.reason}</td>
                      <td className="px-4 py-2.5 text-gray-400">{formatTimestamp(ev.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-gray-500">
              No experiment activity logged yet. Run a batch simulation on the Overview page to generate recovery events.
            </div>
          )}
        </div>

        {/* Recovery Performance Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Experiment Recovery Performance vs Baseline</h2>
          <RecoveryPerformanceChart baselineMetrics={baseline} reviveMetrics={revive} />
        </div>

        {/* Recovery Strategy Breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Strategy Performance Breakdown</h2>
            <p className="text-xs text-gray-500 mt-0.5">Effectiveness across decision categories for current sample.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Strategy</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Success Rate</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recovered</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {strategyStats.map((stat) => (
                  <tr key={stat.action} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatActionLabel(stat.action)}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{stat.count}</td>
                    <td className="px-4 py-3 text-gray-600">{stat.count > 0 ? formatPercent(stat.successRate) : "—"}</td>
                    <td className="px-4 py-3 text-gray-900 font-bold">{formatINR(stat.recoveredAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        stat.statusLabel === "Strong" ? "bg-emerald-50 text-emerald-700" :
                        stat.statusLabel === "Matching" ? "bg-blue-50 text-blue-700" :
                        stat.statusLabel === "Positive" ? "bg-purple-50 text-purple-700" :
                        stat.statusLabel === "Protected" ? "bg-gray-100 text-gray-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>
                        {stat.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
