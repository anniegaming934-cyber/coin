// src/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { apiClient } from "../apiConfig";
import GameRow from "./Gamerow";
import AddGameForm from "./Addgame";
import PaymentForm, { type PaymentFormProps } from "../user/Paymentform";
import PaymentHistory from "../user/PaymentHistory";
import Sidebar, { type SidebarSection } from "./Sidebar";
import FacebookLeadForm from "../FacebookLeadForm";
import UserAdminTable from "./UserAdminTable";
import UserHistory from "./AdminUserHistory"; // ✅ accepts `userId` prop
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

interface Game {
  id: number;
  name: string;
  coinsEarned: number; // redeem in your net calc
  coinsSpent: number; // freeplay+deposit in your net calc
  coinsRecharged: number; // editable
  lastRechargeDate?: string;
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

  // 👉 this is the username we pass to UserHistory and backend APIs
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

  // total “coin records” = number of game rows
  const totalCoinRecords = games.length;

  const totalPaymentsUsd =
    (Number(paymentTotals.cashapp) || 0) +
    (Number(paymentTotals.paypal) || 0) +
    (Number(paymentTotals.chime) || 0);

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
        header: "Total coin",
        id: "totalCoin",
        cell: ({ row }) => {
          const g = row.original;
          const derivedNet = g.coinsEarned - (g.coinsSpent + g.coinsRecharged);
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
          const derivedNet = g.coinsEarned - (g.coinsSpent + g.coinsRecharged);
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
                          Total Coin Records
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {totalCoinRecords}
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
                          Revenue from Deposit (CashApp)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {formatCurrency(Number(paymentTotals.cashapp) || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (PayPal)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {formatCurrency(Number(paymentTotals.paypal) || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          Revenue from Deposit (Chime)
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {formatCurrency(Number(paymentTotals.chime) || 0)}
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

              {/* Admin user activity */}
              <div className="mb-8">
                <AdminUserActivityTable />
              </div>

              {/* Add game form */}
              <div className="mb-10 gap-6 mt-6">
                <AddGameForm onGameAdded={fetchGames} />
              </div>

              {/* Games list — DataTable */}
              <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white p-2">
                <DataTable columns={gameColumns} data={games} />
              </div>
            </>
          )}

          {/* GAMES TAB */}
          {activeSection === "games" && (
            <>
              <div className="mb-6">
                <AddGameForm onGameAdded={fetchGames} />
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
                setSelectedUserId(usernameForHistory); // ✅ store username here
                setActiveSection("userHistroy");
              }}
            />
          )}

          {/* USER HISTORY TAB */}
          {activeSection === "userHistroy" && (
            <>
              {!selectedUserId && (
                <div className="mb-4 text-sm text-gray-600">
                  Please select a user from{" "}
                  <span className="font-semibold">User Admin</span> to view
                  their activity history.
                </div>
              )}
              {selectedUserId && <UserHistory userId={selectedUserId} />}
            </>
          )}

          {/* EMPLOYEE SALARY TAB */}
          {activeSection === "employeeSalary" && <SalaryForm />}

          {/* SETTINGS TAB */}
          {activeSection === "settings" && (
            <div className="text-sm text-gray-600">
              <p>Settings coming soon (coin value, theme, etc.).</p>
            </div>
          )}
        </main>
      </div>

      {/* Render ONLY the editing modal (via your existing GameRow) */}
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
            // keep spent/earned as 0 (we only edit recharge+date)
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
