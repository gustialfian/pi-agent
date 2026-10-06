---
name: verification-create
description: Create project-local verification docs and tools that exercise the real app and retain evidence.
disable-model-invocation: true
argument-hint: <directory>
---

# Create verification docs

Create a documented way to launch the real app, exercise user-facing behavior, check results, and retain evidence. Write for an agent that has never seen the project. The output is repo-local documentation and any necessary helpers, not another skill.

## Required directory argument

Invoke with `/skill:verification-create <directory>`, for example `/skill:verification-create verifier` or `/skill:verification-create tools/verification`.

Require one directory argument. If it is missing or ambiguous, ask for it before inspecting or changing the project. Resolve a relative path against the target repository root. Use this directory for the verification guide, feature map, and new helpers. Do not choose a default or switch to another location without approval.

## 1. Interview the repo, not the user

Answer these from the codebase. Ask the user only what you cannot observe.

- What does a user interact with? Identify the web UI, CLI, TUI, desktop app, API, mobile app, or library. Choose the primary interface and note the others.
- How does the app start locally? Prefer documented commands, package scripts, and Makefile targets. Identify ports, environment variables, dependencies, initial data, and authentication.
- How can an agent drive it? Reuse existing browser automation, terminal drivers, scripts, and public API clients before adding tools.
- What can the agent observe? Identify screenshots, terminal output, response bodies, logs, exit codes, files, and stored data.
- What proves the behavior? Define expected results and how to read them again to check persistence. Identify relevant rejection cases and access rules.
- Can runs remain isolated? Check ports, databases, data directories, browser profiles, and accounts. If isolation is unavailable, document the limitation and obtain approval before using shared state.

Try the documented startup procedure before writing instructions around it. Report blockers precisely. Obtain approval for unrelated repairs, credential setup, or infrastructure provisioning. Mark temporary startup files as verification-only files and include their removal in cleanup.

Use disposable data and test accounts. Obtain approval before actions that send real messages, incur charges, or change external or shared state. For dry-run modes, observe which files, network requests, or other effects actually occur.

Finish this step when you have a working startup procedure and can name the driving tool, expected results, isolation method, and evidence location. If startup remains blocked, report the blocker and label any output as a draft.

## 2. Create the verification guide

Create or update `README.md` in the supplied directory. Put new supporting tools in that directory using the project's conventions. Reuse existing tools where appropriate and document their actual paths. Use exact commands and paths from the repo, with no unresolved placeholders.

Include these sections:

- **Launch.** Document prerequisites, the startup command, readiness checks, time limits, and teardown. For short-lived commands, build or install once and run each check in its own isolated process or terminal session.
- **Doctor.** Provide a read-only check of instance ownership, app health, expected build, and authentication where applicable. Distinguish a reachable controller from a healthy app. Run this check before driving and whenever results look wrong.
- **Drive.** Document real controls, commands, routes, and expected results. Prefer the project's UI contract IDs where one exists, then accessible names and stable identifiers. Scope repeated items by identity. Wait for observable readiness and inspect errors rather than relying on fixed sleeps.
- **Evidence.** Name the artifact directory and explain how to inspect its contents. Record actions, expected and observed results, failures, and the feature entry point used. Capture relevant UI, terminal, network, or file evidence. Read state again after mutations to check persistence. A successful command or success message alone does not prove the feature.
- **Cleanup.** Stop only processes the run started. Make cleanup available even when the app is unhealthy. Remove active-session metadata and temporary files, but preserve proof artifacts. Document stale-session recovery without guessing which processes are safe to terminate.
- **Maintenance.** Explain which docs, selectors, assertions, command schemas, and helper tests must change together when behavior changes.

Exercise the public interface appropriate to the claim. A UI claim requires UI actions. Public API behavior can be checked through API requests. Use internal state reads only as additional evidence, not as a substitute for the user path. Use mocks only at existing external integration boundaries and report what they exclude from the proof.

Prefer a persistent controller for agent-facing browser CLIs. Launch the isolated app and browser once, then keep them alive across commands until explicit shutdown. Let the agent compose feature commands against the same session without repeating startup, authentication, or fixture setup. Reuse an existing controller when available.

