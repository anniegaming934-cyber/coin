import React, { useState, type FC } from "react";
import {
  TrendingUp,
  TrendingDown,
  Gamepad,
  Edit,
  Save,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";

export interface Game {
  id: number;
  name: string;
  coinsSpent: number; // freeplay + deposit (for net calc)
  coinsEarned: number; // redeem (for net calc)
  coinsRecharged: number; // coin top-up (editable)
  lastRechargeDate?: string; // editable with recharge
  totalCoins?: number; // optional, from backend
}

interface GameRowProps {
  game: Game;
  coinValue: number;
  isEditing: boolean;
  onEditStart: (id: number) => void;

  // Keep signature for compatibility; we’ll pass 0 for spent/redeem
  onUpdate: (
    id: number,
    spentChange: number,
    earnedChange: number,
    rechargeChange: number,
    totalCoinsAfter: number,
    rechargeDateISO?: string
  ) => void;

  onCancel: () => void;
  onDelete: (id: number) => void;

  // NEW: reset just the recharge fields
  onResetRecharge: (id: number) => void;
}

const formatCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const toTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const GameRow: FC<GameRowProps> = ({
  game,
  coinValue,
  isEditing,
  onEditStart,
  onUpdate,
  onCancel,
  onDelete,
  onResetRecharge,
}) => {
  // Only edit recharge + date
  const [rechargeStr, setRechargeStr] = useState<string>("");
  const [rechargeDateISO, setRechargeDateISO] = useState<string>(
    game.lastRechargeDate || toTodayISO()
  );

  const netCoinFlow =
    game.coinsEarned - (game.coinsSpent + game.coinsRecharged);
  const pnl = netCoinFlow * coinValue;
  const isProfit = pnl >= 0;

  const pnlClass = isProfit
    ? "text-emerald-600 bg-emerald-100"
    : "text-red-600 bg-red-100";
  const PnlIcon = isProfit ? TrendingUp : TrendingDown;

  const inputBox =
    "w-full p-2 text-sm border border-gray-700 rounded-md bg-[#0b1222] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const toNonNegNumber = (s: string) => {
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const handleLogTransaction = () => {
    // spent and redeem are no longer editable
    const spentChange = 0;
    const earnedChange = 0;
    const rechargeChange = toNonNegNumber(rechargeStr);

    if (!Number.isFinite(rechargeChange)) return;

    const dateOrUndefined =
      rechargeChange > 0 ? rechargeDateISO || toTodayISO() : undefined;

    // recompute preview total (front-end only; backend is source of truth)
    const newCoinsSpent = game.coinsSpent + spentChange;
    const newCoinsEarned = game.coinsEarned + earnedChange;
    const newCoinsRecharged = game.coinsRecharged + rechargeChange;

    const totalCoinsRaw = newCoinsEarned - (newCoinsSpent + newCoinsRecharged);
    const totalCoinsAfter = Math.abs(totalCoinsRaw);

    onUpdate(
      game.id,
      spentChange,
      earnedChange,
      rechargeChange,
      totalCoinsAfter,
      dateOrUndefined
    );

    setRechargeStr("");
    onCancel();
  };

  const invalid = !Number.isFinite(toNonNegNumber(rechargeStr));

  // ===== Modal: only Coin Recharged + Date =====
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] text-gray-100 shadow-2xl">
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
              title="Close"
            >
              <X size={18} className="text-gray-300" />
            </button>

            <div className="flex justify-center -mt-6">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                <Gamepad className="text-indigo-400" size={20} />
              </div>
            </div>

            <div className="px-6 pt-6 pb-5 text-center">
              <h2 className="text-lg font-semibold">Update Coin Recharge</h2>
              <p className="mt-1 text-sm text-gray-400">
                <span className="font-medium text-gray-200">{game.name}</span>
              </p>

              <div className="mt-5 space-y-3 text-left">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Coin Recharged
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rechargeStr}
                    onChange={(e) => setRechargeStr(e.target.value)}
                    className={inputBox}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Recharge Date
                  </label>
                  <input
                    type="date"
                    value={rechargeDateISO}
                    onChange={(e) => setRechargeDateISO(e.target.value)}
                    className={inputBox}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={handleLogTransaction}
                  disabled={invalid}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition"
                >
                  <Save size={16} className="mr-2" />
                  Save
                </button>

                <button
                  onClick={onCancel}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/15 transition"
                >
                  <X size={16} className="mr-2" />
                  Cancel
                </button>
              </div>

              <div className="mt-3">
                <button
                  onClick={() => onResetRecharge(game.id)}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 transition border border-red-500/40"
                  title="Reset recharge (sets to 0 and clears date)"
                >
                  <RotateCcw size={14} className="mr-2" />
                  Reset Recharge
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Table row (no Redeem column, no Redeem action) =====
  const derivedNet = game.coinsEarned - (game.coinsSpent + game.coinsRecharged);
  const totalCoinValue =
    typeof game.totalCoins === "number"
      ? game.totalCoins
      : Math.abs(derivedNet);

  const nameCell = (
    <div className="flex items-center space-x-3">
      <Gamepad size={20} className="text-indigo-500 hidden md:block" />
      <span className="font-semibold text-gray-800 truncate">{game.name}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-4 py-4 px-4 hover:bg-gray-50 transition duration-150 border-b border-gray-200">
      <div className="col-span-4">{nameCell}</div>

      <div className="col-span-2 text-sm text-gray-700">
        <span className="font-mono text-blue-600">
          {game.coinsRecharged.toLocaleString()}
        </span>
      </div>

      <div className="col-span-2 text-sm text-gray-700">
        <span className="text-[12px] text-gray-600">
          {game.lastRechargeDate || "—"}
        </span>
      </div>

      <div className="col-span-2 text-sm">
        <span
          className={`font-mono ${
            derivedNet < 0
              ? "text-green-700"
              : derivedNet > 0
              ? "text-red-700"
              : "text-gray-500"
          }`}
        >
          {totalCoinValue.toLocaleString()}
        </span>
      </div>

      <div className="col-span-2 text-sm flex items-center justify-end space-x-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold flex items-center ${pnlClass} w-24 justify-center`}
        >
          <PnlIcon size={14} className="mr-1" />
          {formatCurrency(derivedNet * coinValue)}
        </span>

        <button
          onClick={() => onEditStart(game.id)}
          className="p-1 text-indigo-500 hover:text-indigo-700 transition duration-150 rounded-full hover:bg-indigo-100"
          title="Edit recharge"
        >
          <Edit size={16} />
        </button>

        <button
          onClick={() => onResetRecharge(game.id)}
          className="p-1 text-amber-600 hover:text-amber-700 transition duration-150 rounded-full hover:bg-amber-100"
          title="Reset recharge"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={() => onDelete(game.id)}
          className="p-1 text-red-500 hover:text-red-700 transition duration-150 rounded-full hover:bg-red-100"
          title="Delete game"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default GameRow;
