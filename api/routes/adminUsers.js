// routes/adminUsers.js
import express from "express";
import User from "../models/User.js";
import LoginSession from "../models/LoginSession.js";
import GameEntry from "../models/GameEntry.js";
import { requireAuth, requireAdmin } from "./auth.js"; // from routes/auth.js

const router = express.Router();

/**
 * GET /api/admin/users
 * Optional: ?status=pending | active | blocked
 *
 * NOTE: This assumes you mount the router like:
 *   app.use("/api/admin/users", adminUsersRouter);
 * so this handler is for path "/".
 */
// GET /api/admin/users
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const userQuery = {};
    if (status) {
      userQuery.status = status;
    }

    const users = await User.find(
      userQuery,
      "username email lastSignInAt lastSignOutAt role isAdmin createdAt isApproved status"
    )
      .sort({ createdAt: -1 })
      .lean();

    if (!users.length) {
      return res.json([]);
    }

    // 1) Build username list
    const usernames = users
      .map((u) => (u.username ? String(u.username).trim() : ""))
      .filter(Boolean);

    // 2) Aggregate totals from GameEntry (by "effectiveUsername")
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

    // 3) Get latest session PER USER in ONE query
    const sessionsAgg = await LoginSession.aggregate([
      {
        $match: {
          username: { $in: usernames },
        },
      },
      // sort so that $first gives the latest signInAt
      { $sort: { signInAt: -1 } },
      {
        $group: {
          _id: "$username",
          lastSignInAt: { $first: "$signInAt" },
          lastSignOutAt: { $first: "$signOutAt" },
        },
      },
    ]);

    const sessionsByUser = {};
    for (const row of sessionsAgg) {
      sessionsByUser[row._id] = {
        lastSignInAt: row.lastSignInAt || null,
        lastSignOutAt: row.lastSignOutAt || null,
      };
    }

    // 4) Merge: users + totals + latest sessions + isOnline flag
    const enhanced = users.map((u) => {
      const base = { ...u };

      const totals = totalsByUser[u.username] || {
        totalDeposit: 0,
        totalRedeem: 0,
        totalFreeplay: 0,
      };

      base.totalDeposit = totals.totalDeposit;
      base.totalRedeem = totals.totalRedeem;
      base.totalFreeplay = totals.totalFreeplay;

      // your previous logic
      base.totalPayments = totals.totalRedeem || 0;

      const session = sessionsByUser[u.username];
      let isOnline = false;

      if (session) {
        const lastSignInAt = session.lastSignInAt || null;
        const lastSignOutAt = session.lastSignOutAt || null;

        base.lastSignInAt = lastSignInAt || base.lastSignInAt || null;
        base.lastSignOutAt = lastSignOutAt || base.lastSignOutAt || null;

        // ✅ ONLINE if we have a sign-in and NO sign-out yet
        if (lastSignInAt && !lastSignOutAt) {
          isOnline = true;
        }
      }

      base.isOnline = isOnline; // 👈 your new flag

      return base;
    });

    res.json(enhanced);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * PATCH /api/admin/users/:id/approve
 * Mark user as approved + active
 *
 * With mount app.use("/api/admin/users", router)
 * this is PATCH /api/admin/users/:id/approve
 */
router.patch("/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isApproved: true,
        status: "active",
      },
      { new: true }
    ).select("username email role isAdmin isApproved status createdAt");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User approved successfully",
      user,
    });
  } catch (err) {
    console.error("Error approving user:", err);
    return res.status(500).json({ message: "Failed to approve user" });
  }
});

/**
 * PATCH /api/admin/users/:id/block
 * Mark user as blocked (and not approved)
 */
router.patch("/:id/block", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isApproved: false,
        status: "blocked",
      },
      { new: true }
    ).select("username email role isAdmin isApproved status createdAt");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User blocked successfully",
      user,
    });
  } catch (err) {
    console.error("Error blocking user:", err);
    return res.status(500).json({ message: "Failed to block user" });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2) Delete related login sessions (optional but nice)
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
