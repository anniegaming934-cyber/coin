import React, { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../DataTable";

export type EntryType = "freeplay" | "deposit" | "redeem";

// ✅ Supports both old + new fields
export interface GameEntry {
  _id: string;
  type: EntryType;
  playerName: string;
  gameName?: string;
  amount: number; // often final amount
  amountBase?: number; // optional base before bonus
  bonusRate?: number; // optional %
  bonusAmount?: number; // optional absolute bonus
  amountFinal?: number; // optional final (if different from amount)
  note?: string;
  date?: string; // ISO string
  createdAt: string; // ISO string
}

interface RecentEntriesTableProps {
  recent: GameEntry[];
  onRefresh: () => void;
  title?: string;
}

const fmtMoney = (n?: number) =>
  n == null
    ? "–"
    : n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const fmtPct = (n?: number) =>
  n == null || Number.isNaN(n) ? "–" : `${n.toFixed(2)}%`;

// 🔧 Format: "12 nov 2025"
const formatDateLabel = (d: Date) => {
  const day = d.getDate(); // 1..31
  const mon = d.toLocaleString("en-US", { month: "short" }).toLowerCase(); // "nov"
  const yr = d.getFullYear();
  return `${day} ${mon} ${yr}`;
};

// 🔧 Format 12-hr with am/pm (lowercase), e.g. "03:45 pm"
const formatTimeLabel = (d: Date) => {
  const t = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return t.toLowerCase(); // "03:45 pm"
};

const RecentEntriesTable: React.FC<RecentEntriesTableProps> = ({
  recent,
  onRefresh,
  title = "Recent Entries",
}) => {
  // 🔎 Build normalized rows with derived bonus fields (works with partial data)
  const rows = useMemo(() => {
    return recent.map((r) => {
      const whenISO = r.date || r.createdAt;
      const when = new Date(whenISO);

      const finalAmt = r.amountFinal ?? r.amount ?? 0;
      const baseAmt =
        r.amountBase ??
        // If it's a redeem, assume no bonus → base ≈ final
        (r.type === "redeem" ? finalAmt : undefined);

      const bonusAmt =
        r.bonusAmount ??
        (baseAmt != null ? Math.max(0, finalAmt - baseAmt) : undefined);

      const bonusPct =
        r.bonusRate ??
        (baseAmt && bonusAmt != null && baseAmt > 0
          ? (bonusAmt / baseAmt) * 100
          : undefined);

      return {
        ...r,
        _whenDate: formatDateLabel(when), // 👈 "12 nov 2025"
        _whenTime: formatTimeLabel(when), // 👈 "03:45 pm"
        _finalAmount: finalAmt,
        _baseAmount: baseAmt,
        _bonusAmount: bonusAmt,
        _bonusRate: bonusPct,
      };
    });
  }, [recent]);

  type Row = (typeof rows)[number];

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    return [
      {
        header: "Date",
        accessorKey: "_whenDate",
        sortingFn: (a, b) =>
          new Date(a.original.date || a.original.createdAt).getTime() -
          new Date(b.original.date || b.original.createdAt).getTime(),
        cell: ({ row }) => row.original._whenDate,
      },
      {
        header: "Time",
        accessorKey: "_whenTime",
        cell: ({ row }) => row.original._whenTime,
      },
      {
        header: "Type",
        accessorKey: "type",
        cell: ({ getValue }) =>
          String(getValue()).charAt(0).toUpperCase() +
          String(getValue()).slice(1),
      },
      {
        header: "Player",
        accessorKey: "playerName",
      },
      {
        header: "Game",
        accessorKey: "gameName",
        cell: ({ getValue }) => getValue() || "–",
      },
      {
        header: "Base",
        accessorKey: "_baseAmount",
        cell: ({ row }) => fmtMoney(row.original._baseAmount),
      },
      {
        header: "Bonus",
        id: "bonusCombo",
        cell: ({ row }) => {
          const r = row.original;
          const hasBonus =
            r._bonusAmount != null && r._bonusAmount > 0 && r.type !== "redeem";
          return hasBonus
            ? `${fmtMoney(r._bonusAmount)} (${fmtPct(r._bonusRate)})`
            : "–";
        },
      },
      {
        header: "Amount (Final)",
        accessorKey: "_finalAmount",
        cell: ({ row }) => fmtMoney(row.original._finalAmount),
      },
      {
        header: "Note",
        accessorKey: "note",
        cell: ({ getValue }) => getValue() || "–",
      },
    ];
  }, []);

  return (
    <div className="w-full rounded-2xl border p-4 md:p-6 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold">{title}</h3>
        <button onClick={onRefresh} className="text-sm underline">
          Refresh
        </button>
      </div>

      <DataTable<Row, unknown>
        columns={columns}
        data={rows}
        emptyMessage="No entries yet."
      />
    </div>
  );
};

export default RecentEntriesTable;
