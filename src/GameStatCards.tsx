import React, { FC, useMemo, useState } from "react";
import { DollarSign, Coins, TrendingUp } from "lucide-react";

/* =========================
   1) TYPES
========================= */
type MetricKey = "revenue" | "coins" | "net";

interface GameStats {
  name: string;
  revenue: number;     // total sales based on coin flow
  coins: number;       // total coins transacted (spent + earned + recharged)
  net: number;         // profit/loss
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: {
    border: string; // border-top color
    text: string;   // icon/text accent
    bg: string;     // icon pill bg
  };
  isCurrency?: boolean;
  emphasizeNegative?: boolean; // style negatives in red/semibold
}

/* =========================
   2) HELPERS
========================= */
const formatCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const formatNumber = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/* =========================
   3) REUSABLE STAT CARD
========================= */
const StatCard: FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  isCurrency = false,
  emphasizeNegative = false,
}) => {
  const isNeg = value < 0 && emphasizeNegative;

  return (
    <div
      className="bg-white p-6 rounded-2xl shadow-md border-t-4 transition hover:shadow-lg"
      style={{ borderColor: color.border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm"
          style={{ backgroundColor: color.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: color.text }} />
        </div>

        <span className="text-gray-500 tracking-widest text-xs font-semibold select-none">
          {title.toUpperCase()}
        </span>
      </div>

      <div className="mt-4">
        <div
          className={`text-3xl font-extrabold ${
            isNeg ? "text-red-600" : "text-gray-900"
          }`}
        >
          {isCurrency ? formatCurrency(value) : formatNumber(value)}
        </div>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
    </div>
  );
};

/* =========================
   4) PAGE / WIDGET
========================= */
const initialGames: GameStats[] = [
  { name: "Sky Quest", revenue: 15420.5, coins: 185_340, net: -500.8 },
  { name: "Cat Arena", revenue: 8020.25, coins: 99_120, net: 1120.35 },
];

const palettes = {
  revenue: { border: "#0ea5a7", text: "#059669", bg: "rgba(16,185,129,0.12)" },   // teal/green
  coins:   { border: "#6366f1", text: "#4f46e5", bg: "rgba(99,102,241,0.12)" },   // indigo
  net:     { border: "#ef4444", text: "#ef4444", bg: "rgba(239,68,68,0.12)" },    // red
};

export const GameStatCards: FC = () => {
  const [games, setGames] = useState<GameStats[]>(initialGames);
  const [selected, setSelected] = useState<string>(initialGames[0].name);
  const [newGame, setNewGame] = useState("");

  const active = useMemo(
    () => games.find((g) => g.name === selected) ?? games[0],
    [games, selected]
  );

  const addGame = () => {
    const name = newGame.trim();
    if (!name) return;

    // demo randoms (replace with real data hookup)
    const revenue = +(Math.random() * 20000 + 1000).toFixed(2);
    const coins = Math.floor(Math.random() * 250000 + 25000);
    const net = +(revenue * (Math.random() * 0.4 - 0.2)).toFixed(2); // -20% .. +20%

    const entry: GameStats = { name, revenue, coins, net };
    setGames((prev) => [entry, ...prev]);
    setSelected(name);
    setNewGame("");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900">StatCard Demonstration</h1>

      {/* Game selector */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {games.map((g) => (
            <button
              key={g.name}
              onClick={() => setSelected(g.name)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                selected === g.name
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
              title={`Switch to ${g.name}`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto w-full sm:w-auto">
          <input
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            placeholder="Enter game name"
            className="flex-1 sm:w-72 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addGame}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Add Game
          </button>
        </div>
      </div>

      {/* Cards */}
      {active && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Revenue"
            value={active.revenue}
            subtitle="Total sales based on coin flow"
            icon={DollarSign}
            color={palettes.revenue}
            isCurrency
          />
          <StatCard
            title="Total Coins Transacted"
            value={active.coins}
            subtitle="Sum of all spent, earned, and recharged coins"
            icon={Coins}
            color={palettes.coins}
          />
          <StatCard
            title="Net Profit/Loss"
            value={active.net}
            subtitle={
              active.net < 0
                ? "Current financial standing (negative)"
                : "Current financial standing (positive)"
            }
            icon={TrendingUp}
            color={palettes.net}
            isCurrency
            emphasizeNegative
          />
        </div>
      )}
    </div>
  );
};

export default GameStatCards;
