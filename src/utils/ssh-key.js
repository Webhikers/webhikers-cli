import { writeFileSync, chmodSync } from "fs";
import { join } from "path";
import { getConfigDir } from "./config-store.js";

const SSH_KEY_FILENAME = "ssh_key";

export function getSSHKeyPath() {
  return join(getConfigDir(), SSH_KEY_FILENAME);
}

export function saveSSHKey(keyContent) {
  const keyPath = getSSHKeyPath();
  const normalized = keyContent.trim() + "\n";
  writeFileSync(keyPath, normalized, "utf-8");
  chmodSync(keyPath, 0o600);
  return keyPath;
}
