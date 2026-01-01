module.exports = {
  apps: [
    {
      name: 'exocall',
      script: 'node',
      args: `-e "const { spawn } = require('child_process'); const path = require('path'); console.log('🚀 Starting Shipowl Connect (combined mode)...'); const backend = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, 'server'), env: { ...process.env, NODE_ENV: 'development', PORT: 8006 }, stdio: ['ignore','pipe','pipe'] }); const frontend = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, 'client'), env: { ...process.env, NODE_ENV: 'development', PORT: 3000 }, stdio: ['ignore','pipe','pipe'] }); backend.stdout.on('data', d => process.stdout.write(\`[Backend] \${d}\`)); backend.stderr.on('data', d => process.stderr.write(\`[Backend Error] \${d}\`)); frontend.stdout.on('data', d => process.stdout.write(\`[Frontend] \${d}\`)); frontend.stderr.on('data', d => process.stderr.write(\`[Frontend Error] \${d}\`)); const shutdown = () => { console.log('Shutting down Shipowl Connect...'); try { backend.kill('SIGTERM'); } catch(_){} try { frontend.kill('SIGTERM'); } catch(_){} process.exit(0); }; process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);"`,
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: './server/.env',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
