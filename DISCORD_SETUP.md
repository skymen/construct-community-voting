# Discord Application Setup Guide

Follow these steps to set up Discord OAuth2 for the voting application.

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** in the top right
3. Give your application a name (e.g., "Construct Community Voting")
4. Click **"Create"**

## Step 2: Configure OAuth2

1. In the left sidebar, click **"OAuth2"**
2. Under **"Redirects"**, click **"Add Redirect"**
3. Add your redirect URL:
   - For local development: `http://localhost:3000/auth/discord/callback`
   - For production: `https://yourdomain.com/auth/discord/callback`
4. Click **"Save Changes"**

## Step 3: Get Your Credentials

1. Go to **"OAuth2" → "General"**
2. Copy your **Client ID** - you'll need this
3. Click **"Reset Secret"** to generate a Client Secret
4. Copy your **Client Secret** - save this securely!

## Step 4: Get Your Discord Server (Guild) ID

1. Open Discord
2. Go to **User Settings → Advanced** and enable **Developer Mode**
3. Right-click on your server name in the sidebar
4. Click **"Copy Server ID"**
5. Save this ID - it will be your `DISCORD_GUILD_ID`

## Step 5: Get the Required Role ID

1. In your Discord server, go to **Server Settings → Roles**
2. Right-click on the role you want to require for voting
3. Click **"Copy Role ID"**
4. Save this ID - it will be your `DISCORD_REQUIRED_ROLE_ID`

## Step 6: Create a Discord Bot (Required for Role Checking)

The application needs a bot to check user roles in your server:

1. In the Discord Developer Portal, go to your application
2. Click **"Bot"** in the left sidebar
3. Click **"Add Bot"** and confirm
4. Under **"Privileged Gateway Intents"**, enable:
   - **SERVER MEMBERS INTENT** (required to fetch member roles)
5. Click **"Reset Token"** and copy the bot token
6. Save this as your `DISCORD_BOT_TOKEN`

## Step 7: Invite the Bot to Your Server

1. Go to **"OAuth2" → "URL Generator"**
2. Under **"Scopes"**, select:
   - `bot`
3. Under **"Bot Permissions"**, select:
   - `View Channels` (optional, for basic access)
4. Copy the generated URL at the bottom
5. Open the URL in your browser and authorize the bot for your server

## Step 8: Configure Environment Variables

Create a `.env` file in the project root with:

```env
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_REQUIRED_ROLE_ID=your_role_id_here
SESSION_SECRET=generate_a_random_string_here
PORT=3000
```

### Generating a Session Secret

You can generate a secure random string using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Troubleshooting

### "Missing Access" Error

- Make sure the bot is in your Discord server
- Ensure the bot has the SERVER MEMBERS INTENT enabled

### "Invalid OAuth2 redirect_uri"

- Double-check that your redirect URL matches exactly what's configured in the Discord Developer Portal
- Make sure there are no trailing slashes or typos

### Role Check Failing

- Verify the role ID is correct
- Make sure the bot's role is higher than the role you're checking (in the server's role hierarchy)
- Confirm SERVER MEMBERS INTENT is enabled

## Security Notes

⚠️ **Never commit your `.env` file to version control!**

Add `.env` to your `.gitignore` file:

```
.env
node_modules/
```
