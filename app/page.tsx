"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Txn,
  Settings,
  Category,
  CATEGORIES,
  fetchTxns,
  insertTxn,
  updateTxn,
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

type Tab = "home" | "stats" | "add" | "settings";
type Screen = { tab: Tab } | { tab: "edit"; txn: Txn };

export default function Page() {
  const [loaded, setLoaded] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [email, setEmail] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ tab: "home" });
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
          category: null,
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
    setScreen({ tab: "home" });
  }

  async function saveEdit(id: string, t: Omit<Txn, "id" | "createdAt">) {
    const updated = await updateTxn(id, t);
    if (updated) {
      setTxns((prev) => prev.map((x) => (x.id === id ? updated : x)));
    }
    setScreen({ tab: "home" });
  }

  async function deleteTxn(id: string) {
    const ok = await deleteTxnById(id);
    if (ok) setTxns((prev) => prev.filter((t) => t.id !== id));
    setScreen({ tab: "home" });
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
      {screen.tab === "home" && (
        <Home
          settings={settings}
          viewYM={viewYM}
          shiftMonth={shiftMonth}
          income={income}
          expense={expense}
          balance={balance}
          txns={monthTxns}
          onEdit={(t) => setScreen({ tab: "edit", txn: t })}
        />
      )}
      {screen.tab === "stats" && (
        <Stats
          settings={settings}
          viewYM={viewYM}
          shiftMonth={shiftMonth}
          txns={monthTxns}
        />
      )}
      {screen.tab === "add" && (
        <TxnForm
          mode="create"
          settings={settings}
          onSubmit={addTxn}
          onCancel={() => setScreen({ tab: "home" })}
        />
      )}
      {screen.tab === "edit" && (
        <TxnForm
          mode="edit"
          settings={settings}
          initial={screen.txn}
          onSubmit={(t) => saveEdit(screen.txn.id, t)}
          onDelete={() => deleteTxn(screen.txn.id)}
          onCancel={() => setScreen({ tab: "home" })}
        />
      )}
      {screen.tab === "settings" && (
        <SettingsView
          settings={settings}
          onSave={updateSettings}
          email={email}
          onSignOut={signOut}
        />
      )}
      <TabBar
        tab={screen.tab === "edit" ? "home" : screen.tab}
        setTab={(t) => setScreen({ tab: t })}
      />
    </main>
  );
}

