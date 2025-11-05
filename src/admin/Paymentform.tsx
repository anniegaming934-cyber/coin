import React, { type FC, useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign, RotateCcw, AlertTriangle } from "lucide-react";

export type PaymentMethod = "cashapp" | "paypal" | "chime";
type Totals = { cashapp: number; paypal: number; chime: number };

export interface PaymentFormProps {
  initialTotals?: Partial<Totals>;
  onTotalsChange?: (totals: Totals) => void;
  onRecharge?: (payload: {
    amount: number;
    method: PaymentMethod;
    note?: string;
    date?: string;
  }) => Promise<void> | void;
  onReset?: () => Promise<Totals> | Totals | void;
}

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const TotalPill: FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    className="rounded-lg border bg-white p-3 shadow-sm text-xs"
    style={{ borderColor: color }}
  >
    <div className="flex items-center justify-between">
      <span className="font-medium text-gray-500">{label}</span>
      <DollarSign className="h-3 w-3" style={{ color }} />
    </div>
    <div className="mt-1 text-lg font-bold" style={{ color }}>
      {fmtUSD(value)}
    </div>
  </div>
);

const PaymentForm: FC<PaymentFormProps> = ({
  initialTotals,
  onTotalsChange,
  onRecharge,
  onReset,
}) => {
  const [totals, setTotals] = useState<Totals>({
    cashapp: initialTotals?.cashapp ?? 0,
    paypal: initialTotals?.paypal ?? 0,
    chime: initialTotals?.chime ?? 0,
  });

  useEffect(() => onTotalsChange?.(totals), [totals, onTotalsChange]);

  const overall = useMemo(
    () => totals.cashapp + totals.paypal + totals.chime,
    [totals]
  );

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cashapp");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setOk(null);
      setTotals((prev) => ({ ...prev, [method]: prev[method] + amt }));
      await onRecharge?.({
        amount: +amt.toFixed(2),
        method,
        note: note.trim() || undefined,
        date,
      });
      setOk(`Added ${fmtUSD(amt)} via ${method}.`);
      setAmount("");
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to add payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    try {
      setResetting(true);
      if (onReset) {
        const fresh = (await onReset()) as Totals | void;
        setTotals(fresh || { cashapp: 0, paypal: 0, chime: 0 });
      } else {
        setTotals({ cashapp: 0, paypal: 0, chime: 0 });
      }
      setOk("All totals reset.");
      setShowResetModal(false);
    } catch (e: any) {
      setError(e?.message || "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const pill = (active: boolean, color: string) =>
    `rounded-md px-2 py-1 text-xs font-medium border transition ${
      active ? `${color} text-white` : "border-gray-300 text-gray-700"
    }`;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 text-sm">
        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TotalPill label="Cash App" value={totals.cashapp} color="#10B981" />
          <TotalPill label="PayPal" value={totals.paypal} color="#3B82F6" />
          <TotalPill label="Chime" value={totals.chime} color="#22C55E" />
          <TotalPill label="Total" value={overall} color="#4F46E5" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMethod("cashapp")}
              className={pill(method === "cashapp", "bg-emerald-500")}
            >
              CashApp
            </button>
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              className={pill(method === "paypal", "bg-blue-500")}
            >
              PayPal
            </button>
            <button
              type="button"
              onClick={() => setMethod("chime")}
              className={pill(method === "chime", "bg-green-500")}
            >
              Chime
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              step="0.01"
              min="0.01"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            rows={1}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
              {error}
            </p>
          )}
          {ok && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
              {ok}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-indigo-600 text-white py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex-1 flex items-center justify-center gap-1 rounded-md border border-gray-300 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xs rounded-lg bg-white p-4 shadow-xl text-sm">
            <div className="flex items-start gap-2">
              <div className="rounded-full bg-amber-100 p-1 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Reset totals?
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  This will clear all payments and set totals to zero.
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {resetting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentForm;
