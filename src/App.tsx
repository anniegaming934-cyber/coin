// src/App.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import axios from "axios";

import AuthCard from "./AuthCard";
import UserDashboard from "./user/UserDashboard.tsx";
import AdminDashboard from "./admin/AdminDashboard.tsx";

const App: FC = () => {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [role, setRole] = useState<"user" | "admin">("user");
  console.log("🧩 VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);

  // ---------------------------
  // 🔐 Check token + role on first load
  // ---------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role") as "admin" | "user" | null;

    if (storedRole === "admin" || storedRole === "user") {
      setRole(storedRole);
    }

    if (!token) {
      setCheckingAuth(false);
      return;
    }

    axios
      .get("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        const user = res.data?.user;
        const nameFromApi = user?.name || user?.email || "";
        if (nameFromApi) {
          setUsername(nameFromApi);

          if (user?.role === "admin" || user?.role === "user") {
            setRole(user.role);
            localStorage.setItem("role", user.role);
          }

          setIsAuthed(true);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        localStorage.removeItem("token");
        localStorage.removeItem("role");
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsAuthed(false);
    setUsername("");
    setRole("user");
    // let child state reset naturally by going back to Auth
  };

  // ---------------------------
  // Auth gate
  // ---------------------------
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Checking your session...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <AuthCard
        onAuthSuccess={(name: string) => {
          setUsername(name);
          setIsAuthed(true);
        }}
      />
    );
  }

  // ---------------------------
  // Role-based dashboards
  // ---------------------------
  if (role === "admin") {
    return <AdminDashboard username={username} onLogout={handleLogout} />;
  }

  return <UserDashboard username={username} onLogout={handleLogout} />;
};

export default App;
