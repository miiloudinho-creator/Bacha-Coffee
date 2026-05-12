// Le Carnet du Chef — frontend
// Stockage : localStorage pour le code utilisateur + Cloudflare KV via /api/ingredients
// Recettes : Cloudflare Workers AI via /api/recipes

const CATEGORIES = {
  legumes: { label: "Légumes", icon: "🥬" },
  fruits: { label: "Fruits", icon: "🍎" },
  viandes: { label: "Viandes & volailles", icon: "🥩" },
  poissons: { label: "Poissons & fruits de mer", icon: "🐟" },
  laitiers: { label: "Produits laitiers", icon: "🥛" },
  oeufs: { label: "Œufs", icon: "🥚" },
  feculents: { label: "Féculents & céréales", icon: "🌾" },
  legumineuses: { label: "Légumineuses", icon: "🫘" },
  herbes: { label: "Herbes & épices", icon: "🌿" },
  huiles: { label: "Huiles & vinaigres", icon: "🫒" },
  condiments: { label: "Condiments & sauces", icon: "🥫" },
  noix: { label: "Noix & graines", icon: "🌰" },
  sucres: { label: "Sucrés & pâtisserie", icon: "🍯" },
  autres: { label: "Autres", icon: "🍽️" },
};

const CATEGORY_ORDER = [
  "legumes",
  "fruits",
  "viandes",
  "poissons",
  "laitiers",
  "oeufs",
  "feculents",
  "legumineuses",
  "herbes",
  "huiles",
  "condiments",
  "noix",
  "sucres",
  "autres",
];

