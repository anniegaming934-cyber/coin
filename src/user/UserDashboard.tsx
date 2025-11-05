// src/UserDashboard.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import axios from "axios";

import Sidebar, { type SidebarSection } from "../admin/Sidebar";
import UserSessionBar from "./UserSessionBar";
import PaymentForm, { type PaymentMethod } from "../admin/Paymentform";
import PaymentHistory from "../admin/PaymentHistory";
import UserTable from "./UserTable";
import UserCharts from "./UserCharts";

import type { Game } from "../admin/Gamerow";

// -----------------------------
// Constants
// -----------------------------
const GAMES_API = "/api/games";
const PAY_API = "/api"; // /api/totals, /api/payments, /api/reset
const COIN_VALUE = 0.15;

interface UserDashboardProps {
  username: string;
  onLogout: () => void;
}

const UserDashboard: FC<UserDashboardProps> = ({ username, onLogout }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [activeSection, setActiveSection] =
    useState<SidebarSection>("overview");

  const [paymentTotals, setPaymentTotals] = useState({
    cashapp: 0,
    paypal: 0,
    chime: 0,
  });

  // -----------------------------
  // Load games from backend
  // -----------------------------
  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const { data } = await axios.get(GAMES_API);
      if (!Array.isArray(data)) {
        console.error("❌ Expected an array of games, got:", data);
        setGames([]);
        return;
      }
      setGames(data);
    } catch (error) {
      console.error("Failed to fetch games:", error);
      setGames([]);
    }
  };

  // -----------------------------
  // Payment handlers
  // -----------------------------
  const onRecharge = async ({
    amount,
    method,
    note,
    date,
  }: {
    amount: number;
    method: PaymentMethod;
    note?: string;
    date?: string;
  }) => {
    const { data } = await axios.post(`${PAY_API}/payments`, {
      amount,
      method,
      note,
      date,
    });
    setPaymentTotals(data.totals);
  };

  const onReset = async () => {
    const { data } = await axios.post(`${PAY_API}/reset`);
    setPaymentTotals(data.totals);
    return data.totals;
  };

  // -----------------------------
  // Render UI
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* LEFT: Sidebar */}
      <Sidebar
        active={activeSection}
        onChange={setActiveSection}
        onLogout={onLogout}
        username={username}
      />

      {/* RIGHT: Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top session bar */}
        <UserSessionBar username={username} onLogout={onLogout} />

        <header className="flex flex-wrap items-center gap-3 px-4 sm:px-8 py-4 border-b bg-white">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {activeSection === "overview" && "Game Dashboard"}
            {activeSection === "games" && "Games"}
            {activeSection === "charts" && "Charts"}
            {activeSection !== "overview" &&
              activeSection !== "games" &&
              activeSection !== "charts" &&
              "Dashboard"}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* OVERVIEW TAB – user summary */}
          {activeSection === "overview" && (
            <>
              {/* 💳 Payment section */}
              <div className="grid grid-cols-1 gap-6 mb-8">
                <PaymentForm
                  initialTotals={paymentTotals}
                  onTotalsChange={(t) => setPaymentTotals(t)}
                  onRecharge={onRecharge}
                  onReset={onReset}
                />
                <PaymentHistory apiBase={PAY_API} />
              </div>

              {/* 🧾 User Table */}
              <UserTable />
            </>
          )}

          {/* GAMES TAB – same table but editable or filtered */}
          {activeSection === "games" && (
            <div className="mt-4">
              <UserTable />
            </div>
          )}

          {/* CHARTS TAB – only charts here */}
          {activeSection === "charts" && (
            <div className="mt-4">
              <UserCharts games={games} coinValue={COIN_VALUE} />
            </div>
          )}

          {/* SETTINGS / FUTURE */}
          {activeSection !== "overview" &&
            activeSection !== "games" &&
            activeSection !== "charts" && (
              <div className="text-sm text-gray-600 mt-8">
                <p>More sections coming soon (settings, reports, etc.).</p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
