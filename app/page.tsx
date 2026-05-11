"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Txn,
  Settings,
  fetchTxns,
  insertTxn,
  deleteTxnById,
  fetchSettings,
  upsertSettings,
  defaultSettings,
  todayISO,
  ymOf,
  currentYM,
  formatMoney,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "add" | "settings";

export default function Page() {
  const [loaded, setLoaded] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [email, setEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [viewYM, setViewYM] = useState<string>(currentYM());

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      const [t, s] = await Promise.all([fetchTxns(), fetchSettings()]);
      setTxns(t);
      setSettings(s);
      setLoaded(true);
    })();
  }, []);

  // Auto-log salary once on or after pay day each month
  useEffect(() => {
    if (!loaded) return;
    if (!settings.autoSalary || settings.salary <= 0) return;
    const now = new Date();
    const ym = currentYM();
    if (now.getDate() >= settings.payDay && settings.lastAutoSalaryYM !== ym) {
      const day = String(settings.payDay).padStart(2, "0");
      const iso = `${ym}-${day}`;
      (async () => {
        const created = await insertTxn({
          kind: "income",
          amount: settings.salary,
          note: "Salary",
          date: iso,
        });
        if (created) {
          setTxns((prev) => [created, ...prev]);
          const ns = { ...settings, lastAutoSalaryYM: ym };
          setSettings(ns);
          await upsertSettings(ns);
        }
      })();
    }
  }, [loaded, settings]);

  const monthTxns = useMemo(
    () =>
      txns
        .filter((t) => ymOf(t.date) === viewYM)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [txns, viewYM]
  );

  const { income, expense, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTxns) {
      if (t.kind === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [monthTxns]);

  async function addTxn(t: Omit<Txn, "id" | "createdAt">) {
    const created = await insertTxn(t);
    if (created) setTxns((prev) => [created, ...prev]);
    setTab("home");
  }

  async function deleteTxn(id: string) {
    const ok = await deleteTxnById(id);
    if (ok) setTxns((prev) => prev.filter((t) => t.id !== id));
  }

  async function updateSettings(s: Settings) {
    setSettings(s);
    await upsertSettings(s);
  }

  function shiftMonth(delta: number) {
    const [y, m] = viewYM.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    setViewYM(`${d.getFullYear()}-${mm}`);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/login";
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24 max-w-md mx-auto px-4 pt-[max(env(safe-area-inset-top),1rem)]">
      {tab === "home" && (
        <Home
          settings={settings}
          viewYM={viewYM}
          shiftMonth={shiftMonth}
          income={income}
          expense={expense}
          balance={balance}
          txns={monthTxns}
          onDelete={deleteTxn}
        />
      )}
      {tab === "add" && (
        <AddForm settings={settings} onAdd={addTxn} onCancel={() => setTab("home")} />
      )}
      {tab === "settings" && (
        <SettingsView
          settings={settings}
          onSave={updateSettings}
          email={email}
          onSignOut={signOut}
        />
      )}
      <TabBar tab={tab} setTab={setTab} />
    </main>
  );
}

