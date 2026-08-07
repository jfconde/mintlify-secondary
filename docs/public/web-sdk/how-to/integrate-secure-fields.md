# How to integrate secure fields

**The problem.** Your checkout is bespoke — card number on one step, expiry and
CVV on another, everything laid out to match your design system pixel for pixel.
The ready-made card form is too much of a unit for you: you need each field as
its own element you can place, style, and validate independently. At the same
time you must keep raw card data out of your front end to stay within a narrow
PCI scope.

**The solution.** Secure fields are pre-built input elements hosted by Payrails
and injected into your page as iframes. Sensitive card data never touches your
application code. You create a **collect container**, create one element per
field, mount each wherever you want, validate them, and then collect the data as
an encrypted payload — or save it as a reusable payment instrument.

This guide assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.
If you want a ready-made card form instead, see
[How to integrate Elements](integrate-elements.md).

## 1. Create a collect container

Create a container for the secure fields with the `collectContainer()` method of
the Payrails client:

```js
const container = payrails.collectContainer({});
```

You choose how the fields end up on the page by how you mount them:

- mount each element individually wherever you want on the page
  (`element.mount(selector)`) — use this when you control the markup around
  every field, or
- mount the container once with `container.mount(selector)` to render all
  created elements into a single wrapper.

The container accepts an optional `containerId` and `fonts` — see
[How to customize the checkout's appearance](customize-appearance.md) for font
loading. Styling happens per element via `appearance` (step 2).

## 2. Create collect elements

Create one element per field with `createCollectElement(options)`:

```js
import { ElementType } from '@payrails/web-sdk';

const cardNumber = container.createCollectElement({
  type: ElementType.CARD_NUMBER,
  label: 'Card number',
  placeholder: '1234 1234 1234 1234',
  required: true,
});
```

The options object:

```js
const options = {
  type: ElementType.CARD_NUMBER, // required, one of the ElementType values
  label: 'Card number', // optional label rendered above the field
  placeholder: '1234 1234 1234 1234', // optional placeholder
  required: false, // optional, defaults to false
  enableCardIcon: true, // optional, card-brand icon in CARD_NUMBER (default false for standalone collect elements)
  format: 'MM/YY', // optional, only for EXPIRATION_DATE / EXPIRATION_YEAR
  appearance: { rules: {} }, // optional CSS rules applied inside the field's iframe
  translations: { error: { default: 'Invalid value' } }, // optional custom default error message
};
```

The `type` field takes a Payrails `ElementType`. Each type applies the
appropriate formatting and validations to the field:

- `CARD_NUMBER`
- `CARDHOLDER_NAME`
- `CVV`
- `EXPIRATION_MONTH`
- `EXPIRATION_YEAR`
- `EXPIRATION_DATE`

The `format` values accepted for `EXPIRATION_DATE` are:

- `MM/YY` (default)
- `MM/YYYY`
- `YY/MM`
- `YYYY/MM`

The `format` values accepted for `EXPIRATION_YEAR` are:

- `YY` (default)
- `YYYY`

If `format` is not specified, or an invalid value is passed, the default is
used.

For the `appearance` rules syntax, class names, and state modifiers
(`.payrails-input--invalid`, …) see
[How to customize the checkout's appearance](customize-appearance.md).

## 3. Mount the elements to the DOM

Create placeholder `<div>` elements with unique `id` attributes where the fields
should render:

```html
<form>
  <div id="cardNumber"></div>
  <br />
  <div id="expiryDate"></div>
  <br />
  <div id="cvv"></div>
  <button type="submit">Submit</button>
</form>
```

Then mount each element into its placeholder:

```js
cardNumber.mount('#cardNumber');
```

Use `unmount()` to remove an element from the DOM:

```js
cardNumber.unmount();
```

## 4. React to element events (optional)

Every element exposes the typed `on(eventName, handler)` method shared by all
SDK elements; secure fields emit `'change'`, `'focus'`, `'blur'`, and `'ready'`.
`on()` returns an unsubscribe function:

```js
cardNumber.on('ready', () => {
  // the secure iframe has loaded and the field is interactive
});

cardNumber.on('change', (state) => {
  // state: { isValid, isEmpty, ... }
  // for CARD_NUMBER, state also carries the detected card network
  // and the BIN (first digits of the card number)
  console.log(state.isValid, state.network, state.bin);
});
```

## 5. Validate and collect the data

When the form is ready to be submitted, you can first validate all fields:

```js
const { isValid, error, fieldErrors } = await container.validate();
```

Then call `collect()` on the container. All created elements must be mounted.
The card data is encrypted inside the secure iframes and returned as an opaque
payload — the raw values are never exposed to your code:

```js
const result = await container.collect();
// result: { encryptedData: string, vaultProviderConfigId: string }
```

`collect()` rejects with a validation error when a field is incomplete or
invalid.

## 6. Save the card as a payment instrument (optional)

To store the collected card for later payments, call `tokenize()` instead of
`collect()`. It collects and encrypts the data, then saves it to Payrails as a
payment instrument for the customer (holder) the SDK session was initialized
for:

```js
const instrument = await container.tokenize({
  storeInstrument: true, // defaults to false
  futureUsage: 'CardOnFile', // 'CardOnFile' (default) | 'Subscription' | 'UnscheduledCardOnFile'
});

console.log('Saved instrument id:', instrument.id);
```

The response contains the new instrument's `id`, `status`, and card metadata
such as `data.bin`, `data.network`, and `data.suffix`. See
[How to work with saved payment methods](work-with-stored-instruments.md) for
using saved instruments in later sessions.

## End-to-end example

```js
import { ElementType } from '@payrails/web-sdk';

// Step 1
const container = payrails.collectContainer({});

// Step 2
const cardNumber = container.createCollectElement({
  type: ElementType.CARD_NUMBER,
  label: 'Card number',
  placeholder: '1234 1234 1234 1234',
  required: true,
  appearance: {
    rules: {
      '.payrails-input': { color: '#1d1d1d' },
      '.payrails-label': { fontSize: '12px', fontWeight: 'bold' },
      '.payrails-error': { color: '#f44336' },
    },
  },
});
const expiryDate = container.createCollectElement({
  type: ElementType.EXPIRATION_DATE,
  format: 'MM/YY',
});
const cvv = container.createCollectElement({
  type: ElementType.CVV,
});

// Step 3 — assumes divs with these ids exist on the page
cardNumber.mount('#cardNumber');
expiryDate.mount('#expiryDate');
cvv.mount('#cvv');

// Step 5
const { encryptedData, vaultProviderConfigId } = await container.collect();

// or Step 6 — save the card instead
const instrument = await container.tokenize({ storeInstrument: true });
```

## Default validations

Every element type has a set of built-in validations:

- `CARD_NUMBER`: card number validation with checksum (Luhn algorithm) and
  card-scheme-aware length and formatting. A valid 16 digit card number is
  formatted as `XXXX XXXX XXXX XXXX`.
- `CARDHOLDER_NAME`: name should be 2 or more symbols; valid characters match
  the pattern `^([a-zA-Z\\ \\,\\.\\-\\']{2,})$`.
- `CVV`: 3–4 digits.
- `EXPIRATION_DATE`: any date starting from the current month, in the configured
  `format` (default `MM/YY`).
- `EXPIRATION_MONTH`: a valid month (`01`–`12`).
- `EXPIRATION_YEAR`: the current year or later, in the configured `format`
  (default `YY`).

## UI errors for collect elements

You can display custom error messages on the elements with `setError` and
`resetError`.

`setError(error: string)` overrides any current error on the element with the
custom message. The message stays visible until `resetError()` is called on the
same element.

`resetError()` clears the custom error message set by `setError`.

```js
const container = payrails.collectContainer({});

const cardNumber = container.createCollectElement({
  type: ElementType.CARD_NUMBER,
});

// set a custom error
cardNumber.setError('custom error');

// reset the custom error
cardNumber.resetError();
```

For the full container and element API see the
[`payrails` reference](../reference/payrails-reference.md).
