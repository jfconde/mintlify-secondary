# How to add Apple Pay and Google Pay

This guide shows you how to check wallet availability, mount the Apple Pay and
Google Pay buttons, and handle payment results and express-checkout address
changes. It assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.

Both wallets must be enabled for your workflow on the Payrails side; the buttons
draw their configuration (supported networks, merchant capabilities, gateway
parameters) from the init response.

## 1. Check availability

Only render a wallet button when the shopper's browser and device support it:

```js
// Google Pay — optionally override the display name (the merchant ID
// always comes from the backend configuration)
const googlePayReady = await payrails.isGooglePayAvailable('Your Store');

// Apple Pay — Safari / Apple devices only
const applePayReady = await payrails.isApplePayAvailable();
```

Both return a promise resolving to `true` or `false`. Alternatively, construct
the button first and read its own capability check — every express button
exposes `readonly isAvailable: Promise<boolean>`:

```js
const googlePayButton = payrails.googlePayButton({ ... });
if (await googlePayButton.isAvailable) {
  googlePayButton.mount('#google-pay-button');
}
```

The button's `isAvailable` uses the same underlying check and never rejects
(resolves to `false` on any check-side failure).

## 2. Mount the Google Pay button

```html
<div id="google-pay-button"></div>
```

```js
const googlePayButton = payrails.googlePayButton({
  merchantName: 'Your Store',
  appearance: {
    settings: {
      buttonColor: 'black', // default 'black'
      buttonType: 'long', // default 'pay'
      buttonSizeMode: 'fill', // default 'fill'
      buttonRadius: 16, // corner radius in px (default 6)
      height: '48px', // fill mode only
      locale: 'en',
    },
  },
});

// Reveal the container only when Google Pay is usable in this browser/device.
googlePayButton.isAvailable.then((available) => {
  if (available) {
    document.getElementById('google-pay-button').hidden = false;
    googlePayButton.mount('#google-pay-button');
  }
});

// Payment outcomes ride on the instance emitter; filter by paymentMethodCode.
payrails.on('success', (e) => {
  if (e.paymentMethodCode === 'googlePay') {
    // payment authorized
  }
});
payrails.on('failed', (e) => {
  if (e.paymentMethodCode === 'googlePay')
    console.error('Google Pay failed', e);
});
```

Other options worth knowing:

- `showStoreInstrumentCheckbox` / `defaultStoreInstrumentState` — render a "save
  for future payments" checkbox under the button.
- `redirectFor3DS` and `returnInfo` — control how a 3D Secure redirect returns
  to your site (see
  [handling the redirect return](add-alternative-payment-methods.md)).
- The environment (`TEST` / `PRODUCTION`) is resolved from the server-provided
  SDK configuration passed into `Payrails.init(initResponse)`.
- The transaction country shown to Google comes from your order data: include
  the order's billing-address country (`order.billingAddress.country.code`) when
  your server creates the payment session. Without it the SDK sends an empty
  country code, which Google can reject depending on your processing setup.

## 3. Mount the Apple Pay button

```html
<div id="apple-pay-button"></div>
```

```js
const applePayButton = payrails.applePayButton({
  styles: {
    type: 'buy', // default 'buy' — also 'plain', 'checkout', 'donate', …
    style: 'black', // default 'black' — also 'white', 'whiteOutline', 'automatic'
    locale: 'en',
  },
  translations: {
    labels: {
      paymentScreenLabel: 'Your Store', // label shown in the Apple Pay sheet
    },
  },
});

// Reveal the container only when Apple Pay is usable in this browser/device.
applePayButton.isAvailable.then((available) => {
  if (available) {
    document.getElementById('apple-pay-button').hidden = false;
    applePayButton.mount('#apple-pay-button');
  }
});

payrails.on('success', (e) => {
  if (e.paymentMethodCode === 'applePay') {
    // payment authorized
  }
});
payrails.on('failed', (e) => {
  if (e.paymentMethodCode !== 'applePay') return;
  if (e.data?.code === 'USER_CANCELLED') {
    // shopper closed the Apple Pay sheet — not an error
    return;
  }
  console.error('Apple Pay failed', e);
});
```

Notes:

- When the shopper cancels the Apple Pay sheet, the `failed` event fires with
  `data.code === 'USER_CANCELLED'` so you can distinguish cancellation from a
  real failure.
- `abortAfterAuthorizeFailed: true` closes the sheet on authorization failure
  instead of showing Apple's inline failure state.
- `showStoreInstrumentCheckbox` works the same way as for Google Pay.

The `success`/`failed`/`pending` events are shared with all other payment
elements — one listener covers the whole session; filter by
`e.paymentMethodCode` as shown above. See the
[events reference](../reference/events-reference.md) and the
[`payrails` reference](../reference/payrails-reference.md) for the full option
lists.

## 4. Validate the delivery address in express checkout (Apple Pay)

When your Apple Pay configuration requires shipping contact fields, the SDK
forwards address changes from the payment sheet to the instance-level
`deliveryAddressChanged` event. Call `event.preventDefault()` to reject the
address (the sheet shows "Delivery to this address is not supported." and asks
the shopper to pick another); do nothing to accept it:

```js
payrails.on('deliveryAddressChanged', (event) => {
  const address = event.deliveryAddress;
  // Before authorization Apple only exposes redacted fields:
  // city, postalCode, state, and country.code.
  if (!isServiceableRegion(address?.postalCode, address?.country?.code)) {
    event.preventDefault();
  }
});
```

Keep this handler fast — Apple aborts the sheet if it is not answered within
roughly 30 seconds, so use it for region/ZIP checks rather than a full cart
recompute. The full, unredacted address only becomes available after the shopper
authorizes the payment. The same event also fires for PayPal express checkout
(with PayPal's payload shape) — see the
[events reference](../reference/events-reference.md#deliveryaddresschanged-cancelable).
