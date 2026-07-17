---
name: spoke-fp
description: >
  Spoke Phone's strict functional programming style guide for TypeScript. ALWAYS use this skill
  when writing, editing, reviewing, or generating any .ts or .tsx code for the Spoke codebase.
  Also trigger when the user asks about Spoke coding conventions, functional programming patterns,
  Ramda usage, or code style at Spoke. This skill encodes the team's ESLint rules as
  actionable authoring guidance — covering immutability, control flow, naming, file structure,
  and formatting. If you are about to write TypeScript and you have access to this skill, read it first.
---
 
# Spoke Functional Programming Style
 
This skill defines how to write TypeScript at Spoke Phone. Every rule here is enforced by ESLint
and CI will reject code that violates them. Internalise these constraints — don't write code that
needs to be fixed afterward.
 
## Core Philosophy
 
Spoke code is **purely functional TypeScript**. No classes, no mutation, no imperative loops.
The codebase uses **Ramda** as its standard functional utility library. Prefer Ramda over
hand-rolled helpers for collection operations, conditionals, and composition.
 
Guiding principles (in priority order):
1. **Immutability** — every binding is `const`. Data transforms, never mutates.
2. **Expressions over statements** — prefer expressions that return values over statements that perform effects.
3. **Small, composable functions** — each function does one thing and composes with others.
4. **Fail fast** — validate inputs at the boundary, return early on invalid states.
5. **DRY / KISS / YAGNI** — no speculative abstractions, no duplicated logic, no unnecessary complexity.
---
 
## Immutability Rules
 
### No `let` — ever
Every variable binding must be `const`. If you need to accumulate a result, use `reduce`, `scan`,
or build a new value via spread/map rather than reassigning.
 
```typescript
// WRONG
let total = 0;
items.forEach((item) => { total += item.amount; });
 
// RIGHT
const total = R.sum(R.map(R.prop("amount"), items));
// or
const total = items.reduce((acc, item) => acc + item.amount, 0);
```
 
### No parameter reassignment
Never reassign function parameters. Create new bindings instead.
 
```typescript
// WRONG
const normalise = (input: string): string => {
  input = input.trim(); // param reassignment
  return input.toLowerCase();
};
 
// RIGHT
const normalise = (input: string): string => {
  const trimmed = input.trim();
  return trimmed.toLowerCase();
};
// or compose:
const normalise = (input: string): string => R.pipe(R.trim, R.toLower)(input);
```
 
---
 
## Banned Constructs
 
These language features are banned by the linter. Do not use them under any circumstances in
production code.
 
| Banned construct         | Use instead                                           |
|--------------------------|-------------------------------------------------------|
| `class`                  | Plain objects, factory functions, closures             |
| `for` loop               | `R.map`, `R.forEach`, `Array.prototype.map`           |
| `for...in`               | `R.forEachObjIndexed`, `Object.entries().map()`       |
| `while` / `do...while`   | Recursive functions, `R.unfold`, `R.until`            |
| `switch`                 | `R.cond` with predicate/transform pairs               |
| `if...else`              | Early returns, `R.cond`, ternary (single-level only)  |
| Nested `if`              | Early returns, `R.cond`, extract to helper function   |
| `break` / `continue`     | Early returns, `R.cond`, `R.takeWhile`, `R.filter`   |
| Nested ternary           | `R.cond`, or extract intermediate `const`             |
 
### Control flow patterns
 
**Replace `switch` with `R.cond`:**
```typescript
// WRONG
switch (status) {
  case "active": return handleActive(data);
  case "pending": return handlePending(data);
  default: return handleDefault(data);
}
 
// RIGHT
const handleStatus = R.cond<[Status, Data], Result>([
  [(s) => s === Status.Active, (_, d) => handleActive(d)],
  [(s) => s === Status.Pending, (_, d) => handlePending(d)],
  [R.T, (_, d) => handleDefault(d)]
]);
```
 
**Replace `if/else` chains with early returns:**
```typescript
// WRONG
const process = (input: Input): Result => {
  if (isValid(input)) {
    return transform(input);
  } else {
    return defaultResult;
  }
};
 
// RIGHT — guard clause + early return
const process = (input: Input): Result => {
  if (!isValid(input)) {
    return defaultResult;
  }
  return transform(input);
};
```
 
**Replace loops with functional transforms:**
```typescript
// WRONG
const results = [];
for (const item of items) {
  if (item.active) {
    results.push(transform(item));
  }
}
 
// RIGHT
const results = R.pipe(
  R.filter<Item>(R.prop("active")),
  R.map(transform)
)(items);
```
 
---
 
## String Literals and Magic Values
 
### No string literal comparisons
Never compare against inline string literals. Extract to a named constant or use a TypeScript
enum. Always check whether the appropriate constant or enum is already defined before creating
a new one.
 
```typescript
// WRONG
if (role === "admin") { ... }
 
// RIGHT
const ROLE_ADMIN = "admin" as const;
// or use an enum:
enum Role { Admin = "admin", User = "user" }
 
if (role === Role.Admin) { ... }
```
 
**Exception:** `typeof` checks are allowed (e.g., `typeof x === "string"`).
 
### No magic numbers
Numeric literals other than `0`, `1`, and `-1` must be extracted to named constants.
 
```typescript
// WRONG
const timeout = 30000;
 
// RIGHT
const TIMEOUT_MS = 30000;
const timeout = TIMEOUT_MS;
```
 
---
 
## Error Handling
 
