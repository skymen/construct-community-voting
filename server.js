require("dotenv").config();
const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4000;

// Configuration
const config = {
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  botToken: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
  requiredRoleId: process.env.DISCORD_REQUIRED_ROLE_ID,
  adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID,
  redirectUri:
    process.env.REDIRECT_URI ||
    `http://localhost:${PORT}/auth/discord/callback`,
  sessionSecret:
    process.env.SESSION_SECRET || "change-this-secret-in-production",
};

// Simple file-based database for votes
const VOTES_FILE = path.join(__dirname, "votes.json");

function loadVotes() {
  try {
    if (fs.existsSync(VOTES_FILE)) {
      return JSON.parse(fs.readFileSync(VOTES_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error loading votes:", err);
  }
  return { votes: [], monthlyTotals: {} };
}

function saveVotes(data) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function hasVotedThisMonth(userId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.votes.some(
    (v) => v.userId === userId && v.month === currentMonth
  );
}

function recordVote(userId, username, avatar, projectSlug, projectName) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();

  // Check if already voted
  if (
    votes.votes.some((v) => v.userId === userId && v.month === currentMonth)
  ) {
    return { success: false, error: "Already voted this month" };
  }

  // Record the vote
  votes.votes.push({
    id: Date.now().toString(),
    userId,
    username,
    avatar,
    projectSlug,
    projectName,
    month: currentMonth,
    timestamp: new Date().toISOString(),
  });

  // Update monthly totals
  if (!votes.monthlyTotals[currentMonth]) {
    votes.monthlyTotals[currentMonth] = {};
  }
  if (!votes.monthlyTotals[currentMonth][projectSlug]) {
    votes.monthlyTotals[currentMonth][projectSlug] = {
      projectName,
      count: 0,
      voters: [],
    };
  }
  votes.monthlyTotals[currentMonth][projectSlug].count++;
  votes.monthlyTotals[currentMonth][projectSlug].voters.push({
    odId: userId,
    username,
    odAvatar: avatar,
  });

  saveVotes(votes);
  return { success: true };
}

function removeVote(userId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();

  // Find the user's vote for this month
  const voteIndex = votes.votes.findIndex(
    (v) => v.userId === userId && v.month === currentMonth
  );

  if (voteIndex === -1) {
    return { success: false, error: "No vote found for this month" };
  }

  const vote = votes.votes[voteIndex];
  const projectSlug = vote.projectSlug;

  // Remove from votes array
  votes.votes.splice(voteIndex, 1);

  // Update monthly totals
  if (votes.monthlyTotals[currentMonth]?.[projectSlug]) {
    votes.monthlyTotals[currentMonth][projectSlug].count--;
    // Find voter by odId (new format) or by matching username (old format)
    const voterIndex = votes.monthlyTotals[currentMonth][
      projectSlug
    ].voters.findIndex((v) =>
      typeof v === "object" ? v.odId === userId : v === vote.username
    );
    if (voterIndex > -1) {
      votes.monthlyTotals[currentMonth][projectSlug].voters.splice(
        voterIndex,
        1
      );
    }
    // Remove project from totals if no more votes
    if (votes.monthlyTotals[currentMonth][projectSlug].count <= 0) {
      delete votes.monthlyTotals[currentMonth][projectSlug];
    }
  }

  saveVotes(votes);
  return { success: true };
}

function getUserVote(userId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.votes.find(
    (v) => v.userId === userId && v.month === currentMonth
  );
}

function getMonthlyResults() {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.monthlyTotals[currentMonth] || {};
}

function getAllMonthlyResults() {
  const votes = loadVotes();
  return votes.monthlyTotals;
}

// Admin functions
function getAllVotes() {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.votes.filter((v) => v.month === currentMonth);
}

function adminRemoveVote(voteId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();

  const voteIndex = votes.votes.findIndex((v) => v.id === voteId);
  if (voteIndex === -1) {
    return { success: false, error: "Vote not found" };
  }

  const vote = votes.votes[voteIndex];
  const projectSlug = vote.projectSlug;

  // Remove from votes array
  votes.votes.splice(voteIndex, 1);

  // Update monthly totals if same month
  if (
    vote.month === currentMonth &&
    votes.monthlyTotals[currentMonth]?.[projectSlug]
  ) {
    votes.monthlyTotals[currentMonth][projectSlug].count--;
    const voterIndex = votes.monthlyTotals[currentMonth][
      projectSlug
    ].voters.findIndex((v) =>
      typeof v === "object" ? v.odId === vote.userId : v === vote.username
    );
    if (voterIndex > -1) {
      votes.monthlyTotals[currentMonth][projectSlug].voters.splice(
        voterIndex,
        1
      );
    }
    if (votes.monthlyTotals[currentMonth][projectSlug].count <= 0) {
      delete votes.monthlyTotals[currentMonth][projectSlug];
    }
  }

  saveVotes(votes);
  return { success: true };
}

function clearAllVotes() {
  const currentMonth = getCurrentMonth();
  const votes = loadVotes();

  // Remove all votes for current month
  votes.votes = votes.votes.filter((v) => v.month !== currentMonth);

  // Clear monthly totals for current month
  delete votes.monthlyTotals[currentMonth];

  saveVotes(votes);
  return { success: true };
}

// Middleware
app.set("trust proxy", 1); // Trust nginx proxy for HTTPS detection
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  })
);

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireRole(req, res, next) {
  if (!req.session.user?.hasRequiredRole) {
    return res
      .status(403)
      .json({ error: "You do not have the required role to vote" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Routes

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get current user
app.get("/api/me", (req, res) => {
  if (req.session.user) {
    const currentVote = getUserVote(req.session.user.id);
    res.json({
      authenticated: true,
      user: req.session.user,
      hasVotedThisMonth: !!currentVote,
      currentVote: currentVote
        ? {
            projectSlug: currentVote.projectSlug,
            projectName: currentVote.projectName,
          }
        : null,
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Discord OAuth login
app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Discord OAuth callback
app.get("/auth/discord/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect("/?error=oauth_denied");
  }

  if (!code) {
    return res.redirect("/?error=no_code");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Token error:", tokens);
      return res.redirect("/?error=token_error");
    }

    // Get user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const user = await userResponse.json();

    // Check if user is in the required guild with the required role
    // We use the bot token to check membership and roles
    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${config.guildId}/members/${user.id}`,
      {
        headers: {
          Authorization: `Bot ${config.botToken}`,
        },
      }
    );

    let hasRequiredRole = false;
    let isGuildMember = false;
    let isAdmin = false;

    if (memberResponse.ok) {
      const member = await memberResponse.json();
      isGuildMember = true;
      hasRequiredRole = member.roles.includes(config.requiredRoleId);
      isAdmin = member.roles.includes(config.adminRoleId);
    }

    // Store user in session
    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      isGuildMember,
      hasRequiredRole,
      isAdmin,
    };

    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=oauth_error");
  }
});

// Logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Vote for a project
app.post("/api/vote", requireAuth, requireRole, (req, res) => {
  const { projectSlug, projectName } = req.body;

  if (!projectSlug || !projectName) {
    return res
      .status(400)
      .json({ error: "Project slug and name are required" });
  }

  const result = recordVote(
    req.session.user.id,
    req.session.user.username,
    req.session.user.avatar,
    projectSlug,
    projectName
  );

  if (result.success) {
    res.json({
      success: true,
      message: "Vote recorded successfully",
      results: getMonthlyResults(),
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Remove vote
app.delete("/api/vote", requireAuth, requireRole, (req, res) => {
  const result = removeVote(req.session.user.id);

  if (result.success) {
    res.json({
      success: true,
      message: "Vote removed successfully",
      results: getMonthlyResults(),
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Get current month's voting results
app.get("/api/votes/current", (req, res) => {
  res.json({
    month: getCurrentMonth(),
    results: getMonthlyResults(),
  });
});

// Get all voting history
app.get("/api/votes/history", (req, res) => {
  res.json({
    history: getAllMonthlyResults(),
  });
});

// Get config for frontend (safe values only)
app.get("/api/config", (req, res) => {
  res.json({
    guildId: config.guildId,
    requiredRoleId: config.requiredRoleId,
  });
});

// ============ Admin Endpoints ============

// Serve admin page
app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Get all votes for current month (admin only)
app.get("/api/admin/votes", requireAuth, requireAdmin, (req, res) => {
  res.json({
    month: getCurrentMonth(),
    votes: getAllVotes(),
    results: getMonthlyResults(),
  });
});

// Remove a specific vote (admin only)
app.delete(
  "/api/admin/votes/:voteId",
  requireAuth,
  requireAdmin,
  (req, res) => {
    const { voteId } = req.params;
    const result = adminRemoveVote(voteId);

    if (result.success) {
      res.json({
        success: true,
        message: "Vote removed successfully",
        votes: getAllVotes(),
        results: getMonthlyResults(),
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  }
);

// Clear all votes for current month (admin only)
app.delete("/api/admin/votes", requireAuth, requireAdmin, (req, res) => {
  const result = clearAllVotes();

  if (result.success) {
    res.json({
      success: true,
      message: "All votes cleared for current month",
      votes: getAllVotes(),
      results: getMonthlyResults(),
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log("\n📋 Configuration:");
  console.log(
    `   - Discord Client ID: ${config.clientId ? "✓ Set" : "✗ Missing"}`
  );
  console.log(
    `   - Discord Client Secret: ${config.clientSecret ? "✓ Set" : "✗ Missing"}`
  );
  console.log(
    `   - Discord Bot Token: ${config.botToken ? "✓ Set" : "✗ Missing"}`
  );
  console.log(`   - Discord Guild ID: ${config.guildId || "Not set"}`);
  console.log(`   - Required Role ID: ${config.requiredRoleId || "Not set"}`);
  console.log(`   - Redirect URI: ${config.redirectUri}`);
  console.log("\n");
});
