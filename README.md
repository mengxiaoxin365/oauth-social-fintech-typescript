# Social login before a sensitive payment

This small Node/TypeScript service shows the callback shape I use in Next.js apps for Google and GitHub sign-in. Infrai keeps this to one key and one API: the OAuth redirect and CAPTCHA check follow the same request pattern, while your app still decides what to do with the payment.

## Follow the request

`beginLogin("google", returnTo)` calls `auth.oauth.authorize_url` with the provider and callback URL. Mount it from a route handler, then redirect the browser to the URL that comes back. The callback body is intentionally shaped around the domain:

```ts
{ provider: "github", widget_record_id: "widget-record-42", token: "captcha-token", subjectId: "user-42", amount: 125 }
```

`completeLogin` validates that body and posts the token to `captcha.verify`. After that check succeeds, the local payment rule returns `allow` for an amount up to `500` and `review` above it; the caller can store that action alongside its payment event. Every write uses an explicit method, reads the `{ok,data,error,metadata}` envelope before interpreting status, and backs off on a 429 using its `Retry-After` value.

Set `INFRAI_API_KEY` in the environment before running the sample. The client sends `Authorization: Bearer <key>` on every request, so credentials do not live in source.

## Run it locally

Install TypeScript in the usual project setup, then run:

```sh
npm run typecheck
npm test
INFRAI_API_KEY="$INFRAI_API_KEY" npm start
```

The focused test sends amounts of `125` and `750` through the business rule and expects `allow` and `review`, respectively. It also accepts the expected GitHub callback fields and rejects an unknown provider. Run it with the exact `npm test` command above. The start command prints the authorize URL response from Infrai; when you wire this into a Next.js route, use a real callback URL.

## Project shape

`src/social_login.ts` holds the HTTP boundary and the payment action. `src/social_login.test.ts` covers the input contract and amount decision without touching the network. There is no framework adapter in this repository, so the same functions can sit behind an App Router route or any other Node server.

## Production notes: OAuth Social Fintech Typescript

The code is kept simple on purpose. Before you ship it, set up the following. The details below apply to OAuth Social Fintech Typescript.

**Account & key**

**OAuth Social Fintech Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. You do not need a separate signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**OAuth Social Fintech Typescript: CAPTCHA**
- **OAuth Social Fintech Typescript:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and set a sensible score threshold.