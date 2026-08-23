import type { Transaction } from "./types";
import type { PublicTransaction } from "./types";

export function toPublicTransaction(transaction: Transaction): PublicTransaction {
  const { groundTruth: _groundTruth, ...publicTransaction } = transaction;
  return publicTransaction;
}

export function assertNoGroundTruth(value: unknown): void {
  if (value && typeof value === "object" && "groundTruth" in value) {
    throw new Error("groundTruth must not be present on decision-facing data");
  }
}
