// GameTable.tsx
import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DataTable } from "../DataTable"; // your wrapper

export interface GameRowDT {
  id: number;
  name: string;
  coinsSpent: number; // deposit + freeplay
  coinsEarned: number; // redeem
  coinsRecharged: number; // coins you bought / loaded
  lastRechargeDate?: string;
  totalCoins?: number; // optional from backend
}

type Handlers = {
  onEditStart: (id: number) => void;
  onResetRecharge: (id: number) => void;
  onDelete: (id: number) => void;
  coinValue: number; // 1 coin => how many $
};

export const makeGameColumns = ({
  onEditStart,
  onResetRecharge,
  onDelete,
  coinValue,
}: Handlers): ColumnDef<GameRowDT>[] => [
  {
    header: "Game",
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    header: "Coin Recharged",
    accessorKey: "coinsRecharged",
    cell: ({ getValue }) => (
      <span className="font-mono text-blue-700">
        {Number(getValue() || 0).toLocaleString()}
      </span>
    ),
  },
  {
    header: "Recharge Date",
    accessorKey: "lastRechargeDate",
    cell: ({ getValue }) => (
      <span className="text-xs text-gray-600">{getValue() || "—"}</span>
    ),
  },

  // 🔥 TOTAL COIN — automatic add/subtract based on type rules
  {
    header: "Total coin",
    id: "totalCoin",
    cell: ({ row }) => {
      const g = row.original;

      const coinsSpent = g.coinsSpent || 0; // deposit + freeplay → subtract
      const coinsEarned = g.coinsEarned || 0; // redeem → add
      const coinsRecharged = g.coinsRecharged || 0; // recharge → add

      // net coins available:
      //   recharge (+)
      //   redeem   (+)
      //   deposit/freeplay (−)
      const computedTotal = coinsRecharged + coinsEarned - coinsSpent;

      // if backend already sends totalCoins, prefer that; otherwise use computed
      const total =
        typeof g.totalCoins === "number" ? g.totalCoins : computedTotal;

      const cls =
        total > 0
          ? "text-green-700"
          : total < 0
          ? "text-red-700"
          : "text-gray-500";

      return (
        <span className={`font-mono ${cls}`}>{total.toLocaleString()}</span>
      );
    },
  },

  // 💰 P&L in money, consistent with above logic
  {
    header: "P&L",
    id: "pnl",
    cell: ({ row }) => {
      const g = row.original;

      const coinsSpent = g.coinsSpent || 0; // players pay us
      const coinsEarned = g.coinsEarned || 0; // we pay players
      const coinsRecharged = g.coinsRecharged || 0; // our cost

      // profit in coins:
      //   income from players: coinsSpent
      //   costs: redeem (coinsEarned) + recharge (coinsRecharged)
      const netProfitCoins = coinsSpent - (coinsEarned + coinsRecharged);
      const pnl = netProfitCoins * coinValue;

      const pos = pnl >= 0;
      const Icon = pos ? TrendingUp : TrendingDown;

      return (
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold inline-flex items-center ${
            pos ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"
          }`}
        >
          <Icon size={14} className="mr-1" />
          {pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </span>
      );
    },
  },

  {
    header: "Actions",
    id: "actions",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onEditStart(row.original.id)}
          className="p-1 text-indigo-600 hover:text-indigo-800 rounded hover:bg-indigo-100"
          title="Edit recharge"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => onResetRecharge(row.original.id)}
          className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100"
          title="Reset recharge"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => onDelete(row.original.id)}
          className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-100"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
  },
];

const GameTable: React.FC<{
  data: GameRowDT[];
  coinValue: number;
  onEditStart: (id: number) => void;
  onResetRecharge: (id: number) => void;
  onDelete: (id: number) => void;
}> = ({ data, coinValue, onEditStart, onResetRecharge, onDelete }) => {
  const columns = makeGameColumns({
    coinValue,
    onEditStart,
    onResetRecharge,
    onDelete,
  });
  return <DataTable columns={columns} data={data} />;
};

export default GameTable;
