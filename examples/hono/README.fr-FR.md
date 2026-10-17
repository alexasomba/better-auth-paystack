[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Hono + Meilleure authentification + Paytack

Cet exemple connecte Better Auth et `better-auth-paystack` à un Hono Cloudflare Worker.


## Configuration

1. Installez les dépendances et construisez la bibliothèque à partir de la racine du référentiel :

```txt
vp install
vp pack
```

2. Installez des exemples de dépôts :

```txt
vp -C examples/hono install
```

3. Configurez l'environnement local :

- Copier `.dev.vars.example` vers `.dev.vars`
- Remplissez `BETTER_AUTH_SECRET` et `PAYSTACK_SECRET_KEY`

Remarque : La vérification du webhook Paystack utilise la même clé secrète Paystack pour le HMAC `x-paystack-signature`. `PAYSTACK_WEBHOOK_SECRET` est facultatif et peut être défini sur la même valeur que `PAYSTACK_SECRET_KEY`.


## Exécuter

```txt
vp -C examples/hono dev
```

Better Auth est monté sur `http://localhost:8787/api/auth/*`. L'exemple expose également :

- `/api/billing` pour la vérification des rappels, la synchronisation du catalogue et les opérations de renouvellement fiables
- `/api/health` et `/openapi.json` pour les contrôles de service et la découverte d'API
- `/.well-known/api-catalog` et `/mcp` pour la découverte face à l'agent

Exécutez les exemples de vérifications avec :

```txt
vp -C examples/hono typecheck
vp -C examples/hono test
vp -C examples/hono build
```


## Remarques

- Cela utilise `memoryAdapter`, donc les données sont réinitialisées lors du déploiement/redémarrage. Utilisez le stockage sauvegardé par D1/KV pour la production.
- Le client Paystack utilise la surface client groupée typée `@alexasomba/paystack-node` attendue par le plugin.
- La facturation de l'organisation, cinq plans d'abonnement, les essais, les produits, les transactions et les actions d'annulation/restauration/portail sont exposés via l'API client Better Auth.
- Les itinéraires Paystack nécessitent `PAYSTACK_SECRET_KEY` ; De meilleures routes d'authentification fonctionnent toujours avec uniquement `BETTER_AUTH_SECRET`.
