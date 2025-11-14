// src/UserDashboard.tsx
import { useEffect, useState, type FC } from "react";
import { apiClient } from "../apiConfig";

import Sidebar, { type SidebarSection } from "../admin/Sidebar";
import UserSessionBar from "./UserSessionBar";
import PaymentHistory from "./PaymentHistory";
import UserTable from "./UserTable";
import UserCharts from "./UserCharts";

import type { Game } from "../admin/Gamerow";
import GameEntryForm from "./GameEntryForm";
import RecentEntriesTable, { GameEntry } from "./RecentEntriesTable";
import PaymentCombinedTable from "./PaymentCombinedTable";

// -----------------------------
// Constants
// -----------------------------
const GAMES_API = "/api/games";
const PAY_API = "/api"; // /api/payments/cashin, /api/payments/cashout, /api/reset, /api/totals
const COIN_VALUE = 0.15;
const GAME_ENTRIES_API = "/api/game-entries";
interface UserDashboardProps {
  username: string;
  onLogout: () => void;
}

const UserDashboard: FC<UserDashboardProps> = ({ username, onLogout }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [activeSection, setActiveSection] =
    useState<SidebarSection>("overview");
  const [recent, setRecent] = useState<GameEntry[]>([]);

  const [paymentTotals, setPaymentTotals] = useState({
    cashapp: 0,
    paypal: 0,
    chime: 0,
  });

  // -----------------------------
  // Load games + entries + payment totals
  // -----------------------------
  useEffect(() => {
    fetchGames();
    loadRecent();
    preloadTotals();
  }, []);

  const fetchGames = async () => {
    try {
      const { data } = await apiClient.get(GAMES_API);
      setGames(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch games:", error);
      setGames([]);
    }
  };

  const loadRecent = async () => {
    try {
      const { data } = await apiClient.get<GameEntry[]>(GAME_ENTRIES_API, {
        params: { username },
      });

      setRecent(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load recent entries:", err);
    }
  };

  const preloadTotals = async () => {
    try {
      const { data } = await apiClient.get(`${PAY_API}/totals`);
      if (data && typeof data === "object") {
        // expect { cashapp, paypal, chime }
        setPaymentTotals({
          cashapp: Number(data.cashapp) || 0,
          paypal: Number(data.paypal) || 0,
          chime: Number(data.chime) || 0,
        });
      }
    } catch (err) {
      console.warn("Could not preload totals:", err);
    }
  };

  // -----------------------------
  // Payment handlers (match PaymentForm props + backend)
  // -----------------------------
  const onRecharge = async ({
    amount,
    method,
    note,
    playerName,
    totalPaid,
    totalCashout,
    date,
    txType,
  }: {
    amount: number;
    method: PaymentMethod;
    note?: string;
    playerName?: string;
    totalPaid?: number;
    totalCashout?: number;
    date?: string;
    txType: TxType; // "cashin" | "cashout"
  }) => {
    const endpoint =
      txType === "cashout"
        ? `${PAY_API}/payments/cashout`
        : `${PAY_API}/payments/cashin`;

    // Client-side guard for better UX (backend also enforces this)
    if (txType === "cashout" && !playerName?.trim()) {
      throw new Error("Player name is required for cash out");
    }

    // Build payloads exactly as backend expects:
    // cashin:  { amount, method, note?, playerName?, date? }
    // cashout: { amount, method, playerName, totalPaid?, totalCashout?, date? }
    const payload: any = { amount, method, date };

    if (txType === "cashin") {
      if (note) payload.note = note;
      if (playerName?.trim()) payload.playerName = playerName.trim();
    } else {
      payload.playerName = playerName!.trim();
      if (totalPaid != null) payload.totalPaid = Number(totalPaid);
      if (totalCashout != null) payload.totalCashout = Number(totalCashout);
    }

    try {
      const { data } = await apiClient.post(endpoint, payload);
      // backend returns { ok, payment, totals }
      if (data?.totals) setPaymentTotals(data.totals);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit payment";
      throw new Error(msg);
    }
  };

  const onReset = async () => {
    try {
      const { data } = await apiClient.post(`${PAY_API}/reset`);
      if (data?.totals) {
        setPaymentTotals(data.totals);
        return data.totals;
      }
      return paymentTotals;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to reset totals";
      throw new Error(msg);
    }
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
            {activeSection === "depositRecord" && "Recent Game Entries"}
            {activeSection === "settings" && "Settings"}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* OVERVIEW TAB – entries + payments */}
          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-1 gap-6 mb-8">
                <GameEntryForm />
              </div>

              <div className="grid grid-cols-1 gap-6 mb-8">
                <PaymentCombinedTable />
              </div>
            </>
          )}

          {/* GAMES TAB – only games table */}
          {activeSection === "games" && (
            <div className="mt-4">
              {/* If your UserTable accepts username, pass it: <UserTable username={username} /> */}
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
              <PaymentHistory apiBase={PAY_API} />
            </div>
          )}

          {/* RECENT GAME ENTRIES */}
          {activeSection === "depositRecord" && (
            <div className="mt-4">
              <RecentEntriesTable
                recent={recent}
                onRefresh={loadRecent}
                title="Recent Game Entries"
              />
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
