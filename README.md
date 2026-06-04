# Crowpus MCP Client Bridge & CLI Setup Tool

A lightweight, universal CLI tool and stdio-to-SSE bridge for the Crowpus Model Context Protocol (MCP) Server. 

This tool allows local AI agents (such as **Claude Desktop**, **Cursor**, **Cline**, **Roo Code**, and **Antigravity**) to easily connect to the secure, remote Crowpus MCP Server. It securely stores credentials locally and starts a standard input/output (stdio) bridge to interact with the remote server on behalf of the agent, automatically injecting authentication headers.

---

## Features

- **Secure Login**: Saves your personal `crow_mcp_...` token locally in `~/.config/crowpus/config.json` with secure `0600` permissions.
- **Stdio-to-SSE Bridge**: Bridges the remote EventSource/SSE transport of `mcp.crowpus.dev` to a local process using stdio transport (standard JSON-RPC over stdin/stdout).
- **Auto-Integration Setup**: Scans your local directories and automatically configures MCP settings for:
  - **Claude Desktop**
  - **Cursor**
  - **Cline** (VS Code extension)
  - **Roo Code** (VS Code extension)

---

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm

### Setup & Build
Clone the repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/CrowPus/mcp-cli.git
cd mcp-cli

# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run build
```

---

## Usage

### 1. Log In (Configure Credentials)
Save your Crowpus MCP token securely to your machine:

```bash
node dist/index.js login <crow_mcp_token>
```

### 2. Auto-configure Platforms
Automatically scan and setup all detected AI agent environments on your machine:

```bash
node dist/index.js setup
```

This updates settings files (e.g. `claude_desktop_config.json`, `cline_mcp_settings.json`, and `global-settings.json`) to register the local command bridge:
```json
{
  "mcpServers": {
    "crowpus": {
      "command": "npx",
      "args": ["-y", "@crowpus/mcp-cli", "run"]
    }
  }
}
```

### 3. Run Stdio Bridge Manually
If you want to run the stdio bridge process directly:

```bash
node dist/index.js run
```

---

## How It Works

AI agent platforms natively support connecting to MCP servers that run as local child processes over standard input/output (stdio). However, they usually do not support connecting to remote SSE servers that require dynamic custom headers (like `Authorization: Bearer <token>`).

The `@crowpus/mcp-cli` acts as a local proxy. 

1. The AI Agent boots the bridge command (`npx @crowpus/mcp-cli run`).
2. The local bridge reads the stored token and opens a secure connection to `https://mcp.crowpus.dev/mcp` using Streamable HTTP/SSE.
3. It fetches the remote tools and registers them locally.
4. When the agent calls a tool, the bridge forwards the call to the remote cloud server and returns the results.
