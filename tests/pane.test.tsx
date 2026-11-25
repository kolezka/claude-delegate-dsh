import { expect, test, mock } from "claude-code/testing";
const pane = {
  plugin: "delegate-dsh",
  component: "Pane",
  requestId: "dsh-tasks",
  surface: "terminal",
  props: {
    title: "DSH tasks",
    isFocused: false,
    bodyColumns: 42,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const;
test(
  "only a successful DSH dispatch creates a row with its title",
  { options: { origin: "https://example.invalid", token: "fixture" } },
  async ($, on) => {
    const clock = mock.clock(on);
    let n = 0;
    on("mcp.call", (_, e) => {
      expect(e.server).toBe("plugin:delegate-dsh:dsh");
      expect(e.tool).toBe("progress");
      expect(e.args.sessionId).toBe("test-1");
      n++;
      const label = n === 1 ? "Tool: Read" : "Turn completed";
      return {
        value: {
          isError: n === 2,
          content: [
            {
              type: "text",
              text: JSON.stringify({ label, terminal: n === 3 }),
            },
          ],
        },
      };
    });
    on("ui.open", () => ({ value: { isPlaced: true } }));
    on("tool.call", () => ({
      result: {},
      text: "Accepted by DSH. Session: test-1",
    }));
    const ui = await $.ui.mount(pane);
    expect((await ui.find({ type: "Text", text: /No DSH/ }))?.text).toBe(
      "No DSH tasks in this conversation.",
    );
    await $.tool.call({
      tool: "mcp__plugin_delegate-dsh_dsh__start",
      prompt: "Review documentation",
    });
    expect(
      (await ui.find({ type: "Text", text: /Review documentation/ }))?.text,
    ).toBe("Review documentation");
    expect((await ui.find({ type: "Text", text: /Accepted/ }))?.text).toBe(
      "Accepted · 0s",
    );
    for (const expected of [
      "Tool: Read · 4s",
      "Tool: Read · 8s · stale",
      "Turn completed · 12s",
    ]) {
      await clock.advance(4000);
      expect((await ui.find({ type: "Text", text: expected }))?.text).toBe(
        expected,
      );
    }
    await clock.advance(8000);
    expect(n).toBe(3);
    await ui.unmount();
  },
);