function MonthHeader({
  viewYM,
  shiftMonth,
}: {
  viewYM: string;
  shiftMonth: (d: number) => void;
}) {
  const monthName = new Date(viewYM + "-01").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
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
  onEdit,
}: {
  settings: Settings;
  viewYM: string;
  shiftMonth: (d: number) => void;
  income: number;
  expense: number;
  balance: number;
  txns: Txn[];
  onEdit: (t: Txn) => void;
}) {
  return (
    <div>
      <MonthHeader viewYM={viewYM} shiftMonth={shiftMonth} />

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
            {txns.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => onEdit(t)}
                    className="w-full flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3 active:bg-neutral-800 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {t.note || (t.kind === "income" ? "Income" : "Expense")}
                      </div>
                      <div className="text-xs text-neutral-500 flex items-center gap-2">
                        <span>{t.date}</span>
                        {cat && (
                          <span className={`${cat.color}`}>· {cat.label}</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`tabular-nums font-medium ml-3 ${
                        t.kind === "income" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {t.kind === "income" ? "+" : "−"}
                      {formatMoney(t.amount, settings.currency).replace(/^[-]/, "")}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stats({
  settings,
  viewYM,
  shiftMonth,
  txns,
}: {
  settings: Settings;
  viewYM: string;
  shiftMonth: (d: number) => void;
  txns: Txn[];
}) {
  const { byCategory, totalExpense, uncategorized } = useMemo(() => {
    const byCategory: Record<Category, number> = {
      bills: 0,
      girlfriend: 0,
      myself: 0,
    };
    let totalExpense = 0;
    let uncategorized = 0;
    for (const t of txns) {
      if (t.kind !== "expense") continue;
      totalExpense += t.amount;
      if (t.category) byCategory[t.category] += t.amount;
      else uncategorized += t.amount;
    }
    return { byCategory, totalExpense, uncategorized };
  }, [txns]);

  return (
    <div>
      <MonthHeader viewYM={viewYM} shiftMonth={shiftMonth} />

      <section className="rounded-2xl bg-neutral-900 p-5 mt-2">
        <div className="text-sm text-neutral-400">Total spent</div>
        <div className="text-4xl font-bold mt-1 text-red-400">
          {formatMoney(totalExpense, settings.currency)}
        </div>
      </section>

      {totalExpense === 0 ? (
        <div className="text-neutral-500 text-sm py-12 text-center">
          No expenses yet this month.
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-3">
              By category
            </h2>

            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-neutral-900">
              {CATEGORIES.map((c) => {
                const pct = totalExpense > 0 ? (byCategory[c.id] / totalExpense) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={c.id}
                    className={c.bar}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${pct.toFixed(1)}%`}
                  />
                );
              })}
              {uncategorized > 0 && (
                <div
                  className="bg-neutral-600"
                  style={{ width: `${(uncategorized / totalExpense) * 100}%` }}
                />
              )}
            </div>

            <ul className="space-y-2 mt-4">
              {CATEGORIES.map((c) => {
                const amt = byCategory[c.id];
                const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                return (
                  <li
                    key={c.id}
                    className="rounded-xl bg-neutral-900 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.bar}`} />
                        <span className="font-medium">{c.label}</span>
                      </div>
                      <div className="tabular-nums font-medium">
                        {formatMoney(amt, settings.currency)}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {pct.toFixed(1)}% of expenses
                    </div>
                  </li>
                );
              })}
              {uncategorized > 0 && (
                <li className="rounded-xl bg-neutral-900 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-600" />
                      <span className="font-medium text-neutral-400">
                        Uncategorized
                      </span>
                    </div>
                    <div className="tabular-nums font-medium">
                      {formatMoney(uncategorized, settings.currency)}
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function TxnForm({
  mode,
  settings,
  initial,
  onSubmit,
  onDelete,
  onCancel,
}: {
  mode: "create" | "edit";
  settings: Settings;
  initial?: Txn;
  onSubmit: (t: Omit<Txn, "id" | "createdAt">) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "income">(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [category, setCategory] = useState<Category | null>(initial?.category ?? "bills");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return;
    setBusy(true);
    await onSubmit({
      kind,
      amount: n,
      note: note.trim(),
      date,
      category: kind === "expense" ? category : null,
    });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="pt-2">
      <header className="flex items-center justify-between py-2">
        <button type="button" onClick={onCancel} className="text-neutral-400 px-2 py-2">
          Cancel
        </button>
        <h1 className="text-lg font-semibold">
          {mode === "create" ? "New entry" : "Edit entry"}
        </h1>
        <button
          type="submit"
          disabled={busy}
          className="text-green-400 font-medium px-2 py-2 disabled:opacity-60"
        >
          {busy ? "…" : "Save"}
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
          autoFocus={mode === "create"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-neutral-900 rounded-xl px-4 py-4 text-2xl tabular-nums outline-none focus:ring-2 focus:ring-green-500/40"
        />
      </label>

      {kind === "expense" && (
        <div className="mt-4">
          <div className="text-sm text-neutral-400 mb-1">Category</div>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`py-3 rounded-xl font-medium text-sm ${
                  category === c.id
                    ? `bg-neutral-800 ${c.color} ring-2 ring-inset ring-current`
                    : "bg-neutral-900 text-neutral-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {mode === "edit" && onDelete && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this entry?")) onDelete();
          }}
          className="w-full mt-6 bg-red-500/10 text-red-400 rounded-xl py-3 font-medium"
        >
          Delete
        </button>
      )}
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
        <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>
          Stats
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
