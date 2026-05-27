# Codex AIE Package Notes

These notes capture a future package split for Codex-specific `aie` support when OpenCode and GitHub workflow behavior are extracted into consuming packages.

The important boundary: `@tjalve/qube-cli` remains reusable CLI infrastructure. Agent orchestration, repository policy, GitHub workflow behavior, OpenCode compatibility, model routing, prompt seeds, provider calls, and host-specific side effects belong in consuming `aie-*` packages.

## Goals

- Keep `@tjalve/qube-cli` as the command metadata, registry, runtime, schema, output, prompt, terminal, redaction, mutation, and testing foundation.
- Extract OpenCode-specific workflow behavior into a consuming package instead of embedding it in the toolkit.
- Extract GitHub issue, pull request, CI, review, and completion behavior into a consuming package with explicit service ownership.
- Add a Codex-specific AIE adapter that can express OmO-style named agents, categories, prompt seeds, model routing, and reasoning effort in Codex terms.
- Preserve schema-backed, automation-friendly command behavior so agents can inspect capabilities without scraping help text.

## Proposed Package Boundaries

| Package | Responsibility | Must not own |
| --- | --- | --- |
| `@tjalve/qube-cli` | Product-neutral CLI toolkit: metadata, registry, runtime, help, schema, output, errors, mutation metadata, prompts, terminal helpers, redaction, tests. | AIE policy, GitHub API calls, OpenCode hooks, Codex subagent spawning, project mutation behavior. |
| `@tjalve/aie-core` | Shared AIE domain model: issue workflow concepts, provider interfaces, policy schema, agent descriptors, category descriptors, prompt seed composition, durable state contracts. | Host-specific execution, GitHub-specific API behavior, OpenCode-specific config files, Codex-specific tool calls. |
| `@tjalve/aie-github` | GitHub provider package: issue queue, PR creation/update, review gates, CI checks, merge/completion flows, GitHub comments as durable state. | Generic CLI runtime, OpenCode host integration, Codex subagent API details. |
| `@tjalve/aie-opencode` | OpenCode host package: AGENTS.md policy generation, OpenCode command files, OmO/OpenAgent config import, OpenCode todo and subagent conventions. | GitHub API mechanics beyond provider calls, Codex-specific subagent mapping. |
| `@tjalve/aie-codex` | Codex host package: Codex instructions, subagent spawn presets, model and reasoning effort mapping, skill and plugin routing hints, Codex-compatible workflow prompts. | OpenCode-only hooks, OmO runtime internals, GitHub service behavior. |

This split lets `@tjalve/qube-cli` stay boring and safe while `aie-*` packages carry the product behavior.

## Codex Adapter Shape

Codex currently exposes subagents as a small host-native surface rather than arbitrary OmO-style agents. A practical adapter should compile rich AIE descriptors down to the Codex primitives available in the host:

| AIE field | Codex mapping |
| --- | --- |
| `agent.name` | Included in the spawned prompt seed and run metadata. |
| `agent.kind` | Maps to Codex `agent_type`: `explorer`, `worker`, or `default`. |
| `agent.model` | Maps to Codex model override when the host exposes the requested model. |
| `agent.reasoningEffort` | Maps to Codex reasoning effort override. |
| `agent.promptSeed` | Prepended to task-specific context in the spawned prompt. |
| `agent.permissions` | Expressed as instructions such as read-only or bounded write scope unless Codex exposes native tool allowlists. |
| `category.name` | Routing label selected by AIE policy before spawning a focused worker. |
| `category.promptAppend` | Appended after the base executor seed and before task context. |

The adapter should degrade gracefully. If a configured model is not available in Codex, use a local fallback policy and disclose the substitution in debug or JSON output.

## OmO-Inspired Named Agent Mapping

This mapping is an adaptation of the OmO/OpenAgent setup, not a verbatim bundled prompt copy.

