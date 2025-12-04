#!/bin/bash

# Deployment script for Open Collective Vote
# Usage: ./deploy.sh

set -e

SERVER="root@155.138.229.144"
APP_DIR="/var/www/oc-vote"
APP_NAME="oc-vote"

echo "🚀 Deploying to $SERVER..."

# Create app directory if it doesn't exist
ssh $SERVER "mkdir -p $APP_DIR"

# Sync files (excluding node_modules, .env, votes.json)
echo "📦 Syncing files..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'votes.json' \
  --exclude '.git' \
  --exclude '*.md' \
  ./ $SERVER:$APP_DIR/

# Install dependencies and restart with PM2
echo "📥 Installing dependencies and starting app..."
ssh $SERVER << 'ENDSSH'
cd /var/www/oc-vote

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Install dependencies
npm install --production

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo "Please create /var/www/oc-vote/.env with your configuration"
fi

# Start or restart the app with PM2
pm2 describe oc-vote > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Restarting app..."
    pm2 reload oc-vote
else
    echo "Starting app..."
    pm2 start ecosystem.config.js --env production
fi

# Save PM2 process list and set up startup script
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "✅ Deployment complete!"
pm2 status
ENDSSH

echo ""
echo "🎉 Deployment finished!"
echo ""
echo "Next steps:"
echo "1. SSH into server: ssh $SERVER"
echo "2. Create .env file: nano $APP_DIR/.env"
echo "3. Add your Discord credentials (see env.example)"
echo "4. Restart the app: pm2 restart oc-vote"
echo ""
echo "View logs: ssh $SERVER 'pm2 logs oc-vote'"

