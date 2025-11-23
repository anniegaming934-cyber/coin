// src/GameLogins.tsx
import React, { useState, FormEvent, useEffect } from "react";

interface GameLogin {
  _id: string; // MongoDB id
  ownerType: "admin" | "user";
  gameName: string;
  loginUsername: string;
  password: string;
  gameLink?: string;
}

interface GameLoginFormValues {
  gameName: string;
  loginUsername: string;
  password: string;
  gameLink: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""; // e.g. "https://your-backend-url";

const emptyForm: GameLoginFormValues = {
  gameName: "",
  loginUsername: "",
  password: "",
  gameLink: "",
};

const GameLogins: React.FC = () => {
  // Separate forms
  const [adminForm, setAdminForm] = useState<GameLoginFormValues>(emptyForm);
  const [userForm, setUserForm] = useState<GameLoginFormValues>(emptyForm);

  const [items, setItems] = useState<GameLogin[]>([]);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<GameLoginFormValues>(emptyForm);

  // Load existing logins on mount
  useEffect(() => {
    const fetchGameLogins = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/game-logins`);
        if (!res.ok) {
          throw new Error("Failed to fetch game logins");
        }
        const data: GameLogin[] = await res.json();
        setItems(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error loading game logins");
      } finally {
        setLoading(false);
      }
    };

    fetchGameLogins();
  }, []);

  const handleFormChange = (
    ownerType: "admin" | "user",
    field: keyof GameLoginFormValues,
    value: string
  ) => {
    if (ownerType === "admin") {
      setAdminForm((prev) => ({ ...prev, [field]: value }));
    } else {
      setUserForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit =
    (ownerType: "admin" | "user") => async (e: FormEvent) => {
      e.preventDefault();

      const form = ownerType === "admin" ? adminForm : userForm;

      if (
        !form.gameName.trim() ||
        !form.loginUsername.trim() ||
        !form.password.trim()
      ) {
        alert("Game name, username and password are required.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/api/game-logins`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ownerType,
            gameName: form.gameName.trim(),
            loginUsername: form.loginUsername.trim(),
            password: form.password.trim(),
            gameLink: form.gameLink.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to save game login");
        }

        const created: GameLogin = await res.json();
        setItems((prev) => [created, ...prev]);

        // Reset respective form
        if (ownerType === "admin") {
          setAdminForm(emptyForm);
        } else {
          setUserForm(emptyForm);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error saving game login");
      } finally {
        setSaving(false);
      }
    };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied!`);
      setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg("Copy not supported");
      setTimeout(() => setCopyMsg(null), 1500);
    }
  };

  const handleCopyRow = (item: GameLogin) => {
    const lines = [
      `Game: ${item.gameName}`,
      `Username: ${item.loginUsername}`,
      `Password: ${item.password}`,
    ];
    if (item.gameLink) {
      lines.push(`Link: ${item.gameLink}`);
    }
    handleCopy(lines.join("\n"), "Login info");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this login?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/game-logins/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete game login");
      }

      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error deleting game login");
    }
  };

  const startEdit = (item: GameLogin) => {
    setEditingId(item._id);
    setEditValues({
      gameName: item.gameName,
      loginUsername: item.loginUsername,
      password: item.password,
      gameLink: item.gameLink || "",
    });
  };

  const handleEditChange = (
    field: keyof GameLoginFormValues,
    value: string
  ) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues(emptyForm);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    if (
      !editValues.gameName.trim() ||
      !editValues.loginUsername.trim() ||
      !editValues.password.trim()
    ) {
      alert("Game name, username and password are required.");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/game-logins/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameName: editValues.gameName.trim(),
          loginUsername: editValues.loginUsername.trim(),
          password: editValues.password.trim(),
          gameLink: editValues.gameLink.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update game login");
      }

      const updated: GameLogin = await res.json();
      setItems((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item))
      );
      setEditingId(null);
      setEditValues(emptyForm);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error updating game login");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Form */}
      <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Admin Add Game Login
        </h2>

        <form
          onSubmit={handleSubmit("admin")}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Game Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Name
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={adminForm.gameName}
              onChange={(e) =>
                handleFormChange("admin", "gameName", e.target.value)
              }
              placeholder="e.g. Vegas Infinity"
              required
            />
          </div>

          {/* Login Username */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Login Username
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={adminForm.loginUsername}
              onChange={(e) =>
                handleFormChange("admin", "loginUsername", e.target.value)
              }
              placeholder="e.g. prasis123"
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={adminForm.password}
              onChange={(e) =>
                handleFormChange("admin", "password", e.target.value)
              }
              placeholder="********"
              required
            />
          </div>

          {/* Game Link */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Link
            </label>
            <input
              type="url"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={adminForm.gameLink}
              onChange={(e) =>
                handleFormChange("admin", "gameLink", e.target.value)
              }
              placeholder="https://example.com/login"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-4 mt-2">
            {copyMsg && (
              <span className="text-xs text-green-600">{copyMsg}</span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-md px-4 py-2 text-sm font-medium border border-blue-500 text-blue-600 hover:bg-blue-50 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Login (Admin)"}
            </button>
          </div>
        </form>
      </div>

      {/* User Form */}
      <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          User Add Game Login
        </h2>

        <form
          onSubmit={handleSubmit("user")}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Game Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Name
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={userForm.gameName}
              onChange={(e) =>
                handleFormChange("user", "gameName", e.target.value)
              }
              placeholder="e.g. Vegas Infinity"
              required
            />
          </div>

          {/* Login Username */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Login Username
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={userForm.loginUsername}
              onChange={(e) =>
                handleFormChange("user", "loginUsername", e.target.value)
              }
              placeholder="e.g. prasis123"
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={userForm.password}
              onChange={(e) =>
                handleFormChange("user", "password", e.target.value)
              }
              placeholder="********"
              required
            />
          </div>

          {/* Game Link */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Link
            </label>
            <input
              type="url"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={userForm.gameLink}
              onChange={(e) =>
                handleFormChange("user", "gameLink", e.target.value)
              }
              placeholder="https://example.com/login"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-4 mt-2">
            {copyMsg && (
              <span className="text-xs text-green-600">{copyMsg}</span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-md px-4 py-2 text-sm font-medium border border-blue-500 text-blue-600 hover:bg-blue-50 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Login (User)"}
            </button>
          </div>
        </form>
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-sm text-gray-500">Loading game logins...</div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Game Logins
        </h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No logins added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500 bg-gray-100">
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Password</th>
                  <th className="py-2 pr-4">Game Link</th>
                  <th className="py-2 pr-4">Added By</th>
                  <th className="py-2 pr-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const isEditing = editingId === item._id;

                  if (isEditing) {
                    return (
                      <tr
                        key={item._id}
                        className="border-b last:border-0 bg-yellow-50"
                      >
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={editValues.gameName}
                            onChange={(e) =>
                              handleEditChange("gameName", e.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={editValues.loginUsername}
                            onChange={(e) =>
                              handleEditChange("loginUsername", e.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={editValues.password}
                            onChange={(e) =>
                              handleEditChange("password", e.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={editValues.gameLink}
                            onChange={(e) =>
                              handleEditChange("gameLink", e.target.value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {item.ownerType}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={updating}
                              className="rounded border px-2 py-1 text-xs text-green-700 border-green-400 hover:bg-green-50 disabled:opacity-60"
                            >
                              {updating ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={item._id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-4 text-gray-900">
                        {item.gameName}
                      </td>
                      <td className="py-2 pr-4 text-gray-900">
                        {item.loginUsername}
                      </td>
                      <td className="py-2 pr-4 text-gray-900">
                        {item.password}
                      </td>
                      <td className="py-2 pr-4">
                        {item.gameLink ? (
                          <a
                            href={item.gameLink}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-blue-600 hover:text-blue-800"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {item.ownerType}
                      </td>

                      <td className="py-2 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleCopyRow(item)}
                            className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Copy
                          </button>

                          <button
                            onClick={() => handleDelete(item._id)}
                            className="rounded border px-2 py-1 text-xs text-red-600 border-red-400 hover:bg-red-50"
                          >
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
    </div>
  );
};

export default GameLogins;
