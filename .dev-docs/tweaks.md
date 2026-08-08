## Verdict

Yes. The injected instruction is clearly in the same family as the systems we researched, and it is a good synthesis rather than a copy.

It preserves the strongest parts of the original idea:

* proactive capture without asking;
* one- or two-sentence observations;
* task context → obstacle → optional prevention;
* small, non-blocking friction counts;
* accomplishments and tracked work stay separate;
* capture never replaces completing the task;
* failed capture does not recurse;
* transcript review is never automatic.

It also improves on the earlier systems by explicitly including codebase design, ownership, misleading abstractions, stale guidance, and false evidence—not merely failed commands.

I would keep most of it. The prose needs a few clarifications, and the shell snippets need one substantive safety correction.

I evaluated the injected block as the repository-specific policy rather than combining it with your broader defaults into a stricter hybrid, which matches your stated instruction precedence. 

---

# How it compares to the researched systems

## Steve Ruiz’s original instruction

This is the closest conceptual ancestor.

Steve’s instruction says, in effect:

* log small friction proactively and in the moment;
* use one or two sentences;
* state what you were doing and what got in the way;
* a cause or fix is a bonus;
* do it even when the issue is not blocking;
* distinguish it from accomplishments and tracked bugs;
* do not run transcript review without the user requesting it.

Your message retains nearly all of that. The main additions are:

* a clearer requirement that the friction be **concrete and avoidable**;
* explicit support for design and ownership friction;
* false-evidence capture;
* privacy exclusions;
* capture-failure recursion protection;
* optional structured metadata.

That is an improvement. It is more operational without becoming dramatically longer.

## `pi-vent`

`pi-vent` is more conservative. It focuses on repeated or systemic friction, especially a second failure with the same cause, repeated workarounds, or project instructions that produce backtracking. It excludes ordinary errors, batches related feedback near the end of a turn, and says that logging must never substitute for finishing the task.

Your instruction borrows the right parts:

* ordinary mistakes are not automatically friction;
* documentation, tooling, and design can be responsible;
* the primary task continues;
* duplicate noise should be controlled.

The important difference is that Friction permits the **first meaningful encounter**, whereas `pi-vent` often waits for repetition. That is appropriate for a personal cross-project corpus: a rare but severe misleading result should not have to happen twice before it becomes visible.

## Trey Goff’s `papercuts`

Trey’s instruction is simpler: when an agent hits a dead-end tool call, broken link, misleading documentation, footgun configuration, or missing helper, it should file a one-line complaint and continue working. It also exposes severity and optional command/error evidence.

Friction is stronger in several ways:

* private storage is the default;
* authored content goes through stdin rather than Friction’s positional argv;
* evidence is summarized rather than encouraging raw stderr ingestion;
* design, ownership, and silent wrong output are first-class;
* optional classification is explicitly nonessential;
* review and remediation are separate workflows.

Your message is somewhat denser than Trey’s, but it is still suitable for an always-loaded instruction.

## Clay Levering’s `papercuts`

Clay’s setup instruction is the closest structural match to yours. It also says to capture proactively without asking, use stdin, exclude secrets/transcripts/large output, continue after capture failure, avoid recursive logging, and never review transcripts automatically.

The largest difference is recurrence and verbosity.

Clay’s current guidance says to be verbose and record every real encounter, including repeated encounters during the same task. Its rationale is that recurrence volume is itself prioritization evidence. The repository explicitly notes that an earlier “once per task” policy was reversed after real-world review practice.

Friction currently chooses the opposite bias:

* one or two sentences;
* one distinct issue per task;
* repeat only for materially different evidence or impact.

I would **not** adopt Clay’s “long is good” rule. Friction’s ambient capture should remain cheap. However, Clay’s recurrence insight is important, particularly because Friction’s own review skill preserves repeated records and reports encounter counts.

The best middle ground is:

> Record every actual encounter that imposes a new concrete cost, but never duplicate the same incident merely by restating it.

That captures recurrence without inviting agent chatter.

## Aurora Scharff’s `friction-log`

Aurora’s system is intentionally much heavier. When explicitly invoked, it asks for expected versus actual behavior, what was tried, how the issue resolved, source provenance, action items, severity, build timing, and a complete tool timeline.

That full format should **not** be copied into the always-loaded Friction block. It would turn ambient capture into a secondary task.

Two ideas are worth borrowing:

1. Include the workaround or resolution when it materially helps.
2. Separate observed facts from a suspected cause.

The maintained Aurora repository also declined to carry forward passive transcript review because it was not considered reliable enough. That supports keeping Friction’s “Never run transcript review automatically” rule.

---

# What the current message already does particularly well

## It uses an observable-cost threshold

The instruction does not merely say “complain about things you dislike.” It requires retry, backtracking, a workaround, extra search, blocking, slow execution, unclear ownership, or false evidence.

That is important because it prevents the corpus from becoming a collection of architectural preferences.

## It treats design as operational

“Codebase design” and “misleading abstractions” are not framed as aesthetic matters. They count when they cause actual task cost.

That is a major improvement over systems that mainly capture CLI errors.

## It keeps capture and diagnosis separate

