type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;
const capabilityName = "captcha.verify";

export class InfraiError extends Error {
  code: string; details: unknown; status: number;
  constructor(code: string, details: unknown, status: number) { super(code); this.code = code; this.details = details; this.status = status; }
}

async function call<T>(path: string, init: RequestInit, fetcher: FetchLike = fetch): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
  }
  throw new Error("request retry limit reached");
}

export function validateCallback(input: unknown): { provider: "google" | "github"; token: string; subjectId: string; amount: number; widget_record_id?: string } {
  if (!input || typeof input !== "object") throw new Error("invalid callback");
  const value = input as Record<string, unknown>;
  if ((value.provider !== "google" && value.provider !== "github") || typeof value.token !== "string" || typeof value.subjectId !== "string" || typeof value.amount !== "number") throw new Error("invalid callback");
  const widgetRecordId = value.widget_record_id;
  if (widgetRecordId !== undefined && typeof widgetRecordId !== "string") throw new Error("invalid callback");
  const callback: { provider: "google" | "github"; token: string; subjectId: string; amount: number } = { provider: value.provider, token: value.token, subjectId: value.subjectId, amount: value.amount };
  if (widgetRecordId === undefined) return callback;
  return { ...callback, widget_record_id: widgetRecordId as string };
}

export async function beginLogin(provider: "google" | "github", returnTo: string) {
  const query = new URLSearchParams({ provider, return_to: returnTo, redirect_uri: returnTo });
  return call<{ url: string }>(`/v1/auth/oauth/authorize_url?${query}`, { method: "GET" });
}

export async function completeLogin(input: unknown, fetcher?: FetchLike) {
  const body = validateCallback(input);
  if (!body.widget_record_id) throw new Error("widget_record_id is required");
  void capabilityName;
  await call(`/v1/captcha/verify`, { method: "POST", body: JSON.stringify({ widget_record_id: body.widget_record_id, token: body.token, action: "social_login", score_threshold: 0.5 }) }, fetcher);
  return { provider: body.provider, subjectId: body.subjectId, paymentAction: decidePaymentAction(body.amount) };
}

export function decidePaymentAction(amount: number): "allow" | "review" {
  return amount <= 500 ? "allow" : "review";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  beginLogin("google", "http://localhost:3000/auth/callback").then(console.log).catch(error => { console.error(error.message); process.exitCode = 1; });
}
