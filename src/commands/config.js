import inquirer from "inquirer";
import {
  loadConfig,
  saveConfig,
  maskValue,
  getConfigPath,
} from "../utils/config-store.js";
import { saveSSHKey, getSSHKeyPath } from "../utils/ssh-key.js";

export async function configCommand() {
  const existing = loadConfig();

  if (existing) {
    console.log("\nExisting configuration found:");
    console.log(`  Coolify URL:    ${existing.coolifyUrl || "—"}`);
    console.log(`  Coolify Token:  ${maskValue(existing.coolifyToken)}`);
    console.log(`  Server UUID:    ${maskValue(existing.serverUuid)}`);
    console.log(`  Server IP:      ${existing.serverIp || "—"}`);
    console.log(`  SSH User:       ${existing.sshUser || "—"}`);
    console.log(`  SSH Key:        ${getSSHKeyPath()}`);
    console.log("");

    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Overwrite existing configuration?",
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log("Configuration unchanged.");
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "coolifyUrl",
      message: "Coolify URL (e.g. https://coolify.your-server.de):",
      validate: (v) => (v.startsWith("http") ? true : "Must start with http"),
    },
    {
      type: "password",
      name: "coolifyToken",
      message: "Coolify API Token:",
      mask: "*",
      validate: (v) => (v.length > 0 ? true : "Token is required"),
    },
    {
      type: "input",
      name: "serverUuid",
      message: "Server UUID (from Coolify UI → Servers):",
      validate: (v) => (v.length > 0 ? true : "Server UUID is required"),
    },
    {
      type: "input",
      name: "serverIp",
      message: "Server IP address:",
      validate: (v) => (v.length > 0 ? true : "Server IP is required"),
    },
    {
      type: "input",
      name: "sshUser",
      message: "SSH User:",
      default: "root",
    },
    {
      type: "editor",
      name: "sshKey",
      message:
        "SSH Private Key (your editor will open — paste the key, save, and close):",
      validate: (v) =>
        v.includes("PRIVATE KEY") ? true : "Does not look like a valid SSH key",
    },
  ]);

  const keyPath = saveSSHKey(answers.sshKey);

  const config = {
    coolifyUrl: answers.coolifyUrl.replace(/\/+$/, ""),
    coolifyToken: answers.coolifyToken,
    serverUuid: answers.serverUuid,
    serverIp: answers.serverIp,
    sshUser: answers.sshUser,
    sshKeyPath: keyPath,
  };

  saveConfig(config);

  console.log(`\nConfiguration saved to ${getConfigPath()}`);
  console.log(`SSH key saved to ${keyPath}`);
  console.log("\nDone! You can now run: webhikers create <project-name>");
}
