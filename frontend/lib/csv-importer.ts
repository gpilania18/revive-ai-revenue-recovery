// ---------------------------------------------------------------------------
// CSV Importer & Evaluation Engine for REVIVE Transactions
// ---------------------------------------------------------------------------

import type {
  PublicTransaction,
  RecoveryActionType,
  RecoveryDecision,
  FailureType,
  PaymentMethod,
  TransactionStatus,
  CustomerSegment,
} from "./types";

const CUSTOM_TRANSACTIONS_STORAGE_KEY = "revive_custom_imported_transactions";
const AUTOMATION_AMOUNT_CAP_PAISE = 5_000_000; // ₹50,000

/**
 * Deterministic Revive Strategy Decision
 */
export function evaluateReviveStrategy(txn: PublicTransaction): RecoveryActionType {
  if (txn.status !== "failed") {
    return "DO_NOTHING";
  }

  if (txn.retryCount >= txn.maxRetries) {
    return "DO_NOTHING";
  }

  if (txn.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
    return "ESCALATE";
  }

  switch (txn.failureType) {
    case "DUPLICATE_PAYMENT":
    case "HARD_DECLINE":
    case "RETRY_LIMIT_EXCEEDED":
      return "DO_NOTHING";

    case "CARD_EXPIRED":
      return "REQUEST_PAYMENT_METHOD_UPDATE";

    case "INSUFFICIENT_FUNDS":
      return "WAIT_AND_RETRY";

    case "TEMPORARY_ISSUER_FAILURE":
    case "NETWORK_TIMEOUT":
      return "RETRY_PAYMENT";

    case "UNKNOWN_FAILURE":
      return "ESCALATE";

    default:
      return "DO_NOTHING";
  }
}

/**
 * Deterministic Safety Policy Engine
 */
export function evaluateRecoveryPolicy(
  txn: PublicTransaction,
  requestedAction: RecoveryActionType
): RecoveryDecision {
  if (txn.status !== "failed") {
    return {
      action: "DO_NOTHING",
      allowed: false,
      reason: "Only failed transactions are eligible for recovery.",
    };
  }

  if (txn.retryCount >= txn.maxRetries) {
    return {
      action: "DO_NOTHING",
      allowed: false,
      reason: "Retry limit has been exhausted.",
    };
  }

  if (requestedAction === "ESCALATE" && txn.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
    return {
      action: "ESCALATE",
      allowed: false,
      reason: "High-value transactions require human authorization.",
    };
  }

  if (requestedAction === "RETRY_PAYMENT") {
    if (txn.failureType === "CARD_EXPIRED") {
      return {
        action: "REQUEST_PAYMENT_METHOD_UPDATE",
        allowed: false,
        reason: "Expired payment credentials cannot be recovered by retrying.",
      };
    }

    if (txn.failureType === "HARD_DECLINE") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Hard declines must not be retried automatically.",
      };
    }

    if (txn.failureType === "DUPLICATE_PAYMENT") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Duplicate payment risk prevents an automatic retry.",
      };
    }

    if (txn.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
      return {
        action: "ESCALATE",
        allowed: false,
        reason: "High-value transactions require human authorization.",
      };
    }
  }

  if (requestedAction === "WAIT_AND_RETRY") {
    if (txn.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
      return {
        action: "ESCALATE",
        allowed: false,
        reason: "High-value transactions require human authorization.",
      };
    }
  }

  if (requestedAction === "REQUEST_PAYMENT_METHOD_UPDATE") {
    if (txn.failureType !== "CARD_EXPIRED") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Payment method update is only required for expired credentials.",
      };
    }
  }

  if (requestedAction === "DO_NOTHING") {
    return {
      action: "DO_NOTHING",
      allowed: true,
      reason: "No recovery action is required.",
    };
  }

  return {
    action: requestedAction,
    allowed: true,
    reason: "Recovery action passed the safety policy.",
  };
}

/**
 * Full AI Evaluation for a single transaction
 */
export function evaluateTransaction(txn: PublicTransaction): {
  recommendedAction: RecoveryActionType;
  decision: RecoveryDecision;
  recoverableRevenuePaise: number;
} {
  const recommendedAction = evaluateReviveStrategy(txn);
  const decision = evaluateRecoveryPolicy(txn, recommendedAction);

  let recoverableRevenuePaise = 0;
  if (
    decision.allowed &&
    (decision.action === "RETRY_PAYMENT" || decision.action === "WAIT_AND_RETRY")
  ) {
    recoverableRevenuePaise = txn.amountPaise;
  }

  return {
    recommendedAction,
    decision,
    recoverableRevenuePaise,
  };
}

/**
 * Valid failure types list
 */
