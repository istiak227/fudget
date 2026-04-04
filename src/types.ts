export type EntryKind = "credit" | "debit";

export type MonthlyEntry = {
  id: string;
  name: string;
  amount: number;
  date?: string;
  group?: string;
};

export type MonthRecord = {
  monthKey: string;
  credits: MonthlyEntry[];
  debits: MonthlyEntry[];
  updatedAt: string;
};

export type SavingsEntry = {
  id: string;
  name: string;
  amount: number;
  date?: string;
};

export type SavingsAccount = {
  id: string;
  name: string;
  credits: SavingsEntry[];
  debits: SavingsEntry[];
  updatedAt: string;
};

export type PersonLedger = {
  id: string;
  person: string;
  borrowed: SavingsEntry[];
  repaid: SavingsEntry[];
  updatedAt: string;
};

export type AppData = {
  months: Record<string, MonthRecord>;
  savings: SavingsAccount[];
  loans: PersonLedger[];
  lending: PersonLedger[];
  groups: string[];
  updatedAt: string;
};
