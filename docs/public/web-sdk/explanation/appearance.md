{/* 
  =======================================================================
  READ-ONLY FILE! DO NOT EDIT IN MINTLIFY EDITOR.
  This content is synced automatically from: github.com/your-org/secondary-repo
  Edits made here will be overwritten on the next sync build.
  =======================================================================
*/}

# The appearance system

How you control the look of Payrails elements, and why styling works the way it
does. This explains the model; for the full class catalogue and copy-paste
recipes see
[`../how-to/customize-appearance.md`](../how-to/customize-appearance.md) and
[`../reference/appearance-reference.md`](../reference/appearance-reference.md).

## You style Payrails elements with CSS you pass in

Every element you mount — the drop-in, a card form, a payment button — accepts
an `appearance` option. Its `rules` are CSS you author: selectors mapped to
declarations, including `@media` and `@supports` blocks. There is no proprietary
styling language; anything a browser understands is valid. The one difference
from ordinary CSS is _where it goes_: you hand these rules to the SDK through
`appearance` rather than writing them in your own stylesheet (see
[the only supported way in](#the-appearance-api-is-the-only-supported-way-in)).

What you target is a stable vocabulary of **public class names** that Payrails
stamps on its rendered DOM and treats as part of the API. The next section
describes that vocabulary; the reference maps it to each element.

## The class vocabulary

Payrails puts two kinds of class on its elements, and only one of them is yours
to use.

- **Generic classes** — `.payrails-input`, `.payrails-button`,
  `.payrails-container`, and so on — name a UI _role_. They are the public API:
  stable across releases and safe to select against.
- **Widget-specific classes** — like `.payrails-card-form` — are internal
  plumbing that can change between releases. Don't target them. Style the role,
  not the widget.

The generic classes are a small set, reused across every element, so a rule you
learn once applies everywhere the same role appears:

| Class                 | Role                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `.payrails-container` | The root wrapper of a widget (form, list, screen)                 |
| `.payrails-row`       | A horizontal group (form row, summary line, tile row)             |
| `.payrails-cell`      | One slot inside a row                                             |
| `.payrails-field`     | A labelled input group (label + input + error)                    |
| `.payrails-input`     | A text input, including the secure card fields                    |
| `.payrails-dropdown`  | A select input                                                    |
| `.payrails-label`     | A text label                                                      |
| `.payrails-text`      | Body text (amounts, terms, subtitles)                             |
| `.payrails-error`     | A validation error message                                        |
| `.payrails-button`    | A pay button drawn by the SDK                                     |
| `.payrails-checkbox`  | The save-instrument checkbox                                      |
| `.payrails-tile`      | A selectable tile (co-branded card brand, saved card, tab option) |
| `.payrails-icon`      | An icon or logo image                                             |

### Variations are modifier classes

A class describes what an element _is_; a **modifier** describes what state it's
_in_. Modifiers follow one convention — the base class with a `--state` suffix
appended — and the base class stays present the whole time, while the modifier
is added and removed as the state changes. A card input is always
`.payrails-input`, and _additionally_ carries `.payrails-input--invalid` only
while its contents are invalid. You react to a state by styling its modifier:

| Modifier     | Attaches to            | Applies when                            |
| ------------ | ---------------------- | --------------------------------------- |
| `--invalid`  | input, field, dropdown | the value is invalid                    |
| `--valid`    | input                  | the value is valid                      |
| `--empty`    | input                  | the input is empty                      |
| `--dirty`    | input                  | the input has been edited at least once |
| `--focused`  | field                  | a field in a secure iframe has focus    |
| `--loading`  | button                 | a payment is in flight                  |
| `--disabled` | button                 | the button is disabled                  |
| `--checked`  | checkbox               | the checkbox is checked                 |
| `--selected` | tile                   | the tile is selected                    |

Two things to know when styling states. The validity modifiers (`--invalid` /
`--valid`) clear while a field is focused and re-evaluate on blur, so
`.payrails-input--invalid:focus` won't match a field being corrected — for a
persistent error look on touched fields, combine `--dirty` with `--invalid`. And
which modifiers a given element can actually show depends on the element; the
reference lists them per element alongside the class map.

## Your rules apply to one element, and they don't merge

Rules you pass to one card form affect that card form only. They will not leak
into another widget on the same page, even if both would match the same
selector. When a container carries a child's appearance — a drop-in configured
with a `cardForm` block — there is no deep merge of one into the other; each
element keeps its own rules and the browser's cascade settles any overlap. In
practice it behaves the way "more specific, or closer to the element, wins"
would lead you to expect: a rule set on the child wins a conflict, and a more
general rule on the parent fills in what the child didn't set.

## Your rules beat the SDK's defaults, by design

Payrails ships baseline styling for every element. Your rules have to win over
it without you reverse-engineering the SDK's selectors or reaching for
`!important`. That is what **cascade layers** are for. The SDK's own defaults
live in `@layer payrails-defaults`; your `appearance.rules` land in
`@layer payrails-appearance`, which is ordered above it. A later layer beats an
earlier one regardless of how specific either selector is.

```
lower priority
│  @layer payrails-defaults     Payrails' baseline styling
│  @layer payrails-appearance   your rules  ← always win over the defaults
▼
higher priority
```

The payoff: you can target the very class the SDK styles — a plain
`.payrails-input { … }` — and win, with an ordinary selector and no specificity
tricks.

## The appearance API is the only supported way

You change how a Payrails element looks through `appearance` — not by writing
rules in your own stylesheet that reach into `.payrails-*` elements. The SDK
actively defers page-level CSS off its own DOM: a global CSS reset, or any of
your own rules that happen to match, is rolled back on Payrails elements so it
can't quietly override the baseline.

Two things follow from this. Your checkout stays stable when you change the rest
of your site's CSS — a new utility framework or reset won't reshape it. And when
something does look wrong, there is one place to check: your `appearance`
config. The guard is best-effort — a deliberately high-specificity or
`!important` rule in your own CSS can still reach through — but the supported,
dependable path is always `appearance.rules`.

## Wallet buttons are configurable via `settings`, not style-able

Apple Pay, Google Pay, PayPal, and similar buttons are drawn by the browser or
by the provider's own SDK. Their look isn't yours — or ours — to set with CSS.
So those elements take `settings` instead of `rules`: typed options such as
colour, shape, height, and label that Payrails forwards to whatever renders the
button. The mental split is simple — a card form is **styled** with `rules`; a
wallet button is **configured** with `settings`. Payrails also keeps its own
generic styling, and your page's CSS, from bleeding into a wallet button whose
appearance the provider owns.

## Card fields are styled through the SDK, not your page

The card number, expiry, and CVV inputs live inside a Payrails-hosted iframe, so
that sensitive data never enters your page. A consequence of that boundary: your
own stylesheet cannot reach those inputs — the browser won't let CSS cross into
another origin's frame.

You still style them the normal way. Rules you pass to the card form's
`appearance` (targeting `.payrails-input` and its modifiers) are carried across
into the fields by the SDK, so they match the rest of your checkout. The only
thing you lose at that boundary is the unsupported path — reaching in from your
own CSS — which you weren't meant to use anyway.

## Where to go next

- [`../how-to/customize-appearance.md`](../how-to/customize-appearance.md) — how
  to style the card form, drop-in, and buttons, step by step.
- [`../reference/appearance-reference.md`](../reference/appearance-reference.md)
  — the full catalogue of public classes and state modifiers, per element.
