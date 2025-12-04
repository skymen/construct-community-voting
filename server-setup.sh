#!/bin/bash

# Initial server setup script
# Run this once on a fresh server: ssh root@155.138.229.144 'bash -s' < server-setup.sh

set -e

echo "🔧 Setting up server..."

# Update system
apt-get update && apt-get upgrade -y

# Install essential packages
apt-get install -y curl git build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /var/www/oc-vote

# Set up firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw allow 4000/tcp # App port
    ufw --force enable
fi

# Install nginx for reverse proxy (optional but recommended)
apt-get install -y nginx

# Create nginx config for the app
cat > /etc/nginx/sites-available/oc-vote << 'EOF'
server {
    listen 80;
    server_name 155.138.229.144;  # Replace with your domain if you have one

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/oc-vote /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Run ./deploy.sh from your local machine"
echo "2. Create .env file on server: nano /var/www/oc-vote/.env"
echo "3. Your app will be available at http://155.138.229.144"

