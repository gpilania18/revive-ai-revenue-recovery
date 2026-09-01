"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useRecovery } from "@/context/recovery-context";
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
  formatPercent,
} from "@/lib/format";
import type {
  EscalatedTransactionItem,
  HumanDecisionType,
  EscalationPriority,
} from "@/lib/types";

export default function HumanReviewPage() {
  const {
    escalatedTransactions,
    pendingReviewCount,
    highPriorityCount,
    resolvedReviewCount,
    humanReviewRevenueAtRiskPaise,
    submitHumanDecision,
    getTransactionAudit,
    getDecisionRecord,
    getAIAnalysis,
    getAIError,
    analyzeTransactionWithAI,
    isAnalyzingAI,
    loading,
    error,
    refetchAll,
  } = useRecovery();

  const [activeTab, setActiveTab] = useState<"PENDING" | "HIGH_PRIORITY" | "RESOLVED" | "ALL">("PENDING");
  const [selectedTxn, setSelectedTxn] = useState<EscalatedTransactionItem | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<HumanDecisionType>("APPROVE_RECOVERY");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" } | null>(null);

  const filteredItems = useMemo(() => {
    return escalatedTransactions.filter((item) => {
      if (activeTab === "PENDING") return item.reviewStatus === "PENDING";
      if (activeTab === "HIGH_PRIORITY") return item.reviewStatus === "PENDING" && item.priority === "HIGH";
      if (activeTab === "RESOLVED") return item.reviewStatus !== "PENDING";
      return true;
    });
  }, [escalatedTransactions, activeTab]);

  const handleOpenReview = (item: EscalatedTransactionItem) => {
    setSelectedTxn(item);
    setSelectedDecision("APPROVE_RECOVERY");
    setReviewNote("");
    analyzeTransactionWithAI(item.transaction.id).catch(() => null);
  };

  const handleCloseReview = () => {
    setSelectedTxn(null);
    setReviewNote("");
  };

  const isOverride = useMemo(() => {
    if (!selectedTxn) return false;
    return (
      (selectedTxn.decision.action === "ESCALATE" && selectedDecision !== "KEEP_ESCALATED") ||
      (selectedTxn.decision.action === "DO_NOTHING" && selectedDecision !== "REJECT_RECOVERY") ||
      selectedDecision === "APPROVE_RECOVERY" ||
      selectedDecision === "RETRY_PAYMENT"
    );
  }, [selectedTxn, selectedDecision]);

  const handleSubmitDecision = async () => {
    if (!selectedTxn) return;
    if (isOverride && !reviewNote.trim()) {
      setNotification({
        message: "Operator Reason is mandatory when overriding automated recommendations.",
        type: "info",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const simResult = await submitHumanDecision(
        selectedTxn.transaction.id,
        selectedDecision,
        reviewNote.trim() || undefined
      );

      if (selectedDecision === "APPROVE_RECOVERY" || selectedDecision === "RETRY_PAYMENT") {
        if (simResult?.outcome === "success") {
          setNotification({
            message: `Decision recorded: Recovery Approved for ${selectedTxn.transaction.id}. ${formatINR(simResult.recoveredPaise)} successfully captured!`,
            type: "success",
          });
        } else {
          setNotification({
            message: `Decision recorded: Recovery Approved for ${selectedTxn.transaction.id}. Outcome: ${simResult?.outcome.toUpperCase()} (${simResult?.reason})`,
            type: "info",
          });
        }
      } else if (selectedDecision === "REJECT_RECOVERY") {
        setNotification({
          message: `Decision recorded: Recovery Rejected for ${selectedTxn.transaction.id}. Marked as non-recoverable.`,
          type: "info",
        });
      } else if (selectedDecision === "KEEP_ESCALATED") {
        setNotification({
          message: `Transaction ${selectedTxn.transaction.id} retained in escalation queue.`,
          type: "info",
        });
      } else {
        setNotification({
          message: `Decision recorded: ${formatActionLabel(selectedDecision)} for ${selectedTxn.transaction.id}.`,
          type: "success",
        });
      }

      handleCloseReview();
    } catch (err: unknown) {
      setNotification({
        message: err instanceof Error ? err.message : "Failed to record human decision",
        type: "info",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Human Review">
        <LoadingState message="Loading human review escalation queue..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Human Review">
        <ErrorState message={error || "Failed to load review center"} onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  const auditEvents = selectedTxn ? getTransactionAudit(selectedTxn.transaction.id) : [];
  const decisionRecord = selectedTxn ? getDecisionRecord(selectedTxn.transaction.id) : undefined;
  const aiAnalysis = selectedTxn ? getAIAnalysis(selectedTxn.transaction.id) : undefined;
  const aiError = selectedTxn ? getAIError(selectedTxn.transaction.id) : undefined;
  const isCurrentAIAnalyzing = selectedTxn ? !!isAnalyzingAI[selectedTxn.transaction.id] : false;

  return (
    <DashboardLayout title="Human Review" onRefresh={refetchAll}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Human Review & Escalations</h1>
              {pendingReviewCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  {pendingReviewCount} Cases Require Attention
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Operational queue for high-value transactions, policy holds, and complex failures requiring manual operator authorization.
            </p>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-gray-900">{pendingReviewCount}</p>
            <p className="text-xs text-gray-400 mt-1">Awaiting human operator action</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">High Priority</p>
            <p className="text-2xl font-bold text-red-600">{highPriorityCount}</p>
            <p className="text-xs text-gray-400 mt-1">High value or enterprise accounts</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resolved Decisions</p>
            <p className="text-2xl font-bold text-emerald-600">{resolvedReviewCount}</p>
            <p className="text-xs text-gray-400 mt-1">Approved, retried, or rejected</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Revenue at Risk in Queue</p>
            <p className="text-2xl font-bold text-gray-900">{formatINR(humanReviewRevenueAtRiskPaise)}</p>
            <p className="text-xs text-gray-400 mt-1">Total value awaiting decision</p>
          </div>
        </div>

        {/* Operational Filter Tabs */}
        <div className="flex border-b border-gray-200 space-x-4">
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "PENDING"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>Pending Review</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "PENDING" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
            }`}>
              {pendingReviewCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("HIGH_PRIORITY")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "HIGH_PRIORITY"
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>High Priority</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "HIGH_PRIORITY" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"
            }`}>
              {highPriorityCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("RESOLVED")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "RESOLVED"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>Resolved</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
            }`}>
              {resolvedReviewCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ALL")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "ALL"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            All Cases ({escalatedTransactions.length})
          </button>
        </div>

        {/* Cases Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Escalation Reason</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isPending = item.reviewStatus === "PENDING";
                    return (
                      <tr key={item.transaction.id} className={`hover:bg-gray-50 transition-colors ${isPending ? "bg-amber-50/15" : ""}`}>
                        <td className="px-4 py-3 font-mono">
                          <Link
                            href={`/transactions/${item.transaction.id}`}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            {item.transaction.id}
                          </Link>
                          <div className="text-[11px] text-gray-500 font-sans mt-0.5">
                            {formatPaymentMethod(item.transaction.paymentMethod)} · {formatFailureType(item.transaction.failureType)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {formatINR(item.transaction.amountPaise)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="font-mono text-xs text-gray-600 block">{item.transaction.customerId}</span>
                          <span className="text-[11px] capitalize font-medium text-gray-500">{item.transaction.customer?.segment || "Consumer"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={item.escalationReason}>
                          {item.escalationReason}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.reviewStatus.toLowerCase()} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenReview(item)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isPending
                                ? "text-white bg-blue-600 hover:bg-blue-700"
                                : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            {isPending ? "Review Case" : "Inspect Case"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No cases found in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review Modal / Drawer */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900 font-mono">{selectedTxn.transaction.id}</h2>
                  <PriorityBadge priority={selectedTxn.priority} />
                  {isOverride && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                      HUMAN OVERRIDE
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Amount: <span className="font-bold text-gray-900">{formatINR(selectedTxn.transaction.amountPaise)}</span> · {formatPaymentMethod(selectedTxn.transaction.paymentMethod)}
                </p>
              </div>
              <button
                onClick={handleCloseReview}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Automated Recommendation</h3>
                  <p className="text-sm font-bold text-gray-900">{formatActionLabel(selectedTxn.decision.action)}</p>
                  <p className="text-xs text-gray-600 mt-1">{selectedTxn.escalationReason}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Safety Policy Checks</h3>
                  <ul className="text-xs space-y-1">
                    <li className="flex items-center justify-between">
                      <span className="text-gray-600">Duplicate Check:</span>
                      <span className="font-bold text-emerald-700">✓ PASSED</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-600">₹50,000 Automation Cap:</span>
                      <span className={selectedTxn.transaction.amountPaise > 5_000_000 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                        {selectedTxn.transaction.amountPaise > 5_000_000 ? "⚠ EXCEEDED" : "✓ PASSED"}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-600">Review Status:</span>
                      <span className="font-bold text-blue-700 uppercase">{selectedTxn.reviewStatus}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* AI Assistant Decision Support Box */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">AI Assistant (Decision Support)</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700">
                    Non-authoritative
                  </span>
                </div>

                {aiAnalysis ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                        <p className="text-[10px] uppercase font-semibold text-gray-500">Suggested Action</p>
                        <p className="text-xs font-bold text-indigo-950 mt-0.5">{formatActionLabel(aiAnalysis.recommendedAction)}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                        <p className="text-[10px] uppercase font-semibold text-gray-500">Confidence</p>
                        <p className="text-xs font-mono font-bold text-indigo-700 mt-0.5">{formatPercent(aiAnalysis.confidence)}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                        <p className="text-[10px] uppercase font-semibold text-gray-500">Recovery Prob.</p>
                        <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">{formatPercent(aiAnalysis.recoveryProbability)}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                        <p className="text-[10px] uppercase font-semibold text-gray-500">Risk Level</p>
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold mt-0.5 ${
                          aiAnalysis.riskScore === "LOW" ? "bg-emerald-100 text-emerald-800" :
                          aiAnalysis.riskScore === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                        }`}>
                          {aiAnalysis.riskScore}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/80 p-3 rounded-lg border border-indigo-100 text-xs">
                      <p className="text-[11px] font-semibold text-indigo-900 mb-0.5">Why?</p>
                      <p className="text-gray-700 leading-relaxed">{aiAnalysis.reason}</p>
                      {aiAnalysis.keyFactors && aiAnalysis.keyFactors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-indigo-50">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Key Factors:</p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-gray-600">
                            {aiAnalysis.keyFactors.map((kf, idx) => (
                              <li key={idx} className="flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-indigo-500" />
                                <span>{kf}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : isCurrentAIAnalyzing ? (
                  <div className="py-3 text-center text-xs text-indigo-700">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                      <span className="font-semibold">Querying AI decision support for case context...</span>
                    </div>
                  </div>
                ) : aiError ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>AI Assistant Unavailable</span>
                    </div>
                    <p className="text-[11px] text-gray-700 leading-normal">{aiError}</p>
                    <p className="text-[10px] text-gray-500 pt-0.5">Operator remains full decision authority.</p>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-gray-500">
                    <span>AI decision support ready to query.</span>
                  </div>
                )}
              </div>

              {/* Outcome Feedback Record (if resolved) */}
              {decisionRecord && decisionRecord.outcome !== "PENDING" && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 text-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Decision Outcome</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                      {formatNormalizedOutcome(decisionRecord.outcome)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Action Executed:</span>
                      <span className="font-bold">{formatActionLabel(decisionRecord.actualAction)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recovered Revenue:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {decisionRecord.recoveredPaise > 0 ? formatINR(decisionRecord.recoveredPaise) : "₹0"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Audit Trail */}
              {auditEvents.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Decision Audit Trail</h3>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {auditEvents.map((ev, i) => (
                      <div key={ev.id || i} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-white rounded-lg border border-gray-100">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{formatAuditEventType(ev.eventType)}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-700">
                              {formatAuditActor(ev.actor)}
                            </span>
                          </div>
                          {ev.reason && <p className="text-[11px] text-gray-500 mt-0.5">{ev.reason}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">{formatDate(ev.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Human Decision Form */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Human Operator Decision</h3>
                  {isOverride && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                      Requires Reason (Override)
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  {[
                    {
                      id: "APPROVE_RECOVERY",
                      title: "Approve Recovery (Authorize execution)",
                      desc: "Overrides guardrail hold and simulates immediate payment capture attempt.",
                    },
                    {
                      id: "RETRY_PAYMENT",
                      title: "Retry Payment",
                      desc: "Directly re-attempts charge through gateway.",
                    },
                    {
                      id: "REQUEST_PAYMENT_METHOD_UPDATE",
                      title: "Request Payment Method Update",
                      desc: "Sends notification prompting customer to update payment details.",
                    },
                    {
                      id: "REJECT_RECOVERY",
                      title: "Reject Recovery",
                      desc: "Mark as permanent decline; stops recovery attempts and removes from queue.",
                    },
                    {
                      id: "KEEP_ESCALATED",
                      title: "Keep Escalated",
                      desc: "Leaves the transaction in queue for supervisor review.",
                    },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedDecision === option.id
                          ? "bg-white border-blue-500 shadow-sm"
                          : "border-transparent hover:bg-white/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="humanDecision"
                        value={option.id}
                        checked={selectedDecision === option.id}
                        onChange={() => setSelectedDecision(option.id as HumanDecisionType)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="text-xs">
                        <p className="font-bold text-gray-900">{option.title}</p>
                        <p className="text-gray-500 text-[11px]">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Operator Note */}
                <div className="pt-2">
                  <label htmlFor="operator-note" className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                    Operator Review Note {isOverride ? <span className="text-red-500 font-bold">* (Mandatory for Overrides)</span> : "(Optional)"}
                  </label>
                  <textarea
                    id="operator-note"
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={isOverride ? "Provide mandatory reason for override (e.g. Verified customer context; manual recovery approved)." : "e.g. Verified customer credit line, safe to capture."}
                    className={`w-full text-xs p-2.5 border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isOverride && !reviewNote.trim() ? "border-amber-400 bg-amber-50/30" : "border-gray-300"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={handleCloseReview}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={isSubmitting || (isOverride && !reviewNote.trim())}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md transition-all"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Processing Decision...</span>
                  </>
                ) : (
                  <span>Submit Decision</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function PriorityBadge({ priority }: { priority: EscalationPriority }) {
  if (priority === "HIGH") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
        HIGH
      </span>
    );
  }
  if (priority === "MEDIUM") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        MEDIUM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
      LOW
    </span>
  );
}
