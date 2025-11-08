import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  User,
  Mail,
  Clock,
  LogOut,
  Pencil,
  Trash2,
  KeyRound,
  X,
  Save,
  Loader2,
} from "lucide-react";

const API_BASE = "/api"; // or "http://localhost:5000/api" if no proxy

// Raw shape from backend
interface RawActivity {
  _id: string;
  userId?: string;
  email?: string;
  userEmail?: string;
  name?: string;
  userName?: string;
  loginTime?: string;
  loggedInAt?: string;
  createdAt?: string;
  logoutTime?: string | null;
  loggedOutAt?: string | null;
}

// Normalized, unique per user
interface UserRow {
  id: string; // userId or fallback raw _id
  userName: string;
  userEmail: string;
  lastLogin: string | null;
  lastLogout: string | null;
}

const AdminUserActivityTable: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset PW modal
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  useEffect(() => {
    fetchRecords();
  }, []);

  const normalizeDateValue = (
    value: string | null | undefined
  ): string | null => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString(); // internal normalized format
  };

  const normalizeActivity = (r: RawActivity): UserRow | null => {
    const email = r.userEmail || r.email || "";
    const name = r.userName || r.name || email.split("@")[0] || "";

    if (!name.trim()) {
      // remove all with no username
      return null;
    }

    const loginRaw = r.loginTime || r.loggedInAt || r.createdAt || "";
    const logoutRaw = r.logoutTime ?? r.loggedOutAt ?? null;

    const loginIso = normalizeDateValue(loginRaw);
    const logoutIso = normalizeDateValue(logoutRaw);

    const id = r.userId || r._id;

    return {
      id,
      userName: name,
      userEmail: email,
      lastLogin: loginIso,
      lastLogout: logoutIso,
    };
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get<RawActivity[]>(`${API_BASE}/logins/all`);

      // Map by user id/email to get unique users
      const map = new Map<string, UserRow>();

      data.forEach((raw) => {
        const normalized = normalizeActivity(raw);
        if (!normalized) return; // skip no-username

        const key = normalized.id || normalized.userEmail;

        const existing = map.get(key);
        if (!existing) {
          map.set(key, normalized);
        } else {
          // keep the most recent login/logout
          const prevLogin = existing.lastLogin
            ? new Date(existing.lastLogin).getTime()
            : 0;
          const newLogin = normalized.lastLogin
            ? new Date(normalized.lastLogin).getTime()
            : 0;

          if (newLogin > prevLogin) {
            map.set(key, {
              ...existing,
              lastLogin: normalized.lastLogin ?? existing.lastLogin,
              lastLogout: normalized.lastLogout ?? existing.lastLogout,
            });
          }
        }
      });

      // Convert to array & sort by lastLogin desc
      const rows = Array.from(map.values()).sort((a, b) => {
        const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bTime - aTime;
      });

      setUsers(rows);
    } catch (err) {
      console.error("Failed to load user activity logs:", err);
      setError("Failed to load user activity logs.");
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: date + time formatters ---
  const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(); // e.g. 11/8/2025
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }); // e.g. 07:15 PM
  };

  // ---- Edit user ----
  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditName(user.userName);
    setEditEmail(user.userEmail);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditName("");
    setEditEmail("");
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) return;

    try {
      setSavingEdit(true);
      await axios.put(`${API_BASE}/admin/users/${editingUser.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, userName: editName.trim(), userEmail: editEmail.trim() }
            : u
        )
      );
      closeEdit();
    } catch (err) {
      console.error("Failed to save user changes:", err);
      alert("Failed to save user changes.");
      setSavingEdit(false);
    }
  };

  // ---- Delete user ----
  const deleteUser = async (user: UserRow) => {
    if (
      !window.confirm(`Delete user "${user.userName}"? This cannot be undone.`)
    )
      return;

    try {
      await axios.delete(`${API_BASE}/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert("Failed to delete user.");
    }
  };

  // ---- Reset password ----
  const openResetPw = (user: UserRow) => {
    setPwUser(user);
    setNewPassword("");
    setResetError("");
    setResetSuccess("");
  };

  const closeResetPw = () => {
    setPwUser(null);
    setNewPassword("");
    setResetError("");
    setResetSuccess("");
    setResetLoading(false);
  };

  const submitResetPw = async () => {
    if (!pwUser) return;
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    try {
      setResetLoading(true);
      setResetError("");
      setResetSuccess("");

      await axios.post(`${API_BASE}/admin/users/${pwUser.id}/reset-password`, {
        newPassword: newPassword.trim(),
      });

      setResetSuccess("Password reset successfully.");
      setNewPassword("");
    } catch (err) {
      console.error("Failed to reset password:", err);
      setResetError("Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-500" />
          User Activity & Management
        </h2>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mb-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-100 text-gray-700 font-semibold">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Last Login</th>
              <th className="px-4 py-2 text-left">Last Logout</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-gray-500 py-6 italic"
                >
                  {loading ? "Loading..." : "No users with activity found."}
                </td>
              </tr>
            ) : (
              users.map((u, idx) => (
                <tr
                  key={u.id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2">{idx + 1}</td>

                  {/* User */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium text-gray-800">
                        {u.userName}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{u.userEmail || "-"}</span>
                    </div>
                  </td>

                  {/* Last Login – date + time */}
                  <td className="px-4 py-2 align-top">
                    <div className="flex flex-col text-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(u.lastLogin)}</span>
                      </div>
                      <span className="ml-6 text-xs text-gray-500">
                        {formatTime(u.lastLogin)}
                      </span>
                    </div>
                  </td>

                  {/* Last Logout – date + time or Active / N/A */}
                  <td className="px-4 py-2 align-top">
                    <div className="flex flex-col text-gray-700">
                      <div className="flex items-center gap-2">
                        <LogOut className="h-4 w-4 text-gray-400" />
                        <span>
                          {u.lastLogout
                            ? formatDate(u.lastLogout)
                            : "Active / N/A"}
                        </span>
                      </div>
                      {u.lastLogout && (
                        <span className="ml-6 text-xs text-gray-500">
                          {formatTime(u.lastLogout)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => openResetPw(u)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600"
                      >
                        <KeyRound className="h-3 w-3" />
                        Reset PW
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Edit User
              </h3>
              <button
                onClick={closeEdit}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Name
                </label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Email
                </label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeEdit}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Reset Password
              </h3>
              <button
                onClick={closeResetPw}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-medium">{pwUser.userName}</p>
              <p className="text-gray-500 text-xs">{pwUser.userEmail}</p>
            </div>

            {resetError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                {resetSuccess}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-xs text-gray-500">
                Minimum 6 characters. User will log in using this new password.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeResetPw}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitResetPw}
                disabled={resetLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {resetLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserActivityTable;
