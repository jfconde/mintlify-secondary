# Appearance

Reference for the `appearance` option of `@payrails/web-sdk`: the option types,
rule semantics, and the class-name contract — which CSS classes and state
modifiers the SDK guarantees on the DOM. For a task-oriented guide see
[How to customize the checkout's appearance](../how-to/customize-appearance.md);
for upgrading v5 `styles` code see the
[migration guide](../how-to/migration-v6.md#6-styles-becomes-appearance).

```js
payrails.cardForm({
  appearance: {
    rules: {
      '.payrails-input': { border: '1px solid #eae8ee' },
      '.payrails-input--invalid': { borderColor: '#dc2626' },
      '@media (max-width: 480px)': {
        '.payrails-container': { gap: '8px' },
      },
    },
  },
});
```

## Two ways to style: `rules` and `settings`

An `appearance` object has two fields, and a given element accepts one or the
other:

- **`rules`** — CSS you author, applied to DOM the SDK renders (the card form,
  the drop-in, the pay button, redirect buttons). This is the class-name
  contract documented below.
- **`settings`** — structured, non-CSS options handed to a renderer the SDK does
  not control: a provider's native button SDK (Google Pay, PayPal), a hosted
  iframe modal (Lean), or brand-locked inline chrome (Revolut Pay). CSS cannot
  reach these surfaces, so they expose a fixed set of knobs instead.

Wallet buttons are `settings`-only; every other element is `rules`-only. Apple
Pay's native button is also `settings`-only — its `settings` set the button box
(size, radius, padding), while its native type and style stay on the separate
`styles` option. See [wallet buttons](#wallet-buttons-settings) below.

## Types

All types are exported from `@payrails/web-sdk`.

### `Appearance`

```ts
interface Appearance<TSettings = never> {
  rules?: AppearanceRules;
  settings?: TSettings;
}
```

The base shape. `TSettings` defaults to `never`, so a plain `Appearance` is
rules-only and TypeScript rejects `settings` where it has no meaning.

### `AppearanceRules`

```ts
interface AppearanceRules {
  [selectorOrAtRule: string]: AppearanceDeclarations | AppearanceRules;
}

type AppearanceDeclarations = Record<string, string | number>;
```

Keys are CSS selectors or at-rules; values are declaration maps. Under an
at-rule key (`@media …`, `@supports …`) the value is a nested `AppearanceRules`
map.

### `CardFormAppearance`

```ts
interface CardFormAppearance extends Appearance {
  installments?: Appearance;
  address?: Appearance;
  brandSelector?: Appearance;
  cardNumber?: Appearance;
  expiry?: Appearance;
  cvv?: Appearance;
  holderName?: Appearance;
}
```

The card form's nested widgets each take their own `Appearance` under a named
key. The field slots (`cardNumber`, `expiry`, `cvv`, `holderName`) style one
field inside the form using the same classnames as root `rules`; a field slot
wins over a root rule for the same element. `expiry` applies to the expiry field
in both layouts — single date input or split month/year inputs. The card payment
button is a sibling of the card form, not a child — it has no slot here.

### Wallet settings types

Each wallet button takes a settings-only appearance — a `Pick` that keeps
`settings` and drops `rules`:

```ts
type GooglePayButtonAppearance = { settings?: GooglePaySettings };
type ApplePayButtonAppearance = { settings?: ApplePaySettings };
type PaypalButtonAppearance = { settings?: PaypalSettings };
type RevolutPayAppearance = { settings?: RevolutPayStyles };
type LeanButtonAppearance = { settings?: LeanCustomization };

interface GooglePaySettings {
  buttonColor?: ButtonColor; // Google Pay ButtonColor enum
  buttonType?: ButtonType; // Google Pay ButtonType enum
  buttonSizeMode?: ButtonSizeMode; // Google Pay ButtonSizeMode enum
  buttonRadius?: number; // corner radius in px (Google Pay buttonRadius)
  height?: string; // button height with CSS units, e.g. '48px' (fill mode only)
  locale?: string;
}

interface ApplePaySettings {
  width?: string;
  height?: string;
  borderRadius?: string;
  padding?: string;
  boxSizing?: string;
}

interface PaypalSettings {
  color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
  height?: number;
  label?:
    | 'paypal'
    | 'checkout'
    | 'buynow'
    | 'pay'
    | 'installment'
    | 'subscribe'
    | 'donate';
  shape?: 'rect' | 'pill';
  tagline?: boolean;
  locale?: string;
}
```

`RevolutPayStyles` (`{ theme, width, height, borderRadius }`) and
`LeanCustomization`
(`{ themeColor, buttonTextColor, buttonBorderRadius, linkColor, overlayColor }`)
are their own exported types.

### `DropinAppearance`

```ts
interface DropinAppearance extends Appearance {
  cardForm?: CardFormAppearance;
  cardPaymentButton?: Appearance;
  googlePayButton?: GooglePayButtonAppearance;
  applePayButton?: ApplePayButtonAppearance;
  paypalButton?: PaypalButtonAppearance;
  revolutPayButton?: RevolutPayAppearance;
  leanButton?: LeanButtonAppearance;
  orderSummary?: Appearance;
  billingAddressForm?: Appearance;
  termsAndConditions?: Appearance;
  loadingScreen?: Appearance;
  authSuccess?: Appearance;
  authFailed?: Appearance;
}
```

Root `rules` apply across the drop-in; each building block above takes its own
appearance under a matching key — `rules` for the card form and buttons the SDK
draws, `settings` for the wallet buttons. The `applePayButton` slot takes an
`ApplePayButtonAppearance` (`settings` only) that sizes the button box; the
native button type and style still come from
`paymentMethodsConfiguration.applePay.styles` (see the
[`payrails` reference](payrails-reference.md)).

`orderSummary`, `billingAddressForm`, and `termsAndConditions` style the
merchant-of-record blocks (order summary, billing form, and terms text) the
drop-in renders when MoR is enabled. The exported interface also declares
`mercadoPago` plus an open index signature — these are reserved: accepted by the
compiler but with no effect in this release.

### Where each shape is accepted

| Factory                          | Option       | Shape                                | Styles via                                           |
| -------------------------------- | ------------ | ------------------------------------ | ---------------------------------------------------- |
| `payrails.cardForm`              | `appearance` | `CardFormAppearance`                 | `rules`                                              |
| `payrails.dropin`                | `appearance` | `DropinAppearance`                   | `rules`                                              |
| `payrails.paymentButton`         | `appearance` | `Appearance`                         | `rules`                                              |
| `payrails.cardList`              | `appearance` | `Appearance`                         | `rules`                                              |
| `payrails.dynamicElement`        | `appearance` | `Appearance`                         | `rules`                                              |
| `container.createCollectElement` | `appearance` | `Appearance`                         | `rules`                                              |
| `payrails.genericRedirectButton` | `appearance` | `Appearance \| RevolutPayAppearance` | `rules` (redirect methods), `settings` (Revolut Pay) |
| `payrails.googlePayButton`       | `appearance` | `GooglePayButtonAppearance`          | `settings`                                           |
| `payrails.paypalButton`          | `appearance` | `PaypalButtonAppearance`             | `settings`                                           |
| `payrails.leanButton`            | `appearance` | `LeanButtonAppearance`               | `settings`                                           |
| `payrails.applePayButton`        | `appearance` | `ApplePayButtonAppearance`           | `settings` (button box) + `styles` (native button)   |

## Rule semantics

**Selectors.** Any selector the browser supports is valid: class selectors,
state modifiers, comma lists, descendant combinators, pseudo-classes (`:hover`,
`:focus`, `:focus-visible`, `:disabled`, `:autofill`), pseudo-elements
(`::placeholder`, `::selection`), and nested `@media` / `@supports` at-rules.

**Properties.** Any CSS property is valid. Write property names in camelCase
(`boxShadow`) or kebab-case (`box-shadow`) — camelCase is converted on emission.
Custom properties (`--my-var`) pass through unchanged. Values are strings or
numbers.

**No validation.** The SDK emits your rules verbatim as CSS and does not
currently validate selectors or declarations; anything the browser cannot parse
is silently ignored by the browser, not reported by the SDK.

**Scoping.** Each element's rules apply only within that element's own DOM
subtree, including its root node. A rule passed to one card form does not affect
another card form or any other widget. Write selectors flat (`.payrails-input`,
not a descendant-of-the-widget path) — the SDK scopes them for you.

**Wallet isolation.** The wallet buttons (Google Pay, Apple Pay, PayPal, Revolut
Pay, Lean) do not respond to your CSS rules — a global `.payrails-button` rule
of yours does not reach them. Style Google Pay, PayPal, Revolut Pay, Lean, and
Apple Pay through their `settings`; Apple Pay's native button type and style
come from its `styles` option in addition.

**Cascade.** SDK default styles live in the CSS layer `payrails-defaults`; your
rules are emitted into the layer `payrails-appearance`, which is declared after
it — your rules always beat the SDK defaults regardless of selector specificity.
Rules in your own external stylesheets are unlayered and beat both. In browsers
without CSS layer support (Safari before 15.4), the SDK's default styles are not
applied; your rules still are.

**Composition.** When a container and one of its children both style the same
node, the child's rules win; the container's rules fill in whatever the child
did not set.

**Secure fields.** Card data inputs render inside Payrails-hosted iframes. The
root `rules` of a card form or collect element are forwarded into the iframe and
applied there in addition to the host page; nested child keys (`installments`,
`address`, `brandSelector`) apply outside the iframe only.

## The class-name contract

The SDK stamps two kinds of class names:

- **Generic classes** (`.payrails-input`, `.payrails-button`, …) mark the UI
  primitives and are listed below. They are the public styling surface, stable
  within a major version.
- **Widget-specific classes** (for example `.payrails-card-form`) are internal.
  They can change in any release and are not part of this contract.

### Generic classes

| Class                 | Marks                                                   |
| --------------------- | ------------------------------------------------------- |
| `.payrails-container` | The root wrapper of a widget (form, list, screen).      |
| `.payrails-row`       | A horizontal group (form row, summary line, tile row).  |
| `.payrails-cell`      | One slot inside a row.                                  |
| `.payrails-field`     | A labeled input group (label + input + error).          |
| `.payrails-input`     | A text input, including the secure card fields.         |
| `.payrails-dropdown`  | A select input.                                         |
| `.payrails-label`     | A text label.                                           |
| `.payrails-text`      | Body text (amounts, terms, subtitles).                  |
| `.payrails-error`     | A validation error message.                             |
| `.payrails-button`    | A pay button drawn by the SDK.                          |
| `.payrails-checkbox`  | The save-instrument checkbox.                           |
| `.payrails-tile`      | A selectable tile (card brand, saved card, tab option). |
| `.payrails-icon`      | An icon or logo image.                                  |

### State modifiers

State is expressed as BEM modifiers on the generic classes:

| Modifier                      | Applies when                              |
| ----------------------------- | ----------------------------------------- |
| `.payrails-input--invalid`    | The input holds invalid input.            |
| `.payrails-input--valid`      | The input holds valid input.              |
| `.payrails-input--empty`      | The input is empty.                       |
| `.payrails-input--dirty`      | The input has been edited at least once.  |
| `.payrails-field--focused`    | A field inside a secure iframe has focus. |
| `.payrails-field--invalid`    | The field's input is invalid.             |
| `.payrails-dropdown--invalid` | The select holds an invalid selection.    |
| `.payrails-button--loading`   | A payment is in flight.                   |
| `.payrails-button--disabled`  | The button is disabled.                   |
| `.payrails-checkbox--checked` | The checkbox is checked.                  |
| `.payrails-tile--selected`    | The tile is selected.                     |

On secure card fields, `--invalid` and `--valid` are removed while the field has
focus, so a shopper correcting a value does not see the error state; they are
re-evaluated on blur. A selector like `.payrails-input--invalid:focus` therefore
never matches a secure field. For a persistent invalid look on touched fields,
combine with `--dirty`:

```js
rules: {
  '.payrails-input--dirty:not(:focus).payrails-input--invalid': {
    borderColor: '#dc2626',
  },
}
```

`--empty` and `--dirty` exist on secure card fields only. Inputs in
schema-driven forms (`dynamicElement`, the billing address form) keep
`--invalid` / `--valid` while focused.

## Per-element contract

The tables below list which generic classes and modifiers appear in each
element's DOM. Native pseudo-classes apply everywhere they are valid.

### Card form — `cardForm({ appearance })`

| Part                | Classes                                 | Modifiers                                    |
| ------------------- | --------------------------------------- | -------------------------------------------- |
| Form root           | `.payrails-container`                   | —                                            |
| Field row / cell    | `.payrails-row` / `.payrails-cell`      | —                                            |
| Field group         | `.payrails-field`                       | `--focused`, `--invalid`                     |
| Card input          | `.payrails-input`                       | `--invalid`, `--valid`, `--empty`, `--dirty` |
| Field label         | `.payrails-label`                       | —                                            |
| Card-brand icon     | `.payrails-icon`                        | —                                            |
| Error text          | `.payrails-error`                       | —                                            |
| Save-instrument row | `.payrails-cell` / `.payrails-checkbox` | `--checked` (on the checkbox)                |

Nested widget slots on `CardFormAppearance`:

| Slot            | Part                    | Classes                                                                      | Modifiers    |
| --------------- | ----------------------- | ---------------------------------------------------------------------------- | ------------ |
| `installments`  | Dropdown                | `.payrails-cell`, `.payrails-dropdown`                                       | —            |
| `address`       | Country / postal fields | `.payrails-cell`, `.payrails-label`, `.payrails-dropdown`, `.payrails-input` | `--invalid`  |
| `brandSelector` | Title / subtitle        | `.payrails-label` / `.payrails-text`                                         | —            |
|                 | Tile row                | `.payrails-row`                                                              | —            |
|                 | Brand tile              | `.payrails-tile` (logo `.payrails-icon`, name `.payrails-label`)             | `--selected` |

### Collect element (secure field) — `createCollectElement({ appearance })`

Rules apply inside the field's iframe.

| Part        | Classes           | Modifiers                                    |
| ----------- | ----------------- | -------------------------------------------- |
| Field group | `.payrails-field` | `--focused`, `--invalid`                     |
| Input       | `.payrails-input` | `--invalid`, `--valid`, `--empty`, `--dirty` |
| Label       | `.payrails-label` | —                                            |
| Icon        | `.payrails-icon`  | —                                            |
| Error text  | `.payrails-error` | —                                            |

### Card payment button — `paymentButton({ appearance })`

| Part   | Classes            | Modifiers                 |
| ------ | ------------------ | ------------------------- |
| Button | `.payrails-button` | `--loading`, `--disabled` |

### Generic redirect button — `genericRedirectButton({ appearance })`

Style redirect methods (pix, iDEAL, and other Payrails-rendered redirect
buttons) with `appearance.rules`:

| Part   | Classes                                        | Modifiers                 |
| ------ | ---------------------------------------------- | ------------------------- |
| Button | `.payrails-generic-button`, `.payrails-button` | `--loading`, `--disabled` |

Revolut Pay is the exception: it renders Revolut's own brand-locked artwork and
takes `appearance.settings` (a `RevolutPayStyles`), not `rules`. See
[wallet buttons](#wallet-buttons-settings).

### Wallet buttons (`settings`)

Google Pay, Apple Pay, PayPal, Revolut Pay, and Lean draw their own chrome, so
they have no targetable class contract. Configure them through
`appearance.settings`:

| Factory                                                     | `settings` type     |
| ----------------------------------------------------------- | ------------------- |
| `googlePayButton`                                           | `GooglePaySettings` |
| `applePayButton`                                            | `ApplePaySettings`  |
| `paypalButton`                                              | `PaypalSettings`    |
| `genericRedirectButton` (`paymentMethodCode: 'revolutPay'`) | `RevolutPayStyles`  |
| `leanButton`                                                | `LeanCustomization` |

Apple Pay's `settings` (`ApplePaySettings`) size the button box — `width`,
`height`, `borderRadius`, `padding`, `boxSizing`. Its native button type, style,
and locale stay on the separate `styles` option, on the standalone
`applePayButton({ styles })` or, in the drop-in,
`paymentMethodsConfiguration.applePay.styles`.

### Card list — `cardList({ appearance })`

| Part       | Classes               | Modifiers |
| ---------- | --------------------- | --------- |
| List root  | `.payrails-container` | —         |
| Card entry | `.payrails-tile`      | —         |
| Card label | `.payrails-label`     | —         |
| Brand icon | `.payrails-icon`      | —         |

### Dynamic form — `dynamicElement({ appearance })`

Also the shape of the drop-in's billing address form.

| Part        | Classes               | Modifiers              |
| ----------- | --------------------- | ---------------------- |
| Form root   | `.payrails-container` | —                      |
| Field group | `.payrails-field`     | `--invalid`            |
| Input       | `.payrails-input`     | `--invalid`, `--valid` |
| Select      | `.payrails-dropdown`  | `--invalid`            |
| Label       | `.payrails-label`     | —                      |
| Error text  | `.payrails-error`     | —                      |
| Tab row     | `.payrails-row`       | —                      |
| Tab option  | `.payrails-tile`      | `--selected`           |

### Drop-in — `dropin({ appearance })`

The drop-in lists its payment methods as an accordion; selecting a method
expands its content below the header. Style the rows with root `rules`:

| Part                  | Classes                      | Modifiers    |
| --------------------- | ---------------------------- | ------------ |
| Method item           | `.payrails-accordion-item`   | `--expanded` |
| Item header (trigger) | `.payrails-accordion-header` | —            |
| Item panel (body)     | `.payrails-accordion-panel`  | —            |
| Method logo           | `.payrails-icon`             | —            |
| Method name           | `.payrails-label`            | —            |

Root `rules` apply across the drop-in's blocks — for example `.payrails-button`
under root `rules` reaches every pay button the drop-in renders, and
`.payrails-container` reaches each block's wrapper. Each slot scopes its rules
to that block:

| Slot                 | Styles via | Content                                                                                                                    |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `cardForm`           | `rules`    | Full `CardFormAppearance` shape (see card form above).                                                                     |
| `cardPaymentButton`  | `rules`    | `.payrails-button` with `--loading` / `--disabled`.                                                                        |
| `googlePayButton`    | `settings` | `GooglePaySettings`.                                                                                                       |
| `applePayButton`     | `settings` | `ApplePaySettings` (button box; native type/style via `paymentMethodsConfiguration.applePay.styles`).                      |
| `paypalButton`       | `settings` | `PaypalSettings`.                                                                                                          |
| `revolutPayButton`   | `settings` | `RevolutPayStyles`.                                                                                                        |
| `leanButton`         | `settings` | `LeanCustomization`.                                                                                                       |
| `loadingScreen`      | `rules`    | `.payrails-container` with a `.payrails-icon` spinner.                                                                     |
| `authSuccess`        | `rules`    | `.payrails-container` with `.payrails-icon` and `.payrails-label`.                                                         |
| `authFailed`         | `rules`    | `.payrails-container` with `.payrails-icon` and `.payrails-label`.                                                         |
| `orderSummary`       | `rules`    | `.payrails-container` wrapper; `.payrails-row` lines with `.payrails-label`/`.payrails-text`; header on `.payrails-label`. |
| `billingAddressForm` | `rules`    | Full dynamic-form shape (see [dynamic form](#dynamic-form--dynamicelement-appearance)).                                    |
| `termsAndConditions` | `rules`    | `.payrails-text` block.                                                                                                    |

`authSuccess` also styles the payment-pending screen, which reuses the success
screen's markup. The `applePayButton` slot's `settings` size the button box; its
native type and style come from `paymentMethodsConfiguration.applePay.styles`.
The `orderSummary`, `billingAddressForm`, and `termsAndConditions` slots take
effect only when the drop-in is in merchant-of-record mode. The `mercadoPago`
key is reserved and currently has no effect.
