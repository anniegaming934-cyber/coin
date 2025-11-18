// src/components/UserHistory.tsx
import React, { useEffect, useMemo, useState, type FC } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { apiClient } from "../apiConfig";
import { DataTable } from "../DataTable";

export interface UserHistoryProps {
  userId: string | null; // coming from AdminDashboard selectedUserId
}

interface LoginSessionRow {
  _id: string;
  username: string;
  signInAt?: string | null;
  signOutAt?: string | null;
}

interface GameEntryRow {
  _id: string;
  username: string;
  type: "deposit" | "freeplay" | "redeem" | string;
  method?: string;
  playerName?: string;
  playerTag?: string;
  gameName: string;
  amountBase?: number;
  amountFinal?: number;
  amount?: number;
  date?: string;
  createdAt?: string;
  note?: string;
}

interface GameSummaryResponse {
  username: string;
  totalDeposit: number;
  totalRedeem: number;
  totalFreeplay: number;
}

interface SalaryRow {
  _id: string;
  username: string;
  month: string; // "2025-11"
  totalSalary: number;
  daysAbsent?: number;
  paidSalary?: number;
  remainingSalary?: number;
  dueDate?: string;
  note?: string;
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
};

const fmtAmount = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getEntryAmount = (e: GameEntryRow): number => {
  if (typeof e.amountFinal === "number") return e.amountFinal;
  if (typeof e.amountBase === "number") return e.amountBase;
  if (typeof e.amount === "number") return e.amount;
  return 0;
};

