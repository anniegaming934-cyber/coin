import React, { useState } from "react";
import axios, { AxiosError } from "axios";
import { API_BASE } from "./apiConfig";
interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess: (username: string) => void;
}

// Better base URL: env first, then dev fallback (backend), then ""
const API_BASE_URL = API_BASE;

const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToRegister,
  onSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 👈 NEW
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false); // modal control

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      const backendRole = data.user?.role as string | undefined;
      const backendIsAdmin = Boolean(data.user?.isAdmin);
      const isAdmin =
        backendIsAdmin ||
        (backendRole && backendRole.toLowerCase() === "admin");

      const role = isAdmin ? "admin" : "user";

      localStorage.setItem("role", role);
      localStorage.setItem("isAdmin", isAdmin ? "1" : "0");

      if (data.user?.email) {
        localStorage.setItem("userEmail", data.user.email);
      } else {
        localStorage.setItem("userEmail", email);
      }

      const username = data.user?.name || email.split("@")[0] || "User";
      localStorage.setItem("userName", username);

      onSuccess(username);
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const message =
        axiosErr.response?.data?.message ||
        `Login failed (${axiosErr.response?.status ?? "unknown"}).`;

      console.error("❌ Login failed:", message);

      if (
        message.toLowerCase().includes("invalid") ||
        axiosErr.response?.status === 401
      ) {
        setShowModal(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 relative">
        <h2 className="text-xl font-bold text-slate-800 mb-4">
          Welcome Back 👋
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>

          {/* 👇 wrapper so the Show/Hide button sits inside the input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} // 👈 toggle here
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-1 px-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-slate-300" />{" "}
            Remember me
          </label>
          <button type="button" className="text-blue-600 hover:underline">
            Forgot password?
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full mt-2 rounded-lg py-2 text-sm font-semibold text-white transition ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="mt-4 text-xs text-center text-slate-500">
          Don’t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-blue-600 hover:underline"
          >
            Sign up
          </button>
        </p>
      </form>

      {/* MODAL DIALOG */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-2">
              Login Failed
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              Your email or password didn’t match our records. Please try again.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginForm;
