#!/usr/bin/env node

import "./polyfill";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  chatAgentTool,
  createBranchTool,
  getBranchDetailsTool,
  handleChatAgentCall,
  handleCreateBranchCall,
  handleGetBranchDetailsCall,
} from "./chatAgentTool.js";

// Create MCP Server
const server = new Server(
  {
    name: "thinking-agent-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [chatAgentTool, createBranchTool, getBranchDetailsTool],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "chat_agent": {
      return await handleChatAgentCall(args as any);
    }
    case "create_branch": {
      return await handleCreateBranchCall(args as any);
    }
    case "get_branch_details": {
      return await handleGetBranchDetailsCall(args as any);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Thinking Agent MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
