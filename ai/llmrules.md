# LLMRules.md
<!-- Adapted from https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md 

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed. -->

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Project-Specific Rules for go-shopping-poc-ui

### Before modifying any file:
1. Read the file first using the Read tool — never edit from memory
2. Check `AGENTS.md` for current architecture decisions
3. Run `ng build` before and after your changes to verify compilation

### Angular version:
This project uses Angular 21.x. Use Angular 21 APIs exclusively.
When unsure about an API, check `ai/angular_full_llms.txt` before relying on pre-training knowledge.

### The "What NOT to Do" rule:
Before writing any Angular code, review the "What NOT to Do" list in `AGENTS.md`.
Each item on that list was added because a previous LLM violated it. Do not repeat those mistakes.

### Signal stores:
Never create component-local async state using `Subject` or `BehaviorSubject`.
All shared or cross-component state belongs in a signal store in `src/app/store/`.

### Naming check (required before finalizing any component):
After writing a component, verify ALL of the following before submitting:
- [ ] File ends in `.component.ts`
- [ ] Class ends in `Component`
- [ ] `standalone: true` is NOT set in the decorator
- [ ] `changeDetection: ChangeDetectionStrategy.OnPush` IS set in the decorator
- [ ] All inputs use `input()` or `input.required<T>()` — not `@Input()`
- [ ] All outputs use `output<T>()` — not `@Output()` + `EventEmitter`
- [ ] Template uses `@if`/`@for`/`@switch` — not `*ngIf`/`*ngFor`/`*ngSwitch`
- [ ] `inject()` is used for DI — not constructor injection

### Deleting files:
When you delete a file, immediately:
1. Search for all import references to the deleted file
2. Remove or update each import
3. Verify `ng build` succeeds after deletion

### No console.log:
Never add `console.log`, `console.debug`, or `console.info` to production code.
Use `NotificationService` for user-visible messages.
Use `console.error` only in catch blocks for developer diagnostics, not for state tracing.

### On SSE key casing:
The SSE backend currently sends `cart.item.validated` and `cart.item.backorder` events with camelCase keys.
The `OrderSseService` has a `convertKeysToSnakeCase()` workaround for this.
DO NOT remove this workaround until the backend confirms it has been updated to use snake_case.

### Improvement plan:
The full codebase improvement plan is at `ai/plans/claude_code_improvement_plan.md`.
Consult it before making broad refactoring decisions to understand the intended direction.
