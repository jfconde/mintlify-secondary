# Google Pay hosting

Why the SDK stopped asking for your Google Pay merchant details, and what
replaced the merchant-side setup. This page is background — for integration
steps see
[How to add Apple Pay and Google Pay](../how-to/add-wallet-payments.md); for the
upgrade itself see the
[v6 migration guide](../how-to/migration-v6.md#10-google-pay-is-hosted-by-payrails).

## The merchant-hosted model (before 5.46)

When Google Pay support first shipped in the SDK, the button ran on your page
under your own Google Pay registration. That put two setup obligations on you:

1. Register your checkout domain in the Google Pay & Wallet Console and obtain
   your own Google merchant ID.
2. Pass those details to the SDK:

```js
payrails.googlePayButton({
  environment: 'PRODUCTION', // or 'TEST'
  merchantInfo: {
    merchantId: 'BCR2DN...', // your Google merchant ID
    merchantName: 'Your Store',
  },
});
```

The registration was tied to the exact domains you listed in the console, so
every new checkout domain (staging, preview environments, a rebrand) needed
another console entry before Google Pay would work there. Keeping `environment`
correct between test and production builds was also your code's job.

## The Payrails-hosted model (5.46.1 onward)

From 5.46.1, the Google Pay button renders inside the Payrails secure iframe —
the same Payrails-origin frame that hosts the card fields. Because the button
runs on a Payrails domain, Payrails' own Google Pay registration covers the
payment. There is no domain for you to register and no Google merchant ID for
you to obtain: the merchant identity comes from your Payrails account
configuration, delivered to the SDK in the init response. On 5.x you still pass
the `environment` (`TEST` / `PRODUCTION`) option yourself, exactly as before —
only v6 stops taking it from your code and derives it from the session instead.

5.46.1 supported both models side by side. Existing integrations kept working
unchanged, and Payrails switched traffic to the hosted model per merchant on the
server side — no code change and no release was needed from you for the switch.
This makes 5.46.1 the earliest safe stop if you upgrade in stages: any 5.x
release from 5.46.1 onward can be moved to Payrails-hosted Google Pay without
touching your integration.

## v6: hosted-only

v6 removes the merchant-hosted path — a breaking change if your integration
still passes its own Google Pay merchant details. `merchantInfo` and
`environment` are gone from the Google Pay options on both
`payrails.googlePayButton(...)` and the drop-in's `googlePay` configuration —
passing them is a TypeScript build error. Reach out to your Payrails partner
before upgrading to plan the v6 rollout for Google Pay; the switch also involves
configuration on the Payrails side. The one merchant-facing knob left is
`merchantName`, an optional override for the store name shown in the Google Pay
sheet; the merchant ID behind it always comes from the Payrails configuration.

In practice this means:

- No Google Pay & Wallet Console setup, for your first domain or any later one.
- No `environment` bookkeeping — test sessions resolve to Google's `TEST`
  environment and production sessions to `PRODUCTION`, based on the
  server-provided configuration in the init response.
- Google Pay behaves like every other Payrails-configured payment method:
  enabled and configured on the Payrails side, consumed by the SDK.