For a web UI driven through Playwright, read [the web UI contract](references/web-ui-contract.md) before writing the CLI. It explains the preferred design: a typed registry of test IDs shared by the frontend, tests, and CLI, with commands that address elements by logical path. It also covers when to get approval before instrumenting product code.

Example CLI shape for a browser-driven transfer app (adapt commands to the target repo; these are illustrative, not shipped tools):

```sh
npx playwright install chromium  # Once
node control launch
node control doctor
node control initialize
node control list
node control transfer <from-id> <to-id> 2500
node control close
```

`launch` keeps the app and browser alive across separate invocations. `initialize` prepares disposable fixtures, `list` exposes IDs and current state, and `transfer` performs a user-facing action in that session. Read state again to check the transfer persisted. `close` stops owned processes and finalizes evidence while preserving artifacts.

Keep app lifecycle, isolation, and evidence capture separate from feature-specific actions. Use private session metadata, authenticated local control, serialized commands, bounded startup, an idle timeout, and explicit shutdown. Isolate separate verification runs from one another. Start a fresh session when a check requires fresh state, not for every command.

Never automatically retry a mutation after a timeout. It may have succeeded. Inspect the resulting state and evidence before deciding what to do next.

Make shipped scripts executable and show their invocation in the guide. Capture failures as well as successes. Explain when shutdown finalizes traces or network recordings. Treat traces, logs, databases, and network captures as potentially sensitive. Keep them local and document redaction before sharing.

Finish this step when another agent can follow the guide without reverse-engineering the tools.

## 3. Seed the feature map

Create `features/README.md` beside the guide and one Markdown file per identified user-facing feature. Start with the top three to five features, or all features if fewer exist. Discover them through routes, commands, menus, and project docs.

Read [the feature-map examples](references/feature-map-example/README.md) and its linked feature files before writing the map. They illustrate the document structure, not tools or commands to copy into the project.

The index lists features and shared preconditions, driving conventions, evidence requirements, and skip reporting. The map defines coverage. Each run reports which paths it actually checked.

Each feature file starts with a title and a short description of user-visible behavior. Use these four H2 sections in order:

1. `Sub-features` lists stable short IDs and the behavior each ID covers, including relevant failure cases.
2. `How to get to it` lists known user entry points, such as navigation, keyboard shortcuts, CLI commands, or public API routes.
3. `Driving it with <tool>` names the actual tool. Begin with preconditions. Give exact actions or commands for each entry point, expected observations, persistence checks, and when to capture evidence.
4. `Gotchas` explains state dependencies, readiness conditions, uncertain outcomes, and other traps that can invalidate a run.

Keep feature files focused on user actions and observable results. Document shared lifecycle instructions in the guide rather than repeating them per feature.

A recipe for one entry point does not verify the others. Mark paths without executable recipes as coverage gaps. Capture evidence while the relevant state is visible, before later actions replace it. State what each recipe does not prove. For example, a successful transfer does not establish insufficient-funds rejection or account ownership isolation.

Finish this step when every indexed feature has a recipe or an explicit coverage gap, and each recipe names its expected proof.

## 4. Prove the guide before handing it over

Follow the generated guide end to end:

1. Launch an isolated instance.
2. Run its doctor check.
3. Drive one mapped feature and compare observations with the documented expectations.
4. Capture and inspect evidence of the action and result, including persistence where relevant.
5. Run cleanup and confirm owned processes stopped.
6. Confirm the named evidence still exists and finalized artifacts can be inspected.

Run cleanup after failed attempts too. Fix broken instructions or tools and repeat the recipe. Run relevant helper tests if you added or changed code.

Report the guide path, feature and entry point checked, observed result, evidence location, and remaining gaps. An unexecuted guide is a draft. Do not report skipped paths as verified.

## 5. Offer maintenance

Point the user to `/skill:verification-maintain <directory>`, substituting the directory used in this run, to audit the verification guide, feature map, and tools as the app changes. Suggest a cadence only if they ask.
