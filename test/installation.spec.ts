import { expect, test } from "bun:test";
import marketplace from "../.claude-plugin/marketplace.json";

test("one marketplace install provides the bridge and the pane", async () => {
  expect(
    marketplace.plugins.map(({ name, source }) => ({ name, source })),
  ).toEqual([{ name: "delegate-dsh", source: "./" }]);
  const root = new URL("../", import.meta.url);
  const file = (path: string) => Bun.file(new URL(path, root));
  const manifest = await file(".claude-plugin/plugin.json").json();
  expect(manifest.name).toBe("delegate-dsh");
  expect(await file(manifest.types).exists()).toBe(true);
  expect(await file("commands/start.md").exists()).toBe(true);
  expect((await file(".mcp.json").json()).mcpServers.dsh).toBeDefined();
  const hooks = await file("hooks/hooks.json").json();
  expect(hooks.modules.length).toBe(1);
  expect(await file(`hooks/${hooks.modules[0]}`).exists()).toBe(true);
});
