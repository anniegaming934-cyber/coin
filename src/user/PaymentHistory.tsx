// src/PaymentHistory.tsx
import React, { type FC, useEffect, useState } from "react";
import { apiClient } from "../apiConfig";
import { Loader2, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";

export type PaymentMethod = "cashapp" | "paypal" | "chime";
type PaymentType = "deposit" | "redeem" | "freeplay" | "cashin" | "cashout";
type FilterType = "all" | PaymentType;
type PaymentStatus = "pending" | "paying" | "paid" | "remaining";

interface Payment {
  id?: string;          // some APIs use this
  _id?: string;         // Mongoose default
  amount: number;
  amountBase?: number;
  amountFinal?: number;
  bonusAmount?: number;
  bonusRate?: number;
  method: PaymentMethod;
  note?: string | null;
  playerName?: string | null;
  gameName?: string | null;
  type: PaymentType;
  date: string;       // "YYYY-MM-DD"
  createdAt: string;  // ISO
  status?: PaymentStatus;
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

const PaymentHistory: FC<PaymentHistoryProps> = ({ apiBase }) => {
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // yyyy-mm-dd
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔽 filter by "type" field
  const [filterType, setFilterType] = useState<FilterType>("all");

  // editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<PaymentType>("deposit");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("cashapp");
  const [editName, setEditName] = useState<string>(""); // playerName
  const [editStatus, setEditStatus] = useState<PaymentStatus>("pending");
  const [editNote, setEditNote] = useState<string>(""); // optional note, still captured

  // delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await apiClient.get<Payment[]>(`${apiBase}/game-entries`, {
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
    const rowId = p.id || p._id || "";
    const status: PaymentStatus = p.status ?? "pending";

    setEditingId(rowId);
    setEditType(p.type);
    setEditAmount(String(p.amount));
    setEditMethod(p.method);
    setEditName(p.playerName ?? "");
    setEditStatus(status);
    setEditNote(p.note ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditType("deposit");
    setEditAmount("");
    setEditMethod("cashapp");
    setEditName("");
    setEditStatus("pending");
    setEditNote("");
  };

  const saveEdit = async (id: string) => {
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`${apiBase}/payments/${id}`, {
        amount: amt,
        method: editMethod,
        playerName: editName.trim() || null,
        status: editStatus,
        type: editType,
        note: editNote.trim() || null,
        date,
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
    const rowId = p.id || p._id || "";
    setDeleteId(rowId);
    setDeleteTarget(p);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      setDeleting(true);
      await apiClient.delete(`${apiBase}/payments/${deleteId}`);
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

  // filter by type (deposit, redeem, cashout, etc.)
  const filteredPayments = payments.filter((p) => {
    if (filterType === "all") return true;
    return p.type === filterType;
  });

  // status badge helper
  const renderStatusBadge = (status: PaymentStatus | undefined) => {
    const s: PaymentStatus = status ?? "pending";
    const base =
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border";

    if (s === "paid") {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>
          Paid
        </span>
      );
    }
    if (s === "paying") {
      return (
        <span className={`${base} bg-blue-50 text-blue-700 border-blue-100`}>
          Paying
        </span>
      );
    }
    if (s === "remaining") {
      return (
        <span className={`${base} bg-orange-50 text-orange-700 border-orange-100`}>
          Remaining
        </span>
      );
    }
    // pending
    return (
      <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-100`}>
        Pending
      </span>
    );
  };

  // type badge helper
  const renderTypeBadge = (t: PaymentType) => {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border";

    if (t === "deposit" || t === "cashout") {
      return (
        <span className={`${base} bg-red-50 text-red-700 border-red-100`}>
          {t.toUpperCase()}
        </span>
      );
    }
    if (t === "redeem" || t === "cashin") {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>
          {t.toUpperCase()}
        </span>
      );
    }
    // freeplay
    return (
      <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>
        FREEPLAY
      </span>
    );
  };

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

            {/* Type filter (by "type" field) */}
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
                <option value="deposit">Deposit</option>
                <option value="redeem">Redeem</option>
                <option value="freeplay">Freeplay</option>
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
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((p) => {
                  const rowId = p.id || p._id || "";
                  const time = fmtTime12h(p.createdAt);
                  const isEditing = editingId === rowId;

                  const amountToShow = p.amountFinal ?? p.amount;
                  const nameToShow = p.playerName || p.note || "—";

                  if (isEditing) {
                    return (
                      <tr key={rowId} className="bg-indigo-50/40">
                        {/* Type edit */}
                        <td className="px-3 py-2">
                          <select
                            value={editType}
                            onChange={(e) =>
                              setEditType(e.target.value as PaymentType)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="deposit">Deposit</option>
                            <option value="redeem">Redeem</option>
                            <option value="freeplay">Freeplay</option>
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
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
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
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                            step="0.01"
                            min={0.01}
                          />
                        </td>

                        {/* Name (playerName) edit */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                            placeholder="Name"
                          />
                        </td>

                        {/* Status edit */}
                        <td className="px-3 py-2">
                          <select
                            value={editStatus}
                            onChange={(e) =>
                              setEditStatus(
                                e.target.value as PaymentStatus
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="pending">Pending</option>
                            <option value="paying">Paying</option>
                            <option value="paid">Paid</option>
                            <option value="remaining">Remaining</option>
                          </select>
                        </td>

                        {/* Time (read-only) */}
                        <td className="px-3 py-2 text-gray-500">{time}</td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(rowId)}
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
                    <tr key={rowId} className="hover:bg-gray-50">
                      {/* Type */}
                      <td className="px-3 py-2">
                        {renderTypeBadge(p.type)}
                      </td>

                      {/* Method */}
                      <td className="px-3 py-2 capitalize">{p.method}</td>

                      {/* Amount */}
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {fmtUSD(amountToShow)}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 text-gray-700">
                        {nameToShow}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        {renderStatusBadge(p.status)}
                      </td>

                      {/* Time */}
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
                    {fmtUSD(deleteTarget.amountFinal ?? deleteTarget.amount)}
                  </span>{" "}
                  {deleteTarget.type.toUpperCase()} payment via{" "}
                  <span className="font-semibold">{deleteTarget.method}</span>{" "}
                  for{" "}
                  <span className="font-semibold">
                    {deleteTarget.playerName || "Unknown"}
                  </span>{" "}
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
