# Agent runbook: migrate an integration from Web SDK v5 to v6

You are a coding agent migrating a merchant codebase from `@payrails/web-sdk`
5.x to 6.x. This runbook tells you how to detect what needs migrating, route
each finding to the right instructions, execute the changes, and verify the
result. The detailed before/after for every breaking change lives in the
[migration guide](migration-v6.md) — this document routes you through it; it
does not repeat it. If you are a human, read the migration guide directly.

## Ground rules

- **Detect, don't assume.** Determine the installed SDK version and the APIs
  actually used from the codebase — not from what the user or this document's
  age implies.
- **The installed package is the contract.** When this runbook or any doc
  disagrees with the TypeScript types shipped in the installed
  `@payrails/web-sdk`, the types win. Never invent an API: before writing a call
  you have not seen in the codebase, confirm it exists in the package's `.d.ts`
  or in the [reference docs](../reference/payrails-reference.md).
- **Minimal diffs.** Change only what the migration requires. Do not refactor,
  rename, or restyle surrounding code.
- **Preserve behavior.** Every v5 callback's logic must land in an equivalent v6
  handler — count the callbacks you removed and the listeners you added, and
  reconcile any difference.
- **Escalate, don't skip.** Anything in the
  [escalate to a human](#escalate-to-a-human) list must be reported, not
  silently dropped.

## Phase 0 — Detect

1. Read the installed version of `@payrails/web-sdk` from the lockfile (or
   `node_modules/@payrails/web-sdk/package.json`; fall back to the
   `package.json` range).
2. Route:
   - **5.x** — run the full migration below.
   - **6.x** — a migration may have been left incomplete. Run
     [Phase 1](#phase-1--inventory) anyway; fix whatever it still finds.
   - **4.x or older** — stop and escalate; this runbook only covers 5 → 6.
   - **Not installed / loaded from a script tag** — stop and escalate; this
     runbook covers the npm package only.

## Phase 1 — Inventory

First scope the search: limit every pattern below to files that import or
reference `@payrails/web-sdk`, plus the local modules that build option objects
for its calls. Names like `onChange`, `onFocus`, or `onSuccess` are ubiquitous
in frontend code — unscoped matches outside the SDK integration are false
positives, not work items.

Search the scoped files for each pattern (also match minor formatting variants).
Every hit is a work item; the section column links to the instructions.

| #   | Search for                                                                                                                                                                                                                                                                  | Meaning                                            | Fix per                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `Payrails.init(`                                                                                                                                                                                                                                                            | Init calls that must become awaited                | [guide §1](migration-v6.md#1-payrailsinit-is-asynchronous)                               |
| 2   | `payrails-styles.css`                                                                                                                                                                                                                                                       | CSS import that no longer resolves                 | [guide §1](migration-v6.md#1-payrailsinit-is-asynchronous)                               |
| 3   | `preloadCardForm`                                                                                                                                                                                                                                                           | Removed static method                              | [guide §2](migration-v6.md#2-payrailspreloadcardform-is-removed)                         |
| 4   | `onClientInitialized`                                                                                                                                                                                                                                                       | Argument/helper changes inside handler             | [guide §3](migration-v6.md#3-onclientinitialized-receives-the-execution-response-object) |
| 4b  | `.actionRequired` or `.links.redirect` / `.links['3ds']` read off an execution response (`onClientInitialized` argument or a `payrails.pay(...)` result)                                                                                                                    | Removed fields (6.0.1) — use `requiredAction.href` | [guide §3a](migration-v6.md#3a-requiredaction-replaces-actionrequired-added-in-601)      |
| 5   | `events:` inside options of `dropin(`, `cardForm(`, `paymentButton(`, `googlePayButton(`, `applePayButton(`, `paypalButton(`, `leanButton(`, `genericRedirectButton(`, `dynamicElement(`                                                                                    | Removed callback bags                              | [guide §4](migration-v6.md#4-typed-on-event-api-replaces-events--callback-bags)          |
| 6   | `onAuthorizeSuccess`, `onAuthorizeFailed`, `onAuthorizePending`, `onSuccess`, `onFailed`, `onPending`, `onRequestStart`, `onButtonClicked`, `onPaymentButtonClicked`, `onThreeDSecureChallenge`, `onDeliveryAddressChanged`, `onSessionExpired`, `onPaymentSessionExpired`  | Instance-level bag callbacks                       | [guide §4 tables](migration-v6.md#instance-events)                                       |
| 7   | `onChange`, `onFocus`, `onReady`, `onValidate`, `onValidationChange`, `onStateChanged`, `onSaveInstrumentCheckboxChanged`, `onPreferredSchemeChanged`, `onBillingAddressChanged`, `onPaymentOptionSelected` (in Payrails element options)                                   | Element-level bag callbacks                        | [guide §4 tables](migration-v6.md#element-events)                                        |
| 8   | `onGooglePayAvailable`, `onApplePayAvailable`, `onPaypalAvailable`                                                                                                                                                                                                          | Availability callbacks → promise                   | [guide §5](migration-v6.md#5-wallet-availability-is-a-promise-not-an-event)              |
| 9   | `styles:` inside options of `cardForm(`, `paymentButton(`, `dropin(`, `cardList(`, `dynamicElement(`, `genericRedirectButton(`, `collectContainer(` (a `genericRedirectButton(` `styles` hit for Revolut Pay maps to `appearance.settings` — see item 12, not `rules`)      | Structured styles → `appearance.rules`             | [guide §6](migration-v6.md#6-styles-becomes-appearance)                                  |
| 10  | `inputStyles`, `labelStyles`, `errorTextStyles`                                                                                                                                                                                                                             | Dead collect-element style fields                  | [guide §6](migration-v6.md#collect-elements-field-by-field-mapping)                      |
| 11  | `PayrailsContainerType`, `containerType`                                                                                                                                                                                                                                    | Removed type / option                              | [guide §7](migration-v6.md#7-typescript-changes)                                         |
| 12  | wallet chrome: `paypalButton(` `styles`, `leanButton(` `styles`/`dialogCustomization`, `genericRedirectButton(` `revolutOptions`, and `dropin` `styles.{googlePayButton,paypalButton,applePayButton,revolutPay}` / `paymentMethodsConfiguration.{payPal,revolutPay}` chrome | Provider chrome → `appearance.settings`            | [guide §6](migration-v6.md#6-styles-becomes-appearance)                                  |
| 13  | `merchantInfo` or `environment` inside options of `googlePayButton(` or `paymentMethodsConfiguration.googlePay`                                                                                                                                                             | Merchant-hosted Google Pay removed — delete both   | [guide §10](migration-v6.md#10-google-pay-is-hosted-by-payrails)                         |

Do **not** flag these — they are unchanged or correct in v6:

- `styles` on the standalone `applePayButton` (its `appearance.settings` sizes
  the button box; `styles` sets the native type and style), and the legacy
  `styles` on `googlePayButton` / `paymentMethodsConfiguration.googlePay.styles`
  / `paymentMethodsConfiguration.applePay.styles` (still accepted; Google Pay's
  `appearance.settings` wins where both are set).
- `events: { onClientInitialized }` at `Payrails.init` — the one surviving bag
  callback (the handler body may still need item 4).
- Existing `.on(...)` subscriptions, `setSavedInstrument`, `setState`,
  `payrails.api(...)`, `translations`, `fonts`.

Also check the deployment configuration: if the site sets a
Content-Security-Policy, `assets.payrails.io` must be allowed in `script-src`
and `style-src`. You usually cannot change this yourself — escalate it.

## Phase 2 — Execute

Work in this order; run the project's type-check after each step so regressions
localize to the step that caused them.

1. **Upgrade the dependency** to `@payrails/web-sdk@6` with the project's
   package manager.
2. **Make init awaited** (inventory 1): add `await`, propagate async up through
   the callers, and add rejection handling for `PAYRAILS_INIT_FAILED` where
   other init errors are handled. In SSR frameworks, ensure the call runs only
   in the browser ([guide §1](migration-v6.md#1-payrailsinit-is-asynchronous)).
3. **Delete the CSS import** (inventory 2) and any bundler config that
   referenced it.
4. **Delete `preloadCardForm()` calls** (inventory 3).
5. **Update `onClientInitialized` handler bodies** (inventory 4): the argument
   is the plain response object; helper calls move to the `payrails` instance
   per
   [guide §3](migration-v6.md#3-onclientinitialized-receives-the-execution-response-object).
   Also replace any `actionRequired` / `links.redirect` / `links['3ds']` reads
   (inventory 4b) with `requiredAction.href` per
   [guide §3a](migration-v6.md#3a-requiredaction-replaces-actionrequired-added-in-601).
6. **Replace event bags with `.on()`** (inventory 5–7) using the mapping tables
   in
   [guide §4](migration-v6.md#4-typed-on-event-api-replaces-events--callback-bags).
   Three semantic traps — a mechanical rename is NOT enough:
   - Boolean-return gates (`onRequestStart`, `onButtonClicked`,
     `onDeliveryAddressChanged`) must call `event.preventDefault()`; a thrown
     error no longer blocks the payment.
   - Payment-outcome listeners are session-wide. If the page mounts more than
     one payment element, add `event.paymentMethodCode` / `event.action` filters
     to reproduce the old per-element behavior.
   - `failed` payloads carry the error in `event.data` (`e.data?.code`), not at
     the top level.
7. **Replace availability callbacks** (inventory 8) with
   `await button.isAvailable`
   ([guide §5](migration-v6.md#5-wallet-availability-is-a-promise-not-an-event)).
8. **Migrate styling** (inventory 9–10) to `appearance.rules` using the
   per-element mapping tables in
   [guide §6](migration-v6.md#6-styles-becomes-appearance). Translate each v5
   style key via the tables; do not guess selectors.
9. **Migrate wallet chrome** (inventory 12) to `appearance.settings`: PayPal,
   Revolut Pay, and Lean move their provider options onto `appearance.settings`
   (`styles`/`revolutOptions`/`dialogCustomization` are removed); Google Pay's
   `appearance.settings` wins over its still-accepted legacy `styles`. Apple
   Pay's native styling is unchanged (`styles` only; an optional
   `appearance.settings` for the button box was added in 6.1.0). In the drop-in,
   set each wallet's `settings` under its `DropinAppearance` slot
   (`googlePayButton`, `applePayButton`, `paypalButton`, `revolutPayButton`,
   `leanButton`); Apple Pay's native type and style stay on
   `paymentMethodsConfiguration.applePay.styles`.
10. **Delete Google Pay merchant-hosting fields** (inventory 13): remove
    `merchantInfo` and `environment` from `googlePayButton(...)` options and the
    drop-in's `paymentMethodsConfiguration.googlePay` — the merchant ID and
    environment now come from the server configuration
    ([guide §10](migration-v6.md#10-google-pay-is-hosted-by-payrails)). Keep
    `merchantName` if the project sets it.
11. **Clean up types** (inventory 11) per
    [guide §7](migration-v6.md#7-typescript-changes).

## Phase 3 — Verify

1. **Re-run the Phase 1 inventory.** Items 1–13 (including 4b) must return no
   unmigrated hits (modulo the do-not-flag list).
2. **Type-check and build** the project; both must pass.
3. **Runtime smoke test, if you can run the app:** load the checkout page and
   confirm `Payrails.init` resolves (bundle and stylesheet load from
   `assets.payrails.io`), the payment elements render styled, and no
   `PAYRAILS_INIT_FAILED` error appears in the console.
4. **Report** to the human: version migrated from/to, work items found and fixed
   per inventory row, behavior-affecting choices you made (e.g. where you added
   `paymentMethodCode` filters), and every escalation item below that applies.

## Escalate to a human

Report these instead of deciding yourself:

- **CSP changes** — `assets.payrails.io` in `script-src`/`style-src` is usually
  infrastructure config outside the repo.
- **Visual sign-off** — v6 ships a redesign
  ([guide §8](migration-v6.md#8-refreshed-visual-design)); a human must approve
  the new look and any re-created custom styling.
- **Real payment verification** — completing a test payment in the `TEST`
  environment, 3DS challenges, wallet sheets, and session-expiry refresh need a
  human (or explicit instruction) to exercise.
- **Ambiguous event logic** — if a v5 callback's body encoded per-element
  assumptions you cannot confidently reproduce with filters, show both versions
  and ask.

## Reference map

- [Migration guide](migration-v6.md) — every breaking change with before/after
  code. Your primary instruction source.
- [Payrails class reference](../reference/payrails-reference.md) — option types,
  methods, exports.
- [Events reference](../reference/events-reference.md) — every event with
  payload types and cancelation semantics.
- [Migration guide §6](migration-v6.md#6-styles-becomes-appearance) — the
  authoritative `styles` → `appearance` mapping.
- [Appearance reference](../reference/appearance-reference.md) — the
  `appearance` types, rule semantics, and per-element class contract.
- [Getting started](../getting-started.md) — hub for the remaining how-to
  guides.
