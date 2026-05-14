module.exports = {
  apps: [{
    name: 'kdri-mis',
    script: './server/app.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/access.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    cron_restart: '0 5 * * *',
  }],
};
