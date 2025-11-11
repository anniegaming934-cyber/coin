import React, { FC, useEffect, useState } from "react";
import { apiClient } from "../apiConfig";
import { Pencil, Save, X, RotateCcw, Loader2, Trash2 } from "lucide-react";

interface UserSummary {
  _id: string;
  username: string;
  email: string;
  totalPayments: number;
  totalFreeplay: number;
  totalDeposit: number;
  totalRedeem: number;
}

interface UserAdminTableProps {
  apiBase?: string; // default: /api
}

const fmtAmount = (n: number) =>
  n?.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const UserAdminTable: FC<UserAdminTableProps> = () => {
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

  const USERS_URL = `/api/admin/users`;

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

      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, ...payload } : u))
      );
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    }
  };

  // 🗑️ Delete User (admin-protected)
  const deleteUser = async (user: UserSummary) => {
    const isAdmin = user.username.toLowerCase().includes("admin");
    if (isAdmin) {
      alert("Admin users cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(`Delete user "${user.username}"?`);
    if (!confirmed) return;

    try {
      await apiClient.delete(`${USERS_URL}/${user._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete user.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Username</th>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-right font-medium">
                Total Payments
              </th>
              <th className="px-4 py-2 text-right font-medium">Freeplay</th>
              <th className="px-4 py-2 text-right font-medium">Deposit</th>
              <th className="px-4 py-2 text-right font-medium">Redeem</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-gray-500">
                  No users found.
                </td>
              </tr>
            )}

            {users.map((u) => {
              const isEditing = editingId === u._id;
              const isAdmin = u.username.toLowerCase().includes("admin");

              return (
                <tr
                  key={u._id}
                  className="border-t last:border-b hover:bg-gray-50 transition-colors"
                >
                  {/* Username */}
                  <td className="px-4 py-2 font-medium">{u.username}</td>
                  {/* Email */}
                  <td className="px-4 py-2 text-gray-600">{u.email || "—"}</td>

                  {/* Editable totals */}
                  {[
                    "totalPayments",
                    "totalFreeplay",
                    "totalDeposit",
                    "totalRedeem",
                  ].map((field) => (
                    <td key={field} className="px-4 py-2 text-right align-top">
                      {isEditing ? (
                        <input
                          className="w-24 text-right border rounded px-1 py-0.5 text-xs"
                          value={(editForm as any)[field]}
                          onChange={(e) =>
                            handleEditChange(
                              field as keyof typeof editForm,
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        <span>{fmtAmount((u as any)[field] ?? 0)}</span>
                      )}
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
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
                        onClick={() => deleteUser(u)}
                        disabled={isAdmin}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          isAdmin
                            ? "Admin users cannot be deleted"
                            : "Delete user"
                        }
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