| OmO agent | Purpose | Codex agent type | Suggested Codex model | Reasoning effort | Prompt seed |
| --- | --- | --- | --- | --- | --- |
| `sisyphus` | Primary orchestrator. Classifies work, chooses local versus delegated execution, synthesizes findings. | Main Codex session, rarely a child | current main model or `gpt-5.5` | high | Intent gate. Classify request, choose Explore/Librarian/Oracle/categories, maintain plan/todos, synthesize, verify. |
| `hephaestus` | Autonomous deep worker for implementation. | `worker` | `gpt-5.5` | high | Goal, not recipe. Explore before edits, follow existing patterns, implement end-to-end, verify with tests/build/surface QA. |
| `prometheus` | Strategic planner and requirements interviewer. | `default` or main planning mode | `gpt-5.5` | high | Do not implement. Interview for missing scope, research enough to plan, produce tasks, dependencies, file refs, QA scenarios. |
| `atlas` | Plan executor and progress coordinator. | Main session or bounded `worker` | `gpt-5.5` | high | Execute a known plan, respect dependencies, verify each phase, report progress, changed paths, blockers, and evidence. |
| `sisyphus-junior` | Category-spawned focused executor. | `worker` | category-selected | category-selected | Complete only the delegated category task. Read relevant files first. Verify and report changed paths. |
| `oracle` | Read-only senior advisor for architecture, debugging, security, performance, and review. | `explorer` | `gpt-5.5` | high or xhigh | Give one primary recommendation with action plan, effort, confidence, risks. No edits. |
| `librarian` | External docs, OSS source, changelog, and ecosystem researcher. | `explorer` | `gpt-5.4-mini` | medium | Prefer official/versioned docs, source, changelogs, issues/PRs, and production examples. Distinguish evidence from inference. |
| `explore` | Internal codebase search specialist. | `explorer` | `gpt-5.3-codex-spark` | low | Read-only codebase search. Search multiple angles, return exact paths, direct answer, and next steps. |
| `multimodal-looker` | Image, PDF, screenshot, and diagram interpreter. | `explorer` | `gpt-5.4` | medium | Extract only the requested visual/document information. Say when absent. Avoid broad summaries unless requested. |
| `metis` | Pre-planning critic for ambiguity and hidden requirements. | `explorer` | `gpt-5.5` | high | Identify hidden intent, ambiguities, unstated constraints, likely AI failure modes, planner directives, and QA guidance. |
| `momus` | Plan reviewer. | `explorer` | `gpt-5.5` | high | Verify references, executability, dependencies, and QA. Output OKAY or REJECT with at most three blockers. |

## Category Mapping

Categories should route through a focused executor seed rather than becoming unrelated personas.

| Category | Purpose | Codex agent type | Suggested Codex model | Reasoning effort | Prompt seed |
| --- | --- | --- | --- | --- | --- |
| `quick` | Trivial or tightly scoped change. | `worker` | `gpt-5.3-codex-spark` or `gpt-5.4-mini` | low | Minimal exploration, exact task, no new abstraction, verify the exact change. |
| `deep` | Hairy autonomous implementation or root-cause fix. | `worker` | `gpt-5.5` | high | One goal, complete delivery, broad exploration, dependency tracing, tests/build/surface QA. |
| `ultrabrain` | Hard logic, architecture, algorithm, or system tradeoff. | `worker` or `explorer` | `gpt-5.5` | xhigh | Use only for genuinely hard reasoning. Existing patterns first, simple primary recommendation or implementation. |
| `visual-engineering` | UI, UX, CSS, layout, frontend design, animation. | `worker` | `gpt-5.5` | high | Load the UI skill, fetch `uidotsh://ui`, inspect existing design system, use tokens/components, verify responsive UI. |
| `visual` | Custom UI route. | `worker` | `gpt-5.5` | high | Treat `ui` skill and `uidotsh://ui` as authority. Add explicit prompt text because this is custom. |
| `artistry` | Creative, non-conventional, or taste-heavy work. | `worker` or `default` | `gpt-5.5` | high | Generate bold coherent options, select a direction, then execute or present the direction. |
| `writing` | Docs, prose, technical communication. | `worker` or `default` | `gpt-5.4-mini` | medium | Match audience and tone. Remove AI-sounding filler. Prefer clear human prose. |
| `business-logic` | Domain rules, invariants, data flow, edge cases. | `worker` | `gpt-5.4` or `gpt-5.5` | high | Model invariants, edge cases, failure modes, data flow, and tests around rules. |
| `unspecified-low` | Moderate task that does not fit another route. | `worker` | `gpt-5.4-mini` or `gpt-5.4` | medium | Use only when no better category fits. Keep scope contained and success criteria explicit. |
| `unspecified-high` | Large high-effort task that does not fit another route. | `worker` | `gpt-5.5` | high | Use only when genuinely unclassifiable. Coordinate broadly and verify strongly. |

