# Plugin Paystack para Better Auth

Complemento con prioridad en TypeScript que integra Paystack en [Better Auth](https://www.better-auth.com) y ofrece un sistema de facturación preparado para producción con suscripciones nativas y locales, pagos únicos, periodos de prueba, facturación para organizaciones y webhooks seguros.

<div align="center">

![Descargas mensuales en npm](https://img.shields.io/npm/dm/better-auth-paystack.svg)
[![Estrellas en GitHub](https://img.shields.io/github/stars/alexasomba/better-auth-paystack.svg?style=social&label=Star)](https://github.com/alexasomba/better-auth-paystack/stargazers)
[![Versión publicada en GitHub](https://img.shields.io/github/v/release/alexasomba/better-auth-paystack)](https://github.com/alexasomba/better-auth-paystack/releases)
[![Tamaño comprimido en Bundlephobia](https://img.shields.io/bundlephobia/minzip/better-auth-paystack)](https://bundlephobia.com/result?p=better-auth-paystack)
[![Seguir en Twitter](https://img.shields.io/twitter/follow/alexasomba?style=social)](https://twitter.com/alexasomba)
![Licencia de GitHub](https://img.shields.io/github/license/alexasomba/better-auth-paystack)

</div>

[**Demo en directo (TanStack Start)**](https://better-auth-paystack.gittech.workers.dev) | [**Código fuente**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## Habilidades para agentes de IA

Este paquete publica habilidades para que los agentes de programación con IA puedan consultar instrucciones específicas sobre configuración, suscripciones, facturación para organizaciones, integración con TanStack Start, API del cliente, webhooks, ciclo de vida de suscripciones locales, cambios de esquema y pruebas.

Utiliza [TanStack Intent](https://www.npmjs.com/package/@tanstack/intent) para enumerar o cargar habilidades individuales de forma explícita:

```bash
npx @tanstack/intent@latest list
npx @tanstack/intent@latest load better-auth-paystack#better-auth-paystack-setup
npx @tanstack/intent@latest load better-auth-paystack#paystack-testing-fixtures
```

Si utilizas un agente de IA, ejecuta `npx @tanstack/intent@latest install` en tu proyecto para que sepa cómo descubrir las habilidades del paquete.

Este paquete también incluye habilidades en el paquete npm bajo `skills/*/SKILL.md`. Los proyectos pueden utilizar [skills-npm](https://www.npmjs.com/package/skills-npm) para crear enlaces simbólicos a las habilidades del paquete instalado para los agentes compatibles:

```bash
npm install better-auth-paystack
npx skills-npm --yes
```

En este repositorio, los mantenedores pueden ejecutar `pnpm run skills:dry-run` para previsualizar el descubrimiento con el fixture de ejemplo de TanStack, o `pnpm run skills:install` para crear enlaces simbólicos locales a las habilidades para agentes a partir de esos datos de prueba.

## Funcionalidades

- [x] **Modalidades de facturación**: admite planes gestionados por Paystack, suscripciones gestionadas localmente y pagos únicos de productos o importes.
- [x] **Creación automática de clientes**: permite crear clientes en Paystack al registrar un usuario o crear una organización.
- [x] **Gestión de periodos de prueba**: configura periodos de prueba con mecanismos integrados para evitar abusos.
- [x] **Facturación para organizaciones**: asocia suscripciones con organizaciones y controla el acceso mediante roles.
- [x] **Control de canales de suscripción**: limita el checkout de suscripciones a determinados canales de pago de Paystack, por ejemplo, solo tarjetas.
- [x] **Límites y plazas**: aplica automáticamente los límites de plazas de miembros y de recursos, como equipos.
- [x] **Cambios programados**: aplaza las modificaciones o cancelaciones de suscripciones hasta el final del ciclo de facturación.
- [x] **Prorrateo**: permite aplicar mejoras prorrateadas de inmediato a mitad del ciclo en planes locales; utiliza cargos a tarjetas guardadas cuando es posible y recurre al checkout cuando se requiere una acción interactiva.
- [x] **Checkout en ventana emergente**: admite opcionalmente el checkout integrado de Paystack mediante `@alexasomba/paystack-inline`.
- [x] **Seguridad de webhooks**: incluye verificación de firma (HMAC-SHA512) y permite configurar una lista de IP autorizadas.
- [x] **Historial de transacciones**: permite consultar y listar los registros locales de transacciones.

---

## Inicio rápido

### Requisitos previos

- **Node.js**: versión `v22.0.0` o posterior.
- **Better Auth**: versión `v1.6.9` o posterior.

### 1. Instala el plugin y los SDK

```bash
npm install better-auth better-auth-paystack @alexasomba/paystack-node
```

#### Migración desde el paquete con scope

Sustituye la dependencia con scope por el paquete sin scope:

```bash
npm uninstall @alexasomba/better-auth-paystack
npm install better-auth-paystack
```

Después, actualiza las importaciones de `@alexasomba/better-auth-paystack` a `better-auth-paystack` y de
`@alexasomba/better-auth-paystack/client` a `better-auth-paystack/client`.

Este es un cambio de nombre del paquete. La versión v4 también traslada los datos de facturación de Paystack a
tablas propiedad del proveedor. Los nombres de las rutas del cliente siguen siendo compatibles, pero se requiere una migración
de la base de datos y la operación de migración de confianza descrita a continuación.

#### Opcional: SDK para navegador (ventanas emergentes de checkout)

```bash
npm install @alexasomba/paystack-inline
```

### 2. Configura las variables de entorno

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
```

### 3. Configura el plugin del servidor

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

Paystack firma las cargas útiles de los webhooks con la misma `PAYSTACK_SECRET_KEY` que se utiliza para autenticar la API;
no hay un secreto de webhook independiente. Las opciones heredadas `webhook.secret` y `paystackWebhookSecret`
se aceptan por compatibilidad con el código existente, pero se ignoran.

### 4. Configura el plugin del cliente

```ts title="client.ts"
import { paystackClient } from "better-auth-paystack/client";
import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const client = createAuthClient({
  plugins: [adminClient(), paystackClient({ subscription: true })],
});
```

### 5. Migra el esquema de la base de datos

```bash
npx better-auth migrate
```

---

## Guía de migración

La versión `2.0.0` incluye un cambio incompatible centrado en la seguridad.

- Se han eliminado estas operaciones administrativas públicas accesibles desde el cliente:
  - `authClient.paystack.syncProducts()`
  - `authClient.paystack.syncPlans()`
  - `authClient.paystack.chargeRecurringSubscription(...)`
- Se han eliminado estos endpoints públicos de Better Auth:
  - `/paystack/sync-products`
  - `/paystack/sync-plans`
  - `/paystack/charge-recurring`
- Se han añadido estas operaciones para el servidor de confianza:
  - `chargeSubscriptionRenewal`
  - `syncPaystackProducts`
  - `syncPaystackPlans`

### Antes

```ts
await authClient.paystack.syncProducts();
await authClient.paystack.syncPlans();
await authClient.paystack.chargeRecurringSubscription({
  subscriptionId: "sub_123",
});
```

### Después

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

Estas operaciones son solo para el servidor. No las expongas mediante llamadas al cliente de autenticación iniciadas desde el navegador.

---

## Modalidades de facturación

### 1. Suscripciones

#### Suscripciones nativas (recomendadas)

Utiliza `planCode` del panel de Paystack. Paystack se encarga de la recurrencia y de enviar los correos electrónicos.

```ts
{ name: "pro", planCode: "PLN_xxx" }
```

#### Locales

Utiliza `amount` e `interval`. El plugin guarda el estado localmente para que puedas gestionar la recurrencia personalizada o periodos de acceso puntuales.

```ts
{ name: "starter", amount: 50000, interval: "monthly" }
```

### 2. Pagos únicos

#### Productos predefinidos

Define productos preconfigurados en los ajustes del servidor y permite que se compren por nombre.

```ts
await authClient.paystack.transaction.initialize({
  product: "credits_50",
});
```

#### Importes personalizados

Cobra importes dinámicos para recargas, propinas o facturas personalizadas.

```ts
await authClient.paystack.transaction.initialize({
  amount: 100000, // 1000 NGN
  currency: "NGN",
  metadata: { type: "donation" },
});
```

---

## Gestión de límites y plazas

El plugin aplica automáticamente los límites a las suscripciones activas y en periodo de prueba. Si varios
grupos de suscripción definen el mismo límite numérico, prevalece el valor más alto; las funcionalidades
de los planes se combinan.

### Límites de plazas para miembros

Las plazas compradas se guardan en el campo `subscription.seats`. El plugin intercepta `member.create` e `invitation.create` para impedir que se añadan más miembros al alcanzar el límite.

### Límites de recursos (por ejemplo, equipos)

Define los límites en la configuración del plan. Se comprobarán al crear recursos:

```ts
plans: [{ name: "pro", limits: { teams: 5, seats: 10 } }];
```

Si utilizas el plugin de organización de Better Auth, el plugin comprueba de forma nativa el límite de `teams`.

### Grupos de suscripción

Asigna `group` a los planes relacionados cuando un usuario o una organización puedan tener suscripciones independientes:

```ts
plans: [
  { name: "pro", group: "workspace", planCode: "PLN_pro" },
  { name: "priority-support", group: "support", planCode: "PLN_support" },
];
```

Los nombres de los grupos se recortan y se convierten a minúsculas. Cada referencia puede tener una suscripción activa o en periodo de prueba
por grupo. Los planes sin `group` permanecen en el grupo predeterminado heredado, representado por un valor anulable
`subscription.groupId`, de modo que las configuraciones existentes mantienen el comportamiento anterior de una sola
suscripción.

---

## Monedas admitidas

El plugin admite estas monedas y valida automáticamente el importe mínimo de cada transacción:

| Moneda  | Nombre                          | Importe mínimo |
| ------- | ------------------------------- | -------------- |
| **NGN** | Naira nigeriana                 | ₦50.00         |
| **GHS** | Cedi ghanés                     | ₵0.10          |
| **ZAR** | Rand sudafricano                | R1.00          |
| **KES** | Chelín keniano                  | KSh 3.00       |
| **USD** | Dólar estadounidense            | $2.00          |
| **XOF** | Franco CFA de África Occidental | CFA 100        |

Las transacciones por debajo de estos umbrales se rechazan con un error `BAD_REQUEST`.

## Uso avanzado

### Facturación para organizaciones

Activa `organization.enabled` para facturar a organizaciones en lugar de a usuarios.

- **Cliente automático**: cada organización obtiene su propio registro `paystackCustomer` propiedad del proveedor.
- **Autorización**: por defecto, los propietarios y administradores de la organización pueden gestionar la facturación. Utiliza `organization.billingRoles` para ampliar la lista de roles de confianza, o `subscription.authorizeReference` si necesitas una autorización totalmente personalizada.

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

### Modal emergente de checkout integrado

Utiliza `@alexasomba/paystack-inline` para ofrecer una experiencia integrada.

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

### Cambios programados y cancelaciones

Aplaza los cambios hasta el final del ciclo de facturación actual:

- **Mejoras**: pasa `scheduleAtPeriodEnd: true` a `initializeTransaction()`.
- **Cancelaciones**: utiliza `authClient.subscription.cancel({ subscriptionCode, atPeriodEnd: true })` para mantener activa la suscripción hasta que termine el periodo.

### Prorrateo a mitad del ciclo (`prorateAndCharge`)

El plugin calcula dinámicamente la diferencia de precio para aplicar mejoras inmediatas a mitad del ciclo, como añadir plazas.
En los planes gestionados localmente:

- Si la suscripción ya tiene un código de autorización de Paystack reutilizable, el plugin cobra el importe prorrateado sin intervención del cliente, registra una transacción local `paystackTransaction` y actualiza la suscripción de inmediato.
- Si no hay un código de autorización reutilizable, por ejemplo, en pagos por transferencia, el plugin inicia un checkout por el importe prorrateado en lugar de aplicar una mejora sin cobrar.
- Si el importe prorrateado es inferior al mínimo de Paystack para esa moneda, se rechaza la solicitud para que puedas programar el cambio al final del periodo en vez de cobrar menos de lo debido.

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

Si el proceso recurre al checkout, verifica la referencia de transacción que se devuelve después del pago. El plugin utiliza los metadatos guardados del prorrateo para aplicar el cambio pendiente de plan o de plazas solo después de verificar correctamente el pago.

### Limitar los canales de pago de las suscripciones

Utiliza `subscription.allowedPaymentChannels` para limitar los canales de checkout de Paystack disponibles para las suscripciones.
Esto se aplica al checkout estándar de suscripción, a la autorización de periodos de prueba y a los checkouts interactivos alternativos del prorrateo.

```ts
paystack({
  subscription: {
    enabled: true,
    allowedPaymentChannels: ["card"],
    plans: [{ name: "starter", amount: 50000, currency: "NGN", interval: "monthly" }],
  },
});
```

Si después se verifica un pago de suscripción con un canal no permitido, el plugin rechaza la activación en lugar de crear la suscripción silenciosamente.

### Seguridad de webhooks

Las entregas de webhooks se guardan en la tabla `paystackWebhookEvent`, específica del proveedor, con un
hash estable de la carga útil original verificada. Las entregas duplicadas ya procesadas se confirman
sin volver a ejecutar efectos secundarios de facturación. Las entregas fallidas o interrumpidas quedan
pendientes para conciliarlas o volver a procesarlas más adelante.

El plugin verifica automáticamente el encabezado `x-paystack-signature` para comprobar la autenticidad de los eventos. También puedes activar una **lista de IP autorizadas** para limitar el procesamiento a los servidores oficiales de Paystack.

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  webhook: {
    verifyIP: true, // Enable IP whitelisting (defaults to false for flexible proxy support)
    trustedIPs: ["52.31.139.75", "52.49.173.169", "52.214.14.220"], // Optional: override trusted IPs
  },
});
```

Paystack exige que las firmas de webhook se verifiquen siempre con `secretKey`. No crees ni
configures una variable `PAYSTACK_WEBHOOK_SECRET` independiente.

### Prevención del abuso de periodos de prueba

El plugin comprueba el historial de `referenceId`. Si ya se ha utilizado un periodo de prueba, activo, caducado o en curso, no se concederá otro. Así se evita volver a suscribirse para obtener pruebas repetidas.

### Callbacks del ciclo de vida

Para reaccionar a los eventos de facturación en el servidor, proporciona callbacks en la configuración:

#### Callbacks de suscripción (`subscription.*`)

- `onSubscriptionComplete`: se llama tras verificar correctamente una transacción, nativa o local.
- `onSubscriptionCreated`: se llama cuando se inicializa por primera vez un registro de suscripción en la base de datos.
- `onSubscriptionUpdate`: se llama después de guardar un cambio en el ciclo de vida de la suscripción.
- `onSubscriptionCancel`: se llama cuando un usuario o una organización cancela su suscripción.

#### Callbacks de cliente (`top-level` o `organization.*`)

- `onCustomerCreate`: se llama cuando el plugin crea correctamente un cliente en Paystack.
- `getCustomerCreateParams`: devuelve un objeto personalizado para sustituir o ampliar los datos que se envían a Paystack al crear el cliente.

#### Callbacks de prueba (`subscription.plans[].freeTrial.*`)

- `onTrialStart`: se llama cuando se completa el cargo de tokenización de Paystack y comienza un nuevo periodo de prueba.
- `onTrialEnd`: se llama cuando un periodo de prueba se convierte en una suscripción activa.
- `onTrialExpired`: se llama cuando un periodo de prueba termina sin convertirse en suscripción.

Paystack no ofrece un flujo de autorización de prueba sin cargo. Antes del periodo de prueba local, el plugin tokeniza el método de pago
mediante un pequeño cargo único.
El importe predeterminado utiliza el mínimo documentado por Paystack para NGN, GHS, ZAR, KES o USD.
Para otra moneda, configura `freeTrial.tokenizationCharge` en unidades menores. La interfaz debe indicar al cliente el importe exacto
antes de llamar a `initializeTransaction` y enviar después `confirmTrialTokenizationCharge: true`.
La respuesta incluye `trial.tokenizationCharge`; la suscripción permanece en estado `incomplete` hasta que
el webhook del cargo correcto inicie el periodo de prueba. Los reembolsos no son automáticos; aplica
tu propia política y utiliza la [API de reembolsos de Paystack](https://paystack.com/docs/payments/refunds/) si
prometes reembolsarlos. Consulta también la guía del proveedor para [cobrar con tarjeta](https://paystack.com/docs/payments/charge-card/)
y para los [eventos de webhook](https://paystack.com/docs/payments/webhooks/).

Si falla un callback, la entrega del webhook puede reintentarse (HTTP 503). La conciliación de transacciones de confianza
también guarda un registro de entrega del ciclo de vida antes de activar la suscripción,
para que otro medio de verificación pueda reanudar un callback de finalización o actualización fallido sin
reiniciar el periodo de facturación ni repetir callbacks ya confirmados. Los callbacks de la aplicación
deben ser idempotentes por referencia de pago: un proceso puede detenerse después de un efecto externo
y antes de guardar su confirmación. Las reservas caducan a los cinco minutos para permitir la recuperación tras un fallo.
Los callbacks de inicio de prueba utilizan el mismo mecanismo de recuperación tras los webhooks firmados del cargo de tokenización.
La creación de una suscripción de prueba en el proveedor se reserva antes de iniciar la solicitud. Si se pierde la respuesta,
el plugin mantiene la reserva sin resolver en lugar de crear una suscripción duplicada; primero concilia la suscripción existente
del proveedor, incluido su evento firmado `subscription.create`, antes de reintentar.
Una respuesta correcta del proveedor que ya esté guardada puede reanudar normalmente la activación local.

#### Callback global

- `onEvent`: recibe todas las cargas útiles de eventos de webhook enviados por Paystack para que puedas procesarlas de forma personalizada.

### Operaciones de servidor de confianza

La renovación recurrente y la sincronización del catálogo de Paystack no están disponibles en el cliente de autenticación del navegador.
Invócalas únicamente desde código de backend de confianza:

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

Utiliza `reconcilePaystackTransaction` en manejadores de webhooks, reintentos de colas, tareas cron o acciones administrativas cuando el código de servidor de confianza necesite la misma verificación y los mismos efectos locales sobre transacciones y suscripciones que ofrece el endpoint de verificación del navegador.

### Autorización y seguridad

#### `authorizeReference`

Controla quién puede gestionar la facturación de determinadas referencias, ya sean usuarios u organizaciones.

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

## Referencia del SDK de cliente

El plugin de cliente expone métodos canónicos con tipos completos en `authClient.paystack`, `authClient.transaction` y `authClient.subscription`.

- `authClient.transaction.initialize`, `verify` y `list`
- `authClient.subscription.create`, `upgrade`, `cancel`, `restore`, `list` y `billingPortal`
- `authClient.paystack.config`, `listProducts`, `listPlans` y los métodos anteriores de transacciones y suscripciones

Los alias de compatibilidad heredados siguen disponibles para facilitar la migración, pero el código nuevo debería utilizar los métodos canónicos:

- `authClient.subscription.disable(...)` → utiliza `authClient.subscription.cancel(...)`
- `authClient.subscription.enable(...)` → utiliza `authClient.subscription.restore(...)`

### `authClient.subscription.upgrade` / `create`

Inicia una transacción para crear o mejorar una suscripción.

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

Es como `upgrade`, pero también permite pagos únicos si omites `plan` e indicas `amount` o `product`.

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

Lista las suscripciones de un usuario o una organización. De forma predeterminada, las acciones de facturación de una organización requieren que el miembro sea propietario o administrador. Para permitir roles como `billing`, configura `organization.billingRoles`. Para recursos personalizados o reglas más específicas, configura `subscription.authorizeReference`.

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

Cancela o restaura una suscripción.

- **Cancelar**: establece `cancelAtPeriodEnd: true`. La suscripción permanece en estado `active` hasta el final del periodo de facturación actual; después pasa a `canceled`.
- **Restaurar**: reactiva una suscripción cuya cancelación está programada.

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

## Referencia del esquema

El plugin amplía la base de datos con los siguientes campos y tablas.

### `user` y `organization`

Los códigos de cliente de Paystack ya no se añaden a las tablas de autenticación de Better Auth. El campo `email` de la organización
sigue disponible como alternativa para obtener el correo de facturación.

| Campo   | Tipo     | Obligatorio | Descripción                                                                           |
| :------ | :------- | :---------- | :------------------------------------------------------------------------------------ |
| `email` | `string` | No          | Correo de facturación de la organización. Si falta, se usa el correo del propietario. |

### `paystackCustomer`

| Campo           | Tipo     | Obligatorio | Descripción                                             |
| :-------------- | :------- | :---------- | :------------------------------------------------------ |
| `referenceType` | `string` | Sí          | `user` o `organization`.                                |
| `referenceId`   | `string` | Sí          | Identificador de la entidad propietaria en Better Auth. |
| `referenceKey`  | `string` | Sí          | Clave de referencia única gestionada por el proveedor.  |
| `customerCode`  | `string` | Sí          | Código del cliente de Paystack.                         |
| `email`         | `string` | No          | Correo electrónico de facturación.                      |

### `paystackPaymentCredential`

Las credenciales de pago se guardan por separado como texto cifrado con AES-256-GCM. Los valores en claro no se
devuelven en las API de suscripciones, callbacks, logs ni acciones de cliente. Configura `credentialEncryptionKey`
con un secreto de producción dedicado; por compatibilidad, el plugin utiliza `secretKey` si no se proporciona.

| Campo                        | Tipo     | Obligatorio | Descripción                                        |
| :--------------------------- | :------- | :---------- | :------------------------------------------------- |
| `subscriptionId`             | `string` | Sí          | Identificador único de la suscripción de Paystack. |
| `authorizationCodeEncrypted` | `string` | No          | Autorización cifrada para cargos recurrentes.      |
| `emailTokenEncrypted`        | `string` | No          | Token cifrado para gestionar la suscripción.       |

### `paystackSubscription`

| Campo                  | Tipo      | Obligatorio | Descripción                                                             |
| :--------------------- | :-------- | :---------- | :---------------------------------------------------------------------- |
| `plan`                 | `string`  | Sí          | Nombre del plan activo en minúsculas.                                   |
| `referenceId`          | `string`  | Sí          | ID asociado de usuario u organización.                                  |
| `userId`               | `string`  | Sí          | Usuario que inició el checkout de la suscripción.                       |
| `customerCode`         | `string`  | No          | Código del cliente de Paystack para esta suscripción.                   |
| `subscriptionCode`     | `string`  | No          | Código único de la suscripción, por ejemplo, `SUB_...` o `LOC_...`.     |
| `transactionReference` | `string`  | No          | Referencia de la transacción que inició la suscripción.                 |
| `planCode`             | `string`  | No          | Código del plan de Paystack cuando la suscripción la gestiona Paystack. |
| `status`               | `string`  | Sí          | `active`, `trialing`, `canceled` o `incomplete`.                        |
| `periodStart`          | `Date`    | No          | Fecha de inicio del periodo de facturación actual.                      |
| `periodEnd`            | `Date`    | No          | Fecha de fin del periodo de facturación actual.                         |
| `trialStart`           | `Date`    | No          | Fecha de inicio del periodo de prueba.                                  |
| `trialEnd`             | `Date`    | No          | Fecha de fin del periodo de prueba.                                     |
| `cancelAtPeriodEnd`    | `boolean` | No          | Indica si se cancelará al terminar el periodo actual.                   |
| `cancelAt`             | `Date`    | No          | Fecha y hora de la cancelación programada.                              |
| `canceledAt`           | `Date`    | No          | Fecha y hora de cancelación.                                            |
| `endedAt`              | `Date`    | No          | Fecha y hora de finalización de la suscripción.                         |
| `billingInterval`      | `string`  | No          | Intervalo de facturación del plan.                                      |
| `groupId`              | `string`  | No          | Grupo de suscripción opcional.                                          |
| `pendingPlan`          | `string`  | No          | Plan pendiente para un cambio futuro del ciclo de vida.                 |
| `seats`                | `number`  | No          | Número de plazas compradas para la facturación de equipos.              |
| `createdAt`            | `Date`    | Sí          | Fecha y hora de creación del registro.                                  |
| `updatedAt`            | `Date`    | Sí          | Fecha y hora de actualización del registro.                             |

### `paystackTransaction`

| Campo         | Tipo     | Obligatorio | Descripción                                      |
| :------------ | :------- | :---------- | :----------------------------------------------- |
| `reference`   | `string` | Sí          | Referencia única de la transacción.              |
| `referenceId` | `string` | Sí          | ID asociado de usuario u organización.           |
| `userId`      | `string` | Sí          | ID del usuario que inició la transacción.        |
| `amount`      | `number` | Sí          | Importe en la unidad monetaria mínima.           |
| `currency`    | `string` | Sí          | Código de moneda, por ejemplo, `NGN`.            |
| `status`      | `string` | Sí          | `success`, `pending`, `failed` o `abandoned`.    |
| `plan`        | `string` | No          | Nombre del plan asociado a la transacción.       |
| `product`     | `string` | No          | Nombre del producto asociado a la transacción.   |
| `metadata`    | `string` | No          | Metadatos adicionales de la transacción en JSON. |
| `paystackId`  | `string` | No          | ID interno de la transacción en Paystack.        |
| `createdAt`   | `Date`   | Sí          | Fecha y hora de creación de la transacción.      |
| `updatedAt`   | `Date`   | Sí          | Fecha y hora de la última actualización.         |

### `paystackProduct`

| Campo         | Tipo      | Obligatorio | Descripción                                 |
| :------------ | :-------- | :---------- | :------------------------------------------ |
| `name`        | `string`  | Sí          | Nombre del producto.                        |
| `description` | `string`  | No          | Descripción del producto.                   |
| `price`       | `number`  | Sí          | Precio en la unidad monetaria mínima.       |
| `currency`    | `string`  | Sí          | Código de moneda, por ejemplo, `NGN`.       |
| `quantity`    | `number`  | No          | Cantidad disponible en inventario.          |
| `unlimited`   | `boolean` | No          | Indica si el inventario es ilimitado.       |
| `paystackId`  | `string`  | No          | ID interno del producto en Paystack.        |
| `slug`        | `string`  | Sí          | Identificador legible y único del producto. |
| `metadata`    | `string`  | No          | Metadatos adicionales del producto en JSON. |
| `createdAt`   | `Date`    | Sí          | Fecha y hora de creación del producto.      |
| `updatedAt`   | `Date`    | Sí          | Fecha y hora de la última actualización.    |

### `paystackWebhookEvent`

El plugin registra las entregas de webhooks verificadas con su tipo de evento, carga útil original, referencia (si está disponible),
estado de procesamiento y fecha de procesamiento. Esta tabla tiene un espacio de nombres propio del proveedor para que
los plugins de Paystack y Flutterwave puedan instalarse a la vez sin compartir el estado de los webhooks.

| Campo         | Tipo     | Obligatorio | Descripción                                       |
| :------------ | :------- | :---------- | :------------------------------------------------ |
| `eventId`     | `string` | Sí          | Hash estable de la carga útil verificada exacta.  |
| `eventType`   | `string` | Sí          | Nombre del evento de Paystack.                    |
| `reference`   | `string` | No          | Referencia de la transacción, si está disponible. |
| `payload`     | `string` | Sí          | Carga útil original exacta del webhook.           |
| `status`      | `string` | Sí          | `pending` o `processed`.                          |
| `processedAt` | `Date`   | No          | Fecha y hora en que terminó el procesamiento.     |

### Migración del esquema v4

Después de actualizar el paquete, genera o aplica primero el esquema de Better Auth y, a continuación, ejecuta
esta operación, que solo debe realizarse desde el servidor de confianza:

```ts
import { migratePaystackSubscriptionSchema } from "better-auth-paystack";

const report = await migratePaystackSubscriptionSchema(ctx, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  credentialEncryptionKey: process.env.PAYSTACK_CREDENTIAL_ENCRYPTION_KEY,
});
```

Sigue este orden:

1. Actualiza el paquete.
2. Genera o migra el esquema de Better Auth.
3. Ejecuta `migratePaystackSubscriptionSchema()` desde una tarea de servidor de confianza.
4. Comprueba los recuentos de la migración y el funcionamiento de la facturación.
5. Elimina manualmente las columnas o tablas heredadas solo después de verificar el resultado.

La operación conserva los registros heredados, mantiene los ID de suscripción originales cuando es posible, omite los registros
ya migrados, cifra los tokens heredados de autorización y correo electrónico, e informa de fallos parciales para que
puedas reintentar más adelante.

Durante el periodo de compatibilidad, la resolución de clientes todavía puede leer los códigos de cliente heredados
de las tablas de autenticación. Elimina esas columnas heredadas manualmente cuando hayas verificado la migración.

---

## Solución de problemas

- **Firma del webhook**: comprueba que `PAYSTACK_SECRET_KEY` coincida con la integración que envía el webhook. Paystack usa esta clave secreta de API para `x-paystack-signature`.
- **Verificación del correo electrónico**: utiliza `requireEmailVerification: true` para evitar checkouts de usuarios sin verificar.
- **Fallos de redirección**: comprueba la consola del navegador; Paystack suele devolver errores 429 si se hacen demasiadas solicitudes seguidas a la API de pruebas.
- **Referencias que no coinciden**: asegúrate de pasar correctamente `referenceId` al facturar a una organización.
- **Autorización denegada**: comprueba que `authorizeReference` verifique correctamente los roles o las membresías de la organización. Para evitar filtraciones de datos, las solicitudes no autorizadas de verificación de transacciones devuelven `401 Unauthorized`.

### Índices de la base de datos

El esquema del plugin incluye índices recomendados y restricciones de unicidad para mejorar el rendimiento. Al ejecutar `npx better-auth migrate`, se aplican automáticamente a la base de datos.

Después de actualizar, ejecuta `npx better-auth migrate` (o `npx better-auth generate` para adaptadores que gestionan el esquema).
Las columnas aditivas `cancelAt`, `canceledAt`, `endedAt` y `billingInterval` de la suscripción
aceptan valores nulos; los registros históricos se completan al procesarse eventos futuros del ciclo de vida.

Los siguientes campos están indexados:

- **`paystackTransaction`**: `reference` (único), `userId` y `referenceId`.
- **`paystackSubscription`**: `subscriptionCode` (único), `referenceId`, `transactionReference`, `customerCode` y `plan`.
- **`paystackCustomer`**: `referenceKey` (único), `referenceId` y `customerCode` (único).
- **`paystackPaymentCredential`**: `subscriptionId` (único).
- **`paystackProduct`**: `slug` (único) y `paystackId` (único).

Las mejoras prorrateadas y los cargos de renovación de confianza también guardan registros en `paystackTransaction`, por lo que el historial local de transacciones refleja los cargos correctos procesados sin intervención del cliente.

### Sincronización de productos

El plugin ofrece dos formas de mantener el inventario de productos sincronizado con Paystack:

#### 1. Sincronización automática del inventario

Cada vez que se realiza correctamente un pago único, ya sea mediante un webhook o una verificación manual, el plugin llama automáticamente a `syncProductQuantityFromPaystack`. Este método consulta las existencias actuales en la API de Paystack y actualiza el registro local para que el inventario esté siempre al día.

#### 2. Sincronización masiva manual desde el servidor

El endpoint público `/paystack/sync-products` se eliminó en la versión `2.0.0`.
En su lugar, ejecuta esta operación de servidor de confianza desde el backend:

```ts
import { syncPaystackProducts } from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await syncPaystackProducts(ctx, paystackOptions);
```

### Nota de compatibilidad del SDK

El plugin utiliza directamente la API agrupada del SDK oficial `@alexasomba/paystack-node`.
Si inyectas un cliente personalizado, debe implementar los métodos reales que utiliza el plugin, como `transaction.initialize`, `transaction.verify`, `transaction.chargeAuthorization`, `subscription.create`, `subscription.disable` y `subscription.enable`.

---

## 🏗️ Desarrollo y contribución

Este repositorio utiliza **Vite+**. La CLI `vp` permite gestionar todo el espacio de trabajo.

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

¡Las contribuciones son bienvenidas! Abre una incidencia o un pull request.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para obtener más información.

## Hoja de ruta

Próximas funcionalidades previstas:

### v1.1.0: renovaciones recurrentes manuales (disponibles ahora)

- [x] **Códigos de autorización guardados**: almacena de forma segura los códigos de autorización de Paystack obtenidos de transacciones verificadas.
- [x] **Operación de renovación de confianza**: función de servidor para cobrar renovaciones a tarjetas guardadas.
- [ ] **Interfaz de gestión de tarjetas**: permite a los usuarios consultar o eliminar los métodos de pago guardados, mostrando solo los datos enmascarados. _Próximamente_
- [ ] **Integración con un programador de renovaciones**: documentación para integrar Cloudflare Workers Cron, Vercel Cron y otros. _Próximamente_

> **Nota**: En las suscripciones gestionadas localmente (sin `planCode`), el plugin captura y guarda automáticamente el campo `authorization_code`. Inicia las renovaciones desde código de backend de confianza con `chargeSubscriptionRenewal(...)`.

### Ideas para el futuro

- [ ] Mejoras en la compatibilidad con varias monedas
- [ ] Generación de facturas
- [ ] Reintentos de pago para renovaciones fallidas

## Enlaces

- Repositorio de GitHub: [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- SDK de Paystack para Node.js, completo y actualizado: [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- SDK integrado de Paystack, completo y actualizado: [alexasomba/paystack-inline](https://github.com/alexasomba/paystack-inline)
- [Ejemplo de implementación con TanStack Start](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)
- Webhooks de Paystack: https://paystack.com/docs/payments/webhooks/
- API de transacciones de Paystack: https://paystack.com/docs/api/transaction/
- API de suscripciones de Paystack: https://paystack.com/docs/api/subscription/
- API de planes de Paystack: https://paystack.com/docs/api/plan/
- [Documentación de Better Auth](https://www.better-auth.com/docs)

### Hooks opcionales para operaciones de suscripción

`subscription.operationHooks` permite que la aplicación establezca su propio mecanismo duradero para reservar y recuperar operaciones de planes. Es opcional: si no se configura, se mantiene el comportamiento actual del SDK. El SDK no proporciona un registro transaccional, un mutex ni garantías de idempotencia entre solicitudes.

El hook `before(operation, ctx)` se ejecuta después de autenticar, autorizar la referencia y validar el plan, las plazas, el periodo de prueba y el prorrateo aplicables. Se ejecuta antes de iniciar o cobrar al proveedor y antes de modificar un plan o una programación local. `operation` incluye al usuario que realiza la operación, la referencia autorizada, la suscripción seleccionada, el tipo de operación y la intención validada. La programación tiene una comprobación previa independiente antes de modificar el estado local.

Devuelve uno de estos valores:

- `{ kind: "proceed", providerReference, context? }`: proporciona una referencia estable reservada por la aplicación. El SDK la utiliza en el checkout normal, el checkout prorrateado y el cargo con autorización guardada. `context` solo existe durante esta invocación y se pasa a los hooks de finalización y error.
- `{ kind: "replay", result }`: devuelve un `PaystackInitializeResult` existente del tipo de operación correspondiente, sin llamar al proveedor ni escribir en el SDK.
- `{ kind: "block", message? }`: rechaza la operación sin enviarla al proveedor ni modificar datos.

`after(operation, ctx)` recibe el resultado solo cuando terminan las escrituras del SDK. `onError(operation, ctx)` recibe el error original y una fase: `provider`, `persistence` o `completion`. Un timeout del proveedor, una referencia incorrecta o que no coincida, un fallo de persistencia posterior al pago o un fallo del hook de finalización no demuestran que no se haya realizado el pago. Conserva la reserva pendiente de la aplicación y concíliala; no repitas el cargo automáticamente. Si falla el hook de error, el fallo se registra en los registros y no sustituye al error original.

Los hooks solo se ejecutan en el servidor. Antes de devolver datos guardados para repetir un checkout, autentica y autoriza al actor y a la referencia actuales; las URL de autorización y los códigos de acceso no deben aparecer en consultas de estado públicas. No incluyas credenciales del proveedor en el contexto del hook. El SDK conserva sus reglas de autorización de referencias; cada aplicación sigue siendo responsable de aplicar permisos de interfaz más estrictos si los necesita.

Para denegar la operación de forma segura si el servicio de reservas de la aplicación no está disponible:

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

Una implementación de producción de `proceed` debe reservar antes de devolver, deduplicar solicitudes concurrentes, proteger los resultados que se repetirán y resolver los resultados inciertos consultando el estado autoritativo del proveedor y de la suscripción. Los pagos únicos de productos o importes y las operaciones de renovación recurrente no utilizan estos hooks de planes de suscripción.

### Precios y entrega de webhooks

Los precios y las monedas del checkout se obtienen de los planes y productos del catálogo. Los valores de `amount` y `currency` del cliente solo se aplican a pagos de importe libre; las cantidades de productos y las plazas de los planes usan precios del servidor. Las operaciones de renovación de suscripciones también obtienen el importe del plan configurado.

El procesamiento de webhooks requiere la tabla `paystackWebhookEvent`, incluida su restricción única `eventId`. Las entregas reservan el procesamiento del evento mediante una actualización condicional de la base de datos; los cambios incompletos o los fallos de callbacks devuelven HTTP 503 y se pueden reintentar. La reserva caduca a los cinco minutos para permitir la recuperación tras un fallo. Los callbacks deben ser idempotentes por referencia de transacción o evento, porque un fallo tras un efecto externo puede provocar un reintento. La verificación histórica de transacciones correctas no reactiva suscripciones canceladas ni reinicia un periodo de facturación que ya está activo.
