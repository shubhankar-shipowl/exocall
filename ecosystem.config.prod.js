module.exports = {
  apps: [
    {
      name: 'exocall-prod',
      script: 'node',
      args: `-e "const { spawn } = require('child_process'); const path = require('path'); require('dotenv').config({ path: './server/.env' }); console.log('🚀 Starting ExoCall Dashboard (production mode)...'); const server = spawn('node', ['index.js'], { cwd: path.resolve(__dirname, 'server'), env: { ...process.env, NODE_ENV: 'production', PORT: 8006 }, stdio: ['pipe','pipe','pipe'] }); server.stdout.on('data', d => process.stdout.write(\`[Server] \${d}\`)); server.stderr.on('data', d => process.stderr.write(\`[Server Error] \${d}\`)); const shutdown = () => { console.log('Shutting down ExoCall production server...'); try { server.kill('SIGTERM'); } catch(_){} process.exit(0); }; process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);"`,
      cwd: '.',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: './server/.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      log_file: './logs/prod-combined.log',
      time: true,
    },
  ],
};
