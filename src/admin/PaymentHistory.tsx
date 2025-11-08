// src/PaymentHistory.tsx
import React, { type FC, useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";

export type PaymentMethod = "cashapp" | "paypal" | "chime";
type TxType = "cashin" | "cashout";
type FilterType = "all" | "cashin" | "cashout";

interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  date: string; // "YYYY-MM-DD"
  createdAt: string; // ISO
  txType?: TxType;
}

interface PaymentHistoryProps {
  apiBase: string; // e.g. "/api"
}

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// 12-hour time formatter
const fmtTime12h = (iso: string | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
const CASHOUT_API = "/api/payments/cashout";

const PaymentHistory: FC<PaymentHistoryProps> = ({ apiBase }) => {
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // yyyy-mm-dd
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔽 type filter
  const [filterType, setFilterType] = useState<FilterType>("all");

  // editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("cashapp");
  const [editNote, setEditNote] = useState<string>("");
  const [editTxType, setEditTxType] = useState<TxType>("cashin");

  // delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get<Payment[]>(`${apiBase}/payments`, {
        params: { date },
      });

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response for payments");
      }

      setPayments(data);
    } catch (e: any) {
      console.error("Failed to load payments:", e);
      setError(e?.message || "Failed to load payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // start editing a row
  const startEdit = (p: Payment) => {
    const type: TxType = p.txType ?? "cashin";
    setEditingId(p.id);
    setEditAmount(String(p.amount));
    setEditMethod(p.method);
    setEditNote(p.note ?? "");
    setEditTxType(type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditMethod("cashapp");
    setEditNote("");
    setEditTxType("cashin");
  };
  
  const saveEdit = async (id: string) => {
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);
      await axios.put(`${apiBase}/payments/${id}`, {
        amount: amt,
        method: editMethod,
        note: editNote.trim() || null,
        date,
        txType: editTxType,
      });

      await loadPayments();
      cancelEdit();
    } catch (e) {
      console.error("Failed to update payment:", e);
      alert("Failed to update payment.");
    } finally {
      setLoading(false);
    }
  };

  // open delete modal
  const openDeleteModal = (p: Payment) => {
    setDeleteId(p.id);
    setDeleteTarget(p);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      setDeleting(true);
      await axios.delete(`${apiBase}/payments/${deleteId}`);
      await loadPayments();
      setShowDeleteModal(false);
      setDeleteId(null);
      setDeleteTarget(null);
    } catch (e) {
      console.error("Failed to delete payment:", e);
      alert("Failed to delete payment.");
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteId(null);
    setDeleteTarget(null);
  };

  // apply type filter
  const filteredPayments = payments.filter((p) => {
    const tx = (p.txType ?? "cashin") as TxType;
    if (filterType === "all") return true;
    return tx === filterType;
  });

  const isCashOutView = filterType === "cashout";

  return (
    <>
      <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Payments by Date
          </h2>

          <div className="flex flex-wrap items-end gap-4">
            {/* Date picker */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Select Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Type filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All</option>
                <option value="cashin">Cash In</option>
                <option value="cashout">Cash Out</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading payments...
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && !error && filteredPayments.length === 0 && (
          <p className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-4 text-center">
            No payments recorded for <span className="font-medium">{date}</span>{" "}
            with this filter.
          </p>
        )}

        {!loading && !error && filteredPayments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Amount</th>
                  {/* 👇 change header label if viewing cash out */}
                  <th className="px-3 py-2">
                    {isCashOutView ? "Name" : "Note"}
                  </th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((p) => {
                  const time = fmtTime12h(p.createdAt); // 12h format
                  const isEditing = editingId === p.id;
                  const tx = (p.txType ?? "cashin") as TxType;
                  const isOut = tx === "cashout";

                  if (isEditing) {
                    return (
                      <tr key={p.id} className="bg-indigo-50/40">
                        {/* Type edit */}
                        <td className="px-3 py-2">
                          <select
                            value={editTxType}
                            onChange={(e) =>
                              setEditTxType(e.target.value as TxType)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          >
                            <option value="cashin">Cash In</option>
                            <option value="cashout">Cash Out</option>
                          </select>
                        </td>

                        {/* Method edit */}
                        <td className="px-3 py-2">
                          <select
                            value={editMethod}
                            onChange={(e) =>
                              setEditMethod(e.target.value as PaymentMethod)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          >
                            <option value="cashapp">Cash App</option>
                            <option value="paypal">PayPal</option>
                            <option value="chime">Chime</option>
                          </select>
                        </td>

                        {/* Amount edit */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            step="0.01"
                            min={0.01}
                          />
                        </td>

                        {/* Name / Note edit */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            placeholder={isCashOutView ? "Name" : "Note"}
                          />
                        </td>

                        {/* Time read-only */}
                        <td className="px-3 py-2 text-gray-500">{time}</td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(p.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // normal row
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      {/* Type badge */}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isOut
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {isOut ? "Cash Out" : "Cash In"}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-3 py-2 capitalize">{p.method}</td>

                      {/* Amount with + / - */}
                      <td
                        className={`px-3 py-2 font-medium ${
                          isOut ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {isOut ? "-" : "+"}
                        {fmtUSD(p.amount)}
                      </td>

                      {/* Name or Note */}
                      <td className="px-3 py-2 text-gray-600">
                        {p.note ? (
                          <span>{p.note}</span>
                        ) : (
                          <span className="italic text-gray-400">—</span>
                        )}
                      </td>

                      {/* Time in 12h format */}
                      <td className="px-3 py-2 text-gray-500">{time}</td>

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(p)}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete this payment?
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  You&apos;re about to delete a{" "}
                  <span className="font-semibold">
                    {fmtUSD(deleteTarget.amount)}
                  </span>{" "}
                  {deleteTarget.txType === "cashout" ? "cash-out" : "cash-in"}{" "}
                  payment via{" "}
                  <span className="font-semibold">{deleteTarget.method}</span>{" "}
                  on <span className="font-semibold">{deleteTarget.date}</span>.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="w-full max-w-sm inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete payment
              </button>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="w-full max-w-sm inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentHistory;
