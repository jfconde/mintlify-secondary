# Payrails class

Reference for the `Payrails` class and package exports. For task guides see
../how-to/.

The `Payrails` class is the entry point of `@payrails/web-sdk`. You never
construct it directly — call the static `Payrails.init()` with the SDK
configuration returned by your server, then use the resulting instance to create
UI elements, payment buttons, and to read data from the payment session.

```ts
import { Payrails } from '@payrails/web-sdk';

const payrails = await Payrails.init(initResponse);
```

The environment (`TEST` / `PRODUCTION`) and merchant identifier are sourced from
the server-provided SDK configuration inside `initResponse.data`. There is no
client-side override.

## Initialization

### `Payrails.init(initResponse, options?)` (static)

```ts
static init(initResponse: InitOptions, options?: PayrailsClientOptions): Promise<Payrails>
```

Creates the SDK instance from a server-side SDK configuration. `init` is
asynchronous: it loads the SDK bundle and stylesheet from the Payrails CDN
(`assets.payrails.io` — allow it in `script-src` and `style-src` if you set a
Content-Security-Policy) and resolves once the instance is ready. It requires a
DOM — call it in the browser, not during server-side rendering.

| Parameter      | Type                    | Description                                                                                                                                     |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `initResponse` | `InitOptions`           | The object returned by the Payrails client-init API: `{ version: string; data: string }`, where `data` is the Base64-encoded SDK configuration. |
| `options`      | `PayrailsClientOptions` | Optional client configuration (see below).                                                                                                      |

`PayrailsClientOptions`:

| Field            | Type                                                                              | Description                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`         | `{ onClientInitialized? }`                                                        | Init-only callback that fires during construction. `onSessionExpired` and every other event moved to `payrails.on(...)` — see [events.md](events-reference.md#init-time-callback-the-one-exception).                            |
| `redirectFor3DS` | `boolean`                                                                         | When `true`, 3DS challenges navigate the page instead of opening a popup.                                                                                                                                                       |
| `returnInfo`     | `ReturnInfo`                                                                      | Redirect return URLs: `{ success?, cancel?, error?, pending? }`. Used as the base for every redirect-capable element and the drop-in; a `returnInfo` set on a specific element or in the drop-in config overrides it per field. |
| `telemetry`      | `{ enabled?: boolean; logLevel?: 'debug' \| 'error'; collectMetadata?: boolean }` | SDK telemetry configuration.                                                                                                                                                                                                    |

Rejects with a `PayrailsError` (`PAYRAILS_INIT_FAILED`) when the configuration
string is invalid or when the SDK bundle cannot be loaded (blocked CDN, offline,
or a 15-second timeout).

### `update(updateOptions)`

```ts
update(updateOptions: LookupUpdateOptions): void
```

Updates the payment session on the client after initialization.

| Field               | Type                                 | Description                                                                                                                 |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `value`, `currency` | `string`                             | New amount. Both must be provided together for the amount to change.                                                        |
| `meta`              | `{ key: 'customer'; value: object }` | Merges execution metadata (customer name, email, phone, country, …).                                                        |
| `installmentConfig` | `object \| null`                     | Card-installment options per country and/or a `defaultInstallment` selection; propagated to a mounted card form or drop-in. |

### `setState({ instrument })`

```ts
setState(state: { instrument }): void
```

Sets the currently selected stored instrument in the SDK's shared state, e.g.
when your own UI (instead of `cardList`) lets the shopper pick a saved card.
`instrument` is a stored instrument object as returned by
`getStoredInstruments()`.

## UI elements

All elements returned by these methods expose `mount(selector: string)` and
`unmount()`.

### `dropin(options)`

```ts
dropin(options: DropinOptions): Dropin
```

Creates the all-in-one drop-in element that renders every available payment
method. `DropinOptions`:

| Field                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentMethodsConfiguration` | Per-method configuration (`cards`, `payPal`, `googlePay`, `applePay`, `lean`, `mercadoPago`, `revolutPay`, …) plus `preselectFirstPaymentOption` (default `true`) and `showPaymentMethodLogo`.                                                                                                                                                                                                                                                                              |
| `translations`                | Per-component label/text overrides, including `paymentResult` and `errorMessages`.                                                                                                                                                                                                                                                                                                                                                                                          |
| `appearance`                  | Per-component styling (`DropinAppearance`): root `rules` plus one slot per building block — `rules` for `cardForm` / `cardPaymentButton`, `settings` for the wallet slots `googlePayButton` / `applePayButton` / `paypalButton` / `revolutPayButton` / `leanButton`. Apple Pay's `applePayButton` settings size the button box; its native type and style come from `paymentMethodsConfiguration.applePay.styles`. See the [appearance reference](appearance-reference.md). |
| `fonts`                       | Custom font descriptors for the secure card fields.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `returnInfo`                  | Redirect return URLs for methods that leave the page.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `configuration`               | Extra behavior configuration (e.g. `authFailMsg`).                                                                                                                                                                                                                                                                                                                                                                                                                          |

