# Architecture

Why the SDK is built the way it is. Not a usage guide — see `../how-to/`.

## The big picture

The Payrails Web SDK is three cooperating parts:

1. **The SDK core** — the `Payrails` class (`src/sdk/payrails.ts`), which runs
   in the merchant's page. It holds the session state for one checkout, acts as
   the factory for every UI element, and orchestrates payments against the
   Payrails backend.
2. **The component system** (`src/sdk/components/`) — the UI layer: the
   all-in-one Drop-in, card forms, wallet buttons (Apple Pay, Google Pay,
   PayPal, and others), card lists, address and billing forms. Components are
   plain DOM elements that mount into containers the merchant provides.
3. **The secure frame** — a separately built and separately hosted iframe
   application that renders the sensitive card inputs. It lives on a Payrails
   origin, not the merchant's, so the raw card data it captures is unreachable
   from any JavaScript running on the merchant page.

```
Merchant page (merchant origin)          Payrails origin
┌──────────────────────────────┐         ┌──────────────────────┐
│  Payrails class ──▶ elements │         │  secure frame app    │
│        │              │      │  post   │  (card number, CVV,  │
│        │        card form ───┼─message─┼─▶expiry inputs;      │
│        ▼              │      │  (bus)  │  encrypts input)     │
│  payment executor ◀───┘      │         └──────────────────────┘
│        │                     │
└────────┼─────────────────────┘
         ▼
   Payrails API (authorize, poll execution, tokenize)
```

The split exists because the three parts have different trust levels. The
merchant page is untrusted from a card-data perspective: any script the merchant
(or a compromised dependency) loads can read its DOM. The secure frames are the
only place where a PAN or CVV exists in plaintext, which keeps the merchant's
page out of the sensitive part of PCI DSS scope. The SDK core sits between the
two, holding no card data itself — only encrypted blobs and tokens.

## Initialization is server-driven

`Payrails.init()` does not take an API key. It takes an _init response_ — a
configuration object the merchant's server obtains from the Payrails API when it
starts a checkout. That object carries a short-lived token, the vault
configuration, and a **workflow execution**: the server's description of this
specific checkout, including which payment methods are available, which
instruments the customer has stored, and the links to call for each next step.

This shape is deliberate:

- **No secrets in the browser.** The merchant's API credentials never leave
  their server; the SDK only ever holds a scoped, expiring session token.
- **The server decides, the SDK renders.** Which payment methods appear in the
  Drop-in is not configured in frontend code — the Drop-in iterates the workflow
  execution's available methods and stored instruments
  (`src/sdk/workflow-execution/`). Routing rules, method eligibility, and
  amounts can change on the Payrails side without a frontend release.
- **Links over hard-coded URLs.** Follow-up calls (authorize, execution status,
  3DS) use URLs returned inside API responses, so the backend can evolve its
  endpoints without breaking deployed SDK versions.

## The component model

Every visible element is created from the `Payrails` instance — Drop-in, card
form, individual payment buttons, card list, dynamic form elements — and then
mounted into a DOM node the merchant owns. Creation is a factory call on the
instance rather than a free-standing constructor because each component needs
the ambient session: the workflow execution, the SDK configuration, and the
shared event emitter all belong to the instance created by `init()`.

Components share a small base, `PayrailsElement`
(`src/sdk/components/payrails/`), which standardizes how an element wraps a DOM
node, gets its `id`/class/test attributes, and mounts or unmounts. The Drop-in
is not a separate rendering technology — it composes the same card form,
buttons, and stored-instrument elements a merchant could create individually
(`src/sdk/components/dropin/`). That is why the SDK can offer three integration
depths (Drop-in, individual elements, headless) without maintaining three
implementations: they are the same machinery exposed at different altitudes.

## The secure iframe boundary

Card input fields are not DOM inputs on the merchant page. They render inside
`<iframe>`s pointing at a Payrails-hosted page: the card form mounts a single
frame that hosts all of its fields, and the low-level secure-fields API mounts
one frame per field. The merchant page only ever holds the frame element and a
handle to talk to it (`src/sdk/secure-frame-container/`).

Communication crosses the boundary via `postMessage`, wrapped by the shared
`@payrails/iframe-event-bus` package. Two details of that bus matter
architecturally:

- **Per-frame channels.** Every event name is prefixed with a UUID generated for
  the specific frame, so multiple secure fields on one page cannot cross-talk,
  and a message intended for one frame is meaningless to another.
- **Nothing sensitive crosses in plaintext.** When the SDK asks the frames to
  collect, encryption happens _inside_ the iframe using `@payrails/web-cse` (JWE
  client-side encryption). What comes back over `postMessage` — and what the SDK
  submits to the API — is the encrypted payload. The merchant page handles
  ciphertext only.

