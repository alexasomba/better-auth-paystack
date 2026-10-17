[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Abrir siguiente iniciador


## Mejor autenticación + Paystack

Este ejemplo monta Better Auth (con el complemento Paystack) en `GET/POST /api/auth/[...all]`.


### Configuración

1. Instalar + compilar (raíz del repositorio):

```bash
vp install
vp pack
```

2. Instale departamentos de ejemplo:

```bash
cd examples/nextjs
vp install
```

3. Configurar el entorno:

- Copiar `.env.example` a `.env.local`
- Complete `PAYSTACK_SECRET_KEY`

Nota: La verificación del webhook de Paystack utiliza la misma clave secreta de Paystack para `x-paystack-signature` HMAC. `PAYSTACK_WEBHOOK_SECRET` es opcional y el valor predeterminado es `PAYSTACK_SECRET_KEY` en este ejemplo.

Opcional:

- Configure `PAYSTACK_CREATE_CUSTOMER_ON_SIGNUP=1` si desea que la demostración cree un registro de cliente de Paystack cuando un usuario se registra.

Esta demostración admite la creación de clientes de Paystack en los flujos de registro y suscripción de Paystack, así que utilice una clave secreta de prueba de Paystack real.


### Validar

Desde la raíz del repositorio:

```bash
vp -C examples/nextjs run typecheck
vp -C examples/nextjs run lint
vp -C examples/nextjs run build
```


### Almacenamiento

Al igual que el ejemplo de TanStack Start, esta demostración utiliza el adaptador en memoria de Better Auth.
Está destinado a la exploración local y restablece sus usuarios, organizaciones, suscripciones,
productos, planes y transacciones cuando se reinicie el proceso. Utilice un adaptador de producción antes
implementar datos de facturación persistentes.

Este es un proyecto [Next.js](https://nextjs.org) iniciado con [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


## Empezando

Lea la documentación en https://opennext.js.org/cloudflare.


## Desarrollar

Ejecute el servidor de desarrollo Next.js:

```bash
vp dev
```

Abra [http://localhost:3000](http://localhost:3000) con su navegador para ver el resultado.


## Qué probar

La página de inicio es una interfaz de usuario de demostración interactiva que ejercita:

- Autenticación anónima y por correo electrónico/contraseña
- Creación de organizaciones y objetivos de facturación personal/organizacional.
- Cinco planes de suscripción, pruebas, cantidad de asientos, programación al final del período y actualizaciones prorrateadas
- Productos únicos, sincronización de catálogos, historial de transacciones y verificación de transacciones
- Cancelación de suscripción, restauración, portal de facturación Paystack y renovaciones confiables
- Verificación de firma de webhook en `POST /api/auth/paystack/webhook` (enviada por Paystack; no activada desde el navegador)

Nota: la verificación del webhook es "funcional" en el sentido de que el punto final existe y valida las firmas, pero no se puede probar de manera significativa desde el navegador. Solo lo verá activarse cuando Paystack envíe eventos de webhook a su URL implementada/tunelizada.

Puede comenzar a editar la página modificando `src/app/page.tsx`. La página se actualiza automáticamente a medida que edita el archivo.


## Vista previa

Obtenga una vista previa de la aplicación localmente en el tiempo de ejecución de Cloudflare:

```bash
vp run preview
```


## Implementar

Implemente la aplicación en Cloudflare:

```bash
vp run deploy
```


## Más información

Para obtener más información sobre Next.js, consulte los siguientes recursos:

- [Documentación de Next.js](https://nextjs.org/docs): obtenga información sobre las funciones y la API de Next.js.
- [Aprenda Next.js](https://nextjs.org/learn): un tutorial interactivo de Next.js.

Puede consultar [el repositorio de GitHub de Next.js](https://github.com/vercel/next.js): ¡sus comentarios y contribuciones son bienvenidos!
