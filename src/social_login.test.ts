import assert from "node:assert/strict";
import { decidePaymentAction, validateCallback } from "./social_login.ts";

const callback = validateCallback({ provider: "github", token: "captcha-token", subjectId: "user-42", amount: 125 });
assert.equal(callback.provider, "github");
assert.equal(callback.amount, 125);
assert.throws(() => validateCallback({ provider: "twitter", token: "x", subjectId: "u", amount: 1 }));
assert.equal(decidePaymentAction(125), "allow");
assert.equal(decidePaymentAction(750), "review");
console.log("social callback and payment action: ok");
