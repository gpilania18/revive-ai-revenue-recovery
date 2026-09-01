"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafetyBadge } from "@/components/ui/safety-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { CsvImportModal } from "@/components/transactions/csv-import-modal";
import { useRecovery } from "@/context/recovery-context";
import { formatINR, formatFailureType, formatPaymentMethod } from "@/lib/format";
import { getCustomTransactions, clearCustomTransactions } from "@/lib/csv-importer";
import type { PublicTransaction, FailureType } from "@/lib/types";

export default function TransactionsPage() {
  const {
    transactions,
    loading,
    error,
    refetchAll,
    simulateRecovery,
    isTransactionInExperiment,
    isExperimentActive,
    experiment,
    resetExperiment,
    getEffectiveStatus,
  } = useRecovery();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [failureTypeFilter, setFailureTypeFilter] = useState("ALL");
  const [experimentFilter, setExperimentFilter] = useState("ALL");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeSimulatingId, setActiveSimulatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [customTxnIds, setCustomTxnIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const custom = getCustomTransactions();
    setCustomTxnIds(new Set(custom.map((t) => t.id)));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((txn: PublicTransaction) => {
      const effStatus = getEffectiveStatus(txn).toLowerCase();
      const matchesSearch = txn.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        statusFilter === "ALL" ||
        effStatus === statusFilter.toLowerCase() ||
        ((statusFilter === "captured" || statusFilter === "recovered") && effStatus === "recovered") ||
        (statusFilter === "failed" && (effStatus === "failed" || effStatus === "created"));

      const matchesFailureType = failureTypeFilter === "ALL" || txn.failureType === failureTypeFilter;
      const inExp = isTransactionInExperiment(txn.id);
      const matchesExp =
        experimentFilter === "ALL" ||
        (experimentFilter === "EXP" && inExp) ||
        (experimentFilter === "NON_EXP" && !inExp);

      return matchesSearch && matchesStatus && matchesFailureType && matchesExp;
    });
  }, [transactions, searchTerm, statusFilter, failureTypeFilter, experimentFilter, isTransactionInExperiment, getEffectiveStatus]);

  const uniqueFailureTypes = useMemo(() => {
    if (!transactions) return [];
    const types = new Set(transactions.map((t: PublicTransaction) => t.failureType));
    return Array.from(types) as FailureType[];
  }, [transactions]);

  const handleQuickSimulate = async (txn: PublicTransaction) => {
    setActiveSimulatingId(txn.id);
    try {
      const sim = await simulateRecovery(txn.id);
      if (sim.outcome === "success") {
        setNotification({
          message: `Successfully recovered ${txn.id}: ${formatINR(sim.recoveredPaise)} captured!`,
          type: "success",
        });
      } else {
        setNotification({
          message: `Simulation for ${txn.id}: ${sim.outcome.toUpperCase()} (${sim.reason})`,
          type: "info",
        });
      }
    } catch (err: unknown) {
      setNotification({
        message: err instanceof Error ? err.message : "Simulation failed",
        type: "info",
      });
    } finally {
      setActiveSimulatingId(null);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleResetAll = () => {
    if (confirm("Reset current experiment? All transaction states and simulation metrics will return to ZERO.")) {
      resetExperiment();
      setNotification({ message: "Current experiment reset to zero.", type: "info" });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleClearCustom = () => {
    clearCustomTransactions();
    setCustomTxnIds(new Set());
    refetchAll();
    setNotification({ message: "Cleared imported CSV transactions.", type: "info" });
    setTimeout(() => setNotification(null), 4000);
  };

  if (loading) {
    return (
      <DashboardLayout title="Transactions">
        <LoadingState message="Loading transactions..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Transactions">
        <ErrorState message="Failed to load transactions. Make sure the backend is running." onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Transactions" onRefresh={refetchAll}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
              {isExperimentActive && (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Experiment Active ({experiment.sampleSize} txns)
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">Review failed payments, inspect experiment participation, and execute simulations.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import CSV
            </button>
            <button
              onClick={handleResetAll}
              className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl transition-all shadow-sm"
              title="Reset current experiment session"
            >
              Reset Experiment
            </button>
            <SafetyBadge />
          </div>
        </div>

        {/* Live Notification Banner */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl flex items-center justify-between text-sm animate-in fade-in duration-200 ${
              notification.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-xs font-bold underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Transactions Table Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Payment Activity</h2>
                {customTxnIds.size > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {customTxnIds.size} CSV Imported
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Live evaluated payments from the current dataset.</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-gray-600">{filteredTransactions.length} transactions</span>
                </div>
                {customTxnIds.size > 0 && (
                  <button
                    onClick={handleClearCustom}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium"
                  >
                    Clear CSV Imports
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search transaction ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 min-w-[160px]"
              />
              <select
                value={experimentFilter}
                onChange={(e) => setExperimentFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="ALL">All sample items</option>
                <option value="EXP">In Current Experiment</option>
                <option value="NON_EXP">Not in Experiment</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="ALL">All statuses</option>
                <option value="escalated">Escalated</option>
                <option value="recovered">Recovered</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
                <option value="authorized">Authorized</option>
                <option value="created">Created</option>
              </select>
              <select
                value={failureTypeFilter}
                onChange={(e) => setFailureTypeFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="ALL">All failure types</option>
                {uniqueFailureTypes.map((type) => (
                  <option key={type} value={type}>{formatFailureType(type)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Failure Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Retry Progress</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((txn: PublicTransaction) => {
                    const isCustom = customTxnIds.has(txn.id);
                    const effectiveStatus = getEffectiveStatus(txn);
                    const isRecovered = effectiveStatus === "recovered";
                    const isProcessing = activeSimulatingId === txn.id;
                    const inCurrentExp = isTransactionInExperiment(txn.id);

                    return (
                      <tr key={txn.id} className={`hover:bg-gray-50 transition-colors ${isRecovered ? "bg-emerald-50/20" : isCustom ? "bg-blue-50/20" : ""}`}>
                        <td className="px-4 py-3 font-mono text-gray-700">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                            <span className="font-semibold text-gray-900">{txn.id}</span>
                            <div className="flex items-center gap-1">
                              {inCurrentExp && (
                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                  Current Experiment
                                </span>
                              )}
                              {isCustom && (
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                  CSV
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{formatINR(txn.amountPaise)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatPaymentMethod(txn.paymentMethod)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatFailureType(txn.failureType)}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                          {txn.retryCount} / {txn.maxRetries}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={effectiveStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {!isRecovered ? (
                              <button
                                onClick={() => handleQuickSimulate(txn)}
                                disabled={isProcessing}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                              >
                                {isProcessing ? "Simulating..." : "Simulate"}
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-medium">✓ Recovered</span>
                            )}
                            <Link href={`/transactions/${txn.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-xs">
                              Details &rarr;
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(cnt) => {
          setNotification({ message: `Successfully evaluated and added ${cnt} transactions.`, type: "success" });
          refetchAll();
          setTimeout(() => setNotification(null), 5000);
        }}
      />
    </DashboardLayout>
  );
}
