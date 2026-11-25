import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

test("progress reads one session at its exact watermark; it returns no transcript", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      requests.push(path);
      if (path === "/")
        return new Response(null, {
          status: 303,
          headers: { "set-cookie": "dsh-auth-x=x; HttpOnly", location: "./" },
        });
      expect(req.headers.get("cookie")).toBe("dsh-auth-x=x");
      const body = (await req.json()) as {
        rpcId: string;
        payload: { args: { request: unknown } };
      };
      const cut = path === "/api/session/projections";
      expect(body.payload.args.request).toEqual(
        cut
          ? { sessionId: "s1" }
          : {
              address: { kind: "session", sessionId: "s1" },
              throughSeq: 11,
              maxMessages: 2,
            },
      );
      const value = cut
        ? { kind: "sequenced", asOfSeq: 11, values: {} }
        : {
            records: [
              {
                type: "event",
                event: {
                  seq: 11,
                  type: "tool/call",
                  data: { name: "Read", arguments: "private tool args" },
                },
              },
            ],
          };
      return Response.json({
        type: "server-response",
        rpcId: body.rpcId,
        result: { ok: true, value },
      });
    },
  });
  const client = new Client({ name: "fixture", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--no-env-file",
          fileURLToPath(new URL("../index.ts", import.meta.url)),
        ],
        env: { DSH_URL: server.url.origin, DSH_LAUNCH_TOKEN: "fixture" },
      }),
    );
    const r = await client.callTool({
      name: "progress",
      arguments: { sessionId: "s1" },
    });
    expect(r.isError).not.toBe(true);
    expect(r.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ label: "Tool: Read", terminal: false }),
      },
    ]);
    expect(requests).toEqual([
      "/",
      "/api/session/projections",
      "/api/session/page",
    ]);
  } finally {
    await client.close();
    server.stop(true);
  }
});
