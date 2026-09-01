"use client";

import React, { useState, useRef } from "react";
import { parseTransactionsCSV, generateSampleCSV, saveCustomTransactions, evaluateTransaction } from "@/lib/csv-importer";
import { formatINR, formatActionLabel, formatFailureType, formatPaymentMethod } from "@/lib/format";
import type { PublicTransaction } from "@/lib/types";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
}

export function CsvImportModal({ isOpen, onClose, onImportSuccess }: CsvImportModalProps) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseTransactionsCSV> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      try {
        const result = parseTransactionsCSV(text);
        if (result.errors.length > 0) {
          setErrorMsg(result.errors.join(", "));
        }
        setParseResult(result);
      } catch (err) {
        setErrorMsg("Failed to parse CSV file. Please check format.");
      }
    };
    reader.onerror = () => {
      setErrorMsg("Error reading file");
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setCsvText(text);
    setErrorMsg(null);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    try {
      const result = parseTransactionsCSV(text);
      if (result.errors.length > 0) {
        setErrorMsg(result.errors.join(", "));
      }
      setParseResult(result);
    } catch {
      setErrorMsg("Invalid CSV format");
    }
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "revive_sample_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitImport = () => {
    if (!parseResult || parseResult.transactions.length === 0) return;

    saveCustomTransactions(parseResult.transactions);
    onImportSuccess(parseResult.transactions.length);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setCsvText("");
    setFileName(null);
    setParseResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import & Evaluate Transactions via CSV</h2>
              <p className="text-xs text-gray-500">Upload failed transactions to run through the REVIVE decision engine</p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "upload"
                    ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode("paste")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "paste"
                    ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Paste CSV Text
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV Template
            </button>
          </div>

          {/* Upload or Paste Input Area */}
          {mode === "upload" ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">
                {fileName ? `Selected: ${fileName}` : "Click to select or drag and drop a .csv file"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports standard format with headers: id, amount, payment_method, failure_type, status, etc.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Paste Raw CSV Rows
              </label>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder="id,amount,payment_method,failure_type,status&#10;txn_csv_001,49900,UPI,TEMPORARY_ISSUER_FAILURE,failed&#10;txn_csv_002,149900,CARD,NETWORK_TIMEOUT,failed"
                className="w-full font-mono text-xs p-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-gray-50/50"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live AI Evaluation Summary */}
          {parseResult && parseResult.transactions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <span>AI Decision & Evaluation Preview</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {parseResult.transactions.length} Verified
                  </span>
                </h3>
                <span className="text-xs text-gray-500 font-medium">Deterministic policy applied</span>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <p className="text-[11px] font-medium text-gray-500 uppercase">Total Revenue at Risk</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{formatINR(parseResult.evaluationSummary.totalAmountPaise)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <p className="text-[11px] font-medium text-emerald-700 uppercase">Est. Recoverable</p>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{formatINR(parseResult.evaluationSummary.recoverableAmountPaise)}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <p className="text-[11px] font-medium text-blue-700 uppercase">Allowed Actions</p>
                  <p className="text-base font-bold text-blue-700 mt-0.5">{parseResult.evaluationSummary.allowed} txns</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-[11px] font-medium text-amber-700 uppercase">Guardrail Blocked</p>
                  <p className="text-base font-bold text-amber-700 mt-0.5">
                    {parseResult.evaluationSummary.blocked + parseResult.evaluationSummary.escalated} txns
                  </p>
                </div>
              </div>

              {/* Transactions Preview Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600">ID</th>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600">Amount</th>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600">Method</th>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600">Failure Type</th>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600">AI Recommended Action</th>
                        <th className="px-3.5 py-2.5 font-semibold text-gray-600 text-right">Policy Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parseResult.transactions.map((txn: PublicTransaction) => {
                        const evaluation = evaluateTransaction(txn);
                        return (
                          <tr key={txn.id} className="hover:bg-gray-50/80">
                            <td className="px-3.5 py-2 font-mono font-medium text-gray-800">{txn.id}</td>
                            <td className="px-3.5 py-2 font-medium text-gray-900">{formatINR(txn.amountPaise)}</td>
                            <td className="px-3.5 py-2 text-gray-600">{formatPaymentMethod(txn.paymentMethod)}</td>
                            <td className="px-3.5 py-2 text-gray-600">{formatFailureType(txn.failureType)}</td>
                            <td className="px-3.5 py-2 font-medium text-blue-700">
                              {formatActionLabel(evaluation.recommendedAction)}
                            </td>
                            <td className="px-3.5 py-2 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  evaluation.decision.allowed
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : evaluation.decision.action === "ESCALATE"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {evaluation.decision.allowed ? "ALLOWED" : evaluation.decision.action === "ESCALATE" ? "ESCALATED" : "BLOCKED"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {parseResult && parseResult.transactions.length > 0 && (
              <button
                type="button"
                onClick={handleCommitImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add {parseResult.transactions.length} Transactions to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
