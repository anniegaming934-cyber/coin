// src/UserTable.tsx
import React, { useEffect, useState } from "react";
import { apiClient } from "../apiConfig";
import { Pencil, X } from "lucide-react";
import type { Game } from "../admin/Gamerow";

const GAMES_API = "/api/games";
const COIN_VALUE = 0.15;

// helper
const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

type SessionValues = {
  freeplay: number;
  redeem: number;
  deposit: number;
};

interface UserTableProps {
  username?: string; // will be sent to backend
}

const UserTable: React.FC<UserTableProps> = ({ username = "Unknown User" }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // per-day / per-session totals shown in table
  const [sessionValues, setSessionValues] = useState<
    Record<number, SessionValues>
  >({});

  // edit popup fields
  const [freeplayChange, setFreeplayChange] = useState("");
  const [redeemChange, setRedeemChange] = useState("");
  const [depositChange, setDepositChange] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // fetch all games (name + totalCoins from backend)
  const fetchGames = async () => {
    try {
      const { data } = await apiClient.get(GAMES_API);
      if (Array.isArray(data)) setGames(data);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // handle save (edit popup)
  const handleSave = () => {
    if (!editingGame || isSaving) return;

    const freeplayDelta = Number(freeplayChange) || 0;
    const redeemDelta = Number(redeemChange) || 0;
    const depositDelta = Number(depositChange) || 0;

    // no changes → just close
    if (!freeplayDelta && !redeemDelta && !depositDelta) {
      setEditingGame(null);
      setFreeplayChange("");
      setRedeemChange("");
      setDepositChange("");
      return;
    }

    const gameId = editingGame.id;

    // previous totalCoins from game state
    const prevTotal = safeNumber((editingGame as any).totalCoins);

    // per-day/session totals BEFORE this edit
    const prevSession = sessionValues[gameId] || {
      freeplay: 0,
      redeem: 0,
      deposit: 0,
    };

    // per-day/session totals AFTER this edit
    const newSession: SessionValues = {
      freeplay: prevSession.freeplay + freeplayDelta,
      redeem: prevSession.redeem + redeemDelta,
      deposit: prevSession.deposit + depositDelta,
    };

    // 🔢 Apply your rule:
    // freeplay & deposit subtract, redeem adds
    const newTotal = prevTotal - freeplayDelta - depositDelta + redeemDelta;

    console.log("💾 Saving game", {
      gameId,
      username,
      freeplayDelta,
      redeemDelta,
      depositDelta,
      prevTotal,
      newTotal,
      sessionBefore: prevSession,
      sessionAfter: newSession,
      url: `${GAMES_API}/${gameId}/add-moves`,
    });

    // ✅ Update per-day/session values shown in table
    setSessionValues((prev) => ({
      ...prev,
      [gameId]: newSession,
    }));

    // ✅ Update totalCoins in UI immediately
    setGames((prev) =>
      prev.map((g) =>
        g.id === gameId
          ? {
              ...g,
              totalCoins: newTotal,
            }
          : g
      )
    );

    // close modal + reset fields
    setEditingGame(null);
    setFreeplayChange("");
    setRedeemChange("");
    setDepositChange("");

    // Send deltas + per-day totals + username to backend
    setIsSaving(true);
    apiClient
      .post(`${GAMES_API}/${gameId}/add-moves`, {
        username,
        freeplayDelta,
        redeemDelta,
        depositDelta,
        freeplayTotal: newSession.freeplay,
        redeemTotal: newSession.redeem,
        depositTotal: newSession.deposit,
      })
      .then((res) => {
        console.log("✅ Save response:", res.data);
        // optional: re-sync with DB
        // fetchGames();
      })
      .catch((err) => {
        console.error("❌ Failed to save:", err);
        // optional: revert by refetching from backend
        // fetchGames();
      })
      .finally(() => setIsSaving(false));
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="overflow-x-auto relative">
      <table className="min-w-full border-collapse bg-white rounded-lg shadow-md">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
            <th className="px-4 py-3 text-left">Game</th>
            <th className="px-4 py-3 text-center">Freeplay (-)</th>
            <th className="px-4 py-3 text-center">Redeem (+)</th>
            <th className="px-4 py-3 text-center">Deposit (-)</th>
            <th className="px-4 py-3 text-center">Total Coins</th>
            <th className="px-4 py-3 text-center">Value</th>
            <th className="px-4 py-3 text-right">Edit</th>
          </tr>
        </thead>

        <tbody className="text-sm text-gray-700">
          {games.map((game) => {
            const gameId = game.id;
            const totalCoins = safeNumber((game as any).totalCoins);

            // per-day/session values (start from 0)
            const session = sessionValues[gameId] || {
              freeplay: 0,
              redeem: 0,
              deposit: 0,
            };

            const pnl = totalCoins * COIN_VALUE;

            return (
              <tr key={game.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {game.name}
                </td>

                {/* Freeplay (per-day/session total) */}
                <td className="px-4 py-3 text-center text-red-500 font-semibold">
                  {session.freeplay.toLocaleString()}
                </td>

                {/* Redeem (per-day/session total) */}
                <td className="px-4 py-3 text-center text-emerald-600 font-semibold">
                  {session.redeem.toLocaleString()}
                </td>

                {/* Deposit (per-day/session total) */}
                <td className="px-4 py-3 text-center text-red-500 font-semibold">
                  {session.deposit.toLocaleString()}
                </td>

                {/* Total Coins */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`font-semibold ${
                      totalCoins >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {totalCoins.toLocaleString()}
                  </span>
                </td>

                {/* Value */}
                <td className="px-4 py-3 text-center text-slate-600">
                  {formatCurrency(pnl)}
                </td>

                {/* Edit Button */}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingGame(game);
                      setFreeplayChange("");
                      setRedeemChange("");
                      setDepositChange("");
                    }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}

          {games.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-gray-500 py-6">
                No games available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 🧩 EDIT POPUP */}
      {editingGame && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm relative">
            <button
              onClick={() => {
                setEditingGame(null);
                setFreeplayChange("");
                setRedeemChange("");
                setDepositChange("");
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Edit {editingGame.name}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Freeplay (-)
                </label>
                <input
                  type="number"
                  value={freeplayChange}
                  onChange={(e) => setFreeplayChange(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-indigo-200"
                  placeholder="Enter freeplay amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redeem (+)
                </label>
                <input
                  type="number"
                  value={redeemChange}
                  onChange={(e) => setRedeemChange(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-indigo-200"
                  placeholder="Enter redeem amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit (-)
                </label>
                <input
                  type="number"
                  value={depositChange}
                  onChange={(e) => setDepositChange(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-indigo-200"
                  placeholder="Enter deposit amount"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setEditingGame(null);
                    setFreeplayChange("");
                    setRedeemChange("");
                    setDepositChange("");
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTable;
