# Delegate to DeepSeek Harness

From Claude Code, run `/delegate-dsh:start <prompt>` to queue text in a new session on an existing DSH web host. Claude gets the session ID and can carry on. Follow the session or answer approval requests in DSH itself. Only the prompt is forwarded, not local files, shell commands, or the rest of the conversation. The remote agent runs with its existing permissions and default workspace.

## Run locally

Requirements: Claude Code, Bun (tested with 1.4.4), and access to a DSH web instance with launch-token login and the `session/create` and `session/prompt` RPCs.

1. Clone this repo and run `bun install --frozen-lockfile` in it. Note its absolute directory.
2. Use an HTTPS origin, or open an SSH forward in a separate terminal. For instance, `ssh -NT -o ExitOnForwardFailure=yes -L 127.0.0.1:13080:127.0.0.1:3080 user@dsh-host`. For that tunnel, set `export DSH_URL=http://127.0.0.1:13080`. The default origin is `http://127.0.0.1:3080`. Non-loopback plaintext HTTP is refused.
3. Set `DSH_LAUNCH_TOKEN` to the token from the trusted DSH launch URL in the environment of Claude Code. Do not paste the token into Claude, commit it, or put it in a command-line argument. For example, in zsh: `read -rs 'DSH_LAUNCH_TOKEN?DSH token: '; export DSH_LAUNCH_TOKEN`.
4. From your normal working directory run `claude --plugin-dir /absolute/path/to/claude-delegate-dsh`. In the session, run `/delegate-dsh:start List the top-level folders in your default workspace.`

Expected receipt: `Accepted by DSH. Session: <id>`. This is queue admission, not task completion. If confirmation is lost, check the returned session ID in DSH before resubmitting. The plugin never automatically retries, starts a tunnel, or changes the remote configuration. Refresh the environment and restart Claude if the DSH launch token changes.

## Development

`bun test` runs the MCP client and server against a loopback DSH fixture. `bun check` checks TypeScript. `claude plugin validate --strict .` checks the plugin manifest and command. These checks do not run a model or send a prompt to a real DSH host.
