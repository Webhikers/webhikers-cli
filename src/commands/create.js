import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { loadConfig, getConfigPath } from "../utils/config-store.js";

const TEMPLATE_REPO = "Webhikers/nextjs-vibe-starter";
const GITHUB_ORG = "Webhikers";

// ANSI colors
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
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
  console.log(c.cyan("1/4 Creating GitHub repo from template..."));

  run(
    `gh repo create ${GITHUB_ORG}/${name} --template ${TEMPLATE_REPO} --private`,
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

  const projectDir = new URL(`file://${process.cwd()}/${name}`).pathname;
  if (!existsSync(projectDir)) {
    console.error(c.red(`Error: Expected directory ${projectDir} not found.`));
    process.exit(1);
  }
  console.log(c.green("  ✓ Repo created and cloned"));

  // --- 3. npm install ---
  console.log(c.cyan("\n2/4 Installing dependencies..."));
  run("npm install", { cwd: projectDir });
  console.log(c.green("  ✓ Dependencies installed"));

  // --- 4. Template setup (everything happens in the template script) ---
  console.log(c.cyan("\n3/4 Running template setup..."));
  run(
    `bash scripts/template-setup.sh "${name}" "${config.coolifyToken}" "${config.serverIp}" "${config.serverUuid}" "${config.githubAppUuid}"`,
    { cwd: projectDir },
  );
  console.log(c.green("  ✓ Template setup complete"));

  // --- 5. Commit + Push ---
  console.log(c.cyan("\n4/4 Committing and pushing..."));
  run(
    'git add -A && git commit -m "Initial project setup" && git push',
    { cwd: projectDir },
  );
  console.log(c.green("  ✓ Pushed to GitHub"));

  // --- Summary ---
  const domain = `${name}.preview.webhikers.dev`;
  console.log(
    "\n" + c.green("═══════════════════════════════════════════"),
  );
  console.log(c.green(c.bold("  Project created successfully!")));
  console.log(
    c.green("═══════════════════════════════════════════\n"),
  );

  console.log(
    `  ${c.bold("Repo:")}     https://github.com/${GITHUB_ORG}/${name}`,
  );
  console.log(`  ${c.bold("Domain:")}   https://${domain}`);
  console.log(`  ${c.bold("Coolify:")}  ${config.coolifyUrl}`);
  console.log(`  ${c.bold("Dir:")}      ${projectDir}`);

  console.log(
    `\n  ${c.bold("To deploy:")} Open Coolify UI → Projects → "${name}" → Deploy`,
  );
  console.log(`\n  ${c.bold("Local dev:")} cd ${name} && npm run dev\n`);
}
