[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Better Auth Paystack - Exemple de démarrage de TanStack

Un exemple complet illustrant le plugin `better-auth-paystack` avec TanStack Start, déployé sur Cloudflare Workers.

[**Démo en direct**](https://better-auth-paystack.gittech.workers.dev)

## Fonctionnalités démontrées

- [x] Connexion anonyme (à des fins de démonstration)
- [x] Paiement de l'abonnement Paystack (flux de redirection)
- [x] Vérification des transactions et suivi du statut
- [x] Gestion des abonnements (liste, annulation, restauration, portail de facturation)
- [x] Modifications planifiées du plan et mises à niveau immédiates pour les plans locaux
- [x] **Facturation de l'organisation** – Facturez les abonnements aux organisations plutôt qu'aux comptes personnels
- [x] **Abonnements au code de plan** - Utiliser les forfaits gérés par Paystack (`planCode`)
- [x] **Admin Plugin** - Capacités administratives natives Better Auth
- [x] Configuration du plan dynamique via `/paystack/config`
- [x] Métadonnées SEO au niveau de l'itinéraire, plan du site et robots.txt

## Pile technologique

- **Framework** : [Démarrage TanStack](https://tanstack.com/start)
- **Auth** : [Meilleure authentification](https://www.better-auth.com/)
- **Paiements** : [Paystack](https://paystack.com/) via `better-auth-paystack`
- **UI** : React + [Shadcn UI](https://ui.shadcn.com/) + Tailwind CSS
- **Déploiement** : Cloudflare Workers

## Pour commencer

### 1. Installer les dépendances

```bash
pnpm install
```

### 2. Configurer l'environnement

Créez un fichier `.dev.vars` :

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
VITE_BETTER_AUTH_URL=http://localhost:3000
```

### 3. Exécutez le serveur de développement

```bash
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### 4. Construire pour la production

```bash
pnpm build
```

### 5. Déployer sur Cloudflare Workers

```bash
pnpm deploy
```

## Structure du projet

```
src/
├── lib/
│   ├── auth.ts                 # Better Auth + Paystack plugin config
│   └── auth-client.ts          # Client-side auth with Paystack client
├── routes/
│   ├── __root.tsx              # Root layout
│   ├── index.tsx               # Landing page
│   ├── dashboard.tsx           # Protected dashboard
│   └── billing/
│       └── paystack/
│           └── callback.tsx    # Paystack redirect callback
└── components/
    └── dashboard/
        ├── DashboardContent.tsx   # Dashboard tabs container
        ├── PaymentManager.tsx     # Subscription & billing UI
        ├── TransactionsTable.tsx  # Transaction history
        └── OrganizationManager.tsx # Organization management
```

## Détails clés de la mise en œuvre

### Configuration du serveur (`src/lib/auth.ts`)

```ts
import { paystack } from "better-auth-paystack";
import { organization, admin } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    organization(),
    admin(),
    paystack({
      paystackClient,
      secretKey: env.PAYSTACK_SECRET_KEY,
      subscription: {
        enabled: true,
        allowedPaymentChannels: ["card"],
        plans: [
          // Paystack-managed plans (uses planCode)
          { name: "starter", planCode: "PLN_xxxxx" },
          { name: "pro", planCode: "PLN_yyyyy" },
          // Locally-defined plans
          {
            name: "team",
            amount: 2500000,
            currency: "NGN",
            interval: "monthly",
          },
        ],
        // Control who can bill to which organization
        authorizeReference: async ({ referenceId, user }) => {
          const membership = await db.query.member.findFirst({
            where: and(eq(member.organizationId, referenceId), eq(member.userId, user.id)),
          });
          return !!membership;
        },
      },
    }),
  ],
});
```

### Configuration client (`src/lib/auth-client.ts`)

```ts
import { paystackClient } from "better-auth-paystack/client";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  plugins: [paystackClient({ subscription: true }), organizationClient(), adminClient()],
});
```

### Facturation à une organisation

La facturation de l'organisation nécessite que l'utilisateur connecté soit propriétaire/administrateur de l'organisation, sauf si vous fournissez un rappel `subscription.authorizeReference` personnalisé sur le serveur.

```ts
// Initialize a subscription for an organization
const result = await authClient.paystack.initializeTransaction({
  plan: "team",
  callbackURL: `${window.location.origin}/billing/paystack/callback`,
  referenceId: "org_123", // Organization ID
});

if (result.data?.kind === "checkout") {
  window.location.href = result.data.url;
}
```

### Flux de serveur avancés

Certaines fonctionnalités du plugin sont intentionnellement côté serveur et ne sont pas déclenchées depuis l'interface utilisateur du tableau de bord. Dans l'exemple TanStack, voici les bonnes primitives à utiliser à partir des fonctions serveur, des tâches ou des routes d'administration :

```ts
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
} from "better-auth-paystack";

// Example: sync your Paystack catalog into Better Auth's local tables
await syncPaystackProducts(ctx, options);
await syncPaystackPlans(ctx, options);

// Example: charge a saved authorization for a recurring renewal
await chargeSubscriptionRenewal(ctx, options, {
  subscriptionId: "sub_123",
});
```

Ce que montre le tableau de bord :

- redirections de caisse pour les abonnements et les paiements uniques
- cartes d'abonnement compatibles avec les versions d'essai et messagerie de rappel
- messagerie utilisée à l'essai avant le début du paiement
- annuler/rétablir les flux
- portail de facturation / flux de gestion des liens
- changements de plan programmés
- mises à niveau immédiates pour les forfaits locaux utilisant `prorateAndCharge`
- Contrôles administratifs authentifiés pour la synchronisation fiable des plans/produits et les renouvellements locaux manuels

Ce qui reste la propriété du serveur :

- tâches de synchronisation du catalogue
- facturation de renouvellement récurrente
- Traitement des webhooks et hooks du cycle de vie des abonnements
- application de l'éligibilité aux essais et automatisation du démarrage des essais

## Variables d'environnement

| Variables              | Descriptif                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `PAYSTACK_SECRET_KEY`  | Clé API Paystack ; vérifie également les signatures des webhooks |
| `BETTER_AUTH_SECRET`   | Secret pour un meilleur cryptage de session d'authentification   |
| `BETTER_AUTH_URL`      | URL de base côté serveur                                         |
| `VITE_BETTER_AUTH_URL` | URL de base côté client                                          |

## En savoir plus

- [Meilleure documentation d'authentification](https://www.better-auth.com/docs)
- [Documentation de l'API Paystack](https://paystack.com/docs/api/)
- [better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- [Démarrage TanStack](https://tanstack.com/start)
