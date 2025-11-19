// routes/adminUsers.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import LoginSession from "../models/LoginSession.js";
import GameEntry from "../models/GameEntry.js";

const router = express.Router();

// GET /api/admin/users
router.get("/", async (req, res) => {
  try {
    const users = await User.find(
      {},
      "username email lastSignInAt lastSignOutAt role isAdmin createdAt"
    )
      .sort({ createdAt: -1 })
      .lean();

    if (!users.length) {
      return res.json([]);
    }

    const usernames = users
      .map((u) => (u.username ? String(u.username).trim() : ""))
      .filter(Boolean);

    // 👇 use username OR createdBy, and group by "effectiveUsername"
    const totalsAgg = await GameEntry.aggregate([
      {
        $match: {
          $or: [
            { username: { $in: usernames } },
            { createdBy: { $in: usernames } },
          ],
        },
      },
      {
        $addFields: {
          effectiveUsername: {
            $ifNull: ["$username", "$createdBy"],
          },
        },
      },
      {
        $group: {
          _id: "$effectiveUsername",
          totalDeposit: {
            $sum: {
              $cond: [
                { $eq: ["$type", "deposit"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
          totalRedeem: {
            $sum: {
              $cond: [
                { $eq: ["$type", "redeem"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
          totalFreeplay: {
            $sum: {
              $cond: [
                { $eq: ["$type", "freeplay"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalsByUser = {};
    for (const row of totalsAgg) {
      const uname = row._id;
      totalsByUser[uname] = {
        totalDeposit: row.totalDeposit || 0,
        totalRedeem: row.totalRedeem || 0,
        totalFreeplay: row.totalFreeplay || 0,
      };
    }

    const enhanced = await Promise.all(
      users.map(async (u) => {
        const base = { ...u };

        const totals = totalsByUser[u.username] || {
          totalDeposit: 0,
          totalRedeem: 0,
          totalFreeplay: 0,
        };

        base.totalDeposit = totals.totalDeposit;
        base.totalRedeem = totals.totalRedeem;
        base.totalFreeplay = totals.totalFreeplay;

        // define totalPayments as you like – here: total cash out
        base.totalPayments = totals.totalRedeem || 0;

        if (u.username) {
          const latestSession = await LoginSession.findOne({
            username: u.username,
          })
            .sort({ signInAt: -1 })
            .lean();

          if (latestSession) {
            base.lastSignInAt =
              latestSession.signInAt || base.lastSignInAt || null;
            base.lastSignOutAt =
              latestSession.signOutAt || base.lastSignOutAt || null;
          }
        }

        return base;
      })
    );

    res.json(enhanced);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
// DELETE /api/admin/users/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2) Optionally delete related login sessions
    if (user.username) {
      await LoginSession.deleteMany({ username: user.username });
    }

    // 3) Delete the user itself
    await User.deleteOne({ _id: id });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
