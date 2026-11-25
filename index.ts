import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { start } from "./dsh.ts";

const server = new McpServer({ name: "delegate-dsh", version: "0.1.0" });
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
await server.connect(new StdioServerTransport());
