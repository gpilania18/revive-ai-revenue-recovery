import type {
  CustomerContext,
  FailureType,
  PaymentMethod,
  RecoveryActionType,
  TransactionStatus,
} from "../simulator/types";

export interface TransactionDocument {
  transactionId: string;
  customerId: string;
  merchantId: string;

  amountPaise: number;
  currency: "INR";

  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  failureType: FailureType;

  retryCount: number;
  maxRetries: number;
  priorActions: RecoveryActionType[];

  customer: CustomerContext;

  createdAt: Date;
  lastAttemptAt: Date;
  updatedAt: Date;

  source: "SIMULATOR";
  seed: number;
}