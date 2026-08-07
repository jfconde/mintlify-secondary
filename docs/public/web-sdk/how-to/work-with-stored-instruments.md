# How to work with saved payment methods

This guide shows you how to read a customer's stored payment instruments, show
them a list of their saved cards, and charge a saved instrument with the payment
button. It assumes you have already initialized the SDK and hold a `payrails`
client instance — see the [setup guide](../getting-started.md) if you have not.

Stored instruments are payment methods (cards, PayPal accounts, wallets) that
were previously saved for the customer. They arrive with the SDK's init
configuration for the customer (holder) your backend created the session for —
no extra network call is needed to read them.

## 1. Read the stored instruments

List everything that was returned for the session:

```js
const instruments = payrails.getStoredInstruments();
```

Filter by payment method:

```js
import { PAYMENT_METHOD_CODES } from '@payrails/web-sdk';

const cards = payrails.getStoredInstrumentsByPaymentMethod(
  PAYMENT_METHOD_CODES.CARD
);
```

Or use the per-method helpers:

```js
const cards = payrails.getSavedCreditCards();
const paypalAccounts = payrails.getSavedPaypalAccounts();
const googlePayAccounts = payrails.getSavedGooglePayAccounts();
const applePayAccounts = payrails.getSavedApplePayAccounts();
```

`getSavedPaypalAccounts()` and `getSavedGooglePayAccounts()` only return
instruments whose status is `enabled`.

Each entry is a `StoredPaymentInstrument`:

```js
{
  id: '0c1e60eb-…',            // instrument id (UUID)
  status: 'enabled',
  paymentMethod: 'card',       // e.g. 'card', 'payPal', 'googlePay', 'applePay'
  displayName: 'Visa •••• 4242',
  default: false,
  data: {
    // card instruments: bin, suffix, network, …
    // PayPal instruments: email
  },
}
```

## 2. Show the pre-built saved-card list

`payrails.cardList()` renders the customer's saved credit cards as a radio-group
list:

```html
<div id="saved-cards"></div>
<div id="card-form"></div>
<div id="pay-button"></div>
```

```js
const cardList = payrails.cardList({
  onCardChange: (selectedCard) => {
    // a StoredPaymentInstrument for the card the shopper picked
    console.log('Selected', selectedCard.id);
  },
});
cardList.mount('#saved-cards');
```

The card list is wired to the other card elements created from the same client:

- Selecting a card sets it as the instrument on `payrails.paymentButton(...)`
  and enables the button — no card form input is required.
- When the shopper focuses the card form instead, the list selection is cleared
  and the button switches back to charging the form's card data.

Call `cardList.reset()` to clear the selection yourself.

## 3. Pay with a stored instrument

The card payment button charges whichever instrument is currently selected;
otherwise it collects and charges the card form. A typical page combines all
three elements:

```js
const cardList = payrails.cardList({
  onCardChange: (card) => console.log('Paying with saved card', card.id),
});
cardList.mount('#saved-cards');

const cardForm = payrails.cardForm();
cardForm.mount('#card-form');

const paymentButton = payrails.paymentButton({});
paymentButton.mount('#pay-button');

payrails.on('success', () => {
  // payment authorized
});
payrails.on('failed', (e) => {
  console.error(`Payment failed (${e.data?.code}): ${e.data?.message}`);
});
```

When a saved instrument is selected, clicking the button skips card form
validation and authorizes the payment with the stored instrument's id and
payment method.

### Selecting an instrument programmatically

If you build your own saved-methods UI instead of `cardList`, hand the chosen
instrument to the button directly:

```js
const [firstCard] = payrails.getSavedCreditCards();

paymentButton.setSavedInstrument(firstCard);
```

`setSavedInstrument` accepts any `StoredPaymentInstrument` — including saved
PayPal accounts — and enables the button.

## 4. Update or delete a saved instrument

Instrument management goes through `payrails.api(...)`:

```js
const [instrument] = payrails.getSavedCreditCards();

// disable or update a saved instrument
await payrails.api({
  operation: 'updateInstrument',
  resourceId: instrument.id,
  body: { status: 'disabled' }, // also: default, merchantReference, …
});

// delete a saved instrument
await payrails.api({
  operation: 'deleteInstrument',
  resourceId: instrument.id,
});
```

## 5. Select an instrument for headless API operations

Headless operations executed through `payrails.api(...)` that act on an
instrument (such as `payout`) read the selected instrument from SDK state.
Register it with `setState`:

```js
const [instrument] = payrails.getStoredInstruments();

payrails.setState({ instrument });

await payrails.api({ operation: 'payout' });
```

`setState` validates the instrument: it throws if the instrument is missing or
its `id` is not a UUID.

## Saving new instruments

To store a new card during checkout, render the save-card checkbox on the card
form (`showStoreInstrumentCheckbox: true`) so the card is stored with the
payment, or save card data without a payment via the collect container's
`tokenize()` — see
[How to integrate secure fields](./integrate-secure-fields.md).

For the full method signatures and types see the
[`payrails` reference](../reference/payrails-reference.md).
