import React, { useEffect, useState } from "react";
import { apiClient } from "../apiConfig";

type ScheduleItem = {
  id: number;
  username?: string;
  day: string;
  startTime: string;
  endTime: string;
  title: string;
};

type UserOption = {
  username: string;
  _id?: string;
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const ScheduleForm: React.FC = () => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [username, setUsername] = useState("");
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");

  // 🔹 Load usernames from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        setUserError("");

        // 👉 adjust URL according to your backend route
        // e.g. "/users/summary" or "/admin/users"
        const res = await apiClient.get("/api/admin/users");

        // Expecting array like [{ username: "user1", ... }, ...]
        setUserOptions(res.data || []);
      } catch (err) {
        console.error("Failed to load usernames", err);
        setUserError("Failed to load usernames");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const resetForm = () => {
    setUsername("");
    setDay("Monday");
    setStartTime("");
    setEndTime("");
    setTitle("");
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !title.trim() || !startTime || !endTime) return;

    if (editingId !== null) {
      // update existing
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? { ...item, username, day, startTime, endTime, title }
            : item
        )
      );
    } else {
      // add new
      const newItem: ScheduleItem = {
        id: Date.now(),
        username,
        day,
        startTime,
        endTime,
        title: title.trim(),
      };
      setItems((prev) => [...prev, newItem]);
    }

    resetForm();
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setUsername(item.username || "");
    setDay(item.day);
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setTitle(item.title);
  };

  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <div className="max-w-8xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold mb-2">Schedule (Editable)</h1>

      {/* Editable Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border p-4 shadow-sm bg-white"
      >
        {/* Username + Day + Times + Task */}
        <div className="grid gap-4 md:grid-cols-5">
          {/* Username */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Username</label>
            <select
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loadingUsers}
            >
              <option value="">
                {loadingUsers ? "Loading users..." : "Select user"}
              </option>
              {userOptions.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.username}
                </option>
              ))}
            </select>
            {userError && (
              <p className="mt-1 text-xs text-red-500">{userError}</p>
            )}
          </div>

          {/* Day */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Day</label>
            <select
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          {/* Task */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Task</label>
            <input
              type="text"
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Work"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-black text-white"
          >
            {editingId !== null ? "Update Schedule" : "Add to Schedule"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 rounded-md text-sm border"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Schedule List */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Username</th>
              <th className="text-left px-3 py-2">Day</th>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Task</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No schedule items yet. Add one above.
                </td>
              </tr>
            )}

            {items
              .slice()
              .sort((a, b) => a.day.localeCompare(b.day))
              .map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.username}</td>
                  <td className="px-3 py-2">{item.day}</td>
                  <td className="px-3 py-2">
                    {item.startTime} - {item.endTime}
                  </td>
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="px-2 py-1 text-xs rounded-md border"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="px-2 py-1 text-xs rounded-md border"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleForm;
