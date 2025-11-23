import React, { useEffect, useState } from "react";
import { apiClient } from "../apiConfig";

type ScheduleItem = {
  _id: string;
  usernames: string[];
  day: string;
  startTime: string; // "09:00 AM"
  endTime: string; // "05:00 PM"
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

const hours12 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const minutes = ["00", "15", "30", "45"]; // adjust if you want more granularity
const ampmOptions = ["AM", "PM"] as const;

type AmPm = (typeof ampmOptions)[number];

const ScheduleForm: React.FC = () => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // multi select usernames
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);

  // time pieces
  const [day, setDay] = useState("Monday");

  const [startHour, setStartHour] = useState("9");
  const [startMinute, setStartMinute] = useState("00");
  const [startAmPm, setStartAmPm] = useState<AmPm>("AM");

  const [endHour, setEndHour] = useState("5");
  const [endMinute, setEndMinute] = useState("00");
  const [endAmPm, setEndAmPm] = useState<AmPm>("PM");

  const [title, setTitle] = useState("");

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");

  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // 🔹 Helpers for time
  const buildTimeString = (hour: string, minute: string, ampm: AmPm) =>
    `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} ${ampm}`;

  const parseTimeString = (
    time: string
  ): { hour: string; minute: string; ampm: AmPm } | null => {
    // expecting "HH:MM AM"
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    const [, h, m, ap] = match;
    const hour = String(parseInt(h, 10));
    const minute = m;
    const ampm = ap.toUpperCase() === "AM" ? "AM" : "PM";
    return { hour, minute, ampm };
  };

  const timeToMinutes = (time: string): number => {
    const parsed = parseTimeString(time);
    if (!parsed) return 0;
    let hour = parseInt(parsed.hour, 10);
    const minute = parseInt(parsed.minute, 10);
    const isPM = parsed.ampm === "PM";

    if (hour === 12) {
      hour = isPM ? 12 : 0;
    } else if (isPM) {
      hour += 12;
    }
    return hour * 60 + minute;
  };

  // 🔹 Load usernames from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        setUserError("");

        const res = await apiClient.get("/api/admin/users");
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

  // 🔹 Load schedules from backend
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);
        setScheduleError("");

        const res = await apiClient.get<ScheduleItem[]>("/api/schedules");
        setItems(res.data || []);
      } catch (err) {
        console.error("Failed to load schedules", err);
        setScheduleError("Failed to load schedules");
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, []);

  const resetForm = () => {
    setSelectedUsernames([]);
    setDay("Monday");
    setStartHour("9");
    setStartMinute("00");
    setStartAmPm("AM");
    setEndHour("5");
    setEndMinute("00");
    setEndAmPm("PM");
    setTitle("");
    setEditingId(null);
  };

  const handleUserMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedUsernames(options);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUsernames.length === 0) return;
    if (!title.trim()) return;

    const startTime = buildTimeString(startHour, startMinute, startAmPm);
    const endTime = buildTimeString(endHour, endMinute, endAmPm);

    try {
      setSaving(true);
      setScheduleError("");

      if (editingId) {
        // Update existing schedule
        const res = await apiClient.put<ScheduleItem>(
          `/api/schedules/${editingId}`,
          {
            usernames: selectedUsernames,
            day,
            startTime,
            endTime,
            title: title.trim(),
          }
        );
        const updated = res.data;
        setItems((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item))
        );
      } else {
        // Create new schedule
        const res = await apiClient.post<ScheduleItem>("/api/schedules", {
          usernames: selectedUsernames,
          day,
          startTime,
          endTime,
          title: title.trim(),
        });
        const created = res.data;
        setItems((prev) => [...prev, created]);
      }

      resetForm();
    } catch (err: any) {
      console.error("Failed to save schedule", err);
      setScheduleError("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditingId(item._id);
    setSelectedUsernames(item.usernames);
    setDay(item.day);

    const s = parseTimeString(item.startTime);
    const e = parseTimeString(item.endTime);
    if (s) {
      setStartHour(s.hour);
      setStartMinute(s.minute);
      setStartAmPm(s.ampm);
    }
    if (e) {
      setEndHour(e.hour);
      setEndMinute(e.minute);
      setEndAmPm(e.ampm);
    }
    setTitle(item.title);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this schedule item?")) return;

    try {
      await apiClient.delete(`/api/schedules/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error("Failed to delete schedule", err);
      setScheduleError("Failed to delete schedule");
    }
  };

  // 🔹 Sort & group items by day then time
  const sortedItems = items.slice().sort((a, b) => {
    const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });

  const groupedByDay: Record<string, ScheduleItem[]> = {};
  sortedItems.forEach((item) => {
    if (!groupedByDay[item.day]) groupedByDay[item.day] = [];
    groupedByDay[item.day].push(item);
  });

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
          {/* Usernames (multi-select) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Usernames (multi-select)
            </label>
            <select
              multiple
              className="w-full border rounded-md px-2 py-1 text-sm h-24"
              value={selectedUsernames}
              onChange={handleUserMultiSelect}
              disabled={loadingUsers}
            >
              {userOptions.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.username}
                </option>
              ))}
            </select>
            {loadingUsers && (
              <p className="mt-1 text-xs text-gray-500">Loading users...</p>
            )}
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

          {/* Start Time 12h */}
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <div className="flex gap-1">
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
              >
                {hours12.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="self-center">:</span>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={startAmPm}
                onChange={(e) => setStartAmPm(e.target.value as AmPm)}
              >
                {ampmOptions.map((ap) => (
                  <option key={ap} value={ap}>
                    {ap}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* End Time 12h */}
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <div className="flex gap-1">
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
              >
                {hours12.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="self-center">:</span>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={endMinute}
                onChange={(e) => setEndMinute(e.target.value)}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={endAmPm}
                onChange={(e) => setEndAmPm(e.target.value as AmPm)}
              >
                {ampmOptions.map((ap) => (
                  <option key={ap} value={ap}>
                    {ap}
                  </option>
                ))}
              </select>
            </div>
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
            disabled={saving}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-black text-white disabled:opacity-60"
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

        {scheduleError && (
          <p className="mt-1 text-xs text-red-500">{scheduleError}</p>
        )}
      </form>

      {/* Schedule List */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Usernames</th>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Task</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingSchedules && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  Loading schedule...
                </td>
              </tr>
            )}

            {!loadingSchedules && sortedItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  No schedule items yet. Add one above.
                </td>
              </tr>
            )}

            {/* 🔹 Grouped by day */}
            {days.map((d) => {
              const dayItems = groupedByDay[d];
              if (!dayItems || dayItems.length === 0) return null;

              return (
                <React.Fragment key={d}>
                  {/* Day row */}
                  <tr className="bg-gray-50">
                    <td
                      colSpan={4}
                      className="px-3 py-2 font-semibold text-gray-800"
                    >
                      {d}
                    </td>
                  </tr>

                  {/* Rows for that day */}
                  {dayItems.map((item) => (
                    <tr key={item._id} className="border-t">
                      <td className="px-3 py-2">{item.usernames.join(", ")}</td>
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
                          onClick={() => handleDelete(item._id)}
                          className="px-2 py-1 text-xs rounded-md border"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleForm;
