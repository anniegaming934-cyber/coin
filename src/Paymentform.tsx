import React, { FC, useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign, RotateCcw } from "lucide-react";

export type PaymentMethod = "cashapp" | "paypal" | "chime";

type Totals = { cashapp: number; paypal: number; chime: number };

export interface PaymentFormProps {
  initialTotals?: Partial<Totals>;
  onTotalsChange?: (totals: Totals) => void;
  onRecharge?: (payload: {
    amount: number;
    method: PaymentMethod;
    note?: string;
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
    className="rounded-xl border bg-white p-4 shadow-sm"
    style={{ borderColor: color }}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase text-gray-500">
        {label}
      </span>
      <DollarSign className="h-4 w-4" style={{ color }} />
    </div>
    <div className="mt-2 text-2xl font-bold" style={{ color }}>
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

  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  const overall = useMemo(
    () => totals.cashapp + totals.paypal + totals.chime,
    [totals]
  );

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cashapp");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // 🟢 ADD PAYMENT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    try {
      setSubmitting(true);
      setTotals((prev) => ({ ...prev, [method]: prev[method] + amt }));

      await onRecharge?.({
        amount: +amt.toFixed(2),
        method,
        note: note.trim() || undefined,
      });

      setOk(`Added ${fmtUSD(amt)} via ${method}.`);

      // ✅ Reset fields after payment is added
      setAmount("");
      setNote("");
      setMethod("cashapp");
    } catch (err: any) {
      setError(err?.message || "Failed to process payment.");
    } finally {
      setSubmitting(false);
    }
  };

  // 🟠 RESET ALL TOTALS
  const handleReset = async () => {
    const confirm = window.confirm("Reset all payment totals?");
    if (!confirm) return;

    try {
      setResetting(true);
      setError(null);
      setOk(null);

      if (onReset) {
        const fresh = (await onReset()) as Totals | void;
        setTotals(fresh || { cashapp: 0, paypal: 0, chime: 0 });
      } else {
        setTotals({ cashapp: 0, paypal: 0, chime: 0 });
      }

      setOk("All payment totals reset.");
      // ✅ Clear form as well
      setAmount("");
      setNote("");
      setMethod("cashapp");
    } catch (e: any) {
      setError(e?.message || "Failed to reset totals.");
    } finally {
      setResetting(false);
    }
  };

  const pill = (active: boolean, bg: string, border: string, text: string) =>
    `${
      active
        ? `${bg} ${border} ${text}`
        : "bg-white border-gray-300 text-gray-700"
    } border rounded-lg px-3 py-2 transition flex items-center gap-2`;

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 space-y-6">
      {/* Totals Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TotalPill
          label="Cash App Total"
          value={totals.cashapp}
          color="rgb(16,185,129)"
        />
        <TotalPill
          label="PayPal Total"
          value={totals.paypal}
          color="rgb(59,130,246)"
        />
        <TotalPill
          label="Chime Total"
          value={totals.chime}
          color="rgb(34,197,94)"
        />
        <TotalPill
          label="All Payments"
          value={overall}
          color="rgb(79,70,229)"
        />
      </div>

      {/* Form Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Add Total Payment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMethod("cashapp")}
                className={pill(
                  method === "cashapp",
                  "bg-emerald-50",
                  "border-emerald-300",
                  "text-emerald-700"
                )}
              >
                <span className="font-bold text-lg">$</span> Cash&nbsp;App
              </button>
              <button
                type="button"
                onClick={() => setMethod("paypal")}
                className={pill(
                  method === "paypal",
                  "bg-blue-50",
                  "border-blue-300",
                  "text-blue-700"
                )}
              >
                <span className="font-semibold text-sm">PP</span> PayPal
              </button>
              <button
                type="button"
                onClick={() => setMethod("chime")}
                className={pill(
                  method === "chime",
                  "bg-green-50",
                  "border-green-300",
                  "text-green-700"
                )}
              >
                <span className="font-semibold text-sm">ch</span> Chime
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (USD)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (e.g., 25)"
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500"
              min={0.01}
              step="0.01"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="Reference, transaction id, etc."
            />
          </div>

          {/* Alerts */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {ok && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {ok}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add Amount
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting || resetting}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {resetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Reset Totals
          </button>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
