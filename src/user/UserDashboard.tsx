// src/UserDashboard.tsx
import { useEffect, useState, type FC } from "react";
import { apiClient } from "../apiConfig"; // <- our axios instance

import Sidebar, { type SidebarSection } from "../admin/Sidebar";
import UserSessionBar from "./UserSessionBar";
import PaymentForm, {
  type PaymentMethod,
  type TxType,
} from "../admin/Paymentform";
import PaymentHistory from "../admin/PaymentHistory";
import UserTable from "./UserTable";
import UserCharts from "./UserCharts";

import type { Game } from "../admin/Gamerow";
import GameEntryForm from "./GameEntryForm";
import RecentEntriesTable from "./RecentEntriesTable";

// -----------------------------
// Constants
// -----------------------------
const GAMES_API = "/api/games";
const PAY_API = "/api"; // /api/payments/cashin, /api/payments/cashout, /api/reset
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
      const { data } = await apiClient.get(GAMES_API);
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
  // Payment handlers (match backend)
  // -----------------------------
  const onRecharge = async ({
    amount,
    method,
    note,
    playerName,
    date,
    txType,
  }: {
    amount: number;
    method: PaymentMethod;
    note?: string;
    playerName?: string;
    date?: string;
    txType: TxType; // "cashin" | "cashout"
  }) => {
    // Decide endpoint based on txType
    const endpoint =
      txType === "cashout"
        ? `${PAY_API}/payments/cashout`
        : `${PAY_API}/payments/cashin`;

    // Backend expects:
    // - cashin: { amount, method, note?, date? }
    // - cashout: { amount, method, playerName, date? }
    const payload: any = {
      amount,
      method,
      date,
    };

    if (txType === "cashout") {
      payload.playerName = playerName;
    } else {
      payload.note = note;
    }

    const { data } = await apiClient.post(endpoint, payload);
    // backend returns { ok, payment, totals }
    setPaymentTotals(data.totals);
  };

  const onReset = async () => {
    const { data } = await apiClient.post(`${PAY_API}/reset`);
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
        mode="user"
        active={activeSection}
        onChange={setActiveSection}
        onLogout={onLogout}
        username={username}
      />

      {/* RIGHT: Main area */}
      <div className="flex-1 flex flex-col">
        <UserSessionBar username={username} onLogout={onLogout} />

        <header className="flex flex-wrap items-center gap-3 px-4 sm:px-8 py-4 border-b bg-white">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {activeSection === "overview" && "Overview"}
            {activeSection === "games" && "Games"}
            {activeSection === "charts" && "Charts"}
            {activeSection === "paymentsHistory" && "Payment History"}
            {activeSection === "settings" && "Settings"}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* OVERVIEW TAB – payments + table */}
          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-1 gap-6 mb-8">
                <GameEntryForm />
              </div>
              <div className="grid grid-cols-1 gap-6 mb-8">
                <PaymentForm
                  initialTotals={paymentTotals}
                  onTotalsChange={(t) => setPaymentTotals(t)}
                  onRecharge={onRecharge}
                  onReset={onReset}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 mb-8"></div>
            </>
          )}

          {/* GAMES TAB – only games table */}
          {activeSection === "games" && (
            <div className="mt-4">
              <UserTable mode="user" />
            </div>
          )}

          {/* CHARTS TAB */}
          {activeSection === "charts" && (
            <div className="mt-4">
              <UserCharts games={games} coinValue={COIN_VALUE} />
            </div>
          )}

          {/* PAYMENTS HISTORY TAB */}
          {activeSection === "paymentsHistory" && (
            <div className="mt-4">
              {/* PaymentHistory likely does its own GET /api/payments etc. */}
              <PaymentHistory apiBase={PAY_API} />
            </div>
          )}

          {/* SETTINGS */}
          {activeSection === "settings" && (
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
