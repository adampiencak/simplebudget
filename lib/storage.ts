export type TxnKind = "income" | "expense";

export type Txn = {
  id: string;
  kind: TxnKind;
  amount: number; // positive number, sign implied by kind
  note: string;
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
};

export type Settings = {
  salary: number;
  currency: string; // ISO 4217
  payDay: number; // day of month (1-31)
  autoSalary: boolean;
  lastAutoSalaryYM: string | null; // "YYYY-MM" of last auto-logged salary
};

const TXN_KEY = "budget.txns.v1";
const SET_KEY = "budget.settings.v1";

export const defaultSettings: Settings = {
  salary: 0,
  currency: "USD",
  payDay: 10,
  autoSalary: true,
  lastAutoSalaryYM: null,
};

export function loadTxns(): Txn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TXN_KEY);
    return raw ? (JSON.parse(raw) as Txn[]) : [];
  } catch {
    return [];
  }
}

export function saveTxns(txns: Txn[]) {
  localStorage.setItem(TXN_KEY, JSON.stringify(txns));
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SET_KEY, JSON.stringify(s));
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ymOf(iso: string): string {
  return iso.slice(0, 7);
}

export function currentYM(): string {
  return ymOf(todayISO());
}

export function formatMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function signed(t: Txn): number {
  return t.kind === "income" ? t.amount : -t.amount;
}
