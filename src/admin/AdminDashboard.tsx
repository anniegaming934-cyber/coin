// src/AdminDashboard.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { apiClient } from "../apiConfig";
import GameRow, { GameHeaderRow } from "./Gamerow";
import AddGameForm from "./Addgame";
import PaymentForm, {
  type PaymentMethod,
  type PaymentFormProps,
} from "./Paymentform";
import PaymentHistory from "./PaymentHistory";
import Sidebar, { type SidebarSection } from "./Sidebar";
import AdminLoginTable from "./AdminUserActivityTable"; // 👈 NEW
import UserAdminTable from "./UserAdminTable";
import FacebookLeadForm from "../FacebookLeadForm";

interface Game {
  id: number;
  name: string;
  coinsEarned: number;
  coinsSpent: number;
  coinsRecharged: number;
  lastRechargeDate?: string;
}

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}

type SidebarMode = "admin" | "user";

// API constants
const GAMES_API = "/api/games";
const PAY_API = "/api"; // /api/totals, /api/payments/*, /api/reset
const LOGINS_API = "/api/logins";
const COIN_VALUE = 0.15;

const AdminDashboard: FC<AdminDashboardProps> = ({ username, onLogout }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [activeSection, setActiveSection] =
    useState<SidebarSection>("overview");

  const [paymentTotals, setPaymentTotals] = useState({
    cashapp: 0,
    paypal: 0,
    chime: 0,
  });

  const [signinCount, setSigninCount] = useState(0);

  // ---------------------------
  // Load games + payment totals + sign-ins
  // ---------------------------
  useEffect(() => {
    fetchGames();
    fetchTotals();
    fetchSignins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchTotals = async () => {
    try {
      const { data } = await apiClient.get(`${PAY_API}/totals`);
      setPaymentTotals({
        cashapp: Number(data.cashapp) || 0,
        paypal: Number(data.paypal) || 0,
        chime: Number(data.chime) || 0,
      });
    } catch (e) {
      console.error("Failed to load payment totals:", e);
    }
  };

  const fetchSignins = async () => {
    try {
      const { data } = await apiClient.get(
        `${LOGINS_API}?username=${encodeURIComponent(username)}`
      );
      if (Array.isArray(data)) {
        setSigninCount(data.length);
      } else {
        setSigninCount(0);
      }
    } catch (e) {
      console.error("Failed to load sign-ins:", e);
      setSigninCount(0);
    }
  };

  // ---------------------------
  // Aggregated stats (all games)
  // ---------------------------
  const totalFreeplay = games.reduce(
    (sum, g) => sum + (Number(g.coinsEarned) || 0),
    0
  );
  const totalRedeem = games.reduce(
    (sum, g) => sum + (Number(g.coinsSpent) || 0),
    0
  );
  const totalDeposit = games.reduce(
    (sum, g) => sum + (Number(g.coinsRecharged) || 0),
    0
  );

  const totalPaymentsUsd =
    (Number(paymentTotals.cashapp) || 0) +
    (Number(paymentTotals.paypal) || 0) +
    (Number(paymentTotals.chime) || 0);

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
    let updatedTotals: {
      coinsSpent: number;
      coinsEarned: number;
      coinsRecharged: number;
    } | null = null;

    setGames((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;

        const updated = {
          ...g,
          coinsSpent: g.coinsSpent + spent,
          coinsEarned: g.coinsEarned + earned,
          coinsRecharged: g.coinsRecharged + recharge,
          lastRechargeDate:
            recharge > 0
              ? rechargeDateISO || new Date().toISOString().slice(0, 10)
              : g.lastRechargeDate,
        };

        updatedTotals = {
          coinsSpent: updated.coinsSpent,
          coinsEarned: updated.coinsEarned,
          coinsRecharged: updated.coinsRecharged,
        };

        return updated;
      })
    );

    if (updatedTotals) {
      apiClient
        .put(`${GAMES_API}/${id}`, updatedTotals)
        .catch((err) => console.error("Failed to persist game update:", err));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`${GAMES_API}/${id}`);
      await fetchGames();
    } catch (error) {
      console.error("Failed to delete game:", error);
    }
  };

  // ---------------------------
  // Payments (cashin / cashout separate)
  // ---------------------------
  const onRecharge: PaymentFormProps["onRecharge"] = async (payload) => {
    if (!payload) return;

    const { txType, note, playerName, date, ...rest } = payload;

    if (txType === "cashout") {
      // cash OUT endpoint
      const { data } = await apiClient.post(`${PAY_API}/payments/cashout`, {
        ...rest,
        playerName,
        date,
      });
      setPaymentTotals(data.totals);
    } else {
      // cash IN endpoint
      const { data } = await apiClient.post(`${PAY_API}/payments/cashin`, {
        ...rest,
        note,
        date,
      });
      setPaymentTotals(data.totals);
    }
  };

  const onReset: PaymentFormProps["onReset"] = async () => {
    const { data } = await apiClient.post(`${PAY_API}/reset`);
    setPaymentTotals(data.totals);
    return data.totals;
  };

  const formatCurrency = (amount: number): string =>
    amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* LEFT: Sidebar */}
      <Sidebar
        mode={"admin"}
        active={activeSection}
        onChange={setActiveSection}
        onLogout={onLogout}
        username={username}
      />

      {/* RIGHT: Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top header bar */}
        <header className="flex flex-wrap items-center gap-3 px-4 sm:px-8 py-4 border-b bg-white">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {activeSection === "overview" && "Admin Overview"}
            {activeSection === "games" && "Games"}

            {activeSection === "settings" && "Settings"}
          </h1>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* OVERVIEW TAB */}
          {activeSection === "overview" && (
            <>
              {/* Summary table */}
              <div className="w-full mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Summary
                  </h2>
                  <button
                    onClick={() => {
                      fetchGames();
                      fetchTotals();
                      fetchSignins();
                    }}
                    className="text-xs px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2 text-left">Metric</th>
                        <th className="px-4 py-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Sign-ins ({username})
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {signinCount}
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Deposit (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-indigo-600">
                          {totalDeposit.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({formatCurrency(totalDeposit * COIN_VALUE)})
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Freeplay (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                          {totalFreeplay.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({formatCurrency(totalFreeplay * COIN_VALUE)})
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Redeem (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600">
                          {totalRedeem.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({formatCurrency(totalRedeem * COIN_VALUE)})
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Payments (USD)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {formatCurrency(totalPaymentsUsd)}
                          <span className="ml-1 text-[11px] text-slate-400">
                            (CashApp + PayPal + Chime)
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 👇 NEW: Login history table for admin */}
              <div className="mb-8">
                <AdminLoginTable />
              </div>

              {/* Payments + games */}
              <div className="mb-10 gap-6 mt-6">
                <AddGameForm onGameAdded={fetchGames} />
              </div>

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
            </>
          )}

          {/* GAMES TAB */}
          {activeSection === "games" && (
            <>
              <div className="mb-6">
                <AddGameForm onGameAdded={fetchGames} />
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
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
            </>
          )}

          {/* PAYMENTS TAB */}
          {activeSection === "payments" && (
            <div className="grid grid-cols-1 gap-6">
              <PaymentForm
                initialTotals={paymentTotals}
                onTotalsChange={(t) => setPaymentTotals(t)}
                onRecharge={onRecharge}
                onReset={onReset}
              />
              <PaymentHistory apiBase={PAY_API} />
            </div>
          )}
          {activeSection === "playerinfo" && <FacebookLeadForm />}
          {activeSection === "UserAdminTable" && (
            <UserAdminTable apiBase="/api" />
          )}

          {/* SETTINGS TAB */}
          {activeSection === "settings" && (
            <div className="text-sm text-gray-600">
              <p>Settings coming soon (coin value, theme, etc.).</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
