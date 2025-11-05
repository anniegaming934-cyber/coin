import React, { useState } from "react";
import axios, { AxiosError } from "axios";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSuccess: (username: string) => void; // sends username to parent
}

// Use same base URL idea as LoginForm
// Set VITE_API_BASE_URL for production if needed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchToLogin,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      console.log("Register data:", { name, email, password });

      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/register`,
        { name, email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      console.log("✅ Register success:", data);

      // Save token from backend
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      // 🔐 Save role ("user" / "admin") if backend sends it
      if (data.user?.role) {
        localStorage.setItem("role", data.user.role);
      }

      // Prefer backend name, fallback to what user typed
      const username =
        data.user?.name || name.trim() || email.split("@")[0] || "New User";

      onSuccess(username);
    } catch (err) {
      console.error("❌ Register failed:", err);

      const axiosErr = err as AxiosError<any>;
      if (axiosErr.response) {
        setError(
          axiosErr.response.data?.message ||
            `Registration failed (${axiosErr.response.status}).`
        );
      } else if (axiosErr.request) {
        setError("No response from server. Is the API running?");
      } else {
        setError("Unexpected error during registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        Create Account 🐾
      </h2>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Full Name
        </label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="e.g. Alex Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Confirm Password
        </label>
        <input
          type="password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
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
        {loading ? "Creating account..." : "Register"}
      </button>

      <p className="mt-4 text-xs text-center text-slate-500">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-blue-600 hover:underline"
        >
          Log in
        </button>
      </p>
    </form>
  );
};

export default RegisterForm;
