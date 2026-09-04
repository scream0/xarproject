module.exports = {
  apps: [
    {
      name: "mameko-api",
      script: "./api.exe",
      cwd: "./",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "mameko-tunnel",
      script: "./cloudflared.exe",
      args: "tunnel --config config.yml run",
      cwd: "./",
      watch: false
    }
  ]
};
