// src/components/GameEntriesTable.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";

type EntryType = "deposit" | "freeplay" | "redeem";
type Method = "cashapp" | "paypal" | "chime" | string;

export interface GameEntryRow {
  _id: string;
  type: EntryType; // deposit | freeplay | redeem
  method?: Method; // optional, in case some entries don't have it
  playerName?: string;
  amount: number;
  bonusAmount?: number;
  finalAmount: number;
  totalPaid?: number;
  remainingToPay?: number;
  date: string; // stored as YYYY-MM-DD for filtering
}

// 2025-11-12 -> "12 Nov 2025"
const formatDisplayDate = (iso: string | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const PaymentCombinedTable: React.FC = () => {
  const [rows, setRows] = useState<GameEntryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | EntryType>("");
  const [methodFilter, setMethodFilter] = useState<"" | Method>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 🔗 All data comes from /api/game-entries
        const res = await apiClient.get("/api/game-entries");
        const data = res.data || [];

        const mapped: GameEntryRow[] = data.map((e: any) => {
          const amount = Number(e.amount || 0);
          const bonus = Number(e.bonusAmount || 0);
          const finalAmount = amount + bonus;

          return {
            _id: e._id,
            type: e.type as EntryType, // "deposit" | "freeplay" | "redeem"
            method: e.method, // optional, if you send it
            playerName: e.playerName || "",
            amount,
            bonusAmount: bonus,
            finalAmount,
            // if backend sends these, we use them; otherwise default to simple values
            totalPaid: e.totalPaid ?? finalAmount,
            remainingToPay: e.remainingToPay ?? 0,
            // keep ISO format for filters (YYYY-MM-DD)
            date: e.date || e.createdAt?.slice(0, 10) || "",
          };
        });

        setRows(mapped);
      } catch (err) {
        console.error("Error loading /api/game-entries:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const search = searchTerm.trim().toLowerCase();

        if (search) {
          const haystack = [
            row.playerName || "",
            row.method || "",
            row.type || "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        if (typeFilter && row.type !== typeFilter) return false;
        if (methodFilter && row.method !== methodFilter) return false;

        if (dateFrom && row.date && row.date < dateFrom) return false;
        if (dateTo && row.date && row.date > dateTo) return false;

        return true;
      }),
    [rows, searchTerm, typeFilter, methodFilter, dateFrom, dateTo]
  );

  const columns = useMemo<ColumnDef<GameEntryRow>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const t = row.original.type;
          let color = "text-gray-700";
          if (t === "deposit") color = "text-green-600";
          if (t === "redeem") color = "text-red-600";
          if (t === "freeplay") color = "text-blue-600";
          return <span className={`${color} font-semibold`}>{t}</span>;
        },
      },
      { accessorKey: "method", header: "Method" },
      { accessorKey: "playerName", header: "Player Name" },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => row.original.amount.toFixed(2),
      },
      {
        accessorKey: "bonusAmount",
        header: "Bonus Amount",
        cell: ({ row }) => (row.original.bonusAmount || 0).toFixed(2),
      },
      {
        accessorKey: "finalAmount",
        header: "Final Amount",
        cell: ({ row }) => (
          <span className="font-bold">
            {row.original.finalAmount.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: "Total Paid",
        cell: ({ row }) => (row.original.totalPaid ?? 0).toFixed(2),
      },
      {
        accessorKey: "remainingToPay",
        header: "Remaining to Pay",
        cell: ({ row }) => (row.original.remainingToPay ?? 0).toFixed(2),
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDisplayDate(row.original.date),
      },
    ],
    []
  );

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("");
    setMethodFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h2 className="text-xl font-bold">Game Entries</h2>
        <span className="text-sm text-gray-500">
          Showing <strong>{filteredRows.length}</strong> of{" "}
          <strong>{rows.length}</strong> records
        </span>
      </div>

      {/* 🔍 search + dropdown filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50 p-3 rounded-lg">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Search (player, method, type)
          </label>
          <input
            type="text"
            className="w-full border rounded-md px-2 py-1 text-sm"
            placeholder="e.g. John, cashapp, deposit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Type
          </label>
          <select
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | EntryType)}
          >
            <option value="">All</option>
            <option value="deposit">Deposit</option>
            <option value="freeplay">Freeplay</option>
            <option value="redeem">Redeem</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Method
          </label>
          <select
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as "" | Method)}
          >
            <option value="">All</option>
            <option value="cashapp">CashApp</option>
            <option value="paypal">PayPal</option>
            <option value="chime">Chime</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full border rounded-md px-2 py-1 text-sm bg-white hover:bg-gray-100"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* 📅 date range */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            From Date
          </label>
          <input
            type="date"
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            To Date
          </label>
          <input
            type="date"
            className="w-full border rounded-md px-2 py-1 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-end text-xs text-gray-500">
          Filter uses raw YYYY-MM-DD, but displays as {"“12 Nov 2025”"}.
        </div>
      </div>

      <DataTable columns={columns} data={filteredRows} loading={loading} />
    </div>
  );
};

export default PaymentCombinedTable;
