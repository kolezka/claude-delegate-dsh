import { atom, read, update } from "claude-code";
import type { Register, EngineInterface, Timer } from "claude-code";
import type { DshJob } from "../types";

const jobs = atom({ plugin: "dsh-tasks", key: "jobs" } as const, [], {
  shape: "dsh-jobs-v1",
});
const pane = { id: "dsh-tasks", title: "DSH tasks" };
const server = "plugin:delegate-dsh:dsh";

let timer: Timer | undefined;
let busy = false;
const watch = ($: EngineInterface) => {
  if (timer) return;
  timer = $.clock.every(4000, async () => {
    if (busy) return;
    busy = true;
    try {
      const active = (await read($, jobs)).filter((j) => !j.terminal);
      if (!active.length) {
        timer?.cancel();
        timer = undefined;
        return;
      }
      for (const job of active) {
        let change: Partial<DshJob>;
        try {
          const answer = await $.mcp.call(server, "progress", {
            sessionId: job.id,
          });
          const block = answer.content[0];
          if (
            answer.isError ||
            block?.type !== "text" ||
            typeof block.text !== "string"
          )
            throw new Error("Unavailable");
          const value = JSON.parse(block.text);
          if (
            typeof value?.label !== "string" ||
            typeof value?.terminal !== "boolean"
          )
            throw new Error("Invalid progress");
          change = {
            label: value.label,
            terminal: value.terminal,
            stale: false,
            seen: await $.clock.now(),
          };
        } catch {
          change = { stale: true, seen: await $.clock.now() };
        }
        await update($, jobs, (list) =>
          list.map((j) => (j.id === job.id ? { ...j, ...change } : j)),
        );
      }
    } finally {
      busy = false;
    }
  });
};
export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "dsh-tasks",
      description: "Open the live DSH tasks pane for this conversation",
    });
    if ((await read($, jobs)).some((j) => !j.terminal)) watch($);
    return next(e);
  });
  on("session.end", async ($, e, next) => {
    timer?.cancel();
    timer = undefined;
    if (e.reason === "clear") await update($, jobs, () => []);
    return next(e);
  });
  on("command.run", { command: "dsh-tasks" }, async ($) => {
    await $.ui.open(pane);
    return { text: "DSH tasks pane opened." };
  });
  on(
    "tool.call",
    { tool: "mcp__plugin_delegate-dsh_dsh__start" },
    async ($, e, next) => {
      const answer = await next(e);
      const id =
        !answer.isError &&
        /^Accepted by DSH\. Session: ([\w.-]{1,256})$/.exec(
          answer.text ?? "",
        )?.[1];
      if (id) {
        const now = await $.clock.now();
        const title =
          String(e.prompt ?? "")
            .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
            .trim()
            .slice(0, 60) || id;
        await update($, jobs, (list) => [
          ...list.filter((j) => j.id !== id),
          {
            id,
            title,
            started: now,
            seen: now,
            label: "Accepted",
            terminal: false,
            stale: false,
          },
        ]);
        watch($);
        await $.ui.open(pane);
      }
      return answer;
    },
  );
  on("ui.render", { component: "Pane", requestId: pane.id }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const list = await read($, jobs);
    return (
      <Box flexDirection="column">
        {!list.length && (
          <Text dimColor>No DSH tasks in this conversation.</Text>
        )}
        {list
          .slice()
          .reverse()
          .map((j) => (
            <Box flexDirection="column">
              <Text bold>{j.title}</Text>
              <Text dimColor={j.terminal}>
                {j.label} · {Math.floor((j.seen - j.started) / 1000)}s
                {j.stale ? " · stale" : ""}
              </Text>
            </Box>
          ))}
      </Box>
    );
  });
};
