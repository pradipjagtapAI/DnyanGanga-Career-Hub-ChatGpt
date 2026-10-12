import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) return { status: "request_context_expired", message: "This request has expired. Please try again." };
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const html = response.headers.get('Content-Type')?.includes('text/html');
    // A fresh nonce allows the framework's inline hydration scripts while
    // rejecting injected inline scripts. User content is rendered as React text.
    const nonce = html ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))) : null;
    let secured = new Response(response.body, response);
    if (nonce) {
      secured.headers.delete('Content-Length');
      secured = new HTMLRewriter().on('script', {
        element(element) { element.setAttribute('nonce', nonce); },
      }).transform(secured);
    }
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('X-Frame-Options', 'DENY');
    secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    secured.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''}; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);
    const url = new URL(request.url);
    if (url.protocol === 'https:') secured.headers.set('Strict-Transport-Security', 'max-age=31536000');
    if (html || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) secured.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return secured;
  },
};
