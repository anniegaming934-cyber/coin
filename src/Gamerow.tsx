import React, { useState, FC } from "react";
import { TrendingUp, TrendingDown, Gamepad, Edit, Save, X } from "lucide-react";

// ===================================
// 1. TYPES & UTILS
// ===================================

export interface Game {
  id: number;
  name: string;
  coinsEarned: number;
  coinsSpent: number;
  coinsRecharged: number;
  lastRechargeDate?: string;
}

interface GameRowProps {
  game: Game;
  coinValue: number;
  isEditing: boolean;
  onEditStart: (id: number) => void;
  onUpdate: (
    id: number,
    spentChange: number,
    earnedChange: number,
    rechargeChange: number,
    rechargeDateISO?: string
  ) => void;
  onCancel: () => void;
  onDelete: (id: number) => void;
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

// ===================================
// 2. HEADER ROW (TABLE HEADER)
// ===================================

export const GameHeaderRow: FC = () => (
  <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-100 border-b border-gray-300 text-[11px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 rounded-t-lg">
    <div className="col-span-3">Game</div>
    <div className="col-span-2">Spent</div>
    <div className="col-span-2">Earned</div>
    <div className="col-span-2">Recharged</div>
    <div className="col-span-1">Net Flow</div>
    <div className="col-span-2 text-right">P&L / Actions</div>
  </div>
);

// ===================================
// 3. GAME ROW COMPONENT
// ===================================

const GameRow: FC<GameRowProps> = ({
  game,
  coinValue,
  isEditing,
  onEditStart,
  onUpdate,
  onCancel,
  onDelete,
}) => {
  // Use strings so fields can be truly empty
  const [spentStr, setSpentStr] = useState<string>("");
  const [earnedStr, setEarnedStr] = useState<string>("");
  const [rechargeStr, setRechargeStr] = useState<string>("");

  const [rechargeDateISO, setRechargeDateISO] = useState<string>(
    game.lastRechargeDate || toTodayISO()
  );

  // Derived metrics for display row
  const totalInflow = game.coinsEarned + game.coinsRecharged;
  const netCoinFlow = game.coinsSpent - totalInflow;
  const pnl = netCoinFlow * coinValue;
  const isProfit = pnl >= 0;

  const pnlClass = isProfit
    ? "text-emerald-600 bg-emerald-100"
    : "text-red-600 bg-red-100";
  const PnlIcon = isProfit ? TrendingUp : TrendingDown;

  const inputBox =
    "w-full p-2 text-sm border border-gray-700 rounded-md bg-[#0b1222] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  // helper to coerce to non-negative number ("" -> 0)
  const toNonNegNumber = (s: string) => {
    if (s === "" || s === undefined || s === null) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const handleLogTransaction = () => {
    const spent = toNonNegNumber(spentStr);
    const earned = toNonNegNumber(earnedStr);
    const recharge = toNonNegNumber(rechargeStr);

    // block only if any invalid (non-numeric or negative)
    if ([spent, earned, recharge].some((n) => !Number.isFinite(n))) return;

    const dateOrUndefined =
      recharge > 0 ? rechargeDateISO || toTodayISO() : undefined;

    onUpdate(game.id, spent, earned, recharge, dateOrUndefined);

    // reset fields and close modal
    setSpentStr("");
    setEarnedStr("");
    setRechargeStr("");
    onCancel();
  };

  const invalid =
    !Number.isFinite(toNonNegNumber(spentStr)) ||
    !Number.isFinite(toNonNegNumber(earnedStr)) ||
    !Number.isFinite(toNonNegNumber(rechargeStr));

  // ============================
  // EDIT MODE — DARK MODAL CARD
  // ============================
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

        {/* Centered Modal */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] text-gray-100 shadow-2xl">
            {/* ❌ Cross Button */}
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
              title="Close"
            >
              <X size={18} className="text-gray-300" />
            </button>

            {/* Icon */}
            <div className="flex justify-center -mt-6">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                <Gamepad className="text-indigo-400" size={20} />
              </div>
            </div>

            <div className="px-6 pt-6 pb-5 text-center">
              <h2 className="text-lg font-semibold">Log Daily Activity</h2>
              <p className="mt-1 text-sm text-gray-400">
                Update{" "}
                <span className="font-medium text-gray-200">{game.name}</span>{" "}
                coins for today. Add used, earned, and any recharge with date.
              </p>

              {/* Inputs */}
              <div className="mt-5 space-y-3 text-left">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Coins Used (Spent)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={spentStr}
                    onChange={(e) => setSpentStr(e.target.value)}
                    className={inputBox}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Coins Earned
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={earnedStr}
                    onChange={(e) => setEarnedStr(e.target.value)}
                    className={inputBox}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Coins Recharged
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rechargeStr}
                    onChange={(e) => setRechargeStr(e.target.value)}
                    className={inputBox}
                    placeholder="0 (can be empty)"
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
                  <p className="text-[11px] text-gray-500 mt-1">
                    Saved only if “Coins Recharged” &gt; 0.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={handleLogTransaction}
                  disabled={invalid}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition"
                >
                  <Save size={16} className="mr-2" />
                  Save changes
                </button>

                <button
                  onClick={onCancel}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/15 transition"
                >
                  <X size={16} className="mr-2" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // DISPLAY MODE — TABLE ROW
  // ============================
  return (
    <div className="grid grid-cols-12 gap-4 py-4 px-4 hover:bg-gray-50 transition duration-150 border-b border-gray-200">
      <div className="col-span-3 flex items-center space-x-3">
        <Gamepad size={20} className="text-indigo-500 hidden md:block" />
        <span className="font-semibold text-gray-800 truncate">
          {game.name}
        </span>
      </div>

      <div className="col-span-2 text-sm text-gray-700">
        <span className="font-mono text-red-600">
          {game.coinsSpent.toLocaleString()}
        </span>
      </div>

      <div className="col-span-2 text-sm text-gray-700">
        <span className="font-mono text-green-600">
          {game.coinsEarned.toLocaleString()}
        </span>
      </div>

      <div className="col-span-2 text-sm text-gray-700">
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-blue-600">
            {game.coinsRecharged.toLocaleString()}
          </span>
          {game.lastRechargeDate && (
            <span className="text-[11px] text-gray-500">
              Last: {game.lastRechargeDate}
            </span>
          )}
        </div>
      </div>

      <div className="col-span-1 text-sm">
        <span
          className={`font-mono ${
           game.coinsRecharged  - (game.coinsEarned + game.coinsSpent ) > 0
              ? "text-green-700"
              :game.coinsRecharged - (game.coinsEarned +  game.coinsSpent  ) < 0
              ? "text-red-700"
              : "text-gray-500"
          }`}
        >
          {(
            game.coinsSpent -
            ( game.coinsRecharged + game.coinsEarned )
          ).toLocaleString()}
        </span>
      </div>

      <div className="col-span-2 text-sm flex items-center justify-end space-x-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold flex items-center ${pnlClass} w-24 justify-center`}
        >
          <PnlIcon size={14} className="mr-1" />
          {formatCurrency(
            (game.coinsSpent - (game.coinsEarned + game.coinsRecharged)) *
              coinValue
          )}
        </span>
        <button
          onClick={() => onEditStart(game.id)}
          className="p-1 text-indigo-500 hover:text-indigo-700 transition duration-150 rounded-full hover:bg-indigo-100"
          title="Edit"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => onDelete(game.id)}
          className="p-1 text-red-500 hover:text-red-700 transition duration-150 rounded-full hover:bg-red-100"
          title="Delete Game"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default GameRow;
