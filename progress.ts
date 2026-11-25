import { z } from "zod";

const records = z.array(
  z.object({
    type: z.literal("event"),
    event: z.object({
      type: z.string(),
      seq: z.number().int(),
      data: z.unknown(),
    }),
  }),
);

export function summarizeProgress(input: unknown) {
  const events = records.parse(input);
  for (let i = events.length - 1; i >= 0; i--) {
    const { type, data } = events[i]!.event;
    if (type === "turn/end") {
      const reason = z
        .object({ reason: z.object({ kind: z.string() }) })
        .parse(data).reason.kind;
      const label =
        reason === "completed"
          ? "Turn completed"
          : reason === "aborted"
            ? "Cancelled"
            : reason === "error"
              ? "Failed"
              : reason === "blocked"
                ? "Blocked"
                : "Turn ended";
      return { label, terminal: reason !== "blocked" };
    }
    if (type === "tool/call") {
      const name = z.object({ name: z.string() }).parse(data).name;
      return {
        label: /^[\w.:/-]{1,64}$/.test(name) ? `Tool: ${name}` : "Running tool",
        terminal: false,
      };
    }
    if (type === "tool/result")
      return { label: "Tool returned", terminal: false };
    if (
      type === "step/start" ||
      type === "turn/start" ||
      type === "assistant/message" ||
      type === "step/end"
    )
      return { label: "Working", terminal: false };
  }
  return { label: "Accepted", terminal: false };
}
