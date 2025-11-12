import React from "react";

export type EntryType = "freeplay" | "deposit" | "redeem" | "bonus";

export interface GameEntry {
  _id: string;
  type: EntryType;
  playerName: string;
  gameName?: string;
  amount: number;
  note?: string;
  date?: string;
  createdAt: string;
}

interface RecentEntriesTableProps {
  recent: GameEntry[];
  onRefresh: () => void;
  title?: string;
}

const RecentEntriesTable: React.FC<RecentEntriesTableProps> = ({
  recent,
  onRefresh,
  title = "Recent Entries",
}) => {
  return (
    <div className="w-full rounded-2xl border p-4 md:p-6 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold">{title}</h3>
        <button onClick={onRefresh} className="text-sm underline">
          Refresh
        </button>
      </div>

      <div className="w-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2">Game</th>
              <th className="py-2 pr-2 text-right">Amount</th>
              <th className="py-2 pr-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r._id} className="border-b last:border-b-0">
                <td className="py-2 pr-2">
                  {new Date(r.date || r.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-2 capitalize">{r.type}</td>
                <td className="py-2 pr-2">{r.playerName}</td>
                <td className="py-2 pr-2">{r.gameName || "-"}</td>
                <td className="py-2 pr-2 text-right">
                  {r.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 pr-2">{r.note || "-"}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td className="py-4 text-gray-500" colSpan={6}>
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentEntriesTable;
