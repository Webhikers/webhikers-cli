# @webhikers/cli

CLI for creating and deploying webhikers projects on Hetzner/Coolify.

## Prerequisites

Before using this CLI, you need:

1. **Hetzner Cloud Server** with Coolify installed
2. **Wildcard DNS** `*.preview.webhikers.dev` pointing to your server IP
3. **GitHub CLI** (`gh`) installed and authenticated
4. **Node.js** >= 18
5. **SSH Key** on your machine, added to the Hetzner server

### Server Setup (one-time)

1. Create a Hetzner CX23 server (Ubuntu 24.04)
2. Add your SSH public key during server creation
3. SSH into the server: `ssh -i ~/.ssh/your-key root@SERVER_IP`
4. Install Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
5. Open `http://SERVER_IP:8000`, create admin account
6. Enable API access: Settings → API Settings → API Access checkbox
7. Create API token: Keys & Tokens → create token with root permissions
8. Note your Server UUID: Servers → click server → UUID is in the URL

### DNS Setup (one-time)

Add a wildcard A record for your domain:

| Type | Name | Value |
|------|------|-------|
| A | `*.preview` | `SERVER_IP` |

This makes every project available at `project-name.preview.webhikers.dev`.

## Install

```bash
npm install -g @webhikers/cli
```

## Setup (once per machine)

```bash
webhikers config
```

You will be asked for:

| Prompt | Where to find it |
|--------|-----------------|
| Server IP | Hetzner Cloud Console → Server |
| Coolify Port | Default: 8000 |
| Coolify API Token | Coolify UI → Keys & Tokens |
| Server UUID | Coolify UI → Servers → UUID in URL |
| SSH User | Default: root |
| SSH Key | Select from detected keys on your machine |

Config is saved to `~/.config/webhikers/config.json`.

## Create a new project

```bash
webhikers create my-project
```

This will:

1. Create a private GitHub repo from the `nextjs-vibe-starter` template
2. Clone it and install dependencies
3. Generate `.env` with a random `PAYLOAD_SECRET`
4. Create a Coolify project with domain `my-project.preview.webhikers.dev`
5. Set environment variables in Coolify
6. Trigger the first deploy

After creation, add persistent volumes in Coolify UI:

1. Open Coolify → Projects → select your project
2. Go to **Storages** tab
3. Add volume: `/app/data` (SQLite database)
4. Add volume: `/app/public/media` (uploaded images)
5. Redeploy the application

Then start local development:

```bash
cd my-project && npm run dev
```

## Architecture

```
~/.config/webhikers/
  config.json        ← Coolify token, server IP, SSH config (global)
  ssh_key            ← SSH private key (chmod 600)

project/
  .env               ← PAYLOAD_SECRET + SITE_URL (local dev, gitignored)
  .deploy.json       ← Server IP, domain, Coolify UUIDs (gitignored)
```

- **Local dev:** `npm run dev` → localhost:3000
- **Sync from prod:** `npm run sync:pull` (git pull + DB + media)
- **Deploy:** `npm run sync:push` (media push + git push → Coolify builds)
- **Coolify** handles Docker build, Payload migrations, and seed on every deploy

## Adding a team member

Your team member creates their own SSH key and sends you the public key (`.pub` file). Then:

```bash
ssh -i ~/.ssh/your-key root@SERVER_IP
echo "their-public-key-content" >> /root/.ssh/authorized_keys
```

They install the CLI and run `webhikers config` with the same server details.

## Scaling

| Server | RAM | Capacity |
|--------|-----|----------|
| CX23 | 4 GB | 5-10 sites |
| CX33 | 8 GB | 20-30 sites |
| CX43 | 16 GB | 50-80 sites |
| CX53 | 32 GB | 100-150 sites |

Upgrade via Hetzner Console (30 sec, no data loss). For 150+ sites, add a second server — Coolify manages multiple servers natively.

## License

MIT
