import React, { FC, useEffect, useMemo, useState } from "react";
import { DollarSign, Coins, TrendingUp } from "lucide-react";
import StatCard from "./Statacard";
import GameRow, { GameHeaderRow } from "./Gamerow"; // header row
import AddGameForm from "./Addgame";
import PaymentForm from "./Paymentform";
import axios from "axios";

interface Game {
  id: number;
  name: string;
  coinsEarned: number;
  coinsSpent: number;
  coinsRecharged: number;
  lastRechargeDate?: string;
}

const GAMES_API = "http://localhost:5000/games";
const PAY_API = "http://localhost:5000"; // /totals, /payments, /reset
const COIN_VALUE = 0.05;

const App: FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // Totals for Cash App / PayPal / Chime
  const [paymentTotals, setPaymentTotals] = useState({
    cashapp: 0,
    paypal: 0,
    chime: 0,
  });

  // ---------------------------
  // Load games + payment totals
  // ---------------------------
  useEffect(() => {
    fetchGames();
    fetchTotals();
  }, []);

  const fetchGames = async () => {
    try {
      const { data } = await axios.get<Game[]>(GAMES_API);
      setGames(data);

      // Keep current selection if still present; else prefer "football"; else first
      setSelectedGameId((prev) => {
        if (prev && data.some((g) => g.id === prev)) return prev;
        const football = data.find(
          (g) => g.name?.trim().toLowerCase() === "football"
        );
        return football?.id ?? data[0]?.id ?? null;
      });
    } catch (error) {
      console.error("Failed to fetch games:", error);
    }
  };

  const fetchTotals = async () => {
    try {
      const { data } = await axios.get(`${PAY_API}/totals`);
      setPaymentTotals(data);
    } catch (e) {
      console.error("Failed to load payment totals:", e);
    }
  };

  // ---------------------------
  // Derived stats for selected game
  // ---------------------------
  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  const totals = useMemo(() => {
    if (!selectedGame)
      return { revenueUSD: 0, totalCoinsTransacted: 0, netUSD: 0 };

    const { coinsEarned, coinsSpent, coinsRecharged } = selectedGame;

    const revenueUSD = coinsRecharged * COIN_VALUE;
    const totalCoinsTransacted = coinsEarned + coinsSpent + coinsRecharged;
    const netCoins = coinsEarned + coinsRecharged - coinsSpent;
    const netUSD = netCoins * COIN_VALUE;

    return { revenueUSD, totalCoinsTransacted, netUSD };
  }, [selectedGame]);

  // ---------------------------
  // Game mutations (from GameRow)
  // ---------------------------
  const handleUpdate = (
    id: number,
    spent: number,
    earned: number,
    recharge: number,
    rechargeDateISO?: string
  ) => {
    // Optimistic local update; persist inside GameRow if desired
    setGames((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              coinsSpent: g.coinsSpent + spent,
              coinsEarned: g.coinsEarned + earned,
              coinsRecharged: g.coinsRecharged + recharge,
              lastRechargeDate:
                recharge > 0
                  ? rechargeDateISO || new Date().toISOString().slice(0, 10)
                  : g.lastRechargeDate,
            }
          : g
      )
    );
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${GAMES_API}/${id}`);
      if (id === selectedGameId) setSelectedGameId(null);
      await fetchGames();
    } catch (error) {
      console.error("Failed to delete game:", error);
    }
  };

  // ---------------------------
  // Payments (wired to backend)
  // ---------------------------
  const onRecharge = async ({
    amount,
    method,
    note,
  }: {
    amount: number;
    method: "cashapp" | "paypal" | "chime";
    note?: string;
  }) => {
    const { data } = await axios.post(`${PAY_API}/payments`, {
      amount,
      method,
      note,
    });
    setPaymentTotals(data.totals); // sync from server response
  };

  const onReset = async () => {
    const { data } = await axios.post(`${PAY_API}/reset`);
    setPaymentTotals(data.totals);
    return data.totals; // lets PaymentForm update immediately
  };

  const formatCurrency = (amount: number): string =>
    amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      {/* HEADER */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Game Dashboard</h1>

        {games.length > 0 && (
          <div className="ml-auto">
            <label className="mr-2 text-sm text-gray-600">Stats for:</label>
            <select
              value={selectedGameId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedGameId(v ? Number(v) : null);
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TOP STATCARDS (Game stats) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totals.revenueUSD)}
          icon={DollarSign}
          description="Total sales based on coin recharges"
          colorClass={{
            border: "rgb(5, 150, 105)",
            bg: "bg-emerald-100",
            text: "text-emerald-600",
          }}
        />

        <StatCard
          title="Total Coins Transacted"
          value={totals.totalCoinsTransacted.toLocaleString()}
          icon={Coins}
          description="Spent + Earned + Recharged"
          colorClass={{
            border: "rgb(79, 70, 229)",
            bg: "bg-indigo-100",
            text: "text-indigo-600",
          }}
        />

        <StatCard
          title="Net Profit/Loss"
          value={formatCurrency(totals.netUSD)}
          icon={TrendingUp}
          description={
            totals.netUSD < 0
              ? "Current financial standing (negative)"
              : "Current financial standing (positive)"
          }
          colorClass={{
            border: totals.netUSD < 0 ? "rgb(220, 38, 38)" : "rgb(5, 150, 105)",
            bg: totals.netUSD < 0 ? "bg-red-100" : "bg-emerald-100",
            text: totals.netUSD < 0 ? "text-red-600" : "text-emerald-600",
          }}
        />
      </div>

      {/* PAYMENT FORM */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <PaymentForm
          initialTotals={paymentTotals}
          onTotalsChange={(t) => setPaymentTotals(t)}
          onRecharge={onRecharge}
          onReset={onReset}
        />
      </div>

      {/* ADD GAME */}
      <div className="mb-10 gap-6 mt-6">
        <AddGameForm apiUrl={GAMES_API} onGameAdded={fetchGames} />
      </div>

      {/* GAME LIST (with header row) */}
      <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <GameHeaderRow />
        <div className="divide-y divide-gray-100">
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              coinValue={COIN_VALUE}
              isEditing={editingGameId === game.id}
              onEditStart={(id) => setEditingGameId(id)}
              onUpdate={handleUpdate}
              onCancel={() => setEditingGameId(null)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
