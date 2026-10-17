[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Meilleur plugin d'authentification Paystack

Un plugin TypeScript first qui intègre Paystack dans [Better Auth](https://www.better-auth.com), fournissant un système de facturation prêt pour la production avec prise en charge des abonnements (natifs et locaux), des paiements uniques, des essais, de la facturation de l'organisation et des webhooks sécurisés.

<div align="center">

![npm downloads](https://img.shields.io/npm/dm/better-auth-paystack.svg)
[![GitHub stars](https://img.shields.io/github/stars/alexasomba/better-auth-paystack.svg?style=social&label=Star)](https://github.com/alexasomba/better-auth-paystack/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/alexasomba/better-auth-paystack)](https://github.com/alexasomba/better-auth-paystack/releases)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/better-auth-paystack)](https://bundlephobia.com/result?p=better-auth-paystack)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexasomba?style=social)](https://twitter.com/alexasomba)
![GitHub License](https://img.shields.io/github/license/alexasomba/better-auth-paystack)

</div>

[**Démo en direct (démarrage Tanstack)**](https://better-auth-paystack.gittech.workers.dev) | [**Code source**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## Compétences des agents IA

Ce package publie les compétences des agents afin que les agents de codage d'IA puissent charger des conseils spécifiques au package pour la configuration, les abonnements, la facturation de l'organisation, l'intégration de TanStack Start, les API client, les webhooks, le cycle de vie des abonnements locaux, les modifications de schéma et les tests.

Utilisez [TanStack Intent](https://www.npmjs.com/package/@tanstack/intent) lorsque vous souhaitez répertorier ou charger explicitement des compétences individuelles :

```bash
npx @tanstack/intent@latest list
npx @tanstack/intent@latest load better-auth-paystack#better-auth-paystack-setup
npx @tanstack/intent@latest load better-auth-paystack#paystack-testing-fixtures
```

Si vous utilisez un agent AI, exécutez `npx @tanstack/intent@latest install` dans votre projet afin que l'agent sache comment découvrir les compétences du package.

Ce package fournit également des compétences dans le package npm sous `skills/*/SKILL.md`, afin que les projets puissent utiliser [skills-npm](https://www.npmjs.com/package/skills-npm) pour créer un lien symbolique entre les compétences du package installé pour les agents compatibles :

```bash
npm install better-auth-paystack
npx skills-npm --yes
```

Pour ce référentiel, les responsables peuvent exécuter `pnpm run skills:dry-run` pour prévisualiser la découverte via l'exemple d'appareil TanStack ou `pnpm run skills:install` pour créer des liens symboliques de compétences d'agent local à partir de cet appareil.

## Fonctionnalités

- [x] **Modèles de facturation** : prise en charge des forfaits natifs Paystack, des abonnements gérés localement et des paiements uniques (produits/montants).
- [x] **Création automatique de client** : création facultative de client Paystack lors de l'inscription de l'utilisateur ou de la création de l'organisation.
- [x] **Gestion des essais** : périodes d'essai configurables avec logique intégrée de prévention des abus.
- [x] **Facturation de l'organisation** : associez les abonnements aux organisations et autorisez l'accès via des rôles.
- [x] **Contrôles des canaux d'abonnement** : restreindre le paiement des abonnements à des canaux de paiement Paystack spécifiques, tels que les cartes uniquement.
- [x] **Limites et sièges appliqués** : application automatique des surclassements de sièges des membres et des limites de ressources (équipes).
- [x] **Modifications programmées** : reporter les mises à jour ou les annulations d'abonnement à la fin du cycle de facturation.
- [x] **Prorata** : mises à niveau immédiates au prorata à mi-cycle pour les forfaits locaux, en utilisant les frais de carte enregistrés lorsque cela est possible et en passant à la caisse lorsqu'un paiement interactif est requis.
- [x] **Popup Modal Flow** : prise en charge facultative de l'expérience de paiement en ligne de Paystack via `@alexasomba/paystack-inline`.
- [x] **Webhook Security** : vérification de signature préconfigurée (HMAC-SHA512) et liste blanche IP en option.
- [x] **Historique des transactions** : prise en charge intégrée pour la liste et l'affichage des enregistrements de transactions locales.

---

## Démarrage rapide

### Prérequis

- **Node.js** : `v22.0.0` ou supérieur.
- **Meilleure authentification** : `v1.6.9` ou supérieur.

### 1. Installer le plugin et les SDK

```bash
npm install better-auth better-auth-paystack @alexasomba/paystack-node
```

#### Migration à partir du package étendu

Remplacez la dépendance délimitée par le package non délimité :

```bash
npm uninstall @alexasomba/better-auth-paystack
npm install better-auth-paystack
```

Mettez ensuite à jour les importations de `@alexasomba/better-auth-paystack` vers `better-auth-paystack` et depuis
`@alexasomba/better-auth-paystack/client` à `better-auth-paystack/client`.

Il s'agit d'une migration de nom de package. La version v4 déplace également les données de facturation Paystack vers
tables appartenant au fournisseur. Les noms de routes client existants restent compatibles, mais une migration de base de données
et l'opération de migration approuvée décrite ci-dessous sont requises.

#### Facultatif : SDK du navigateur (pour les modaux contextuels)

```bash
npm install @alexasomba/paystack-inline
```

### 2. Configurer les variables d'environnement

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
```

### 3. Configurer le plugin du serveur

```ts title="auth.ts"
import { createPaystack } from "@alexasomba/paystack-node";
import { betterAuth } from "better-auth";
import { paystack } from "better-auth-paystack";
import { admin } from "better-auth/plugins";

const paystackClient = createPaystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const auth = betterAuth({
  plugins: [
    admin(),
    paystack({
      paystackClient,
      secretKey: process.env.PAYSTACK_SECRET_KEY!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        allowedPaymentChannels: ["card"], // Optional: enforce card-only subscriptions
        plans: [
          {
            name: "pro",
            group: "workspace", // Optional: one active/trialing subscription per group
            planCode: "PLN_pro_123", // Native: Managed by Paystack
            freeTrial: { days: 14 },
            limits: { teams: 5, seats: 10 }, // Custom resource & member limits
          },
          {
            name: "starter",
            amount: 50000, // Local: Managed by your app (500 NGN)
            currency: "NGN",
            interval: "monthly",
          },
        ],
      },
      products: {
        products: [{ name: "credits_50", amount: 200000, currency: "NGN" }],
      },
    }),
  ],
});
```

Paystack signe les charges utiles du webhook avec le même `PAYSTACK_SECRET_KEY` utilisé pour l'authentification API ;
il n’y a pas de secret de webhook distinct. Options anciennes `webhook.secret` et `paystackWebhookSecret`
sont acceptés pour la compatibilité des sources mais ignorés.

### 4. Configurer le plugin client

```ts title="client.ts"
import { paystackClient } from "better-auth-paystack/client";
import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const client = createAuthClient({
  plugins: [adminClient(), paystackClient({ subscription: true })],
});
```

### 5. Migrer le schéma de base de données

```bash
npx better-auth migrate
```

---

## Guide de migration

La version `2.0.0` contient une modification radicale axée sur la sécurité.

- Suppression des actions de l'opérateur public/client :
- `authClient.paystack.syncProducts()`
- `authClient.paystack.syncPlans()`
- `authClient.paystack.chargeRecurringSubscription(...)`
- Suppression des points de terminaison publics Better Auth pour :
- `/paystack/sync-products`
- `/paystack/sync-plans`
- `/paystack/charge-recurring`
- Ajout d'opérations de serveur de confiance :
- `chargeSubscriptionRenewal`
- `syncPaystackProducts`
- `syncPaystackPlans`

### Vieux

```ts
await authClient.paystack.syncProducts();
await authClient.paystack.syncPlans();
await authClient.paystack.chargeRecurringSubscription({
  subscriptionId: "sub_123",
});
```

### Nouveau

```ts
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
  type ChargeRecurringSubscriptionResult,
  type PaystackSyncResult,
} from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;
const paystackOptions = {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  paystackClient,
};

await syncPaystackProducts(ctx, paystackOptions);
await syncPaystackPlans(ctx, paystackOptions);
await chargeSubscriptionRenewal(ctx, paystackOptions, {
  subscriptionId: "sub_123",
});
```

Ces opérations sont intentionnellement réservées au serveur. Ne les exposez pas via des appels de client d’authentification déclenchés par le navigateur.

---

## Modèles de facturation

### 1. Abonnements

#### Natif (recommandé)

Utilisez `planCode` à partir de votre tableau de bord Paystack. Paystack gère la logique récurrente et les e-mails.

```ts
{ name: "pro", planCode: "PLN_xxx" }
```

#### Local

Utilisez `amount` et `interval`. Le plugin stocke le statut localement, vous permettant de gérer une logique récurrente personnalisée ou des « périodes d'accès » ponctuelles.

```ts
{ name: "starter", amount: 50000, interval: "monthly" }
```

### 2. Paiements uniques

#### Produits fixes

Définissez des produits préconfigurés dans les paramètres de votre serveur et achetez-les par leur nom.

```ts
await authClient.paystack.transaction.initialize({
  product: "credits_50",
});
```

#### Montants ponctuels

Facturez des montants dynamiques pour les recharges, les pourboires ou les factures personnalisées.

```ts
await authClient.paystack.transaction.initialize({
  amount: 100000, // 1000 NGN
  currency: "NGN",
  metadata: { type: "donation" },
});
```

---

## Limites et gestion des sièges

Le plugin applique automatiquement les limites aux abonnements actifs et d’essai. Lorsque plusieurs
les groupes d'abonnement définissent la même limite numérique, la valeur la plus élevée l'emporte ; les caractéristiques du forfait sont
combinés.

### Limites de sièges pour les membres

Les sièges achetés sont stockés dans le champ `subscription.seats`. Le plugin se connecte à `member.create` et `invitation.create` pour bloquer les ajouts une fois la limite atteinte.

### Limites des ressources (par exemple, équipes)

Définissez des limites dans la configuration de votre plan, et elles seront vérifiées lors de la création des ressources :

```ts
plans: [{ name: "pro", limits: { teams: 5, seats: 10 } }];
```

Le plugin vérifie nativement la limite `teams` si vous utilisez le plugin Better Auth Organization.

### Groupes d'abonnement

Définissez `group` sur les forfaits associés lorsqu'un utilisateur ou une organisation peut posséder des abonnements indépendants :

```ts
plans: [
  { name: "pro", group: "workspace", planCode: "PLN_pro" },
  { name: "priority-support", group: "support", planCode: "PLN_support" },
];
```

Les noms de groupes sont tronqués et en minuscules. Une référence peut avoir un abonnement actif ou d'essai
par groupe. Les forfaits sans `group` restent dans l'ancien groupe par défaut, représenté par un nullable
`subscription.groupId`, afin que les configurations existantes conservent leur précédent abonnement unique
comportement.

---

## Prise en charge des devises

Le plugin prend en charge les devises suivantes avec validation automatique du montant minimum de transaction :

| Monnaie | Nom                      | Montant minimum |
| ------- | ------------------------ | --------------- |
| **NGN** | Naira nigérian           | 50,00 ₦         |
| **SGH** | Cédi ghanéen             | ₵0,10           |
| **ZAR** | Rand sud-africain        | R1.00           |
| **KES** | Shilling kenyan          | 3,00 KSh        |
| **USD** | Dollar américain         | 2,00 $          |
| **XOF** | Franc CFA ouest-africain | 100 FCFA        |

Les transactions inférieures à ces seuils seront rejetées avec une erreur `BAD_REQUEST`.

## Utilisation avancée

### Facturation de l'organisation

Activez `organization.enabled` pour facturer les organisations plutôt que les utilisateurs.

- **Client automatique** : les organisations obtiennent leur propre enregistrement `paystackCustomer` appartenant au fournisseur.
- **Autorisation** : les propriétaires et administrateurs de l'organisation peuvent gérer la facturation par défaut. Utilisez `organization.billingRoles` pour étendre la liste des rôles de confiance, ou `subscription.authorizeReference` lorsque vous avez besoin d'une autorisation entièrement personnalisée.

```ts
paystack({
  subscription: {
    enabled: true,
    plans: [],
  },
  organization: {
    enabled: true,
    billingRoles: ["owner", "admin", "billing"],
  },
});
```

### Modal contextuel en ligne

Utilisez `@alexasomba/paystack-inline` pour une interface utilisateur transparente.

```ts
const { data } = await authClient.subscription.upgrade({ plan: "pro" });
if (data?.kind === "checkout") {
  const paystack = createPaystack({ publicKey: "pk_test_..." });
  paystack.checkout({
    accessCode: data.accessCode,
    onSuccess: (res) => authClient.paystack.transaction.verify({ reference: res.reference }),
  });
}
```

### Modifications et annulations programmées

Reportez les modifications à la fin du cycle de facturation en cours :

- **Mises à niveau** : passez `scheduleAtPeriodEnd: true` dans `initializeTransaction()`.
- **Annulations** : utilisez `authClient.subscription.cancel({ subscriptionCode, atPeriodEnd: true })` pour maintenir l'abonnement actif jusqu'à la fin de la période.

### Prorata de mi-cycle (`prorateAndCharge`)

Le plugin peut calculer dynamiquement la différence de coût pour les mises à niveau immédiates à mi-cycle (comme l'ajout de sièges supplémentaires).
Pour les forfaits gérés localement :

- Si l'abonnement dispose déjà d'un code d'autorisation Paystack réutilisable, le plugin facture le delta hors session au prorata, enregistre un `paystackTransaction` local et met immédiatement à jour l'abonnement.
- S'il n'y a pas de code d'autorisation réutilisable disponible (par exemple, paiements basés sur un transfert), le plugin initialise une nouvelle caisse pour le delta au prorata au lieu de procéder à une mise à niveau silencieuse sans paiement.
- Si le montant au prorata est inférieur aux frais minimum de Paystack pour la devise, la demande est rejetée afin que vous puissiez planifier le changement pour la fin de la période au lieu de sous-facturer.

```ts
const { data } = await authClient.paystack.transaction.initialize({
  plan: "pro",
  quantity: 5, // Upgrading seats
  prorateAndCharge: true, // Charges saved authorization or returns a checkout redirect for the delta
});

if (data?.kind === "checkout") {
  window.location.href = data.url;
}

if (data?.kind === "prorated") {
  console.log(data.message);
}
```

Lorsque le flux revient à la caisse, vérifiez la référence de la transaction renvoyée après le paiement. Le plugin utilise les métadonnées de prorata stockées pour appliquer le changement de plan/siège en attente uniquement après une vérification réussie.

### Restreindre les canaux de paiement des abonnements

Utilisez `subscription.allowedPaymentChannels` pour limiter les canaux de paiement Paystack qui peuvent être utilisés pour les flux d'abonnement.
Cela s’applique au paiement d’abonnement standard, aux flux d’autorisation d’essai et aux solutions de secours interactives de paiement au prorata.

```ts
paystack({
  subscription: {
    enabled: true,
    allowedPaymentChannels: ["card"],
    plans: [{ name: "starter", amount: 50000, currency: "NGN", interval: "monthly" }],
  },
});
```

Si le paiement d'un abonnement est ensuite vérifié avec un canal non autorisé, le plugin rejette l'activation au lieu de créer silencieusement l'abonnement.

### Sécurité des webhooks

Les diffusions Webhook sont conservées dans la table `paystackWebhookEvent` spécifique au fournisseur à l'aide d'un
hachage stable de la charge utile brute vérifiée. Les livraisons en double déjà traitées sont
reconnu sans exécuter à nouveau les effets secondaires de facturation. Les livraisons échouées ou interrompues restent
en attente d'une réconciliation ultérieure ou d'un traitement de relecture.

Le plugin vérifie automatiquement l'en-tête `x-paystack-signature` pour garantir l'authenticité des événements. Pour une couche de sécurité supplémentaire, vous pouvez activer la **liste blanche IP** pour limiter le traitement aux serveurs officiels de Paystack.

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  webhook: {
    verifyIP: true, // Enable IP whitelisting (defaults to false for flexible proxy support)
    trustedIPs: ["52.31.139.75", "52.49.173.169", "52.214.14.220"], // Optional: override trusted IPs
  },
});
```

Les signatures Webhook sont toujours vérifiées avec `secretKey`, comme l'exige Paystack. Ne créez pas ou
configurer un `PAYSTACK_WEBHOOK_SECRET` distinct.

### Prévention des abus lors des procès

Le plugin vérifie l'historique `referenceId`. Si un essai a déjà été utilisé (actif, expiré ou en cours d'essai), il ne sera plus accordé, empêchant ainsi les abus de réabonnement.

### Crochets de cycle de vie

Réagissez aux événements de facturation sur le serveur en fournissant des rappels dans votre configuration :

#### Crochets d'abonnement (`subscription.*`)

- `onSubscriptionComplete` : appelé après une vérification réussie de la transaction (native ou locale).
- `onSubscriptionCreated` : appelé lorsqu'un enregistrement d'abonnement est initialisé pour la première fois dans la base de données.
- `onSubscriptionUpdate` : appelé après un changement persistant du cycle de vie.
- `onSubscriptionCancel` : appelé lorsqu'un utilisateur ou une organisation annule son abonnement.

#### Crochets client (`top-level` ou `organization.*`)

- `onCustomerCreate` : appelé après que le plugin ait créé avec succès un client Paystack.
- `getCustomerCreateParams` : renvoie un objet personnalisé pour remplacer/étendre les données envoyées à Paystack lors de la création du client.

#### Crochets d'essai (`subscription.plans[].freeTrial.*`)

- `onTrialStart` : appelé après la réussite de la charge de tokenisation Paystack et le début d'un nouvel essai.
- `onTrialEnd` : appelé lorsqu'un essai est converti en abonnement actif.
- `onTrialExpired` : appelé lorsqu'un essai se termine sans conversion.

Paystack n'offre pas de flux d'autorisation d'essai gratuit. Le plugin tokenise le paiement
méthode avec un petit supplément unique avant l'essai local ; le montant par défaut utilise celui de Paystack
minimum documenté pour NGN, GHS, ZAR, KES ou USD. Pour une autre devise, configurez
`freeTrial.tokenizationCharge` en unités mineures. Votre interface utilisateur doit indiquer au client le montant exact
avant d'appeler `initializeTransaction` puis d'envoyer `confirmTrialTokenizationCharge: true`.
La réponse inclut `trial.tokenizationCharge` ; l'abonnement reste `incomplete` jusqu'à
le webhook de charge réussie démarre l’essai. Les remboursements ne sont pas automatiques ; les gérer explicitement
avec votre propre politique et [API de remboursement de Paystack](https://paystack.com/docs/payments/refunds/) si vous
promets-en un. Consultez les instructions du fournisseur pour les [cartes de recharge](https://paystack.com/docs/payments/charge-card/)
et [événements webhook](https://paystack.com/docs/payments/webhooks/).

Les échecs de rappel permettent de réessayer les livraisons de webhooks (HTTP 503). Transaction fiable
la réconciliation conserve également un journal de livraison du cycle de vie avant l'activation de l'abonnement,
Ainsi, un hook d'achèvement/mise à jour ayant échoué peut reprendre à partir d'un autre transport de vérification sans
réinitialiser la période de facturation ou répéter un point de contrôle déjà effectué. Crochets d'application
doit rester idempotent par référence de paiement : un processus peut s'arrêter suite à un effet secondaire externe
et avant son point de contrôle de livraison. Les réclamations expirent après cinq minutes pour la récupération après incident.
Les hooks de démarrage d’essai utilisent le même mécanisme de récupération après les webhooks signés avec facturation de tokenisation.
La création d'un abonnement d'essai à distance est réservée avant expédition. Si la réponse du fournisseur est
perdue, le plugin maintient la réservation non résolue au lieu de créer un abonnement en double ;
rapprocher l'abonnement du fournisseur existant (y compris son événement `subscription.create` signé)
avant de réessayer. Une réponse réussie du fournisseur stockée peut reprendre l’activation locale normalement.

#### Crochet mondial

- `onEvent` : reçoit chaque charge utile d'événement webhook envoyée par Paystack pour un traitement personnalisé.

### Opérations du serveur de confiance

Les renouvellements récurrents et la synchronisation du catalogue Paystack ne sont intentionnellement pas exposés via le client d'authentification du navigateur.
Invoquez-les uniquement à partir du code backend approuvé :

```ts
import {
  chargeSubscriptionRenewal,
  reconcilePaystackTransaction,
  syncPaystackPlans,
  syncPaystackProducts,
} from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await chargeSubscriptionRenewal(ctx, paystackOptions, {
  subscriptionId: "sub_123",
});

const settlement = await reconcilePaystackTransaction(ctx, paystackOptions, {
  reference: "PAYSTACK_REFERENCE",
  source: "queue",
  referenceId: "user_or_org_id",
});

if (settlement.ok) {
  console.log(settlement.transaction.status, settlement.subscription.updated);
}

await syncPaystackProducts(ctx, paystackOptions);
await syncPaystackPlans(ctx, paystackOptions);
```

Utilisez `reconcilePaystackTransaction` à partir des gestionnaires de webhooks, des tentatives de file d'attente, des tâches cron ou des actions d'administration lorsque le code du serveur approuvé nécessite les mêmes effets secondaires de vérification et de transaction/abonnement locaux que le point de terminaison de vérification du navigateur.

### Autorisation et sécurité

#### `authorizeReference`

Contrôlez qui peut gérer la facturation pour des références spécifiques (utilisateurs ou organisations).

```ts
paystack({
  subscription: {
    authorizeReference: async ({ user, referenceId, action }) => {
      // Example: Only allow Org Admins to initialize transactions
      if (referenceId.startsWith("org_")) {
        const member = await db.findOne({
          model: "member",
          where: [
            { field: "organizationId", value: referenceId },
            { field: "userId", value: user.id },
          ],
        });
        return member?.role === "admin";
      }
      return user.id === referenceId;
    },
  },
});
```

---

## Référence du SDK client

Le plugin client expose les méthodes canoniques entièrement typées sous `authClient.paystack`, `authClient.transaction` et `authClient.subscription`.

- `authClient.transaction.initialize`, `verify`, `list`
- `authClient.subscription.create`, `upgrade`, `cancel`, `restore`, `list`, `billingPortal`
- `authClient.paystack.config`, `listProducts`, `listPlans`, plus les assistants de transaction/abonnement ci-dessus

Les anciens alias de compatibilité restent disponibles pour la migration, mais le nouveau code doit utiliser les méthodes canoniques :

- `authClient.subscription.disable(...)` -> utiliser `authClient.subscription.cancel(...)`
- `authClient.subscription.enable(...)` -> utiliser `authClient.subscription.restore(...)`

### `authClient.subscription.upgrade` / `create`

Initialise une transaction pour créer ou mettre à niveau un abonnement.

```ts
type upgradeSubscription = {
  /**
   * The name of the plan to subscribe to.
   */
  plan: string;
  /**
   * The email of the subscriber. Defaults to the current user's email.
   */
  email?: string;
  /**
   * Amount to charge (if not using a Paystack Plan Code).
   */
  amount?: number;
  /**
   * Currency code (e.g., "NGN").
   */
  currency?: string;
  /**
   * The callback URL to redirect to after payment.
   */
  callbackURL?: string;
  /** Required for trial plans after your UI has disclosed the one-time tokenization charge. */
  confirmTrialTokenizationCharge?: boolean;
  /**
   * Additional metadata to store with the transaction.
   */
  metadata?: Record<string, unknown>;
  /**
   * Reference ID for the subscription owner (User ID or Org ID).
   * Defaults to the current user's ID.
   */
  referenceId?: string;
  /**
   * Number of seats to purchase (for team plans).
   */
  quantity?: number;
};
```

### `authClient.paystack.transaction.initialize`

Identique à `upgrade`, mais peut également être utilisé pour des paiements uniques en omettant `plan` et en fournissant `amount` ou `product`.

```ts
type initializeTransaction = {
  /**
   * Plan name (for subscriptions).
   */
  plan?: string;
  /**
   * Product name (for one-time purchases).
   */
  product?: string;
  /**
   * Amount to charge (if sending raw amount).
   */
  amount?: number;
  /**
   * For existing locally managed subscriptions, calculate a mid-cycle delta and either
   * charge the saved authorization or return a checkout redirect for interactive payment.
   */
  prorateAndCharge?: boolean;
  // ... same as upgradeSubscription
};

type initializeTransactionResult =
  | {
      kind: "checkout";
      url: string;
      reference: string;
      accessCode: string;
      redirect: true;
    }
  | { kind: "scheduled"; status: "success"; message: string; scheduled: true }
  | { kind: "prorated"; status: "success"; message: string; prorated: true };
```

### `authClient.subscription.list`

Répertoriez les abonnements pour un utilisateur ou une organisation. Les actions de facturation à l'échelle de l'organisation nécessitent par défaut une adhésion propriétaire/administrateur. Pour autoriser des rôles tels que `billing`, configurez `organization.billingRoles`. Pour des ressources personnalisées ou des vérifications de stratégie plus approfondies, configurez `subscription.authorizeReference`.

```ts
type listSubscriptions = {
  query?: {
    /**
     * Filter by reference ID (User ID or Org ID).
     */
    referenceId?: string;
  };
};
```

### `authClient.subscription.cancel` / `restore`

Annuler ou restaurer un abonnement.

- **Annuler** : Définit `cancelAtPeriodEnd: true`. L'abonnement reste `active` jusqu'à la fin de la période de facturation en cours, après quoi il passe à `canceled`.
- **Restaurer** : réactive un abonnement dont l'annulation est programmée.

```ts
type cancelSubscription = {
  /**
   * Optional reference owner (user ID or org ID) when managing another billing entity.
   */
  referenceId?: string;
  /**
   * The Paystack subscription code (e.g. SUB_...)
   */
  subscriptionCode: string;
  /**
   * The email token required by Paystack to manage the subscription.
   * Optional: The server will try to fetch it if omitted.
   */
  emailToken?: string;
  /**
   * When true, keep the subscription active until the current period ends.
   */
  atPeriodEnd?: boolean;
};
```

## Référence du schéma

Le plugin étend votre base de données avec les champs et tables suivants.

### `user` et `organization`

Les codes clients Paystack ne sont plus ajoutés aux tables d'authentification Better Auth. Organisation `email`
reste disponible pour la facturation de secours.

| Champ   | Tapez    | Obligatoire | Descriptif                                                                                     |
| :------ | :------- | :---------- | :--------------------------------------------------------------------------------------------- |
| `email` | `string` | Non         | L'e-mail de facturation de l'organisation. Retour à l'e-mail du propriétaire en cas d'absence. |

### `paystackCustomer`

| Champ           | Tapez    | Obligatoire | Descriptif                                          |
| :-------------- | :------- | :---------- | :-------------------------------------------------- |
| `referenceType` | `string` | Oui         | `user` ou `organization`.                           |
| `referenceId`   | `string` | Oui         | Posséder un identifiant Better Auth.                |
| `referenceKey`  | `string` | Oui         | Clé de référence unique appartenant au fournisseur. |
| `customerCode`  | `string` | Oui         | Code client Paystack.                               |
| `email`         | `string` | Non         | E-mail de facturation.                              |

### `paystackPaymentCredential`

Les informations de paiement sont stockées séparément sous forme de texte chiffré AES-256-GCM. Les valeurs en texte brut ne sont pas
renvoyé par les API d'abonnement, les rappels, les journaux ou les actions du client. Ensemble `credentialEncryptionKey`
à un secret de production dédié ; le plugin revient à `secretKey` pour des raisons de compatibilité.

| Champ                        | Tapez    | Obligatoire | Descriptif                                |
| :--------------------------- | :------- | :---------- | :---------------------------------------- |
| `subscriptionId`             | `string` | Oui         | Identifiant unique d’abonnement Paystack. |
| `authorizationCodeEncrypted` | `string` | Non         | Autorisation de frais récurrents cryptée. |
| `emailTokenEncrypted`        | `string` | Non         | Jeton de gestion des abonnements crypté.  |

### `paystackSubscription`

| Champ                  | Tapez     | Obligatoire | Descriptif                                                            |
| :--------------------- | :-------- | :---------- | :-------------------------------------------------------------------- |
| `plan`                 | `string`  | Oui         | Nom en minuscule du plan actif.                                       |
| `referenceId`          | `string`  | Oui         | ID utilisateur associé ou ID d’organisation.                          |
| `userId`               | `string`  | Oui         | Utilisateur qui a initié le paiement de l'abonnement.                 |
| `customerCode`         | `string`  | Non         | Le code client Paystack pour cet abonnement.                          |
| `subscriptionCode`     | `string`  | Non         | Le code unique de l'abonnement (par exemple, `SUB_...` ou `LOC_...`). |
| `transactionReference` | `string`  | Non         | La référence de la transaction qui a démarré l'abonnement.            |
| `planCode`             | `string`  | Non         | Le code du forfait Paystack, lorsque Paystack gère l'abonnement.      |
| `status`               | `string`  | Oui         | `active`, `trialing`, `canceled`, `incomplete`.                       |
| `periodStart`          | `Date`    | Non         | Date de début de la période de facturation en cours.                  |
| `periodEnd`            | `Date`    | Non         | Date de fin de la période de facturation en cours.                    |
| `trialStart`           | `Date`    | Non         | Date de début de la période d'essai.                                  |
| `trialEnd`             | `Date`    | Non         | Date de fin de la période d'essai.                                    |
| `cancelAtPeriodEnd`    | `boolean` | Non         | S'il faut annuler à la fin de la période en cours.                    |
| `cancelAt`             | `Date`    | Non         | Horodatage d’annulation programmée.                                   |
| `canceledAt`           | `Date`    | Non         | Horodatage d’annulation.                                              |
| `endedAt`              | `Date`    | Non         | Horodatage de fin d’abonnement.                                       |
| `billingInterval`      | `string`  | Non         | Intervalle de facturation utilisé par le forfait.                     |
| `groupId`              | `string`  | Non         | Groupe d'abonnement optionnel.                                        |
| `pendingPlan`          | `string`  | Non         | Planifiez en attendant un futur changement du cycle de vie.           |
| `seats`                | `number`  | Non         | Nombre de sièges achetés pour la facturation de l'équipe.             |
| `createdAt`            | `Date`    | Oui         | Horodatage de création d’enregistrement.                              |
| `updatedAt`            | `Date`    | Oui         | Enregistrer l’horodatage de la mise à jour.                           |

### `paystackTransaction`

| Champ         | Tapez    | Obligatoire | Descriptif                                                     |
| :------------ | :------- | :---------- | :------------------------------------------------------------- |
| `reference`   | `string` | Oui         | Référence unique de la transaction.                            |
| `referenceId` | `string` | Oui         | ID utilisateur associé ou ID d’organisation.                   |
| `userId`      | `string` | Oui         | L'ID de l'utilisateur qui a initié la transaction.             |
| `amount`      | `number` | Oui         | Montant de la transaction dans la plus petite unité monétaire. |
| `currency`    | `string` | Oui         | Code de devise (par exemple, « NGN »).                         |
| `status`      | `string` | Oui         | `success`, `pending`, `failed`, `abandoned`.                   |
| `plan`        | `string` | Non         | Nom du plan associé à la transaction.                          |
| `product`     | `string` | Non         | Nom du produit associé à la transaction.                       |
| `metadata`    | `string` | Non         | Chaîne JSON de métadonnées de transaction supplémentaires.     |
| `paystackId`  | `string` | Non         | L’ID Paystack interne pour la transaction.                     |
| `createdAt`   | `Date`   | Oui         | Horodatage de création de transaction.                         |
| `updatedAt`   | `Date`   | Oui         | Horodatage de la dernière mise à jour de la transaction.       |

### `paystackProduct`

| Champ         | Tapez     | Obligatoire | Descriptif                                             |
| :------------ | :-------- | :---------- | :----------------------------------------------------- |
| `name`        | `string`  | Oui         | Nom du produit.                                        |
| `description` | `string`  | Non         | Description du produit.                                |
| `price`       | `number`  | Oui         | Prix ​​dans la plus petite unité monétaire.              |
| `currency`    | `string`  | Oui         | Code de devise (par exemple, « NGN »).                 |
| `quantity`    | `number`  | Non         | Quantité de stock disponible.                          |
| `unlimited`   | `boolean` | Non         | Si le produit a un stock illimité.                     |
| `paystackId`  | `string`  | Non         | L’ID de produit Paystack interne.                      |
| `slug`        | `string`  | Oui         | Limace unique pour le produit.                         |
| `metadata`    | `string`  | Non         | Chaîne JSON de métadonnées de produit supplémentaires. |
| `createdAt`   | `Date`    | Oui         | Horodatage de création du produit.                     |
| `updatedAt`   | `Date`    | Oui         | Horodatage de la dernière mise à jour du produit.      |

### `paystackWebhookEvent`

Le plugin enregistre les livraisons de webhooks vérifiées avec leur type d'événement, leur charge utile brute, leur référence (lorsque
disponibles), l'état du traitement et l'horodatage du traitement. Cette table est espace de noms du fournisseur afin que le
Les plugins Paystack et Flutterwave peuvent être installés ensemble sans partager l'état du webhook.

| Champ         | Tapez    | Obligatoire | Descriptif                                              |
| :------------ | :------- | :---------- | :------------------------------------------------------ |
| `eventId`     | `string` | Oui         | Hachage stable de la charge utile exacte vérifiée.      |
| `eventType`   | `string` | Oui         | Nom de l’événement Paystack.                            |
| `reference`   | `string` | Non         | Référence de la transaction lorsqu'elle est disponible. |
| `payload`     | `string` | Oui         | Charge utile brute exacte du webhook.                   |
| `status`      | `string` | Oui         | `pending` ou `processed`.                               |
| `processedAt` | `Date`   | Non         | Horodatage de fin de traitement.                        |

### Migration de schéma v4

Après la mise à niveau du package, générez/appliquez d'abord le schéma Better Auth, puis exécutez le
fonctionnement sur serveur uniquement :

```ts
import { migratePaystackSubscriptionSchema } from "better-auth-paystack";

const report = await migratePaystackSubscriptionSchema(ctx, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  credentialEncryptionKey: process.env.PAYSTACK_CREDENTIAL_ENCRYPTION_KEY,
});
```

Exécutez-le dans cet ordre :

1. Mettez à niveau le package.
2. Exécutez la génération/migration de schéma Better Auth.
3. Exécutez `migratePaystackSubscriptionSchema()` à partir d'une tâche de serveur approuvé.
4. Vérifiez le nombre de migrations et le comportement de facturation.
5. Supprimez manuellement les colonnes/tables héritées uniquement après vérification.

L'opération préserve les lignes héritées, conserve les identifiants d'abonnement d'origine lorsque cela est possible et saute déjà
les enregistrements migrés, crypte les jetons d'autorisation/de courrier électronique existants et signale les échecs partiels afin qu'un
une exécution ultérieure peut les réessayer.

Pendant la fenêtre de compatibilité, la résolution du client peut toujours lire l'ancienne table d'authentification du client.
codes. Supprimez manuellement ces anciennes colonnes une fois la migration vérifiée.

---

## Dépannage

- **Signature Webhook** : assurez-vous que `PAYSTACK_SECRET_KEY` correspond à l'intégration qui envoie le webhook. Paystack utilise cette clé secrète API pour `x-paystack-signature`.
- **Vérification par e-mail** : utilisez `requireEmailVerification: true` pour empêcher les paiements non vérifiés.
- **Échecs de redirection** : vérifiez la console de votre navigateur ; Paystack renvoie souvent des erreurs 429 si vous utilisez trop fréquemment l'API de test.
- **Incohérences de référence** : assurez-vous que `referenceId` est transmis correctement pour la facturation de l'organisation.
- **Autorisation refusée** : vérifiez que votre logique `authorizeReference` vérifie correctement les rôles d'utilisateur ou les appartenances à une organisation. Les tentatives non autorisées de vérification des transactions renvoient désormais une réponse `401 Unauthorized` pour éviter les fuites de données.

### Indexation de la base de données

La définition du schéma du plugin inclut les index recommandés et les contraintes d'unicité pour les performances. Lorsque vous exécutez `npx better-auth migrate`, ceux-ci seront automatiquement appliqués à votre base de données.

Après la mise à niveau, exécutez `npx better-auth migrate` (ou `npx better-auth generate` pour les applications gérées par schéma).
adaptateurs). L'abonnement additif `cancelAt`, `canceledAt`, `endedAt` et `billingInterval`
les colonnes sont nullables ; les lignes historiques sont remplies au fur et à mesure du traitement des événements futurs du cycle de vie.

Les champs suivants sont indexés :

- **`paystackTransaction`** : `reference` (unique), `userId`, `referenceId`.
- **`paystackSubscription`** : `subscriptionCode` (unique), `referenceId`, `transactionReference`, `customerCode`, `plan`.
- **`paystackCustomer`** : `referenceKey` (unique), `referenceId`, `customerCode` (unique).
- **`paystackPaymentCredential`** : `subscriptionId` (unique).
- **`paystackProduct`** : `slug` (unique), `paystackId` (unique).

Les mises à niveau au prorata et les frais de renouvellement approuvés persistent également dans les lignes `paystackTransaction`, de sorte que l'historique des transactions locales reste aligné sur les frais hors session réussis.

### Synchronisation des produits

Le plugin propose deux façons de maintenir votre inventaire de produits aligné sur Paystack :

#### 1. Synchronisation automatisée des stocks

Chaque fois qu'un paiement unique réussi est effectué (via webhook ou vérification manuelle), le plugin appelle automatiquement **`syncProductQuantityFromPaystack`**. Cela récupère la quantité restante en temps réel à partir de l'API Paystack et met à jour l'enregistrement de votre base de données locale, garantissant ainsi que votre inventaire est toujours exact.

#### 2. Synchronisation groupée manuelle de confiance

Le point de terminaison public `/paystack/sync-products` a été supprimé dans `2.0.0`.
Exécutez plutôt l'opération de serveur de confiance à partir du code backend :

```ts
import { syncPaystackProducts } from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await syncPaystackProducts(ctx, paystackOptions);
```

### Remarque sur la compatibilité du SDK

Le plugin cible désormais directement la surface client groupée officielle `@alexasomba/paystack-node`.
Si vous injectez un client personnalisé, il doit correspondre aux véritables méthodes du SDK utilisées par le plugin, telles que `transaction.initialize`, `transaction.verify`, `transaction.chargeAuthorization`, `subscription.create`, `subscription.disable` et `subscription.enable`.

---

## 🏗️ Développement et contribution

Ce référentiel est alimenté par **Vite+**. Vous utilisez la CLI `vp` pour gérer l'intégralité de l'espace de travail.

```bash
# Install dependencies
vp install

# Check project health (format, lint, types)
vp check --fix

# Build the core library
vp pack

# Run tests
vp test

# Run the TanStack Start example
vp -C examples/tanstack dev
```

Les contributions sont les bienvenues ! Veuillez ouvrir un problème ou une pull request.

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Feuille de route

Futures fonctionnalités prévues pour les prochaines versions :

### v1.1.0 - Abonnements récurrents manuels (disponibles maintenant)

- [x] **Codes d'autorisation stockés** : stockez en toute sécurité les codes d'autorisation Paystack à partir de transactions vérifiées.
- [x] **Opération de renouvellement de confiance** : assistant côté serveur pour facturer les cartes stockées pour les renouvellements.
- [ ] **Interface utilisateur de gestion des cartes** : permet aux utilisateurs d'afficher/supprimer les modes de paiement enregistrés (données de carte masquées uniquement) - _À venir_
- [ ] **Intégration du planificateur de renouvellement** : documentation pour l'intégration avec Cloudflare Workers Cron, Vercel Cron, etc. - _À venir_

> **Remarque** : Pour les abonnements gérés localement (pas de `planCode`), le plugin capture et stocke automatiquement le `authorization_code`. Déclenchez des renouvellements à partir d’un code backend fiable avec `chargeSubscriptionRenewal(...)`.

### Considérations futures

- [ ] Améliorations de la prise en charge multi-devises
- [ ] Génération de facture
- [ ] Logique de nouvelle tentative de paiement pour les renouvellements ayant échoué

## Liens

- Dépôt GitHub : [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- SDK Paystack Node complet et à jour : [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- SDK Paystack Inline complet et à jour : [alexasomba/paystack-inline](https://github.com/alexasomba/paystack-inline)
- [Exemple d'implémentation de TanStack Start](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)
- Webhooks Paystack : https://paystack.com/docs/payments/webhooks/
- API de transaction Paystack : https://paystack.com/docs/api/transaction/
- API d'abonnement Paystack : https://paystack.com/docs/api/subscription/
- API du plan Paystack : https://paystack.com/docs/api/plan/
- [Meilleure documentation d'authentification](https://www.better-auth.com/docs)

### Hooks d'opération d'abonnement facultatifs

`subscription.operationHooks` permet à une application de placer sa propre limite durable de réservation et de récupération autour des opérations du plan. C'est facultatif : le laisser non défini conserve le comportement du SDK existant. Le SDK ne fournit **pas** de garantie de grand livre, de mutex ou d'idempotence de demande croisée.

Le hook `before(operation, ctx)` s’exécute après l’authentification, l’autorisation de référence et la validation du plan, du siège, de l’essai et du prorata applicable. Il s'exécute avant l'initialisation/la facturation du fournisseur ou une mutation de plan/horaire local. `operation` inclut l'acteur, la référence autorisée, l'abonnement sélectionné, le type d'opération et l'intention validée. La planification a un contrôle en amont distinct avant sa mutation locale.

Renvoyez l'un des :

- `{ kind: "proceed", providerReference, context? }` : fournissez une référence stable réservée par votre application. Le SDK le transmet au paiement ordinaire, au paiement au prorata et aux frais d'autorisation enregistrés. `context` reste local à cet appel et est transmis aux hooks d'achèvement/d'erreur.
- `{ kind: "replay", result }` : renvoie un `PaystackInitializeResult` existant du type d'opération approprié sans autre appel de fournisseur ni écriture du SDK.
- `{ kind: "block", message? }` : rejeter cette opération sans envoi ni mutation.

`after(operation, ctx)` reçoit le résultat uniquement une fois les écritures du SDK de l'opération terminées. `onError(operation, ctx)` reçoit l'erreur d'origine et une phase `provider`, `persistence` ou `completion`. Un délai d’attente du fournisseur, une référence mal formée/incohérente, un échec de persistance après le paiement ou un échec du hook d’achèvement n’établit pas qu’aucun paiement n’a eu lieu. Conserver la réserve non résolue de la demande et la rapprocher ; ne répétez pas automatiquement une charge. Un échec de hook d’erreur est enregistré et ne remplace pas l’erreur d’opération d’origine.

Les hooks sont réservés au serveur. Authentifier et autoriser les données de relecture de paiement stockées pour l'acteur/référence actuel avant de les renvoyer ; les URL d’autorisation et les codes d’accès ne doivent pas apparaître dans les lectures de statut public. Ne placez pas les informations d’identification du fournisseur dans un contexte de hook. Le SDK conserve ses règles d'autorisation de référence existantes ; les applications restent responsables de leurs propres autorisations d'interface utilisateur plus strictes.

Une configuration fermée après échec alors qu'un service de réservation d'application n'est pas disponible :

```ts
import type { PaystackSubscriptionOperationHooks } from "better-auth-paystack";

const operationHooks: PaystackSubscriptionOperationHooks = {
  before: () =>
    Promise.resolve({
      kind: "block",
      message: "Subscription changes are temporarily unavailable.",
    }),
};

// Pass operationHooks under paystack({ subscription: { enabled: true, plans, operationHooks } }).
```

Une implémentation de production `proceed` doit réserver avant de retourner, dédupliquer les demandes simultanées, protéger les résultats de réexécution et résoudre les résultats incertains par rapport au fournisseur faisant autorité et à l'état d'abonnement. Les paiements uniques de produit/montant et les opérations de renouvellement récurrentes n’utilisent pas ces crochets de plan d’abonnement.

### Tarification et livraison de webhooks

Les plans/produits du catalogue possèdent leurs propres prix et devises de paiement. Les valeurs `amount`/`currency` du client s'appliquent uniquement aux paiements ponctuels ; les quantités de produits et les sièges du plan utilisent les tarifs du serveur. Les opérations de renouvellement d'abonnement dérivent également le montant du forfait configuré.

Le traitement des webhooks nécessite la table `paystackWebhookEvent`, y compris sa contrainte unique `eventId`. Les livraisons réclament l'événement avec une mise à jour conditionnelle de la base de données ; les modifications incomplètes de la base de données ou les rappels renvoient HTTP 503 et restent réessayables. Une demande de traitement expire après cinq minutes pour une récupération après incident. Les rappels doivent être idempotents par référence à une transaction/événement, car un crash après un effet secondaire externe peut provoquer une nouvelle tentative. La vérification historique des transactions réussies ne réactive pas les abonnements annulés ni ne réinitialise une période de facturation déjà active.