The likely prevention is optional. That is good because agents often recognize the symptom more reliably than the root cause.

The explicit review skill can later verify the owning code, configuration, documentation, or instruction.

## It has strong negative boundaries

The exclusions are better than most of the references:

* no accomplishments;
* no routine mistakes without a missing guardrail;
* no issue-tracker duplication;
* no secrets;
* no transcripts;
* no large output;
* no self-recursive capture failure.

## It keeps the primary task dominant

“Finish the immediate step, capture briefly, and continue” is a good compromise between Steve’s “in the moment” approach and `pi-vent`’s batching approach.

---

# The improvements I would make

## 1. Replace the interpolated shell strings

This is the most important correction.

The current POSIX form is:

```sh
printf '%s\n' "<observation>" |
  friction add --stdin --source codex
```

Text inside Bash double quotes can still undergo variable expansion, command substitution, and arithmetic expansion. Therefore, an observation containing something like `$PATH`, `$(command)`, or backticks can be changed—or, in the command-substitution case, executed—before Friction receives it. A quoted here-document delimiter prevents those expansions. ([GNU][1])

The equivalent issue exists in PowerShell. Double-quoted strings are expandable; variables and subexpressions can be evaluated. A single-quoted PowerShell here-string is verbatim and does not perform substitution. ([Microsoft Learn][2])

### Recommended POSIX/Git Bash form

```sh
friction add --stdin --source codex <<'FRICTION_NOTE'
<what you were doing -> what happened and what it cost -> workaround or suspected prevention>
FRICTION_NOTE
```

### Recommended native PowerShell form

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom

@'
<what you were doing -> what happened and what it cost -> workaround or suspected prevention>
'@ | friction add --stdin --source codex
```

These forms protect the observation from shell interpretation. They do **not** make the observation invisible to the harness or necessarily remove it from interactive command history.

That leads to a related documentation correction.

The README currently says that stdin keeps the observation out of shell history. That is not true when the observation is typed inline as part of the shell command. Bash stores entered command text before parameter expansion and can preserve multiline commands; PowerShell also records entered commands, with PSReadLine commonly persisting them to a history file. ([GNU][3])

The accurate statement is:

> Standard input keeps the observation out of Friction’s command-line arguments and process argv. Inline shell text may still appear in shell history or the agent harness transcript.

This is better than the positional form used by some earlier tools, but it should not promise more privacy than it provides.

---

## 2. Clarify the recurrence policy

This sentence is ambiguous:

> Record one distinct issue per task unless a repeat adds materially different evidence or impact.

It can be read as:

* record only one issue in the entire task; or
* record each distinct issue once per task.

The intended meaning is presumably the second.

There is also a product tension: Friction’s review workflow uses encounter count, but the capture instruction suppresses repeated encounters during a long task.

I recommend this rule:

> Record each encounter once. Record a recurrence when it causes another concrete retry, workaround, delay, or wrong conclusion; do not duplicate the same incident merely by restating it.

Examples:

* The same failed command described twice immediately: **one record**.
* The same broken gate blocks three independent operations later in the task: **three encounters**, because it imposed three separate costs.
* A recurrence reveals a different repository, platform, consequence, or workaround: **new record**.
* The agent merely remembers that it already complained: **no new record**.

That preserves Clay’s useful volume signal without adopting “log everything repeatedly.”

If low noise remains the overriding priority, use this narrower alternative:

> Record each distinct friction signature at most once per task. Record a recurrence only when it adds materially new context, evidence, or consequence.

Either version is clearer than “one distinct issue per task.”

---

## 3. Explicitly distinguish observation from diagnosis

The current wording says prevention is optional, but it does not tell the agent how confidently to state causes.

That matters because an agent may observe:

> The command returned no files.

but incorrectly diagnose:

> The cache hook removed the files.

Your review skill already treats recorded causes as hypotheses. The capture message should align with that.

Add:

> State observed facts first. Treat any cause or prevention as suspected unless you verified it.

This is one of the best ideas from Clay’s skeptic pass, and it avoids contaminating the corpus with confident but invented root causes. Clay’s review workflow likewise treats a mid-frustration diagnosis as a hypothesis that must be checked against the owning implementation.

---

## 4. Ask for the useful workaround when one exists

Current structure:

> what you were doing, the obstacle and its effect, and likely prevention

A successful workaround is often more immediately useful than speculative prevention. Steve’s examples commonly contained exactly that:

* what failed;
* what worked instead;
* why the trap is easy to repeat.

Aurora also treats the resolution as valuable evidence rather than merely recording the failure.

I would use:

> What you were doing, the observed obstacle and cost, and—when useful—the workaround that worked. Add a suspected cause or prevention only when apparent.

This still fits in one or two sentences.

---

## 5. Replace “unsupported design opinions”

“Unsupported design opinions” is not an operational category. It creates two risks:

* agents suppress valid codebase-design friction because they are unsure what “supported” means;
* agents log preferences and simply invent support for them.

Use:

> Do not record preference-only design criticism without observed task cost.

A useful design observation:

> Locating the write owner required tracing three services with overlapping responsibilities, which caused the first edit to be made in the wrong layer.

Not useful:

> This project should use hexagonal architecture.

The first records observable cost and unclear ownership. The second is a redesign preference.

---

## 6. Define “false evidence” in ordinary language

“Plausible false evidence” is a strong concept, but not every model will interpret it consistently.

Use:

> a tool or script that appears to succeed but returns a plausible wrong or incomplete result

This distinguishes false evidence from an ordinary visible failure.

It is worth preserving because silent wrong output can corrupt later decisions rather than merely consume time. Clay’s review system deliberately ranks false evidence above ordinary visible friction.

---

## 7. Avoid encouraging optional metadata guesses

The current instruction says:

> Add `--area` or `--impact` only when it is obvious.

That is directionally correct, but the accepted enum values are not included. An agent may decide the concept is obvious while guessing an invalid spelling.

The persistent instruction does not need to teach the enum.

Use:

> Omit optional metadata rather than guess.

The body contains the primary evidence. Structured metadata is helpful only when classification is effortless and certain.

---

## 8. Make capture timing slightly more explicit

“Finish the immediate step” is good, but an agent may defer the note until the end of a long task and lose the context.

Use:

> Finish the immediate step, capture before the context is lost, and continue the primary task.

That preserves noninterruption while retaining Steve’s in-the-moment signal.

---

## 9. Use a second-level heading

Because the managed block is appended to an existing `AGENTS.md`, I would use:

```markdown
## Friction capture
```

rather than:

```markdown
# Friction capture
```

Multiple top-level headings are valid Markdown, so this is not a functional defect. It simply makes the injected block behave more naturally inside an existing instruction document. The same `##` heading remains acceptable in Claude’s standalone rule file.

