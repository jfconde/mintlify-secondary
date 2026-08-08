{/* 
  =======================================================================
  READ-ONLY FILE! DO NOT EDIT IN MINTLIFY EDITOR.
  This content is synced automatically from: github.com/your-org/secondary-repo
  Edits made here will be overwritten on the next sync build.
  =======================================================================
*/}

# Payrails Web SDK

![](/images/web-sdk/pr.jpg)

Payrails Web provides the building blocks to create a checkout experience for
your customers. This page gets you to a first mounted checkout and is the hub
for the rest of the documentation: task guides in [how-to](#how-to-guides), API
details in [reference](#reference), and background in
[explanation](#explanation).

You can integrate at three levels, from quickest to most control:

- **Drop-in** — all-in-one checkout UI; the quickest way to accept payments.
- **Elements** — one component per payment method (card form, wallet buttons,
  and more) for a fully customizable checkout.
- **Secure fields** — the lowest-level option: mount individual PCI-compliant
  card input iframes and build your own card-form markup around them. Most
  control, most work.

## Quick start

Install the SDK, initialize it once, then pick the integration that fits your
checkout.

### 1. Install the SDK

```bash
npm install @payrails/web-sdk
```

### 2. Initialize with your client init response

Call your backend, which calls the Payrails `/merchant/client/init` API, and
pass the response to `Payrails.init`. `init` is asynchronous — it loads the SDK
bundle (and its styles) for the version your session was created with, so
`await` it:

```js
import { Payrails } from '@payrails/web-sdk';

const payrails = await Payrails.init(clientInitResponse, {
  events: {
    onClientInitialized: () => console.log('SDK ready'),
  },
});
```

You now have a `payrails` client. Handle payment results with the instance-level
`.on(...)` API — the same events fire for the drop-in and elements below, so you
wire them once (secure fields are different; see that section):

```js
payrails.on('success', (event) =>
  console.log('Payment success', event.paymentMethodCode)
);
payrails.on('failed', (event) =>
  console.log('Payment failed', event.data?.code)
);
```

### 3. Choose your integration

Pick one of the following and mount it into a container on your page. Each
example is self-contained and assumes the `payrails` client and the `.on(...)`
result handlers from step 2.

#### Drop-in

The drop-in renders every payment method enabled for the current session — you
do not list methods yourself.

```html
<div id="dropin"></div>
```

```js
const dropin = payrails.dropin({});
dropin.mount('#dropin');
```

#### Elements

Compose your own layout from individual components. Here a card form and a
payment button, created from the same client — the client keeps the button
disabled until the form is valid and starts the payment on click.

```html
<div id="card-form"></div>
<div id="pay-button"></div>
```

```js
const cardForm = payrails.cardForm({ showCardHolderName: true });
cardForm.mount('#card-form');

const payButton = payrails.paymentButton({
  translations: { label: 'Pay now' },
});
payButton.mount('#pay-button');
```

#### Secure fields

The lower-level option: build a card form field by field with a collect
container. Sensitive data stays inside Payrails-hosted iframes and never touches
your page. Unlike the drop-in and elements, secure fields do not render the
session's payment methods or fire the `.on('success'/'failed')` handlers on
their own — `container.collect()` returns an encrypted payload (or `tokenize()`
a saved instrument) that you submit yourself. Reach for it only when you need
full control of the card UI; see the
[secure fields guide](how-to/integrate-secure-fields.md) for the full flow.

```html
<div id="card-number"></div>
```

```js
import { ElementType } from '@payrails/web-sdk';

const container = payrails.collectContainer({});
const cardNumber = container.createCollectElement({
  type: ElementType.CARD_NUMBER,
  required: true,
});
cardNumber.mount('#card-number');
// create and mount CVV and expiry the same way (each with required: true),
// then container.collect()
```

With the drop-in or elements you should now see the payment methods configured
for your merchant account. From here, pick the guide that matches your task.

## How-to guides

Task-oriented recipes. Each assumes the SDK is initialized as above.

- [Integrate the drop-in](how-to/integrate-dropin.md) — mount the all-in-one
  checkout, configure its methods, and handle its events and result screens.
- [Integrate Elements](how-to/integrate-elements.md) — card form and payment
  button as individual elements you place in your own layout.
- [Integrate secure fields](how-to/integrate-secure-fields.md) — the lower-level
  collect container for building your own card UI field by field.
- [Add Apple Pay and Google Pay](how-to/add-wallet-payments.md) — availability
  checks, wallet buttons, express checkout.
- [Add PayPal and redirect payment methods](how-to/add-alternative-payment-methods.md)
  — PayPal, Revolut Pay and other redirect-based methods, and handling the
  redirect return.
- [Work with saved payment methods](how-to/work-with-stored-instruments.md) —
  listing stored instruments and paying with them.
- [Customize the appearance](how-to/customize-appearance.md) — the `appearance`
  option, translations, and fonts.
- [Migrate to v6](how-to/migration-v6.md) — upgrading from 5.x: every breaking
  change with before/after code. There is also an
  [agent runbook](how-to/migration-v6-agent.md) if an AI coding agent performs
  the migration for you.

## Reference

Complete descriptions of the public API, verified against the source.

- [The Payrails class and package exports](reference/payrails-reference.md)
- [Events](reference/events-reference.md) — every callback and event, with
  payloads and cancelation semantics.
- [Appearance](reference/appearance-reference.md) — the `appearance` option
  types, rule semantics, and the guaranteed class-name contract.
- [Browser support](reference/browser-support.md) — the supported browser
  matrix, what sets the floor, and how it is enforced.

## Explanation

- [Architecture](explanation/architecture.md) — why the SDK is built the way it
  is: the secure iframe boundary, the component model, payment flow, and
  security design.
- [Google Pay hosting](explanation/google-pay-hosting.md) — why the SDK no
  longer asks for your Google Pay merchant ID, domain registration, or
  environment.

## Reporting a Vulnerability

If you discover a potential security issue in this project, please reach out to
us at security@payrails.com.

## Contributing

Internal development setup and conventions: [CONTRIBUTING](../CONTRIBUTING.md).
