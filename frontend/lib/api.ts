// ---------------------------------------------------------------------------
// Centralized API client. All backend communication goes through here.
// Backend base URL: http://localhost:4000
// ---------------------------------------------------------------------------

import type {
  BaselineEvaluation,
  ExperimentResponse,
  HealthResponse,
  RecoveryActionType,
  RecoveryDecisionResponse,
  RecoveryServiceResult,
  ReviveEvaluation,
  SimulatorTransactionsResponse,
  TransactionDetail,
  PublicTransaction,
  AIAnalysisResult,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Generic fetch wrapper with error handling */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      (body && typeof body === "object" && "error" in body
        ? (body as { error: string }).error
        : null) ?? `API error ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// -- Simulator endpoints (verified in backend/src/simulator/dev-routes.ts) --

export function fetchReviveEvaluation(
  seed?: number,
): Promise<ReviveEvaluation> {
  const query = seed != null ? `?seed=${seed}` : "";
  return apiFetch<ReviveEvaluation>(
    `/simulator/revive-evaluation${query}`,
  );
}

export function fetchBaselineEvaluation(
  seed?: number,
): Promise<BaselineEvaluation> {
  const query = seed != null ? `?seed=${seed}` : "";
  return apiFetch<BaselineEvaluation>(
    `/simulator/baseline-evaluation${query}`,
  );
}

export function fetchSimulatorTransactions(
  seed?: number,
): Promise<SimulatorTransactionsResponse> {
  const query = seed != null ? `?seed=${seed}` : "";
  return apiFetch<SimulatorTransactionsResponse>(
    `/simulator/transactions${query}`,
  );
}

export function fetchExperiment(
  sampleSize: number,
  seed?: number,
): Promise<ExperimentResponse> {
  const params = new URLSearchParams();
  if (sampleSize != null) params.set("sampleSize", sampleSize.toString());
  if (seed != null) params.set("seed", seed.toString());
  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ExperimentResponse>(`/simulator/experiment${queryString}`);
}

// -- Transaction endpoints (verified in backend/src/db/transaction-route.ts) --

export function fetchTransactionById(
  transactionId: string,
): Promise<{ transaction: TransactionDetail }> {
  return apiFetch<{ transaction: TransactionDetail }>(
    `/transactions/${encodeURIComponent(transactionId)}`,
  );
}

// -- Recovery endpoints (verified in backend/src/recovery/recovery-route.ts) --

export function fetchRecoveryDecision(
  transactionId: string,
): Promise<RecoveryDecisionResponse> {
  return apiFetch<RecoveryDecisionResponse>(
    `/recovery/${encodeURIComponent(transactionId)}/decision`,
  );
}

export function postRecoveryAction(
  transactionId: string,
  action: RecoveryActionType,
): Promise<RecoveryServiceResult> {
  return apiFetch<RecoveryServiceResult>(
    `/recovery/${encodeURIComponent(transactionId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    },
  );
}

// -- AI Assistant endpoint (POST /ai/analyze) --

export function fetchAIAnalysis(
  transactionId: string,
  transaction?: PublicTransaction,
): Promise<AIAnalysisResult> {
  return apiFetch<AIAnalysisResult>("/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId, transaction }),
  });
}

// -- Health endpoints (verified in backend/src/app.ts, db/health-route.ts) --

export function fetchHealthStatus(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

export function fetchMongoHealthStatus(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health/mongodb");
}

export { API_URL };
