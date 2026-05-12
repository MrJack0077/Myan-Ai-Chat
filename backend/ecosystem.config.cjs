module.exports = {
  apps: [
    {
      name: 'backend-ai',
      script: 'main.py',
      interpreter: '/home/tirus/Work/Real Myan Social/backend/venv/bin/python3',
      cwd: '/home/tirus/Work/Real Myan Social/backend',
      
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      
      watch: false,
      ignore_watch: ['__pycache__', '*.log', '.git', 'venv'],
      
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      env: {
        PYTHONUNBUFFERED: '1',
      },
      
      max_memory_restart: '500M',
    },
    {
      name: 'frontend',
      script: 'server.ts',
      interpreter: '/home/tirus/Work/Real Myan Social/node_modules/.bin/tsx',
      cwd: '/home/tirus/Work/Real Myan Social',
      
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      
      watch: false,
      ignore_watch: ['node_modules', 'dist', '.git', 'backend'],
      
      error_file: './backend/logs/frontend-err.log',
      out_file: './backend/logs/frontend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      env: {
        NODE_ENV: 'development',
        PM2_MANAGED: 'true',
      },
      
      max_memory_restart: '500M',
    }
  ]
};
