module.exports = {
  apps: [
    {
      name: "oc-vote",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
  ],

  deploy: {
    production: {
      user: "root",
      host: "155.138.229.144",
      ref: "origin/main",
      repo: "git@github.com:YOUR_USERNAME/YOUR_REPO.git", // Update this with your repo
      path: "/var/www/oc-vote",
      "pre-deploy-local": "",
      "post-deploy":
        "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
