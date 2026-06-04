#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsResultSchema,
  CallToolResultSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsResultSchema,
  GetPromptResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
// @ts-ignore
import EventSource from "eventsource";
import fs from "fs";
import os from "os";
import path from "path";
import { loadConfig, saveConfig } from "./config.js";

// Polyfill EventSource for Model Context Protocol SDK SSE Client
(globalThis as any).EventSource = EventSource;

function printHelp(): void {
  console.log(`
Crowpus MCP CLI & Universal Bridge

Usage:
  crowpus-mcp login <token>    - Securely save your crow_mcp token locally
  crowpus-mcp run              - Run the local stdio-to-SSE MCP bridge
  crowpus-mcp setup            - Automatically configure Claude Desktop, Cursor, and VS Code extensions
  crowpus-mcp --help           - Show this help screen
`);
}

async function handleLogin(token: string): Promise<void> {
  if (!token.startsWith("crow_mcp_")) {
    console.warn("Warning: The provided token does not start with 'crow_mcp_'. Please verify if it is correct.");
  }
  const config = loadConfig();
  config.token = token;
  saveConfig(config);
  console.log("Successfully logged in. Token securely saved to ~/.config/crowpus/config.json");
}

async function handleRun(): Promise<void> {
  const config = loadConfig();
  const token = config.token || process.env.CROWPUS_MCP_TOKEN;
  if (!token) {
    console.error("Error: No MCP token found. Please run 'crowpus-mcp login <token>' first, or set CROWPUS_MCP_TOKEN.");
    process.exit(1);
  }

  let baseUrl = config.baseUrl || process.env.CROWPUS_MCP_BACKEND_URL || "https://mcp.crowpus.dev/mcp";
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  console.error(`Connecting to remote Crowpus MCP Server at ${baseUrl}...`);

  const client = new Client(
    { name: "crowpus-mcp-bridge-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    await client.connect(transport);
    console.error("Connected to remote server. Initializing local stdio bridge...");
  } catch (err) {
    console.error(`Failed to connect to remote MCP server: ${(err as Error).message}`);
    process.exit(1);
  }

  const server = new Server(
    { name: "crowpus-mcp-stdio-bridge", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Set up request forwarding handlers
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    return await client.request(request, ListToolsResultSchema);
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await client.request(request, CallToolResultSchema);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    return await client.request(request, ListResourcesResultSchema);
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await client.request(request, ReadResourceResultSchema);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    return await client.request(request, ListPromptsResultSchema);
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return await client.request(request, GetPromptResultSchema);
  });

  // Stdio Transport for local AI Agents
  const stdioTransport = new StdioServerTransport();

  const cleanup = async () => {
    try {
      await client.close();
    } catch (e) {}
    try {
      await server.close();
    } catch (e) {}
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await server.connect(stdioTransport);
    console.error("Crowpus MCP Stdio Bridge is running and ready.");
  } catch (err) {
    console.error(`Failed to start stdio bridge: ${(err as Error).message}`);
    await cleanup();
  }
}

function updateMcpServersConfig(filePath: string, name: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      return false; // Target platform is not installed
    }

    let config: any = {};
    if (fs.existsSync(filePath)) {
      try {
        config = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        // Backup corrupted file
        fs.writeFileSync(`${filePath}.bak`, fs.readFileSync(filePath));
      }
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
    console.error(`Failed to configure ${name} at ${filePath}: ${(err as Error).message}`);
    return false;
  }
}

async function handleSetup(): Promise<void> {
  console.log("Scanning and configuring local AI agent environments...");
  const home = os.homedir();
  let configuredCount = 0;

  // 1. Claude Desktop
  let claudePath: string;
  if (process.platform === "win32") {
    claudePath = path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  } else if (process.platform === "darwin") {
    claudePath = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else {
    claudePath = path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  if (updateMcpServersConfig(claudePath, "Claude Desktop")) {
    console.log(`[✓] Claude Desktop configured successfully! (${claudePath})`);
    configuredCount++;
  }

  // 2. Cursor
  let cursorPath: string;
  if (process.platform === "win32") {
    cursorPath = path.join(process.env.APPDATA || "", "Cursor", "User", "global-settings.json");
  } else if (process.platform === "darwin") {
    cursorPath = path.join(home, "Library", "Application Support", "Cursor", "User", "global-settings.json");
  } else {
    cursorPath = path.join(home, ".config", "Cursor", "User", "global-settings.json");
  }
  if (updateMcpServersConfig(cursorPath, "Cursor")) {
    console.log(`[✓] Cursor configured successfully! (${cursorPath})`);
    configuredCount++;
  }

  // 3. Cline (VS Code Extension)
  let clinePath: string;
  const storageDir = "globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json";
  if (process.platform === "win32") {
    clinePath = path.join(process.env.APPDATA || "", "Code", "User", storageDir);
  } else if (process.platform === "darwin") {
    clinePath = path.join(home, "Library", "Application Support", "Code", "User", storageDir);
  } else {
    clinePath = path.join(home, ".config", "Code", "User", storageDir);
  }
  if (updateMcpServersConfig(clinePath, "Cline Extension")) {
    console.log(`[✓] VS Code Cline configured successfully! (${clinePath})`);
    configuredCount++;
  }

  // 4. Roo Code (VS Code Extension)
  let rooPath: string;
  const rooStorageDir = "globalStorage/roodev.roguecode/settings/cline_mcp_settings.json";
  if (process.platform === "win32") {
    rooPath = path.join(process.env.APPDATA || "", "Code", "User", rooStorageDir);
  } else if (process.platform === "darwin") {
    rooPath = path.join(home, "Library", "Application Support", "Code", "User", rooStorageDir);
  } else {
    rooPath = path.join(home, ".config", "Code", "User", rooStorageDir);
  }
  if (updateMcpServersConfig(rooPath, "Roo Code Extension")) {
    console.log(`[✓] VS Code Roo Code configured successfully! (${rooPath})`);
    configuredCount++;
  }

  if (configuredCount === 0) {
    console.log("\nNo supported platforms were automatically detected on your machine.");
    console.log("You can configure your platform manually by pointing it to standard input/output execution:");
    console.log(JSON.stringify({
      command: "npx",
      args: ["-y", "@crowpus/mcp-cli", "run"]
    }, null, 2));
  } else {
    console.log(`\nSetup completed! Configured ${configuredCount} environment(s).`);
    console.log("Please restart your AI Agent platform (e.g. VS Code, Claude, or Cursor) to load the new tools.");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "login": {
      const token = args[1];
      if (!token) {
        console.error("Error: Please provide your token. E.g., crowpus-mcp login crow_mcp_...");
        process.exit(1);
      }
      await handleLogin(token);
      break;
    }
    case "run":
      await handleRun();
      break;
    case "setup":
      await handleSetup();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
