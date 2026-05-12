# Le Carnet du Chef

Mini-app perso : tu renseignes les ingrédients que tu as chez toi, l'app les
classe automatiquement par catégorie, sauvegarde tout sur Cloudflare KV
(persiste entre appareils) et te propose 3 recettes générées par un chef
cuisinier-nutritionniste virtuel (Workers AI · Llama 3.3 70B).

```
recipes-app/
├── index.html          # UI
├── styles.css          # design (palette vert sauge / crème / cuivre)
├── app.js              # logique frontend
├── _headers            # cache headers
├── wrangler.toml       # config Cloudflare Pages
└── functions/
    └── api/
        ├── ingredients.js   # GET/POST/DELETE → KV
        └── recipes.js       # POST → Workers AI
```

## Déploiement sur Cloudflare Pages (une fois)

### 1. Installer wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Créer le namespace KV pour stocker les carnets

```bash
cd recipes-app
wrangler kv namespace create INGREDIENTS_KV
```

La commande affiche un `id`. Ouvre `wrangler.toml` et remplace
`REPLACE_WITH_KV_NAMESPACE_ID` par cet ID.

### 3. Premier déploiement

```bash
wrangler pages deploy . --project-name=carnet-du-chef
```

Wrangler te demande si tu veux créer un nouveau projet, dis oui. L'URL de prod
ressemble à `https://carnet-du-chef.pages.dev`.

### 4. Activer les bindings côté dashboard

Wrangler ne pousse pas toujours les bindings KV/AI pour Pages — fais-le une
fois dans le dashboard :

1. Cloudflare dashboard → **Workers & Pages** → `carnet-du-chef` →
   **Settings** → **Functions**.
2. Section **KV namespace bindings** → **Add binding** :
   - Variable name : `INGREDIENTS_KV`
   - KV namespace : sélectionner celui créé à l'étape 2.
3. Section **AI Bindings** → **Add binding** :
   - Variable name : `AI`
4. Save. Redéploie : `wrangler pages deploy . --project-name=carnet-du-chef`.

### 5. (Optionnel) Domaine custom

Dans **Custom domains** du projet Pages, branche un sous-domaine de ton choix.

## Déploiements suivants

Une seule commande depuis `recipes-app/` :

```bash
wrangler pages deploy . --project-name=carnet-du-chef
```

Ou, plus propre : connecte Cloudflare Pages au repo GitHub
(`miiloudinho-creator/bacha-coffee`) avec `recipes-app` comme
**root directory** et `.` comme **build output directory** — chaque push sur
`main` redéploie automatiquement.

## Utilisation

1. Ouvre l'URL Pages.
2. En haut à droite, entre un **code de carnet** (n'importe quoi, par ex.
   `marc-cuisine`) puis clique "Charger". Ce code te suit entre appareils :
   tape-le sur ton téléphone pour retrouver ton carnet.
3. Ajoute tes ingrédients dans le formulaire (la quantité est optionnelle).
   Ils sont rangés automatiquement par catégorie : légumes, viandes, féculents,
   herbes, etc.
4. Choisis le type de repas, le régime et le temps dispo.
5. **Générer mes recettes** → le chef propose 3 recettes en JSON structuré
   avec étapes, valeurs nutritionnelles, et un conseil santé personnalisé.

## Coûts

- **Workers AI** : gratuit dans la limite des [Neurons gratuits](https://developers.cloudflare.com/workers-ai/platform/pricing/)
  (~10 000 requêtes/jour à l'échelle perso, largement suffisant).
- **KV** : 100 000 reads + 1 000 writes par jour gratuits.
- **Pages** : illimité côté static + 100 000 invocations Functions / jour
  gratuites.

Pour un usage perso ça reste à **0 €/mois**.

## Personnalisation rapide

- **Changer le modèle d'IA** : `functions/api/recipes.js`, constante `MODEL`.
  Listes disponibles : <https://developers.cloudflare.com/workers-ai/models/>.
- **Changer le ton du chef** : éditer `systemMessage` dans `buildPrompt()`.
- **Ajouter des ingrédients connus** au classement auto : `INGREDIENT_MAP`
  dans `app.js`.

## Sécurité

Le "code de carnet" n'est PAS un mot de passe — quelqu'un qui devine ton code
peut lire/modifier ta liste d'ingrédients. Pour un usage perso c'est OK ;
sinon, ajouter une vraie auth (Cloudflare Access ou un token Workers).
