// src/UserTable.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Pencil, X } from "lucide-react";
import type { Game } from "../admin/Gamerow";

const GAMES_API = "/api/games";
const COIN_VALUE = 0.15;

// helper to avoid NaN
const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const UserTable: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // three edit fields
  const [freeplayChange, setFreeplayChange] = useState("");
  const [redeemChange, setRedeemChange] = useState("");
  const [depositChange, setDepositChange] = useState("");

  // Fetch all games
  const fetchGames = async () => {
    try {
      const { data } = await axios.get(GAMES_API);
      if (Array.isArray(data)) setGames(data);
      else console.error("Expected array but got:", data);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // Save from dialog – call backend increment route
  const handleSave = async () => {
    if (!editingGame) return;

    const freeplay = Number(freeplayChange) || 0; // coinsEarned +
    const redeem = Number(redeemChange) || 0; // coinsSpent +
    const deposit = Number(depositChange) || 0; // coinsRecharged +

    // if all zero, just close
    if (!freeplay && !redeem && !deposit) {
      setEditingGame(null);
      setFreeplayChange("");
      setRedeemChange("");
      setDepositChange("");
      return;
    }

    try {
      await axios.post(`${GAMES_API}/${editingGame.id}/add-moves`, {
        freeplayDelta: freeplay,
        redeemDelta: redeem,
        depositDelta: deposit,
      });

      // Reload games so totals/UI stay correct
      await fetchGames();
    } catch (err) {
      console.error("Failed to save game moves:", err);
    }

    // Close dialog + reset fields
    setEditingGame(null);
    setFreeplayChange("");
    setRedeemChange("");
    setDepositChange("");
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="overflow-x-auto relative">
      <table className="min-w-full border-collapse bg-white rounded-lg shadow-md">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold">
            <th className="px-4 py-3 text-left">Game</th>
            <th className="px-4 py-3 text-center">Freeplay</th>
            <th className="px-4 py-3 text-center">Redeem</th>
            <th className="px-4 py-3 text-center">Deposit</th>
            <th className="px-4 py-3 text-center">Total Coins</th>
            <th className="px-4 py-3 text-right">Edit</th>
          </tr>
        </thead>

        <tbody className="text-sm text-gray-700">
          {games.map((game) => {
            const spent = safeNumber(game.coinsSpent); // redeem
            const earned = safeNumber(game.coinsEarned); // freeplay
            const recharged = safeNumber(game.coinsRecharged); // deposit
            const totalCoins = earned + recharged - spent;
            const pnl = totalCoins * COIN_VALUE;

            return (
              <tr key={game.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {game.name}
                </td>

                {/* Freeplay */}
                <td className="px-4 py-3 text-center text-emerald-600 font-semibold">
                  {earned}
                </td>

                {/* Redeem */}
                <td className="px-4 py-3 text-center text-red-500 font-semibold">
                  {spent}
                </td>

                {/* Deposit */}
                <td className="px-4 py-3 text-center text-indigo-500 font-semibold">
                  {recharged}
                </td>

                {/* Total coins (net) */}
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

                {/* Edit button */}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingGame(game);
                      setFreeplayChange("");
                      setRedeemChange("");
                      setDepositChange("");
                    }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}

          {games.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="text-center text-gray-500 text-sm py-6"
              >
                No games available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 🧩 EDIT POPUP DIALOG */}
      {editingGame && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm relative">
            {/* Close button */}
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
              {/* Freeplay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Freeplay (+)
                </label>
                <input
                  type="number"
                  value={freeplayChange}
                  onChange={(e) => setFreeplayChange(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-indigo-200"
                  placeholder="Enter freeplay amount"
                />
              </div>

              {/* Redeem */}
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

              {/* Deposit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit (+)
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
                  className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Save
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
