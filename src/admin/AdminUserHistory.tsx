// src/components/UserHistory.tsx
import React, { useEffect, useState, useMemo, type FC } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";

export interface UserHistoryProps {
  // this will be used as ?username=... in the history API
  username: string;
}

export interface HistoryMeta {
  route?: string;
  ip?: string;
  note?: string;
}

export interface UserHistoryItem {
  _id: string;
  username: string;
  action: "create" | "update" | "delete" | "clear-pending" | string;
  entryId?: string;
  createdAt: string;
  before?: any;
  after?: any;
  meta?: HistoryMeta;
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

// pick the "current" snapshot for display (after > before)
const getSnapshot = (item: UserHistoryItem): any => {
  return item.after || item.before || {};
};

const getDisplayAmount = (snap: any): number => {
  if (typeof snap.amountFinal === "number") return snap.amountFinal;
  if (typeof snap.amountBase === "number") return snap.amountBase;
  if (typeof snap.amount === "number") return snap.amount;
  return 0;
};

const UserHistory: FC<UserHistoryProps> = ({ username }) => {
  const [history, setHistory] = useState<UserHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      if (!username) {
        setHistory([]);
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.get<UserHistoryItem[]>(
          "/api/game-entries/history",
          {
            params: { username },
          }
        );
        setHistory(res.data || []);
      } catch (err) {
        console.error("Failed to load user history", err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [username]);

  const stats = useMemo(() => {
    const totalActions = history.length;
    let totalCreate = 0;
    let totalUpdate = 0;
    let totalDelete = 0;
    let totalClearPending = 0;

    history.forEach((h) => {
      switch (h.action) {
        case "create":
          totalCreate++;
          break;
        case "update":
          totalUpdate++;
          break;
        case "delete":
          totalDelete++;
          break;
        case "clear-pending":
          totalClearPending++;
          break;
        default:
          break;
      }
    });

    return {
      totalActions,
      totalCreate,
      totalUpdate,
      totalDelete,
      totalClearPending,
    };
  }, [history]);

  const columns = useMemo<ColumnDef<UserHistoryItem, any>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => fmtDateTime(row.original.createdAt),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => {
          const a = row.original.action;
          switch (a) {
            case "create":
              return "Created";
            case "update":
              return "Updated";
            case "delete":
              return "Deleted";
            case "clear-pending":
              return "Cleared Pending";
            default:
              return a;
          }
        },
      },
      {
        id: "gameName",
        header: "Game",
        cell: ({ row }) => {
          const snap = getSnapshot(row.original);
          return snap.gameName || "-";
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const snap = getSnapshot(row.original);
          const t = snap.type as
            | "deposit"
            | "freeplay"
            | "redeem"
            | "cashin"
            | "cashout"
            | string
            | undefined;

          switch (t) {
            case "deposit":
              return "Deposit";
            case "freeplay":
              return "Freeplay";
            case "redeem":
              return "Redeem";
            case "cashin":
              return "Cash In";
            case "cashout":
              return "Cash Out";
            default:
              return t || "-";
          }
        },
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const snap = getSnapshot(row.original);
          const amt = getDisplayAmount(snap);
          return fmtAmount(amt);
        },
      },
      {
        id: "route",
        header: "Route",
        cell: ({ row }) => row.original.meta?.route || "-",
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          User Activity History {username ? `· ${username}` : ""}
        </h1>
        <p className="text-sm text-gray-500">
          Showing everything this user created, edited, deleted, or cleared.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Actions</div>
          <div className="text-lg font-semibold">{stats.totalActions}</div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Created</div>
          <div className="text-lg font-semibold">{stats.totalCreate}</div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Updated</div>
          <div className="text-lg font-semibold">{stats.totalUpdate}</div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Deleted</div>
          <div className="text-lg font-semibold">{stats.totalDelete}</div>
        </div>

        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Cleared Pending</div>
          <div className="text-lg font-semibold">{stats.totalClearPending}</div>
        </div>
      </div>

      {/* History table */}
      <DataTable<UserHistoryItem, any>
        columns={columns}
        data={history}
        isLoading={loading}
        emptyMessage="No history records found for this user."
        onRowClick={(row) => console.log("history row clicked", row)}
      />
    </div>
  );
};

export default UserHistory;
