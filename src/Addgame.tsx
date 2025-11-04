import React, { FC, useState } from "react";
import axios from "axios";

interface AddGameFormProps {
  apiUrl: string;
  onGameAdded: () => void; // Callback to refresh the game list
}

const AddGameForm: FC<AddGameFormProps> = ({ apiUrl, onGameAdded }) => {
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await axios.post(apiUrl, {
        name: name.trim(),
        coinsSpent: 0,
        coinsEarned: 0,
        coinsRecharged: 0,
      });
      setName(""); // Clear input
      onGameAdded(); // Refresh games list in parent
    } catch (error) {
      console.error("Failed to add game:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2 mb-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter game name"
        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-150"
      >
        Add Game
      </button>
    </form>
  );
};

export default AddGameForm;
