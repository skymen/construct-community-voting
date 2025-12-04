#!/bin/bash

# SSL Setup Script using Let's Encrypt
# Usage: ssh root@155.138.229.144 'bash -s' < setup-ssl.sh YOUR_DOMAIN

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ssh root@155.138.229.144 'bash -s' < setup-ssl.sh construct-community-voting.dedragames.com"
    exit 1
fi

echo "🔒 Setting up SSL for $DOMAIN..."

# Install Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Update nginx config with domain
cat > /etc/nginx/sites-available/oc-vote << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Reload nginx with new config
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# Set up auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "Your site is now available at: https://$DOMAIN"
echo ""
echo "⚠️  Don't forget to update your Discord OAuth redirect URI to:"
echo "   https://$DOMAIN/auth/discord/callback"
echo ""
echo "Update .env on server:"
echo "   REDIRECT_URI=https://$DOMAIN/auth/discord/callback"
echo ""
echo "Then restart: pm2 restart oc-vote"

