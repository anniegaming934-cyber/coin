import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../apiConfig";
import RecentEntriesTable, {
  type GameEntry,
  type EntryType,
} from "./RecentEntriesTable";

const types: EntryType[] = ["freeplay", "deposit", "redeem", "bonus"];

const GameEntryForm: React.FC = () => {
  const [type, setType] = useState<EntryType>("deposit");
  const [playerName, setPlayerName] = useState("");
  const [gameName, setGameName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd

  // NEW: bonus controls
  const [bonusRate, setBonusRate] = useState<number>(10); // %
  const baseAmount = amount === "" ? 0 : Number(amount);
  const bonus = useMemo(() => {
    if (Number.isNaN(baseAmount) || baseAmount <= 0) return 0;
    // apply to all except redeem
    if (type === "redeem") return 0;
    return (baseAmount * bonusRate) / 100;
  }, [baseAmount, bonusRate, type]);

  const amountAfterBonus = useMemo(() => {
    if (type === "redeem") return baseAmount; // no bonus on redeem
    return baseAmount + bonus;
  }, [baseAmount, bonus, type]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [recent, setRecent] = useState<GameEntry[]>([]);

  async function loadRecent(player?: string) {
    try {
      const q = player ? `?playerName=${encodeURIComponent(player)}` : "";
      const { data } = await apiClient.get<GameEntry[]>(`api/game-entries${q}`);
      setRecent(data);
    } catch (err: any) {
      console.error("Load recent failed:", err?.response?.data || err.message);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !!type &&
      !!playerName.trim() &&
      amount !== "" &&
      !Number.isNaN(Number(amount)) &&
      Number(amount) >= 0
    );
  }, [type, playerName, amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!canSubmit) {
      setError("Please fill all required fields correctly.");
      return;
    }

    // Decide what we save as "amount":
    // - For redeem: save baseAmount
    // - For deposit/freeplay/bonus: save amountAfterBonus
    const amountToSave = type === "redeem" ? baseAmount : amountAfterBonus;

    setSaving(true);
    try {
      await apiClient.post("api/game-entries", {
        type,
        playerName: playerName.trim(),
        gameName: gameName.trim(),
        amount: Number(amountToSave),
        note: note.trim(),
        date: date ? new Date(date).toISOString() : undefined,
      });

      setOk("Saved!");
      setAmount("");
      setNote("");
      // Keep the same player filter when refreshing
      loadRecent(playerName.trim());
    } catch (err: any) {
      console.error("Save failed:", err?.response?.data || err.message);
      setError(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="w-full rounded-2xl border p-4 md:p-6 shadow-sm bg-white">
        <h2 className="text-lg font-semibold mb-4">Add Game Entry</h2>

        {/* Full-width form; 4 cols on md+ */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {/* Type */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EntryType)}
              className="w-full rounded-lg border px-3 py-2"
              required
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Player Name */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Player Name
            </label>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. John"
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          {/* Game Name */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Game Name</label>
            <input
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Rummy"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* Amount (base) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Base Amount
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          {/* Bonus Rate (%) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Bonus (%)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={bonusRate}
              onChange={(e) => setBonusRate(Number(e.target.value) || 0)}
              className="w-full rounded-lg border px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Applied to all types except Redeem.
            </p>
          </div>

          {/* Calculated Bonus (read-only) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Calculated Bonus
            </label>
            <input
              value={
                bonus.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) || "0.00"
              }
              readOnly
              className="w-full rounded-lg border px-3 py-2 bg-gray-50"
            />
          </div>

          {/* Amount After Bonus (read-only) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Amount After Bonus
            </label>
            <input
              value={
                amountAfterBonus.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) || "0.00"
              }
              readOnly
              className="w-full rounded-lg border px-3 py-2 bg-gray-50"
            />
          </div>

          {/* Date (optional) */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* Note */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional note"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="md:col-span-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50 w-full md:w-auto"
            >
              {saving ? "Saving..." : "Save Entry"}
            </button>
            {ok && <span className="text-green-600 text-sm">{ok}</span>}
            {error && <span className="text-red-600 text-sm">{error}</span>}
          </div>
        </form>
      </div>

      {/* Recent table (now a separate component) */}
    </div>
  );
};

export default GameEntryForm;
