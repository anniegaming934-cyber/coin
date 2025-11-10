// src/UserSessionBar.tsx
import React, { useEffect, useState } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";
import { apiClient } from "../apiConfig"; // ✅ shared axios client

interface UserSessionBarProps {
  username: string;
  onLogout: () => void;
}

// Backend routes (your backend provides these)
const LOGIN_API_BASE = "/api/logins";

const UserSessionBar: React.FC<UserSessionBarProps> = ({
  username,
  onLogout,
}) => {
  const [now, setNow] = useState(new Date());
  const [signInDateTime, setSignInDateTime] = useState<Date | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🕒 Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 📦 Load saved session
  useEffect(() => {
    const saved = localStorage.getItem("userSession");
    if (saved) {
      try {
        const { id, signInAt, user } = JSON.parse(saved);
        if (user === username && id && signInAt) {
          setSessionId(id);
          setSignInDateTime(new Date(signInAt));
          setIsSignedIn(true);
        }
      } catch {
        localStorage.removeItem("userSession");
      }
    }
  }, [username]);

  const formattedTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDateFull = now.toLocaleDateString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const signInTimeStr = signInDateTime
    ? signInDateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  const signInDateStr = signInDateTime
    ? signInDateTime.toLocaleDateString([], {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : null;

  // 🚀 Handle sign-in/sign-out toggle
  const handleToggle = async () => {
    try {
      setLoading(true);

      if (isSignedIn) {
        // 🔴 SIGN OUT
        if (sessionId) {
          await apiClient.post(`${LOGIN_API_BASE}/end`, {
            sessionId,
            signOutAt: new Date().toISOString(),
          });
        }

        setIsSignedIn(false);
        setSignInDateTime(null);
        setSessionId(null);
        localStorage.removeItem("userSession");
        onLogout();
      } else {
        // 🟢 SIGN IN
        const signInAt = new Date().toISOString();

        const { data } = await apiClient.post(`${LOGIN_API_BASE}/start`, {
          username,
          signInAt,
        });

        // Expected backend response:
        // { id: "...", signInAt: "..." }
        const id = data.id;
        const sessionData = { id, signInAt, user: username };

        localStorage.setItem("userSession", JSON.stringify(sessionData));
        setSessionId(id);
        setIsSignedIn(true);
        setSignInDateTime(new Date(signInAt));
      }
    } catch (err) {
      console.error("Failed to toggle session:", err);
      alert("Failed to update session. Check console or backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-white via-slate-50 to-slate-100 border-b border-slate-200 shadow-sm">
      <div className="mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
        {/* LEFT: Clock */}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Current Time
          </span>
          <div className="mt-2 inline-flex items-center rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 shadow-lg px-4 py-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 mr-3">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg sm:text-xl font-extrabold text-white tracking-wider">
                {formattedTime}
              </span>
              <span className="text-[11px] font-medium text-blue-100">
                {formattedDateFull}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER: Info */}
        <div className="flex-1 flex justify-center">
          {isSignedIn && signInTimeStr && signInDateStr ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-slate-600">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Since{" "}
                <span className="font-bold text-emerald-700">
                  {signInTimeStr}
                </span>
              </div>
              <span className="text-slate-500">
                <span className="font-semibold text-slate-700">{username}</span>{" "}
                signed in on {signInDateStr}
              </span>
            </div>
          ) : (
            <span className="text-[11px] sm:text-xs text-slate-500">
              Not signed in
            </span>
          )}
        </div>

        {/* RIGHT: Button */}
        <div className="flex justify-end">
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-md transition-transform transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
              isSignedIn
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {isSignedIn ? (
              <>
                <LogOut className="w-4 h-4" />
                {loading ? "Signing out..." : "Sign Out"}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {loading ? "Signing in..." : "Sign In"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSessionBar;