function Home({
  settings,
  viewYM,
  shiftMonth,
  income,
  expense,
  balance,
  txns,
  onDelete,
}: {
  settings: Settings;
  viewYM: string;
  shiftMonth: (d: number) => void;
  income: number;
  expense: number;
  balance: number;
  txns: Txn[];
  onDelete: (id: string) => void;
}) {
  const monthName = new Date(viewYM + "-01").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="text-neutral-400 px-3 py-2 active:text-white"
        >
          ‹
        </button>
        <h1 className="text-lg font-semibold">{monthName}</h1>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="text-neutral-400 px-3 py-2 active:text-white"
        >
          ›
        </button>
      </header>

      <section className="rounded-2xl bg-neutral-900 p-5 mt-2">
        <div className="text-sm text-neutral-400">Balance</div>
        <div
          className={`text-4xl font-bold mt-1 ${
            balance >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {formatMoney(balance, settings.currency)}
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <div className="flex-1">
            <div className="text-neutral-400">Income</div>
            <div className="text-green-400 font-medium">
              {formatMoney(income, settings.currency)}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-neutral-400">Spent</div>
            <div className="text-red-400 font-medium">
              {formatMoney(expense, settings.currency)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">
          Transactions
        </h2>
        {txns.length === 0 ? (
          <div className="text-neutral-500 text-sm py-8 text-center">
            No transactions this month.
          </div>
        ) : (
          <ul className="space-y-1">
            {txns.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {t.note || (t.kind === "income" ? "Income" : "Expense")}
                  </div>
                  <div className="text-xs text-neutral-500">{t.date}</div>
                </div>
                <div
                  className={`tabular-nums font-medium mr-3 ${
                    t.kind === "income" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {t.kind === "income" ? "+" : "−"}
                  {formatMoney(t.amount, settings.currency).replace(/^[-]/, "")}
                </div>
                <button
                  onClick={() => onDelete(t.id)}
                  aria-label="Delete"
                  className="text-neutral-500 hover:text-red-400 active:text-red-400 px-2"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddForm({
  settings,
  onAdd,
  onCancel,
}: {
  settings: Settings;
  onAdd: (t: Omit<Txn, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return;
    setSaving(true);
    await onAdd({ kind, amount: n, note: note.trim(), date });
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="pt-2">
      <header className="flex items-center justify-between py-2">
        <button type="button" onClick={onCancel} className="text-neutral-400 px-2 py-2">
          Cancel
        </button>
        <h1 className="text-lg font-semibold">New entry</h1>
        <button
          type="submit"
          disabled={saving}
          className="text-green-400 font-medium px-2 py-2 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 mt-2 p-1 rounded-xl bg-neutral-900">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={`py-2 rounded-lg font-medium ${
            kind === "expense" ? "bg-red-500/20 text-red-400" : "text-neutral-400"
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={`py-2 rounded-lg font-medium ${
            kind === "income" ? "bg-green-500/20 text-green-400" : "text-neutral-400"
          }`}
        >
          Income
        </button>
      </div>

      <label className="block mt-6">
        <div className="text-sm text-neutral-400 mb-1">Amount ({settings.currency})</div>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-neutral-900 rounded-xl px-4 py-4 text-2xl tabular-nums outline-none focus:ring-2 focus:ring-green-500/40"
        />
      </label>

      <label className="block mt-4">
        <div className="text-sm text-neutral-400 mb-1">Note</div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Groceries"
          className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500/40"
        />
      </label>

      <label className="block mt-4">
        <div className="text-sm text-neutral-400 mb-1">Date</div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500/40"
        />
      </label>
    </form>
  );
}

function SettingsView({
  settings,
  onSave,
  email,
  onSignOut,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  email: string | null;
  onSignOut: () => void;
}) {
  const [salary, setSalary] = useState(String(settings.salary || ""));
  const [currency, setCurrency] = useState(settings.currency);
  const [payDay, setPayDay] = useState(String(settings.payDay));
  const [autoSalary, setAutoSalary] = useState(settings.autoSalary);

  function save() {
    onSave({
      ...settings,
      salary: parseFloat(salary) || 0,
      currency: currency.toUpperCase().slice(0, 3) || "USD",
      payDay: Math.min(31, Math.max(1, parseInt(payDay) || 10)),
      autoSalary,
    });
  }

  return (
    <div className="pt-2">
      <header className="py-2">
        <h1 className="text-lg font-semibold">Settings</h1>
        {email && <div className="text-xs text-neutral-500 mt-1">Signed in as {email}</div>}
      </header>

      <div className="mt-4 space-y-4">
        <Field label="Salary">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            onBlur={save}
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none"
            placeholder="0.00"
          />
        </Field>

        <Field label="Currency (ISO code)">
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            onBlur={save}
            maxLength={3}
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none uppercase"
            placeholder="USD"
          />
        </Field>

        <Field label="Pay day (day of month)">
          <input
            type="number"
            min={1}
            max={31}
            value={payDay}
            onChange={(e) => setPayDay(e.target.value)}
            onBlur={save}
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 outline-none"
          />
        </Field>

        <label className="flex items-center justify-between bg-neutral-900 rounded-xl px-4 py-3">
          <div>
            <div className="font-medium">Auto-log salary</div>
            <div className="text-xs text-neutral-500">
              Adds salary once per month on pay day
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoSalary}
            onChange={(e) => {
              setAutoSalary(e.target.checked);
              onSave({ ...settings, autoSalary: e.target.checked });
            }}
            className="h-5 w-5 accent-green-500"
          />
        </label>

        <div className="pt-4 border-t border-neutral-800">
          <button
            onClick={onSignOut}
            className="w-full bg-neutral-900 rounded-xl px-4 py-3 text-left text-red-400"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-neutral-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 bg-gradient-to-t from-black via-black/90 to-transparent">
      <div className="bg-neutral-900 rounded-2xl flex items-center justify-between p-1">
        <TabBtn active={tab === "home"} onClick={() => setTab("home")}>
          Home
        </TabBtn>
        <button
          onClick={() => setTab("add")}
          className="bg-green-500 text-black font-bold rounded-xl w-12 h-12 -my-3 shadow-lg active:bg-green-400"
          aria-label="Add transaction"
        >
          +
        </button>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </TabBtn>
      </div>
    </nav>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl text-sm font-medium ${
        active ? "text-white" : "text-neutral-500"
      }`}
    >
      {children}
    </button>
  );
}
