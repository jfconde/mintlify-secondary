# Migrate to Web SDK v6

This guide covers upgrading `@payrails/web-sdk` from 5.x to 6.x: every breaking
change, before/after code for each, and how to verify the result. It assumes a
working 5.x integration. If an AI coding agent performs the migration for you,
point it at the [agent runbook](migration-v6-agent.md), which routes through
this guide.

## Upgrade checklist

Work through these in order — later steps assume the earlier ones are done:

1. Update the package: `npm install @payrails/web-sdk@6`.
2. Add `await` to every `Payrails.init(...)` call (it now returns a `Promise`)
   and make the surrounding code async — see
   [§1](#1-payrailsinit-is-asynchronous).
3. Remove the manual stylesheet import
   (`import '@payrails/web-sdk/payrails-styles.css'`) — it no longer resolves;
   styles load automatically — see [§1](#1-payrailsinit-is-asynchronous).
4. If your site sets a Content-Security-Policy, allow `assets.payrails.io` in
   `script-src`, `style-src`, and `frame-src` (the card form and wallets now
   render in a Payrails secure iframe from that domain).
5. Remove any `Payrails.preloadCardForm()` calls; the method is gone — see
   [§2](#2-payrailspreloadcardform-is-removed).
6. Replace every `events: {}` callback bag with the typed `.on()` API — the bags
   are gone in v6; the one exception is `onClientInitialized` at `Payrails.init`
   — see [§4](#4-typed-on-event-api-replaces-events--callback-bags).
7. Update `onClientInitialized` handlers: the argument is now the plain
   execution response, and its helper methods moved to the `payrails` instance —
   see [§3](#3-onclientinitialized-receives-the-execution-response-object). As
   of 6.0.1, also replace any `actionRequired` / `links.redirect` /
   `links['3ds']` reads with `requiredAction.href` — see
   [§3a](#3a-requiredaction-replaces-actionrequired-added-in-601).
8. Replace wallet availability callbacks (`onGooglePayAvailable`,
   `onApplePayAvailable`, `onPaypalAvailable`) with `await button.isAvailable` —
   see [§5](#5-wallet-availability-is-a-promise-not-an-event).
9. Remove `merchantInfo` and `environment` from your Google Pay options — Google
   Pay now runs under Payrails' own Google registration, so your domain
   registration and merchant ID are no longer used — see
   [§10](#10-google-pay-is-hosted-by-payrails).
10. Migrate `styles` options to `appearance` on every Payrails-drawn element —
    see [§6](#6-styles-becomes-appearance). Provider-drawn wallet buttons keep
    their `styles` chrome options.
11. Update TypeScript type imports — see [§7](#7-typescript-changes).
12. Remove options that were deprecated in v5 and are now gone (`environment`,
    `showExistingCards`, `setSavedCreditCard()`, and others) — see
    [§9](#9-removed-options-deprecated-in-v5).
13. Re-test your checkout visually: the components ship a refreshed design — see
    [§8](#8-refreshed-visual-design).
14. Check your supported browsers against the published matrix — see
    [§11](#11-the-supported-browser-matrix-is-now-stated).

## 1. `Payrails.init` is asynchronous

In v6 the npm package is a thin loader. `Payrails.init(...)` returns a `Promise`
of the SDK instance: at init the SDK loads its full bundle and stylesheet from
the Payrails CDN, pinned to the SDK version configured for your merchant account
(with fallback to the latest release of the current major). Every merchant runs
an SDK version compatible with their account configuration, without waiting for
you to update the npm dependency.

```js
// Before (v5)
import { Payrails } from '@payrails/web-sdk';
import '@payrails/web-sdk/payrails-styles.css';

const payrails = Payrails.init(clientInitResponse, options);

// After (v6)
import { Payrails } from '@payrails/web-sdk';

const payrails = await Payrails.init(clientInitResponse, options);
```

Notes:

- **Stylesheet** — the SDK injects its stylesheet together with the bundle.
  Remove the manual `payrails-styles.css` import: the file is no longer in the
  package and the import fails to resolve (the package `exports` map has no CSS
  subpath), so a leftover import is a build error, not a silent no-op.
- **Content-Security-Policy** — the bundle and stylesheet load from
  `assets.payrails.io`, and the card form and wallet payments now render inside
  a Payrails secure iframe served from the same domain (replacing the legacy
  per-field iframe). Allow `assets.payrails.io` in `script-src`, `style-src`,
  and `frame-src`.
- **Failure mode** — if the bundle cannot load (blocked CDN, offline, timeout),
  `init` rejects with a `PayrailsError` (`PAYRAILS_INIT_FAILED`) after 15
  seconds. Handle the rejection where you handle other init errors.
- **Async propagation** — callers of your init code may need to become async
  too. In React, initialize inside an effect and store the instance in state; in
  Vue, initialize in an async `mounted`/`onMounted` hook.
- **Browser only** — `init` needs a DOM to load the bundle; call it in the
  browser, not during server-side rendering. In SSR frameworks, run it in a
  client-only lifecycle hook (or behind a `typeof window !== 'undefined'`
  guard).

## 2. `Payrails.preloadCardForm()` is removed

The static `Payrails.preloadCardForm()` no longer exists — the npm package is
now a loader, so before `init` there is nothing to preload from. Delete the
call; the SDK bundle itself is fetched at `init`, and the secure card fields
load when the card form mounts. There is no v6 equivalent for warming the card
form ahead of time — if you used `preloadCardForm` for perceived performance,
mount the card form earlier (hidden if necessary) instead:

```js
// Before (v5)
Payrails.preloadCardForm();
const payrails = Payrails.init(clientInitResponse, options);

// After (v6)
const payrails = await Payrails.init(clientInitResponse, options);
```

## 3. `onClientInitialized` receives the execution response object

`onClientInitialized` remains a callback passed at init — it is the one event
with no `.on()` form, because it fires during initialization, before a listener
could be registered. It also fires again after each session refresh (see
[`sessionExpired`](#sessionexpired-can-refresh-the-session) below).

Two things changed about it:

**The argument is now the plain workflow execution response**
(`WorkflowExecutionResponse`, e.g. `execution.id`) instead of the execution
class instance.

**The class instance's helper methods moved to the `payrails` instance.** If
your handler called helpers on the argument, call them on the SDK instance
instead:

| v5 — on the callback argument               | v6 — on the `payrails` instance            |
| ------------------------------------------- | ------------------------------------------ |
| `execution.savedCreditCards`                | `payrails.getSavedCreditCards()`           |
| `execution.getPaymentInstallmentOptions(m)` | `payrails.getPaymentInstallmentOptions(m)` |
| `execution.getPaymentMethodConfig(m)`       | `payrails.getPaymentMethodConfig(m)`       |

```js
// Before (v5) — class instance with helper methods
Payrails.init(clientInitResponse, {
  events: {
    onClientInitialized: (execution) => {
      const cards = execution.savedCreditCards;
    },
  },
});

// After (v6) — plain response object; helpers live on the instance
const payrails = await Payrails.init(clientInitResponse, {
  events: {
    onClientInitialized: (execution) => {
      console.log('SDK ready', execution.id);
    },
  },
});
const cards = payrails.getSavedCreditCards();
```

Read anything else you used to pull off the class directly from the response
object.

### 3a. `requiredAction` replaces `actionRequired` (added in 6.0.1)

As of 6.0.1, the response's `actionRequired` string and `links.redirect` /
`links['3ds']` fields are removed. Redirect-based executions
(`authorizePending`) now carry a single `requiredAction` object instead:

```ts
requiredAction?: {
  method: string;
  href: string;
  type: string;
  subType?: string;
};
```

If your `onClientInitialized` handler (or any code reading the response from
`payrails.pay(...)`) branched on `actionRequired` or read `links.redirect` /
`links['3ds']`, update it to read `requiredAction.href`:

```js
// Before
if (execution.actionRequired === '3ds') {
  redirectTo(execution.links['3ds']);
} else if (execution.actionRequired === 'redirect') {
  redirectTo(execution.links.redirect);
}

// After
if (execution.requiredAction) {
  redirectTo(execution.requiredAction.href);
}
```

## 4. Typed `.on()` event API replaces `events: {}` callback bags

v6 removes the legacy `events: {}` callback bags from every element factory and
from `payrails.dropin()` — passing one is a compile error, with no back-compat
bridge. Subscribe with the typed `.on(name, handler)` API instead. `.on()`
supports multiple listeners per event and returns an unsubscribe function:

```js
const off = payrails.on('success', (event) => {
  console.log(event.action, event.paymentMethodCode);
});
// later: off();
```

Events live at two levels:

- **Instance** — `payrails.on(...)` for session and payment-attempt events.
  Payment-attempt payloads carry `executionId`, `paymentMethodCode`, and
  `action` (`'AUTHORIZE'` | `'TOKENIZE'`).
- **Element** — `element.on(...)` for events about one element (a card form, a
  button, the drop-in), where `element` is the object returned by
  `payrails.cardForm()`, `payrails.paymentButton()`, and so on.

### Behavior differences from the legacy callbacks

1. **Canceling uses `event.preventDefault()`, not a boolean return.** Callbacks
   that returned `Promise<boolean>` to cancel a flow are now cancelable events.

   ```js
   // Before (v5)
   paymentButton({
     events: { onPaymentButtonClicked: async () => await isReady() },
   });

   // After (v6)
   payrails.on('buttonClicked', async (event) => {
     if (!(await isReady())) event.preventDefault();
   });
   ```

2. **Payment-attempt events are per-session, not per-element.** In v5 each
   element had its own bag: `applePayButton({ events: { onSuccess } })` fired
   only for that button. In v6 a single `payrails.on('success', ...)` fires for
   **any** element's success in the session — card form, wallet buttons,
   drop-in, all of them. Filter with `event.paymentMethodCode` or `event.action`
   if you need per-method behavior:

   ```js
   payrails.on('success', (event) => {
     if (event.paymentMethodCode === 'card') showCardReceipt();
     if (event.paymentMethodCode === 'applePay') showWalletReceipt();
   });
   ```

3. **A thrown handler no longer blocks the payment.** In v5, a gate callback
   (`onRequestStart`, `onPaymentButtonClicked`) that threw propagated as a
   payment failure. In v6 the SDK catches and logs the error and the flow
   continues. Blocking validation or fraud checks must call
   `event.preventDefault()` explicitly:

   ```js
   payrails.on('buttonClicked', async (event) => {
     try {
       await runFraudCheck();
     } catch {
       event.preventDefault(); // required — throwing alone won't block
     }
   });
   ```

4. **`sessionExpired` handlers run serially.** The SDK awaits each handler in
   registration order; a slow handler delays the session refresh. Do only
   refresh-adjacent work there.

### `sessionExpired` can refresh the session

A handler may return fresh init options (`{ version, data }`); the SDK re-
initializes from the first non-null result and re-runs `onClientInitialized`:

```js
payrails.on('sessionExpired', async () => fetchNewInitResponse());
```

### Instance events

| Legacy callback                                       | Replacement                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `events.onSessionExpired` / `onPaymentSessionExpired` | `payrails.on('sessionExpired', async () => newInitOptions)`             |
| `events.onSuccess` / `onAuthorizeSuccess`             | `payrails.on('success', (e) => ...)`                                    |
| `events.onFailed` / `onAuthorizeFailed`               | `payrails.on('failed', (e) => console.log(e.data?.code))`               |
| `events.onPending` / `onAuthorizePending`             | `payrails.on('pending', (e) => ...)`                                    |
| `events.onRequestStart` / `onAuthorizeRequestStart`   | `payrails.on('requestStart', (e) => { if (!ok) e.preventDefault(); })`  |
| `events.onButtonClicked` / `onPaymentButtonClicked`   | `payrails.on('buttonClicked', (e) => { if (!ok) e.preventDefault(); })` |
| `events.onThreeDSecureChallenge`                      | `payrails.on('actionRequired', (e) => ...)`                             |
| `events.onDeliveryAddressChanged`                     | `payrails.on('deliveryAddressChanged', (e) => ...)`                     |

Payload notes: `failed` carries the failure essentials in `e.data`
(`{ code?, message? }`) rather than at the top level; `buttonClicked` adds
`bin?` for card payments; `deliveryAddressChanged` replaces the v5
resolve-`false`-to-reject contract with `preventDefault()`.

### Element events

| Legacy callback (per element)                                        | Replacement                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `onChange(e)`                                                        | `element.on('change', (e) => e.isValid)`                        |
| `onFocus()`                                                          | `element.on('focus', () => ...)`                                |
| — (new)                                                              | `element.on('blur', () => ...)`                                 |
| `onReady()`                                                          | `element.on('ready', () => ...)`                                |
| `onSaveInstrumentCheckboxChanged({ checked })`                       | `element.on('saveInstrumentCheckboxChanged', (e) => e.checked)` |
| `onPreferredSchemeChanged(...)`                                      | `element.on('preferredSchemeChanged', (e) => ...)`              |
| `onBillingAddressChanged(...)`                                       | `element.on('billingAddressChanged', (e) => ...)`               |
| `onValidate(...)`                                                    | `element.on('validate', (e) => ...)`                            |
| `onValidationChange(isValid)` _(dynamic element)_                    | `element.on('validate', (e) => e.isValid)`                      |
| `onStateChanged(state)`                                              | `element.on('stateChanged', (e) => e.state)`                    |
| `onPaymentOptionSelected(e)`                                         | `element.on('paymentOptionSelected', (e) => ...)`               |
| `onGooglePayAvailable` / `onApplePayAvailable` / `onPaypalAvailable` | `await button.isAvailable` — a promise, not an event; see §5    |

Full payload types and cancelation semantics:
[Events reference](../reference/events-reference.md).

## 5. Wallet availability is a promise, not an event

Wallet availability is an environment check that settles once — modelling it as
an event meant subscribers could race the check. In v6 every express payment
button (`googlePayButton`, `applePayButton`, `paypalButton`) exposes
`readonly isAvailable: Promise<boolean>` instead:

```js
// Before (v5)
const button = payrails.paypalButton({
  events: { onPaypalAvailable: () => button.mount('#paypal-slot') },
});

// After (v6)
const button = payrails.paypalButton({});
if (await button.isAvailable) {
  button.mount('#paypal-slot');
} else {
  showFallback();
}
```

The promise never rejects — it resolves to `false` on any check-side failure.
The instance-level checks `payrails.isGooglePayAvailable(merchantName?)` and
`payrails.isApplePayAvailable()` also remain available.

## 6. `styles` becomes `appearance`

v6 replaces the per-component structured `styles` object with a single
`appearance` option on every element the SDK draws itself. `appearance.rules` is
plain CSS-like key/value: selectors on the outside, CSS declarations on the
inside. Selectors target stable class names the SDK guarantees on the DOM; state
variants live on BEM modifier classes.

```js
// Before (v5)
payrails.paymentButton({
  styles: {
    base: { backgroundColor: '#1a1a1a', color: '#fff' },
    hover: { backgroundColor: '#333' },
    disabled: { opacity: '0.5' },
    loading: { cursor: 'wait' },
  },
});

// After (v6)
payrails.paymentButton({
  appearance: {
    rules: {
      '.payrails-button': { backgroundColor: '#1a1a1a', color: '#fff' },
      '.payrails-button:hover': { backgroundColor: '#333' },
      '.payrails-button--disabled': { opacity: '0.5' },
      '.payrails-button--loading': { cursor: 'wait' },
    },
  },
});
```

Unlike the closed vocabulary of v5 `styles` keys, `rules` accepts any selector a
browser supports — `:focus-visible`, `::placeholder`, `::selection`, `@media`,
`@supports`.

### Which options changed

| Element factory                  | v5                                             | v6                                                                     |
| -------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `payrails.cardForm`              | `styles` (structured)                          | `appearance` (`CardFormAppearance`, with nested child slots)           |
| `payrails.paymentButton`         | `styles` (`base`/`hover`/`disabled`/`loading`) | `appearance`                                                           |
| `payrails.dropin`                | `styles` (per-component keys)                  | `appearance` (`DropinAppearance`, keyed by building block)             |
| `payrails.cardList`              | —                                              | `appearance`                                                           |
| `payrails.dynamicElement`        | `styles`                                       | `appearance`                                                           |
| `payrails.genericRedirectButton` | `styles`                                       | `appearance.rules`; for Revolut Pay, `appearance.settings` (see below) |
| `payrails.leanButton`            | `styles.button` / `styles.dialog`              | `appearance.settings` (see below)                                      |
| `container.createCollectElement` | `inputStyles`/`labelStyles`/`errorTextStyles`  | `appearance` — the legacy fields still type-check but are **ignored**  |
| `payrails.collectContainer`      | `styles`                                       | — (style the fields via each element's `appearance`)                   |
| `payrails.googlePayButton`       | `styles` (provider chrome)                     | `appearance.settings` (legacy `styles` still works; `settings` wins)   |
| `payrails.applePayButton`        | `styles` (provider chrome)                     | unchanged — still `styles`                                             |
| `payrails.paypalButton`          | `styles` (provider chrome)                     | `appearance.settings` (`styles` removed)                               |

> **Collect elements:** `inputStyles`, `labelStyles`, and `errorTextStyles`
> still exist on `createCollectElement`'s options type but have no effect at
> runtime in v6 — migrate them to `appearance` or your field styling silently
> disappears.

### The class names on the DOM

Target these generic classes from `appearance.rules`: `.payrails-input`,
`.payrails-button`, `.payrails-dropdown`, `.payrails-label`, `.payrails-tile`,
`.payrails-container`, `.payrails-row`, `.payrails-cell`, `.payrails-icon`,
`.payrails-checkbox`, `.payrails-error`, `.payrails-text`.

State variants use BEM modifiers:

| State                    | Class                         |
| ------------------------ | ----------------------------- |
| Field with invalid input | `.payrails-input--invalid`    |
| Field with valid input   | `.payrails-input--valid`      |
| Field is empty           | `.payrails-input--empty`      |
| Field touched since load | `.payrails-input--dirty`      |
| Button in loading state  | `.payrails-button--loading`   |
| Button disabled          | `.payrails-button--disabled`  |
| Checkbox checked         | `.payrails-checkbox--checked` |
| Brand tile selected      | `.payrails-tile--selected`    |

Native pseudo-classes (`:hover`, `:focus`, `:focus-visible`, `:disabled`,
`:autofill`, `::placeholder`, `::selection`) work anywhere they are valid.

The `--invalid` and `--valid` classes clear while a field is focused, so a field
being corrected does not show the error state. For a persistent invalid look on
touched fields, key off `--dirty`:

```css
.payrails-input--dirty:not(:focus).payrails-input--invalid {
  border-color: #dc2626;
}
```

### Card form: field-by-field mapping

| v5 key                                                                         | v6 selector under `appearance.rules`        |
| ------------------------------------------------------------------------------ | ------------------------------------------- |
| `styles.wrapper`                                                               | `.payrails-container`                       |
| `styles.base`                                                                  | (removed — set on `.payrails-input`)        |
| `styles.inputFields.all.base`                                                  | `.payrails-input`                           |
| `styles.inputFields.all.focus`                                                 | `.payrails-input:focus`                     |
| `styles.inputFields.all.complete`                                              | `.payrails-input--valid`                    |
| `styles.inputFields.all.invalid`                                               | `.payrails-input--invalid`                  |
| `styles.inputFields.all.empty`                                                 | `.payrails-input--empty`                    |
| `styles.inputFields.all.cardIcon`                                              | `.payrails-icon` (inside card-number field) |
| `styles.labels.all`                                                            | `.payrails-label`                           |
| `styles.errorTextStyles.base`                                                  | `.payrails-error`                           |
| `styles.storeInstrumentCheckbox` (or its deprecated alias `storeCardCheckbox`) | `.payrails-checkbox`                        |

Per-field-type keys (`styles.inputFields.CARD_NUMBER.*`) have no direct
equivalent — in practice the generic `.payrails-input` covers most needs.

Nested widgets — the installments dropdown, address selector, and brand selector
— each have their own slot on `CardFormAppearance`:

```js
payrails.cardForm({
  appearance: {
    rules: {
      '.payrails-container': { gap: '16px' },
      '.payrails-input': { border: '1px solid #eae8ee' },
    },
    installments: {
      rules: { '.payrails-dropdown': { borderRadius: '8px' } },
    },
    address: {
      rules: { '.payrails-dropdown, .payrails-input': { borderRadius: '8px' } },
    },
    brandSelector: {
      rules: { '.payrails-tile--selected': { borderColor: '#4F46E5' } },
    },
  },
});
```

The card payment button is a sibling of the card form, not a child: pass its
appearance to `payrails.paymentButton({ appearance })` (standalone) or to
`DropinAppearance.cardPaymentButton` (drop-in mode).

### Collect elements: field-by-field mapping

| v5 key                 | v6 selector                                |
| ---------------------- | ------------------------------------------ |
| `inputStyles.base`     | `.payrails-input`                          |
| `inputStyles.focus`    | `.payrails-input:focus`                    |
| `inputStyles.complete` | `.payrails-input--valid`                   |
| `inputStyles.empty`    | `.payrails-input--empty`                   |
| `inputStyles.invalid`  | `.payrails-input--invalid`                 |
| `inputStyles.cardIcon` | `.payrails-icon`                           |
| `labelStyles.base`     | `.payrails-label`                          |
| `labelStyles.focus`    | `.payrails-field--focused .payrails-label` |
| `errorTextStyles.base` | `.payrails-error`                          |

Only the root `{ rules }` is forwarded to each collect element's iframe; nested
widget keys are ignored (secure fields have no sub-widgets).

### Drop-in: appearance keyed by building block

`DropinAppearance` mirrors the drop-in's structure — root rules paint the
container; each building block takes its own appearance under a matching key:

```js
payrails.dropin({
  appearance: {
    rules: {
      '.payrails-container': { borderRadius: '12px' },
    },
    cardForm: {
      rules: { '.payrails-input': { border: '1px solid #ddd' } },
      installments: {
        rules: { '.payrails-dropdown': { borderRadius: '8px' } },
      },
    },
    cardPaymentButton: {
      rules: { '.payrails-button': { backgroundColor: '#4F46E5' } },
    },
    loadingScreen: { rules: {} },
    authSuccess: { rules: {} },
    authFailed: { rules: {} },
    // merchant-of-record blocks — the v5 `dropin.styles.*` equivalents
    orderSummary: { rules: {} },
    billingAddressForm: { rules: {} },
    termsAndConditions: { rules: {} },
  },
});
```

The full slot list and per-slot class contract:
[Appearance reference](../reference/appearance-reference.md).

### Wallet chrome: `styles` → `appearance.settings`

Google Pay, PayPal, Revolut Pay, and Lean draw their own chrome (a native button
SDK, a hosted modal, or brand-locked artwork), so CSS cannot reach them. Their
options move from `styles` to `appearance.settings` — the same values, under a
new field:

```js
// Before (v5)
payrails.paypalButton({
  styles: { color: 'gold', shape: 'rect' },
});

// After (v6)
payrails.paypalButton({
  appearance: {
    settings: { color: 'gold', shape: 'rect' },
  },
});
```

Per wallet:

- **Google Pay** — `appearance.settings` (`buttonColor`, `buttonType`,
  `buttonSizeMode`, `buttonRadius`, `height`, `locale`). The legacy `styles`
  option is deprecated (it accepts the enum fields only and logs a console
  warning); `appearance.settings` wins where both are set.
- **PayPal** — `appearance.settings` (`color`, `height`, `label`, `shape`,
  `tagline`, `locale`). The `styles` option is removed.
- **Revolut Pay** (via `genericRedirectButton`) — `appearance.settings`
  (`theme`, `width`, `height`, `borderRadius`); the v5 `styles` /
  `revolutOptions` fields are removed. Non-Revolut redirect buttons keep using
  `appearance.rules` on `.payrails-generic-button`.
- **Lean** — `appearance.settings` (`themeColor`, `buttonTextColor`,
  `buttonBorderRadius`, `linkColor`, `overlayColor` for the hosted dialog); the
  v5 `styles.button` / `styles.dialog` split is removed. Lean takes no `rules`.
- **Apple Pay** — unchanged: the native button type, style, and locale still
  come from the standalone `styles` option. (An optional `appearance.settings`
  for the button box — size, radius, padding — was added in 6.1.0.)

In the drop-in, wallet chrome moves onto matching `DropinAppearance` slots:

```js
// Before (v5)
payrails.dropin({
  styles: {
    googlePayButton: { buttonColor: 'black', buttonType: 'buy' },
  },
});

// After (v6)
payrails.dropin({
  appearance: {
    googlePayButton: { settings: { buttonColor: 'black', buttonType: 'buy' } },
    applePayButton: { settings: { height: '48px', borderRadius: '8px' } },
    paypalButton: { settings: { color: 'gold' } },
    revolutPayButton: { settings: { theme: 'dark' } },
    leanButton: { settings: { themeColor: '#1a1a1a' } },
  },
});
```

Apple Pay splits across two options. Its box (size, radius, padding) uses the
`applePayButton` slot, added in 6.1.0; its native button type and style still
come from `paymentMethodsConfiguration.applePay.styles`. (Google Pay also still
accepts the legacy `paymentMethodsConfiguration.googlePay.styles`.)

### Cascade behavior

SDK defaults live in the CSS layer `@layer payrails-defaults`; your `appearance`
rules land in `@layer payrails-appearance`, which always wins over the defaults.
Rules in your own external stylesheets are unlayered and beat both — if you
previously targeted `.payrails-*` classes from your own CSS, that keeps working,
but internal markup changed in the redesign ([§8](#8-refreshed-visual-design)),
so re-test every override and prefer moving it into `appearance.rules`.

`translations` and `fonts` did not change shape.

## 7. TypeScript changes

- **`PayrailsContainerType` is removed** along with the `containerType` option
  of `CollectContainerOptions` — secure-fields containers no longer come in two
  flavors. `CollectContainerOptions` now has `containerId` and `fonts` only. The
  container returned by `payrails.collectContainer()` keeps its exported
  `FramesContainer` type, unchanged from v5.
- **New appearance types are exported:** `Appearance`, `AppearanceRules`,
  `AppearanceDeclarations`, `CardFormAppearance`, `DropinAppearance`, plus the
  wallet settings types `GooglePaySettings`, `PaypalSettings`,
  `GooglePayButtonAppearance`, `PaypalButtonAppearance`, `RevolutPayAppearance`,
  `LeanButtonAppearance`, and `LeanCustomization`.
- **`RevolutPayStyles` remains exported** — it is now the type of the Revolut
  Pay button's `appearance.settings`.
- Event types are exported for the `.on()` surface: `PayrailsEvents`,
  `PayrailsEventName`, `PayrailsEventHandler`, `ElementEvents`,
  `ElementEventName`, `ElementEventHandler`, `PaymentAttemptContext`,
  `ActionRequiredEvent`, and the per-event payload types.

These affect type annotations only; runtime behavior is covered by the sections
above.

## 8. Refreshed visual design

The drop-in, card form, payment buttons, and result screens ship a refreshed
design: a unified button style across payment methods, updated typography and
spacing, and improved responsiveness in narrow containers.

No code changes are required, but the rendered DOM and default styles have
changed:

- If you customized the checkout in v5, re-apply your intent through
  `appearance` ([§6](#6-styles-becomes-appearance)) and re-test each customized
  component.
- If you override SDK styles with your own CSS selectors, expect breakage —
  internal class names and markup have changed. Re-test and update your
  overrides. [§6](#6-styles-becomes-appearance) documents the supported class
  names and state modifiers.

## 9. Removed options (deprecated in v5)

These options and methods were deprecated in v5 and are removed in v6. Most
integrations already stopped using them, but any leftover usage is now a
TypeScript build error rather than a warning.

| Removed in v6                                  | What to do instead                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `environment` on `Payrails.init(...)` options  | Remove it — the SDK now reads the environment from the session config your server issues. |
| `clientDomain` on `Payrails.init(...)` options | Remove it.                                                                                |
| `showPaymentMethodLogo`                        | Remove it.                                                                                |
| `showExistingCards` (drop-in cards config)     | Use `showStoredInstruments`.                                                              |
| `setSavedCreditCard(...)`                      | Use `setSavedInstrument(...)`.                                                            |
| `merchantInfo` / `environment` (Google Pay)    | Remove them — see [§10](#10-google-pay-is-hosted-by-payrails).                            |

## 10. Google Pay is hosted by Payrails

In older 5.x versions you ran Google Pay under your own Google registration: you
registered your checkout domain in the Google Pay & Wallet Console and passed
your Google merchant details to the SDK. Since 5.46.1 the Google Pay button
renders inside the Payrails secure iframe under Payrails' own Google Pay
registration instead, and in v6 that is the only mode. The `merchantInfo` and
`environment` options are removed from `payrails.googlePayButton(...)` and from
the drop-in's `googlePay` configuration — passing either is now a build error.

**This is a breaking change** for merchant-hosted Google Pay integrations, and
switching to the Payrails-hosted model also involves configuration on the
Payrails side. Please reach out to your Payrails partner before the upgrade to
plan the v6 rollout for Google Pay.

```js
// Before (v5, merchant-hosted)
payrails.googlePayButton({
  environment: 'PRODUCTION',
  merchantInfo: {
    merchantId: 'BCR2DN...',
    merchantName: 'Your Store',
  },
});

// After (v6, Payrails-hosted)
payrails.googlePayButton({
  merchantName: 'Your Store', // optional display-name override
});
```

Notes:

- The merchant ID and the `TEST`/`PRODUCTION` environment now come from your
  Payrails account configuration, delivered in the init response. There is
  nothing to configure in code.
- Your Google Pay & Wallet Console domain registration is no longer used by this
  integration, and new domains (staging, previews) work without console entries.
- `merchantName` stays available as an override for the store name shown in the
  Google Pay sheet.
- **Coming from a version older than 5.46?** Upgrading straight to v6 puts you
  on the hosted model in one step, with no intermediate release needed. It is
  not zero-effort, though: Payrails must first enable the hosted configuration
  for your account (without it, Google Pay has no merchant ID in `PRODUCTION`),
  so coordinate the upgrade with your Payrails partner before you ship it. If
  you upgrade in stages instead, 5.46.1 is the first version supporting both
  models and is a safe intermediate stop; Payrails switches the hosting
  server-side with no code change on your end.

Background on the change:
[Google Pay hosting](../explanation/google-pay-hosting.md).

## 11. The supported browser matrix is now stated

**No action needed for most integrations.** This is a documentation and
enforcement change, not a behavioural one — v6 does not drop support for any
browser that v5 actually worked on.

Previously the SDK advertised `ios > 11` in a build config that had stopped
running, while the code it shipped required newer engines. v6 publishes the real
matrix and enforces it in CI:

| Browser               | Minimum version |
| --------------------- | --------------- |
| Safari (macOS)        | 12.1            |
| Safari (iOS / iPadOS) | 12.2            |
| Chrome                | 73              |
| Edge                  | 79              |
| Firefox               | 67              |
| Opera                 | 60              |
| Samsung Internet      | 11.1            |

If you support browsers below this floor, load a polyfill (for example
`core-js`) before the Payrails SDK — it ships no ES built-in polyfills of its
own. Full details: [browser support](../reference/browser-support.md).

## Verify the migration

After migrating, confirm each of these:

1. **It compiles.** Run your type-check/build. Leftover v5 usage (`events:` bags
   on element options, the CSS import, `preloadCardForm`,
   `PayrailsContainerType`) fails the build.
2. **Init resolves.** The page loads the SDK bundle and stylesheet from
   `assets.payrails.io` (visible in the network tab) and `await Payrails.init`
   resolves without `PAYRAILS_INIT_FAILED`. Test with your production CSP if you
   have one.
3. **Elements render styled.** The card form / drop-in mounts with the v6 design
   and your `appearance` rules applied — a completely unstyled form usually
   means styling was left on dead v5 options.
4. **A test payment fires your listeners.** Complete a payment in the `TEST`
   environment and confirm your `success`/`failed` handlers fire (with the right
   `paymentMethodCode` filters if you pay with multiple methods).
5. **Gates still gate.** If you migrated `onRequestStart`/`onButtonClicked`
   logic, confirm a rejected check actually blocks the payment — remember that
   throwing no longer blocks
   ([§4](#behavior-differences-from-the-legacy-callbacks)).
6. **Session refresh works** if you use `sessionExpired`: let a session expire
   (or force it) and confirm the SDK re-initializes and `onClientInitialized`
   fires again.
7. **Google Pay still pays** if you offer it: complete a Google Pay payment in
   the `TEST` environment. The button renders from the Payrails secure iframe
   and needs no Google Pay & Wallet Console registration of your domain
   ([§10](#10-google-pay-is-hosted-by-payrails)).
