import React, { useState } from "react";

type ScheduleItem = {
  id: number;
  day: string;
  startTime: string;
  endTime: string;
  title: string;
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

  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");

  const resetForm = () => {
    setDay("Monday");
    setStartTime("");
    setEndTime("");
    setTitle("");
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !startTime || !endTime) return;

    if (editingId !== null) {
      // update existing
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? { ...item, day, startTime, endTime, title }
            : item
        )
      );
    } else {
      // add new
      const newItem: ScheduleItem = {
        id: Date.now(),
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
        <div className="grid gap-4 md:grid-cols-4">
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

          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

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
              <th className="text-left px-3 py-2">Day</th>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Task</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  No schedule items yet. Add one above.
                </td>
              </tr>
            )}

            {items
              .slice()
              .sort((a, b) => a.day.localeCompare(b.day))
              .map((item) => (
                <tr key={item.id} className="border-t">
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
