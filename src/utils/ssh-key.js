import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SSH_DIR = join(homedir(), ".ssh");

export function findSSHKeys() {
  if (!existsSync(SSH_DIR)) return [];

  const files = readdirSync(SSH_DIR);
  const keys = [];

  for (const file of files) {
    if (file.endsWith(".pub")) continue;
    if (file === "known_hosts" || file === "config" || file === "authorized_keys") continue;
    if (file.startsWith(".")) continue;

    const privatePath = join(SSH_DIR, file);
    const pubPath = privatePath + ".pub";

    if (!existsSync(pubPath)) continue;

    let comment = "";
    try {
      const pubContent = readFileSync(pubPath, "utf-8").trim();
      const parts = pubContent.split(" ");
      if (parts.length >= 3) {
        comment = parts.slice(2).join(" ");
      }
    } catch {}

    keys.push({
      name: `~/.ssh/${file}${comment ? ` (${comment})` : ""}`,
      value: privatePath,
    });
  }

  return keys;
}
