// GET  /api/ingredients?code=XYZ   -> { ingredients: [...] }
// POST /api/ingredients             -> { ok: true }   body: { code, ingredients }
//
// Bindings attendus (Cloudflare Pages > Settings > Functions > KV namespace bindings) :
//   INGREDIENTS_KV  -> KV namespace pour stocker les carnets utilisateurs

const KEY_PREFIX = "carnet:";
const MAX_INGREDIENTS = 500;
const MAX_NAME_LEN = 80;
const MAX_QTY_LEN = 40;

function sanitizeCode(code) {
  if (typeof code !== "string") return "";
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, "-")
    .slice(0, 60);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = sanitizeCode(url.searchParams.get("code") || "");
  if (!code) return json({ error: "Code utilisateur manquant ou invalide." }, 400);
  if (!env.INGREDIENTS_KV) return json({ error: "KV non configuré sur Cloudflare." }, 500);

  const raw = await env.INGREDIENTS_KV.get(KEY_PREFIX + code);
  if (!raw) return json({ ingredients: [] });

  try {
    const parsed = JSON.parse(raw);
    return json({ ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [] });
  } catch {
    return json({ ingredients: [] });
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.INGREDIENTS_KV) return json({ error: "KV non configuré sur Cloudflare." }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  const code = sanitizeCode(body.code || "");
  if (!code) return json({ error: "Code utilisateur manquant ou invalide." }, 400);

  if (!Array.isArray(body.ingredients)) {
    return json({ error: "Liste d'ingrédients manquante." }, 400);
  }

  const cleaned = body.ingredients
    .slice(0, MAX_INGREDIENTS)
    .map((ing) => ({
      name: String(ing?.name || "").slice(0, MAX_NAME_LEN).trim(),
      quantity: String(ing?.quantity || "").slice(0, MAX_QTY_LEN).trim(),
      category: String(ing?.category || "autres").slice(0, 30),
    }))
    .filter((i) => i.name);

  const payload = JSON.stringify({
    ingredients: cleaned,
    updatedAt: new Date().toISOString(),
  });

  await env.INGREDIENTS_KV.put(KEY_PREFIX + code, payload);

  return json({ ok: true, count: cleaned.length });
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const code = sanitizeCode(url.searchParams.get("code") || "");
  if (!code) return json({ error: "Code utilisateur manquant." }, 400);
  if (!env.INGREDIENTS_KV) return json({ error: "KV non configuré sur Cloudflare." }, 500);
  await env.INGREDIENTS_KV.delete(KEY_PREFIX + code);
  return json({ ok: true });
}
