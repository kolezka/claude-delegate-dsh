import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

test("Claude collects the endpoint and a masked token and passes them to the server", async () => {
  const manifest = await Bun.file(
    new URL("../.claude-plugin/plugin.json", import.meta.url),
  ).json();
  const config = await Bun.file(
    new URL("../.mcp.json", import.meta.url),
  ).json();
  expect(manifest.userConfig?.origin).toMatchObject({
    type: "string",
    required: true,
  });
  expect(manifest.userConfig?.token).toMatchObject({
    type: "string",
    required: true,
    sensitive: true,
  });
  expect(config.mcpServers.dsh.env).toEqual({
    DSH_URL: "${user_config.origin}",
    DSH_LAUNCH_TOKEN: "${user_config.token}",
  });
});

const prompt = "Sprawdź `$(whoami)`\nbez zmian.  ";
const entry = fileURLToPath(new URL("../index.ts", import.meta.url));

for (const scenario of [
  "accept",
  "deny-login",
  "wrong-id",
  "no-receipt",
  "blank",
] as const) {
  test(`MCP start: ${scenario}`, async () => {
    const paths: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        paths.push(url.pathname);
        if (url.pathname === "/") {
          if (
            scenario === "deny-login" ||
            url.searchParams.get("token") !== "fixture-token"
          )
            return new Response("fixture-token", { status: 401 });
          return new Response(null, {
            status: 303,
            headers: {
              "set-cookie": "dsh-auth-fixture=fixture-cookie; HttpOnly; Path=/",
              location: "./",
            },
          });
        }
        if (
          req.method !== "POST" ||
          req.headers.get("cookie") !== "dsh-auth-fixture=fixture-cookie"
        )
          return new Response(null, { status: 403 });
        const frame = (await req.json()) as {
          type: string;
          method: string;
          rpcId: string;
          payload: { args: { request: unknown } };
        };
        expect(frame.type).toBe("client-request");
        expect(url.pathname).toBe(`/api/${frame.method}`);
        const create = frame.method === "session/create";
        const request = frame.payload.args.request;
        if (create) expect(request).toEqual({});
        else
          expect(request).toEqual({
            sessionId: "session-123",
            requestId: expect.any(String),
            mode: "queue",
            content: [{ type: "text", text: prompt }],
          });
        return Response.json({
          type: "server-response",
          rpcId: !create && scenario === "wrong-id" ? "unrelated" : frame.rpcId,
          result: {
            ok: true,
            value: create
              ? { sessionId: "session-123" }
              : { accepted: scenario !== "no-receipt" },
          },
        });
      },
    });
    const client = new Client({ name: "fixture", version: "1" });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: ["--no-env-file", "--no-install", entry],
          env: {
            DSH_URL: server.url.origin,
            DSH_LAUNCH_TOKEN: "fixture-token",
          },
        }),
      );
      expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
        "start", "progress",
      ]);
      const result = await client.callTool({
        name: "start",
        arguments: { prompt: scenario === "blank" ? " \n" : prompt },
      });
      expect(JSON.stringify(result.content)).not.toMatch(
        /fixture-token|fixture-cookie/,
      );
      if (scenario === "accept") {
        expect(result.isError).not.toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: "Accepted by DSH. Session: session-123" },
        ]);
      } else {
        expect(result.isError).toBe(true);
        if (scenario === "wrong-id" || scenario === "no-receipt")
          expect(JSON.stringify(result.content)).toContain("session-123");
      }
      expect(paths).toEqual(
        scenario === "blank"
          ? []
          : scenario === "deny-login"
            ? ["/"]
            : ["/", "/api/session/create", "/api/session/prompt"],
      );
    } finally {
      await client.close();
      server.stop(true);
    }
  });
}
