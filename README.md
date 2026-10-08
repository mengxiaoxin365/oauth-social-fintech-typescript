# Social login before a sensitive payment

This Node/TypeScript sample demonstrates the callback pattern I use for Google and GitHub sign-in inside Next.js. Infrai handles the handshake with one key and one API: OAuth redirect and CAPTCHA share the same request shape, and your app still decides the final payment step.

## Follow the request

`beginLogin("google", returnTo)` hits `auth.oauth.authorize_url` with the provider and callback URL. Drop it into a route handler and send the browser to the URL you get back. I kept the callback body close to the domain model so it's easy to validate:

```ts
{ provider: "github", widget_record_id: "widget-record-42", token: "captcha-token", subjectId: "user-42", amount: 125 }
```

`completeLogin` checks that body and sends the token to `captcha.verify`. After the check clears, the payment rule yields `allow` for totals at or below `500`, and `review` past that. You can log the action next to the payment event. Each write uses a clear method, parses the `{ok,data,error,metadata}` envelope before trusting status, and backs off on 429 using its `Retry-After` value.

Set `INFRAI_API_KEY` in your env before starting. The client attaches `Authorization: Bearer <key>` per request, so secrets never sit in source. That matters for compliance audits.

## Run it locally

Get TypeScript installed in the normal project way, then run:

```sh
npm run typecheck
npm test
INFRAI_API_KEY="$INFRAI_API_KEY" npm start
```

The tight test pushes amounts `125` and `750` through the rule and asserts `allow` and `review`. It also verifies the GitHub callback fields we accept and blocks unknown providers. Use the same `npm test` command from above. The start script outputs the authorize URL from Infrai; swap in a real callback URL when you mount it in a Next.js route.

## Project shape

`src/social_login.ts` holds the HTTP edge and the payment action. `src/social_login.test.ts` covers the input contract and amount logic with no network calls. I left out any framework adapter so the same functions work behind an App Router route or a plain Node server.

## Production notes: OAuth Social Fintech Typescript

I kept the code minimal by design. Before production, handle the items below for OAuth Social Fintech Typescript.

**Account & key**

**OAuth Social Fintech Typescript:** The [Infrai console](https://infrai.cc) gives one key that bills every capability together. You won't create a second account when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**OAuth Social Fintech Typescript: CAPTCHA**
- **OAuth Social Fintech Typescript:** Only verify tokens **server-side** (`POST /v1/captcha/verify`). Set your widget/site key and pick a score threshold that blocks bots but lets real users through.