// Dictionnaire de classement automatique. Couvre les ingrédients fréquents
// en cuisine française. Le matching est fait sur la racine normalisée
// (sans accents, en minuscules, sans pluriel évident).
const INGREDIENT_MAP = {
  legumes: [
    "tomate", "carotte", "courgette", "aubergine", "poivron", "oignon", "echalote",
    "ail", "poireau", "celeri", "navet", "radis", "betterave", "concombre", "salade",
    "laitue", "roquette", "epinard", "blette", "chou", "brocoli", "chou-fleur",
    "choufleur", "chou fleur", "fenouil", "artichaut", "asperge", "champignon",
    "cepe", "girolle", "endive", "mache", "courge", "potiron", "patate douce",
    "pomme de terre", "patate", "topinambour", "panais", "haricot vert", "petit pois",
    "feve", "mais", "piment", "gingembre", "cresson", "rutabaga", "okra", "edamame",
  ],
  fruits: [
    "pomme", "poire", "banane", "orange", "citron", "citron vert", "lime",
    "pamplemousse", "fraise", "framboise", "myrtille", "mure", "cassis", "raisin",
    "peche", "abricot", "nectarine", "prune", "cerise", "ananas", "mangue", "papaye",
    "kiwi", "melon", "pasteque", "figue", "datte", "grenade", "kaki", "litchi",
    "fruit de la passion", "avocat", "coco",
  ],
  viandes: [
    "boeuf", "veau", "porc", "agneau", "mouton", "poulet", "poularde", "dinde",
    "canard", "lapin", "pintade", "caille", "jambon", "lardon", "bacon", "saucisse",
    "merguez", "chorizo", "rosette", "saucisson", "pate", "rillettes", "magret",
    "foie", "rognon", "andouille", "boudin", "steak", "entrecote", "cote", "filet",
    "escalope", "cuisse", "supreme", "epaule",
  ],
  poissons: [
    "saumon", "thon", "cabillaud", "morue", "merlu", "lieu", "sardine", "anchois",
    "maquereau", "bar", "dorade", "sole", "turbot", "truite", "lotte", "rouget",
    "espadon", "crevette", "gambas", "langoustine", "homard", "crabe", "tourteau",
    "moule", "huitre", "coquille saint-jacques", "saint jacques", "encornet",
    "calamar", "calmar", "poulpe", "seiche", "hareng",
  ],
  laitiers: [
    "lait", "creme", "creme fraiche", "yaourt", "fromage blanc", "faisselle",
    "mascarpone", "ricotta", "mozzarella", "parmesan", "gruyere", "emmental",
    "comte", "beaufort", "cheddar", "feta", "chevre", "brebis", "roquefort",
    "bleu", "camembert", "brie", "reblochon", "fromage", "beurre", "ghee",
    "kefir", "skyr",
  ],
  oeufs: ["oeuf", "œuf", "blanc d'oeuf", "jaune d'oeuf"],
  feculents: [
    "riz", "pates", "spaghetti", "tagliatelle", "penne", "fusilli", "lasagne",
    "macaroni", "nouille", "ramen", "udon", "soba", "vermicelle", "couscous",
    "semoule", "boulgour", "quinoa", "epeautre", "orge", "avoine", "ble", "farine",
    "pain", "baguette", "tortilla", "wrap", "polenta", "sarrasin", "millet",
  ],
  legumineuses: [
    "lentille", "pois chiche", "haricot blanc", "haricot rouge", "haricot noir",
    "flageolet", "haricot azuki", "pois casse", "soja", "tofu", "tempeh", "seitan",
  ],
  herbes: [
    "basilic", "persil", "ciboulette", "menthe", "coriandre", "thym", "romarin",
    "laurier", "sauge", "estragon", "aneth", "origan", "marjolaine", "sarriette",
    "cerfeuil", "livèche", "lavande", "fleur de sel", "sel", "poivre", "paprika",
    "cumin", "curcuma", "curry", "cannelle", "muscade", "noix de muscade", "clou de girofle",
    "anis", "anis etoile", "badiane", "cardamome", "safran", "vanille", "piment d'espelette",
    "piment de cayenne", "ras el hanout", "garam masala", "herbes de provence",
  ],
  huiles: [
    "huile d'olive", "huile de tournesol", "huile de colza", "huile de sesame",
    "huile de noix", "huile de coco", "huile d'arachide", "huile",
    "vinaigre", "vinaigre balsamique", "vinaigre de cidre", "vinaigre de vin",
    "vinaigre de riz",
  ],
  condiments: [
    "moutarde", "mayonnaise", "ketchup", "sauce soja", "tamari", "sauce poisson",
    "nuoc mam", "sauce huitre", "sauce sriracha", "tabasco", "harissa",
    "cornichon", "capres", "olive", "tapenade", "pesto", "tomate concassee",
    "concentre de tomate", "passata", "bouillon", "fond de veau", "fond de volaille",
    "miso", "tahini", "houmous",
  ],
  noix: [
    "noix", "noisette", "amande", "pistache", "pignon", "noix de cajou", "cajou",
    "noix de pecan", "pecan", "noix du bresil", "graine de courge", "graine de tournesol",
    "graine de sesame", "sesame", "graine de chia", "chia", "graine de lin",
    "graine de pavot", "pavot",
  ],
  sucres: [
    "sucre", "sucre roux", "cassonade", "miel", "sirop d'erable", "sirop d'agave",
    "stevia", "chocolat", "cacao", "praline", "nutella", "confiture", "compote",
    "levure", "levure chimique", "bicarbonate", "agar-agar", "gelatine",
  ],
};

// Inversé pour lookup rapide (Map pour exact match)
const REVERSE_MAP = (() => {
  const map = new Map();
  for (const [cat, items] of Object.entries(INGREDIENT_MAP)) {
    for (const item of items) {
      map.set(normalize(item), cat);
    }
  }
  return map;
})();

// Liste triée par longueur décroissante pour le fallback "contient un mot connu"
// (sinon "lentilles corail" matche "ail" et atterrit dans légumes).
const REVERSE_SORTED = [...REVERSE_MAP.entries()].sort(
  (a, b) => b[0].length - a[0].length,
);

function normalize(s) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’]/g, " ")
    .replace(/\s+/g, " ");
}

