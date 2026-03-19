# @webhikers/cli

CLI for creating and deploying webhikers projects.

## Install

```bash
npm install -g @webhikers/cli
```

## Setup (once per machine)

```bash
webhikers config
```

Configures Coolify API token, server credentials, and SSH key.

## Create a new project

```bash
webhikers create my-project
```

This will:
1. Create a private GitHub repo from the `nextjs-vibe-starter` template
2. Clone it and install dependencies
3. Generate `.env` with a random `PAYLOAD_SECRET`
4. Create a Coolify project and configure the domain (`my-project.webhikers.site`)

After creation, add persistent volumes in Coolify UI, then start developing:

```bash
cd my-project && npm run dev
```

## License

MIT