const VALID_FAILURE_TYPES: FailureType[] = [
  "TEMPORARY_ISSUER_FAILURE",
  "NETWORK_TIMEOUT",
  "INSUFFICIENT_FUNDS",
  "CARD_EXPIRED",
  "HARD_DECLINE",
  "RETRY_LIMIT_EXCEEDED",
  "DUPLICATE_PAYMENT",
  "UNKNOWN_FAILURE",
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = ["CARD", "UPI", "NETBANKING", "WALLET"];
const VALID_STATUSES: TransactionStatus[] = ["failed", "created", "authorized", "captured"];
const VALID_SEGMENTS: CustomerSegment[] = ["consumer", "smb", "enterprise"];

/**
 * Parse CSV text into validated PublicTransaction array
 */
export function parseTransactionsCSV(csvText: string): {
  transactions: PublicTransaction[];
  errors: string[];
  evaluationSummary: {
    total: number;
    allowed: number;
    blocked: number;
    escalated: number;
    totalAmountPaise: number;
    recoverableAmountPaise: number;
    actionBreakdown: Record<RecoveryActionType, number>;
  };
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const errors: string[] = [];
  const transactions: PublicTransaction[] = [];

  const evaluationSummary = {
    total: 0,
    allowed: 0,
    blocked: 0,
    escalated: 0,
    totalAmountPaise: 0,
    recoverableAmountPaise: 0,
    actionBreakdown: {
      RETRY_PAYMENT: 0,
      WAIT_AND_RETRY: 0,
      REQUEST_PAYMENT_METHOD_UPDATE: 0,
      DO_NOTHING: 0,
      ESCALATE: 0,
    } as Record<RecoveryActionType, number>,
  };

  if (lines.length === 0) {
    return { transactions, errors: ["The provided CSV file is empty."], evaluationSummary };
  }

  // Header parsing
  const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, index) => {
    headerMap.set(h.toLowerCase(), index);
  });

  const getCol = (row: string[], name: string): string => {
    const idx = headerMap.get(name.toLowerCase());
    if (idx !== undefined && row[idx] !== undefined) {
      return row[idx].trim().replace(/^["']|["']$/g, "");
    }
    return "";
  };

  const rows = lines.slice(1);
  const now = new Date().toISOString();

  rows.forEach((line, rowIndex) => {
    // Basic comma separation supporting quoted strings
    const cells: string[] = [];
    let cur = "";
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());

    const lineNum = rowIndex + 2;

    const rawId = getCol(cells, "id") || getCol(cells, "transaction_id") || getCol(cells, "transactionid");
    const rawAmount = getCol(cells, "amount") || getCol(cells, "amountpaise") || getCol(cells, "amount_paise") || getCol(cells, "amount_in_inr");
    const rawMethod = getCol(cells, "payment_method") || getCol(cells, "paymentmethod") || getCol(cells, "method");
    const rawFailure = getCol(cells, "failure_type") || getCol(cells, "failuretype") || getCol(cells, "failure");
    const rawStatus = getCol(cells, "status");
    const rawRetryCount = getCol(cells, "retry_count") || getCol(cells, "retrycount");
    const rawMaxRetries = getCol(cells, "max_retries") || getCol(cells, "maxretries");
    const rawCustomer = getCol(cells, "customer_id") || getCol(cells, "customerid");
    const rawSegment = getCol(cells, "customer_segment") || getCol(cells, "segment");

    // Process ID
    const id = rawId ? (rawId.startsWith("txn_") ? rawId : `txn_${rawId}`) : `txn_csv_${String(rowIndex + 1).padStart(3, "0")}`;

    // Process Amount (auto-detect if in rupees or paise)
    let parsedAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      parsedAmount = 149900; // default 1,499 INR
    }
    // If entered as standard INR like 499 or 1500 instead of paise, scale to paise
    const amountPaise = parsedAmount < 10000 && !rawAmount.toLowerCase().includes("paise")
      ? Math.round(parsedAmount * 100)
      : Math.round(parsedAmount);

    // Process Payment Method
    let paymentMethod: PaymentMethod = "CARD";
    const methodUpper = rawMethod.toUpperCase();
    if (VALID_PAYMENT_METHODS.includes(methodUpper as PaymentMethod)) {
      paymentMethod = methodUpper as PaymentMethod;
    } else if (methodUpper.includes("UPI")) {
      paymentMethod = "UPI";
    } else if (methodUpper.includes("NET") || methodUpper.includes("BANK")) {
      paymentMethod = "NETBANKING";
    } else if (methodUpper.includes("WALLET") || methodUpper.includes("PAYTM")) {
      paymentMethod = "WALLET";
    }

    // Process Failure Type
    let failureType: FailureType = "TEMPORARY_ISSUER_FAILURE";
    const failureUpper = rawFailure.toUpperCase().replace(/\s+/g, "_");
    if (VALID_FAILURE_TYPES.includes(failureUpper as FailureType)) {
      failureType = failureUpper as FailureType;
    } else if (failureUpper.includes("TIMEOUT")) {
      failureType = "NETWORK_TIMEOUT";
    } else if (failureUpper.includes("FUND") || failureUpper.includes("BALANCE")) {
      failureType = "INSUFFICIENT_FUNDS";
    } else if (failureUpper.includes("EXPIRE")) {
      failureType = "CARD_EXPIRED";
    } else if (failureUpper.includes("DECLINE") || failureUpper.includes("HARD")) {
      failureType = "HARD_DECLINE";
    } else if (failureUpper.includes("RETRY") || failureUpper.includes("LIMIT")) {
      failureType = "RETRY_LIMIT_EXCEEDED";
    } else if (failureUpper.includes("DUP")) {
      failureType = "DUPLICATE_PAYMENT";
    } else if (failureUpper) {
      failureType = "UNKNOWN_FAILURE";
    }

    // Status
    let status: TransactionStatus = "failed";
    const statusLower = rawStatus.toLowerCase();
    if (VALID_STATUSES.includes(statusLower as TransactionStatus)) {
      status = statusLower as TransactionStatus;
    }

    const retryCount = parseInt(rawRetryCount, 10) || 0;
    const maxRetries = parseInt(rawMaxRetries, 10) || 3;
    const customerId = rawCustomer || `cust_${String(rowIndex + 1).padStart(3, "0")}`;
    const segment: CustomerSegment = VALID_SEGMENTS.includes(rawSegment.toLowerCase() as CustomerSegment)
      ? (rawSegment.toLowerCase() as CustomerSegment)
      : "consumer";

    const txn: PublicTransaction = {
      id,
      merchantId: "merchant_revive_demo",
      customerId,
      amountPaise,
      currency: "INR",
      paymentMethod,
      status,
      failureType,
      retryCount,
      maxRetries,
      createdAt: now,
      lastAttemptAt: now,
      customer: {
        segment,
        previousSuccessfulPayments: 5,
        previousFailedPayments: 1,
        lifetimeValuePaise: amountPaise * 4,
        previousRecoveryCount: 1,
        lastPaymentAt: now,
      },
    };

    // Run AI Evaluation on the transaction
    const evaluation = evaluateTransaction(txn);

    evaluationSummary.total += 1;
    evaluationSummary.totalAmountPaise += txn.amountPaise;
    evaluationSummary.recoverableAmountPaise += evaluation.recoverableRevenuePaise;
    evaluationSummary.actionBreakdown[evaluation.decision.action] =
      (evaluationSummary.actionBreakdown[evaluation.decision.action] || 0) + 1;

    if (evaluation.decision.allowed) {
      evaluationSummary.allowed += 1;
    } else if (evaluation.decision.action === "ESCALATE") {
      evaluationSummary.escalated += 1;
    } else {
      evaluationSummary.blocked += 1;
    }

    transactions.push(txn);
  });

  return { transactions, errors, evaluationSummary };
}