function categorize(name) {
  const n = normalize(name);
  if (REVERSE_MAP.has(n)) return REVERSE_MAP.get(n);
  // dépluralisation grossière
  const singular = n.endsWith("s") ? n.slice(0, -1) : n;
  if (REVERSE_MAP.has(singular)) return REVERSE_MAP.get(singular);

  // Fallback : on cherche un mot connu, en s'assurant qu'il apparaît sur une
  // frontière de mot ("lentille" dans "lentilles corail" ✅, "ail" dans
  // "corail" ❌). On prend la clé la plus longue pour éviter les faux positifs.
  const tokens = new Set([
    ...n.split(/[\s\-]+/).filter(Boolean),
    ...singular.split(/[\s\-]+/).filter(Boolean),
  ]);
  for (const [key, cat] of REVERSE_SORTED) {
    // mot composé connu : "huile d'olive" → on regarde la chaîne complète
    if (key.includes(" ") && (n.includes(key) || singular.includes(key))) return cat;
    // mot simple : on exige une correspondance de token complet ou de racine
    if (!key.includes(" ")) {
      for (const t of tokens) {
        if (t === key) return cat;
        // racine : "tomates" → "tomate", "framboises" → "framboise"
        if (t.startsWith(key) && t.length - key.length <= 2) return cat;
      }
    }
  }
  return "autres";
}

// --- État applicatif ---
const state = {
  userCode: "",
  ingredients: [], // [{ name, quantity, category }]
  saveTimer: null,
};

const els = {
  userCode: document.getElementById("user-code"),
  userSave: document.getElementById("user-save"),
  addForm: document.getElementById("add-form"),
  ingredientInput: document.getElementById("ingredient-input"),
  quantityInput: document.getElementById("quantity-input"),
  addFeedback: document.getElementById("add-feedback"),
  pantry: document.getElementById("pantry"),
  pantryCount: document.getElementById("pantry-count"),
  clearAll: document.getElementById("clear-all"),
  mealType: document.getElementById("meal-type"),
  diet: document.getElementById("diet"),
  timeBudget: document.getElementById("time-budget"),
  generate: document.getElementById("generate"),
  generateFeedback: document.getElementById("generate-feedback"),
  recipesSection: document.getElementById("recipes-section"),
  recipes: document.getElementById("recipes"),
};

// --- Code utilisateur ---
function loadUserCode() {
  const stored = localStorage.getItem("carnet-user-code") || "";
  state.userCode = stored;
  els.userCode.value = stored;
}

async function setUserCode(code) {
  const clean = code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 60);
  if (!clean) {
    setFeedback(els.addFeedback, "Entrez un code (ex : marc-cuisine) pour créer votre carnet.", "error");
    return;
  }
  state.userCode = clean;
  els.userCode.value = clean;
  localStorage.setItem("carnet-user-code", clean);
  await loadIngredients();
}

