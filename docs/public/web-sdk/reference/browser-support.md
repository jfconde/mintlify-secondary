# Browser support

The supported browser matrix for `@payrails/web-sdk` and the Payrails-hosted
frames it loads. For task guides see ../how-to/.

## Supported browsers

| Browser               | Minimum version | Released |
| --------------------- | --------------- | -------- |
| Safari (macOS)        | 12.1            | Mar 2019 |
| Safari (iOS / iPadOS) | 12.2            | Mar 2019 |
| Chrome                | 73              | Mar 2019 |
| Edge                  | 79              | Jan 2020 |
| Firefox               | 67              | May 2019 |
| Opera                 | 60              | Apr 2019 |
| Samsung Internet      | 11.1            | Aug 2019 |

Anything newer than these versions is supported. Older versions are not tested
and may fail at runtime.

This matrix covers everything Payrails runs in your customer's browser: the npm
packages (`@payrails/web-sdk`, `@payrails/display-sdk`, `@payrails/fraud-sdk`,
`@payrails/web-cse`) and everything the SDK loads at runtime from the Payrails
CDN.

## What determines the floor

The SDK ships **no ES built-in polyfills**. Its build downlevels modern _syntax_
so it runs on the browsers above, but it does not add missing _built-ins_. The
floor is therefore set by the oldest browser that natively provides every
built-in the SDK calls — currently `globalThis`, `Object.fromEntries` and
`AbortController` (all Safari 12.1), plus dynamic `import()`, which is what pins
Firefox to 67.

If you need to support a browser below this floor, you must supply the missing
built-ins yourself by loading a polyfill (for example `core-js`) **before** the
Payrails SDK. Payrails does not test these configurations.

## Payment-method availability

Meeting the floor means the SDK loads and runs; it does not mean every payment
method is available. Wallet methods depend on the browser and device rather than
on the SDK:

- **Apple Pay** requires Safari with `ApplePaySession`. Check availability with
  the SDK rather than assuming — see
  [`payrails-reference`](payrails-reference.md).
- **Google Pay** requires a browser Google Pay supports.

## How this is enforced

The matrix is not documentation-only. It lives in `.browserslistrc` at the
repository root and is enforced on every pull request:

| Guard                       | Catches                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| `build.target` (all builds) | Downlevels syntax to the matrix                                              |
| `pnpm typecheck`            | ES built-ins above the floor, via TypeScript `lib`                           |
| `eslint-plugin-compat`      | Web/DOM APIs above the floor                                                 |
| `pnpm check:dist-syntax`    | Above-floor syntax in built output, including code from bundled dependencies |

Raising the floor is a breaking change and ships only in a major release.
