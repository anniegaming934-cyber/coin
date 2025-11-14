// src/components/UserHistory.tsx
import React, { useEffect, useState, useMemo, type FC } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";

export interface UserHistoryProps {
  userId: string;
}

export interface UserHistoryItem {
  _id: string;
  createdAt: string;
  gameName?: string;
  type: "deposit" | "freeplay" | "cashin" | "cashout" | "redeem";
  amount: number;
}

export interface UserHistoryTotals {
  totalGames: number;
  totalDeposit: number;
  totalFreeplay: number;
  totalCashIn: number;
  totalCashOut: number;
  totalRedeem: number;

  // 🔹 new (optional, so it won't break if backend not ready yet)
  totalPoint?: number;
  totalPaid?: number;
}

export interface UserHistoryUser {
  _id: string;
  username: string;
  email?: string;
}

export interface UserHistoryResponse {
  user: UserHistoryUser;
  totals: UserHistoryTotals;
  history: UserHistoryItem[];
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const UserHistory: FC<UserHistoryProps> = ({ userId }) => {
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [totals, setTotals] = useState<UserHistoryTotals | null>(null);
  const [history, setHistory] = useState<UserHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<UserHistoryResponse>(
          `/api/admin/users/${userId}/history`
        );
        setUserName(res.data.user.username);
        setUserEmail(res.data.user.email || "");
        setTotals(res.data.totals);
        setHistory(res.data.history);
      } catch (err) {
        console.error("Failed to load user history", err);
        setTotals(null);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) loadHistory();
  }, [userId]);

  const columns = useMemo<ColumnDef<UserHistoryItem, any>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => fmtDateTime(row.original.createdAt),
      },
      {
        accessorKey: "gameName",
        header: "Game",
        cell: ({ row }) => row.original.gameName || "-",
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const t = row.original.type;
          switch (t) {
            case "deposit":
              return "Deposit";
            case "freeplay":
              return "Freeplay";
            case "cashin":
              return "Cash In";
            case "cashout":
              return "Cash Out";
            case "redeem":
              return "Redeem";
            default:
              return t;
          }
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => fmtAmount(row.original.amount),
      },
    ],
    []
  );

  const safeTotals = totals || {
    totalGames: 0,
    totalDeposit: 0,
    totalFreeplay: 0,
    totalCashIn: 0,
    totalCashOut: 0,
    totalRedeem: 0,
    totalPoint: 0,
    totalPaid: 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          User History {userName ? `· ${userName}` : ""}
        </h1>
        {userEmail && (
          <p className="text-sm text-gray-500">Email: {userEmail}</p>
        )}
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Games</div>
          <div className="text-lg font-semibold">{safeTotals.totalGames}</div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Cash In</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalCashIn)}
          </div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Cash Out</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalCashOut)}
          </div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Freeplay</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalFreeplay)}
          </div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Redeem</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalRedeem)}
          </div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Point</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalPoint ?? 0)}
          </div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Paid</div>
          <div className="text-lg font-semibold">
            {fmtAmount(safeTotals.totalPaid ?? 0)}
          </div>
        </div>
      </div>

      {/* History table */}
      <DataTable<UserHistoryItem, any>
        columns={columns}
        data={history}
        isLoading={loading}
        emptyMessage="No history records found."
        onRowClick={(row) => console.log("history row clicked", row)}
      />
    </div>
  );
};

export default UserHistory;
