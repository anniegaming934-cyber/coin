// src/FacebookLeadForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "./apiConfig";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface Lead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  contactPreference?: "whatsapp" | "telegram";
  facebookLink?: string;
  createdAt?: string;
}

const FacebookLeadForm: React.FC = () => {
  // 🔹 Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPreference, setContactPreference] = useState<
    "whatsapp" | "telegram" | ""
  >("");
  const [facebookLink, setFacebookLink] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🔹 Table state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ==========================
  // Helpers
  // ==========================
  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setContactPreference("");
    setFacebookLink("");
    setEditingId(null);
  };

  const loadLeads = async () => {
    try {
      setLoadingLeads(true);
      const { data } = await apiClient.get<Lead[]>("/api/facebook-leads");
      setLeads(data || []);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  // ==========================
  // Submit (Create / Update)
  // ==========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Name are required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        contactPreference: contactPreference || undefined,
        facebookLink: facebookLink.trim() || undefined,
      };

      if (editingId) {
        // 🔁 Update existing lead
        await apiClient.put(`/api/facebook-leads/${editingId}`, payload);
        setSuccess("Lead updated ✅");
      } else {
        // 🆕 Create new lead
        await apiClient.post("/api/facebook-leads", payload);
        setSuccess("Lead saved ✅");
      }

      resetForm();
      await loadLeads();
    } catch (err: any) {
      console.error("Failed to save lead:", err);
      setError(
        err?.response?.data?.message || "Failed to save lead. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================
  // Edit from table
  // ==========================
  const handleEdit = (lead: Lead) => {
    setEditingId(lead._id);
    setName(lead.name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setContactPreference((lead.contactPreference as any) || "");
    setFacebookLink(lead.facebookLink || "");
    setError("");
    setSuccess("");
  };

  // ==========================
  // Delete lead
  // ==========================
  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Delete this lead?");
    if (!confirmDelete) return;

    setError("");
    setSuccess("");

    try {
      await apiClient.delete(`/api/facebook-leads/${id}`);
      setLeads((prev) => prev.filter((l) => l._id !== id));
      setSuccess("Lead deleted ✅");
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Failed to delete lead:", err);
      setError(
        err?.response?.data?.message || "Failed to delete lead. Try again."
      );
    }
  };

  // ==========================
  // Export CSV
  // ==========================
  const handleExportCsv = () => {
    if (!leads.length) return;

    const headers = [
      "Name",
      "Email",
      "Phone",
      "ContactPreference",
      "FacebookLink",
      "CreatedAt",
    ];

    const rows = leads.map((l) => [
      l.name ?? "",
      l.email ?? "",
      l.phone ?? "",
      l.contactPreference ?? "",
      l.facebookLink ?? "",
      l.createdAt ?? "",
    ]);

    const csvContent =
      [headers, ...rows]
        .map((row) =>
          row
            .map((field) => {
              const s = String(field ?? "");
              if (s.includes(",") || s.includes('"') || s.includes("\n")) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facebook-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==========================
  // React Table setup
  // ==========================
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: (info) => info.getValue() as string,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: (info) => info.getValue() as string,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: (info) => (info.getValue() as string) || "-",
      },
      {
        accessorKey: "contactPreference",
        header: "Contact",
        cell: (info) => {
          const v = info.getValue() as Lead["contactPreference"];
          return v ? v.charAt(0).toUpperCase() + v.slice(1) : "-";
        },
      },
      {
        accessorKey: "facebookLink",
        header: "Facebook",
        cell: (info) => {
          const link = info.getValue() as string | undefined;
          return link ? (
            <a
              href={link}
              className="text-blue-600 hover:underline break-all"
              target="_blank"
              rel="noreferrer"
            >
              Link
            </a>
          ) : (
            "-"
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: (info) => {
          const createdAt = info.getValue() as string | undefined;
          return createdAt ? new Date(createdAt).toLocaleString() : "-";
        },
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleEdit(lead)}
                className="text-xs md:text-sm px-2 py-1 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(lead._id)}
                className="text-xs md:text-sm px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [handleDelete, handleEdit]
  );

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full space-y-6">
      {/* ================= FORM (FULL WIDTH) ================= */}
      <form
        onSubmit={handleSubmit}
        className="w-full bg-white/90 rounded-xl shadow-md p-4 md:p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg md:text-xl font-semibold">
            {editingId ? "Edit Lead" : "Add New Lead"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              Cancel edit
            </button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Name *</label>
            <input
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Email *</label>
            <input
              type="email"
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Phone</label>
            <input
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Contact Preference */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Preferred Contact</label>
            <select
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={contactPreference}
              onChange={(e) =>
                setContactPreference(
                  e.target.value as "whatsapp" | "telegram" | ""
                )
              }
            >
              <option value="">Select</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>

          {/* Facebook Link */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium">
              Facebook Profile / Link
            </label>
            <input
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://facebook.com/username"
              value={facebookLink}
              onChange={(e) => setFacebookLink(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving
              ? editingId
                ? "Updating..."
                : "Saving..."
              : editingId
              ? "Update Lead"
              : "Save Lead"}
          </button>
        </div>
      </form>

      {/* ================= TABLE + EXPORT ================= */}
      <div className="w-full bg-white/90 rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold">Leads</h3>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!leads.length}
            className="px-3 py-1.5 rounded-md text-xs md:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>

        {loadingLeads ? (
          <div className="text-sm text-gray-500">Loading leads...</div>
        ) : !leads.length ? (
          <div className="text-sm text-gray-500">No leads yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-gray-50">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="text-left px-3 py-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacebookLeadForm;
