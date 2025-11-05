import React, { useState } from "react";
import axios, { AxiosError } from "axios";

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess: (username: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToRegister,
  onSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      // ✅ Save token + role for later (admin/user)
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      if (data.user?.role) {
        localStorage.setItem("role", data.user.role); // "admin" or "user"
      }

      const username = data.user?.name || email.split("@")[0] || "User";
      onSuccess(username);
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const message =
        axiosErr.response?.data?.message ||
        `Login failed (${axiosErr.response?.status ?? "unknown"}).`;

      console.error("❌ Login failed:", message);

      // if credentials incorrect or 401 → show modal
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
      {/* FORM */}
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
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