const getDurationMinutes = (s: LoginSessionRow): number | null => {
  if (!s.signInAt || !s.signOutAt) return null;
  const start = new Date(s.signInAt).getTime();
  const end = new Date(s.signOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return (end - start) / (1000 * 60);
};

const UserHistory: FC<UserHistoryProps> = ({ userId }) => {
  const [sessions, setSessions] = useState<LoginSessionRow[]>([]);
  const [entries, setEntries] = useState<GameEntryRow[]>([]);
  const [summary, setSummary] = useState<GameSummaryResponse | null>(null);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      if (!userId) {
        setSessions([]);
        setEntries([]);
        setSummary(null);
        setSalaries([]);
        return;
      }

      setLoading(true);
      try {
        console.log("🔍 Loading user overview for:", userId);

        const [sessionsRes, summaryRes, entriesRes, salaryRes] =
          await Promise.all([
            apiClient.get<LoginSessionRow[]>("/api/logins", {
              params: { username: userId },
            }),
            apiClient.get<GameSummaryResponse>("/api/game-entries/summary", {
              params: { username: userId },
            }),
            apiClient.get<GameEntryRow[]>("/api/game-entries", {
              params: { username: userId, limit: 500 },
            }),
            apiClient
              .get<SalaryRow[]>("/api/salaries", {
                params: { username: userId },
              })
              .catch(() => ({ data: [] as SalaryRow[] })),
          ]);

        setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
        setSummary(summaryRes.data || null);
        setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
        setSalaries(Array.isArray(salaryRes.data) ? salaryRes.data : []);
      } catch (err) {
        console.error("Failed to load user overview:", err);
        setSessions([]);
        setSummary(null);
        setEntries([]);
        setSalaries([]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [userId]);

  const gameStats = useMemo(() => {
    const perGame: Record<
      string,
      {
        gameName: string;
        timesPlayed: number;
        totalAmount: number;
        depositAmount: number;
        redeemAmount: number;
        freeplayAmount: number;
      }
    > = {};

    entries.forEach((e) => {
      const name = e.gameName || "Unknown";
      const amt = getEntryAmount(e);

      if (!perGame[name]) {
        perGame[name] = {
          gameName: name,
          timesPlayed: 0,
          totalAmount: 0,
          depositAmount: 0,
          redeemAmount: 0,
          freeplayAmount: 0,
        };
      }

      perGame[name].timesPlayed += 1;
      perGame[name].totalAmount += amt;

      if (e.type === "deposit") perGame[name].depositAmount += amt;
      if (e.type === "redeem") perGame[name].redeemAmount += amt;
      if (e.type === "freeplay") perGame[name].freeplayAmount += amt;
    });

    return Object.values(perGame).sort((a, b) =>
      a.gameName.localeCompare(b.gameName)
    );
  }, [entries]);

  const totalCoinsUsed = useMemo(
    () => entries.reduce((sum, e) => sum + getEntryAmount(e), 0),
    [entries]
  );

  const totalSessions = sessions.length;
  const lastSignIn = sessions[0]?.signInAt || null;
  const lastSignOut = sessions[0]?.signOutAt || null;

  const salaryTotals = useMemo(() => {
    let totalSalary = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    salaries.forEach((s) => {
      const total = Number(s.totalSalary) || 0;
      const remaining = Number(s.remainingSalary) || 0;
      const paid =
        typeof s.paidSalary === "number"
          ? s.paidSalary
          : Math.max(0, total - remaining);

      totalSalary += total;
      totalPaid += paid;
      totalRemaining += remaining;
    });

    return { totalSalary, totalPaid, totalRemaining };
  }, [salaries]);

  const sessionColumns = useMemo<ColumnDef<LoginSessionRow, any>[]>(
    () => [
      {
        header: "Sign In",
        accessorKey: "signInAt",
        cell: ({ row }) => fmtDateTime(row.original.signInAt),
      },
      {
        header: "Sign Out",
        accessorKey: "signOutAt",
        cell: ({ row }) => fmtDateTime(row.original.signOutAt),
      },
      {
        id: "duration",
        header: "Duration (min)",
        cell: ({ row }) => {
          const mins = getDurationMinutes(row.original);
          return mins == null ? "-" : fmtAmount(mins);
        },
      },
    ],
    []
  );

  const gameStatColumns = useMemo<
    ColumnDef<(typeof gameStats)[number], any>[]
  >(
    () => [
      { header: "Game", accessorKey: "gameName" },
      { header: "# Entries", accessorKey: "timesPlayed" },
      {
        header: "Total Points",
        accessorKey: "totalAmount",
        cell: ({ row }) => fmtAmount(row.original.totalAmount),
      },
      {
        header: "Deposit",
        accessorKey: "depositAmount",
        cell: ({ row }) => fmtAmount(row.original.depositAmount),
      },
      {
        header: "Redeem",
        accessorKey: "redeemAmount",
        cell: ({ row }) => fmtAmount(row.original.redeemAmount),
      },
      {
        header: "Freeplay",
        accessorKey: "freeplayAmount",
        cell: ({ row }) => fmtAmount(row.original.freeplayAmount),
      },
    ],
    []
  );

  const entryColumns = useMemo<ColumnDef<GameEntryRow, any>[]>(
    () => [
      {
        header: "Date",
        accessorKey: "createdAt",
        cell: ({ row }) =>
          fmtDateTime(row.original.createdAt || row.original.date),
      },
      {
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => {
          const t = row.original.type;
          switch (t) {
            case "deposit":
              return "Deposit";
            case "freeplay":
              return "Freeplay";
            case "redeem":
              return "Redeem";
            default:
              return t || "-";
          }
        },
      },
      { header: "Game", accessorKey: "gameName" },
      {
        header: "Player",
        id: "player",
        cell: ({ row }) => {
          const { playerName, playerTag } = row.original;
          if (playerName && playerTag) return `${playerName} (${playerTag})`;
          if (playerName) return playerName;
          if (playerTag) return playerTag;
          return "-";
        },
      },
      {
        header: "Method",
        accessorKey: "method",
        cell: ({ row }) => row.original.method || "-",
      },
      {
        header: "Amount",
        id: "amount",
        cell: ({ row }) => fmtAmount(getEntryAmount(row.original)),
      },
      {
        header: "Note",
        accessorKey: "note",
        cell: ({ row }) => row.original.note || "-",
      },
    ],
    []
  );

  const salaryColumns = useMemo<ColumnDef<SalaryRow, any>[]>(
    () => [
      { header: "Month", accessorKey: "month" },
      {
        header: "Total Salary",
        accessorKey: "totalSalary",
        cell: ({ row }) => fmtAmount(Number(row.original.totalSalary || 0)),
      },
      {
        header: "Paid",
        id: "paid",
        cell: ({ row }) => {
          const s = row.original;
          const total = Number(s.totalSalary) || 0;
          const remaining = Number(s.remainingSalary) || 0;
          const paid =
            typeof s.paidSalary === "number"
              ? s.paidSalary
              : Math.max(0, total - remaining);
          return fmtAmount(paid);
        },
      },
      {
        header: "Remaining",
        accessorKey: "remainingSalary",
        cell: ({ row }) =>
          fmtAmount(Number(row.original.remainingSalary || 0)),
      },
      {
        header: "Due Date",
        accessorKey: "dueDate",
        cell: ({ row }) => fmtDate(row.original.dueDate),
      },
      {
        header: "Note",
        accessorKey: "note",
        cell: ({ row }) => row.original.note || "-",
      },
    ],
    []
  );

  const totalDeposit = summary?.totalDeposit || 0;
  const totalRedeem = summary?.totalRedeem || 0;
  const totalFreeplay = summary?.totalFreeplay || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          User Overview {userId ? `· ${userId}` : ""}
        </h1>
        <p className="text-sm text-gray-500">
          Sign-ins, salary, and game activity for this user.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Cash In (Deposit)</div>
          <div className="text-lg font-semibold">{fmtAmount(totalDeposit)}</div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Cash Out (Redeem)</div>
          <div className="text-lg font-semibold">{fmtAmount(totalRedeem)}</div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Freeplay</div>
          <div className="text-lg font-semibold">
            {fmtAmount(totalFreeplay)}
          </div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Total Points Used</div>
          <div className="text-lg font-semibold">
            {fmtAmount(totalCoinsUsed)}
          </div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Number of Games</div>
          <div className="text-lg font-semibold">{gameStats.length}</div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs text-gray-500">Sign-in Sessions</div>
          <div className="text-lg font-semibold">{totalSessions}</div>
        </div>
      </div>

      {/* Sessions table */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Sign-in Sessions</h2>
        <DataTable<LoginSessionRow, any>
          columns={sessionColumns}
          data={sessions}
          isLoading={loading}
          emptyMessage="No sessions for this user."
        />
      </div>

      {/* Per-game stats */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Game Usage by Game</h2>
        <DataTable<(typeof gameStats)[number], any>
          columns={gameStatColumns}
          data={gameStats}
          isLoading={loading}
          emptyMessage="No game entries for this user."
        />
      </div>

      {/* Raw entries */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">All Game Entries</h2>
        <DataTable<GameEntryRow, any>
          columns={entryColumns}
          data={entries}
          isLoading={loading}
          emptyMessage="No game entries for this user."
        />
      </div>

      {/* Salary rows */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Salary History</h2>
        <DataTable<SalaryRow, any>
          columns={salaryColumns}
          data={salaries}
          isLoading={loading}
          emptyMessage="No salary records for this user."
        />
      </div>
    </div>
  );
};

export default UserHistory;
