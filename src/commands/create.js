import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import { loadConfig, getConfigPath } from "../utils/config-store.js";

const TEMPLATE_REPO = "Webhikers/nextjs-vibe-starter";
const GITHUB_ORG = "Webhikers";
const DOMAIN_SUFFIX = "preview.webhikers.dev";

function run(cmd, options = {}) {
  console.log(`  → ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...options });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
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
  console.log(`\nCreating project: ${name}\n`);

  // --- 1. Check prerequisites ---
  const config = loadConfig();
  if (!config) {
    console.error(`Error: ${getConfigPath()} not found.`);
    console.error("Run 'webhikers config' first.");
    process.exit(1);
  }

  try {
    runCapture("which gh");
  } catch {
    console.error("Error: GitHub CLI (gh) not found.");
    console.error("Install it: https://cli.github.com");
    process.exit(1);
  }

  try {
    runCapture("gh auth status");
  } catch {
    console.error("Error: Not logged into GitHub CLI.");
    console.error("Run: gh auth login");
    process.exit(1);
  }

  // --- 2. Create GitHub repo from template ---
  console.log("Creating GitHub repo from template...");
  run(
    `gh repo create ${GITHUB_ORG}/${name} --template ${TEMPLATE_REPO} --private --clone`
  );

  const projectDir = resolve(process.cwd(), name);
  if (!existsSync(projectDir)) {
    console.error(`Error: Expected directory ${projectDir} not found.`);
    process.exit(1);
  }

  // --- 3. npm install ---
  console.log("\nInstalling dependencies...");
  run("npm install", { cwd: projectDir });

  // --- 4. Generate .env ---
  console.log("\nGenerating .env...");
  const payloadSecret = runCapture("openssl rand -hex 32");
  const domain = `${name}.${DOMAIN_SUFFIX}`;
  const siteUrl = `https://${domain}`;
  const envContent = [
    `PAYLOAD_SECRET=${payloadSecret}`,
    `SITE_URL=http://localhost:3000`,
    "",
  ].join("\n");

  writeFileSync(resolve(projectDir, ".env"), envContent, "utf-8");
  console.log("  .env written (PAYLOAD_SECRET + SITE_URL)");

  // --- 5. Get git remote URL ---
  let gitRepo;
  try {
    gitRepo = runCapture("git remote get-url origin", { cwd: projectDir });
  } catch {
    console.error("Error: No git remote 'origin' found.");
    process.exit(1);
  }

  // --- 6. Setup Coolify deployment ---
  console.log("\nSetting up Coolify deployment...");
  console.log(`  Domain: ${domain}`);
  console.log(`  Git repo: ${gitRepo}`);

  // Create project
  console.log("  Creating Coolify project...");
  const project = await coolifyApi(config, "POST", "/projects", {
    name,
    description: `${name} — deployed via webhikers CLI`,
  });
  const projectUuid = project.uuid;
  console.log(`  Project created: ${projectUuid}`);

  // Create application
  console.log("  Creating application...");
  const app = await coolifyApi(config, "POST", "/applications/public", {
    project_uuid: projectUuid,
    server_uuid: config.serverUuid,
    environment_name: "production",
    git_repository: gitRepo,
    git_branch: "master",
    build_pack: "dockerfile",
    ports_exposes: "3000",
    instant_deploy: false,
  });
  const appUuid = app.uuid;
  console.log(`  Application created: ${appUuid}`);

  // Set domain
  console.log(`  Setting domain to ${domain}...`);
  await coolifyApi(config, "PATCH", `/applications/${appUuid}`, {
    domains: `https://${domain}`,
  });

  // Set environment variables
  console.log("  Setting environment variables...");
  await coolifyApi(config, "POST", `/applications/${appUuid}/envs`, {
    key: "PAYLOAD_SECRET",
    value: payloadSecret,
    is_build_time: true,
  });
  await coolifyApi(config, "POST", `/applications/${appUuid}/envs`, {
    key: "SITE_URL",
    value: siteUrl,
    is_build_time: true,
  });

  // --- 7. Write .deploy.json ---
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
  console.log("  .deploy.json written");

  // --- 8. Summary ---
  console.log("");
  console.log("=========================================");
  console.log("  Project created successfully!");
  console.log("=========================================");
  console.log("");
  console.log(`  Repo:    https://github.com/${GITHUB_ORG}/${name}`);
  console.log(`  Domain:  https://${domain}`);
  console.log(`  Dir:     ${projectDir}`);
  console.log("");
  console.log("  MANUAL STEP:");
  console.log("  Open Coolify UI → Application → Storages");
  console.log("  Add two volumes:");
  console.log("    1. /app/data          (SQLite database)");
  console.log("    2. /app/public/media  (uploaded images)");
  console.log("");
  console.log(`  Ready! Run: cd ${name} && npm run dev`);
  console.log("=========================================");
}
