# Events

Reference for the events surface of `@payrails/web-sdk`. For task guides see
../how-to/.

The SDK exposes events through the typed `.on(name, handler)` API at two levels:

1. **Instance events** — `payrails.on(name, handler)`. Session-level and
   in-flight payment-attempt events (`success`, `failed`, `pending`,
   `buttonClicked`, `requestStart`, `actionRequired`, `sessionExpired`,
   `deliveryAddressChanged`).
2. **Element events** — `element.on(name, handler)`, where `element` is the
   object returned by `payrails.cardForm()`, `payrails.paymentButton()`,
   `payrails.googlePayButton()`, and so on. Element events describe one rendered
   element (`change`, `focus`, `blur`, `ready`, `saveInstrumentCheckboxChanged`,
   `preferredSchemeChanged`, `billingAddressChanged`, `validate`,
   `stateChanged`, `paymentOptionSelected`).

`.on()` returns an unsubscribe function. Handlers may be async; the SDK awaits
each handler before proceeding. A handler that throws is logged and isolated
(other handlers still run). `Payrails.init` resets all subscriptions.

```ts
const off = payrails.on('success', (event) => {
  console.log(event.paymentMethodCode, event.action);
});
// later:
off(); // or payrails.off('success', handler)
```

## Init-time callback (the one exception)

The only bag callback that still exists is `onClientInitialized`, passed inside
`PayrailsClientOptions.events` on `Payrails.init`. It has no `.on()` form
because it fires during construction, before a `.on(...)` listener could
register.

```ts
const payrails = await Payrails.init(initResponse, {
  events: {
    onClientInitialized: (execution) => useExecution(execution),
  },
});
```

Fires once when the `Payrails` instance is constructed, and again after a
successful session refresh (see `sessionExpired`). Its argument is the execution
response object (`WorkflowExecutionResponse`, e.g. `execution.id`).

