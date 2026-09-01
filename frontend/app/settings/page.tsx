"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { API_URL, fetchHealthStatus } from "@/lib/api";
import { useRecovery } from "@/context/recovery-context";

function ToggleDisplay({ enabled }: { enabled: boolean }) {
  return (
    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors pointer-events-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </div>
  );
}

export default function SettingsPage() {
  const { resetExperiment, refetchAll } = useRecovery();
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const result = await fetchHealthStatus();
        setIsApiHealthy(result.status === "ok");
      } catch (e) {
        setIsApiHealthy(false);
      }
    }
    checkHealth();
  }, []);

  const handleReset = () => {
    if (confirm("Reset current experiment session? All metrics, transaction states, and simulation logs will return to ZERO.")) {
      resetExperiment();
      setResetMessage("Experiment session reset to zero state.");
      setTimeout(() => setResetMessage(null), 4000);
    }
  };

  return (
    <DashboardLayout title="Settings" onRefresh={refetchAll}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Recovery policy, guardrails, and simulation experiment configuration.</p>
      </div>

      {resetMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-semibold mb-6 animate-in fade-in duration-150 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{resetMessage}</span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex gap-3 text-blue-800">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mt-0.5 flex-shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        <p className="text-xs sm:text-sm">
          <strong>Experiment Environment Configuration:</strong> These controls reflect the deterministic REVIVE recovery and safety rules. When running batch simulations, the policy engine evaluates and enforces safety rules over the selected sample.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
          {/* Recovery Policy */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900">Recovery Policy</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Automatic retry</p>
                  <p className="text-xs text-gray-500">Automatically retry failed payments</p>
                </div>
                <ToggleDisplay enabled={true} />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Maximum retries</p>
                  <p className="text-xs text-gray-500">Global cap on retry attempts</p>
                </div>
                <input type="text" value="3" readOnly className="block w-24 rounded-lg border-gray-300 bg-gray-50 py-1.5 px-3 text-sm text-gray-900 shadow-sm border font-mono font-bold" />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Retry delay</p>
                  <p className="text-xs text-gray-500">Time between retry attempts</p>
                </div>
                <input type="text" value="30 minutes" readOnly className="block w-32 rounded-lg border-gray-300 bg-gray-50 py-1.5 px-3 text-sm text-gray-900 shadow-sm border" />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Recovery strategy</p>
                  <p className="text-xs text-gray-500">Deterministic strategy engine</p>
                </div>
                <div className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                  Revive Strategy
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Automation cap</p>
                  <p className="text-xs text-gray-500">Maximum amount for automated recovery</p>
                </div>
                <input type="text" value="₹50,000" readOnly className="block w-28 rounded-lg border-gray-300 bg-gray-50 py-1.5 px-3 text-sm text-gray-900 shadow-sm border font-mono font-bold text-blue-700" />
              </div>
            </div>
          </div>

          {/* Escalation Rules */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900">Deterministic Escalation Rules</h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-600 font-bold text-sm mt-0.5">•</span>
                  <span className="text-xs sm:text-sm text-gray-700">Transactions exceeding <strong>₹50,000</strong> strictly require human escalation.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-600 font-bold text-sm mt-0.5">•</span>
                  <span className="text-xs sm:text-sm text-gray-700">Ambiguous or unknown failure types route to human review.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-600 font-bold text-sm mt-0.5">•</span>
                  <span className="text-xs sm:text-sm text-gray-700">Hard declines & expired cards are blocked from automated re-attempt.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-blue-600 font-bold text-sm mt-0.5">•</span>
                  <span className="text-xs sm:text-sm text-gray-700">Duplicate payment risk signatures trigger capture prevention.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Safety Controls */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900">Safety Guardrail Controls</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Duplicate prevention</p>
                  <p className="text-xs text-gray-500">Block double-charge attempts</p>
                </div>
                <ToggleDisplay enabled={true} />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Retry-limit protection</p>
                  <p className="text-xs text-gray-500">Strictly enforce 3-attempt ceiling</p>
                </div>
                <ToggleDisplay enabled={true} />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">High-value protection</p>
                  <p className="text-xs text-gray-500">₹50,000 cap applied to all auto-retries</p>
                </div>
                <ToggleDisplay enabled={true} />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Escalation routing</p>
                  <p className="text-xs text-gray-500">Route restricted cases for secondary review</p>
                </div>
                <ToggleDisplay enabled={true} />
              </div>
            </div>
          </div>

          {/* Evaluation Environment */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Simulation Environment</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase">Experiment Console</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-medium">Backend API Status</p>
                <div className="flex items-center gap-2">
                  {isApiHealthy === null ? (
                    <span className="text-xs font-medium text-gray-500">Checking...</span>
                  ) : isApiHealthy ? (
                    <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span>Simulator Mode</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-medium">API Endpoint</p>
                <p className="text-xs font-mono text-gray-900">{API_URL || 'http://localhost:4000'}</p>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-medium">Dataset Seed</p>
                <p className="text-xs font-mono font-bold text-gray-900">42 (200 Transactions)</p>
              </div>

              {/* Reset Action */}
              <div className="pt-3 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-900">Reset Experiment</p>
                  <p className="text-[11px] text-gray-500">Return all metrics, events, and statuses to zero</p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-sm"
                >
                  Reset to Zero State
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
