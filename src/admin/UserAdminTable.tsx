import React, { FC, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";

import { Loader2, AlertTriangle } from "lucide-react";
import { DataTable } from "../DataTable";

export interface UserSummary {
  _id: string;
  username?: string;
  email?: string;
  totalPayments: number;
  totalFreeplay: number;
  totalDeposit: number;
  totalRedeem: number;
}

// 👇 This is the props interface you asked about
export interface UserAdminTableProps {
  onViewHistory: (userId: string) => void;
}

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const UserAdminTable: FC<UserAdminTableProps> = ({ onViewHistory }) => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // optional: loading state for row-level actions
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      // adjust endpoint to match your backend
      const { data } = await apiClient.get<UserSummary[]>("/api/admin/users");
      setUsers(data || []);
    } catch (e) {
      console.error("Failed to load users:", e);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetStats = async (userId: string) => {
    try {
      setActionUserId(userId);
      // adjust endpoint as needed
      await apiClient.post(`/api/admin/users/${userId}/reset-stats`);
      await fetchUsers();
    } catch (e) {
      console.error("Failed to reset stats:", e);
    } finally {
      setActionUserId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      setActionUserId(userId);
      // adjust endpoint as needed
      await apiClient.post(`/api/admin/users/${userId}/reset-password`);
    } catch (e) {
      console.error("Failed to reset password:", e);
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Delete this user and their data?")) return;
    try {
      setActionUserId(userId);
      // adjust endpoint as needed
      await apiClient.delete(`/api/admin/users/${userId}`);
      await fetchUsers();
    } catch (e) {
      console.error("Failed to delete user:", e);
    } finally {
      setActionUserId(null);
    }
  };

  const columns = useMemo<ColumnDef<UserSummary, any>[]>(() => {
    return [
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.username}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email || "-",
      },
      // {
      //   accessorKey: "lastSignInAt",
      //   header: "Last Sign In",
      //   cell: ({ row }) => fmtDateTime(row.original.lastSignInAt),
      // },
      // {
      //   accessorKey: "lastSignOutAt",
      //   header: "Last Sign Out",
      //   cell: ({ row }) => fmtDateTime(row.original.lastSignOutAt),
      // },
      {
        accessorKey: "totalDeposit",
        header: "Deposit",
        cell: ({ row }) => fmtAmount(row.original.totalDeposit),
      },
      {
        accessorKey: "totalFreeplay",
        header: "Freeplay",
        cell: ({ row }) => fmtAmount(row.original.totalFreeplay),
      },
      {
        accessorKey: "totalRedeem",
        header: "Redeem",
        cell: ({ row }) => fmtAmount(row.original.totalRedeem),
      },
      {
        accessorKey: "totalPayments",
        header: "Payments",
        cell: ({ row }) => fmtAmount(row.original.totalPayments),
      },
      // we do NOT define actions column here –
      // DataTable already adds actions via rowActions
    ];
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">User Admin</h2>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="text-xs px-3 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <DataTable<UserSummary, any>
        columns={columns}
        data={users}
        isLoading={loading}
        emptyMessage="No users found."
        // 👇 click row to open full history view
        onRowClick={(user) => onViewHistory(user._id)}
        rowActions={{
          onEdit: (user) => onViewHistory(user._id), // or open edit modal
          onResetPassword: (user) => handleResetPassword(user._id),
          onReset: (user) => handleResetStats(user._id),
          onDelete: (user) => handleDeleteUser(user._id),
        }}
      />

      {actionUserId && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing action for user: {actionUserId}
        </div>
      )}
    </div>
  );
};

export default UserAdminTable;