When the execution is `authorizePending`, `execution.requiredAction` (added in
6.0.1) describes the redirect to send the shopper to:
`{ method, href, type, subType? }`. Use `execution.requiredAction.href` for the
URL. The legacy `execution.actionRequired` string and `execution.links.redirect`
/ `execution.links['3ds']` fields are removed as of 6.0.1 — see the
[migration note](../how-to/migration-v6.md#3a-requiredaction-replaces-actionrequired-added-in-601).

## Instance events — `payrails.on(name, handler)`

Every payment-attempt payload carries `PaymentAttemptContext`:

| Field               | Type                        | Description                                   |
| ------------------- | --------------------------- | --------------------------------------------- |
| `executionId`       | `string`                    | The workflow execution id of the attempt.     |
| `paymentMethodCode` | `string`                    | The payment method of the attempt.            |
| `action`            | `'AUTHORIZE' \| 'TOKENIZE'` | Whether it's a payment or an instrument save. |

One listener fires for **any** element's event in the session — filter with
`event.paymentMethodCode` / `event.action` if you need per-method behaviour.

### `success`

Fires when authorization (or tokenization) completes successfully.

Payload: `{ …ctx, data? }`. `data` carries the tokenization result on a
`TOKENIZE` success (notably for Google Pay / Apple Pay) and is absent for flows
that return nothing (e.g. `AUTHORIZE`).

### `failed`

Fires when the attempt fails or is canceled.

Payload: `{ …ctx, data?: { code?, message? } }` where `code` is an
`AuthorizationFailureReasons` value (`VALIDATION_FAILED`, `AUTHORIZATION_ERROR`,
`AUTHENTICATION_ERROR`, `UNKNOWN_ERROR`, `USER_CANCELLED`).

### `pending`

Fires when the payment ends in a pending state (e.g. the result is not final yet
after a redirect or challenge).

Payload: `{ …ctx, data? }`.

### `requestStart` (cancelable)

Fires immediately before the authorize/tokenize request is sent.

Payload: `{ …ctx, preventDefault() }`. Call `preventDefault()` to abort — the
SDK then fires `failed` with `code: 'VALIDATION_FAILED'`.

### `buttonClicked` (cancelable)

Fires when the shopper clicks the payment button, before anything is submitted.

Payload: `{ …ctx, bin?, preventDefault() }`. For card payments `bin` carries the
current BIN. Call `preventDefault()` to abort — the SDK then fires `failed` with
`code: 'VALIDATION_FAILED'`.

### `sessionExpired`

Fires when the SDK detects the client session has expired, or when a payment
attempt fails because the session/vault token is no longer valid.

Payload: `void`. Handlers **may** return a fresh `InitOptions`
(`{ version, data }`); the SDK awaits all handlers, re-inits from the first
non-null result, and then re-runs the init `onClientInitialized` callback.

```ts
payrails.on('sessionExpired', async () => fetchNewInitResponse());
```

### `deliveryAddressChanged` (cancelable)

Fires when the shopper changes the shipping address inside an express-checkout
sheet (PayPal, Apple Pay).

Payload: `{ …ctx, deliveryAddress?, preventDefault() }`. Call `preventDefault()`
to reject the address (the Apple Pay sheet shows an error and prompts for
another address; PayPal cancels the change).

- Apple Pay exposes only redacted fields (`city`, `postalCode`, `state`,
  `country.code`) before the shopper authorizes; the full address is available
  on `success`. Apple Pay requires a response within ~30 seconds — keep this
  handler fast.
- On PayPal, the payload shape is
  `{ orderID?, paymentID?, paymentToken?, shippingAddress?: { city, countryCode, postalCode, state } }`.

### `actionRequired` (cancelable)

Fires when a payment attempt needs a shopper-facing action and the SDK is about
to perform its default behavior — navigating to a redirect URL or presenting the
3DS challenge (popup or redirect).

Payload (`ActionRequiredEvent`):

| Field               | Type                         | Description                                                                                |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `url`               | `string`                     | The URL the shopper must be taken to.                                                      |
| `kind`              | `'genericRedirect' \| '3ds'` | What the action is (`ACTION_REQUIRED_KIND` values).                                        |
| `executionId`       | `string`                     | The workflow execution id of the payment attempt.                                          |
| `paymentMethodCode` | `string`                     | The payment method of the attempt.                                                         |
| `preventDefault()`  | `() => void`                 | Call to take over: the SDK skips its default redirect/popup and you handle `url` yourself. |

```ts
payrails.on('actionRequired', (event) => {
  if (event.kind === 'genericRedirect') {
    event.preventDefault();
    myRouter.openInModal(event.url);
  }
});
```

## Element events — `element.on(name, handler)`

Element events are declared on the object returned by an element factory
(`cardForm`, `paymentButton`, `googlePayButton`, `applePayButton`,
`paypalButton`, `dropin`, `dynamicElement`, …). A name lives on exactly one
element type; using it on the wrong element is a compile error.

### `change`

Fires on every input change.

Payload on the card form:
`{ isValid, cardNetwork, bin?, billingAddress?, cardSchemes? }`. On a standalone
secure field (collect element) the payload is
`{ isValid, isEmpty, network, bin?, cardSchemes? }` — note `network`, not
`cardNetwork`. On a dynamic element form (including the billing address form)
the payload is `{ isValid, values }` — `values` holds the current values of the
visible form fields, keyed by field name.

### `focus` / `blur`

Fires when a card field gains / loses focus. Focusing the card form also clears
a `cardList` selection.

Payload: `void`.

### `ready`

Fires when all secure fields have mounted and the form is interactive.

Payload: `void`.

### `saveInstrumentCheckboxChanged`

Fires when the shopper toggles the "save instrument" checkbox.

Payload: `{ checked: boolean }`.

### `preferredSchemeChanged`

Fires when the detected/selected card scheme changes for a co-branded card.

Payload: `{ preferredScheme: string, cardSchemes: CardScheme[] }`.

### `billingAddressChanged`

Fires when the shopper edits the billing address form.

Payload: `{ isValid: boolean, billingAddress? }`.

### `validate`

Fires after the card form is validated on click, before the payment request.

Payload: `{ isValid, error?, fieldErrors? }`. `fieldErrors` maps fields to their
validation errors.

### `stateChanged`

Fires when a payment button switches between enabled and disabled (e.g. as
card-form validity changes).

Payload: `{ state: 'enabled' | 'disabled' }`.

### Wallet availability (not an event)

Wallet availability is exposed as `readonly isAvailable: Promise<boolean>` on
`googlePayButton`, `applePayButton`, and `paypalButton` — not as an event,
because it is a capability check that settles once. The promise never rejects;
it resolves to `false` on any check-side failure. See the
[`payrails` reference](payrails-reference.md#googlepaybuttonoptions).

### `paymentOptionSelected`

Fires when the shopper selects a payment option in the drop-in.

Payload: `{ paymentMethod?, instrument? }`. `paymentMethod` is the selected
method's configuration; `instrument` is set when a stored instrument was
selected.

## Usage

```ts
import { Payrails } from '@payrails/web-sdk';

const payrails = await Payrails.init(initResponse, {
  events: { onClientInitialized: (execution) => useExecution(execution) },
});

const cardForm = payrails.cardForm();
cardForm.on('change', (e) => render(e.isValid));
cardForm.on('ready', () => show());

payrails.on('buttonClicked', async (e) => {
  if (!(await ok())) e.preventDefault();
});
payrails.on('success', (e) => console.log(e.paymentMethodCode));
payrails.on('failed', (e) => console.log(e.data?.code));
payrails.on('sessionExpired', async () => fetchNewInitResponse());
```
