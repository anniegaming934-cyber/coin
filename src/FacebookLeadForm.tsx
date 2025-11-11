// src/FacebookLeadForm.tsx
import React, { useState } from "react";
import { apiClient } from "./apiConfig";

const FacebookLeadForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }

    try {
      setSaving(true);
      await apiClient.post("/api/facebook-leads", { name, email });
      setSuccess("Lead saved ✅");
      setName("");
      setEmail("");
    } catch (err: any) {
      console.error("Failed to save lead:", err);
      setError(
        err?.response?.data?.message || "Failed to save lead. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setError("");
      // Fetch as blob to download
      const res = await apiClient.get("/api/facebook-leads/export", {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileName = `facebook_leads_${Date.now()}.csv`;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Failed to export leads:", err);
      setError(
        err?.response?.data?.message || "Failed to export. Please try again."
      );
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold mb-2">Facebook </h2>
      <p className="text-sm text-gray-500">
        Player Information
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
            placeholder="Enter full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-500"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded px-2 py-1">
            {success}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Lead"}
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Export to Excel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FacebookLeadForm;
