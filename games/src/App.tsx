// src/App.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import AuthCard from "./AuthCard";
import UserDashboard from "./user/UserDashboard.tsx";
import AdminDashboard from "./admin/AdminDashboard.tsx";
import { apiClient } from "./apiConfig";

const App: FC = () => {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [role, setRole] = useState<"user" | "admin">("user");

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

    // 👇 IMPORTANT: use /api/auth/me (NOT /auth/me)
    apiClient
      .get("/api/auth/me")
      .then((res) => {
        const user = res.data?.user;
        const nameFromApi: string =
          user?.name || user?.username || user?.email || "";

        if (!user || !nameFromApi) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          return;
        }

        setUsername(nameFromApi);
        localStorage.setItem("username", nameFromApi);

        if (user.role === "admin" || user.role === "user") {
          setRole(user.role);
          localStorage.setItem("role", user.role);
        }

        setIsAuthed(true);
      })
      .catch((err) => {
        console.error("Auth check failed:", err?.response?.data || err.message);
        localStorage.removeItem("token");
        localStorage.removeItem("role");
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    setIsAuthed(false);
    setUsername("");
    setRole("user");
  };

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
        onAuthSuccess={(name: string, nextRole?: "admin" | "user") => {
          setUsername(name);
          localStorage.setItem("username", name);
          if (nextRole) setRole(nextRole);
          setIsAuthed(true);
        }}
      />
    );
  }

  return role === "admin" ? (
    <AdminDashboard username={username} onLogout={handleLogout} />
  ) : (
    <UserDashboard username={username} onLogout={handleLogout} />
  );
};

export default App;
