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
      const data = JSON.parse(fs.readFileSync(VOTES_FILE, "utf8"));
      // Ensure defaults exist
      if (data.votingEnabled === undefined) data.votingEnabled = true;
      if (data.votesPerUser === undefined) data.votesPerUser = 1;
      if (data.disabledProjects === undefined) data.disabledProjects = [];
      if (data.distributionAmount === undefined) data.distributionAmount = null;
      if (data.distributionCurrency === undefined)
        data.distributionCurrency = "USD";
      return data;
    }
  } catch (err) {
    console.error("Error loading votes:", err);
  }
  return {
    votes: [],
    monthlyTotals: {},
    votingEnabled: true,
    votesPerUser: 1,
    disabledProjects: [],
    distributionAmount: null,
    distributionCurrency: "USD",
  };
}

function isVotingEnabled() {
  const votes = loadVotes();
  return votes.votingEnabled !== false;
}

function getVotingPeriod() {
  const votes = loadVotes();
  // If voting is disabled, use the frozen period; otherwise use current month
  if (votes.votingEnabled === false && votes.votingPeriod) {
    return votes.votingPeriod;
  }
  return getCurrentMonth();
}

function setVotingEnabled(enabled) {
  const votes = loadVotes();
  votes.votingEnabled = enabled;

  if (enabled) {
    // When re-enabling, update the voting period to current month
    votes.votingPeriod = getCurrentMonth();
  } else {
    // When disabling, freeze the current voting period
    votes.votingPeriod = getCurrentMonth();
  }

  saveVotes(votes);
  return {
    success: true,
    votingEnabled: enabled,
    votingPeriod: votes.votingPeriod,
  };
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

function getVotesPerUser() {
  const votes = loadVotes();
  return votes.votesPerUser || 1;
}

function getUserVotesUsed(userId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.votes
    .filter((v) => v.userId === userId && v.month === currentMonth)
    .reduce((sum, v) => sum + (v.voteCount || 1), 0);
}

function getUserRemainingVotes(userId) {
  const votesPerUser = getVotesPerUser();
  const votesUsed = getUserVotesUsed(userId);
  return Math.max(0, votesPerUser - votesUsed);
}

function getDisabledProjects() {
  const votes = loadVotes();
  return votes.disabledProjects || [];
}

function isProjectDisabled(projectSlug) {
  return getDisabledProjects().includes(projectSlug);
}

function recordVote(
  userId,
  username,
  avatar,
  projectSlug,
  projectName,
  voteCount = 1
) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();

  // Check if project is disabled
  if (votes.disabledProjects?.includes(projectSlug)) {
    return { success: false, error: "This project is not accepting votes" };
  }

  // Check remaining votes
  const remainingVotes = getUserRemainingVotes(userId);
  if (voteCount > remainingVotes) {
    return {
      success: false,
      error: `You only have ${remainingVotes} vote(s) remaining`,
    };
  }

  if (voteCount < 1) {
    return { success: false, error: "Vote count must be at least 1" };
  }

  // Record the vote
  votes.votes.push({
    id: Date.now().toString(),
    userId,
    username,
    avatar,
    projectSlug,
    projectName,
    voteCount,
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
  votes.monthlyTotals[currentMonth][projectSlug].count += voteCount;

  // Check if user already voted for this project (for voter list)
  const existingVoter = votes.monthlyTotals[currentMonth][
    projectSlug
  ].voters.find((v) => (typeof v === "object" ? v.odId === userId : false));
  if (existingVoter) {
    existingVoter.voteCount = (existingVoter.voteCount || 1) + voteCount;
  } else {
    votes.monthlyTotals[currentMonth][projectSlug].voters.push({
      odId: userId,
      username,
      odAvatar: avatar,
      voteCount,
    });
  }

  saveVotes(votes);
  return { success: true, remainingVotes: getUserRemainingVotes(userId) };
}

function removeVote(userId, projectSlug = null) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();

  // Find the user's vote(s) for this month
  let votesToRemove;
  if (projectSlug) {
    // Remove votes only for specific project
    votesToRemove = votes.votes.filter(
      (v) =>
        v.userId === userId &&
        v.month === currentMonth &&
        v.projectSlug === projectSlug
    );
  } else {
    // Remove all votes for this month
    votesToRemove = votes.votes.filter(
      (v) => v.userId === userId && v.month === currentMonth
    );
  }

  if (votesToRemove.length === 0) {
    return { success: false, error: "No vote found" };
  }

  // Remove votes from votes array
  for (const vote of votesToRemove) {
    const voteIndex = votes.votes.findIndex((v) => v.id === vote.id);
    if (voteIndex > -1) {
      votes.votes.splice(voteIndex, 1);
    }

    const slug = vote.projectSlug;
    const voteCount = vote.voteCount || 1;

    // Update monthly totals
    if (votes.monthlyTotals[currentMonth]?.[slug]) {
      votes.monthlyTotals[currentMonth][slug].count -= voteCount;

      // Find voter and update or remove
      const voterIndex = votes.monthlyTotals[currentMonth][
        slug
      ].voters.findIndex((v) =>
        typeof v === "object" ? v.odId === userId : v === vote.username
      );
      if (voterIndex > -1) {
        const voter =
          votes.monthlyTotals[currentMonth][slug].voters[voterIndex];
        if (typeof voter === "object" && voter.voteCount > voteCount) {
          voter.voteCount -= voteCount;
        } else {
          votes.monthlyTotals[currentMonth][slug].voters.splice(voterIndex, 1);
        }
      }

      // Remove project from totals if no more votes
      if (votes.monthlyTotals[currentMonth][slug].count <= 0) {
        delete votes.monthlyTotals[currentMonth][slug];
      }
    }
  }

  saveVotes(votes);
  return { success: true, remainingVotes: getUserRemainingVotes(userId) };
}

function getUserVotes(userId) {
  const votes = loadVotes();
  const currentMonth = getCurrentMonth();
  return votes.votes.filter(
    (v) => v.userId === userId && v.month === currentMonth
  );
}

// For backward compatibility - returns first vote or null
function getUserVote(userId) {
  const userVotes = getUserVotes(userId);
  return userVotes.length > 0 ? userVotes[0] : null;
}

function getMonthlyResults() {
  const votes = loadVotes();
  const period = getVotingPeriod();
  return votes.monthlyTotals[period] || {};
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
  const votes = loadVotes();
  const votingEnabledStatus = isVotingEnabled();
  const votingPeriodValue = getVotingPeriod();
  const votesPerUserValue = getVotesPerUser();
  const disabledProjectsList = getDisabledProjects();

  const commonData = {
    votingEnabled: votingEnabledStatus,
    votingPeriod: votingPeriodValue,
    votesPerUser: votesPerUserValue,
    disabledProjects: disabledProjectsList,
    distributionAmount: votes.distributionAmount,
    distributionCurrency: votes.distributionCurrency,
  };

  if (req.session.user) {
    const userVotes = getUserVotes(req.session.user.id);
    const votesUsed = getUserVotesUsed(req.session.user.id);
    const remainingVotes = getUserRemainingVotes(req.session.user.id);

    res.json({
      authenticated: true,
      user: req.session.user,
      hasVotedThisMonth: userVotes.length > 0,
      votesUsed,
      remainingVotes,
      currentVotes: userVotes.map((v) => ({
        projectSlug: v.projectSlug,
        projectName: v.projectName,
        voteCount: v.voteCount || 1,
      })),
      ...commonData,
    });
  } else {
    res.json({
      authenticated: false,
      ...commonData,
    });
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
  // Check if voting is enabled
  if (!isVotingEnabled()) {
    return res.status(403).json({ error: "Voting is currently disabled" });
  }

  const { projectSlug, projectName, voteCount = 1 } = req.body;

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
    projectName,
    parseInt(voteCount, 10) || 1
  );

  if (result.success) {
    res.json({
      success: true,
      message: "Vote recorded successfully",
      remainingVotes: result.remainingVotes,
      results: getMonthlyResults(),
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Remove vote
app.delete("/api/vote", requireAuth, requireRole, (req, res) => {
  const { projectSlug } = req.body || {};
  const result = removeVote(req.session.user.id, projectSlug);

  if (result.success) {
    res.json({
      success: true,
      message: "Vote removed successfully",
      remainingVotes: result.remainingVotes,
      results: getMonthlyResults(),
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Get current month's voting results
app.get("/api/votes/current", (req, res) => {
  res.json({
    month: getVotingPeriod(),
    votingEnabled: isVotingEnabled(),
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

// Get voting status (admin only)
app.get("/api/admin/voting-status", requireAuth, requireAdmin, (req, res) => {
  res.json({
    votingEnabled: isVotingEnabled(),
    votingPeriod: getVotingPeriod(),
  });
});

// Toggle voting status (admin only)
app.post("/api/admin/voting-status", requireAuth, requireAdmin, (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }

  const result = setVotingEnabled(enabled);
  res.json({
    success: true,
    votingEnabled: result.votingEnabled,
    votingPeriod: result.votingPeriod,
    message: enabled ? "Voting has been enabled" : "Voting has been disabled",
  });
});

// Get admin settings
app.get("/api/admin/settings", requireAuth, requireAdmin, (req, res) => {
  const votes = loadVotes();
  res.json({
    votesPerUser: votes.votesPerUser || 1,
    distributionAmount: votes.distributionAmount,
    distributionCurrency: votes.distributionCurrency || "USD",
    disabledProjects: votes.disabledProjects || [],
  });
});

// Update admin settings
app.post("/api/admin/settings", requireAuth, requireAdmin, (req, res) => {
  const { votesPerUser, distributionAmount, distributionCurrency } = req.body;
  const votes = loadVotes();

  if (votesPerUser !== undefined) {
    const parsed = parseInt(votesPerUser, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      return res
        .status(400)
        .json({ error: "Votes per user must be between 1 and 10" });
    }
    votes.votesPerUser = parsed;
  }

  if (distributionAmount !== undefined) {
    if (distributionAmount === null || distributionAmount === "") {
      votes.distributionAmount = null;
    } else {
      const parsed = parseFloat(distributionAmount);
      if (isNaN(parsed) || parsed < 0) {
        return res
          .status(400)
          .json({ error: "Distribution amount must be a positive number" });
      }
      votes.distributionAmount = parsed;
    }
  }

  if (distributionCurrency !== undefined) {
    votes.distributionCurrency = distributionCurrency;
  }

  saveVotes(votes);
  res.json({
    success: true,
    votesPerUser: votes.votesPerUser,
    distributionAmount: votes.distributionAmount,
    distributionCurrency: votes.distributionCurrency,
  });
});

// Disable a project from voting
app.post(
  "/api/admin/projects/:slug/disable",
  requireAuth,
  requireAdmin,
  (req, res) => {
    const { slug } = req.params;
    const votes = loadVotes();

    if (!votes.disabledProjects) {
      votes.disabledProjects = [];
    }

    if (!votes.disabledProjects.includes(slug)) {
      votes.disabledProjects.push(slug);
      saveVotes(votes);
    }

    res.json({
      success: true,
      disabledProjects: votes.disabledProjects,
    });
  }
);

// Enable a project for voting
app.post(
  "/api/admin/projects/:slug/enable",
  requireAuth,
  requireAdmin,
  (req, res) => {
    const { slug } = req.params;
    const votes = loadVotes();

    if (votes.disabledProjects) {
      votes.disabledProjects = votes.disabledProjects.filter((p) => p !== slug);
      saveVotes(votes);
    }

    res.json({
      success: true,
      disabledProjects: votes.disabledProjects || [],
    });
  }
);

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
