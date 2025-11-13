import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../apiConfig";
import { type EntryType } from "./RecentEntriesTable";

const types: EntryType[] = ["freeplay", "deposit", "redeem"];
const methods = ["cashapp", "paypal", "chime", "venmo"] as const;
type PaymentMethod = (typeof methods)[number];

const GAMES_API_PATH = "/api/games"; // GET /api/games?q=...

function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const getToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const GameEntryForm: React.FC = () => {
  const [type, setType] = useState<EntryType>("deposit");
  const [isCashIn, setIsCashIn] = useState(true); // switch maps to deposit/redeem
  const [method, setMethod] = useState<PaymentMethod>("cashapp");

  const [playerName, setPlayerName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(getToday());
  const [bonusRate, setBonusRate] = useState<number>(10);

  // ===== multiple game selection =====
  const [selectedGames, setSelectedGames] = useState<string[]>([]); // chips
  const [amountsByGame, setAmountsByGame] = useState<Record<string, string>>(
    {}
  );
  const [gameQuery, setGameQuery] = useState("");

  // cache names per type
  const [namesByType, setNamesByType] = useState<Record<EntryType, string[]>>({
    freeplay: [],
    deposit: [],
    redeem: [],
  });

  // autocomplete
  const debouncedGameQuery = useDebounce(gameQuery, 250);
  const [gameOptions, setGameOptions] = useState<string[]>([]);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const gameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // keep switch ↔ type in sync
  useEffect(() => {
    if (type === "freeplay") return; // show disabled, but do not flip state
    setIsCashIn(type === "deposit");
  }, [type]);

  function setFlow(cashin: boolean) {
    setIsCashIn(cashin);
    if (type !== "freeplay") {
      setType(cashin ? "deposit" : "redeem");
    }
  }

  // Prefetch names by type
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
        if (!cancelled) setNamesByType((old) => ({ ...old, [type]: unique }));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [type, namesByType]);

  // Suggestions on typing
  useEffect(() => {
    const q = debouncedGameQuery.trim();
    if (!q) {
      const cached = namesByType[type] || [];
      const available = cached.filter((n) => !selectedGames.includes(n));
      setGameOptions(available.slice(0, 10));
      setGamesOpen(available.length > 0);
      setHighlightIndex(available.length ? 0 : -1);
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
          names =
            typeof data[0] === "string"
              ? (data as string[])
              : (data as any[]).map((g) => g.name).filter(Boolean);
        }
        const local = namesByType[type] || [];
        const union = Array.from(new Set([...names, ...local]))
          .filter(
            (n) =>
              n.toLowerCase().includes(q.toLowerCase()) &&
              !selectedGames.includes(n)
          )
          .slice(0, 10);

        if (!cancelled) {
          setGameOptions(union);
          setGamesOpen(union.length > 0);
          setHighlightIndex(union.length ? 0 : -1);
        }
      } catch {
        const local = (namesByType[type] || [])
          .filter(
            (n) =>
              n.toLowerCase().includes(q.toLowerCase()) &&
              !selectedGames.includes(n)
          )
          .slice(0, 10);
        if (!cancelled) {
          setGameOptions(local);
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
  }, [debouncedGameQuery, type, namesByType, selectedGames]);

  // click-outside to close
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

  // ===== per-game amounts & bonus helpers =====
  const parseAmount = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const perGameCalc = useMemo(() => {
    return selectedGames.reduce((acc, g) => {
      const base = parseAmount(amountsByGame[g] || "");
      const bonus =
        type === "deposit" && base > 0 ? (base * bonusRate) / 100 : 0;
      const finalAmt = type === "deposit" ? base + bonus : base;
      acc[g] = { base, bonus, finalAmt };
      return acc;
    }, {} as Record<string, { base: number; bonus: number; finalAmt: number }>);
  }, [selectedGames, amountsByGame, bonusRate, type]);

  // --- Cashout totals ---
  const totalCashout = useMemo(() => {
    if (type !== "redeem") return 0;
    return selectedGames.reduce(
      (sum, g) => sum + (perGameCalc[g]?.finalAmt || 0),
      0
    );
  }, [type, selectedGames, perGameCalc]);

  const [totalPaidInput, setTotalPaidInput] = useState<string>(""); // user-provided
  const totalPaid = useMemo(
    () => Number(totalPaidInput) || 0,
    [totalPaidInput]
  );
  const remainingPay = useMemo(() => {
    if (type !== "redeem") return 0;
    const rem = totalPaid - totalCashout;
    return rem > 0 ? rem : 0; // floor at 0
  }, [type, totalPaid, totalCashout]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const needsMethod = true;
  const canSubmit = useMemo(() => {
    if (!playerName.trim()) return false;
    if (needsMethod && !method) return false;
    if (selectedGames.length === 0) return false;
    for (const g of selectedGames) {
      const base = parseAmount(amountsByGame[g] || "");
      if (!(base > 0)) return false;
    }
    if (type === "redeem" && !(totalPaid > 0)) return false; // need total paid on cashout
    return true;
  }, [
    playerName,
    needsMethod,
    method,
    selectedGames,
    amountsByGame,
    type,
    totalPaid,
  ]);

  // ===== token helpers =====
  function addGameToken(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (selectedGames.includes(name)) return;
    setSelectedGames((prev) => {
      const next = [...prev, name].sort((a, b) => a.localeCompare(b));
      return next;
    });
    setAmountsByGame((prev) => ({ ...prev, [name]: "" })); // initialize amount input
    setGameQuery("");
  }

  function removeGameToken(name: string) {
    setSelectedGames((prev) => prev.filter((g) => g !== name));
    setAmountsByGame((prev) => {
      const c = { ...prev };
      delete c[name];
      return c;
    });
  }

  function chooseGame(name: string) {
    addGameToken(name);
    setGamesOpen(false);
    setHighlightIndex(-1);
  }

  function onGameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addGameToken(gameQuery);
      return;
    }
    if (!gamesOpen || gameOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % gameOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(
        (i) => (i - 1 + gameOptions.length) % gameOptions.length
      );
    } else if (e.key === "Tab") {
      if (highlightIndex >= 0 && gameOptions[highlightIndex]) {
        e.preventDefault();
        chooseGame(gameOptions[highlightIndex]);
      }
    }
  }

  // Helper: apply first amount to all games
  function applyFirstToAll() {
    const first = selectedGames[0];
    if (!first) return;
    const val = amountsByGame[first] || "";
    const next: Record<string, string> = {};
    selectedGames.forEach((g) => (next[g] = val));
    setAmountsByGame(next);
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
      // POST one entry per selected game with its own amount
      await Promise.all(
        selectedGames.map((gname) => {
          const base = perGameCalc[gname]?.base ?? 0;
          const bonus = perGameCalc[gname]?.bonus ?? 0;
          const finalAmt = perGameCalc[gname]?.finalAmt ?? 0;

          return apiClient.post("api/game-entries", {
            type,
            method,
            playerName: playerName.trim(),
            gameName: gname,
            amount: Number(finalAmt),
            note: note.trim(),
            amountBase: Number(base),
            bonusRate: type === "deposit" ? Number(bonusRate) : 0,
            bonusAmount: Number(bonus),
            amountFinal: Number(finalAmt),
            date: date ? new Date(date).toISOString() : undefined,
            // 👇 cashout extras (for your backend to use/ignore as needed)
            totalPaid: type === "redeem" ? Number(totalPaid) : undefined,
            totalCashout: type === "redeem" ? Number(totalCashout) : undefined,
            remainingPay: type === "redeem" ? Number(remainingPay) : undefined,
          });
        })
      );

      // add to cache for current type
      if (selectedGames.length) {
        setNamesByType((old) => {
          const set = new Set([...(old[type] || []), ...selectedGames]);
          return {
            ...old,
            [type]: Array.from(set).sort((a, b) => a.localeCompare(b)),
          };
        });
      }

      // reset form
      setType("deposit");
      setFlow(true);
      setMethod("cashapp");
      setPlayerName("");
      setSelectedGames([]);
      setAmountsByGame({});
      setGameQuery("");
      setNote("");
      setDate(getToday());
      setBonusRate(10);
      setTotalPaidInput("");
      setOk(
        `Saved ${selectedGames.length} entr${
          selectedGames.length > 1 ? "ies" : "y"
        }!`
      );
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
              onChange={(e) => {
                const v = e.target.value as EntryType;
                setType(v);
                if (v !== "freeplay") setFlow(v === "deposit");
              }}
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

          {/* Method (only for money moves) */}
          {type !== "freeplay" && (
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border px-3 py-2"
                required
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cash Flow on the RIGHT side (always visible, disabled on freeplay) */}
          <div className="md:col-span-2 flex items-end md:justify-end">
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium mb-1">
                Cash Flow
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFlow(true)}
                  disabled={type === "freeplay"}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold transition
                    ${
                      isCashIn
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-white text-emerald-600 border-emerald-300"
                    }
                    ${
                      type === "freeplay" ? "opacity-50 cursor-not-allowed" : ""
                    }
                  `}
                >
                  Cash In
                </button>
                <button
                  type="button"
                  onClick={() => setFlow(false)}
                  disabled={type === "freeplay"}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold transition
                    ${
                      !isCashIn
                        ? "bg-red-500 text-white border-red-600"
                        : "bg-white text-red-600 border-red-300"
                    }
                    ${
                      type === "freeplay" ? "opacity-50 cursor-not-allowed" : ""
                    }
                  `}
                >
                  Cash Out
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Cash In = Deposit · Cash Out = Redeem
              </p>
            </div>
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

          {/* Game Names (chips + autocomplete) */}
          <div className="md:col-span-3" ref={dropdownRef}>
            <label className="block text-sm font-medium mb-1">
              Game Name(s)
            </label>

            {/* Chips */}
            {selectedGames.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedGames.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs bg-slate-100 border border-slate-200"
                  >
                    {g}
                    <button
                      type="button"
                      onClick={() => removeGameToken(g)}
                      className="text-slate-500 hover:text-slate-700"
                      aria-label={`Remove ${g}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="relative">
              <input
                ref={gameInputRef}
                value={gameQuery}
                onChange={(e) => {
                  setGameQuery(e.target.value);
                  setGamesOpen(true);
                }}
                onFocus={() => {
                  const cached = (namesByType[type] || []).filter(
                    (n) => !selectedGames.includes(n)
                  );
                  setGameOptions(cached.slice(0, 10));
                  setGamesOpen(cached.length > 0);
                }}
                onKeyDown={onGameKeyDown}
                placeholder="Type and press Enter or comma to add"
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
          </div>

          {/* Per-game Amounts (auto-expands) */}
          {selectedGames.length > 0 && (
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold">
                  Amounts per Game
                </label>
                <button
                  type="button"
                  onClick={applyFirstToAll}
                  className="text-sm underline"
                >
                  Apply first amount to all
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedGames.map((g) => {
                  const calc = perGameCalc[g] || {
                    base: 0,
                    bonus: 0,
                    finalAmt: 0,
                  };
                  return (
                    <div key={g} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">{g}</div>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => removeGameToken(g)}
                        >
                          Remove
                        </button>
                      </div>

                      <label className="block text-xs text-slate-600 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amountsByGame[g] ?? ""}
                        onChange={(e) =>
                          setAmountsByGame((prev) => ({
                            ...prev,
                            [g]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />

                      {type === "deposit" && (
                        <p className="text-[11px] text-slate-600 mt-2">
                          Bonus: {calc.bonus.toFixed(2)} · Final:{" "}
                          {calc.finalAmt.toFixed(2)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bonus only for deposit (global rate) */}
          {type === "deposit" && (
            <div className="md:col-span-2">
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
              <p className="text-[11px] text-slate-500 mt-1">
                Applied per game. Bonus = amount × rate / 100
              </p>
            </div>
          )}

          {/* Cashout totals (only on Redeem) */}
          {type === "redeem" && (
            <>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1">
                  Total Paid
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={totalPaidInput}
                  onChange={(e) => setTotalPaidInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1">
                  Total Cashout
                </label>
                <input
                  value={totalCashout.toFixed(2)}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 bg-gray-50"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1">
                  Remaining Pay
                </label>
                <input
                  value={remainingPay.toFixed(2)}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 bg-gray-50"
                />
              </div>
            </>
          )}

          {/* Date */}
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
