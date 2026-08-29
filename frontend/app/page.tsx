"use client";

import { useEffect, useMemo, useState } from "react";

type Metrics = {
  transactionCount: number;
  totalRevenueAtRiskPaise: number;
  revenueRecoveredPaise: number;
  recoveryRate: number;
  successfulInterventions: number;
  blockedActions: number;
  escalationCount: number;
  duplicatePreventionCount: number;
};

type Evaluation = {
  seed: number;
  baseline: Metrics;
  revive: Metrics;
  comparison: {
    incrementalRecoveryPaise: number;
    incrementalRecoveryRate: number;
    additionalSuccessfulInterventions: number;
  };
};

type Decision = {
  transaction: {
    id: string;
    amountPaise: number;
    currency: string;
    paymentMethod: string;
    status: string;
    failureType: string;
    retryCount: number;
    maxRetries: number;
  };
  decision: {
    action: string;
    allowed: boolean;
    reason: string;
  };
};

const API_URL = "http://localhost:4000";

function money(paise: number) {
  return `?${(paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function actionLabel(action: string) {
  return action.replaceAll("_", " ");
}

export default function Home() {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [transactionId, setTransactionId] = useState("txn_003");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadEvaluation() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/simulator/revive-evaluation`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Failed to load evaluation");
      }

      const data = await response.json();
      setEvaluation(data);
    } catch {
      setError(
        "Unable to connect to the Revive API. Make sure the backend is running on port 4000.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDecision(id: string) {
    if (!id.trim()) return;

    try {
      setDecisionLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/recovery/${id.trim()}/decision`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Transaction not found");
      }

      const data = await response.json();
      setDecision(data);
    } catch {
      setDecision(null);
      setError(`Could not load decision for ${id.trim()}.`);
    } finally {
      setDecisionLoading(false);
    }
  }

  useEffect(() => {
    loadEvaluation();
    loadDecision("txn_003");
  }, []);

  const improvement = useMemo(() => {
    if (!evaluation) return 0;
    return evaluation.comparison.incrementalRecoveryPaise;
  }, [evaluation]);

    if (!evaluation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-[#171717]">
        <div className="rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
          {loading ? (
            <>
              <div className="text-lg font-semibold">
                Loading Revive...
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Fetching recovery evaluation from the API.
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold">
                Unable to load Revive
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {error || "The backend did not return evaluation data."}
              </p>

              <button
                onClick={loadEvaluation}
                className="mt-5 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#171717]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">
                R
              </div>
              <span className="text-xl font-bold tracking-tight">
                REVIVE
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Payment Recovery Intelligence
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              ? API Connected
            </span>
            <button
              onClick={loadEvaluation}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Recovery Performance
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Revive vs baseline
            </h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <MetricCard
    label="Revenue Recovered"
    value={
      loading || !evaluation
        ? "—"
        : money(evaluation.revive.revenueRecoveredPaise)
    }
    detail={
      loading || !evaluation
        ? ""
        : `Baseline ${money(evaluation.baseline.revenueRecoveredPaise)}`
    }
  />

  <MetricCard
    label="Incremental Recovery"
    value={
      loading || !evaluation
        ? "—"
        : `+${money(improvement)}`
    }
    detail="Additional revenue recovered"
    emphasis
  />

  <MetricCard
    label="Recovery Rate"
    value={
      loading || !evaluation
        ? "—"
        : percent(evaluation.revive.recoveryRate)
    }
    detail={
      loading || !evaluation
        ? ""
        : `Baseline ${percent(evaluation.baseline.recoveryRate)}`
    }
  />

  <MetricCard
    label="Successful Interventions"
    value={
      loading || !evaluation
        ? "—"
        : evaluation.revive.successfulInterventions.toString()
    }
    detail={
      loading || !evaluation
        ? ""
        : `+${evaluation.comparison.additionalSuccessfulInterventions} vs baseline`
    }
  />
</div>
        </section>

        {evaluation && (
          <>
            <section className="mb-8 grid gap-6 lg:grid-cols-2">
              <ComparisonCard
                title="Baseline"
                metrics={evaluation.baseline}
              />
              <ComparisonCard
                title="Revive"
                metrics={evaluation.revive}
                highlight
              />
            </section>

            <section className="mb-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Decision Engine
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Inspect a transaction
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="txn_003"
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
                <button
                  onClick={() => loadDecision(transactionId)}
                  disabled={decisionLoading}
                  className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {decisionLoading ? "Loading..." : "Analyze transaction"}
                </button>
              </div>

              {decision && (
                <div className="mt-6 rounded-xl border border-gray-100 bg-[#fafafa] p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row">
                    <div>
                      <p className="font-mono text-sm text-gray-500">
                        {decision.transaction.id}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">
                        {decision.transaction.failureType}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {decision.transaction.paymentMethod} ·{" "}
                        {money(decision.transaction.amountPaise)} ·{" "}
                        Retry {decision.transaction.retryCount}/
                        {decision.transaction.maxRetries}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                          decision.decision.allowed
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {decision.decision.allowed ? "ALLOWED" : "BLOCKED"}
                      </span>

                      <p className="mt-2 text-lg font-bold">
                        {actionLabel(decision.decision.action)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600">
                    {decision.decision.reason}
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Escalations"
                value={evaluation.revive.escalationCount}
                description="Cases routed for human review"
              />
              <StatCard
                label="Blocked Actions"
                value={evaluation.revive.blockedActions}
                description="Unsafe actions prevented"
              />
              <StatCard
                label="Transactions Evaluated"
                value={evaluation.revive.transactionCount}
                description={`Dataset seed ${evaluation.seed}`}
              />
            </section>
          </>
        )}

        <footer className="py-10 text-center text-xs text-gray-400">
          Revive · AI-assisted payment recovery · Evaluation environment
        </footer>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        emphasis
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          emphasis ? "text-white/60" : "text-gray-400"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p
        className={`mt-2 text-sm ${
          emphasis ? "text-white/60" : "text-gray-500"
        }`}
      >
        {detail}
      </p>
    </div>
  );
}

function ComparisonCard({
  title,
  metrics,
  highlight = false,
}: {
  title: string;
  metrics: Metrics;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${
        highlight
          ? "border-black bg-white"
          : "border-black/10 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {highlight && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            RECOMMENDED
          </span>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <ComparisonRow
          label="Revenue recovered"
          value={money(metrics.revenueRecoveredPaise)}
        />
        <ComparisonRow
          label="Recovery rate"
          value={percent(metrics.recoveryRate)}
        />
        <ComparisonRow
          label="Successful interventions"
          value={metrics.successfulInterventions}
        />
        <ComparisonRow
          label="Blocked actions"
          value={metrics.blockedActions}
        />
        <ComparisonRow
          label="Escalations"
          value={metrics.escalationCount}
        />
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-400">{description}</p>
    </div>
  );
}
