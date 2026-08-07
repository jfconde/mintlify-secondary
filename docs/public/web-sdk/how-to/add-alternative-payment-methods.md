# How to add PayPal and redirect-based payment methods

This guide shows you how to mount the PayPal button, add redirect-based payment
methods (including Revolut Pay) with the generic redirect button, add
pay-by-bank via the Lean button, and handle the shopper's return from a
redirect. It assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.

Every method shown here must be enabled for your workflow on the Payrails side;
`payrails.getAvailablePaymentMethods()` returns the codes available in the
current session.

## 1. Mount the PayPal button

PayPal completes inside a popup managed by PayPal's own SDK — no redirect
handling is needed on your side.

```html
<div id="paypal-button"></div>
```

```js
const paypalButton = payrails.paypalButton({
  appearance: {
    settings: {
      color: 'gold', // 'gold' | 'blue' | 'silver' | 'white' | 'black'
      height: 40,
      label: 'paypal', // 'paypal' | 'checkout' | 'buynow' | 'pay' | …
      shape: 'rect', // 'rect' | 'pill'
      tagline: false,
      locale: 'en',
    },
  },
});

// Wallet availability is a `Promise<boolean>`, not an event.
if (await paypalButton.isAvailable) {
  paypalButton.mount('#paypal-button');
}

// Payment outcomes come through the instance emitter — one listener fires
// for every payment method; filter by `paymentMethodCode` if needed.
payrails.on('success', (e) => {
  if (e.paymentMethodCode === 'payPal') {
    // payment authorized
  }
});
payrails.on('failed', (e) => {
  if (e.paymentMethodCode === 'payPal') console.error('PayPal failed', e);
});
```

- `showStoreInstrumentCheckbox` lets the shopper vault their PayPal account;
  when checked, the button switches to PayPal's billing-agreement flow.
- In PayPal express checkout, `payrails.on('deliveryAddressChanged', ...)` fires
  when the shopper changes their shipping address in the PayPal popup. Call
  `event.preventDefault()` to reject the address — the same event contract as
  Apple Pay, described in
  [How to add Apple Pay and Google Pay](add-wallet-payments.md).

## 2. Mount a generic redirect button

`genericRedirectButton` covers payment methods where the shopper is sent to an
external page (bank selection, wallet login, voucher display) and then returns
to your site. Pass the payment method code the button should trigger:

```html
<div id="apm-button"></div>
```

```js
const redirectButton = payrails.genericRedirectButton({
  paymentMethod: { paymentMethodCode: 'iDeal' },
  translations: { label: 'Pay with iDEAL' },
  appearance: {
    rules: {
      '.payrails-generic-button': {
        backgroundColor: '#cc0066',
        color: '#ffffff',
      },
    },
  },
  openInNewTab: true,
  returnInfo: {
    success: 'https://your-shop.example/return/success',
    error: 'https://your-shop.example/return/error',
    cancel: 'https://your-shop.example/return/cancel',
    pending: 'https://your-shop.example/return/pending',
  },
});

redirectButton.mount('#apm-button');

payrails.on('success', (e) => {
  // final result — only received in this tab when openInNewTab is true (step 4)
  if (e.paymentMethodCode === 'iDeal') showConfirmation();
});
payrails.on('failed', (e) => {
  if (e.paymentMethodCode === 'iDeal') console.error('Payment failed', e.data);
});
```

On click the button authorizes the payment, then sends the shopper to the
provider's redirect URL — in a new tab when `openInNewTab: true`, otherwise in
the current tab.

### Revolut Pay styling

When `paymentMethodCode` is `'revolutPay'`, the button renders Revolut's
brand-compliant artwork instead of a text button. Its look is configured with
`appearance.settings` (Revolut's own config, not CSS — `appearance.rules` is
ignored for the artwork), and the label is locked to `"Pay with Revolut Pay"`
(custom `translations` are ignored per brand guidelines):

```js
const revolutButton = payrails.genericRedirectButton({
  paymentMethod: { paymentMethodCode: 'revolutPay' },
  appearance: {
    settings: {
      theme: 'dark', // 'dark' | 'light' | 'lightOutline' (default)
      width: '250px', // default '250px'
      borderRadius: '8px',
    },
  },
});

revolutButton.mount('#apm-button');
```

The `RevolutPayStyles` (the `appearance.settings` shape) and
`RevolutPayButtonTheme` types are exported from `@payrails/web-sdk`, along with
the `REVOLUT_PAY_DEFAULT_THEME` (`'lightOutline'`) and
`REVOLUT_PAY_DEFAULT_LABEL` (`'Pay with Revolut Pay'`) constants.

## 3. Mount the Lean pay-by-bank button

Lean opens a hosted bank-selection dialog on your page (no full-page redirect):

```js
const leanButton = payrails.leanButton({
  translations: { label: 'Pay by bank' },
  appearance: {
    settings: {
      themeColor: '#1a1a1a',
      buttonTextColor: '#ffffff',
      buttonBorderRadius: '8px',
      linkColor: '#1a1a1a',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
    },
  },
  returnInfo: {
    success: 'https://your-shop.example/return/success',
    error: 'https://your-shop.example/return/error',
  },
});

leanButton.mount('#lean-button');

payrails.on('success', (e) => {
  // dialog completed successfully
});
payrails.on('failed', (e) => {
  // dialog failed or the shopper cancelled
});
```

Lean is settings-only — `appearance.settings` (a `LeanCustomization`) themes the
hosted bank dialog (Lean SDK config; CSS rules cannot reach into Lean's iframe).
It takes no `rules`.

## 4. Handle the redirect return

Redirect-based methods send the shopper away from your page, so you need to
decide where they land afterwards and where the result callback fires.

**Return URLs (`ReturnInfo`).** The `returnInfo` object holds the URLs the
shopper is sent back to, keyed by outcome:

```ts
import type { ReturnInfo } from '@payrails/web-sdk';

const returnInfo: ReturnInfo = {
  success: 'https://your-shop.example/return/success',
  error: 'https://your-shop.example/return/error',
  cancel: 'https://your-shop.example/return/cancel',
  pending: 'https://your-shop.example/return/pending',
};
```

All fields are optional. Set `returnInfo` once for the whole session via the
client options, and optionally override it per button (as in the snippets
above):

```js
const payrails = await Payrails.init(clientInitResponse, { returnInfo });
```

A per-button `returnInfo` is merged over the session-level one field by field,
so set your URLs once and override only the ones that differ for a given method.
A field set at neither level falls back to a generic Payrails-hosted result
page, so set your own in production.

**Same-tab redirect (default).** The shopper leaves your page, so no callback
fires in the browser session that started the payment. When they land back on
your return URL, determine the final payment status on your server (for example
via Payrails webhooks or the payment-status API) and render the result there.

**New-tab redirect (`openInNewTab: true`).** Your page stays open. The SDK polls
the payment status while the shopper completes the flow in the other tab and
fires the instance `success` or `failed` event in your original tab; the
redirect tab is closed automatically when the result arrives. If the shopper
closes the tab before finishing, `failed` fires with
`data.code === 'USER_CANCELLED'` (after a final status check to rule out a
just-completed payment). The tab itself still lands on your `returnInfo` URL, so
keep those pages meaningful either way.

For the full option and event lists see the
[`payrails` reference](../reference/payrails-reference.md) and the
[events reference](../reference/events-reference.md).
