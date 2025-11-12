import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../apiConfig";
import { type EntryType } from "./RecentEntriesTable";

const types: EntryType[] = ["freeplay", "deposit", "redeem"];
const GAMES_API_PATH = "/api/games"; // GET /api/games?q=...

function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// 🔹 helper: returns today's date in yyyy-mm-dd
const getToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const GameEntryForm: React.FC = () => {
  const [type, setType] = useState<EntryType>("deposit");
  const [playerName, setPlayerName] = useState("");
  const [gameName, setGameName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(getToday()); // ✅ default to today
  const [bonusRate, setBonusRate] = useState<number>(10);

  // ---------- names cache per type ----------
  const [namesByType, setNamesByType] = useState<Record<EntryType, string[]>>({
    freeplay: [],
    deposit: [],
    redeem: [],
  });

  // ---------- Autocomplete state ----------
  const [gameQuery, setGameQuery] = useState("");
  const debouncedGameQuery = useDebounce(gameQuery, 250);
  const [gameOptions, setGameOptions] = useState<string[]>([]);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const gameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ---------- Prefetch names for the active type ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (namesByType[type]?.length) return;
      try {
        const { data } = await apiClient.get(GAMES_API_PATH, {
          params: { type },
        });
        const list: string[] = Array.isArray(data)
          ? typeof data[0] === "string"
            ? (data as string[])
            : (data as any[]).map((g) => String(g?.name || "")).filter(Boolean)
          : [];
        const unique = Array.from(new Set(list)).sort((a, b) =>
          a.localeCompare(b)
        );
        if (!cancelled) {
          setNamesByType((old) => ({ ...old, [type]: unique }));
        }
      } catch {
        // ignore prefetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, namesByType]);

  // ---------- Fetch suggestions on typing ----------
  useEffect(() => {
    const q = debouncedGameQuery.trim();

    if (!q) {
      const cached = namesByType[type] || [];
      setGameOptions(cached.slice(0, 10));
      setGamesOpen(cached.length > 0);
      setHighlightIndex(cached.length ? 0 : -1);
      return;
    }

    let cancelled = false;
    (async () => {
      setGamesLoading(true);
      setGamesError(null);
      try {
        const { data } = await apiClient.get<string[] | any[]>(GAMES_API_PATH, {
          params: { q, type },
        });

        let names: string[] = [];
        if (Array.isArray(data)) {
          if (typeof data[0] === "string") names = data;
          else names = (data as any[]).map((g) => g.name).filter(Boolean);
        }

        const local = namesByType[type] || [];
        const union = Array.from(new Set([...names, ...local]))
          .filter((n) => n.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 10);

        if (!cancelled) {
          setGameOptions(union);
          setGamesOpen(union.length > 0);
          setHighlightIndex(union.length ? 0 : -1);
        }
      } catch {
        const local = (namesByType[type] || []).filter((n) =>
          n.toLowerCase().includes(q.toLowerCase())
        );
        if (!cancelled) {
          setGameOptions(local.slice(0, 10));
          setGamesOpen(local.length > 0);
          setHighlightIndex(local.length ? 0 : -1);
        }
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedGameQuery, type, namesByType]);

  // click-outside to close the dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        gameInputRef.current &&
        !gameInputRef.current.contains(e.target as Node)
      ) {
        setGamesOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ----- amounts / bonus -----
  const baseAmount = amount === "" ? 0 : Number(amount);
  const bonus = useMemo(() => {
    if (Number.isNaN(baseAmount) || baseAmount <= 0) return 0;
    return type === "deposit" ? (baseAmount * bonusRate) / 100 : 0;
  }, [baseAmount, bonusRate, type]);

  const amountFinal = useMemo(() => {
    return type === "deposit" ? baseAmount + bonus : baseAmount;
  }, [baseAmount, bonus, type]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      !!type &&
      !!playerName.trim() &&
      amount !== "" &&
      !Number.isNaN(Number(amount)) &&
      Number(amount) > 0
    );
  }, [type, playerName, amount]);

  function chooseGame(name: string) {
    setGameName(name);
    setGameQuery(name);
    setGamesOpen(false);
    setHighlightIndex(-1);
  }

  function onGameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!gamesOpen || gameOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % gameOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(
        (i) => (i - 1 + gameOptions.length) % gameOptions.length
      );
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0) {
        e.preventDefault();
        chooseGame(gameOptions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setGamesOpen(false);
      setHighlightIndex(-1);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!canSubmit) {
      setError("Please fill all required fields correctly.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("api/game-entries", {
        type,
        playerName: playerName.trim(),
        gameName: gameName.trim(),
        amount: Number(amountFinal),
        note: note.trim(),
        amountBase: Number(baseAmount),
        bonusRate: type === "deposit" ? Number(bonusRate) : 0,
        bonusAmount: Number(bonus),
        amountFinal: Number(amountFinal),
        date: date ? new Date(date).toISOString() : undefined,
      });

      // ✅ add game name to local cache
      if (gameName.trim()) {
        setNamesByType((old) => {
          const set = new Set([...(old[type] || []), gameName.trim()]);
          return {
            ...old,
            [type]: Array.from(set).sort((a, b) => a.localeCompare(b)),
          };
        });
      }

      // ✅ reset form (and date = today)
      setType("deposit");
      setPlayerName("");
      setGameName("");
      setGameQuery("");
      setAmount("");
      setNote("");
      setDate(getToday()); // reset to today's date
      setBonusRate(10);
      setOk("Saved!");
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

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {/* Type */}
          <div>
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
          <div>
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

          {/* Game Name (with autocomplete) */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium mb-1">Game Name</label>
            <input
              ref={gameInputRef}
              value={gameQuery}
              onChange={(e) => {
                setGameQuery(e.target.value);
                setGameName(e.target.value);
                setGamesOpen(true);
              }}
              onFocus={() => {
                const cached = namesByType[type] || [];
                setGameOptions(cached.slice(0, 10));
                setGamesOpen(cached.length > 0);
              }}
              onKeyDown={onGameKeyDown}
              placeholder="e.g. Rummy"
              className="w-full rounded-lg border px-3 py-2"
            />
            {/* Dropdown */}
            {gamesOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">
                {gamesLoading && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Loading…
                  </div>
                )}
                {gamesError && (
                  <div className="px-3 py-2 text-sm text-red-600">
                    {gamesError}
                  </div>
                )}
                {!gamesLoading &&
                  !gamesError &&
                  gameOptions.map((opt, i) => (
                    <button
                      type="button"
                      key={opt + i}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                        i === highlightIndex ? "bg-gray-100" : ""
                      }`}
                      onMouseEnter={() => setHighlightIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        chooseGame(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
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

          {/* Bonus fields only for deposit */}
          {type === "deposit" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Bonus (%)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={bonusRate}
                  onChange={(e) => setBonusRate(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Bonus Amount
                </label>
                <input
                  value={bonus.toFixed(2)}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Final Amount
                </label>
                <input
                  value={amountFinal.toFixed(2)}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 bg-gray-50"
                />
              </div>
            </>
          )}

          {/* Date (defaults to today) */}
          <div>
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

          {/* Submit */}
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
    </div>
  );
};

export default GameEntryForm;
