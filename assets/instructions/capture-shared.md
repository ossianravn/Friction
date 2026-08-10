## Capture harness friction when you encounter it

This repo runs Friction, a tool that captures friction in your workflow. It is designed to help agents identify and reduce avoidable friction in the development process. Think of Friction as HR for agents.

Proactively record concrete, avoidable friction when a repository, instruction, design, tool, dependency, configuration, environment, or harness causes observable extra cost: a retry, backtracking, a workaround, extra search, blocking, an avoidable slow path, unclear ownership, or a tool that appears to succeed but returns a plausible wrong or incomplete result. This includes codebase design, stale docs or guides, misleading abstractions, scripts, tests, and ownership boundaries. Small non-blocking issues count.

Use one or two sentences: what you were doing, the observed obstacle and cost, and - when useful - the workaround that worked. State facts first; treat any cause or prevention as suspected unless verified. Record each encounter once. Record a recurrence when it causes another concrete cost, but do not duplicate the same incident. Omit optional metadata rather than guess.

{{COMMAND}}

Do not record accomplishments, preference-only design criticism, ordinary mistakes unless they expose a missing guardrail, or the tracked bug itself; record only separate workflow friction it exposes. Never include secrets, transcripts, environment values, diffs, or raw or large output—summarize instead. Finish the immediate step, capture before context is lost, and continue the primary task. If capture fails, continue and do not log that failure. Never review transcripts automatically.
