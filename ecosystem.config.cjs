module.exports = {
  apps: [
    {
      name: "backend-ai",
      cwd: "/home/tirus/Work/Real Myan Social/backend",
      script: "main.py",
      interpreter: "/home/tirus/Work/Real Myan Social/backend/venv/bin/python3",
      error_file: "/home/tirus/Work/Real Myan Social/backend/logs/err.log",
      out_file: "/home/tirus/Work/Real Myan Social/backend/logs/out.log",
      max_memory_restart: "512M",
      env: {
        PM2_MANAGED: "true",
      },
    },
    {
      name: "frontend",
      cwd: "/home/tirus/Work/Real Myan Social",
      script: "server.ts",
      interpreter: "/home/tirus/Work/Real Myan Social/node_modules/.bin/tsx",
      error_file: "/home/tirus/Work/Real Myan Social/backend/logs/frontend-err.log",
      out_file: "/home/tirus/Work/Real Myan Social/backend/logs/frontend-out.log",
      max_memory_restart: "1G",
      env: {
        PM2_MANAGED: "true",
      },
    },
  ],
};
