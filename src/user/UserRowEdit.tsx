// src/UserRowEdit.tsx
import React, { FC, useState } from "react";
import { Gamepad, Save, X } from "lucide-react";
import type { Game } from "../admin/Gamerow";

interface UserRowEditProps {
  game: Game;
  coinValue: number; // kept if you ever want to show P&L preview
  onSave: (
    id: number,
    spentChange: number, // redeem / spend extra
    earnedChange: number, // add winnings
    rechargeChange: number, // deposit / recharge
    totalCoinsAfter: number, // 👈 NEW
    rechargeDateISO?: string
  ) => void;
  onCancel: () => void;
}

const toTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const UserRowEdit: FC<UserRowEditProps> = ({
  game,
  coinValue, // not used yet
  onSave,
  onCancel,
}) => {
  const [spentChange, setSpentChange] = useState("0");
  const [earnedChange, setEarnedChange] = useState("0");
  const [rechargeChange, setRechargeChange] = useState("0");
  const [rechargeDate, setRechargeDate] = useState(
    game.lastRechargeDate || toTodayISO()
  );

  const resetForm = () => {
    setSpentChange("0");
    setEarnedChange("0");
    setRechargeChange("0");
    setRechargeDate(game.lastRechargeDate || toTodayISO());
  };

  const handleSave = () => {
    const spent = Number(spentChange) || 0;
    const earned = Number(earnedChange) || 0;
    const recharge = Number(rechargeChange) || 0;

    // If user didn’t change anything, just cancel edit
    if (spent === 0 && earned === 0 && recharge === 0) {
      onCancel();
      resetForm();
      return;
    }

    // 🔢 Compute new absolute totals for this game
    const newCoinsSpent = game.coinsSpent + spent;
    const newCoinsEarned = game.coinsEarned + earned;
    const newCoinsRecharged = game.coinsRecharged + recharge;

    // 🔢 Your rule: freeplay & deposit subtract, redeem adds
    // net = redeem - (freeplay + deposit)
    const rawTotal = newCoinsSpent - (newCoinsEarned + newCoinsRecharged);

    // store as positive totalCoins
    const totalCoinsAfter = Math.abs(rawTotal);

    onSave(
      game.id,
      spent,
      earned,
      recharge,
      totalCoinsAfter,
      recharge ? rechargeDate : undefined
    );

    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <tr className="bg-gray-50 border-b">
      <td className="px-4 py-3 align-top">
        <div className="font-semibold mb-1 flex items-center gap-2">
          <Gamepad className="w-4 h-4 text-gray-500" />
          {game.name}
        </div>
        <div className="text-xs text-gray-500">
          Current:
          <span className="ml-1">
            E {game.coinsEarned} / S {game.coinsSpent} / R {game.coinsRecharged}
          </span>
        </div>
      </td>

      <td colSpan={4} className="px-4 py-3 align-top">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Redeem / Spend */}
          <div className="p-3 rounded-lg border bg-white">
            <div className="font-semibold mb-1">Redeem / Spend</div>
            <p className="text-[11px] text-gray-500 mb-2">
              Use extra points from this game (coins going out).
            </p>
            <input
              type="number"
              min={0}
              value={spentChange}
              onChange={(e) => setSpentChange(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="0"
            />
          </div>

          {/* Add winnings */}
          <div className="p-3 rounded-lg border bg-white">
            <div className="font-semibold mb-1">Add Winnings</div>
            <p className="text-[11px] text-gray-500 mb-2">
              Add extra coins earned from this game.
            </p>
            <input
              type="number"
              min={0}
              value={earnedChange}
              onChange={(e) => setEarnedChange(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="0"
            />
          </div>

          {/* Deposit / Recharge */}
          <div className="p-3 rounded-lg border bg-white">
            <div className="font-semibold mb-1">Deposit / Recharge</div>
            <p className="text-[11px] text-gray-500 mb-2">
              Add coins you deposited into this game (optional date).
            </p>
            <input
              type="number"
              min={0}
              value={rechargeChange}
              onChange={(e) => setRechargeChange(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mb-2"
              placeholder="0"
            />

            <label className="text-[11px] text-gray-500 block mb-1">
              Recharge date
            </label>
            <input
              type="date"
              value={rechargeDate}
              onChange={(e) => setRechargeDate(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      </td>

      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
        <div className="flex flex-col gap-2 items-end">
          {/* Save */}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Save className="w-3 h-3" />
            Save
          </button>

          {/* Reset – only clears this form */}
          <button
            onClick={resetForm}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white"
          >
            Reset
          </button>

          {/* Cancel edit */}
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
};

export default UserRowEdit;
