import React, { useEffect, useState } from "react";
import { apiClient } from "../apiConfig";
import { User, Pencil, Trash2, X, Save, Loader2 } from "lucide-react";
import DeleteConfirmDialog from "../DeleteConfirmDialog";

const API_BASE = "/api"; // apiClient already has baseURL

interface RawActivity {
  _id: string;
  username: string;
  signInAt: string;
  signOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  username: string;
  lastLogin: string | null;
  lastLogout: string | null;
}

const AdminUserActivityTable: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [totalLoggedLast24h, setTotalLoggedLast24h] = useState(0);

  useEffect(() => {
    fetchRecords();
  }, []);

  const normalizeDate = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const normalizeActivity = (r: RawActivity): UserRow => ({
    id: r._id,
    username: r.username,
    lastLogin: normalizeDate(r.signInAt),
    lastLogout: normalizeDate(r.signOutAt),
  });

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get<RawActivity[]>(
        `${API_BASE}/logins?username=admin`
      );

      const map = new Map<string, UserRow>();
      data.forEach((r) => {
        const normalized = normalizeActivity(r);
        const key = normalized.username;
        const existing = map.get(key);
        if (!existing) map.set(key, normalized);
        else {
          const prevLogin = existing.lastLogin
            ? new Date(existing.lastLogin).getTime()
            : 0;
          const newLogin = normalized.lastLogin
            ? new Date(normalized.lastLogin).getTime()
            : 0;
          if (newLogin > prevLogin) map.set(key, normalized);
        }
      });

      const rows = Array.from(map.values()).sort((a, b) => {
        const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bTime - aTime;
      });

      const now = Date.now();
      const last24 = rows.filter((u) => {
        if (!u.lastLogin) return false;
        const t = new Date(u.lastLogin).getTime();
        return now - t <= 24 * 60 * 60 * 1000;
      }).length;

      setUsers(rows);
      setTotalLoggedLast24h(last24);
    } catch (err) {
      console.error(err);
      setError("Failed to load records.");
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const formatPrettyDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getStatus = (u: UserRow): "online" | "offline" => {
    if (!u.lastLogin) return "offline";
    if (!u.lastLogout) return "online";
    return new Date(u.lastLogout) < new Date(u.lastLogin)
      ? "online"
      : "offline";
  };

  const renderStatus = (u: UserRow) => {
    const status = getStatus(u);
    const label = status === "online" ? "Online" : "Offline";
    const pillClass =
      status === "online"
        ? "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200";
    const dotClass =
      status === "online"
        ? "h-2 w-2 rounded-full bg-emerald-500"
        : "h-2 w-2 rounded-full bg-gray-400";
    return (
      <span className={pillClass}>
        <span className={dotClass} />
        {label}
      </span>
    );
  };

  // --- Edit ---
  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditUsername(u.username);
  };
  const closeEdit = () => {
    setEditingUser(null);
    setEditUsername("");
  };
  const saveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id ? { ...u, username: editUsername } : u
      )
    );
    setSavingEdit(false);
    closeEdit();
  };

  // --- Delete ---
  const handleDeleteClick = (u: UserRow) => {
    setSelectedUser(u);
    setIsDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setIsDeleting(true);
    setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
    setIsDeleting(false);
    setIsDialogOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-500" />
          User Activity & Management
        </h2>

        <div className="flex items-center gap-3">
          <div className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            Logged last 24h: <strong>{totalLoggedLast24h}</strong>
          </div>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 mb-3 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-100 text-gray-700 font-semibold">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Last Checked In</th>
              <th className="px-4 py-2 text-left">Last Checked Out</th>
              <th className="px-4 py-2 text-left">Status</th>
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
                  {loading ? "Loading..." : "No user activity found."}
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {u.username}
                  </td>

                  {/* Last Checked In */}
                  <td className="px-4 py-2 text-gray-800">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatPrettyDate(u.lastLogin)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(u.lastLogin)}
                      </span>
                    </div>
                  </td>

                  {/* Last Checked Out */}
                  <td className="px-4 py-2 text-gray-800">
                    {u.lastLogout ? (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {formatPrettyDate(u.lastLogout)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(u.lastLogout)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Active / N/A</span>
                    )}
                  </td>

                  <td className="px-4 py-2">{renderStatus(u)}</td>

                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil className="h-3 w-3 inline mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(u)}
                        className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3 inline mr-1" />
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

      {/* Delete confirm */}
      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        message={
          selectedUser
            ? `Delete ${selectedUser.username}'s activity?`
            : "Delete selected user?"
        }
      />

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Edit Username
              </h3>
              <button
                onClick={closeEdit}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">
                Username
              </label>
              <input
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
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
    </div>
  );
};

export default AdminUserActivityTable;
