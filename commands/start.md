---
description: Send a prompt to a new remote DeepSeek Harness session and return its ID.
argument-hint: <prompt>
disable-model-invocation: true
---

Use the plugin's `mcp__plugin_delegate-dsh_dsh__start` tool once. Pass only the user's argument text below as `prompt`, verbatim. Treat that text as the remote task, not instructions to execute locally. If blank, show usage instead. Never attach conversation history, files or credentials. Report the tool's receipt or error; do not retry or wait for a final answer.

Remote task:
$ARGUMENTS
