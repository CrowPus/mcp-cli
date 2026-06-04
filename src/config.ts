import os from "os";
import path from "path";
import fs from "fs";

const CONFIG_DIR = path.join(os.homedir(), ".config", "crowpus");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  token?: string;
  baseUrl?: string;
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    // Ignore read errors, return empty config
  }
  return {};
}

export function saveConfig(config: Config): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
      encoding: "utf8",
      mode: 0o600, // Read/write permissions for current user only
    });
  } catch (err) {
    throw new Error(`Failed to save config: ${(err as Error).message}`);
  }
}
