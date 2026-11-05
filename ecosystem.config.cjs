module.exports = {
  apps: [
    {
      name: "whatsapp-assistant",
      script: "src/index.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3333,
        IS_CLOUD: "true"
      }
    }
  ]
};
