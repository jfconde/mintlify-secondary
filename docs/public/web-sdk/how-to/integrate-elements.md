# How to integrate Elements

**The problem.** Your checkout has a specific layout and design system — the
card fields sit in one column, the pay button lives in your own sticky footer,
and the drop-in's all-in-one panel doesn't fit. You still want Payrails to
handle PCI-compliant card capture, encryption, and 3D Secure; you just want to
own the page around it.

**The solution.** Elements give you the drop-in's building blocks as separate,
individually mountable components. This guide wires up the two you need for a
card checkout: a **card form** and a **payment button**. They are created from
the same `payrails` client, which wires them together for you — the button stays
disabled until the form is valid, and clicking it validates the form, encrypts
the card data, and starts the authorization.

This guide assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.

## 1. Add containers to your page

Place the containers wherever your layout needs them — they do not have to be
adjacent.

```html
<div id="card-form"></div>
<div id="pay-button"></div>
```

## 2. Mount the card form

```js
const cardForm = payrails.cardForm({
  showCardHolderName: true,
});

cardForm.on('ready', () => console.log('Card form rendered'));
cardForm.on('change', ({ isValid, cardNetwork }) => {
  console.log('Form valid:', isValid, 'network:', cardNetwork);
});

cardForm.mount('#card-form');
```

By default the form renders a card number field, separate expiry month and
expiry year fields, and a CVV field. The most commonly used `CardFormOptions`:

| Option                        | Effect                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `showCardHolderName`          | Adds a cardholder name field (off by default).                                                                                                   |
| `showSingleExpiryDateField`   | Replaces the separate month/year fields with a single `MM/YY` field.                                                                             |
| `showStoreInstrumentCheckbox` | Renders a "save this card" checkbox; its state is sent as `storeInstrument` with the payment.                                                    |
| `alwaysStoreInstrument`       | Always stores the card, even when the checkbox is hidden or left unchecked. Use it when you already have the shopper's consent to save the card. |
| `translations`                | Per-field `placeholders` and `labels`, plus default error messages.                                                                              |
| `appearance`                  | CSS rules keyed by the SDK's stable class names — see [customize the appearance](customize-appearance.md).                                       |
| `layout`                      | Custom field arrangement as rows of field names, e.g. `[['CARD_NUMBER'], ['EXPIRATION_DATE', 'CVV']]`.                                           |
| `fonts`                       | Custom font descriptors for the secure fields.                                                                                                   |

For the full option and event list see the
[`payrails` reference](../reference/payrails-reference.md) and the
[events reference](../reference/events-reference.md).

## 3. Mount the payment button

```js
const paymentButton = payrails.paymentButton({
  translations: { label: 'Pay now' },
  appearance: {
    rules: {
      '.payrails-button': { backgroundColor: '#1a1a1a', color: '#ffffff' },
      '.payrails-button--disabled': { opacity: '0.5' },
    },
  },
});

paymentButton.mount('#pay-button');
```

The button starts disabled and enables automatically once the card form is
valid. Pass `disabledByDefault: false` if you want it clickable immediately (the
form is still validated on click). While the payment is in flight the button
shows a loading indicator and carries the `.payrails-button--loading` class.

## 4. Handle the payment result

Payment outcomes are instance events — subscribe on the `payrails` client:

```js
payrails.on('success', () => {
  // payment authorized — show your confirmation page
});
payrails.on('failed', (e) => {
  // e.data: { code?: string, message?: string }
  console.error(`Payment failed (${e.data?.code}): ${e.data?.message}`);
});
payrails.on('pending', () => {
  // authorization accepted but not final yet — show a pending state
});
```

- `success` — the payment was authorized.
- `failed` — the payment failed. `e.data?.code` is one of the
  `AuthorizationFailureReasons` values (`VALIDATION_FAILED`,
  `AUTHORIZATION_ERROR`, `AUTHENTICATION_ERROR`, `USER_CANCELLED`,
  `UNKNOWN_ERROR`), importable from `@payrails/web-sdk`.
- `pending` — the authorization is still processing and no further shopper
  action is required.

One listener fires for every payment method in the session; if your page mounts
other payment elements too, filter with `e.paymentMethodCode === 'card'`.

3D Secure challenges are handled by the SDK automatically; to observe or take
over the challenge, subscribe to `payrails.on('actionRequired', ...)` — see the
[events reference](../reference/events-reference.md#actionrequired-cancelable).

## 5. React to form and button state (optional)

Two button-specific events help you build custom UI around the flow:

```js
paymentButton.on('stateChanged', ({ state }) => {
  // 'enabled' | 'disabled' — mirror the button state elsewhere in your UI
});
paymentButton.on('validate', ({ isValid, error, fieldErrors }) => {
  // fires after a click validates the card form
});
```

To gate the payment right before it starts (e.g. run a last check and cancel),
use the cancelable instance events:

```js
payrails.on('buttonClicked', async (event) => {
  if (!(await lastCheckPasses())) event.preventDefault();
});
```

To move focus to the first invalid field yourself (for example from your own
"Pay" flow), call `cardForm.focus()`. `cardForm.isValid` exposes the current
validity synchronously.

## Beyond cards

The card form and payment button are the card element pair. Wallets and
redirect-based methods have their own elements created the same way from the
`payrails` client:

- [Add Apple Pay and Google Pay](add-wallet-payments.md)
- [Add PayPal and redirect payment methods](add-alternative-payment-methods.md)

If you need each card field placed independently (not the ready-made card form),
drop down to [secure fields](integrate-secure-fields.md).
