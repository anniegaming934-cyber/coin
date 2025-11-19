// src/UserCashoutTable.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type FC,
} from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Clock } from "lucide-react";

import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";

// Pending entries come from GameEntry model
interface ServerPendingEntry {
  _id: string;
  username: string;
  type: "freeplay" | "deposit" | "redeem" | string;
  method?: string;
  playerName?: string;
  playerTag?: string;
  gameName: string;
  totalPaid?: number;
  totalCashout?: number;
  remainingPay?: number;
  reduction?: number;
  isPending?: boolean;
  date?: string; // "YYYY-MM-DD"
  createdAt?: string; // ISO
}

export interface PendingRow {
  _id: string;
  type: string; // deposit | redeem
  label: string; // playerName or playerTag
  method: string;
  gameName: string;
  pendingAmount: number; // remainingPay (redeem) or reduction (deposit)
  createdAt: string;
}

interface UserCashoutTableProps {
  username?: string;
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const prettifyMethod = (m: string) => {
  if (!m) return "-";
  const lower = m.toLowerCase();
  if (lower === "cashapp") return "CashApp";
  if (lower === "paypal") return "PayPal";
  if (lower === "chime") return "Chime";
  if (lower === "venmo") return "Venmo";
  return m;
};

const UserCashoutTable: FC<UserCashoutTableProps> = ({ username }) => {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Which row is being confirmed in the modal
  const [confirmRow, setConfirmRow] = useState<PendingRow | null>(null);

  // 🔄 load pending entries from GameEntry
  useEffect(() => {
    const fetchPending = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await apiClient.get<ServerPendingEntry[]>(
          "/api/game-entries/pending",
          {
            params: username?.trim()
              ? { username: username.trim() }
              : undefined,
          }
        );

        const mapped: PendingRow[] = res.data
          .map((e) => {
            // “who” label: prefer playerName, else playerTag
            const label = e.playerName?.trim()
              ? e.playerName.trim()
              : e.playerTag?.trim()
              ? e.playerTag.trim()
              : "Unknown";

            // pending amount:
            //  - redeem (our tag): remainingPay
            //  - deposit (player tag): reduction
            const isRedeem = e.type === "redeem";
            const pendingAmount = isRedeem
              ? Number(e.remainingPay || 0)
              : Number(e.reduction || 0);

            if (!(pendingAmount > 0)) return null;

            return {
              _id: e._id,
              type: e.type,
              label,
              method: e.method || "-",
              gameName: e.gameName || "-",
              pendingAmount,
              createdAt: e.createdAt || e.date || "",
            };
          })
          .filter((r): r is PendingRow => r !== null);

        setRows(mapped);
      } catch (err: any) {
        console.error("Failed to load pending entries:", err);
        setError(
          err?.response?.data?.message ||
            "Failed to load pending payments. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, [username]);

  // ✅ Mark as paid → clear pending in backend + remove from list
  const handleMarkPaid = useCallback(async (row: PendingRow) => {
    try {
      setUpdatingId(row._id);
      setError("");

      // 🔧 Backend route
      await apiClient.patch(`/api/game-entries/${row._id}/clear-pending`, {
        reduction: 0,
      });

      // Remove from UI list
      setRows((prev) => prev.filter((r) => r._id !== row._id));
    } catch (err: any) {
      console.error("Failed to mark as paid:", err);
      setError(
        err?.response?.data?.message ||
          "Failed to mark as paid. Please try again."
      );
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const columns: ColumnDef<PendingRow>[] = useMemo(
    () => [
      {
        accessorKey: "label",
        header: "Player / Tag",
        cell: ({ getValue }) => {
          const v = (getValue() as string) || "-";
          return <span className="font-medium">{v}</span>;
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => {
          const t = String(getValue() || "").toLowerCase();
          const label =
            t === "redeem"
              ? "Redeem (Our Tag)"
              : t === "deposit"
              ? "Deposit (Player Tag)"
              : t || "-";
          return (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ getValue }) => (
          <span className="uppercase tracking-wide text-xs px-2 py-1 rounded-full bg-gray-100">
            {prettifyMethod(String(getValue() || "-"))}
          </span>
        ),
      },
      {
        accessorKey: "gameName",
        header: "Game",
        cell: ({ getValue }) => (
          <span className="text-sm">{String(getValue() || "-")}</span>
        ),
      },
      {
        accessorKey: "pendingAmount",
        header: "Pending Amount",
        cell: ({ getValue }) => {
          const num = Number(getValue() || 0);
          return <span className="font-semibold">${num.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ getValue }) => (
          <span className="text-xs text-gray-600">
            {formatDateTime(getValue() as string)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: () => (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border-orange-200">
            <Clock className="h-4 w-4" />
            Pending
          </span>
        ),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const data = row.original;
          const busy = updatingId === data._id;

          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  console.log("View pending entry", data);
                }}
              >
                View
              </button>
              <button
                type="button"
                disabled={busy}
                className={`text-xs px-2 py-1 rounded text-white ${
                  busy
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                onClick={() => setConfirmRow(data)} // 👈 open our custom modal
              >
                {busy ? "Saving..." : "Mark Paid"}
              </button>
            </div>
          );
        },
      },
    ],
    [updatingId]
  );

  const prettyAmount =
    confirmRow?.pendingAmount != null
      ? confirmRow.pendingAmount.toFixed(2)
      : "0.00";

  return (
    <div className="w-full max-w-8xl mx-auto bg-white text-black rounded-xl shadow p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">
            Pending Payments (Game Entries)
          </h2>
          <p className="text-xs md:text-sm text-gray-600">
            Redeem & player-tag entries that still have pending amounts.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-600">
          Loading pending payments…
        </div>
      ) : (
        <DataTable<PendingRow> columns={columns} data={rows} />
      )}

      {/* 🔽 Simple built-in confirm modal */}
      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white text-black rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Mark as Paid?</h3>
            <p className="text-sm text-gray-700 mb-4">
              Mark <span className="font-semibold">{confirmRow.label}</span>
              {"'s "}
              <span className="font-semibold">${prettyAmount}</span> as{" "}
              <span className="font-semibold">PAID</span> and clear it from
              pending?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() => setConfirmRow(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                onClick={async () => {
                  await handleMarkPaid(confirmRow);
                  setConfirmRow(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCashoutTable;
