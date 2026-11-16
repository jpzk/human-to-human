// Optional access code for a private preview on Vercel (Routing Middleware).
// Set ACCESS_CODE in the Vercel project to turn it on; unset, the site is
// open. Only Vercel runs this file: local dev and the Docker/PartyKit
// deployment ignore it.
import { next } from "@vercel/functions";

export const config = { matcher: "/:path*" };

const COOKIE = "hands_access";
const MAX_AGE = 60 * 60 * 24 * 30;

async function token(code: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`hands:${code}`)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m?.[1];
}

const page = (error: string, back: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>hands: private demo</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F7F4;color:#2F2925;font:16px/1.5 system-ui,sans-serif}
  form{width:min(360px,88vw);display:flex;flex-direction:column;gap:12px;text-align:center}
  h1{margin:0;font-size:28px} p{margin:0;color:#6F6A63;font-size:14px}
  input{padding:12px 14px;border:1px solid #DAD8CE;border-radius:12px;font:inherit;text-align:center;letter-spacing:.08em}
  button{padding:12px;border:0;border-radius:12px;font:600 16px system-ui;color:#2F2925;cursor:pointer;background:linear-gradient(90deg,#F09A85,#D4B3D5,#7DD4C0)}
  .err{color:#B4483A}
</style></head><body>
<form method="post" action="/__access">
  <h1>hands</h1>
  <p>This is a private preview. Enter the access code you were given.</p>
  <input name="code" type="password" autocomplete="off" autofocus required aria-label="Access code">
  <input name="back" type="hidden" value="${back.replace(/[&"<>]/g, "")}">
  ${error ? `<p class="err">${error}</p>` : ""}
  <button type="submit">Enter</button>
  <p>hands by jpzk, hi-aryan and team</p>
</form></body></html>`;

const html = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default async function middleware(req: Request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return next();
  const expected = await token(code);
  const url = new URL(req.url);

  if (url.pathname === "/__access" && req.method === "POST") {
    const form = await req.formData();
    const back = String(form.get("back") || "/");
    const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
    if ((await token(String(form.get("code") ?? ""))) !== expected) return html(page("That code is not right.", safeBack), 401);
    return new Response(null, {
      status: 303,
      headers: {
        location: safeBack,
        "set-cookie": `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (readCookie(req, COOKIE) === expected) return next();
  return html(page("", url.pathname + url.search), 401);
}
