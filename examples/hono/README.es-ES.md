[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Hono + Mejor autenticación + Paystack

Este ejemplo conecta Better Auth y `better-auth-paystack` a un Hono Cloudflare Worker.

## Configuración

1. Instale las dependencias y cree la biblioteca desde la raíz del repositorio:

```txt
vp install
vp pack
```

2. Instale departamentos de ejemplo:

```txt
vp -C examples/hono install
```

3. Configure el entorno local:

- Copiar `.dev.vars.example` a `.dev.vars`
- Complete `BETTER_AUTH_SECRET` y `PAYSTACK_SECRET_KEY`

Nota: La verificación del webhook de Paystack utiliza la misma clave secreta de Paystack para `x-paystack-signature` HMAC. `PAYSTACK_WEBHOOK_SECRET` es opcional y se puede configurar con el mismo valor que `PAYSTACK_SECRET_KEY`.

## Ejecutar

```txt
vp -C examples/hono dev
```

Better Auth está montado en `http://localhost:8787/api/auth/*`. El ejemplo también expone:

- `/api/billing` para verificación de devolución de llamada, sincronización de catálogo y operaciones de renovación confiables
- `/api/health` y `/openapi.json` para comprobaciones de servicio y descubrimiento de API
- `/.well-known/api-catalog` y `/mcp` para descubrimiento de cara al agente

Ejecute las comprobaciones de ejemplo con:

```txt
vp -C examples/hono typecheck
vp -C examples/hono test
vp -C examples/hono build
```

## Notas

- Esto utiliza `memoryAdapter`, por lo que los datos se restablecen al implementar/reiniciar. Utilice almacenamiento respaldado por D1/KV para la producción.
- El cliente Paystack utiliza la superficie de cliente agrupada `@alexasomba/paystack-node` escrita que espera el complemento.
- La facturación de la organización, cinco planes de suscripción, pruebas, productos, transacciones y acciones de cancelación/restauración/portal se exponen a través de la API del cliente Better Auth.
- Las rutas Paystack requieren `PAYSTACK_SECRET_KEY`; Las mejores rutas de autenticación aún funcionan solo con `BETTER_AUTH_SECRET`.
