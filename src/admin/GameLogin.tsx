// src/GameLogins.tsx
import React, { useState, FormEvent } from "react";

interface GameLogin {
  id: number;
  gameName: string;
  loginUsername: string;
  password: string;
  gameLink: string;
}

const GameLogins: React.FC = () => {
  const [gameName, setGameName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gameLink, setGameLink] = useState("");

  const [items, setItems] = useState<GameLogin[]>([]);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!gameName.trim() || !loginUsername.trim() || !password.trim()) {
      alert("Game name, username and password are required.");
      return;
    }

    const newItem: GameLogin = {
      id: Date.now(),
      gameName: gameName.trim(),
      loginUsername: loginUsername.trim(),
      password: password.trim(),
      gameLink: gameLink.trim(),
    };

    setItems((prev) => [newItem, ...prev]);

    setGameName("");
    setLoginUsername("");
    setPassword("");
    setGameLink("");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied!`);
      setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg("Copy not supported");
      setTimeout(() => setCopyMsg(null), 1500);
    }
  };

  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Add Game Login
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {/* Game Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Name
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Vegas Infinity"
              required
            />
          </div>

          {/* Login Username */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Login Username
            </label>
            <input
              type="text"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="e.g. prasis123"
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          {/* Game Link */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Game Link
            </label>
            <input
              type="url"
              className="rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={gameLink}
              onChange={(e) => setGameLink(e.target.value)}
              placeholder="https://example.com/login"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-4 mt-2">
            {copyMsg && (
              <span className="text-xs text-green-600">{copyMsg}</span>
            )}
            <button
              type="submit"
              className="ml-auto rounded-md px-4 py-2 text-sm font-medium border border-blue-500 text-blue-600 hover:bg-blue-50 transition"
            >
              Save Login
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Game Logins
        </h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No logins added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500 bg-gray-100">
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Password</th>
                  <th className="py-2 pr-4">Game Link</th>
                  <th className="py-2 pr-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 text-gray-900">{item.gameName}</td>
                    <td className="py-2 pr-4 text-gray-900">
                      {item.loginUsername}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="tracking-widest text-gray-700">
                        ••••••••
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {item.gameLink ? (
                        <a
                          href={item.gameLink}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-600 hover:text-blue-800"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-2 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            handleCopy(item.loginUsername, "Username")
                          }
                          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          Copy user
                        </button>

                        <button
                          onClick={() => handleCopy(item.password, "Password")}
                          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          Copy pass
                        </button>

                        {item.gameLink && (
                          <button
                            onClick={() =>
                              handleCopy(item.gameLink, "Game link")
                            }
                            className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Copy link
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded border px-2 py-1 text-xs text-red-600 border-red-400 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
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

export default GameLogins;