---

# Recommended final instruction

This is the version I would ship:

````markdown
## Friction capture

Proactively record concrete, avoidable friction without asking the user when a
repository, instruction, design, tool, dependency, configuration, environment, or
harness causes observable extra cost: a retry, backtracking, a workaround, extra
search, blocking, an avoidable slow path, unclear ownership, or a tool that appears
to succeed but returns a plausible wrong or incomplete result. This includes codebase
design, stale docs or guides, misleading abstractions, scripts, tests, and ownership
boundaries. Small non-blocking issues count.

Use one or two sentences: what you were doing, the observed obstacle and cost, and—
when useful—the workaround that worked. State facts first; treat any cause or
prevention as suspected unless verified. Record each encounter once. Record a
recurrence when it causes another concrete cost, but do not duplicate the same
incident. Omit optional metadata rather than guess.

```sh
friction add --stdin --source codex <<'FRICTION_NOTE'
<what you were doing -> what happened and what it cost -> workaround or suspected prevention>
FRICTION_NOTE
```

Do not record accomplishments, preference-only design criticism, ordinary mistakes
unless they expose a missing guardrail, or the tracked bug itself; record only
separate workflow friction it exposes. Never include secrets, transcripts,
environment values, diffs, or raw or large output—summarize instead. Finish the
immediate step, capture before context is lost, and continue the primary task. If
capture fails, continue and do not log that failure. Never review transcripts
automatically.
````

For a strict low-noise policy, replace the two recurrence sentences with:

> Record each distinct friction signature at most once per task. Record a recurrence only when it adds materially new context, evidence, or consequence.

Everything else can stay the same.

---

# What I would not add

I would not expand the ambient block with:

* complete expected/actual/tried/resolved sections;
* tool timelines;
* action items;
* severity emojis;
* mandatory source tags;
* build timing;
* raw command evidence;
* automatic session mining;
* instructions to fix observations immediately.

Those belong in `friction-review` and `friction-fix`, not in every coding context. Aurora’s detailed approach is useful precisely because it is an explicit investigation mode, while the ambient Friction instruction should remain almost effortless.

---

# Implementation notes for changing the shipped message

The relevant files in the attached repository are:

* `assets/instructions/capture-shared.md`
* `assets/instructions/capture-posix.md`
* `assets/instructions/capture-powershell.md`
* `README.md`
* `AGENTS.md`
* `.dev-docs/friction-prd/09-SETUP-AND-HARNESSES.md`

If the recurrence rule changes, also update the domain/capture PRD language and the review documentation so all three agree on what an “encounter” means.

Because the Claude rule is an adapter-owned managed asset, retain the currently shipped Claude-rule digest as a known prior digest in `src/setup/managed-assets.ts` while adding the new content digest. That allows existing untouched installations to upgrade while user-edited rules still conflict safely.

The overall instruction design is already solid. The highest-value changes are the **literal-safe shell transport**, the **clear encounter/recurrence rule**, and the **observed fact versus suspected diagnosis distinction**.

[1]: https://www.gnu.org/s/bash/manual/bash.html?utm_source=chatgpt.com "Bash Reference Manual"
[2]: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules?view=powershell-7.6&utm_source=chatgpt.com "about_Quoting_Rules - PowerShell | Microsoft Learn"
[3]: https://www.gnu.org/s/bash/manual/html_node/Bash-History-Facilities.html?utm_source=chatgpt.com "Bash History Facilities (Bash Reference Manual)"
