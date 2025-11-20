// src/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { apiClient } from "../apiConfig";
import GameRow from "./Gamerow"; // used ONLY for the modal when editing
import AddGameForm from "./Addgame";
import PaymentForm, { type PaymentFormProps } from "../user/Paymentform";
import PaymentHistory from "../user/PaymentHistory";
import Sidebar, { type SidebarSection } from "./Sidebar";
import UserAdminTable from "./UserAdminTable";
import UserHistory from "./AdminUserHistory";
import AdminUserActivityTable from "./AdminUserActivityTable";
import { DataTable } from "../DataTable";
import { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Gamepad,
} from "lucide-react";
import SalaryForm from "./SalaryForm";
import FacebookLeadForm from "../FacebookLeadForm";
import UserAllCashoutTable from "./UserALLCashout";
import GameLogins from "./GameLogin";
import ScheduleForm from "./ScheduleForm";

interface Game {
  id: number;
  name: string;
  coinsEarned: number; // redeem in your net calc
  coinsSpent: number; // freeplay+deposit in your net calc
  coinsRecharged: number; // editable
  lastRechargeDate?: string;

  // comes from /api/games aggregation
  totalCoins?: number; // net coin for that game (backend calc)
}

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}

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

  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const [paymentTotals, setPaymentTotals] = useState({
    cashapp: 0,
    paypal: 0,
    chime: 0,
  });

  const [signinCount, setSigninCount] = useState(0);

  // Summary from /api/game-entries/summary
  const [entrySummary, setEntrySummary] = useState({
    totalCoin: 0,
    totalFreeplay: 0,
    totalDeposit: 0,
    totalRedeem: 0,
    totalPendingRemainingPay: 0,
    totalPendingCount: 0,
    totalReduction: 0,
    totalExtraMoney: 0,
    revenueCashApp: 0,
    revenuePayPal: 0,
    revenueChime: 0,
    revenueVenmo: 0,
    totalRevenue: 0, // real money total from backend
  });

  // Month/year selection
  const now = new Date();

  // 🔹 Summary month/year/day (for /api/game-entries/summary)
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1); // 1-12
  const [summaryDay, setSummaryDay] = useState<number | null>(null); // null = all days in that month

  // 🔹 Games month/year (for /api/games)
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  // ---------------------------
  // Load payment totals + sign-ins once
  // ---------------------------
  useEffect(() => {
    fetchTotals();
    fetchSignins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Reload games when games year/month changes
  // ---------------------------
  useEffect(() => {
    fetchGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // ---------------------------
  // Reload summary when summary year/month/day changes
  // ---------------------------
  useEffect(() => {
    fetchGameEntrySummary(summaryYear, summaryMonth, summaryDay ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryYear, summaryMonth, summaryDay]);

  const fetchGames = async () => {
    try {
      const { data } = await apiClient.get<Game[]>(GAMES_API, {
        params: { year, month },
      });

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

  const fetchGameEntrySummary = async (
    year: number = summaryYear,
    month: number = summaryMonth,
    day?: number
  ) => {
    try {
      const params: any = { year, month };
      if (day && day > 0) {
        params.day = day;
      }

      const { data } = await apiClient.get("/api/game-entries/summary", {
        params,
      });
      setEntrySummary({
        totalCoin: Number(data.totalCoin) || 0,
        totalFreeplay: Number(data.totalFreeplay) || 0,
        totalDeposit: Number(data.totalDeposit) || 0,
        totalRedeem: Number(data.totalRedeem) || 0,
        totalPendingRemainingPay: Number(data.totalPendingRemainingPay) || 0,
        totalPendingCount: Number(data.totalPendingCount) || 0,
        totalReduction: Number(data.totalReduction) || 0,
        totalExtraMoney: Number(data.totalExtraMoney) || 0,
        revenueCashApp: Number(data.revenueCashApp) || 0,
        revenuePayPal: Number(data.revenuePayPal) || 0,
        revenueChime: Number(data.revenueChime) || 0,
        revenueVenmo: Number(data.revenueVenmo) || 0,
        totalRevenue: Number(data.totalRevenue) || 0,
      });
      console.log("summary data", data);
    } catch (err) {
      console.error("Failed to load game entry summary:", err);
    }
  };

  // ---------------------------
  // (Games table) stats only used for per-game P&L
  // ---------------------------
  const totalPaymentsUsd =
    (Number(paymentTotals.cashapp) || 0) +
    (Number(paymentTotals.paypal) || 0) +
    (Number(paymentTotals.chime) || 0);

  // Revenue (USD) from GameEntry deposits per method (backend already gives real money)
  const cashappDepositUsd = entrySummary.revenueCashApp;
  const paypalDepositUsd = entrySummary.revenuePayPal;
  const chimeDepositUsd = entrySummary.revenueChime;
  const venmoDepositUsd = entrySummary.revenueVenmo;

  // Total deposit revenue from GameEntry (all methods) in USD
  const totalDepositRevenueUsd = entrySummary.totalRevenue;

  // Total Coin (all Game Entries) from /api/games (sum of totalCoins)
  const totalGameEntriesNet = useMemo(
    () =>
      games.reduce((sum, g) => {
        return sum + (g.totalCoins ?? 0);
      }, 0),
    [games]
  );

  // Absolute points for display (like per-game)
  const totalGameEntriesCoin = Math.abs(totalGameEntriesNet);

  // ---------------------------
  // Game mutations (from GameRow modal)
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
      lastRechargeDate?: string | null;
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
          lastRechargeDate: updated.lastRechargeDate ?? null,
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

  const handleResetRecharge = async (id: number) => {
    try {
      try {
        await apiClient.post(`${GAMES_API}/${id}/reset-recharge`);
      } catch {
        await apiClient.put(`${GAMES_API}/${id}`, {
          coinsRecharged: 0,
          lastRechargeDate: null,
        });
      }
      setGames((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, coinsRecharged: 0, lastRechargeDate: undefined }
            : g
        )
      );
    } catch (e) {
      console.error("Failed to reset recharge:", e);
    }
  };

  // ---------------------------
  // Payments (cashin / cashout separate)
  // ---------------------------
  const onRecharge: PaymentFormProps["onRecharge"] = async (payload) => {
    if (!payload) return;

    const { txType, note, playerName, date, ...rest } = payload;

    if (txType === "cashout") {
      const { data } = await apiClient.post(`${PAY_API}/payments/cashout`, {
        ...rest,
        playerName,
        date,
      });
      setPaymentTotals(data.totals);
    } else {
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
  // DataTable columns for Games
  // ---------------------------
  const gameColumns = useMemo<ColumnDef<Game>[]>(() => {
    return [
      {
        header: "Game",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Gamepad size={18} className="text-indigo-500 hidden md:block" />
            <span className="font-medium text-gray-800">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        header: "Coin Recharged",
        accessorKey: "coinsRecharged",
        cell: ({ getValue }) => (
          <span className="font-mono text-blue-700">
            {Number(getValue() ?? 0).toLocaleString()}
          </span>
        ),
      },
      {
        header: "Recharge Date",
        accessorKey: "lastRechargeDate",
        cell: ({ getValue }) => (
          <span className="text-xs text-gray-600">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        header: "Total coin (per game net)",
        id: "totalCoin",
        cell: ({ row }) => {
          const g = row.original;

          // Prefer backend totalCoins, otherwise fall back to derived
          const derivedNet =
            g.totalCoins ?? g.coinsEarned - (g.coinsSpent + g.coinsRecharged);

          const total = Math.abs(derivedNet);
          const cls =
            derivedNet < 0
              ? "text-green-700"
              : derivedNet > 0
              ? "text-red-700"
              : "text-gray-500";
          return (
            <span className={`font-mono ${cls}`}>{total.toLocaleString()}</span>
          );
        },
      },
      {
        header: "P&L",
        id: "pnl",
        cell: ({ row }) => {
          const g = row.original;

          const derivedNet =
            g.totalCoins ?? g.coinsEarned - (g.coinsSpent + g.coinsRecharged);

          const pnl = derivedNet * COIN_VALUE;
          const pos = pnl >= 0;
          const Icon = pos ? TrendingUp : TrendingDown;
          return (
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold inline-flex items-center ${
                pos
                  ? "text-emerald-700 bg-emerald-100"
                  : "text-red-700 bg-red-100"
              }`}
            >
              <Icon size={14} className="mr-1" />
              {pnl.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
          );
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditingGameId(row.original.id)}
              className="p-1 text-indigo-600 hover:text-indigo-800 rounded hover:bg-indigo-100"
              title="Edit recharge"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => handleResetRecharge(row.original.id)}
              className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100"
              title="Reset recharge"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => handleDelete(row.original.id)}
              className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-100"
              title="Delete game"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  const editingGame = useMemo(
    () => games.find((g) => g.id === editingGameId) || null,
    [games, editingGameId]
  );

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
            {activeSection === "playerinfo" && "Player Info"}
            {activeSection === "UserAdminTable" && "User Admin"}
            {activeSection === "userHistroy" && "User History"}
            {activeSection === "employeeSalary" && "Employee Salary"}
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
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Summary ({summaryYear}-
                      {String(summaryMonth).padStart(2, "0")}
                      {summaryDay
                        ? `-${String(summaryDay).padStart(2, "0")}`
                        : ""}
                      )
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      Showing game entries for selected{" "}
                      {summaryDay ? "day" : "month"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Summary month selector */}
                    <select
                      className="border text-xs rounded px-2 py-1 bg-white"
                      value={summaryMonth}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setSummaryMonth(m);
                        // keep games in sync with summary
                        setMonth(m);
                      }}
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>

                    {/* Summary day selector */}
                    <select
                      className="border text-xs rounded px-2 py-1 bg-white"
                      value={summaryDay ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSummaryDay(val === "" ? null : Number(val));
                      }}
                    >
                      <option value="">All Days</option>
                      {Array.from({ length: 31 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>

                    {/* Summary year input */}
                    <input
                      type="number"
                      className="border text-xs rounded px-2 py-1 w-20 bg-white"
                      value={summaryYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setSummaryYear(y);
                        // keep games in sync with summary
                        setYear(y);
                      }}
                    />

                    <button
                      onClick={() => {
                        fetchTotals();
                        fetchSignins();
                        fetchGameEntrySummary(
                          summaryYear,
                          summaryMonth,
                          summaryDay ?? undefined
                        );
                        fetchGames();
                      }}
                      className="text-xs px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Refresh
                    </button>
                  </div>
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
                      {/* Sign-ins */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Sign-ins ({username})
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {signinCount}
                        </td>
                      </tr>

                      {/* All coin from /api/games (sum of totalCoins) */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Coin (all Game Entries)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-indigo-600">
                          {totalGameEntriesCoin.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({formatCurrency(totalGameEntriesCoin * COIN_VALUE)}
                            )
                          </span>
                        </td>
                      </tr>

                      {/* Coin breakdown from GameEntry summary */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Deposit (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-indigo-600">
                          {entrySummary.totalDeposit.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            (
                            {formatCurrency(
                              entrySummary.totalDeposit * COIN_VALUE
                            )}
                            )
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Freeplay (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                          {entrySummary.totalFreeplay.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            (
                            {formatCurrency(
                              entrySummary.totalFreeplay * COIN_VALUE
                            )}
                            )
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Redeem (coins)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600">
                          {entrySummary.totalRedeem.toLocaleString()}{" "}
                          <span className="ml-1 text-[11px] text-slate-400">
                            (
                            {formatCurrency(
                              entrySummary.totalRedeem * COIN_VALUE
                            )}
                            )
                          </span>
                        </td>
                      </tr>

                      {/* Pending remaining pay */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Pending Remaining Pay (player tags)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-600">
                          {entrySummary.totalPendingRemainingPay.toFixed(2)}
                        </td>
                      </tr>

                      {/* Pending entries count */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Pending Entries Count
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-700">
                          {entrySummary.totalPendingCount}
                        </td>
                      </tr>

                      {/* Per-method deposit revenue (from GameEntry) */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (CashApp)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(cashappDepositUsd)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (PayPal)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(paypalDepositUsd)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (Chime)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(chimeDepositUsd)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (Venmo)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(venmoDepositUsd)}
                        </td>
                      </tr>

                      {/* Total revenue from deposits */}
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Total Deposit Revenue (USD)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {formatCurrency(totalDepositRevenueUsd)}
                          <span className="ml-1 text-[11px] text-slate-400">
                            (from Game Entries)
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin user activity */}
              <div className="mb-8">
                <AdminUserActivityTable />
              </div>
              <div className="mb-8">
                <UserAllCashoutTable />
              </div>
            </>
          )}

          {/* GAMES TAB */}
          {activeSection === "games" && (
            <>
              <div className="mb-6">
                <AddGameForm onGameAdded={fetchGames} />
              </div>

              {/* Games month/year controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-700">Games Period:</span>
                  <select
                    className="border text-xs rounded px-2 py-1 bg-white"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    className="border text-xs rounded px-2 py-1 w-20 bg-white"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                </div>

                <button
                  onClick={fetchGames}
                  className="text-xs px-3 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Refresh Games
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white p-2">
                <DataTable columns={gameColumns} data={games} />
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

          {/* PLAYER INFO TAB */}
          {activeSection === "playerinfo" && <FacebookLeadForm />}

          {/* USER ADMIN TAB */}
          {activeSection === "UserAdminTable" && (
            <UserAdminTable
              onViewHistory={(usernameForHistory: string) => {
                setSelectedUsername(usernameForHistory);
                setActiveSection("userHistroy");
              }}
            />
          )}

          {/* USER HISTORY TAB */}
          {activeSection === "userHistroy" && (
            <>
              {!selectedUsername && (
                <div className="mb-4 text-sm text-gray-600">
                  Please select a user from{" "}
                  <span className="font-semibold">User Admin</span> to view
                  their activity history.
                </div>
              )}
              {selectedUsername && <UserHistory username={selectedUsername} />}
            </>
          )}

          {/* EMPLOYEE SALARY TAB */}
          {activeSection === "employeeSalary" && <SalaryForm />}
          {activeSection === "gameLogins" && <GameLogins />}
          {activeSection === "schedule" && <ScheduleForm />}

          {/* SETTINGS TAB */}
          {activeSection === "settings" && (
            <div className="text-sm text-gray-600">
              <p>Settings coming soon (coin value, theme, etc.).</p>
            </div>
          )}
        </main>
      </div>

      {/* Editing modal for a single game */}
      {editingGame && (
        <GameRow
          key={editingGame.id}
          game={editingGame}
          coinValue={COIN_VALUE}
          isEditing={true}
          onEditStart={() => {}}
          onUpdate={(
            id,
            _spent,
            _earned,
            rechargeChange,
            _totalCoinsAfter,
            rechargeDateISO
          ) => {
            handleUpdate(id, 0, 0, rechargeChange, rechargeDateISO);
          }}
          onCancel={() => setEditingGameId(null)}
          onDelete={() => {}}
          onResetRecharge={handleResetRecharge}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
