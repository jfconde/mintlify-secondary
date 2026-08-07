# How to customize the checkout's appearance

This guide shows you how to style the pre-built card form, payment buttons,
drop-in, and individual collect elements with the `appearance` option, how to
change their labels and placeholders, and how to load custom fonts. It assumes
you have already initialized the SDK and hold a `payrails` client instance — see
the [setup guide](../getting-started.md) if you have not. Upgrading styling code
from SDK v5? The [migration guide](migration-v6.md#6-styles-becomes-appearance)
maps every v5 `styles` key to its v6 equivalent.

## 1. The base stylesheet

The pre-built components (drop-in, card form, buttons, card list) ship a base
stylesheet. It is injected automatically when the SDK loads — no manual import
is needed.

Everything below customizes on top of these base styles.

## 2. The `appearance` option

Every element the SDK draws accepts an `appearance` object. Its `rules` field is
CSS-like key/value: selectors on the outside, CSS declarations on the inside:

```js
const paymentButton = payrails.paymentButton({
  appearance: {
    rules: {
      '.payrails-button': { backgroundColor: '#1a1a1a', color: '#fff' },
      '.payrails-button:hover': { backgroundColor: '#333' },
      '.payrails-button--disabled': { opacity: '0.5' },
    },
  },
});
```

Selectors target stable class names the SDK guarantees on the DOM:
`.payrails-input`, `.payrails-button`, `.payrails-dropdown`, `.payrails-label`,
`.payrails-tile`, `.payrails-container`, `.payrails-row`, `.payrails-cell`,
`.payrails-icon`, `.payrails-checkbox`, `.payrails-error`, `.payrails-text`. The
complete per-element contract — which classes and state modifiers appear in each
element's DOM — is in the
[appearance reference](../reference/appearance-reference.md).

State variants use BEM modifiers on those classes:

| State                    | Class                                |
| ------------------------ | ------------------------------------ |
| Field with invalid input | `.payrails-input--invalid`           |
| Field with valid input   | `.payrails-input--valid`             |
| Field is empty           | `.payrails-input--empty`             |
| Field touched since load | `.payrails-input--dirty`             |
| Button in loading state  | `.payrails-button--loading`          |
| Button disabled          | `.payrails-button--disabled`         |
| Checkbox checked         | `.payrails-checkbox--checked`        |
| Brand tile selected      | `.payrails-tile--selected`           |
| Drop-in method expanded  | `.payrails-accordion-item--expanded` |

Any selector a browser supports is valid inside `rules` — pseudo-classes and
pseudo-elements (`:hover`, `:focus`, `:focus-visible`, `::placeholder`,
`::selection`), media queries (`@media`), and feature queries (`@supports`).

The `--invalid` and `--valid` classes clear while a field is focused, so a field
being corrected does not show the error state. For a persistent invalid look on
touched fields, key off `--dirty`:

```js
rules: {
  '.payrails-input--dirty:not(:focus).payrails-input--invalid': {
    borderColor: '#dc2626',
  },
}
```

Rules are scoped to the element instance that declares them — a rule passed to
one card form does not leak into another widget. SDK defaults live in the CSS
layer `@layer payrails-defaults`; your rules land in
`@layer payrails-appearance`, which always wins over the defaults. Your own
external stylesheets are unlayered and beat both.

## 3. Style the card form

`payrails.cardForm(options)` accepts a `CardFormAppearance` — root `rules` for
the form itself, one slot per field (`cardNumber`, `expiry`, `cvv`,
`holderName`), and one slot per nested widget (installments dropdown, address
selector, brand selector):

```js
const cardForm = payrails.cardForm({
  appearance: {
    rules: {
      '.payrails-container': { maxWidth: '480px', gap: '16px' },
      '.payrails-input': {
        border: '1px solid #eae8ee',
        borderRadius: '4px',
        color: '#1d1d1d',
      },
      '.payrails-input:focus': { borderColor: '#6b7cff' },
      '.payrails-input--invalid': {
        color: '#f44336',
        backgroundColor: '#fdeaea',
      },
      '.payrails-label': { fontSize: '12px', fontWeight: 'bold' },
      '.payrails-error': { color: '#f44336' },
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

cardForm.mount('#card-form');
```

The card payment button is a sibling of the card form, not a child — pass its
appearance to `payrails.paymentButton({ appearance })` directly, or to the
`cardPaymentButton` slot of the drop-in's appearance.

### Style a single field

Field slots use the same classnames as root `rules` but apply to one field only.
A field slot wins over a root rule for the same element. `expiry` covers the
expiry field in every layout — single date input or split month and year inputs.
For example, to hide the built-in icon on CVV and expiry while keeping the
card-network icon on the number field:

```js
const cardForm = payrails.cardForm({
  appearance: {
    cvv: {
      rules: { '.payrails-icon-group': { display: 'none' } },
    },
    expiry: {
      rules: { '.payrails-icon-group': { display: 'none' } },
    },
  },
});
```

On the `cardNumber` field, `.payrails-icon-group` also contains the co-branded
scheme logos — hiding it hides those too.

## 4. Style the drop-in

The drop-in's appearance is keyed by its building blocks; each slot takes the
same shape as the standalone element:

```js
const dropin = payrails.dropin({
  appearance: {
    rules: {
      '.payrails-container': { borderRadius: '12px' },
      // the payment-method rows (accordion)
      '.payrails-accordion-item': { borderRadius: '8px' },
      '.payrails-accordion-header': { padding: '14px 16px' },
      '.payrails-accordion-panel': { backgroundColor: '#fafafa' },
      '.payrails-accordion-item--expanded': { borderColor: '#4F46E5' },
    },
    cardForm: {
      rules: { '.payrails-input': { border: '1px solid #ddd' } },
    },
    cardPaymentButton: {
      rules: { '.payrails-button': { backgroundColor: '#4F46E5' } },
    },
    loadingScreen: { rules: {} },
    authSuccess: { rules: {} },
    authFailed: { rules: {} },
    // merchant-of-record blocks (only rendered in MoR mode)
    orderSummary: {
      rules: { '.payrails-row': { padding: '6px 0' } },
    },
    billingAddressForm: {
      rules: { '.payrails-input': { border: '1px solid #ddd' } },
    },
    termsAndConditions: {
      rules: { '.payrails-text': { fontSize: '12px' } },
    },
  },
});
```

## 5. Provider-drawn wallet buttons use `appearance.settings`

Google Pay, PayPal, Revolut Pay, and Lean draw their own chrome, so CSS `rules`
cannot reach them. They take structured `appearance.settings` instead:

```js
// Google Pay
const googlePayButton = payrails.googlePayButton({
  appearance: {
    settings: {
      buttonColor: 'black', // per Google Pay ButtonColor
      buttonType: 'buy', // per Google Pay ButtonType
      buttonSizeMode: 'fill',
      buttonRadius: 16, // corner radius in px (default 6)
      height: '48px', // fill mode only
      locale: 'de',
    },
  },
});

// PayPal
const paypalButton = payrails.paypalButton({
  appearance: {
    settings: {
      color: 'gold', // 'gold' | 'blue' | 'silver' | 'white' | 'black'
      shape: 'rect', // 'rect' | 'pill'
      label: 'paypal',
      height: 40,
      tagline: false,
      locale: 'de_DE',
    },
  },
});
```

Revolut Pay (`settings`: `{ theme, width, height, borderRadius }`) and Lean
(`settings`: the hosted-dialog theme) work the same way — see
[How to add PayPal and redirect-based payment methods](add-alternative-payment-methods.md).
In the drop-in, set each wallet's `settings` under its `DropinAppearance` slot
(`googlePayButton`, `applePayButton`, `paypalButton`, `revolutPayButton`,
`leanButton`).

Apple Pay's `settings` size the button box; its native type and style stay on
the separate `styles` option:

```js
const applePayButton = payrails.applePayButton({
  appearance: {
    settings: {
      width: '100%',
      height: '48px',
      borderRadius: '8px',
    },
  },
  styles: { type: 'buy', style: 'black' },
});
```

In the drop-in, set the box under the `applePayButton` slot and the native type
and style under `paymentMethodsConfiguration.applePay.styles`.

Wallet buttons are isolated from your global `.payrails-*` rules — the SDK
strips inherited styling off their subtrees and re-applies the provider's chrome
— so `settings` is the only way to influence them.

## 6. Change labels, placeholders, and error messages

Text on the card form is controlled through `translations`:

```js
const cardForm = payrails.cardForm({
  showStoreInstrumentCheckbox: true,
  translations: {
    placeholders: {
      CARD_NUMBER: '1234 1234 1234 1234',
      CVV: 'CVC',
    },
    labels: {
      CARD_NUMBER: 'Card number',
      CVV: 'Security code',
      storeInstrument: 'Save this card for next time',
    },
    error: {
      default: {
        CARD_NUMBER: 'Please check the card number',
      },
    },
  },
});
```

- `placeholders` and `labels` are keyed by field type (`CARD_NUMBER`,
  `CARDHOLDER_NAME`, `CVV`, `EXPIRATION_MONTH`, `EXPIRATION_YEAR`,
  `EXPIRATION_DATE`).
- `labels.storeInstrument` renames the save-card checkbox label.
- `error.default` sets the default validation error message per field type.

The payment button's label is `translations.label` on
`payrails.paymentButton(...)`.

## 7. Load custom fonts

The secure fields render inside iframes, so fonts from your page are not
automatically available there. Pass font descriptors via `fonts` — either a CSS
source or an explicit font-face definition:

```js
const cardForm = payrails.cardForm({
  fonts: [
    {
      family: 'Inter',
      src: "url('https://example.com/fonts/inter.woff2')",
      weight: 400,
      style: 'normal',
    },
  ],
  appearance: {
    rules: {
      '.payrails-input': { fontFamily: 'Inter, sans-serif' },
    },
  },
});
```

A font descriptor accepts `family`, `src`, `style`, `weight`, `unicodeRange`,
`display`, or a `cssSrc` URL. The same `fonts` option is accepted by
`payrails.collectContainer(...)`.

## 8. Style individual collect elements

When you build your own form with a collect container (see
[How to integrate secure fields](./integrate-secure-fields.md)), each element
accepts its own `appearance`; the rules are applied inside that field's secure
iframe:

```js
const cardNumber = container.createCollectElement({
  type: ElementType.CARD_NUMBER,
  appearance: {
    rules: {
      '.payrails-input': {
        border: '1px solid #eae8ee',
        padding: '10px 16px',
        borderRadius: '4px',
        color: '#1d1d1d',
      },
      '.payrails-input--valid': { color: '#4caf50' },
      '.payrails-input--invalid': { color: '#f44336' },
      '.payrails-label': { fontSize: '12px', fontWeight: 'bold' },
      '.payrails-error': { color: '#f44336' },
    },
  },
});
```

Only the root `rules` are forwarded to the iframe — secure fields have no nested
widget slots.

## 9. Update appearance and texts after mounting

The card form can be restyled and re-labeled at runtime without remounting:

```js
cardForm.update({
  appearance: {
    rules: { '.payrails-input': { borderColor: '#6b7cff' } },
  },
  translations: {
    labels: { CARD_NUMBER: 'Kartennummer' },
  },
});
```

Updates accumulate: a partial `appearance` merges over the current rules,
leaving other selectors, field slots (`cardNumber`, `expiry`, `cvv`,
`holderName`), and nested widget slots (`installments`, `address`,
`brandSelector`) intact. To clear a declaration, pass its key with an empty
value; clearing a whole selector requires a remount.

The card payment button supports `paymentButton.update({ translations })` for
its label — its appearance cannot be changed after mounting.

For the complete option types see the
[`payrails` reference](../reference/payrails-reference.md).
