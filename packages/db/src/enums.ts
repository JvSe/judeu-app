export type Role = "CLIENT" | "PROVIDER" | "BOTH";
export type ProviderStatus = "PENDING" | "APPROVED" | "BLOCKED";
export type OrderStatus =
  | "CREATED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "AWAITING_CONFIRMATION"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "PIX" | "CARD" | "CASH";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED";
export type WalletTxType = "CREDIT" | "DEBIT";
export type AiRole = "USER" | "ASSISTANT" | "TOOL";
export type NotificationType = "ORDER" | "MESSAGE" | "SUPPORT" | "JOB";
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
export type JobContractType = "CLT" | "PJ" | "FREELANCE" | "TEMPORARY";
export type JobStatus = "OPEN" | "CLOSED";
export type WeekDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
export type JobApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type SupportTicketCategory =
  | "PAYMENT"
  | "CANCELLATION"
  | "SECURITY"
  | "ACCOUNT"
  | "DISPUTE"
  | "OTHER";
export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
