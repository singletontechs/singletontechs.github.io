# Wiki · Catálogo de comercios de proximidad

Índice wiki **estático** (HTML + JS, sin build en el cliente, sin backend, sin dependencias externas) que presenta los comercios de la carpeta `proyectos/`. Operado por **SingletonTechs**. Pensado para colgar en **GitHub Pages**.

## Lo importante: añadir o quitar comercios es automático

No edites a mano `index.json` ni `manifest.json`. El script `build.mjs` escanea `proyectos/` y los regenera solo.

### Flujo
1. **Añadir** un proyecto: deja su `<slug>.html` y su `<slug>.md` en `proyectos/`.
2. **Quitar** un proyecto: borra esos dos ficheros.
3. **Regenera** el índice:
   ```bash
   bun public/wiki/build.mjs            # build una sola vez
   bun public/wiki/build.mjs --watch    # o vigila cambios (modo dev)
   # también: bun run wiki:build  /  bun run wiki:watch
   ```
4. Abre `index.html` (o, en el sandbox de desarrollo, la ruta `/` que lo embebe en un iframe). El nuevo proyecto aparece; el borrado, desaparece.

> En GitHub Pages no hace falta ejecutar nada a mano: el workflow `.github/workflows/deploy-wiki.yml` ejecuta `build.mjs` y publica en cada push que toque `public/wiki/`.

## Estructura

```
public/wiki/
├─ index.html            ← la home del wiki (HTML estático)
├─ build.mjs             ← escanea proyectos/ y genera el índice
├─ README.md             ← este documento
└─ proyectos/
   ├─ index.json         ← (generado) toda la info en un único fetch
   ├─ manifest.json      ← (generado) lista de slugs
   ├─ *.html             ← las páginas de cada proyecto
   └─ *.md               ← la ficha de cada proyecto (frontmatter + markdown)
```

## Formato de cada `<slug>.md`

```markdown
---
slug: moda-joven-urban
title: Urban Crew
tagline: Moda joven y urbana
category: Moda
subcategory: Moda joven urbana
icon: 🧢
accent: "#ff2e93"
accent2: "#b6ff1a"
theme: dark
page: moda-joven-urban.html
location: Calle Joven 7
schedule: L–S 11:00–21:00
summary: Streetwear, vaqueros, sudaderas y sneakers para quienes marcan tendencia.
tags: [streetwear, vaqueros, sneakers, drops, sudaderas]
highlights:
  - Drops semanales cada viernes
  - Selección de marcas urbanas
  - 10% de descuento con carné de estudiante
  - Envío exprés en 24 h a toda España
stats:
  - Drops al año | 52
  - Seguidores | +12.000
  - Marcas | 30
---

# Urban Crew · Moda joven y urbana

Cuerpo en Markdown: introducción, "## Lo que encontrarás" (lista),
"## Por qué venir", "## Una voz del local" (blockquote) y "## Ficha técnica".
```

Notas:
- `accent` / `accent2` son hex `#rrggbb` (pintan la tarjeta).
- `stats` usa ` | ` como separador etiqueta-valor.
- `tags` es un array inline `[a, b, c]`.
- `highlights` y `stats` son listas en bloque con 2 espacios y `- `.
- Si un `.md` no tiene su `.html` compañero, la tarjeta se muestra igual pero con el badge "solo .md" y sin botón "Abrir página".

## Cómo publica en GitHub Pages

El workflow `deploy-wiki.yml`:
1. Hace checkout y configura Bun.
2. `configure-pages` calcula el `base_url` real del sitio.
3. Ejecuta `bun public/wiki/build.mjs` (con `WIKI_BASE_URL`) → genera `proyectos/index.json`, `proyectos/manifest.json`, inyecta el SEO dinámico en `index.html` (canonical, og:url, og:image, JSON-LD) y crea `sitemap.xml` + `robots.txt`.
4. Sube `public/wiki/` como artefacto de Pages.
5. Lo despliega con `actions/deploy-pages`.

Configura el repo una sola vez: **Settings → Pages → Source = GitHub Actions**.

## Legal (SingletonTechs)

El sitio es operado por **SingletonTechs**. Las páginas legales viven en `legal/`:

- `legal/aviso-legal.html` — Aviso legal (LSSI-CE).
- `legal/privacidad.html` — Política de privacidad (RGPD / LOPDGDD).
- `legal/cookies.html` — Política de cookies (el sitio es estático, sin seguimiento).
- `legal/terminos.html` — Términos y condiciones de uso.

Comparten `legal/legal.css`. El footer del wiki enlaza a las cuatro. Hay además un aviso de cookies discreto (almacena la preferencia en `localStorage`, sin cookies de seguimiento).

> **Antes de publicar**: sustituye en las páginas legales los campos entre corchetes (`[NIF/CIF]`, `[dirección fiscal]`, `[correo@singletontechs.com]`, `[teléfono]`) por los datos reales de SingletonTechs.

## Desarrollo local (sandbox Next.js)

La ruta `/` (definida en `src/app/page.tsx`) embebe `public/wiki/index.html` en un iframe a pantalla completa, así puedes previsualizar el wiki en el panel de vista previa. Para regenerar el índice tras tocar `proyectos/`:
```bash
bun run wiki:build
# o, pasando la base real para el SEO:
WIKI_BASE_URL="https://singletontechs.github.io/" bun run wiki:build
```
