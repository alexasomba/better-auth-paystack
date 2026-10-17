[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# OuvrirNext Starter

## Meilleure authentification + Paytack

Cet exemple monte Better Auth (avec le plugin Paystack) sur `GET/POST /api/auth/[...all]`.

### Configuration

1. Installer + build (racine du dépôt) :

```bash
vp install
vp pack
```

2. Installez des exemples de dépôts :

```bash
cd examples/nextjs
vp install
```

3. Configurez l'environnement :

- Copier `.env.example` vers `.env.local`
- Remplissez `PAYSTACK_SECRET_KEY`

Remarque : La vérification du webhook Paystack utilise la même clé secrète Paystack pour le HMAC `x-paystack-signature`. `PAYSTACK_WEBHOOK_SECRET` est facultatif et la valeur par défaut est `PAYSTACK_SECRET_KEY` dans cet exemple.

Facultatif :

- Définissez `PAYSTACK_CREATE_CUSTOMER_ON_SIGNUP=1` si vous souhaitez que la démo crée un enregistrement client Paystack lorsqu'un utilisateur s'inscrit.

Cette démo prend en charge la création de clients Paystack lors des flux d'inscription et d'abonnement Paystack, utilisez donc une véritable clé secrète de test Paystack.

### Valider

Depuis la racine du référentiel :

```bash
vp -C examples/nextjs run typecheck
vp -C examples/nextjs run lint
vp -C examples/nextjs run build
```

### Stockage

Comme l'exemple TanStack Start, cette démo utilise l'adaptateur en mémoire de Better Auth.
Il est destiné à l'exploration locale et réinitialise ses utilisateurs, organisations, abonnements,
produits, plans et transactions lorsque le processus redémarre. Utilisez un adaptateur de production avant
déployer des données de facturation persistantes.

Il s'agit d'un projet [Next.js](https://nextjs.org) démarré avec [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Pour commencer

Lisez la documentation sur https://opennext.js.org/cloudflare.

## Développer

Exécutez le serveur de développement Next.js :

```bash
vp dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) avec votre navigateur pour voir le résultat.

## Que tester

La page d'accueil est une interface utilisateur de démonstration interactive qui exerce :

- Authentification anonyme et e-mail/mot de passe
- Création d'organisations et objectifs de facturation personnels/organisationnels
- Cinq plans d'abonnement, essais, nombre de sièges, calendrier en fin de période et mises à niveau au prorata
- Produits uniques, synchronisation du catalogue, historique des transactions et vérification des transactions
- Annulation d'abonnement, restauration, portail de facturation Paystack et renouvellements fiables
- Vérification de la signature Webhook sur `POST /api/auth/paystack/webhook` (envoyée par Paystack ; non déclenchée depuis le navigateur)

Remarque : la vérification du webhook est « fonctionnelle » dans le sens où le point de terminaison existe et valide les signatures, mais vous ne pouvez pas le tester de manière significative à partir du navigateur. Vous ne le verrez se déclencher que lorsque Paystack enverra des événements de webhook à votre URL déployée/tunnelée.

Vous pouvez commencer à éditer la page en modifiant `src/app/page.tsx`. La page se met à jour automatiquement au fur et à mesure que vous modifiez le fichier.

## Aperçu

Prévisualisez l'application localement sur le runtime Cloudflare :

```bash
vp run preview
```

## Déployer

Déployez l'application sur Cloudflare :

```bash
vp run deploy
```

## En savoir plus

Pour en savoir plus sur Next.js, consultez les ressources suivantes :

- [Documentation Next.js](https://nextjs.org/docs) - découvrez les fonctionnalités et l'API de Next.js.
- [Apprendre Next.js](https://nextjs.org/learn) - un didacticiel interactif Next.js.

Vous pouvez consulter [le référentiel Next.js GitHub](https://github.com/vercel/next.js) - vos commentaires et contributions sont les bienvenus !
