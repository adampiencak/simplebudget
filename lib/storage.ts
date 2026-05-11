import { createClient } from "@/lib/supabase/client";

export type TxnKind = "income" | "expense";
export type Category = "bills" | "girlfriend" | "myself";

export const CATEGORIES: { id: Category; label: string; color: string; bar: string }[] = [
  { id: "bills", label: "Bills", color: "text-sky-400", bar: "bg-sky-400" },
  { id: "girlfriend", label: "Girlfriend", color: "text-pink-400", bar: "bg-pink-400" },
  { id: "myself", label: "Myself", color: "text-amber-400", bar: "bg-amber-400" },
];

export type Txn = {
  id: string;
  kind: TxnKind;
  amount: number;
  note: string;
  date: string; // ISO yyyy-mm-dd
  category: Category | null;
  createdAt: number;
};

export type Settings = {
  salary: number;
  currency: string;
  payDay: number;
  autoSalary: boolean;
  lastAutoSalaryYM: string | null;
};

export const defaultSettings: Settings = {
  salary: 0,
  currency: "USD",
  payDay: 10,
  autoSalary: true,
  lastAutoSalaryYM: null,
};

// ---------- DB row mappers ----------

type TxnRow = {
  id: string;
  kind: TxnKind;
  amount: number | string;
  note: string | null;
  date: string;
  category: Category | null;
  created_at: string;
};

function rowToTxn(r: TxnRow): Txn {
  return {
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    note: r.note ?? "",
    date: r.date,
    category: r.category ?? null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

const TXN_SELECT = "id,kind,amount,note,date,category,created_at";

type SettingsRow = {
  user_id: string;
  salary: number | string;
  currency: string;
  pay_day: number;
  auto_salary: boolean;
  last_auto_salary_ym: string | null;
};

function rowToSettings(r: SettingsRow): Settings {
  return {
    salary: Number(r.salary),
    currency: r.currency,
    payDay: r.pay_day,
    autoSalary: r.auto_salary,
    lastAutoSalaryYM: r.last_auto_salary_ym,
  };
}

// ---------- Transactions ----------

export async function fetchTxns(): Promise<Txn[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TXN_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data as TxnRow[]).map(rowToTxn);
}

export async function insertTxn(
  t: Omit<Txn, "id" | "createdAt">
): Promise<Txn | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      kind: t.kind,
      amount: t.amount,
      note: t.note || null,
      date: t.date,
      category: t.kind === "expense" ? t.category : null,
    })
    .select(TXN_SELECT)
    .single();
  if (error || !data) {
    console.error(error);
    return null;
  }
  return rowToTxn(data as TxnRow);
}

export async function updateTxn(
  id: string,
  t: Omit<Txn, "id" | "createdAt">
): Promise<Txn | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      kind: t.kind,
      amount: t.amount,
      note: t.note || null,
      date: t.date,
      category: t.kind === "expense" ? t.category : null,
    })
    .eq("id", id)
    .select(TXN_SELECT)
    .single();
  if (error || !data) {
    console.error(error);
    return null;
  }
  return rowToTxn(data as TxnRow);
}

export async function deleteTxnById(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// ---------- Settings ----------

export async function fetchSettings(): Promise<Settings> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return defaultSettings;

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return defaultSettings;
  }
  if (!data) {
    // Create a default row for this user
    await supabase.from("settings").insert({ user_id: user.id });
    return defaultSettings;
  }
  return rowToSettings(data as SettingsRow);
}

export async function upsertSettings(s: Settings): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;
  const { error } = await supabase.from("settings").upsert({
    user_id: user.id,
    salary: s.salary,
    currency: s.currency,
    pay_day: s.payDay,
    auto_salary: s.autoSalary,
    last_auto_salary_ym: s.lastAutoSalaryYM,
  });
  if (error) console.error(error);
}

// ---------- Helpers ----------

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
