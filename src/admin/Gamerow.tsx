import React, { useState, type FC } from "react";
import { TrendingUp, TrendingDown, Gamepad, Edit, Save, X } from "lucide-react";

// ===================================
// 1. TYPES & UTILS
// ===================================

export interface Game {
  id: number;
  name: string;
  coinsSpent: number;       // 👈 freeplay + deposit total
  coinsEarned: number;      // 👈 redeem
  coinsRecharged: number;   // 👈 coin recharged (top-up)
  lastRechargeDate?: string;
  totalCoins?: number;      // optional, comes from backend
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
    totalCoinsAfter: number,
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
// 2. HEADER ROW
// ===================================

export const GameHeaderRow: FC = () => (
  <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-100 border-b border-gray-300 text-[11px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 rounded-t-lg">
    <div className="col-span-3">Game</div>
    <div className="col-span-2">Freeplay + Deposit</div>
    <div className="col-span-2">Redeem</div>
    <div className="col-span-2">Coin Recharged / Date</div>
    <div className="col-span-1">Total coin</div>
    <div className="col-span-2 text-right">P&amp;L / Actions</div>
  </div>
);

// ===================================
// 3. GAME ROW
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
  const [spentStr, setSpentStr] = useState<string>("");
  const [earnedStr, setEarnedStr] = useState<string>("");
  const [rechargeStr, setRechargeStr] = useState<string>("");

  const [rechargeDateISO, setRechargeDateISO] = useState<string>(
    game.lastRechargeDate || toTodayISO()
  );

  // 💰 Logic:
  // spent  = freeplay + deposit
  // earned = redeem
  // recharged = coin top-up
  // net = redeem - (freeplay + deposit + recharged)
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
    if (s === "" || s === undefined || s === null) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const handleLogTransaction = () => {
    const spent = toNonNegNumber(spentStr);      // freeplay + deposit (change)
    const earned = toNonNegNumber(earnedStr);    // redeem (change)
    const recharge = toNonNegNumber(rechargeStr);// coin recharged (change)

    if ([spent, earned, recharge].some((n) => !Number.isFinite(n))) return;

    const dateOrUndefined =
      recharge > 0 ? rechargeDateISO || toTodayISO() : undefined;

    const newCoinsSpent = game.coinsSpent + spent;
    const newCoinsEarned = game.coinsEarned + earned;
    const newCoinsRecharged = game.coinsRecharged + recharge;

    // net = redeem - (freeplay + deposit + recharged)
    const totalCoinsRaw =
      newCoinsEarned - (newCoinsSpent + newCoinsRecharged);

    const totalCoinsAfter = Math.abs(totalCoinsRaw);

    onUpdate(
      game.id,
      spent,
      earned,
      recharge,
      totalCoinsAfter,
      dateOrUndefined
    );

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
  // EDIT MODE — MODAL
  // ============================
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
              <h2 className="text-lg font-semibold">Log Daily Activity</h2>
              <p className="mt-1 text-sm text-gray-400">
                Update{" "}
                <span className="font-medium text-gray-200">{game.name}</span>{" "}
                coins for today. Set freeplay + deposit, redeem, and any
                coin recharge with date.
              </p>

              <div className="mt-5 space-y-3 text-left">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Freeplay + Deposit (Spent)
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
                    Redeem (Earned)
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
                    Coin Recharged
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
                    Saved only if “Coin Recharged” &gt; 0.
                  </p>
                </div>
              </div>

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

  const derivedNet =
    game.coinsEarned - (game.coinsSpent + game.coinsRecharged);

  const totalCoinValue =
    typeof game.totalCoins === "number"
      ? game.totalCoins
      : Math.abs(derivedNet);

  return (
    <div className="grid grid-cols-12 gap-4 py-4 px-4 hover:bg-gray-50 transition duration-150 border-b border-gray-200">
      <div className="col-span-3 flex items-center space-x-3">
        <Gamepad size={20} className="text-indigo-500 hidden md:block" />
        <span className="font-semibold text-gray-800 truncate">
          {game.name}
        </span>
      </div>

      {/* Spent = freeplay + deposit */}
      <div className="col-span-2 text-sm text-gray-700">
        <span className="font-mono text-red-600">
          {game.coinsSpent.toLocaleString()}
        </span>
      </div>

      {/* Earned = redeem */}
      <div className="col-span-2 text-sm text-gray-700">
        <span className="font-mono text-green-600">
          {game.coinsEarned.toLocaleString()}
        </span>
      </div>

      {/* Coin recharged + last recharge date */}
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

      {/* Total coin column */}
      <div className="col-span-1 text-sm">
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

      {/* P&L + actions */}
      <div className="col-span-2 text-sm flex items-center justify-end space-x-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold flex items-center ${pnlClass} w-24 justify-center`}
        >
          <PnlIcon size={14} className="mr-1" />
          {formatCurrency(
            (game.coinsEarned - (game.coinsSpent + game.coinsRecharged)) *
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
