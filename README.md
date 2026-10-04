# Bluefin

Aplicación web progresiva (PWA) para controlar las finanzas personales: gastos fijos, gastos variables e ingresos, con gráficas claras y una interfaz pensada para apuntar un gasto en segundos. Se puede instalar en el móvil y en el ordenador y funciona sin conexión.

## Funcionalidades

- **Añadir en segundos**: botón central ＋, importe, categoría con un toque, asunto opcional para justificar el gasto (con autocompletado) y fecha.
- **Gastos fijos automáticos**: alquiler, suscripciones, nómina… se apuntan solos cada mes. Se pueden pausar, editar o eliminar sin perder el historial.
- **Panel visual**:
  - Balance del mes y porcentaje de ahorro
  - Reparto fijos / variables y presupuesto mensual con barra de progreso
  - Donut de gasto por categoría
  - Gasto variable acumulado comparado con el mes anterior y con el presupuesto
  - Evolución de los últimos 6 meses (toca una barra para ir a ese mes)
- **Movimientos**: agrupados por día, con búsqueda (sin tener en cuenta tildes) y filtros.
- **Categorías personalizables** con emoji y colores coherentes en todas las gráficas.
- **Modo claro / oscuro / automático**.
- **Copia de seguridad**: exportar e importar en JSON y exportar a CSV para abrirlo en Excel.
- **Sincronización entre dispositivos** en tiempo real con cuenta de usuario (Supabase). Funciona sin conexión: los cambios se guardan en una cola y se suben al recuperar internet.
- **Importación automática del banco** (Open Banking PSD2 vía Enable Banking): los movimientos de tus cuentas y tarjetas se importan cada 6 horas, se categorizan solos (reglas aprendidas, más de 150 comercios españoles y códigos MCC) y se concilian con tus gastos fijos para no duplicarlos.
- **Seguridad**: Row Level Security en PostgreSQL, así cada usuario solo puede leer y modificar sus propios datos.

## Tecnologías

| | |
|---|---|
| **React 19** + **TypeScript** | Componentes funcionales y hooks |
| **Vite** | Entorno de desarrollo y build |
| **Supabase** | PostgreSQL, autenticación, Realtime y Row Level Security |
| **Zustand** | Estado global con caché local (*offline-first*) y cola de sincronización |
| **Supabase Edge Functions** (Deno) + **pg_cron** | Integración con la API de Enable Banking (JWT RS256), sincronización programada |
| **Recharts** | Gráficas interactivas |
| **vite-plugin-pwa** (Workbox) | App instalable y uso sin conexión |
| **CSS moderno** | Variables de diseño, `color-mix`, modo oscuro y diseño responsive *mobile first* |

## Configurar Supabase (sincronización)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
3. En **Authentication → Sign In / Providers → Email**, desactiva *Confirm email* si no quieres confirmar el correo al registrarte.
4. Copia `.env.example` como `.env.local` y rellena la URL y la clave pública (*anon* / *publishable*) que aparecen en **Project Settings → API**.
5. Reinicia `npm run dev`.

Sin `.env.local`, la app funciona en modo local (solo en ese navegador).

### Cómo funciona la sincronización

- El store local es la fuente de la interfaz, así que todo responde al instante.
- `src/lib/sync.ts` compara cada estado con el anterior, encola las altas, cambios y bajas en una *outbox* persistente y las sube en lote.
- Supabase Realtime envía los cambios de otros dispositivos, que se aplican en local.
- Los movimientos que generan los gastos fijos usan un id determinista (`fijo_mes`), así que dos dispositivos nunca los duplican.

## Conexión bancaria (opcional)

1. Ejecuta [`supabase/banco.sql`](supabase/banco.sql) en el SQL Editor.
2. Crea una aplicación en el [Control Panel de Enable Banking](https://enablebanking.com/cp/applications) (modo *restricted production*, gratis con tus propias cuentas) con la URL de retorno `https://<PROYECTO>.supabase.co/functions/v1/banco/callback`.
3. Despliega la función y sus secretos:
   ```bash
   npx supabase functions deploy banco --project-ref <PROYECTO> --use-api
   npx supabase secrets set --project-ref <PROYECTO> EB_APP_ID=... CRON_SECRET=... EB_PRIVATE_KEY="$(cat clave.pem)"
   ```
4. Programa la sincronización con [`supabase/cron.example.sql`](supabase/cron.example.sql).

## Puesta en marcha

```bash
npm install
npm run dev        # desarrollo con recarga en caliente → http://localhost:5173
npm run build      # build de producción en dist/
npm run preview    # sirve el build localmente
```

Para probarla en el móvil durante el desarrollo, `npm run dev -- --host` y abre la dirección *Network* desde el móvil (misma red Wi-Fi).

## Estructura

```
src/
├── components/      # Diálogos, lista de movimientos, controles
│   └── charts/      # Gráficas (donut, acumulado, histórico)
├── views/           # Resumen, Movimientos, Fijos, Ajustes
├── store/           # Estado global (Zustand)
├── lib/             # Sync con Supabase, fechas, formato, estadísticas, exportación
├── hooks/           # useTheme, useAuth
└── types.ts         # Modelo de datos
supabase/schema.sql  # Tablas, políticas RLS y Realtime
```

## Licencia

Copyright (c) 2026 Pablo Rodríguez. Todos los derechos reservados.

El código se publica únicamente para que pueda consultarse con fines de evaluación. No está permitido copiarlo, modificarlo, distribuirlo ni desplegarlo sin permiso previo y por escrito del autor. Consulta el archivo [LICENSE](LICENSE).
