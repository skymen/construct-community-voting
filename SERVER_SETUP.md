# Server Setup Guide

Follow these steps to run the Construct Community Voting application.

## Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- Discord application configured (see [DISCORD_SETUP.md](./DISCORD_SETUP.md))

## Quick Start

### 1. Install Dependencies

```bash
cd "open collective vote"
npm install
```

### 2. Create Environment File

Copy the example environment file:

```bash
cp env.example .env
```

Then edit `.env` with your Discord credentials:

```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_REQUIRED_ROLE_ID=your_role_id
SESSION_SECRET=random_secret_string
PORT=3000
```

### 3. Start the Server

For development (with auto-reload):
```bash
npm run dev
```

For production:
```bash
npm start
```

### 4. Access the Application

Open your browser and go to: **http://localhost:3000**

## How It Works

### Authentication Flow

1. User clicks "Connect with Discord"
2. They're redirected to Discord's OAuth2 authorization page
3. After authorization, Discord redirects back with a code
4. Server exchanges the code for an access token
5. Server uses the bot token to check if the user:
   - Is a member of the configured Discord server
   - Has the required role
6. User can then vote if they meet the requirements

### Voting System

- Each eligible user can vote **once per calendar month**
- Votes are stored in `votes.json` (created automatically)
- Results are displayed in real-time on the page
- The project with the most votes "wins" for that month

## File Structure

```
open collective vote/
├── server.js           # Express backend server
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (create this)
├── env.example        # Example environment file
├── votes.json         # Vote database (auto-created)
├── public/
│   └── index.html     # Frontend application
├── DISCORD_SETUP.md   # Discord configuration guide
└── SERVER_SETUP.md    # This file
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main application page |
| GET | `/api/me` | Get current user info |
| GET | `/auth/discord` | Start Discord OAuth flow |
| GET | `/auth/discord/callback` | OAuth callback handler |
| POST | `/auth/logout` | Logout current user |
| POST | `/api/vote` | Submit a vote |
| GET | `/api/votes/current` | Get current month's results |
| GET | `/api/votes/history` | Get all voting history |

## Troubleshooting

### "Cannot GET /" Error
Make sure the `public` folder exists with `index.html` inside it.

### Discord Login Not Working
1. Check that your redirect URI in Discord Developer Portal matches exactly: `http://localhost:3000/auth/discord/callback`
2. Verify all environment variables are set correctly
3. Check the server console for error messages

### Role Check Always Fails
1. Ensure the bot is in your Discord server
2. Verify SERVER MEMBERS INTENT is enabled for your bot
3. Make sure the role ID is correct (enable Developer Mode in Discord to copy IDs)

### Votes Not Persisting
Check that the server has write permissions in the project directory for `votes.json`.

## Production Deployment

For production deployment, you should:

1. **Use HTTPS** - Set up SSL certificates
2. **Use a proper database** - Replace `votes.json` with PostgreSQL, MongoDB, etc.
3. **Set `NODE_ENV=production`** - Enables secure cookies
4. **Use environment variables** - Never commit `.env` to version control
5. **Add rate limiting** - Prevent abuse
6. **Use a process manager** - Like PM2 for Node.js

### Example Production Start

```bash
NODE_ENV=production npm start
```

## Customization

### Change the Collective

Edit the `COLLECTIVE_SLUG` constant in `public/index.html`:

```javascript
const COLLECTIVE_SLUG = 'your-collective-slug';
```

### Adjust Voting Period

Currently set to monthly. To change this, modify the `getCurrentMonth()` function in `server.js`:

```javascript
// For weekly voting:
function getCurrentWeek() {
  const now = new Date();
  const weekNum = Math.ceil((now.getDate()) / 7);
  return `${now.getFullYear()}-${now.getMonth() + 1}-W${weekNum}`;
}
```

### Add Multiple Required Roles

Modify the role check in `server.js`:

```javascript
const requiredRoles = ['role_id_1', 'role_id_2'];
hasRequiredRole = requiredRoles.some(role => member.roles.includes(role));
```

