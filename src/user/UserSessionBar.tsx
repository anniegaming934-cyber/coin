import React, { useEffect, useState } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";

interface UserSessionBarProps {
  username: string;
  onLogout: () => void;
}

const UserSessionBar: React.FC<UserSessionBarProps> = ({
  username,
  onLogout,
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [signInDateTime, setSignInDateTime] = useState<Date | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  // toggle sign in / out
  const handleToggle = () => {
    if (isSignedIn) {
      setIsSignedIn(false);
      setSignInDateTime(null);
      onLogout();
    } else {
      setIsSignedIn(true);
      setSignInDateTime(new Date());
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-white via-slate-50 to-slate-100 border-b border-slate-200 shadow-sm">
      <div className=" mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
        {/* LEFT: Current time */}
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

        {/* CENTER: user + since + full sign-in info */}
        <div className="flex-1 flex justify-center">
          {isSignedIn && signInTimeStr && signInDateStr ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-slate-600">
              {/* green since pill */}
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Since{" "}
                <span className="font-bold text-emerald-700">
                  {signInTimeStr}
                </span>
              </div>

              {/* divider */}

              {/* inline text: user + signed in at */}
            </div>
          ) : (
            <span className="text-[11px] sm:text-xs text-slate-500">
              Not signed in
            </span>
          )}
        </div>

        {/* RIGHT: Sign In / Sign Out button */}
        <div className="flex justify-end">
          <button
            onClick={handleToggle}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-md transition-transform transform hover:scale-105 active:scale-95 ${
              isSignedIn
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {isSignedIn ? (
              <>
                <LogOut className="w-4 h-4" />
                Sign Out
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSessionBar;
