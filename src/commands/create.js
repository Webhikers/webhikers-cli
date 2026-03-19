import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadConfig, getConfigPath } from "../utils/config-store.js";

const TEMPLATE_REPO = "Webhikers/nextjs-vibe-starter";
const GITHUB_ORG = "Webhikers";

function run(cmd, options = {}) {
  console.log(`  → ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...options });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
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
  const envContent = [
    `PAYLOAD_SECRET=${payloadSecret}`,
    `SITE_URL=http://localhost:3000`,
    "",
  ].join("\n");

  writeFileSync(resolve(projectDir, ".env"), envContent, "utf-8");
  console.log("  .env written (PAYLOAD_SECRET + SITE_URL)");

  // --- 5. Setup Coolify deployment ---
  console.log("\nSetting up Coolify deployment...");
  run(`npm run setup:deploy -- --name ${name}`, { cwd: projectDir });

  // --- 6. Summary ---
  console.log("");
  console.log("=========================================");
  console.log("  Project created successfully!");
  console.log("=========================================");
  console.log("");
  console.log(`  Repo:    https://github.com/${GITHUB_ORG}/${name}`);
  console.log(`  Domain:  https://${name}.webhikers.site`);
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
