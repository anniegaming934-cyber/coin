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

type UserTableMode = "admin" | "user";

interface UserTableProps {
  mode?: UserTableMode; // default "user"
}

const UserTable: React.FC<UserTableProps> = ({ mode = "user" }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // edit fields (admin only)
  const [freeplayChange, setFreeplayChange] = useState("");
  const [redeemChange, setRedeemChange] = useState("");
  const [depositChange, setDepositChange] = useState("");

  const [sessionValues, setSessionValues] = useState<
    Record<number, SessionValues>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  // fetch all games
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

  // reset UI-only values every 10 minutes (admin mode only)
  useEffect(() => {
    if (mode !== "admin") return;
    const interval = setInterval(() => setSessionValues({}), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mode]);

  // handle save (admin only)
  const handleSave = () => {
    if (mode !== "admin") return;
    if (!editingGame || isSaving) return;

    const freeplay = Number(freeplayChange) || 0;
    const redeem = Number(redeemChange) || 0;
    const deposit = Number(depositChange) || 0;

    if (!freeplay && !redeem && !deposit) {
      setEditingGame(null);
      setFreeplayChange("");
      setRedeemChange("");
      setDepositChange("");
      return;
    }

    const gameId = editingGame.id;

    // Update UI totals immediately
    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          coinsEarned: safeNumber(g.coinsEarned) + freeplay,
          coinsSpent: safeNumber(g.coinsSpent) + redeem,
          coinsRecharged: safeNumber(g.coinsRecharged) + deposit,
        };
      })
    );

    // Update session values
    setSessionValues((prev) => {
      const current = prev[gameId] || { freeplay: 0, redeem: 0, deposit: 0 };
      return {
        ...prev,
        [gameId]: {
          freeplay: current.freeplay + freeplay,
          redeem: current.redeem + redeem,
          deposit: current.deposit + deposit,
        },
      };
    });

    setEditingGame(null);
    setFreeplayChange("");
    setRedeemChange("");
    setDepositChange("");

    // Send to backend
    setIsSaving(true);
    apiClient
      .post(`${GAMES_API}/${gameId}/add-moves`, {
        freeplayDelta: freeplay,
        redeemDelta: redeem,
        depositDelta: deposit,
      })
      .catch((err) => console.error("Failed to save:", err))
      .finally(() => setIsSaving(false));
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // =============== admin VIEW (READ-ONLY) ===============
  if (mode === "admin") {
    return (
      <div className="overflow-x-auto relative">
        <table className="min-w-full border-collapse bg-white rounded-lg shadow-md">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
              <th className="px-4 py-3 text-left">Game</th>
              <th className="px-4 py-3 text-center">Total Coins</th>
              <th className="px-4 py-3 text-center">Value</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {games.map((game) => {
              const earned = safeNumber(game.coinsEarned); // freeplay (-)
              const spent = safeNumber(game.coinsSpent); // redeem (+)
              const recharged = safeNumber(game.coinsRecharged); // deposit (-)

              const totalCoins = earned + recharged - spent;
              const pnl = totalCoins * COIN_VALUE;

              return (
                <tr key={game.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {game.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`font-semibold ${
                        totalCoins >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {totalCoins.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {formatCurrency(pnl)}
                  </td>
                </tr>
              );
            })}

            {games.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-gray-500 py-6">
                  No games available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // =============== ADMIN VIEW (EDITABLE) ===============
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
            <th className="px-4 py-3 text-right">Edit</th>
          </tr>
        </thead>

        <tbody className="text-sm text-gray-700">
          {games.map((game) => {
            const earned = safeNumber(game.coinsEarned); // freeplay
            const spent = safeNumber(game.coinsSpent); // redeem
            const recharged = safeNumber(game.coinsRecharged); // deposit

            // freeplay subtract, deposit subtract, redeem add
            const totalCoins = earned + recharged - spent;
            const pnl = totalCoins * COIN_VALUE;

            const session = sessionValues[game.id] || {
              freeplay: 0,
              redeem: 0,
              deposit: 0,
            };

            return (
              <tr key={game.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {game.name}
                </td>

                {/* Freeplay – subtracts total */}
                <td className="px-4 py-3 text-center text-red-500 font-semibold">
                  {session.freeplay.toLocaleString()}
                </td>

                {/* Redeem – adds to total */}
                <td className="px-4 py-3 text-center text-emerald-600 font-semibold">
                  {session.redeem.toLocaleString()}
                </td>

                {/* Deposit – subtracts total */}
                <td className="px-4 py-3 text-center text-red-500 font-semibold">
                  {session.deposit.toLocaleString()}
                </td>

                {/* Total Coins */}
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center">
                    <span
                      className={`font-semibold ${
                        totalCoins >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {totalCoins.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatCurrency(pnl)}
                    </span>
                  </div>
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
              <td colSpan={6} className="text-center text-gray-500 py-6">
                No games available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 🧩 EDIT POPUP – ADMIN ONLY */}
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
