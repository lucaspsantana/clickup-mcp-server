#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClickUpClient, getConfig } from "./client.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerDocTools } from "./tools/docs.js";

async function main() {
  const config = getConfig();
  const client = createClickUpClient(config);

  const server = new McpServer({
    name: "clickup-custom",
    version: "1.0.0",
  });

  registerTaskTools(server, client, config.teamId);
  registerDocTools(server, client, config.teamId);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("clickup-custom-mcp failed to start:", error);
  process.exit(1);
});
