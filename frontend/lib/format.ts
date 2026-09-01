// ---------------------------------------------------------------------------
// Formatting utilities for the REVIVE dashboard.
// All monetary values arrive as paise and must display as INR (₹).
// ---------------------------------------------------------------------------

/**
 * Format paise as INR with ₹ symbol and Indian number grouping.
 * 49900 → ₹499
 * 12771000 → ₹1,27,710
 */
export function formatINR(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `\u20B9${rupees.toLocaleString("en-IN")}`;
}

/**
 * Format paise as a signed INR string for incremental values.
 * 3787500 → +₹37,875
 */
export function formatINRSigned(paise: number): string {
  const prefix = paise >= 0 ? "+" : "";
  return `${prefix}${formatINR(paise)}`;
}

/**
 * Format a decimal ratio as a percentage string.
 * 0.0428 → 4.28%
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format a signed percentage-point delta.
 * 0.0127 → +1.27 pts
 */
export function formatPercentDelta(value: number): string {
  const pts = (value * 100).toFixed(2);
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${pts} pts`;
}

/**
 * Exact title-case map for Recovery Actions
 */
const ACTION_LABEL_MAP: Record<string, string> = {
  RETRY_PAYMENT: "Retry Payment",
  WAIT_AND_RETRY: "Wait and Retry",
  REQUEST_PAYMENT_METHOD_UPDATE: "Request Payment Method Update",
  DO_NOTHING: "Do Nothing",
  ESCALATE: "Escalate",
  APPROVE_RECOVERY: "Approve Recovery",
  REJECT_RECOVERY: "Reject Recovery",
  KEEP_ESCALATED: "Keep Escalated",
};

/**
 * Format a RecoveryActionType / HumanDecisionType as a consistent human-readable label.
 */
export function formatActionLabel(action: string): string {
  if (!action) return "";
  const upper = action.toUpperCase();
  if (ACTION_LABEL_MAP[upper]) {
    return ACTION_LABEL_MAP[upper];
  }
  return action
    .split("_")
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "and" || lower === "or" || lower === "the" || lower === "of") {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Exact title-case map for Failure Types
 */
const FAILURE_TYPE_MAP: Record<string, string> = {
  TEMPORARY_ISSUER_FAILURE: "Temporary Issuer Failure",
  NETWORK_TIMEOUT: "Network Timeout",
  INSUFFICIENT_FUNDS: "Insufficient Funds",
  CARD_EXPIRED: "Card Expired",
  HARD_DECLINE: "Hard Decline",
  DUPLICATE_PAYMENT: "Duplicate Payment",
  RETRY_LIMIT_EXCEEDED: "Retry Limit Exceeded",
  UNKNOWN_FAILURE: "Unknown Failure",
};

/**
 * Format a FailureType as a consistent human-readable label.
 */
export function formatFailureType(type: string): string {
  if (!type) return "";
  const upper = type.toUpperCase();
  if (FAILURE_TYPE_MAP[upper]) {
    return FAILURE_TYPE_MAP[upper];
  }
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format a Status for display.
 */
export function formatStatusLabel(status: string): string {
  if (!status) return "";
  const lower = status.toLowerCase();
  switch (lower) {
    case "failed":
      return "Failed";
    case "captured":
    case "recovered":
    case "success":
      return "Recovered";
    case "blocked":
      return "Blocked";
    case "escalated":
      return "Escalated";
    case "authorized":
      return "Authorized";
    case "created":
      return "Created";
    case "waiting":
      return "Waiting";
    case "pending":
      return "Pending";
    case "skipped":
      return "Skipped";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "resolved":
      return "Resolved";
    default:
      return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
}

/**
 * Format a PaymentMethod for display.
 */
export function formatPaymentMethod(method: string): string {
  if (!method) return "";
  const upper = method.toUpperCase();
  if (upper === "UPI") return "UPI";
  if (upper === "CARD") return "Card";
  if (upper === "NETBANKING") return "Netbanking";
  if (upper === "WALLET") return "Wallet";
  return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
}

/**
 * Audit Event Type Formatter
 */
const AUDIT_EVENT_MAP: Record<string, string> = {
  PAYMENT_FAILED: "Payment Failed",
  REVIVE_ANALYSIS: "REVIVE Analysis",
  SAFETY_CHECK: "Safety Policy Check",
  RECOVERY_ALLOWED: "Recovery Policy Allowed",
  RECOVERY_BLOCKED: "Recovery Policy Blocked",
  ESCALATED: "Escalated to Human Review",
  RECOVERY_ATTEMPTED: "Recovery Attempted",
  RECOVERY_SUCCEEDED: "Recovery Succeeded",
  RECOVERY_FAILED: "Recovery Failed",
  HUMAN_REVIEW: "Human Review Opened",
  HUMAN_DECISION: "Human Operator Decision",
  HUMAN_OVERRIDE: "Human Override Submitted",
  EXPERIMENT_EVALUATION: "Experiment Evaluation",
};

export function formatAuditEventType(eventType: string): string {
  if (!eventType) return "";
  const upper = eventType.toUpperCase();
  if (AUDIT_EVENT_MAP[upper]) {
    return AUDIT_EVENT_MAP[upper];
  }
  return formatActionLabel(eventType);
}

/**
 * Audit Actor Formatter
 */
export function formatAuditActor(actor: string): string {
  if (!actor) return "System";
  const upper = actor.toUpperCase();
  switch (upper) {
    case "REVIVE":
      return "REVIVE Engine";
    case "SAFETY_POLICY":
      return "Safety Policy";
    case "HUMAN_OPERATOR":
      return "Human Operator";
    case "SYSTEM":
      return "System";
    default:
      return actor;
  }
}

/**
 * Normalized Outcome Formatter
 */
export function formatNormalizedOutcome(outcome: string): string {
  if (!outcome) return "";
  const upper = outcome.toUpperCase();
  switch (upper) {
    case "SUCCESS":
      return "Success";
    case "FAILED":
      return "Failed";
    case "BLOCKED":
      return "Blocked";
    case "ESCALATED":
      return "Escalated";
    case "REJECTED":
      return "Rejected";
    case "PENDING":
      return "Pending";
    default:
      return outcome;
  }
}

/**
 * Decision Source Formatter
 */
export function formatDecisionSource(source: string): string {
  if (!source) return "";
  const upper = source.toUpperCase();
  switch (upper) {
    case "RULE_BASED_REVIVE":
      return "REVIVE Rule Engine";
    case "HUMAN_OPERATOR":
      return "Human Operator Override";
    case "BASELINE":
      return "Baseline Strategy";
    default:
      return source;
  }
}

/**
 * Format an ISO date string as a short relative/absolute time.
 */
export function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format an ISO date string for table display.
 */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
