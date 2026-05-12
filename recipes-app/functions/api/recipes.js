// POST /api/recipes
// body : { ingredients: [{name, quantity, category}], mealType, diet, timeBudget }
// renvoie : { recipes: [...] }
//
// Bindings attendus (Cloudflare Pages > Settings > Functions > AI binding) :
//   AI  -> Workers AI binding

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const MEAL_LABELS = {
  auto: "au choix du chef (entrée, plat ou dessert selon ce qui s'accorde le mieux)",
  "petit-dejeuner": "petit-déjeuner équilibré",
  dejeuner: "déjeuner complet",
  diner: "dîner",
  snack: "en-cas / collation",
  dessert: "dessert",
};

const DIET_LABELS = {
  aucun: "aucune restriction particulière",
  vegetarien: "végétarien (sans viande ni poisson)",
  vegan: "végétalien (aucun produit animal, ni œuf ni lait)",
  "sans-gluten": "sans gluten",
  "sans-lactose": "sans lactose",
  leger: "léger, faible en calories",
  proteine: "riche en protéines",
};

const TIME_LABELS = {
  rapide: "moins de 20 minutes au total",
  moyen: "moins de 45 minutes au total",
  long: "sans contrainte de temps",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildPrompt({ ingredients, mealType, diet, timeBudget }) {
  const list = ingredients
    .map((i) => (i.quantity ? `- ${i.name} (${i.quantity})` : `- ${i.name}`))
    .join("\n");

  const systemMessage = `Tu es un chef cuisinier de renommée mondiale avec 30 ans d'expérience, également nutritionniste certifié. Tu maîtrises la cuisine française classique, la gastronomie méditerranéenne, les cuisines d'Asie et la cuisine fusion moderne. Tu connais parfaitement les équilibres en macro et micro-nutriments. Tu réponds TOUJOURS en français avec un ton chaleureux, précis et inspirant. Tes recettes sont savoureuses, équilibrées et réalisables à la maison.

Tu dois proposer EXACTEMENT 3 recettes différentes en t'appuyant en priorité sur les ingrédients fournis. Tu peux suggérer au maximum 3 ingrédients supplémentaires courants (sel, poivre, huile, eau, ail, oignon, herbes basiques) par recette s'ils manquent — marque-les comme "supplémentaires".

RÉPONDS UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans bloc markdown \`\`\`. Le format exact est :

{
  "recipes": [
    {
      "nom": "Nom évocateur de la recette",
      "tempsPreparation": "15 min",
      "tempsCuisson": "20 min",
      "difficulte": "Facile" | "Moyen" | "Difficile",
      "portions": 2,
      "ingredients": ["200 g de riz", "1 oignon", "2 œufs", "sel"],
      "etapes": ["Étape 1 détaillée…", "Étape 2…", "Étape 3…"],
      "valeursNutritionnelles": {
        "calories": "420 kcal",
        "proteines": "18 g",
        "glucides": "55 g",
        "lipides": "12 g",
        "fibres": "6 g"
      },
      "conseilNutritionniste": "Une phrase de conseil santé liée à la recette."
    }
  ]
}`;

  const userMessage = `Voici ce que j'ai dans ma cuisine :

${list}

Contraintes :
- Type de repas : ${MEAL_LABELS[mealType] || MEAL_LABELS.auto}
- Régime / contrainte alimentaire : ${DIET_LABELS[diet] || DIET_LABELS.aucun}
- Temps disponible : ${TIME_LABELS[timeBudget] || TIME_LABELS.moyen}

Propose-moi 3 recettes différentes et inspirantes. Privilégie celles qui utilisent un maximum de mes ingrédients. Réponds uniquement avec le JSON demandé.`;

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
}

function extractJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  // retire d'éventuels blocs markdown
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // garde uniquement de la première { à la dernière }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // tentative : remplacer les virgules traînantes
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

async function runAI(env, model, messages) {
  return env.AI.run(model, {
    messages,
    temperature: 0.7,
    max_tokens: 2400,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return json(
      { error: "Workers AI n'est pas configuré (binding AI manquant)." },
      500,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!ingredients.length) {
    return json({ error: "Aucun ingrédient fourni." }, 400);
  }

  const messages = buildPrompt({
    ingredients: ingredients.slice(0, 200),
    mealType: body.mealType,
    diet: body.diet,
    timeBudget: body.timeBudget,
  });

  let response;
  let modelUsed = MODEL;
  try {
    response = await runAI(env, MODEL, messages);
  } catch (err) {
    console.error("Primary model failed:", err);
    try {
      response = await runAI(env, FALLBACK_MODEL, messages);
      modelUsed = FALLBACK_MODEL;
    } catch (err2) {
      console.error("Fallback model failed:", err2);
      return json({ error: `Workers AI erreur : ${err2.message || err2}` }, 502);
    }
  }

  // Workers AI renvoie { response: "..." } pour les modèles de chat
  const text =
    typeof response === "string"
      ? response
      : response?.response ||
        response?.result?.response ||
        response?.choices?.[0]?.message?.content ||
        "";

  const parsed = extractJSON(text);
  if (!parsed || !Array.isArray(parsed.recipes) || !parsed.recipes.length) {
    return json(
      {
        error: "Le modèle n'a pas renvoyé un JSON exploitable.",
        debug: { modelUsed, preview: String(text).slice(0, 500) },
      },
      502,
    );
  }

  return json({ recipes: parsed.recipes, modelUsed });
}
