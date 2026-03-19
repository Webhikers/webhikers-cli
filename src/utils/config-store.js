import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "webhikers");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getConfigDir() {
  return CONFIG_DIR;
}

export function getConfigPath() {
  return CONFIG_FILE;
}

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  const raw = readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(raw);
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function maskValue(value) {
  if (!value || value.length < 8) return "***";
  return value.slice(0, 4) + "..." + value.slice(-4);
}
