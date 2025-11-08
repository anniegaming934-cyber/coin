import React, { useEffect, useState } from "react";
import axios from "axios";
import { Clock, Mail, User } from "lucide-react";

interface LoginRecord {
  _id: string;
  userEmail: string;
  userName: string;
  loginTime: string;
  createdAt: string;
}

const API_BASE = "/api"; // or "http://localhost:5000/api" for local dev

const AdminLoginTable: React.FC = () => {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get<LoginRecord[]>(`${API_BASE}/logins/all`);
      setRecords(data);
    } catch (err: any) {
      setError("Failed to load login history.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-500" />
          User Login History
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
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-gray-500 py-6 italic"
                >
                  {loading ? "Loading..." : "No login records found."}
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr
                  key={r._id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-500" />
                    <span className="font-medium text-gray-800">
                      {r.userName || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex items-center gap-2 text-gray-700">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {r.userEmail}
                  </td>
                  <td className="px-4 py-2 flex items-center gap-1 text-gray-700">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {new Date(r.loginTime).toLocaleString()}
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

export default AdminLoginTable;
