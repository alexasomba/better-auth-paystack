[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Better Auth Paystack: ejemplo de inicio de TanStack

Un ejemplo completo que demuestra el complemento `better-auth-paystack` con TanStack Start, implementado en Cloudflare Workers.

[**Demostración en vivo**](https://better-auth-paystack.gittech.workers.dev)


## Funciones demostradas

- [x] Inicio de sesión anónimo (para fines de demostración)
- [x] Pago de suscripción a Paystack (flujo de redireccionamiento)
- [x] Verificación de transacciones y seguimiento de estado
- [x] Gestión de suscripciones (listar, cancelar, restaurar, portal de facturación)
- [x] Cambios de plan programados y actualizaciones inmediatas para planes locales
- [x] **Facturación de organización** - Facturar suscripciones a organizaciones en lugar de cuentas personales
- [x] **Suscripciones de código de plan** - Utilice planes administrados por Paystack (`planCode`)
- [x] **Complemento de administración** - Capacidades administrativas nativas de Better Auth
- [x] Configuración del plan dinámico a través de `/paystack/config`
- [x] Metadatos de SEO a nivel de ruta, mapa del sitio y robots.txt


## Pila de tecnología

- **Marco**: [Inicio de TanStack](https://tanstack.com/start)
- **Autentificación**: [Mejor autenticación](https://www.better-auth.com/)
- **Pagos**: [Paystack](https://paystack.com/) a través de `better-auth-paystack`
- **UI**: Reaccionar + [Shadcn UI](https://ui.shadcn.com/) + Tailwind CSS
- **Implementación**: Trabajadores de Cloudflare


## Empezando


### 1. Instalar dependencias

```bash
pnpm install
```


### 2. Configurar el entorno

Cree un archivo `.dev.vars`:

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
VITE_BETTER_AUTH_URL=http://localhost:3000
```


### 3. Ejecute el servidor de desarrollo

```bash
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) en su navegador.


### 4. Construir para producción

```bash
pnpm build
```


### 5. Implementación para trabajadores de Cloudflare

```bash
pnpm deploy
```


## Estructura del proyecto

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


## Detalles clave de implementación


### Configuración del servidor (`src/lib/auth.ts`)

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


### Configuración del cliente (`src/lib/auth-client.ts`)

```ts
import { paystackClient } from "better-auth-paystack/client";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  plugins: [paystackClient({ subscription: true }), organizationClient(), adminClient()],
});
```


### Facturación a una organización

La facturación de la organización requiere que el usuario que haya iniciado sesión sea propietario/administrador de la organización, a menos que proporcione una devolución de llamada personalizada `subscription.authorizeReference` en el servidor.

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


### Flujos de servidor avanzados

Algunas capacidades de complementos están intencionalmente en el lado del servidor y no se activan desde la interfaz de usuario del panel. En el ejemplo de TanStack, estas son las primitivas correctas para usar desde funciones de servidor, trabajos o rutas de administración:

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

Lo que demuestra el tablero:

- redirecciones de pago para suscripciones y pagos únicos
- tarjetas de suscripción con reconocimiento de prueba y mensajes de devolución de llamada
- mensajes utilizados en prueba antes de que comience el proceso de pago
- cancelar / restaurar flujos
- portal de facturación/gestionar flujo de enlaces
- cambios de plan programados
- actualizaciones inmediatas para planes locales usando `prorateAndCharge`
- controles de administración autenticados para sincronización confiable de planes/productos y renovaciones locales manuales

Qué sigue siendo propiedad del servidor:

- trabajos de sincronización de catálogo
- cargo de renovación recurrente
- procesamiento de webhooks y ciclos de vida de suscripción
- aplicación de la elegibilidad de prueba y automatización del inicio de la prueba


## Variables de entorno

| Variables | Descripción |
| ---------------------- | -------------------------------------------------- |
| `PAYSTACK_SECRET_KEY` | Clave API de pila de pago; también verifica las firmas de webhooks |
| `BETTER_AUTH_SECRET` | Secreto para un mejor cifrado de sesiones de autenticación |
| `BETTER_AUTH_URL` | URL base del lado del servidor |
| `VITE_BETTER_AUTH_URL` | URL base del lado del cliente |


## Más información

- [Mejor documentación de autenticación](https://www.better-auth.com/docs)
- [Documentación de la API de Paystack](https://paystack.com/docs/api/)
- [mejor-pila-de-autenticación](https://github.com/alexasomba/better-auth-paystack)
- [Inicio de TanStack](https://tanstack.com/start)