### One throw per function maximum
If a function needs to signal failure, it should have at most one `throw`. Prefer returning
a discriminated union (`Result<T, E>`) or using early-return guard patterns instead of
scattering throws.
 
### One try/catch per function maximum
Multiple try/catch blocks signal overly defensive programming. Either remove unnecessary
try/catch blocks or refactor so the function has a single error boundary.
 
**In test files**, these restrictions are relaxed — test helpers may use multiple try/catch
blocks if genuinely needed.
 
---
 
## Function Design
 
### Maximum 4 parameters
If a function needs more than 4 arguments, group related parameters into an options object.
 
```typescript
// WRONG
const createUser = (name: string, email: string, role: Role, org: string, notify: boolean): User => ...
 
// RIGHT
type CreateUserOpts = {
  name: string;
  email: string;
  role: Role;
  org: string;
  notify: boolean;
};
const createUser = (opts: CreateUserOpts): User => ...
```
 
### Maximum 80 lines per function
If a function exceeds 80 lines (excluding blanks and comments), decompose it. Extract
sub-operations into named helper functions with clear intent.
 
### Complexity ceiling of 10
Cyclomatic complexity must stay at or below 10. High complexity usually means the function
is doing too many things — split it.
 
### Explicit return types (`.ts` files)
Every function in `.ts` / `.mts` / `.cts` files must have an explicit return type annotation.
In `.tsx` files, return types are optional (to reduce noise on components).
 
```typescript
// .ts — return type required
const sum = (a: number, b: number): number => a + b;
 
// .tsx — return type optional
const Button = ({ label }: ButtonProps) => <button>{label}</button>;
```
 
### Prefer arrow functions
Always use arrow functions for callbacks. Named top-level functions can use either form,
but arrow functions are preferred for consistency.
 
---
 
## File Structure
 
### Maximum 500 lines per file
Files exceeding 500 lines (excluding blanks and comments) must be split. Group related
functions into modules with clear single responsibilities.
 
### Import sorting
Imports are auto-sorted by `eslint-plugin-simple-import-sort`. Group order:
1. External packages (e.g., `react`, `ramda`)
2. Internal aliases / absolute imports
3. Relative imports
Do not manually organise imports — just write them and let the linter sort.
 
---
 
## Formatting (Enforced by ESLint)
 
These are non-negotiable and auto-fixable, but write them correctly the first time:
 
- **Indentation:** 2 spaces (no tabs)
- **Quotes:** double quotes (`"`) — template literals allowed, escape avoidance allowed
- **Semicolons:** always required
- **Line length:** 120 characters max (URLs and strings exempt)
- **Linebreaks:** Unix (`\n`)
- **Trailing commas:** never (arrays, objects, imports, exports, function params)
- **Brace style:** K&R (opening brace on same line)
- **Object curlies:** spaces inside (`{ key: value }`)
- **Single empty line max** between blocks; no blank lines at start/end of file
- **Space before blocks**, after keywords, around infix operators
- **No space** inside parentheses or array brackets
- **`curly` enforced** — always use braces for `if`/`else`/`for`/`while` bodies
- **Quote props:** only when required (e.g., hyphenated keys)
---
 
## Naming Conventions
 
| Identifier              | Format                                      |
|--------------------------|---------------------------------------------|
| Default                  | `camelCase`                                 |
| Variables                | `camelCase`, `UPPER_CASE`, or `PascalCase`  |
| Functions                | `camelCase` or `PascalCase`                 |
| Imports                  | `camelCase` or `PascalCase`                 |
| Types / Interfaces / Enums | `PascalCase`                             |
| Enum members             | `PascalCase` or `camelCase`                 |
| Type properties          | `PascalCase`, `camelCase`, or `snake_case`  |
| Object literal props     | `camelCase`, `UPPER_CASE`, `PascalCase`, or `snake_case` |
| `.tsx` parameters        | `camelCase` or `PascalCase` (for components)|
 
Leading underscores are allowed for intentionally unused bindings.
 
### Type member delimiters
Use semicolons (not commas) to delimit type/interface members:
 
```typescript
type User = {
  name: string;
  email: string;
  role: Role;
};
```
 
---
 
## Test Files
 
Test files (`*.test.ts`, `*.spec.ts`, files in `test/`, `tests/`, `__tests__/`,
`integration-test/`) have relaxed rules:
 
- Magic numbers are allowed
- `prefer-const` is off (test setup may use `let` for reassignment in `beforeEach`)
- `max-lines-per-function` is off (test suites can be long)
- The extra code-only restrictions (string literal comparison, multiple throws, multiple
  try/catch) do not apply
- All other functional rules (no classes, no loops, no switch, etc.) still apply
---
 
## UI Component Files (`src/components/ui/`)
 
Shared UI components under `src/components/ui/` use the common (relaxed) syntax rules
rather than the stricter code-only rules. They may also export multiple components from
a single file.
 
---
 
## Supabase Edge Functions (`supabase/functions/`)
 
Edge functions are exempt from React-specific rules (hooks, refresh). All other
functional programming rules apply.
 
---
 
## Quick Checklist Before Submitting Code
 
1. Every binding is `const`?
2. No classes, loops, switch, or if/else?
3. String comparisons use named constants or enums?
4. Functions have ≤ 4 params, ≤ 80 lines, explicit return types?
5. File is ≤ 500 lines?
6. No magic numbers (except 0, 1, -1)?
7. At most one throw and one try/catch per function?
8. Double quotes, semicolons, trailing commas nowhere?
9. Ramda used for collection ops and conditionals where appropriate?
10. Naming follows the convention table?
