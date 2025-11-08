import React, { useEffect, useState } from "react";
import axios from "axios";
import { User, Mail, Clock, LogOut } from "lucide-react";

const API_BASE = "/api"; // or "http://localhost:5000/api" in dev if no proxy

// Raw shape from backend (flexible)
interface RawActivity {
  _id: string;
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

// Normalized shape for UI
interface UserActivity {
  _id: string;
  userEmail: string;
  userName: string;
  loginTime: string | null;
  logoutTime: string | null;
}

const AdminUserActivityTable: React.FC = () => {
  const [records, setRecords] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const normalizeRecord = (r: RawActivity): UserActivity => {
    // Prefer explicit fields if present, fall back to common alternatives
    const email = r.userEmail || r.email || "";
    const name = r.userName || r.name || email.split("@")[0] || "";

    const loginRaw = r.loginTime || r.loggedInAt || r.createdAt || "";
    const logoutRaw = r.logoutTime ?? r.loggedOutAt ?? null;

    const normalizeDate = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleString();
    };

    return {
      _id: r._id,
      userEmail: email,
      userName: name,
      loginTime: normalizeDate(loginRaw),
      logoutTime: normalizeDate(logoutRaw),
    };
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get<RawActivity[]>(`${API_BASE}/logins/all`);
      setRecords(data.map(normalizeRecord));
    } catch (err: any) {
      console.error("Failed to load user activity logs:", err);
      setError("Failed to load user activity logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-500" />
          User Activity (Sign-In / Sign-Out)
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
              <th className="px-4 py-2 text-left">Login Time</th>
              <th className="px-4 py-2 text-left">Logout Time</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-gray-500 py-6 italic"
                >
                  {loading ? "Loading..." : "No user activity records found."}
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr
                  key={r._id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2">{i + 1}</td>

                  {/* User */}
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium text-gray-800">
                          {r.userName || "-"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{r.userEmail || "-"}</span>
                    </div>
                  </td>

                  {/* Login time */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{r.loginTime || "—"}</span>
                    </div>
                  </td>

                  {/* Logout time */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <LogOut className="h-4 w-4 text-gray-400" />
                      {r.logoutTime ? (
                        <span>{r.logoutTime}</span>
                      ) : (
                        <span className="text-gray-400 italic">Active</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUserActivityTable;
