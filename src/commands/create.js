import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadConfig, getConfigPath } from "../utils/config-store.js";

const TEMPLATE_REPO = "Webhikers/nextjs-vibe-starter";
const GITHUB_ORG = "Webhikers";
const DOMAIN_SUFFIX = "preview.webhikers.dev";

// ANSI colors
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function run(cmd, options = {}) {
  console.log(c.dim(`  → ${cmd}`));
  return execSync(cmd, { stdio: "inherit", ...options });
}

function runCapture(cmd, options = {}) {
  return execSync(cmd, { encoding: "utf-8", ...options }).trim();
}

async function coolifyApi(config, method, path, body) {
  const url = `${config.coolifyUrl}/api/v1${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${config.coolifyToken}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Coolify API error (${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data;
}

export async function createCommand(name) {
  console.log(c.bold(`\nCreating project: ${name}\n`));

  // --- 1. Check prerequisites ---
  const config = loadConfig();
  if (!config) {
    console.error(c.red(`Error: ${getConfigPath()} not found.`));
    console.error("Run 'webhikers config' first.");
    process.exit(1);
  }

  try {
    runCapture("which gh");
  } catch {
    console.error(c.red("Error: GitHub CLI (gh) not found."));
    console.error("Install it: https://cli.github.com");
    process.exit(1);
  }

  try {
    runCapture("gh auth status");
  } catch {
    console.error(c.red("Error: Not logged into GitHub CLI."));
    console.error("Run: gh auth login");
    process.exit(1);
  }

  // --- 2. Create GitHub repo from template ---
  console.log(c.cyan("1/5 Creating GitHub repo from template..."));

  run(
    `gh repo create ${GITHUB_ORG}/${name} --template ${TEMPLATE_REPO} --private`
  );

  console.log(c.dim("  Waiting for GitHub to prepare the repository..."));
  const maxRetries = 12;
  let cloned = false;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      runCapture(`gh repo clone ${GITHUB_ORG}/${name} ${name}`);
      cloned = true;
      break;
    } catch {
      console.log(c.dim(`  Retrying clone... (${i + 1}/${maxRetries})`));
    }
  }

  if (!cloned) {
    console.error(c.red("Error: Could not clone repo after 60 seconds."));
    console.error(`Try manually: gh repo clone ${GITHUB_ORG}/${name}`);
    process.exit(1);
  }

  const projectDir = resolve(process.cwd(), name);
  if (!existsSync(projectDir)) {
    console.error(c.red(`Error: Expected directory ${projectDir} not found.`));
    process.exit(1);
  }
  console.log(c.green("  ✓ Repo created and cloned"));

  // --- 3. npm install ---
  console.log(c.cyan("\n2/5 Installing dependencies..."));
  run("npm install", { cwd: projectDir });
  console.log(c.green("  ✓ Dependencies installed"));

  // --- 4. Generate .env ---
  console.log(c.cyan("\n3/5 Generating .env..."));
  const payloadSecret = runCapture("openssl rand -hex 32");
  const domain = `${name}.${DOMAIN_SUFFIX}`;
  const siteUrl = `https://${domain}`;
  const envContent = [
    `PAYLOAD_SECRET=${payloadSecret}`,
    `SITE_URL=http://localhost:3000`,
    "",
  ].join("\n");

  writeFileSync(resolve(projectDir, ".env"), envContent, "utf-8");
  console.log(c.green("  ✓ .env written"));

  // --- 5. Setup Coolify deployment ---
  console.log(c.cyan("\n4/5 Setting up Coolify deployment..."));
  console.log(`  Domain: ${c.bold(domain)}`);

  console.log(c.dim("  Creating Coolify project..."));
  const project = await coolifyApi(config, "POST", "/projects", {
    name,
    description: `${name} - deployed via webhikers CLI`,
  });
  const projectUuid = project.uuid;

  console.log(c.dim("  Reading compose file..."));
  const composeContent = readFileSync(resolve(projectDir, "docker-compose.yaml"), "utf-8");
  const composeBase64 = Buffer.from(composeContent).toString("base64");

  console.log(c.dim("  Creating application..."));
  const app = await coolifyApi(config, "POST", "/applications/private-github-app", {
    project_uuid: projectUuid,
    server_uuid: config.serverUuid,
    environment_name: "production",
    github_app_uuid: config.githubAppUuid,
    git_repository: `Webhikers/${name}`,
    git_branch: "master",
    build_pack: "dockercompose",
    ports_exposes: "3000",
    docker_compose_raw: composeBase64,
    docker_compose_domains: [
      { name: "app", domain: `https://${domain}` },
    ],
    instant_deploy: true,
  });
  const appUuid = app.uuid;

  console.log(c.dim("  Setting environment variables..."));
  await coolifyApi(config, "POST", `/applications/${appUuid}/envs`, {
    key: "PAYLOAD_SECRET",
    value: payloadSecret,
    is_preview: false,
  });
  await coolifyApi(config, "POST", `/applications/${appUuid}/envs`, {
    key: "SITE_URL",
    value: siteUrl,
    is_preview: false,
  });
  console.log(c.green("  ✓ Coolify project configured"));

  // --- 7. Write .deploy.json + enable sync guard ---
  console.log(c.cyan("\n5/5 Writing .deploy.json..."));
  const deployConfig = {
    serverIp: config.serverIp,
    domain,
    coolifyProjectUuid: projectUuid,
    coolifyAppUuid: appUuid,
  };
  writeFileSync(
    resolve(projectDir, ".deploy.json"),
    JSON.stringify(deployConfig, null, 2) + "\n",
    "utf-8"
  );
  const guardPath = resolve(projectDir, ".claude-guard.json");
  const guard = JSON.parse(readFileSync(guardPath, "utf-8"));
  guard.fileGuard = true;
  guard.syncGuard = true;
  writeFileSync(guardPath, JSON.stringify(guard, null, 2) + "\n", "utf-8");
  run(`git add .deploy.json .claude-guard.json && git commit -m "Enable guards + deploy config" && git push`, { cwd: projectDir });
  console.log(c.green("  ✓ .deploy.json + guards written"));

  // --- 8. Summary ---
  console.log("\n" + c.green("═══════════════════════════════════════════"));
  console.log(c.green(c.bold("  Project created successfully!")));
  console.log(c.green("═══════════════════════════════════════════\n"));

  console.log(`  ${c.bold("Repo:")}     https://github.com/${GITHUB_ORG}/${name}`);
  console.log(`  ${c.bold("Domain:")}   https://${domain}`);
  console.log(`  ${c.bold("Coolify:")}  ${config.coolifyUrl}`);
  console.log(`  ${c.bold("Dir:")}      ${projectDir}`);

  console.log(c.green(`\n  Volumes are configured automatically via docker-compose.yml.`));
  console.log(c.yellow(`\n  To deploy: Open Coolify UI → Projects → "${name}" → Deploy`));

  console.log(`\n  ${c.bold("Local dev:")} cd ${name} && npm run dev\n`);
}
