# How to integrate the drop-in

**The problem.** You run an online store and want to start taking payments —
cards, Apple Pay and Google Pay, PayPal, stored cards — without designing,
building, and maintaining a checkout UI for each one. You want the shortest path
from "SDK installed" to "money moving," and you want new payment methods to show
up when you enable them in the dashboard, not when you ship front-end code.

**The solution.** The drop-in is a single component that renders every payment
method enabled for the session, collects the details, runs 3D Secure, and shows
its own success / failure / pending screens. You mount it once and handle the
result.

This guide assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.

## 1. Mount the drop-in

Add a container to your page and mount the drop-in into it. You do not list
payment methods yourself — the init response determines what appears.

```html
<div id="dropin-container"></div>
```

```js
const dropin = payrails.dropin({});
dropin.mount('#dropin-container');

payrails.on('success', () => {
  // payment authorized — the drop-in already shows its success screen
});
payrails.on('failed', (e) => {
  // the drop-in shows its failure screen first (skipped when the
  // shopper cancelled, e.g. closed the Apple Pay sheet)
  console.error('Payment failed', e.data?.code);
});
```

Payment outcomes are instance events (`payrails.on(...)`), not drop-in options —
one listener covers every payment method the drop-in renders. See the
[events reference](../reference/events-reference.md).

## 2. Configure payment methods

`paymentMethodsConfiguration` customizes each method the drop-in renders:

```js
const dropin = payrails.dropin({
  paymentMethodsConfiguration: {
    // preselectFirstPaymentOption: true, // default — set false to opt out
    cards: {
      showCardHolderName: true,
      showStoreInstrumentCheckbox: true,
      showStoredInstruments: true, // stored cards, on by default
    },
    googlePay: {
      merchantName: 'Your Store',
    },
  },
  returnInfo: {
    success: 'https://your-shop.example/return/success',
    error: 'https://your-shop.example/return/error',
    cancel: 'https://your-shop.example/return/cancel',
    pending: 'https://your-shop.example/return/pending',
  },
});
```

- `cards` accepts the card-form options you know from the standalone element
  (`showCardHolderName`, `showSingleExpiryDateField`, `layout`,
  `installmentConfig`, …) plus `disablePaymentButton` and
  `showStoredInstruments`.
- `payPal`, `googlePay`, and `applePay` each accept `showStoredInstruments`,
  `showStoreInstrumentCheckbox`, `defaultStoreInstrumentState`, and
  `alwaysStoreInstrument`. Lean does not save instruments, so it takes none of
  these.
- `alwaysStoreInstrument` (on `cards`, `payPal`, `googlePay`, and `applePay`)
  stores the instrument even when the checkbox is hidden or left unchecked. Set
  it only when you already have the shopper's consent to save the instrument.
- `returnInfo` sets the URLs the shopper returns to after redirect-based methods
  — see [handling the redirect return](add-alternative-payment-methods.md).

## 3. Customize texts and appearance

`translations` and `appearance` are keyed by the drop-in's building blocks:

```js
const dropin = payrails.dropin({
  translations: {
    cardPaymentButton: { label: 'Pay now' },
    paymentResult: {
      success: 'Thank you — your payment was successful.',
      fail: 'Something went wrong. Please try again.',
      pending: 'Your payment is being processed.',
    },
  },
  appearance: {
    rules: {
      // root: paints the drop-in container itself
      '.payrails-container': { maxWidth: '480px' },
    },
    cardForm: {
      rules: { '.payrails-input': { border: '1px solid #eae8ee' } },
    },
    cardPaymentButton: {
      rules: { '.payrails-button': { backgroundColor: '#1a1a1a' } },
    },
    authSuccess: { rules: {} },
    authFailed: { rules: {} },
  },
});
```

`paymentResult` texts feed the built-in result screens the drop-in shows after a
payment completes, fails, or ends up pending.

The wallet buttons (Google Pay, Apple Pay, PayPal, Revolut Pay, Lean) are drawn
by their providers, so CSS cannot reach them — configure their chrome through
the matching `appearance` slot's `settings` instead:

```js
const dropin = payrails.dropin({
  appearance: {
    googlePayButton: { settings: { buttonColor: 'black', buttonType: 'buy' } },
    applePayButton: { settings: { height: '48px', borderRadius: '8px' } },
    revolutPayButton: { settings: { theme: 'dark', width: '100%' } },
  },
});
```

Apple Pay splits across two options: the `applePayButton` slot's `settings` size
the button box, and its native type and style come from
`paymentMethodsConfiguration.applePay.styles`.

For the appearance rules syntax, class names, and state modifiers see
[How to customize the checkout's appearance](customize-appearance.md); for the
full `DropinAppearance` slot list see the
[appearance reference](../reference/appearance-reference.md).

## 4. Handle events

Payment-attempt events (shared with all other elements) live on the instance;
drop-in-specific events live on the drop-in element:

```js
const dropin = payrails.dropin({});

// Instance events — session-wide
payrails.on('success', () => {
  // shown after the built-in success screen renders
});
payrails.on('failed', (e) => console.error(e.data?.code));
payrails.on('pending', () => {
  // authorization accepted but not final
});
payrails.on('buttonClicked', async (event) => {
  // last hook before the payment starts
  if (!(await lastMinuteChecksPass())) event.preventDefault();
});

// Element events — this drop-in only
dropin.on('paymentOptionSelected', ({ paymentMethod, instrument }) => {
  // shopper switched payment method or picked a stored instrument
});
dropin.on('saveInstrumentCheckboxChanged', (e) => {
  // fans in from every payment option that renders the checkbox
  console.log('save instrument:', e.checked);
});
```

Canceling a payment from `buttonClicked` (or `requestStart`) uses
`event.preventDefault()` — returning `false` has no effect, and a thrown error
does not block the payment. See the
[events reference](../reference/events-reference.md) for every event and
payload.

## When to reach for something else

- You need the card form and pay button placed inside your own checkout layout,
  or styled beyond what `appearance` allows → use
  [Elements](integrate-elements.md).
- You need each card field positioned independently in a bespoke or multi-step
  form → use [secure fields](integrate-secure-fields.md).