/**
 * Storage helpers for persisting custom CSV transactions in browser
 */
export function getCustomTransactions(): PublicTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PublicTransaction[];
  } catch (err) {
    console.error("Failed to load custom transactions:", err);
    return [];
  }
}

export function saveCustomTransactions(newTxns: PublicTransaction[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCustomTransactions();
    // Merge without duplicates based on id
    const existingMap = new Map(existing.map((t) => [t.id, t]));
    newTxns.forEach((t) => existingMap.set(t.id, t));
    const merged = Array.from(existingMap.values());
    localStorage.setItem(CUSTOM_TRANSACTIONS_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error("Failed to save custom transactions:", err);
  }
}

export function clearCustomTransactions(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOM_TRANSACTIONS_STORAGE_KEY);
}

/**
 * Sample CSV Template Generator
 */
export function generateSampleCSV(): string {
  const headers = "id,amount,payment_method,failure_type,status,retry_count,max_retries,customer_segment";
  const rows = [
    "txn_csv_001,49900,UPI,TEMPORARY_ISSUER_FAILURE,failed,0,3,consumer",
    "txn_csv_002,149900,CARD,NETWORK_TIMEOUT,failed,0,3,smb",
    "txn_csv_003,249900,CARD,INSUFFICIENT_FUNDS,failed,0,3,consumer",
    "txn_csv_004,9900,CARD,CARD_EXPIRED,failed,0,3,consumer",
    "txn_csv_005,19900,CARD,HARD_DECLINE,failed,0,3,consumer",
    "txn_csv_006,7500000,UPI,TEMPORARY_ISSUER_FAILURE,failed,0,3,enterprise",
    "txn_csv_007,49900,UPI,DUPLICATE_PAYMENT,failed,0,3,consumer",
    "txn_csv_008,24900,NETBANKING,UNKNOWN_FAILURE,failed,0,3,smb",
    "txn_csv_009,49900,CARD,RETRY_LIMIT_EXCEEDED,failed,3,3,consumer",
    "txn_csv_010,89900,WALLET,TEMPORARY_ISSUER_FAILURE,failed,0,3,consumer",
  ];
  return [headers, ...rows].join("\n");
}
