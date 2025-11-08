// src/Sidebar.tsx
import type { FC } from "react";
import {
  LayoutDashboard,
  Gamepad2,
  Wallet,
  Settings,
  Coins,
  LogOut,
  User,
  BarChart2, // Charts icon
} from "lucide-react";

export type SidebarSection =
  | "overview"
  | "games"
  | "charts"
  | "UserAdminTable"
  | "userHistroy"
  | "paymentsHistory"
  | "settings";

interface SidebarProps {
  active: SidebarSection;
  onChange: (section: SidebarSection) => void;
  onLogout?: () => void;
  username?: string;
}

const Sidebar: FC<SidebarProps> = ({
  active,
  onChange,
  onLogout,
  username,
}) => {
  const links: {
    id: SidebarSection;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "charts", label: "Charts", icon: BarChart2 },
    { id: "UserAdminTable", label: "UserAdmin Table", icon: BarChart2 },
    { id: "userHistroy", label: "User Histroy", icon: BarChart2 },
    {
      id: "paymentsHistory",
      label: "Payment History",
      icon: Wallet,
    },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="h-screen w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl">
      {/* Brand / Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
        <div className="p-2 rounded-xl bg-slate-800">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Coin Tracker</h1>
          <p className="text-xs text-slate-400">Game coins dashboard</p>
        </div>
      </div>

      {/* User Info */}
      {username && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 bg-slate-800/40">
          <div className="p-2 rounded-lg bg-slate-700">
            <User className="w-4 h-4 text-slate-200" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">{username}</p>
            <p className="text-xs text-slate-400">Logged in</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
              ${
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="border-t border-slate-800 px-4 py-3 space-y-2">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/80 hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        )}
        <p className="text-[11px] text-slate-500 text-center">
          v1.0 • Local/Vercel
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
