# Web UI contract for Playwright CLIs

Read this when the primary interface is a web UI and the verification CLI drives it with Playwright. The examples assume React and TypeScript. Translate them to the target repo's stack and the directory supplied to the skill.

The preferred shape is one typed registry of automation IDs that the frontend, the Playwright tests, and the CLI all import. CLI commands address elements by logical path (`customer.save`), and the registry resolves each path to a `data-testid`. Copy changes and component swaps leave automation working. Renaming or deleting a registry key is a breaking change and gets the same review as an API change.

## Decide before instrumenting

- **Registry exists.** Build the CLI on it. Document its path in the guide.
- **No registry.** Adding test IDs changes product code. Propose the contract to the user and get approval before touching components. Until it lands, drive with `getByRole` and accessible names, and record the missing contract in the guide's Maintenance section.
- **Scope.** Instrument only the elements the seeded feature recipes act on or check. A page with 150 DOM elements might expose eight. A small contract has fewer keys to keep stable.

## The registry

```ts
// src/automation/ui-contract.ts
export const UI = {
  customer: {
    name: { testId: 'customer-name', kind: 'textbox' },
    save: { testId: 'customer-save', kind: 'button' },
    row:  { testId: 'customer-row',  kind: 'row' },
    open: { testId: 'customer-open', kind: 'button' },
  },
} as const;

export const ACTIONS = {
  button: ['click'],
  textbox: ['fill', 'clear'],
  row: [],
} as const;
```

`as const` keeps each `testId` a string literal. Components write `data-testid={UI.customer.save.testId}`, never the string. `kind` tells the CLI which actions an element supports.

Derive the ID union so a misspelled ID fails compilation:

```ts
type DeepTestId<T> =
  T extends { testId: infer I extends string } ? I
  : T extends Record<string, unknown> ? DeepTestId<T[keyof T]>
  : never;

export type TestId = DeepTestId<typeof UI>;
```

If `TestId` widens to `string`, `as const` is missing.

Give the CLI and Playwright `tsconfig.json` files the same `paths` mapping as the app (`"@/*": ["src/*"]`) so `@/automation/ui-contract` resolves.

## CLI resolution

```ts
export function resolveUI(path: string) {
  let current: unknown = UI;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, part)) {
      throw new Error(`Unknown UI element: ${path}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== 'object' || current === null || !('testId' in current)) {
    throw new Error(`Not an interactive UI element: ${path}`);
  }
  return current as { testId: TestId; kind: keyof typeof ACTIONS };
}
```

Use `Object.hasOwn`, not `in`, for path segments. With `in`, inherited names such as `customer.toString` pass the key check and fail later with the wrong error.

Commands reject actions the element's `kind` does not allow, before touching the page. Ship an `inspect <path>` command that prints the ID, test ID, kind, and supported actions as YAML or JSON, so a driving agent can check an element before acting:

```yaml
id: customer.name
testId: customer-name
kind: textbox
supportedActions: [fill, clear]
```

## Entities in lists

Every row of a list shares one test ID. Put the record on the row itself in two more attributes, set through one typed helper:

```ts
export type EntityType = 'customer' | 'invoice';

export function automationEntity(testId: TestId, type: EntityType, id: string) {
  return { 'data-testid': testId, 'data-entity-type': type, 'data-entity-id': id };
}
// <tr {...automationEntity(UI.customer.row.testId, 'customer', customer.id)}>
```

Use only IDs the user already sees in the browser. These attributes are visible in dev tools.

Locate one row with a combined attribute selector, escaping the entity ID because it comes from data:

```ts
const css = (v: string) => v.replace(/["\\]/g, '\\$&');

export const customerRow = (page: Page, id: string) =>
  page.locator(`[data-testid="${UI.customer.row.testId}"][data-entity-id="${css(id)}"]`);
```

`locator.filter({ has })` matches nothing here: `has` searches inside each row, and `data-entity-id` sits on the row itself.

This gives the CLI entity-scoped commands such as `myapp customer open cus_123`, and the `list` command can read IDs from `data-entity-id`.

## Guardrails

- **Uniqueness test.** Two keys sharing a test ID make one locator match both elements. Add a unit test that collects every `testId` in `UI` and asserts they are unique.
- **Lint rule.** Once the instrumented features use `UI`, reject literal test IDs in all three forms (`"x"`, `{'x'}`, `` {`x`} ``) with `no-restricted-syntax` on `JSXAttribute[name.name='data-testid']`. A grep for `data-testid="` misses two of them.
- **Production builds.** The CLI may run against deployed environments. Check the build config for a plugin that strips `data-testid` or `data-*` attributes, such as `babel-plugin-react-remove-properties`, and keep the contract attributes in every build.
- **Maintenance.** In the guide's Maintenance section, name the registry file, the uniqueness test, and the lint rule, and state that registry keys change only with a matching CLI and feature-map update.