// --- API ingredients ---
async function loadIngredients() {
  if (!state.userCode) {
    state.ingredients = [];
    renderPantry();
    return;
  }
  try {
    const res = await fetch(`/api/ingredients?code=${encodeURIComponent(state.userCode)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
    renderPantry();
    setFeedback(els.addFeedback, `Carnet "${state.userCode}" chargé · ${state.ingredients.length} ingrédient(s).`, "success");
  } catch (err) {
    console.error(err);
    setFeedback(els.addFeedback, "Impossible de charger le carnet. Le mode hors-ligne local est utilisé.", "error");
    const cached = localStorage.getItem(`carnet-cache-${state.userCode}`);
    state.ingredients = cached ? JSON.parse(cached) : [];
    renderPantry();
  }
}

function saveIngredientsDebounced() {
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveIngredients, 600);
  // cache local immédiat
  if (state.userCode) {
    localStorage.setItem(`carnet-cache-${state.userCode}`, JSON.stringify(state.ingredients));
  }
}

async function saveIngredients() {
  if (!state.userCode) return;
  try {
    const res = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: state.userCode, ingredients: state.ingredients }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error("Save failed", err);
  }
}

// --- Mutations ---
function addIngredient(name, quantity) {
  const clean = name.trim();
  if (!clean) return;
  const category = categorize(clean);
  // doublon ?
  const existing = state.ingredients.find((i) => normalize(i.name) === normalize(clean));
  if (existing) {
    if (quantity) existing.quantity = quantity;
    setFeedback(els.addFeedback, `"${clean}" est déjà dans le carnet — quantité mise à jour.`, "success");
  } else {
    state.ingredients.push({ name: clean, quantity: quantity.trim(), category });
    setFeedback(
      els.addFeedback,
      `Ajouté à "${CATEGORIES[category].label}" ${CATEGORIES[category].icon}`,
      "success",
    );
  }
  state.ingredients.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  renderPantry();
  saveIngredientsDebounced();
}

function removeIngredient(name) {
  state.ingredients = state.ingredients.filter((i) => i.name !== name);
  renderPantry();
  saveIngredientsDebounced();
}

function clearAllIngredients() {
  if (!state.ingredients.length) return;
  if (!confirm("Vider tout le garde-manger ?")) return;
  state.ingredients = [];
  renderPantry();
  saveIngredientsDebounced();
}

// --- Render ---
function renderPantry() {
  els.pantryCount.textContent = `${state.ingredients.length} ingrédient${state.ingredients.length > 1 ? "s" : ""}`;
  if (!state.ingredients.length) {
    els.pantry.innerHTML = `<div class="pantry-empty">Votre garde-manger est vide. Ajoutez ce que vous avez dans votre cuisine ci-dessus.</div>`;
    return;
  }
  const grouped = {};
  for (const ing of state.ingredients) {
    if (!grouped[ing.category]) grouped[ing.category] = [];
    grouped[ing.category].push(ing);
  }
  els.pantry.innerHTML = CATEGORY_ORDER.filter((c) => grouped[c]?.length)
    .map((cat) => {
      const meta = CATEGORIES[cat];
      const chips = grouped[cat]
        .map(
          (ing) => `
            <span class="chip">
              <span>${escapeHtml(ing.name)}</span>
              ${ing.quantity ? `<span class="qty">· ${escapeHtml(ing.quantity)}</span>` : ""}
              <button type="button" class="chip-remove" data-name="${escapeHtml(ing.name)}" aria-label="Retirer ${escapeHtml(ing.name)}">×</button>
            </span>`,
        )
        .join("");
      return `
        <div class="category">
          <div class="category-title">${meta.icon} ${meta.label}</div>
          <div class="chips">${chips}</div>
        </div>`;
    })
    .join("");
}

// --- Génération de recettes ---
async function generateRecipes() {
  if (!state.ingredients.length) {
    setFeedback(els.generateFeedback, "Ajoutez d'abord quelques ingrédients à votre carnet.", "error");
    return;
  }
  els.generate.disabled = true;
  setFeedback(els.generateFeedback, "Le chef réfléchit à vos recettes…", "loading");
  els.recipesSection.hidden = true;
  els.recipes.innerHTML = "";

  try {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        mealType: els.mealType.value,
        diet: els.diet.value,
        timeBudget: els.timeBudget.value,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.recipes || !Array.isArray(data.recipes) || !data.recipes.length) {
      throw new Error("Le chef n'a pas pu proposer de recette cette fois-ci.");
    }
    renderRecipes(data.recipes);
    setFeedback(els.generateFeedback, `${data.recipes.length} recette(s) proposée(s) par le chef.`, "success");
    els.recipesSection.hidden = false;
    els.recipesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setFeedback(els.generateFeedback, `Désolé, erreur lors de la génération : ${err.message}`, "error");
  } finally {
    els.generate.disabled = false;
  }
}

function renderRecipes(recipes) {
  const pantryNames = new Set(state.ingredients.map((i) => normalize(i.name)));
  els.recipes.innerHTML = recipes
    .map((r) => {
      const meta = [
        r.tempsPreparation && `<span class="meta-pill">⏱ <strong>Prép</strong> ${escapeHtml(r.tempsPreparation)}</span>`,
        r.tempsCuisson && `<span class="meta-pill">🔥 <strong>Cuisson</strong> ${escapeHtml(r.tempsCuisson)}</span>`,
        r.difficulte && `<span class="meta-pill">🎯 <strong>Difficulté</strong> ${escapeHtml(r.difficulte)}</span>`,
        r.portions && `<span class="meta-pill">🍽 <strong>Portions</strong> ${escapeHtml(String(r.portions))}</span>`,
      ]
        .filter(Boolean)
        .join("");

      const ingredients = (r.ingredients || [])
        .map((ing) => {
          const text = typeof ing === "string" ? ing : ing.nom || "";
          const inPantry = matchInPantry(text, pantryNames);
          return `<li class="${inPantry ? "" : "missing"}">${escapeHtml(text)}</li>`;
        })
        .join("");

      const etapes = (r.etapes || [])
        .map((e) => `<li>${escapeHtml(e)}</li>`)
        .join("");

      const nutri = r.valeursNutritionnelles || {};
      const nutriCells = [
        ["Calories", nutri.calories],
        ["Protéines", nutri.proteines],
        ["Glucides", nutri.glucides],
        ["Lipides", nutri.lipides],
        ["Fibres", nutri.fibres],
      ]
        .filter(([, v]) => v)
        .map(
          ([label, v]) => `
          <div class="nutri-cell">
            <span class="nutri-label">${label}</span>
            <span class="nutri-value">${escapeHtml(String(v))}</span>
          </div>`,
        )
        .join("");

      return `
        <article class="recipe">
          <div class="recipe-head">
            <h3>${escapeHtml(r.nom || "Recette")}</h3>
            <div class="recipe-meta">${meta}</div>
          </div>
          <div class="recipe-body">
            <div class="recipe-section">
              <h4>Ingrédients</h4>
              <ul>${ingredients}</ul>
            </div>
            <div class="recipe-section">
              <h4>Étapes</h4>
              <ol>${etapes}</ol>
            </div>
            ${nutriCells ? `<div class="recipe-section full">
              <h4>Valeurs nutritionnelles (par portion)</h4>
              <div class="nutri-grid">${nutriCells}</div>
            </div>` : ""}
            ${r.conseilNutritionniste ? `<div class="recipe-section full">
              <div class="chef-note">${escapeHtml(r.conseilNutritionniste)}</div>
            </div>` : ""}
          </div>
        </article>`;
    })
    .join("");
}

function matchInPantry(ingredientText, pantryNames) {
  const norm = normalize(ingredientText);
  for (const p of pantryNames) {
    if (norm.includes(p) || p.includes(norm)) return true;
  }
  return false;
}

// --- Utils ---
function setFeedback(el, msg, kind) {
  el.textContent = msg;
  el.className = `feedback ${kind || ""}`.trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Wire up ---
els.userSave.addEventListener("click", () => setUserCode(els.userCode.value));
els.userCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") setUserCode(els.userCode.value);
});

els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!state.userCode) {
    setFeedback(els.addFeedback, "Entrez d'abord un code de carnet en haut à droite.", "error");
    els.userCode.focus();
    return;
  }
  addIngredient(els.ingredientInput.value, els.quantityInput.value);
  els.ingredientInput.value = "";
  els.quantityInput.value = "";
  els.ingredientInput.focus();
});

els.pantry.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip-remove");
  if (!btn) return;
  removeIngredient(btn.dataset.name);
});

els.clearAll.addEventListener("click", clearAllIngredients);
els.generate.addEventListener("click", generateRecipes);

// --- Boot ---
loadUserCode();
if (state.userCode) {
  loadIngredients();
} else {
  renderPantry();
  setFeedback(els.addFeedback, "Bienvenue 👋 Créez votre carnet en entrant un code en haut à droite (ex : marc-cuisine).", "");
}