Subscribe to drop-in events via `payrails.on(...)` (instance-level events like
`success`) and the drop-in's own `.on(...)` (element-level events like
`paymentOptionSelected`) — see [events.md](events-reference.md).

```ts
const dropin = payrails.dropin({});
dropin.mount('#dropin');
payrails.on('success', (event) => {
  console.log(event.paymentMethodCode);
});
dropin.on('paymentOptionSelected', (e) => console.log(e.paymentMethod));
```

### `cardForm(options?)`

```ts
cardForm(options?: CardFormOptions): CardForm
```

Creates (or returns the already-created) secure card entry form. One card form
exists per `Payrails` instance; a mounted `paymentButton` is wired to it
automatically. Key `CardFormOptions` fields: `showCardHolderName`,
`showSingleExpiryDateField`, `layout` (rows of `ElementType` field names),
`translations` (placeholders, labels, error texts), `appearance`
(`CardFormAppearance`), `fonts`, `installmentConfig`, and
`enrollInstrumentToNetworkOffers`. Subscribe to events (`change`, `ready`,
`focus`, `blur`, …) via `cardForm.on(...)` — see
[events.md](events-reference.md#element-events--elementonname-handler).

```ts
const cardForm = payrails.cardForm({ showCardHolderName: true });
cardForm.mount('#card-form');
cardForm.on('change', (e) => render(e.isValid));
cardForm.on('ready', () => show());
```

### `cardList(options?)`

```ts
cardList(options?: CardListOptions): CardList
```

Creates (or returns the already-created) list of the shopper's saved cards.
`options.onCardChange(selectedCard)` fires when the shopper selects a card;
selection also enables a mounted `paymentButton`. `options.appearance` styles
the list.

### `dynamicElement(options)`

```ts
dynamicElement(
  options: DynamicElementOptions & Required<Pick<DynamicElementOptions, 'paymentMethod'>>
): DynamicElementForm
```

Creates a schema-driven form for a payment method whose input fields are defined
by the session configuration. `options.paymentMethod` is required; the method
throws a `PayrailsError` when the session has no form schema for that payment
method. Other options: `appearance`, `translations`, `fieldOverrides`. Subscribe
to events via `element.on(...)` — see
[events.md](events-reference.md#element-events--elementonname-handler).

### `collectContainer(containerOptions)`

```ts
collectContainer(containerOptions: CollectContainerOptions): FramesContainer
```

Low-level access to the secure-fields container used by `cardForm`. Lets you
create and mount individual secure fields (`createCollectElement`), validate,
and collect encrypted card data yourself. `CollectContainerOptions`:
`containerId`, `fonts`. Each secure field styles itself via its own `appearance`
option on `createCollectElement`.

## Payment buttons

### `paymentButton(options)`

```ts
paymentButton(options: CardPaymentButtonOptions): CardPaymentButton
```

Creates (or returns the already-created) pay button for card payments. It
submits the card form or the instrument selected via `cardList`/`setState`.
Options: `translations.label`, `appearance`, `redirectFor3DS`, `returnInfo`
(overrides the client-level return URLs per field), and `disabledByDefault`
(default `true`; the button enables once the card form is valid or a saved card
is selected). Subscribe to payment outcomes via `payrails.on(...)` and to
button-specific events (`stateChanged`, `validate`) via the returned button's
`.on(...)` — see [events.md](events-reference.md).

### `googlePayButton(options)`

```ts
googlePayButton(options: GooglePayButtonOptions): GooglePayButton
```

Creates a Google Pay button. Options: `merchantName` (overrides the display name
from the backend config; the merchant ID is always taken from the backend),
`redirectFor3DS`, `appearance.settings` (`buttonColor`, `buttonType`,
`buttonSizeMode`, `buttonRadius`, `height`, `locale`; the legacy `styles` option
is deprecated — it still accepts the enum fields but not
`buttonRadius`/`height`, and `appearance.settings` wins), `returnInfo`, and
store-instrument checkbox options. The environment is inherited from
`Payrails.init(...)`. Read `await button.isAvailable` (a `Promise<boolean>`) for
wallet availability and subscribe to `payrails.on(...)` for payment outcomes.

### `isGooglePayAvailable(merchantName?)`

```ts
isGooglePayAvailable(merchantName?: string): Promise<boolean>
```

Resolves `true` when the shopper's browser/device can pay with Google Pay for
the current session configuration. Pass `merchantName` to override the display
name that Google Pay resolves during the availability check.

### `applePayButton(options)`

```ts
applePayButton(options: ApplePayButtonOptions): ApplePayButton
```

Creates an Apple Pay button. Options: `abortAfterAuthorizeFailed`,
`translations`, `appearance` (`settings`: `width`, `height`, `borderRadius`,
`padding`, `boxSizing` — the button box), `styles` (`type`, e.g.
`'buy'`/`'checkout'`; `style`, e.g. `'black'`; `locale`), and store-instrument
checkbox options. Apple Pay's `settings` size the button box; `styles` controls
the native button type and style. Read `await button.isAvailable` (a
`Promise<boolean>`) for wallet availability, subscribe to
`payrails.on('deliveryAddressChanged', …)` for the express-checkout address
sheet, and to `payrails.on(...)` for payment outcomes.

### `isApplePayAvailable()`

```ts
isApplePayAvailable(): Promise<boolean>
```

Resolves `true` when the browser supports Apple Pay (`ApplePaySession`) and the
Apple Pay SDK loads; `false` otherwise (never rejects).

### `paypalButton(options?)`

```ts
paypalButton(options?: PaypalButtonOptions): PaypalButton
```

Creates a PayPal button. Options: `appearance.settings` (`color`, `height`,
`label`, `shape`, `tagline`, `locale`), and store-instrument checkbox options.
Read `await button.isAvailable` (a `Promise<boolean>`) for wallet availability,
subscribe to `payrails.on('deliveryAddressChanged', …)` for express-checkout
address changes (PayPal payload shape), and to `payrails.on(...)` for payment
outcomes. In PayPal express mode the store-instrument checkbox is forced off.

### `leanButton(options)`

```ts
leanButton(options: LeanButtonOptions): LeanButton
```

Creates a Lean (pay-by-bank) button. Options: `id`, `translations.label`,
`appearance.settings` (a `LeanCustomization` themeing the Lean-hosted dialog;
Lean takes no `rules`), and `returnInfo`. Subscribe to payment outcomes via
`payrails.on(...)`.

### `genericRedirectButton(options)`

```ts
genericRedirectButton(options: GenericRedirectButtonOptions): GenericRedirectButton
```

Creates a button for any redirect-based payment method. `options.paymentMethod`
(the payment method configuration, required) selects the method; other options:
`translations.label`, `appearance` (`rules` for a Payrails-rendered redirect
button; for Revolut Pay, `appearance.settings` — the `RevolutPayStyles` shape —
instead), `openInNewTab`, and `returnInfo`. Subscribe to payment outcomes via
`payrails.on(...)`; the redirect itself can be intercepted via the
`actionRequired` event (see
[events.md](events-reference.md#actionrequired-cancelable)).

## Stored instruments and payment methods

Stored instruments are plain objects with `id`, `status`, `paymentMethod`,
`displayName?`, `data?` (e.g. `bin`, `suffix`, `network` for cards, `email` for
PayPal), and `default?`.

### `getSavedCreditCards()`

Returns the shopper's stored card instruments.

### `getSavedGooglePayAccounts()`

Returns the shopper's stored Google Pay instruments with status `enabled`.

### `getSavedApplePayAccounts()`

Returns the shopper's stored Apple Pay instruments.

### `getSavedPaypalAccounts()`

Returns the shopper's stored PayPal instruments with status `enabled`, or `[]`.

### `getStoredInstruments()`

Returns stored instruments across all payment methods. Google Pay and PayPal
instruments are included only when their status is `enabled`.

### `getStoredInstrumentsByPaymentMethod(paymentMethod)`

```ts
getStoredInstrumentsByPaymentMethod(paymentMethod: string): object[]
```

Returns the result of `getStoredInstruments()` filtered to one payment method
code (a `PAYMENT_METHOD_CODES` value such as `'card'` or `'payPal'`).

### `getAvailablePaymentMethods()`

```ts
getAvailablePaymentMethods(): string[]
```

Returns the payment method codes available in the current session (values of
`PAYMENT_METHOD_CODES`).

## Data and API

### `api(config)`

```ts
api(config: {
  operation: 'deleteInstrument' | 'updateInstrument' | 'payout';
  resourceId?: string;
  body?: object;
}): Promise<object>
```

Calls a Payrails API operation authorized by the current session.

| Operation          | `resourceId`             | `body`                      | Resolves with          |
| ------------------ | ------------------------ | --------------------------- | ---------------------- |
| `deleteInstrument` | instrument id (required) | —                           | `{ success: boolean }` |
| `updateInstrument` | instrument id (required) | instrument fields to update | the updated instrument |
| `payout`           | —                        | payout request              | the payout response    |

```ts
await payrails.api({
  operation: 'deleteInstrument',
  resourceId: instrument.id,
});
```

### `query(key, params?)`

```ts
query(key, params?: Record<string, any>)
```

Reads a value from the session configuration; returns `null` when the value or
key is unknown. Supported keys: `holderReference`, `amount`, `executionId`,
`binLookup`, `instrumentDelete`, `instrumentUpdate` (API links),
`paymentMethodConfig` and `paymentMethodInstruments` (both require
`params.paymentMethodCode`; `paymentMethodConfig` also accepts `'all'` or
`'redirect'` to return arrays).

### `binLookup()`

```ts
binLookup(): Promise<object | null | undefined>
```

Looks up the BIN currently entered in the mounted drop-in, card form, or collect
container. Resolves with the lookup data — `bin`, `network`, and when available
`localNetwork` (co-branded cards), `issuer`, `issuerCountry`, `type`. Logs a
warning and resolves `undefined` when no container exists, and resolves `null`
when BIN lookup is not enabled for the session.

## Instance events

### `on(name, handler)`

```ts
on<K extends PayrailsEventName>(name: K, handler: PayrailsEventHandler<K>): () => void
```

Subscribes to an SDK-level event (`success`, `failed`, `pending`,
`buttonClicked`, `requestStart`, `actionRequired`, `sessionExpired`,
`deliveryAddressChanged`) and returns an unsubscribe function. See
[events.md](events-reference.md#instance-events--payrailsonname-handler).

### `off(name, handler)`

```ts
off<K extends PayrailsEventName>(name: K, handler: PayrailsEventHandler<K>): void
```

Removes a handler previously registered with `on`.

## Other package exports

Values and enums:

| Export                                                   | Description                                                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PayrailsEnvironment`                                    | `TEST \| PRODUCTION` — the environment resolved from `initResponse.data`. Read-only enum.                                                                  |
| `PAYMENT_METHOD_CODES`                                   | Enum of payment method codes (`card`, `googlePay`, `payPal`, `applePay`, `pix`, `revolutPay`, …).                                                          |
| `ElementType`                                            | Secure-field types for card form layouts (`CARD_NUMBER`, `CARDHOLDER_NAME`, `CVV`, `EXPIRATION_MONTH`, `EXPIRATION_YEAR`, `EXPIRATION_DATE`, `CARD_FORM`). |
| `ACTION_REQUIRED_KIND`                                   | Kinds of `actionRequired` events: `GENERIC_REDIRECT` (`'genericRedirect'`), `THREE_DS` (`'3ds'`).                                                          |
| `AuthorizationFailureReasons`                            | Failure codes on the `failed` event payload: `VALIDATION_FAILED`, `AUTHORIZATION_ERROR`, `AUTHENTICATION_ERROR`, `UNKNOWN_ERROR`, `USER_CANCELLED`.        |
| `INTEGRATION_TYPE`                                       | Payment method integration types: `API` (`'api'`), `HPP` (`'hpp'`).                                                                                        |
| `REVOLUT_PAY_DEFAULT_LABEL`, `REVOLUT_PAY_DEFAULT_THEME` | Default label (`'Pay with Revolut Pay'`) and theme (`'lightOutline'`) for the Revolut Pay button.                                                          |

Types:

| Export                                                                                                                                       | Description                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `InitOptions`                                                                                                                                | Argument of `Payrails.init`: `{ version: string; data: string }`.                                     |
| `PayrailsClientOptions`                                                                                                                      | Options argument of `Payrails.init`.                                                                  |
| `PayrailsAmount`                                                                                                                             | `{ value: string; currency: string; subTotal?: string }`.                                             |
| `DropinOptions`, `CardFormOptions`, `CardListOptions`, `CardPaymentButtonOptions`                                                            | Option objects for the corresponding element factories.                                               |
| `GooglePayButtonOptions`, `ApplePayButtonOptions`, `PaypalButtonOptions`, `LeanButtonOptions`, `GenericRedirectButtonOptions`                | Option objects for the payment buttons.                                                               |
| `Appearance`, `AppearanceRules`, `AppearanceDeclarations`, `CardFormAppearance`, `DropinAppearance`                                          | The `appearance` option shapes — see the [appearance reference](appearance-reference.md).             |
| `GooglePaySettings`, `PaypalSettings`, `GooglePayButtonAppearance`, `PaypalButtonAppearance`, `RevolutPayAppearance`, `LeanButtonAppearance` | Wallet-button `appearance.settings` shapes — see the [appearance reference](appearance-reference.md). |
| `RevolutPayStyles`, `RevolutPayButtonTheme`, `LeanCustomization`                                                                             | Settings shapes for the Revolut Pay button (`appearance.settings`) and the Lean dialog.               |
| `CollectContainerOptions`, `PayrailsSecureField`, `PayrailsSecureFieldEvent`                                                                 | Secure-fields container and field types.                                                              |
| `FramesContainer`                                                                                                                            | The container returned by `collectContainer()`.                                                       |
| `PayrailsEvents`, `PayrailsEventName`, `PayrailsEventHandler`, `ActionRequiredEvent`, `ActionRequiredKind`, `PaymentAttemptContext`          | Event types — see [events.md](events-reference.md).                                                   |
| `ReturnInfo`                                                                                                                                 | Redirect return URLs: `{ success?, cancel?, error?, pending? }`.                                      |
| `SaveInstrumentResponse`                                                                                                                     | Response of the save-instrument API for cards.                                                        |
| `CardScheme`                                                                                                                                 | Card scheme entry emitted by the `preferredSchemeChanged` / `change` events.                          |
| `ExecutionMeta`, `ExecutionMetaCustomer`, `ExecutionMetaKey`                                                                                 | Execution metadata shapes used by `update({ meta })`.                                                 |
| `StorablePaymentCompositionOption`, `WorkflowExecutionResponse`                                                                              | Payment method configuration and execution response shapes.                                           |
