#!/usr/bin/env bash
# Ships the MCP server to its exe.dev VM and (re)starts it.
# Usage: mcp/deploy-exe.sh [vm-name]   (default: rohanth-site-mcp)
#
# GitHub access comes from exe.dev's GitHub integration (no token on the VM):
#   ssh exe.dev int add github --name rohanth-site --repository rohanthmarem/rohanth-site \
#     --act-as-user --attach vm:rohanth-site-mcp
# --act-as-user matters: commits must be authored by you or Vercel blocks the deploy.
set -euo pipefail

VM="${1:-rohanth-site-mcp}"
HOST="$VM.exe.xyz"
cd "$(dirname "$0")/.."

COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf - package.json package-lock.json mcp src/content.schemas.ts |
  ssh "$HOST" 'rm -rf ~/app.new && mkdir -p ~/app.new && tar xzf - -C ~/app.new'

ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
command -v node >/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
  sudo apt-get install -y nodejs >/dev/null
}

cd ~/app.new
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null
rm -rf ~/app && mv ~/app.new ~/app

# Generated once, on the VM. Read it with: ssh <vm>.exe.xyz sudo cat /etc/rohanth-site-mcp.env
if [ ! -f /etc/rohanth-site-mcp.env ]; then
  printf 'SITE_MCP_TOKEN=%s\nGITHUB_API_URL=https://github.int.exe.xyz/api/v3\n' "$(openssl rand -hex 32)" |
    sudo tee /etc/rohanth-site-mcp.env >/dev/null
  sudo chmod 600 /etc/rohanth-site-mcp.env
fi

sudo tee /etc/systemd/system/rohanth-site-mcp.service >/dev/null <<UNIT
[Unit]
Description=rohanth.com MCP server
Wants=network-online.target
After=network-online.target

[Service]
User=$USER
WorkingDirectory=$HOME/app
EnvironmentFile=/etc/rohanth-site-mcp.env
Environment=PORT=8000
ExecStart=$(command -v node) mcp/http.ts
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable rohanth-site-mcp >/dev/null 2>&1
sudo systemctl restart rohanth-site-mcp
sleep 2
curl -fsS localhost:8000/health && echo
REMOTE

echo "MCP endpoint: https://$HOST/mcp"
