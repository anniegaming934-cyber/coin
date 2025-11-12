// src/UserTable.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";
import type { Game } from "../admin/Gamerow";

const GAMES_API = "/api/games";
const GAME_ENTRIES_API = "/api/game-entries";
const COIN_VALUE = 0.15;

type EntryType = "freeplay" | "deposit" | "redeem";

interface GameEntry {
  _id: string;
  type: EntryType;
  gameName?: string; // used to match with games
  amount: number; // amount to aggregate
  date?: string;
  createdAt: string;
}

interface UserTableProps {
  /** Optional filter; remove if backend doesn't support it */
  username?: string;
}

const safeNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type SessionValues = { freeplay: number; deposit: number; redeem: number };

type DisplayRow = Game & {
  _session: SessionValues;
  _displayTotalCoins: number;
  _valueUSD: number;
};

const UserTable: React.FC<UserTableProps> = ({ username }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [gamesRes, entriesRes] = await Promise.all([
        apiClient.get(GAMES_API),
        apiClient.get(GAME_ENTRIES_API, { params: { username } }),
      ]);
      if (Array.isArray(gamesRes.data)) setGames(gamesRes.data);
      if (Array.isArray(entriesRes.data)) setEntries(entriesRes.data);
    } catch (e) {
      console.error("Failed to load games / game-entries:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  /** Aggregate entries by gameName and type */
  const sessionByGameName = useMemo(() => {
    const map: Record<string, SessionValues> = {};
    for (const e of entries) {
      const name = (e.gameName || "").trim();
      if (!name) continue;

      // guard type
      const t = e.type as EntryType;
      if (t !== "freeplay" && t !== "deposit" && t !== "redeem") continue;

      const amt = safeNumber(e.amount);
      if (!map[name]) map[name] = { freeplay: 0, deposit: 0, redeem: 0 };
      map[name][t] += amt;
    }
    return map;
  }, [entries]);

  /** Merge games with aggregates, compute adjusted totals */
  const rows: DisplayRow[] = useMemo(() => {
    return games.map((g) => {
      const nameKey = (g as any).name || "";
      const s = sessionByGameName[nameKey] || {
        freeplay: 0,
        deposit: 0,
        redeem: 0,
      };

      const baseTotal = safeNumber((g as any).totalCoins);
      const adjustedTotal = baseTotal - s.freeplay - s.deposit + s.redeem;
      const valueUSD = adjustedTotal * COIN_VALUE;

      return {
        ...g,
        _session: s,
        _displayTotalCoins: adjustedTotal,
        _valueUSD: valueUSD,
      };
    });
  }, [games, sessionByGameName]);

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const columns: ColumnDef<DisplayRow>[] = useMemo(
    () => [
      {
        header: "Game",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium text-gray-800">{row.original.name}</span>
        ),
      },
      {
        header: "Freeplay (−)",
        id: "freeplay",
        cell: ({ row }) => (
          <span className="text-red-500 font-semibold">
            {row.original._session.freeplay.toLocaleString()}
          </span>
        ),
        meta: { className: "text-center" },
      },
      {
        header: "Redeem (+)",
        id: "redeem",
        cell: ({ row }) => (
          <span className="text-emerald-600 font-semibold">
            {row.original._session.redeem.toLocaleString()}
          </span>
        ),
        meta: { className: "text-center" },
      },
      {
        header: "Deposit (−)",
        id: "deposit",
        cell: ({ row }) => (
          <span className="text-red-500 font-semibold">
            {row.original._session.deposit.toLocaleString()}
          </span>
        ),
        meta: { className: "text-center" },
      },
      {
        header: "Total Coins",
        id: "totalCoinsAdj",
        cell: ({ row }) => {
          const n = row.original._displayTotalCoins;
          return (
            <span
              className={`font-semibold ${
                n >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {n.toLocaleString()}
            </span>
          );
        },
        meta: { className: "text-center" },
      },
      {
        header: "Value",
        id: "usd",
        cell: ({ row }) => (
          <span className="text-slate-600">
            {formatCurrency(row.original._valueUSD)}
          </span>
        ),
        meta: { className: "text-center" },
      },
    ],
    []
  );

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between px-3 pt-3">
        <h3 className="text-sm font-semibold text-slate-700">Games</h3>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <DataTable columns={columns as ColumnDef<any, any>[]} data={rows} />

      {rows.length === 0 && (
        <div className="text-center text-gray-500 py-6">
          No games available.
        </div>
      )}
    </div>
  );
};

export default UserTable;
