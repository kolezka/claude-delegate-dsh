# Delegate to DeepSeek Harness

From Claude Code, run `/delegate-dsh:start <prompt>` to queue text in a new session on an existing DSH web host. Claude gets the session ID and can carry on. Follow the session or answer approval requests in DSH itself. Only the prompt is forwarded, not local files, shell commands, or the rest of the conversation. The remote agent runs with its existing permissions and default workspace.

## Install from GitHub

In Claude Code, install the bridge and the optional live pane:

```text
/plugin install delegate-dsh --marketplace kolezka/claude-delegate-dsh
/plugin install dsh-tasks@delegate-dsh-tools
```

Configure the bridge once as described below. After a successful dispatch, the pane opens automatically. Use `/dsh-tasks` to reopen it. It checks only tasks delegated by this conversation, polling every four seconds while they are active. `stale` means the last known activity could not be refreshed, not that the task failed.

## Run locally

Requirements: Claude Code, Bun (tested with 1.4.4), and access to a DSH web instance with launch-token login and the `session/create` and `session/prompt` RPCs.

1. Install from a local checkout: `claude plugin install delegate-dsh --marketplace /absolute/path/to/claude-delegate-dsh`. The local stdio server installs its locked runtime dependencies on first start. It needs Bun and a POSIX shell on your PATH.
2. Open `/plugin` in Claude Code and configure `delegate-dsh` once: **DSH address** is your direct HTTPS origin (for instance, a Tailscale HTTPS name); **DSH launch token** is just the token from the trusted DSH launch link. Use Claude Code's masked plugin option, not the conversation. No tunnel or shell exports are needed. For an installed plugin, its configuration is available under `/plugin`.
3. Use `/delegate-dsh:start List the top-level folders in your default workspace.` The HTTPS endpoint can be a hostname or an IP address with a matching trusted certificate. Plain HTTP is accepted only on loopback. The plugin does not downgrade to HTTP on a LAN if HTTPS fails.

Expected receipt: `Accepted by DSH. Session: <id>`. This is queue admission, not task completion. If confirmation is lost, check the returned session ID in DSH before resubmitting. The plugin never automatically retries, starts a tunnel, or changes the remote configuration. If the launch token changes, update the masked plugin option and reconnect the plugin.

## Development

`bun test` runs the MCP client and server against a loopback DSH fixture. `bun check` checks TypeScript. `claude plugin validate --strict .` checks the plugin manifest and command. These checks do not run a model or send a prompt to a real DSH host.
