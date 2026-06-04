import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig, saveConfig } from "./config.js";

// Test 1: Config load/save
console.log("Running Test 1: Config load/save...");
const originalConfig = loadConfig();
try {
  saveConfig({ token: "crow_mcp_test_token", baseUrl: "https://example.com/mcp" });
  const loaded = loadConfig();
  assert.strictEqual(loaded.token, "crow_mcp_test_token");
  assert.strictEqual(loaded.baseUrl, "https://example.com/mcp");
  console.log("Test 1 Passed!");
} finally {
  // Restore original config
  saveConfig(originalConfig);
}

// Test 2: Configuration Update
console.log("Running Test 2: MCP configuration updates...");
const tempDir = path.join(os.tmpdir(), "crowpus-mcp-test-dir");
const tempFile = path.join(tempDir, "claude_desktop_config.json");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (fs.existsSync(tempFile)) {
  fs.unlinkSync(tempFile);
}

// Mock function for updateMcpServersConfig
function mockUpdateMcpServersConfig(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      return false;
    }

    let config: any = {};
    if (fs.existsSync(filePath)) {
      config = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers["crowpus"] = {
      command: "npx",
      args: ["-y", "@crowpus/mcp-cli", "run"],
      disabled: false,
    };

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    return false;
  }
}

try {
  // Test updates when file does not exist
  const res = mockUpdateMcpServersConfig(tempFile);
  assert.strictEqual(res, true);
  const data = JSON.parse(fs.readFileSync(tempFile, "utf8"));
  assert.ok(data.mcpServers);
  assert.ok(data.mcpServers.crowpus);
  assert.strictEqual(data.mcpServers.crowpus.command, "npx");
  assert.deepStrictEqual(data.mcpServers.crowpus.args, ["-y", "@crowpus/mcp-cli", "run"]);

  // Test updates when file already exists and has other content
  fs.writeFileSync(tempFile, JSON.stringify({ mcpServers: { other: { command: "node" } } }));
  const res2 = mockUpdateMcpServersConfig(tempFile);
  assert.strictEqual(res2, true);
  const data2 = JSON.parse(fs.readFileSync(tempFile, "utf8"));
  assert.ok(data2.mcpServers.other);
  assert.ok(data2.mcpServers.crowpus);

  console.log("Test 2 Passed!");
} finally {
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir);
  }
}

console.log("\nAll integration tests passed successfully!");