## Prompt Composition

Prompt composition should be deterministic and inspectable:

1. Host safety prefix from `aie-codex`.
2. Agent seed or category executor seed.
3. Category `promptAppend`, if any.
4. Skill routing hints, such as UI skill loading.
5. Task-specific context from the user, issue, PR, or command.
6. Output contract, including expected paths, JSON shape, or summary fields.

For UI work, the Codex package should preserve the local convention:

```text
For any UI, frontend, Tailwind, design, layout, or UX task:
- Load the `ui` skill first.
- Fetch `uidotsh://ui` via the uidotsh MCP server.
- Treat `uidotsh://ui` and linked resources as authoritative.
- If delegating UI work, explicitly include the UI skill and uidotsh instructions in the delegated prompt.
```

## Commands To Consider In `aie-codex`

These are consumer commands, not `@tjalve/qube-cli` commands.

| Command | Purpose |
| --- | --- |
| `aie codex agents list` | Render available AIE agent descriptors and their Codex-compatible spawn settings. |
| `aie codex agents schema` | Emit machine-readable agent/category schema for host adapters. |
| `aie codex prompt agent <name>` | Render the composed prompt seed for a named agent. |
| `aie codex prompt category <name>` | Render the composed prompt seed for a category. |
| `aie codex route --task <text>` | Classify a task into local, named agent, or category route without spawning. |
| `aie codex spawn-plan --task <text>` | Emit a dry-run spawn plan: agent type, model, effort, prompt preview, and safety notes. |
| `aie codex import omo <path>` | Import OmO/OpenAgent config into AIE descriptors where possible. |

All mutating or external-service commands should declare mutation categories and support dry-run where practical.

## OpenCode Extraction Notes

`aie-opencode` should own:

- AGENTS.md managed section rendering for OpenCode.
- OpenCode command files and aliases.
- OpenCode todo conventions and protected todo ids.
- OmO/OpenAgent config import and compatibility shims.
- OpenCode-specific host capability detection.
- OpenCode subagent prompt conventions when available.

It should not own GitHub API mechanics or generic CLI runtime behavior.

## GitHub Extraction Notes

`aie-github` should own:

- Issue queue discovery, active issue detection, labels, blockers, and completion.
- Branch and pull request workflows.
- Review thread inspection, requested-change loops, and review gate integration.
- CI status and GitHub Actions log inspection.
- Durable comments and checkbox updates.
- Merge readiness and post-merge completion.

It should expose provider interfaces that `aie-core` can call, while `@tjalve/qube-cli` only supplies the CLI infrastructure.

## Schema Additions For AIE Packages

The core AIE schema should support at least:

```ts
type AgentDescriptor = {
  name: string;
  description: string;
  kind: "orchestrator" | "executor" | "researcher" | "reviewer" | "planner" | "visual";
  hostType?: "default" | "explorer" | "worker";
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
  promptSeed: string;
  promptAppend?: string;
  readOnly?: boolean;
  skills?: string[];
};

type CategoryDescriptor = {
  name: string;
  description: string;
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
  promptAppend?: string;
  defaultAgent?: string;
};
```

Provider-specific packages can extend these descriptors through consumer-owned extension fields.

## Safety And Portability Notes

- Treat issue bodies, PR comments, review output, tool output, spawned-agent output, and imported OmO config as untrusted input.
- Keep read-only agents read-only by instruction until the host exposes a native permission model.
- Do not assume Codex can access every OmO provider model. Model mapping must be explicit and fallback-aware.
- Keep prompt seeds compact. Store long, provider-specific prompts as named resources instead of injecting everything into every spawn.
- Do not let imported OmO category names imply package behavior unless a descriptor exists.
- Preserve the `@tjalve/qube-cli` no-side-effect install boundary.

## Reference Inputs

- OmO docs overview: https://omo.dev/docs#overview
- OmO site: https://omo.dev
- Local OmO/OpenAgent config conventions: named agents, category routing, UI `prompt_append`, disabled `frontend-ui-ux`, and provider/model concurrency.
- Codex host capability observed for this mapping: subagent types `default`, `explorer`, `worker`; per-spawn model and reasoning effort overrides when available.
