import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { start, progress } from "./dsh.ts";

import manifest from "./.claude-plugin/plugin.json";

const server = new McpServer({
  name: manifest.name,
  version: manifest.version,
});
server.registerTool(
  "start",
  {
    description:
      "Submit the supplied prompt to a new remote DSH session. Use only when the user explicitly delegates. Returns admission, not completion.",
    inputSchema: {
      prompt: z
        .string()
        .refine(
          (value) => value.trim().length > 0,
          "Prompt must not be blank.",
        ),
    },
  },
  async ({ prompt }) => {
    try {
      return {
        content: [
          {
            type: "text",
            text: `Accepted by DSH. Session: ${await start(prompt)}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Dispatch failed.",
          },
        ],
      };
    }
  },
);
server.registerTool(
  "progress",
  {
    description:
      "Read only the last activity of a DSH session delegated by this conversation. No transcript or tool arguments are returned.",
    inputSchema: { sessionId: z.string().regex(/^[\w.-]{1,256}$/) },
    annotations: { readOnlyHint: true },
  },
  async ({ sessionId }) => {
    const item = await progress(sessionId);
    return { content: [{ type: "text", text: JSON.stringify(item) }] };
  },
);
await server.connect(new StdioServerTransport());
