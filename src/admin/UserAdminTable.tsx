import React, { FC, useEffect, useState } from "react";
import { apiClient } from "../apiConfig";
import {
  Pencil,
  Save,
  X,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Trash2,
} from "lucide-react";

interface UserSummary {
  _id: string;
  username: string;
  email?: string; // still allowed from backend, but not shown

  lastSignInAt?: string | null;
  lastSignOutAt?: string | null;

  totalPayments: number;
  totalFreeplay: number;
  totalDeposit: number;
  totalRedeem: number;
}

interface UserAdminTableProps {
  apiBase?: string; // e.g. "/api"
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const UserAdminTable: FC<UserAdminTableProps> = ({ apiBase = "/api" }) => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    totalPayments: "",
    totalFreeplay: "",
    totalDeposit: "",
    totalRedeem: "",
  });

  const USERS_URL = `${apiBase}/admin/users`;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await apiClient.get<UserSummary[]>(USERS_URL);
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const startEdit = (u: UserSummary) => {
    setEditingId(u._id);
    setEditForm({
      totalPayments: String(u.totalPayments ?? 0),
      totalFreeplay: String(u.totalFreeplay ?? 0),
      totalDeposit: String(u.totalDeposit ?? 0),
      totalRedeem: String(u.totalRedeem ?? 0),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      totalPayments: "",
      totalFreeplay: "",
      totalDeposit: "",
      totalRedeem: "",
    });
  };

  const handleEditChange = (field: keyof typeof editForm, value: string) => {
    // only numbers allowed
    if (/^-?\d*\.?\d*$/.test(value)) {
      setEditForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const saveEdit = async (userId: string) => {
    try {
      const payload = {
        totalPayments: Number(editForm.totalPayments) || 0,
        totalFreeplay: Number(editForm.totalFreeplay) || 0,
        totalDeposit: Number(editForm.totalDeposit) || 0,
        totalRedeem: Number(editForm.totalRedeem) || 0,
      };

      await apiClient.put(`${USERS_URL}/${userId}`, payload);

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId
            ? {
                ...u,
                ...payload,
              }
            : u
        )
      );
      cancelEdit();
    } catch (err: any) {
      console.error(err);
      alert("Failed to save changes.");
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    const ok = window.confirm(
      `Are you sure you want to delete user "${username}"? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      await apiClient.delete(`${USERS_URL}/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete user.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">User Management</h2>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" />
              Refresh
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Sign-in</th>
              <th className="px-4 py-2 font-medium">Sign-out</th>
              <th className="px-4 py-2 font-medium text-right">
                Total Payments
              </th>
              <th className="px-4 py-2 font-medium text-right">
                Total Freeplay
              </th>
              <th className="px-4 py-2 font-medium text-right">
                Total Deposit
              </th>
              <th className="px-4 py-2 font-medium text-right">Total Redeem</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-500 text-sm"
                >
                  No users found.
                </td>
              </tr>
            )}

            {users.map((u) => {
              const isEditing = editingId === u._id;
              return (
                <tr
                  key={u._id}
                  className="border-t last:border-b hover:bg-gray-50/60"
                >
                  {/* Username only */}
                  <td className="px-4 py-2">
                    <span className="font-medium">{u.username}</span>
                  </td>

                  <td className="px-4 py-2 align-top">
                    <span className="text-xs text-gray-700">
                      {fmtDateTime(u.lastSignInAt)}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <span className="text-xs text-gray-700">
                      {fmtDateTime(u.lastSignOutAt)}
                    </span>
                  </td>

                  {/* Total Payments */}
                  <td className="px-4 py-2 text-right align-top">
                    {isEditing ? (
                      <input
                        className="w-24 text-right border rounded px-1 py-0.5 text-xs"
                        value={editForm.totalPayments}
                        onChange={(e) =>
                          handleEditChange("totalPayments", e.target.value)
                        }
                      />
                    ) : (
                      <span>{fmtAmount(u.totalPayments ?? 0)}</span>
                    )}
                  </td>

                  {/* Total Freeplay */}
                  <td className="px-4 py-2 text-right align-top">
                    {isEditing ? (
                      <input
                        className="w-24 text-right border rounded px-1 py-0.5 text-xs"
                        value={editForm.totalFreeplay}
                        onChange={(e) =>
                          handleEditChange("totalFreeplay", e.target.value)
                        }
                      />
                    ) : (
                      <span>{fmtAmount(u.totalFreeplay ?? 0)}</span>
                    )}
                  </td>

                  {/* Total Deposit */}
                  <td className="px-4 py-2 text-right align-top">
                    {isEditing ? (
                      <input
                        className="w-24 text-right border rounded px-1 py-0.5 text-xs"
                        value={editForm.totalDeposit}
                        onChange={(e) =>
                          handleEditChange("totalDeposit", e.target.value)
                        }
                      />
                    ) : (
                      <span>{fmtAmount(u.totalDeposit ?? 0)}</span>
                    )}
                  </td>

                  {/* Total Redeem */}
                  <td className="px-4 py-2 text-right align-top">
                    {isEditing ? (
                      <input
                        className="w-24 text-right border rounded px-1 py-0.5 text-xs"
                        value={editForm.totalRedeem}
                        onChange={(e) =>
                          handleEditChange("totalRedeem", e.target.value)
                        }
                      />
                    ) : (
                      <span>{fmtAmount(u.totalRedeem ?? 0)}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2 text-right align-top">
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(u._id)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => deleteUser(u._id, u.username)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
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
    </div>
  );
};

export default UserAdminTable;
