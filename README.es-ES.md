

# Plugin Paystack para Better Auth

Un plugin con prioridad en TypeScript que integra Paystack en [Better Auth](https://www.better-auth.com), proporcionando un sistema de facturación listo para producción con soporte para suscripciones (nativas y locales), pagos únicos, períodos de prueba, facturación por organizaciones y webhooks seguros.

<div align="center">

![npm downloads](https://img.shields.io/npm/dm/better-auth-paystack.svg)
[![GitHub stars](https://img.shields.io/github/stars/alexasomba/better-auth-paystack.svg?style=social&label=Star)](https://github.com/alexasomba/better-auth-paystack/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/alexasomba/better-auth-paystack)](https://github.com/alexasomba/better-auth-paystack/releases)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/better-auth-paystack)](https://bundlephobia.com/result?p=better-auth-paystack)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexasomba?style=social)](https://twitter.com/alexasomba)
![GitHub License](https://img.shields.io/github/license/alexasomba/better-auth-paystack)

</div>

[**Demo en Vivo (Tanstack Start)**](https://better-auth-paystack.gittech.workers.dev) | [**Código Fuente**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## Habilidades para Agentes de IA

Este paquete publica habilidades para agentes, por lo que los agentes de codificación con IA pueden cargar orientaciones específicas del paquete para la configuración, suscripciones, facturación por organizaciones, integración con TanStack Start, APIs del cliente, webhooks, ciclo de vida de suscripciones locales, cambios de esquema y pruebas.

Utiliza [TanStack Intent](https://www.npmjs.com/package/@tanstack/intent) cuando quieras listar o cargar habilidades individuales explícitamente:

```bash
npx @tanstack/intent@latest list
npx @tanstack/intent@latest load better-auth-paystack#better-auth-paystack-setup
npx @tanstack/intent@latest load better-auth-paystack#paystack-testing-fixtures
```

Si utilizas un agente de IA, ejecuta `npx @tanstack/intent@latest install` en tu proyecto para que el agente sepa cómo descubrir las habilidades del paquete.

Este paquete también incluye habilidades en el paquete npm bajo `skills/*/SKILL.md`, por lo que los proyectos pueden usar [skills-npm](https://www.npmjs.com/package/skills-npm) para crear enlaces simbólicos de las habilidades del paquete instalado para agentes compatibles:

```bash
npm install better-auth-paystack
npx skills-npm --yes
```

Para este repositorio, los mantenedores pueden ejecutar `pnpm run skills:dry-run` para previsualizar el descubrimiento a través del fixture de ejemplo de TanStack o `pnpm run skills:install` para crear enlaces simbólicos locales de habilidades para agentes a partir de ese fixture.

## Características

- [x] **Patrones de Facturación**: Soporte para planes nativos de Paystack, suscripciones gestionadas localmente y pagos únicos (productos/montos).
- [x] **Creación Automática de Clientes**: Creación opcional de clientes en Paystack al registrarse un usuario o crear una organización.
- [x] **Gestión de Períodos de Prueba**: Períodos de prueba configurables con lógica integrada para prevenir abusos.
- [x] **Facturación por Organizaciones**: Asocia suscripciones con organizaciones y autoriza el acceso mediante roles.
- [x] **Controles de Canal de Suscripción**: Restringe el pago de suscripciones a canales específicos de pago de Paystack, como solo tarjetas.
- [x] **Límites y Asientos Aplicados**: Aplicación automática de mejoras de asientos de miembros y límites de recursos (equipos).
- [x] **Cambios Programados**: Pospon actualizaciones o cancelaciones de suscripciones hasta el final del ciclo de facturación.
- [x] **Prorrata**: Mejoras prorrateadas inmediatas a mitad de ciclo para planes locales, utilizando cargos con tarjeta guardada cuando sea posible y respaldo a checkout cuando se requiera pago interactivo.
- [x] **Flujo Modal Emergente**: Soporte opcional para la experiencia de pago en línea de Paystack mediante `@alexasomba/paystack-inline`.
- [x] **Seguridad de Webhooks**: Verificación de firma preconfigurada (HMAC-SHA512) y listado blanco de IPs opcional.
- [x] **Historial de Transacciones**: Soporte integrado para listar y ver registros de transacciones locales.

---

## Inicio Rápido

### Prerrequisitos

- **Node.js**: `v22.0.0` o superior.
- **Better Auth**: `v1.6.9` o superior.

### 1. Instalar Plugin y SDKs

```bash
npm install better-auth better-auth-paystack @alexasomba/paystack-node
```

#### Migración desde el paquete con scope

Reemplaza la dependencia con scope por el paquete sin scope:

```bash
npm uninstall @alexasomba/better-auth-paystack
npm install better-auth-paystack
```

Luego actualiza las importaciones de `@alexasomba/better-auth-paystack` a `better-auth-paystack` y de
`@alexasomba/better-auth-paystack/client` a `better-auth-paystack/client`.

Esto es una migración de nombre de paquete. La versión v4 también mueve los datos de facturación de Paystack a
tablas propiedad del proveedor. Los nombres de rutas del cliente existentes permanecen compatibles, pero se requiere una migración
de base de datos y la operación de migración confiable descrita a continuación.

#### Opcional: SDK para Navegador (para Modales Emergentes)

```bash
npm install @alexasomba/paystack-inline
```

### 2. Configurar Variables de Entorno

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
```

### 3. Configurar Plugin del Servidor

```ts title="auth.ts"
import { betterAuth } from "better-auth";
import { paystack } from "better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";
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
        allowedPaymentChannels: ["card"], // Opcional: forzar suscripciones solo con tarjeta
        plans: [
          {
            name: "pro",
            group: "workspace", // Opcional: una suscripción activa/en prueba por grupo
            planCode: "PLN_pro_123", // Nativo: Gestionado por Paystack
            freeTrial: { days: 14 },
            limits: { teams: 5, seats: 10 }, // Límites personalizados de recursos y miembros
          },
          {
            name: "starter",
            amount: 50000, // Local: Gestionado por tu app (500 NGN)
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

Paystack firma las cargas útiles de los webhooks con la misma `PAYSTACK_SECRET_KEY` utilizada para la autenticación de la API;
no hay un secreto de webhook separado. Las opciones heredadas `webhook.secret` y `paystackWebhookSecret`
se aceptan por compatibilidad de código fuente pero se ignoran.

### 4. Configurar Plugin del Cliente

```ts title="client.ts"
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "better-auth-paystack/client";
import { adminClient } from "better-auth/client/plugins";

export const client = createAuthClient({
  plugins: [adminClient(), paystackClient({ subscription: true })],
});
```

### 5. Migrar Esquema de Base de Datos

```bash
npx better-auth migrate
```

---

## Guía de Migración

La versión `2.0.0` contiene un cambio incompatible centrado en la seguridad.

- Acciones de operador públicas/para cliente eliminadas:
  - `authClient.paystack.syncProducts()`
  - `authClient.paystack.syncPlans()`
  - `authClient.paystack.chargeRecurringSubscription(...)`
- Endpoints públicos de Better Auth eliminados para:
  - `/paystack/sync-products`
  - `/paystack/sync-plans`
  - `/paystack/charge-recurring`
- Operaciones del servidor confiables añadidas:
  - `chargeSubscriptionRenewal`
  - `syncPaystackProducts`
  - `syncPaystackPlans`

### Anterior

```ts
await authClient.paystack.syncProducts();
await authClient.paystack.syncPlans();
await authClient.paystack.chargeRecurringSubscription({
  subscriptionId: "sub_123",
});
```

### Nuevo

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

Estas operaciones son exclusivamente para servidor intencionalmente. No las expongas a través de llamadas al cliente de autenticación iniciadas desde el navegador.

---

## Patrones de Facturación

### 1. Suscripciones

#### Nativas (Recomendadas)

Utiliza `planCode` desde tu Panel de Paystack. Paystack gestiona la lógica recurrente y los correos electrónicos.

```ts
{ name: "pro", planCode: "PLN_xxx" }
```

#### Locales

Utiliza `amount` e `interval`. El plugin almacena el estado localmente, permitiéndote gestionar lógica recurrente personalizada o "períodos de acceso" únicos.

```ts
{ name: "starter", amount: 50000, interval: "monthly" }
```

### 2. Pagos Únicos

#### Productos Fijos

Define productos preconfigurados en la configuración de tu servidor y cómpralos por nombre.

```ts
await authClient.paystack.transaction.initialize({
  product: "credits_50",
});
```

#### Montos Ad-hoc

Cobra montos dinámicos para recargas, propinas o facturas personalizadas.

```ts
await authClient.paystack.transaction.initialize({
  amount: 100000, // 1000 NGN
  currency: "NGN",
  metadata: { type: "donation" },
});
```

---

## Gestión de Límites y Asientos

El plugin aplica automáticamente los límites en suscripciones activas y en período de prueba. Cuando múltiples
grupos de suscripción definen el mismo límite numérico, prevalece el valor más alto; las características de los planes
se combinan.

### Límites de Asientos de Miembros

Los asientos comprados se almacenan en el campo `subscription.seats`. El plugin se conecta a `member.create` y `invitation.create` para bloquear adiciones una vez alcanzado el límite.

### Límites de Recursos (ej., Equipos)

Define los límites en la configuración de tu plan, y se verificarán durante la creación de recursos:

```ts
plans: [{ name: "pro", limits: { teams: 5, seats: 10 } }];
```

El plugin verifica nativamente el límite de `teams` si se utiliza el plugin de Organización de Better Auth.

### Grupos de Suscripción

Establece `group` en planes relacionados cuando un usuario u organización pueda poseer suscripciones independientes:

```ts
plans: [
  { name: "pro", group: "workspace", planCode: "PLN_pro" },
  { name: "priority-support", group: "support", planCode: "PLN_support" },
];
```

Los nombres de los grupos se recortan y convierten a minúsculas. Una referencia puede tener una suscripción activa o en prueba por grupo. Los planes sin `group` permanecen en el grupo predeterminado heredado, representado por un `subscription.groupId` anulable, por lo que las configuraciones existentes conservan su comportamiento anterior de suscripción única.

---

## Soporte de Monedas

El plugin admite las siguientes monedas con validación automática del monto mínimo de transacción:

| Moneda | Nombre                   | Monto Mínimo |
| -------- | ---------------------- | -------------- |
| **NGN**  | Naira Nigeriano         | ₦50.00         |
| **GHS**  | Cedi Ghanés          | ₵0.10          |
| **ZAR**  | Rand Sudafricano     | R1.00          |
| **KES**  | Chelín Keniano        | KSh 3.00       |
| **USD**  | Dólar Estadounidense   | $2.00          |
| **XOF**  | Franco CFA Occidental | CFA 100        |

Las transacciones por debajo de estos umbrales se rechazarán con un error `BAD_REQUEST`.

## Uso Avanzado

### Facturación por Organizaciones

Habilita `organization.enabled` para facturar a organizaciones en lugar de usuarios.

- **Cliente Automático**: Las organizaciones obtienen su propio registro `paystackCustomer` propiedad del proveedor.
- **Autorización**: Los propietarios y administradores de la organización pueden gestionar la facturación de forma predeterminada. Utiliza `organization.billingRoles` para extender la lista de roles confiables, o `subscription.authorizeReference` cuando necesites una autorización totalmente personalizada.

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

### Modal Emergente en Línea

Utiliza `@alexasomba/paystack-inline` para una interfaz de usuario sin interrupciones.

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

### Cambios Programados y Cancelación

Pospon los cambios hasta el final del ciclo de facturación actual:

- **Mejoras**: Pasa `scheduleAtPeriodEnd: true` en `initializeTransaction()`.
- **Cancelaciones**: Utiliza `authClient.subscription.cancel({ subscriptionCode, atPeriodEnd: true })` para mantener la suscripción activa hasta que finalice el período.

### Prorrata a Mitad de Ciclo (`prorateAndCharge`)

El plugin puede calcular dinámicamente la diferencia de costo para mejoras inmediatas a mitad de ciclo (como agregar más asientos).
Para planes gestionados localmente:

- Si la suscripción ya tiene un código de autorización reutilizable de Paystack, el plugin cobra el delta prorrateado fuera de sesión, registra una `paystackTransaction` local y actualiza inmediatamente la suscripción.
- Si no hay un código de autorización reutilizable disponible (por ejemplo, pagos basados en transferencia), el plugin inicializa un nuevo checkout para el delta prorrateado en lugar de mejorar silenciosamente sin pago.
- Si el monto prorrateado está por debajo del cargo mínimo de Paystack para la moneda, se rechaza la solicitud para que puedas programar el cambio para el final del período en lugar de cobrar menos.

```ts
const { data } = await authClient.paystack.transaction.initialize({
  plan: "pro",
  quantity: 5, // Mejorando asientos
  prorateAndCharge: true, // Cobra autorización guardada o devuelve una redirección de checkout para el delta
});

if (data?.kind === "checkout") {
  window.location.href = data.url;
}

if (data?.kind === "prorated") {
  console.log(data.message);
}
```

Cuando el flujo recurre al checkout, verifica la referencia de transacción devuelta después del pago. El plugin utiliza los metadatos de prorrata almacenados para aplicar el cambio pendiente de plan/asiento solo después de una verificación exitosa.

### Restricción de Canales de Pago de Suscripción

Utiliza `subscription.allowedPaymentChannels` para limitar qué canales de checkout de Paystack pueden usarse en flujos de suscripción.
Esto se aplica al checkout estándar de suscripción, flujos de autorización de prueba y recurrencias de checkout interactivo de prorrata.

```ts
paystack({
  subscription: {
    enabled: true,
    allowedPaymentChannels: ["card"],
    plans: [{ name: "starter", amount: 50000, currency: "NGN", interval: "monthly" }],
  },
});
```

Si un pago de suscripción se verifica posteriormente con un canal no permitido, el plugin rechaza la activación en lugar de crear la suscripción silenciosamente.

### Seguridad de Webhooks

Las entregas de webhooks se persisten en la tabla específica del proveedor `paystackWebhookEvent` utilizando un
hash estable de la carga útil cruda verificada. Las entregas duplicadas que ya se procesaron se reconocen sin ejecutar
nuevamente los efectos secundarios de facturación. Las entregas fallidas o interrumpidas permanecen
pendientes para conciliación o manejo de reenvío posterior.

El plugin verifica automáticamente el encabezado `x-paystack-signature` para garantizar que los eventos sean auténticos. Para una capa adicional de seguridad, puedes habilitar la **Lista Blanca de IPs** para restringir el procesamiento a los servidores oficiales de Paystack.

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  webhook: {
    verifyIP: true, // Habilita la lista blanca de IPs (predeterminado a false para soporte flexible de proxy)
    trustedIPs: ["52.31.139.75", "52.49.173.169", "52.214.14.220"], // Opcional: anular IPs confiables
  },
});
```

Las firmas de webhook siempre se verifican con `secretKey`, como exige Paystack. No crees ni
configures un `PAYSTACK_WEBHOOK_SECRET` separado.

### Prevención de Abuso de Períodos de Prueba

El plugin verifica el historial de `referenceId`. Si un período de prueba se utilizó alguna vez (activo, expirado o en curso), no se otorgará nuevamente, previniendo el abuso de suscripción repetida.

### Ganchos de Ciclo de Vida (Hooks)

Reacciona a eventos de facturación en el servidor proporcionando callbacks en tu configuración:

#### Ganchos de Suscripción (`subscription.*`)

- `onSubscriptionComplete`: Se llama después de una verificación exitosa de transacción (Nativa o Local).
- `onSubscriptionCreated`: Se llama cuando un registro de suscripción se inicializa por primera vez en la BD.
- `onSubscriptionUpdate`: Se llama después de un cambio persistente de ciclo de vida.
- `onSubscriptionCancel`: Se llama cuando un usuario u organización cancela su suscripción.

#### Ganchos de Cliente (`top-level` o `organization.*`)

- `onCustomerCreate`: Se llama después de que el plugin crea exitosamente un cliente en Paystack.
- `getCustomerCreateParams`: Devuelve un objeto personalizado para anular/ampliar los datos enviados a Paystack durante la creación del cliente.

#### Ganchos de Prueba (`subscription.plans[].freeTrial.*`)

- `onTrialStart`: Se llama cuando comienza un nuevo período de prueba.
- `onTrialEnd`: Se llama cuando una prueba se convierte en una suscripción activa.
- `onTrialExpired`: Se llama cuando una prueba finaliza sin conversión.

Los fallos en las callbacks de la aplicación se registran después de que el estado de facturación se persiste y no causan que un
webhook de Paystack válido sea reenviado.

#### Gancho Global

- `onEvent`: Recibe cada carga útil de evento de webhook enviada desde Paystack para procesamiento personalizado.

### Operaciones de Servidor Confiables

Las renovaciones recurrentes y la sincronización del catálogo de Paystack no se exponen intencionalmente a través del cliente de autenticación del navegador.
Invócalas solo desde código backend confiable:

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

Utiliza `reconcilePaystackTransaction` desde manejadores de webhook, reintentos de cola, trabajos cron o acciones administrativas cuando el código del servidor confiable necesite la misma verificación y efectos secundarios locales de transacción/suscripción que el endpoint de verificación del navegador.

### Autorización y Seguridad

#### `authorizeReference`

Controla quién puede gestionar la facturación para referencias específicas (Usuarios u Organizaciones).

```ts
paystack({
  subscription: {
    authorizeReference: async ({ user, referenceId, action }) => {
      // Ejemplo: Solo permitir a Admins de Org inicializar transacciones
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

## Referencia del SDK del Cliente

El plugin del cliente expone métodos canónicos completamente tipados bajo `authClient.paystack`, `authClient.transaction` y `authClient.subscription`.

- `authClient.transaction.initialize`, `verify`, `list`
- `authClient.subscription.create`, `upgrade`, `cancel`, `restore`, `list`, `billingPortal`
- `authClient.paystack.config`, `listProducts`, `listPlans`, más las utilidades de transacción/suscripción mencionadas arriba

Los alias de compatibilidad heredada permanecen disponibles para la migración, pero el nuevo código debe usar los métodos canónicos:

- `authClient.subscription.disable(...)` -> usa `authClient.subscription.cancel(...)`
- `authClient.subscription.enable(...)` -> usa `authClient.subscription.restore(...)`

### `authClient.subscription.upgrade` / `create`

Inicializa una transacción para crear o mejorar una suscripción.

```ts
type upgradeSubscription = {
  /**
   * El nombre del plan al suscribirse.
   */
  plan: string;
  /**
   * El correo del suscriptor. Por defecto el correo del usuario actual.
   */
  email?: string;
  /**
   * Monto a cobrar (si no se usa un Código de Plan de Paystack).
   */
  amount?: number;
  /**
   * Código de moneda (ej. "NGN").
   */
  currency?: string;
  /**
   * La URL de callback a la que redirigir después del pago.
   */
  callbackURL?: string;
  /**
   * Metadatos adicionales para almacenar con la transacción.
   */
  metadata?: Record<string, unknown>;
  /**
   * ID de referencia para el propietario de la suscripción (ID de Usuario o ID de Org).
   * Por defecto el ID del usuario actual.
   */
  referenceId?: string;
  /**
   * Número de asientos a comprar (para planes de equipo).
   */
  quantity?: number;
};
```

### `authClient.paystack.transaction.initialize`

Igual que `upgrade`, pero también se puede usar para pagos únicos omitiendo `plan` y proporcionando `amount` o `product`.

```ts
type initializeTransaction = {
  /**
   * Nombre del plan (para suscripciones).
   */
  plan?: string;
  /**
   * Nombre del producto (para compras únicas).
   */
  product?: string;
  /**
   * Monto a cobrar (si se envía monto crudo).
   */
  amount?: number;
  /**
   * Para suscripciones locales existentes, calcula un delta a mitad de ciclo y ya sea
   * cobra la autorización guardada o devuelve una redirección de checkout para pago interactivo.
   */
  prorateAndCharge?: boolean;
  // ... igual que upgradeSubscription
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

Lista suscripciones para un usuario u organización. Las acciones de facturación con alcance a organización requieren membresía de propietario/admin por defecto. Para permitir roles como `billing`, configura `organization.billingRoles`. Para recursos personalizados o comprobaciones de políticas más profundas, configura `subscription.authorizeReference`.

```ts
type listSubscriptions = {
  query?: {
    /**
     * Filtra por ID de referencia (ID de Usuario o ID de Org).
     */
    referenceId?: string;
  };
};
```

### `authClient.subscription.cancel` / `restore`

Cancela o restaura una suscripción.

- **Cancelar**: Establece `cancelAtPeriodEnd: true`. La suscripción permanece `active` hasta el final del período de facturación actual, después del cual pasa a `canceled`.
- **Restaurar**: Reactiva una suscripción programada para cancelarse.

```ts
type cancelSubscription = {
  /**
   * Propietario de referencia opcional (ID de usuario o ID de org) al gestionar otra entidad de facturación.
   */
  referenceId?: string;
  /**
   * El código de suscripción de Paystack (ej. SUB_...)
   */
  subscriptionCode: string;
  /**
   * El token de correo requerido por Paystack para gestionar la suscripción.
   * Opcional: El servidor intentará obtenerlo si se omite.
   */
  emailToken?: string;
  /**
   * Cuando es true, mantiene la suscripción activa hasta que finalice el período actual.
   */
  atPeriodEnd?: boolean;
};
```

## Referencia de Esquema

El plugin extiende tu base de datos con los siguientes campos y tablas.

### `user` y `organization`

Los códigos de cliente de Paystack ya no se agregan a las tablas de autenticación de Better Auth. El `email` de la organización
permanece disponible como respaldo para facturación.

| Campo   | Tipo     | Requerido | Descripción                                                                        |
| :------ | :------- | :------- | :--------------------------------------------------------------------------------- |
| `email` | `string` | No       | El correo de facturación para la organización. Retrocede al correo del propietario si está ausente. |

### `paystackCustomer`

| Campo           | Tipo     | Requerido | Descripción                          |
| :-------------- | :------- | :------- | :----------------------------------- |
| `referenceType` | `string` | Sí      | `user` u `organization`.            |
| `referenceId`   | `string` | Sí      | Identificador de Better Auth propietario.       |
| `referenceKey`  | `string` | Sí      | Clave de referencia única propiedad del proveedor. |
| `customerCode`  | `string` | Sí      | Código de cliente de Paystack.              |
| `email`         | `string` | No       | Correo de facturación.                       |

### `paystackPaymentCredential`

Las credenciales de pago se almacenan por separado como texto cifrado AES-256-GCM. Los valores en texto plano no se
devuelven por APIs de suscripción, callbacks, registros o acciones del cliente. Establece `credentialEncryptionKey`
en un secreto dedicado de producción; el plugin recurre a `secretKey` por compatibilidad.

| Campo                        | Tipo     | Requerido | Descripción                               |
| :--------------------------- | :------- | :------- | :---------------------------------------- |
| `subscriptionId`             | `string` | Sí      | ID único de suscripción de Paystack.          |
| `authorizationCodeEncrypted` | `string` | No       | Autorización cifrada para cargo recurrente. |
| `emailTokenEncrypted`        | `string` | No       | Token cifrado para gestión de suscripción.  |

### `paystackSubscription`

| Campo                  | Tipo      | Requerido | Descripción                                                          |
| :--------------------- | :-------- | :------- | :------------------------------------------------------------------- |
| `plan`                 | `string`  | Sí      | Nombre en minúsculas del plan activo.                                  |
| `referenceId`          | `string`  | Sí      | ID de Usuario u Organización asociado.                               |
| `userId`               | `string`  | Sí      | Usuario que inició el checkout de suscripción.                        |
| `customerCode`         | `string`  | No       | El código de cliente de Paystack para esta suscripción.                    |
| `subscriptionCode`     | `string`  | No       | El código único para la suscripción (ej. `SUB_...` o `LOC_...`). |
| `transactionReference` | `string`  | No       | La referencia de la transacción que inició la suscripción.      |
| `planCode`             | `string`  | No       | El código de plan de Paystack, cuando Paystack gestiona la suscripción.      |
| `status`               | `string`  | Sí      | `active`, `trialing`, `canceled`, `incomplete`.                      |
| `periodStart`          | `Date`    | No       | Fecha de inicio del período de facturación actual.                            |
| `periodEnd`            | `Date`    | No       | Fecha de fin del período de facturación actual.                              |
| `trialStart`           | `Date`    | No       | Fecha de inicio del período de prueba.                                      |
| `trialEnd`             | `Date`    | No       | Fecha de fin del período de prueba.                                        |
| `cancelAtPeriodEnd`    | `boolean` | No       | Si se debe cancelar al final del período actual.                  |
| `cancelAt`             | `Date`    | No       | Marca de tiempo de cancelación programada.                                    |
| `canceledAt`           | `Date`    | No       | Marca de tiempo de cancelación.                                              |
| `endedAt`              | `Date`    | No       | Marca de tiempo de finalización de suscripción.                                          |
| `billingInterval`      | `string`  | No       | Intervalo de facturación utilizado por el plan.                                   |
| `groupId`              | `string`  | No       | Grupo de suscripción opcional.                                         |
| `pendingPlan`          | `string`  | No       | Plan pendiente de un cambio futuro de ciclo de vida.                              |
| `seats`                | `number`  | No       | Cantidad de asientos comprados para facturación por equipo.                               |
| `createdAt`            | `Date`    | Sí      | Marca de tiempo de creación del registro.                                           |
| `updatedAt`            | `Date`    | Sí      | Marca de tiempo de actualización del registro.                                             |

### `paystackTransaction`

| Campo         | Tipo     | Requerido | Descripción                                          |
| :------------ | :------- | :------- | :--------------------------------------------------- |
| `reference`   | `string` | Sí      | Referencia única de transacción.                        |
| `referenceId` | `string` | Sí      | ID de Usuario u Organización asociado.               |
| `userId`      | `string` | Sí      | El ID del usuario que inició la transacción.    |
| `amount`      | `number` | Sí      | Monto de la transacción en la unidad monetaria más pequeña.        |
| `currency`    | `string` | Sí      | Código de moneda (ej. "NGN").                         |
| `status`      | `string` | Sí      | `success`, `pending`, `failed`, `abandoned`.         |
| `plan`        | `string` | No       | Nombre del plan asociado a la transacción.    |
| `product`     | `string` | No       | Nombre del producto asociado a la transacción. |
| `metadata`    | `string` | No       | Cadena JSON de metadatos adicionales de la transacción.           |
| `paystackId`  | `string` | No       | El ID interno de Paystack para la transacción.        |
| `createdAt`   | `Date`   | Sí      | Marca de tiempo de creación de la transacción.                      |
| `updatedAt`   | `Date`   | Sí      | Marca de tiempo de última actualización de la transacción.                   |

### `paystackProduct`

| Campo         | Tipo      | Requerido | Descripción                              |
| :------------ | :-------- | :------- | :--------------------------------------- |
| `name`        | `string`  | Sí      | Nombre del producto.                            |
| `description` | `string`  | No       | Descripción del producto.                     |
| `price`       | `number`  | Sí      | Precio en la unidad monetaria más pequeña.         |
| `currency`    | `string`  | Sí      | Código de moneda (ej. "NGN").             |
| `quantity`    | `number`  | No       | Cantidad de stock disponible.                |
| `unlimited`   | `boolean` | No       | Si el producto tiene stock ilimitado. |
| `paystackId`  | `string`  | No       | El ID de Producto interno de Paystack.        |
| `slug`        | `string`  | Sí      | Slug único para el producto.             |
| `metadata`    | `string`  | No       | Cadena JSON de metadatos adicionales del producto.   |
| `createdAt`   | `Date`    | Sí      | Marca de tiempo de creación del producto.              |
| `updatedAt`   | `Date`    | Sí      | Marca de tiempo de última actualización del producto.           |

### `paystackWebhookEvent`

El plugin registra las entregas de webhooks verificadas con su tipo de evento, carga útil cruda, referencia (cuando
está disponible), estado de procesamiento y marca de tiempo procesada. Esta tabla está en el espacio de nombres del proveedor para que
los plugins de Paystack y Flutterwave puedan instalarse juntos sin compartir el estado del webhook.

| Campo         | Tipo     | Requerido | Descripción                                |
| :------------ | :------- | :------- | :----------------------------------------- |
| `eventId`     | `string` | Sí      | Hash estable de la carga útil verificada exacta. |
| `eventType`   | `string` | Sí      | Nombre del evento de Paystack.                       |
| `reference`   | `string` | No       | Referencia de transacción cuando está disponible.      |
| `payload`     | `string` | Sí      | Carga útil cruda exacta del webhook.                 |
| `status`      | `string` | Sí      | `pending` o `processed`.                  |
| `processedAt` | `Date`   | No       | Marca de tiempo de finalización del procesamiento.           |

### Migración de esquema v4

Después de actualizar el paquete, genera/aplica el esquema de Better Auth primero, luego ejecuta la operación
exclusiva para servidor confiable:

```ts
import { migratePaystackSubscriptionSchema } from "better-auth-paystack";

const report = await migratePaystackSubscriptionSchema(ctx, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  credentialEncryptionKey: process.env.PAYSTACK_CREDENTIAL_ENCRYPTION_KEY,
});
```

Ejecútalo en este orden:

1. Actualiza el paquete.
2. Ejecuta la generación/migración del esquema de Better Auth.
3. Ejecuta `migratePaystackSubscriptionSchema()` desde un trabajo de servidor confiable.
4. Verifica los conteos de migración y el comportamiento de facturación.
5. Elimina las columnas/tablas heredadas manualmente solo después de la verificación.

La operación conserva las filas heredadas, mantiene los IDs de suscripción originales cuando es posible, omite registros ya migrados, cifra tokens de autorización/correo heredados e informa fallos parciales para que una ejecución posterior pueda reintentarlos.

Durante la ventana de compatibilidad, la resolución de cliente aún puede leer los códigos de cliente heredados de la tabla de autenticación. Elimina esas columnas heredadas manualmente después de que se verifique la migración.

---

## Solución de Problemas

- **Firma de Webhook**: Asegúrate de que `PAYSTACK_SECRET_KEY` coincida con la integración que envía el webhook. Paystack utiliza esta clave secreta de API para `x-paystack-signature`.
- **Verificación de Correo**: Utiliza `requireEmailVerification: true` para prevenir checkouts no verificados.
- **Fallos de Redirección**: Revisa la consola de tu navegador; Paystack a menudo devuelve errores 429 si estás consultando la API de prueba con demasiada frecuencia.
- **Desajustes de referencia**: Asegúrate de que `referenceId` se pase correctamente para la facturación por organización.
- **Autorización Denegada**: Verifica que la lógica de `authorizeReference` esté comprobando correctamente los roles de usuario o las membresías de organización. Los intentos no autorizados de verificar transacciones ahora devuelven una respuesta `401 Unauthorized` para prevenir filtraciones de datos.

### Indexación de Base de Datos

La definición de esquema del plugin incluye índices recomendados y restricciones de unicidad para el rendimiento. Cuando ejecutes `npx better-auth migrate`, estos se aplicarán automáticamente a tu base de datos.

Después de actualizar, ejecuta `npx better-auth migrate` (o `npx better-auth generate` para adaptadores gestionados por esquema). Las columnas de suscripción aditivas `cancelAt`, `canceledAt`, `endedAt` y `billingInterval` son anulables; las filas históricas se poblán a medida que se procesan eventos futuros de ciclo de vida.

Los siguientes campos están indexados:

- **`paystackTransaction`**: `reference` (única), `userId`, `referenceId`.
- **`paystackSubscription`**: `subscriptionCode` (única), `referenceId`, `transactionReference`, `customerCode`, `plan`.
- **`paystackCustomer`**: `referenceKey` (única), `referenceId`, `customerCode` (única).
- **`paystackPaymentCredential`**: `subscriptionId` (única).
- **`paystackProduct`**: `slug` (única), `paystackId` (única).

Las mejoras de prorrata y los cargos de renovación confiables también persisten filas `paystackTransaction`, por lo que el historial de transacciones locales permanece alineado con los cargos exitosos fuera de sesión.

### Sincronización de Productos

El plugin proporciona dos formas de mantener tu inventario de productos alineado con Paystack:

#### 1. Sincronización Automatizada de Inventario

Cada vez que se realiza un pago único exitoso (vía webhook o verificación manual), el plugin llama automáticamente a **`syncProductQuantityFromPaystack`**. Esto obtiene la cantidad restante en tiempo real desde la API de Paystack y actualiza tu registro local en la base de datos, asegurando que tu inventario sea siempre preciso.

#### 2. Sincronización Manual Masiva Confiable

El endpoint público `/paystack/sync-products` fue eliminado en `2.0.0`.
Ejecuta la operación de servidor confiable desde el código backend en su lugar:

```ts
import { syncPaystackProducts } from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await syncPaystackProducts(ctx, paystackOptions);
```

### Nota de Compatibilidad del SDK

El plugin ahora apunta directamente a la superficie del cliente agrupado oficial `@alexasomba/paystack-node`.
Si inyectas un cliente personalizado, debe coincidir con los métodos reales del SDK utilizados por el plugin como `transaction.initialize`, `transaction.verify`, `transaction.chargeAuthorization`, `subscription.create`, `subscription.disable` y `subscription.enable`.

---

## 🏗️ Desarrollo y Contribuciones

Este repositorio está impulsado por **Vite+**. Utiliza la CLI `vp` para gestionar todo el espacio de trabajo.

```bash
# Instalar dependencias
vp i

# Verificar salud del proyecto (formato, lint, tipos)
vp check --fix

# Compilar la biblioteca principal
vp build

# Ejecutar pruebas
vp test

# Ejecutar el ejemplo de TanStack Start
vp run examples/tanstack dev
```

¡Las contribuciones son bienvenidas! Por favor abre un issue o pull request.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - consulta el archivo [LICENSE](LICENSE) para más detalles.

## Hoja de Ruta

Características futuras planeadas para las próximas versiones:

### v1.1.0 - Suscripciones Recurrentes Manuales (Disponible Ahora)

- [x] **Códigos de Autorización Almacenados**: Almacena de forma segura los códigos de autorización de Paystack de transacciones verificadas.
- [x] **Operación de Renovación Confiable**: Helper del lado del servidor para cobrar tarjetas almacenadas para renovaciones.
- [ ] **Interfaz de Gestión de Tarjetas**: Permite a los usuarios ver/eliminar métodos de pago guardados (solo datos de tarjeta enmascarados) - _Próximamente_
- [ ] **Integración con Programador de Renovaciones**: Documentación para integrar con Cloudflare Workers Cron, Vercel Cron, etc. - _Próximamente_

> **Nota**: Para suscripciones gestionadas localmente (sin `planCode`), el plugin captura y almacena automáticamente el `authorization_code`. Dispara renovaciones desde código backend confiable con `chargeSubscriptionRenewal(...)`.

### Consideraciones Futuras

- [ ] Mejoras en el soporte de múltiples monedas
- [ ] Generación de facturas
- [ ] Lógica de reintento de pago para renovaciones fallidas

## Enlaces

- Repositorio de GitHub: [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- SDK de Paystack Node completo y actualizado: [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- SDK de Paystack Inline completo y actualizado: [alexasomba/paystack-inline](https://github.com/alexasomba/paystack-inline)
- [Implementación de Ejemplo TanStack Start](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)
- Webhooks de Paystack: https://paystack.com/docs/payments/webhooks/
- API de Transacciones de Paystack: https://paystack.com/docs/api/transaction/
- API de Suscripciones de Paystack: https://paystack.com/docs/api/subscription/
- API de Planes de Paystack: https://paystack.com/docs/api/plan/
- [Documentación de Better Auth](https://www.better-auth.com/docs)