Validation state does cross the boundary (is the field valid, empty, focused;
the card's BIN and detected scheme), because merchants need it to drive their
UI. That is the design line: metadata out, card data never.

The frames are served by the secure-frame application (`apps/secure-frame` in
this monorepo), which is versioned, built, and deployed independently of the npm
package; the SDK resolves the frame URL at build time (`SECURE_FRAME_URL`,
pointing at the Payrails assets origin). On the host side,
`src/sdk/secure-frame-container/` implements the container interface the
components consume: it creates the frames, aggregates their validation state,
and on collect asks the frames (over the event bus) for the encrypted payload,
which it then hands to tokenization against the Payrails API
(`performTokenize`). Encryption stays inside the frame; tokenization and
authorization stay on the host.

The same secure-frame application also sandboxes third-party payment scripts
that cannot be integrity-checked (see Security below).

## The payment flow

Payments run through the `PaymentExecutor` (`src/sdk/payment/`). Its shape
follows from one backend reality: authorization is an asynchronous workflow, not
a single request/response. The executor submits the authorization, then polls
the execution URL returned in the response until the workflow reaches a final
state (with a bounded number of attempts and an initial delay tuned to typical
authorization latency).

3D Secure is layered on top rather than baked in: when an authorization comes
back pending with a 3DS link, `ThreeDSecurePayment` presents the challenge — in
a popup by default, via full-page redirect when the integration opts into
redirects, or handed to the merchant entirely if they registered a handler for
action-required events — and then resumes the same polling loop. Components
never talk to the API directly; they hand a payment composition to the executor
and translate its outcome into the authorize success/failure events merchants
subscribe to.

## The headless surface

The headless API (`src/sdk/headless/`) exists for merchants whose checkout UI
cannot be a Payrails component at all — native-feeling custom UIs, server-side
rendering constraints, design systems that pre-date the SDK. It exposes the two
things such an integration still needs from the SDK: a typed way to call
Payrails API operations, and a query layer over the session's configuration and
state (available payment methods, per-method config, stored instruments).

Keeping this as a first-class surface — rather than telling those merchants to
call the REST API directly — means they still get the session handling, the
workflow-execution semantics, and the secure-field machinery, while owning every
pixel. The `Payrails` instance methods for fetching stored instruments and
available payment methods are thin wrappers over this same layer.

## Build outputs

The npm package (Vite, `vite.config.ts`) is a **thin loader**: a CommonJS entry,
an ESM entry, and one rolled-up type-declaration file that expose the full
public API surface but contain no SDK logic. At `Payrails.init` the loader
fetches the real SDK from the Payrails CDN — a self-executing bundle
(`payrails.js`, built by `vite.bundle.config.ts`) plus its extracted stylesheet
(`payrails-styles.css`) — pinned to the SDK version configured for the merchant
account. Splitting the package this way lets Payrails serve each merchant an SDK
version compatible with their account configuration without a new npm install,
while the npm layer still gives bundler users types and module resolution; CJS
and ESM entries both exist because merchant stacks vary. The secure-frame code
is built by a separate Rollup config into its own bundle, because it is deployed
to the iframe origin, not published to npm.

## Security architecture

The security posture is defense in depth around one invariant — card data never
enters the merchant's JavaScript context:

- **Origin isolation.** Sensitive inputs render inside iframes on a separate
  Payrails origin; the browser's same-origin policy, not SDK code, is what
  prevents the merchant page from reading them.
- **Client-side encryption.** Collected data is JWE-encrypted inside the frame
  (`@payrails/web-cse`) before it crosses any boundary.
- **Scoped messaging.** Cross-frame messages use UUID-namespaced channels, so
  frames on the same page cannot receive each other's events, and the payloads
  worth stealing are ciphertext.
- **Subresource integrity for third-party scripts.** The Apple Pay SDK script is
  pinned to a specific version and loaded with an SRI hash and `crossorigin`, so
  the browser rejects a tampered payload (`src/sdk/sdk-loader/`). Google Pay's
  `pay.js` does not ship stable hashes, so SRI is impossible there; following
  Google's PCI DSS v4 guidance, the SDK supports loading it inside the sandboxed
  secure-frame iframe instead (an iframe-based Google Pay button that is being
  rolled out alongside the direct one).
- **Fraud signals.** The SDK integrates `@payrails/fraud-sdk` for multi-provider
  fraud-detection device signals, kept as a separate package so provider
  integrations evolve independently of the checkout SDK.

## Reporting a Vulnerability

If you discover a potential security issue in this project, please reach out to
us at security@payrails.com.
