import inquirer from "inquirer";
import {
  loadConfig,
  saveConfig,
  maskValue,
  getConfigPath,
} from "../utils/config-store.js";
import { findSSHKeys } from "../utils/ssh-key.js";

const DEFAULT_COOLIFY_PORT = "8000";

export async function configCommand() {
  const existing = loadConfig();

  if (existing) {
    console.log("\nExisting configuration found:");
    console.log(`  Server IP:      ${existing.serverIp || "—"}`);
    console.log(`  Coolify Port:   ${existing.coolifyPort || DEFAULT_COOLIFY_PORT}`);
    console.log(`  Coolify Token:  ${maskValue(existing.coolifyToken)}`);
    console.log(`  Server UUID:    ${maskValue(existing.serverUuid)}`);
    console.log(`  SSH User:       ${existing.sshUser || "—"}`);
    console.log(`  SSH Key:        ${existing.sshKeyPath || "—"}`);
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

  // --- SSH Key selection ---
  const sshKeys = findSSHKeys();
  let sshKeyPath;

  if (sshKeys.length > 0) {
    const sshChoices = [
      ...sshKeys,
      { name: "Enter path manually", value: "__manual__" },
    ];

    const { selectedKey } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedKey",
        message: "SSH Key auswählen:",
        choices: sshChoices,
      },
    ]);

    if (selectedKey === "__manual__") {
      const { manualPath } = await inquirer.prompt([
        {
          type: "input",
          name: "manualPath",
          message: "SSH Key Pfad:",
          validate: (v) => (v.length > 0 ? true : "Pfad ist erforderlich"),
        },
      ]);
      sshKeyPath = manualPath;
    } else {
      sshKeyPath = selectedKey;
    }
  } else {
    console.log("\nKein SSH Key gefunden. Erstelle einen:");
    console.log("  ssh-keygen -t ed25519 -f ~/.ssh/hetzner");
    console.log("Dann füge ~/.ssh/hetzner.pub bei Hetzner hinzu:");
    console.log("  Hetzner Console → Security → SSH Keys → Add\n");
    process.exit(1);
  }

  // --- Server + Coolify config ---
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "serverIp",
      message: "Server IP-Adresse:\n  (Hetzner Cloud Console → Server → IP-Adresse)\n ",
      validate: (v) => (v.length > 0 ? true : "IP ist erforderlich"),
    },
    {
      type: "input",
      name: "coolifyPort",
      message: "Coolify Port:\n  (Standard ist 8000, Enter drücken wenn korrekt)\n ",
      default: DEFAULT_COOLIFY_PORT,
    },
    {
      type: "password",
      name: "coolifyToken",
      message: "Coolify API Token:\n  (Coolify UI → Keys & Tokens → API Token erstellen)\n ",
      mask: "*",
      validate: (v) => (v.length > 0 ? true : "Token ist erforderlich"),
    },
    {
      type: "input",
      name: "serverUuid",
      message: "Server UUID:\n  (Coolify UI → Servers → auf Server klicken → UUID steht in der URL)\n ",
      validate: (v) => (v.length > 0 ? true : "UUID ist erforderlich"),
    },
    {
      type: "input",
      name: "sshUser",
      message: "SSH User:\n  (Standard ist root, Enter drücken wenn korrekt)\n ",
      default: "root",
    },
  ]);

  const coolifyUrl = `http://${answers.serverIp}:${answers.coolifyPort}`;

  const config = {
    serverIp: answers.serverIp,
    coolifyPort: answers.coolifyPort,
    coolifyUrl,
    coolifyToken: answers.coolifyToken,
    serverUuid: answers.serverUuid,
    sshUser: answers.sshUser,
    sshKeyPath,
  };

  saveConfig(config);

  console.log(`\nConfiguration saved to ${getConfigPath()}`);
  console.log(`Coolify URL: ${coolifyUrl}`);
  console.log("\nDone! You can now run: webhikers create <project-name>");
}
