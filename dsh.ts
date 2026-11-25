import { z } from "zod";
import { summarizeProgress } from "./progress.ts";

class DispatchError extends Error {}
const response = z.object({
  type: z.literal("server-response"),
  rpcId: z.string(),
  result: z.object({
    ok: z.literal(true),
    value: z.record(z.string(), z.unknown()),
  }),
});

function endpoint() {
  const url = URL.parse(process.env.DSH_URL ?? "");
  if (
    !url ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  ) {
    throw new DispatchError(
      "Configure the DSH address in the plugin options. Use HTTPS for a remote host; plain HTTP is allowed only on loopback.",
    );
  }
  return url;
}

async function login(origin: URL) {
  const token = process.env.DSH_LAUNCH_TOKEN;
  if (!token)
    throw new DispatchError(
      "Set the DSH launch token in the plugin's masked configuration field.",
    );
  const url = new URL("/", origin);
  url.searchParams.set("token", token);
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((line) => line.split(";", 1)[0])
    .find((pair) => pair && /^dsh-auth-[\w-]+=[\w.-]+$/.test(pair));
  await res.body?.cancel();
  if (res.status !== 303 || !cookie)
    throw new DispatchError(
      `DSH login failed (HTTP ${res.status}); check the origin and launch token.`,
    );
  return cookie;
}

async function rpc(
  origin: URL,
  cookie: string,
  method: string,
  request: Record<string, unknown>,
) {
  const rpcId = crypto.randomUUID();
  const res = await fetch(new URL(`/api/${method}`, origin), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      type: "client-request",
      rpcId,
      method,
      payload: { args: { request } },
    }),
  });
  if (!res.ok) throw new DispatchError(`HTTP ${res.status}`);
  const frame = response.safeParse(await res.json());
  if (!frame.success || frame.data.rpcId !== rpcId)
    throw new DispatchError("Missing or negative RPC acknowledgement.");
  return frame.data.result.value;
}

let progressCookie: string | undefined;
export async function progress(sessionId: string) {
  try {
    const origin = endpoint();
    const cookie = (progressCookie ??= await login(origin));
    const cut = await rpc(origin, cookie, "session/projections", { sessionId });
    const { asOfSeq } = z
      .object({
        kind: z.literal("sequenced"),
        asOfSeq: z.number().int().min(-1),
      })
      .parse(cut);
    const page = await rpc(origin, cookie, "session/page", {
      address: { kind: "session", sessionId },
      throughSeq: asOfSeq,
      maxMessages: 2,
    });
    return summarizeProgress(page.records);
  } catch {
    progressCookie = undefined;
    throw new Error("DSH progress unavailable.");
  }
}

export async function start(prompt: string): Promise<string> {
  const origin = endpoint();
  let sessionId: string | undefined;
  try {
    const cookie = await login(origin);
    const session = await rpc(origin, cookie, "session/create", {});
    if (
      typeof session?.sessionId !== "string" ||
      !/^[\w.-]{1,256}$/.test(session.sessionId)
    )
      throw new DispatchError("Invalid session ID.");
    sessionId = session.sessionId as string;
    const receipt = await rpc(origin, cookie, "session/prompt", {
      sessionId,
      requestId: crypto.randomUUID(),
      mode: "queue",
      content: [{ type: "text", text: prompt }],
    });
    if (receipt?.accepted !== true)
      throw new DispatchError("Missing admission receipt.");
    return sessionId;
  } catch (error) {
    // Network exceptions can contain the launch URL. Never pass them to MCP.
    const reason =
      error instanceof DispatchError
        ? error.message
        : "Connection or response error.";
    if (sessionId)
      throw new Error(
        `Admission not confirmed. Check DSH session ${sessionId} before resubmitting. ${reason}`,
      );
    throw new Error(`Prompt not sent. ${reason}`);
  }
}
