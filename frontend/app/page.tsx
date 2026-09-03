"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MetricCard } from "@/components/ui/metric-card";
import { StatCard } from "@/components/ui/stat-card";
import { ComparisonBar } from "@/components/ui/comparison-bar";
import { SafetyBadge } from "@/components/ui/safety-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { RecoveryPerformanceChart } from "@/components/charts/recovery-performance-chart";
import { useRecovery } from "@/context/recovery-context";
import { formatINR, formatINRSigned, formatPercent, formatPercentDelta, formatActionLabel, formatFailureType, formatAIFailureCategory } from "@/lib/format";
import { getCustomTransactions } from "@/lib/csv-importer";

export default function OverviewPage() {
  const {
    baseline,
    revive,
    comparison,
    experiment,
    isExperimentActive,
    runBatchExperiment,
    resetExperiment,
    loading,
    error,
    refetchAll,
    analyzeTransaction,
    simulateRecovery,
    getDecision,
    getAIAnalysis,
    getAIError,
    isAnalyzing,
    isSimulating,
    activeSimulationResult,
  } = useRecovery();

  const [sampleSize, setSampleSize] = useState<number>(50);
  const [datasetMode, setDatasetMode] = useState<"generated" | "imported">("generated");
  const [customTxnCount, setCustomTxnCount] = useState<number>(0);
  const [txnInput, setTxnInput] = useState("txn_003");
  const [analyzedId, setAnalyzedId] = useState<string | null>("txn_003");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const custom = getCustomTransactions();
      setCustomTxnCount(custom.length);
      if (custom.length > 0 && experiment.datasetSource === "imported") {
        setDatasetMode("imported");
      }
    }
  }, [experiment.datasetSource]);

  // Directly derive active decision and AI analysis from context
  const activeDecision = analyzedId ? getDecision(analyzedId) : null;
  const activeAIAnalysis = analyzedId ? getAIAnalysis(analyzedId) : undefined;
  const activeAIError = analyzedId ? getAIError(analyzedId) : undefined;
  const isCurrentAnalyzing = analyzedId ? !!isAnalyzing[analyzedId] : false;
  const isCurrentSimulating = analyzedId ? !!isSimulating[analyzedId] : false;
  const isBatchRunning = experiment.status === "RUNNING";

  const handleRunBatch = async () => {
    setBatchError(null);
    try {
      if (datasetMode === "imported") {
        const custom = getCustomTransactions();
        if (custom.length === 0) {
          throw new Error("No imported CSV transactions found. Please import transactions via the Transactions page.");
        }
        await runBatchExperiment({
          mode: "imported",
          transactions: custom,
          sampleSize: custom.length,
        });
      } else {
        await runBatchExperiment({
          mode: "generated",
          sampleSize,
          seed: 42,
        });
      }
    } catch (err: unknown) {
      setBatchError(err instanceof Error ? err.message : "Batch simulation failed");
    }
  };

  const handleReset = () => {
    if (confirm("Reset current experiment? All metrics and simulation events will return to ZERO.")) {
      resetExperiment();
    }
  };

  const handleAnalyze = useCallback(
    async (idToAnalyze?: string) => {
      const targetId = (idToAnalyze || txnInput).trim();
      if (!targetId) return;

      setAnalyzedId(targetId);
      setAnalysisError(null);

      try {
        await analyzeTransaction(targetId);
      } catch (err: unknown) {
        setAnalysisError(err instanceof Error ? err.message : "Transaction lookup failed");
      }
    },
    [txnInput, analyzeTransaction]
  );

  const handleSimulate = useCallback(async () => {
    if (!analyzedId) return;
    try {
      await simulateRecovery(analyzedId);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Simulation failed");
    }
  }, [analyzedId, simulateRecovery]);

  if (loading) {
    return (
      <DashboardLayout title="Overview">
        <LoadingState message="Loading recovery experiment environment..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Overview">
        <ErrorState message={error} onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Overview" onRefresh={refetchAll}>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Recovery Simulator</h1>
            <p className="mt-1 text-sm text-gray-500">
              Run batch recovery experiments comparing Baseline vs. REVIVE on the same transaction sample.
            </p>
          </div>
          <SafetyBadge />
        </div>
      </div>

      {/* Experiment Control Console */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6 mb-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-lg font-bold tracking-tight">Experiment & Batch Simulation Console</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Select a dataset source to evaluate transactions under both Baseline and REVIVE strategies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
              {isExperimentActive
                ? experiment.datasetSource === "imported"
                  ? `Dataset: Imported CSV (${experiment.sampleSize} txns)`
                  : `Seed: ${experiment.seed ?? 42} (Generated)`
                : datasetMode === "imported"
                ? `Dataset: Imported CSV (${customTxnCount} txns)`
                : "Seed: 42 (Generated)"}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                isExperimentActive
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {isExperimentActive
                ? `ACTIVE: ${experiment.sampleSize} TRANSACTIONS (${experiment.datasetSource === "imported" ? "IMPORTED CSV" : "GENERATED"})`
                : "READY (ZERO STATE)"}
            </span>
          </div>
        </div>

        {/* Console Controls */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Dataset Source Toggle */}
            {customTxnCount > 0 && (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2">
                <label htmlFor="dataset-mode" className="text-xs font-medium text-slate-300 whitespace-nowrap">
                  Dataset:
                </label>
                <select
                  id="dataset-mode"
                  value={datasetMode}
                  onChange={(e) => setDatasetMode(e.target.value as "generated" | "imported")}
                  disabled={isBatchRunning}
                  className="bg-slate-900 border border-slate-600 text-white text-xs font-bold rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                >
                  <option value="generated">Generated Dataset (Seed 42)</option>
                  <option value="imported">Imported CSV ({customTxnCount} txns)</option>
                </select>
              </div>
            )}

            {datasetMode === "generated" ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2">
                <label htmlFor="sample-size" className="text-xs font-medium text-slate-300 whitespace-nowrap">
                  Sample Size:
                </label>
                <select
                  id="sample-size"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  disabled={isBatchRunning}
                  className="bg-slate-900 border border-slate-600 text-white text-xs font-bold rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                >
                  <option value={10}>10 transactions</option>
                  <option value={25}>25 transactions</option>
                  <option value={50}>50 transactions</option>
                  <option value={100}>100 transactions</option>
                  <option value={200}>200 transactions (Full)</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2">
                <span className="text-xs font-medium text-slate-300">Target Sample:</span>
                <span className="text-xs font-mono font-bold text-indigo-300">
                  All {customTxnCount} Imported Transactions
                </span>
              </div>
            )}

            <button
              onClick={handleRunBatch}
              disabled={isBatchRunning || (datasetMode === "imported" && customTxnCount === 0)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
            >
              {isBatchRunning ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>
                    Simulating {experiment.progress?.current || 0} / {datasetMode === "imported" ? customTxnCount : sampleSize}...
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {datasetMode === "imported"
                      ? `Simulate Imported Batch (${customTxnCount})`
                      : `Simulate All (${sampleSize})`}
                  </span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleReset}
            disabled={isBatchRunning || !isExperimentActive}
            className="px-4 py-2 text-xs font-semibold text-red-300 hover:text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-800/80 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm self-start sm:self-auto"
          >
            Reset Experiment (Zero State)
          </button>
        </div>

        {batchError && (
          <div className="mt-4 p-3 rounded-xl bg-red-900/40 border border-red-800 text-xs text-red-300">
            {batchError}
          </div>
        )}
      </div>

      {/* Primary Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <MetricCard
          icon={<CurrencyIcon />}
          label="Revenue Recovered"
          value={formatINR(revive.revenueRecoveredPaise)}
          detail={`Baseline ${formatINR(baseline.revenueRecoveredPaise)}`}
          tooltip="Total transaction value from successfully recovered payments."
        />
        <MetricCard
          icon={<TrendUpIcon />}
          label="Incremental Recovery"
          value={formatINRSigned(comparison.incrementalRecoveryPaise)}
          detail="vs baseline on same sample"
          tooltip="Additional revenue recovered compared to baseline strategy."
          emphasis
        />
        <MetricCard
          icon={<PercentIcon />}
          label="Revenue Recovery Rate"
          value={formatPercent(revive.recoveryRate)}
          detail={`${formatPercentDelta(comparison.incrementalRecoveryRate)} vs baseline`}
          tooltip="Recovered revenue divided by total revenue at risk."
        />
        <MetricCard
          icon={<CheckIcon />}
          label="Successful Interventions"
          value={revive.successfulInterventions.toString()}
          detail={`+${comparison.additionalSuccessfulInterventions} additional vs baseline`}
          tooltip="Count of actual successful recovery outcomes across the evaluated sample."
        />
      </div>

      {/* Recovery Performance Chart */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 mb-8">
        <div className="mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Current Experiment Performance</h2>
          <p className="text-sm text-gray-500">
            {isExperimentActive
              ? `Direct comparison over ${experiment.sampleSize} evaluated transactions.`
              : "No experiment active. Run Simulate All above to view performance."}
          </p>
        </div>
        <RecoveryPerformanceChart
          baselineMetrics={baseline}
          reviveMetrics={revive}
        />
      </div>

      {/* Baseline vs Revive Comparison Bars */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 mb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Baseline vs Revive (Sample Comparison)</h2>
            <p className="text-sm text-gray-500">Evaluating the exact same transactions under both policies.</p>
          </div>
          {isExperimentActive && (
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              Sample: {experiment.sampleSize} txns
            </span>
          )}
        </div>
        <div className="space-y-6">
          <ComparisonBar
            label="Revenue recovered"
            baselineValue={baseline.revenueRecoveredPaise}
            reviveValue={revive.revenueRecoveredPaise}
            formatValue={(v) => formatINR(v)}
          />
          <ComparisonBar
            label="Recovery rate"
            baselineValue={baseline.recoveryRate * 10000}
            reviveValue={revive.recoveryRate * 10000}
            formatValue={(v) => formatPercent(v / 10000)}
          />
          <ComparisonBar
            label="Successful interventions"
            baselineValue={baseline.successfulInterventions}
            reviveValue={revive.successfulInterventions}
            formatValue={(v) => v.toString()}
          />
          <ComparisonBar
            label="Blocked actions"
            baselineValue={baseline.blockedActions}
            reviveValue={revive.blockedActions}
            formatValue={(v) => v.toString()}
          />
          <ComparisonBar
            label="Escalations"
            baselineValue={baseline.escalationCount}
            reviveValue={revive.escalationCount}
            formatValue={(v) => v.toString()}
          />
        </div>
      </div>

      {/* Single Transaction Simulation Suite */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg p-6 mb-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold">Individual Transaction Simulation</h2>
          </div>
          <span className="text-xs text-blue-400 font-medium">Single-Case Diagnostics</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Test and inspect individual failure cases, safety guardrails, and simulation execution step-by-step.
        </p>

        {/* Quick Sample Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-slate-400">Quick Test Scenarios:</span>
          {[
            { id: "txn_003", label: "txn_003 (Insufficient Funds - ₹12,450)" },
            { id: "txn_002", label: "txn_002 (Temporary Issuer Failure - ₹8,900)" },
            { id: "txn_001", label: "txn_001 (Hard Decline - ₹24,700)" },
            { id: "txn_004", label: "txn_004 (High Value - ₹75,000)" },
          ].map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setTxnInput(sample.id);
                handleAnalyze(sample.id);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                txnInput === sample.id
                  ? "bg-blue-600 border-blue-500 text-white font-medium shadow-sm"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Input & Analyze Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            value={txnInput}
            onChange={(e) => setTxnInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="e.g. txn_003"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <button
            onClick={() => handleAnalyze()}
            disabled={isCurrentAnalyzing || !txnInput.trim()}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isCurrentAnalyzing ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Analyze Transaction</span>
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {analysisError && (
          <div className="mb-4 rounded-xl border border-red-800/50 bg-red-900/30 p-3 text-xs text-red-300 flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{analysisError}</span>
          </div>
        )}

        {/* Analysis Verdict & Simulation Panel */}
        {activeDecision ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">{activeDecision.transaction.id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-300 font-medium">{formatFailureType(activeDecision.transaction.failureType)}</span>
                  </div>
                  <p className="text-lg font-bold text-white mt-1">
                    {activeDecision.transaction.paymentMethod} · {formatINR(activeDecision.transaction.amountPaise)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Retry Attempts: <span className="text-white font-mono font-medium">{activeDecision.transaction.retryCount} / {activeDecision.transaction.maxRetries}</span>
                    {" "}· Status: <span className="uppercase text-slate-200 font-semibold">{activeDecision.transaction.status}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      activeDecision.decision.allowed
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                        : "bg-red-950/80 text-red-400 border border-red-800"
                    }`}
                  >
                    {activeDecision.decision.allowed ? "✓ SAFETY POLICY: ALLOWED" : "✕ SAFETY POLICY: BLOCKED"}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Recommended: {formatActionLabel(activeDecision.decision.action)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block mb-1">
                  Policy Evaluation
                </span>
                {activeDecision.decision.reason}
              </div>

              {/* Contextual AI Assistant Support Card */}
              {activeAIAnalysis ? (
                <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/60 to-slate-900/90 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span className="text-xs font-bold text-indigo-300">AI Assistant (Decision Support)</span>
                      {activeAIAnalysis.failureClassification && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-900/90 text-indigo-200 border border-indigo-700">
                          {formatAIFailureCategory(activeAIAnalysis.failureClassification.category)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">Non-authoritative</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">AI Suggestion</span>
                      <span className="font-bold text-white">{formatActionLabel(activeAIAnalysis.recommendedAction)}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Confidence</span>
                      <span className="font-mono font-bold text-indigo-300">{formatPercent(activeAIAnalysis.confidence)}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Recovery Prob.</span>
                      <span className="font-mono font-bold text-emerald-300">{formatPercent(activeAIAnalysis.recoveryProbability)}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Risk Score</span>
                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        activeAIAnalysis.riskScore === "LOW" ? "bg-emerald-950 text-emerald-300" :
                        activeAIAnalysis.riskScore === "MEDIUM" ? "bg-amber-950 text-amber-300" : "bg-red-950 text-red-300"
                      }`}>
                        {activeAIAnalysis.riskScore}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-800/60 leading-relaxed">
                    &ldquo;{activeAIAnalysis.reason}&rdquo;
                  </p>

                  {activeAIAnalysis.expectedOutcome && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>Outcome Est: {activeAIAnalysis.expectedOutcome.summary}</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatPercent(activeAIAnalysis.expectedOutcome.successProbability)}
                      </span>
                    </div>
                  )}
                </div>
              ) : activeAIError ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-0.5">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>AI Assistant Unavailable</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{activeAIError}</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSimulate}
                    disabled={isCurrentSimulating || activeDecision.transaction.status === "captured"}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                      activeDecision.transaction.status === "captured"
                        ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800 cursor-not-allowed"
                        : activeDecision.decision.allowed
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-amber-600 hover:bg-amber-500 text-white"
                    }`}
                  >
                    {isCurrentSimulating ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        <span>Simulating Recovery...</span>
                      </>
                    ) : activeDecision.transaction.status === "captured" ? (
                      <>
                        <span>✓ Already Recovered</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Simulate Recovery</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={`/transactions/${activeDecision.transaction.id}`}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline font-medium"
                  >
                    View Full Details & Timeline &rarr;
                  </Link>
                </div>

                {activeSimulationResult && activeSimulationResult.transactionId === activeDecision.transaction.id && (
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150 ${
                    activeSimulationResult.outcome === "success"
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                      : activeSimulationResult.outcome === "escalated"
                      ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                      : "bg-red-900/60 text-red-300 border border-red-700"
                  }`}>
                    <span>Result:</span>
                    <span className="uppercase">{activeSimulationResult.outcome}</span>
                    {activeSimulationResult.recoveredPaise > 0 && (
                      <span className="font-bold">({formatINR(activeSimulationResult.recoveredPaise)} captured)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-8 text-center text-xs text-slate-500">
            Enter a transaction ID or click one of the quick test scenarios above to run analysis.
          </div>
        )}
      </div>

      {/* Operational Insights */}
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Operational Breakdown</h2>
        <p className="text-sm text-gray-500">Current experiment session statistics.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<EscalationIcon />}
          label="Escalations"
          value={revive.escalationCount}
          description="Cases routed for human review"
          color="amber"
        />
        <StatCard
          icon={<BlockedIcon />}
          label="Blocked Actions"
          value={revive.blockedActions}
          description="Unsafe actions prevented"
          color="red"
        />
        <StatCard
          icon={<TransactionsIcon />}
          label="Transactions Evaluated"
          value={revive.transactionCount}
          description={`Sample size in current session`}
          color="blue"
        />
        <StatCard
          icon={<DuplicateIcon />}
          label="Duplicate Prevention"
          value={revive.duplicatePreventionCount}
          description="Duplicate payments prevented"
          color="emerald"
        />
      </div>
    </DashboardLayout>
  );
}

/* Inline SVG Icons */
function CurrencyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function TrendUpIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
function PercentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function EscalationIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function BlockedIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}
function TransactionsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function DuplicateIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
