#!/usr/bin/env bun
/**
 * build.mjs — Genera automáticamente el índice del wiki.
 *
 * Escanea la carpeta `proyectos/` y, por cada fichero `.md` encontrado,
 * extrae su frontmatter + cuerpo y los vuelca a:
 *   - proyectos/index.json   (todo en un único fetch: lo que lee la home)
 *   - proyectos/manifest.json (lista de slugs, para uso externo/depuración)
 *
 * Detecta además si cada proyecto tiene su `.html` compañero y lo marca
 * (hasHtml) para que la tarjeta muestre/oculte el botón "Abrir página".
 *
 * Uso:
 *   bun public/wiki/build.mjs           # build una sola vez
 *   bun public/wiki/build.mjs --watch   # rebuild al añadir/quitar ficheros
 *   node public/wiki/build.mjs          # también funciona con Node 18+
 *
 * Así, añadir o quitar proyectos es automático: solo sueltas los .md (+ su
 * .html) en proyectos/ y vuelves a ejecutar esto (o lo hace el CI al pushear).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, watch } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, "proyectos");

/* ---------- frontmatter + body parser (espejo del de index.html) ---------- */
function parseMD(text){
  const meta = {};
  let body = text;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if(m){
    const fm = m[1]; body = m[2] || "";
    const lines = fm.split(/\r?\n/);
    let i = 0;
    while(i < lines.length){
      const line = lines[i];
      if(!line.trim()){ i++; continue; }
      const kv = /^([A-Za-z0-9_]+):\s?(.*)$/.exec(line);
      if(!kv){ i++; continue; }
      const key = kv[1]; const rest = kv[2].trim();
      if(rest === ""){
        const arr = []; i++;
        while(i < lines.length && /^\s+-\s+/.test(lines[i])){ arr.push(lines[i].replace(/^\s+-\s+/, "").trim()); i++; }
        meta[key] = arr;
      } else if(rest.charAt(0) === "[" && rest.slice(-1) === "]"){
        meta[key] = rest.slice(1,-1).split(",").map(s => s.trim().replace(/^"|"$/g,"")).filter(Boolean);
        i++;
      } else {
        meta[key] = rest.replace(/^"|"$/g,"");
        i++;
      }
    }
  }
  if(meta.stats) meta.stats = meta.stats.map(s => { const p = s.split("|"); return { label:(p[0]||"").trim(), value:(p[1]||"").trim() }; });
  if(typeof meta.tags === "string") meta.tags = [meta.tags];
  if(!meta.tags) meta.tags = [];
  if(!meta.highlights) meta.highlights = [];
  if(!meta.stats) meta.stats = [];
  return { meta, body };
}

function discoverProjects(){
  const mdFiles = readdirSync(PROJ).filter(f => f.endsWith(".md")).sort();
  const projects = [];
  const slugs = [];
  for(const f of mdFiles){
    const slug = basename(f, ".md");
    const text = readFileSync(join(PROJ, f), "utf8");
    const { meta, body } = parseMD(text);
    const page = meta.page || (slug + ".html");
    const hasHtml = existsSync(join(PROJ, page));
    meta.slug = meta.slug || slug;
    meta.page = page;
    meta.hasHtml = hasHtml;
    projects.push({ meta, body });
    slugs.push(meta.slug);
  }
  // orden por categoría (si existe) y luego alfabético — predecible
  const catOrder = ["Moda","Restauración","Ocio nocturno","Hogar","Bazar","Calzado"];
  projects.sort((a,b) => {
    const ca = catOrder.indexOf(a.meta.category), cb = catOrder.indexOf(b.meta.category);
    const ra = ca === -1 ? 99 : ca, rb = cb === -1 ? 99 : cb;
    if(ra !== rb) return ra - rb;
    return a.meta.slug.localeCompare(b.meta.slug);
  });
  const orderedSlugs = projects.map(p => p.meta.slug);
  return { projects, slugs: orderedSlugs };
}

/* ---------- SEO: Schema.org type por categoría ---------- */
const SCHEMA_TYPE = {
  "Moda":"ClothingStore",
  "Restauración":"Restaurant",
  "Ocio nocturno":"BarOrPub",
  "Hogar":"HomeAndConstructionBusiness",
  "Bazar":"Store",
  "Calzado":"ShoeStore"
};

function getBase(){
  // --base <url>  o  env WIKI_BASE_URL.  Por defecto un placeholder claro.
  const i = process.argv.indexOf("--base");
  let base = i >= 0 ? process.argv[i+1] : (process.env.WIKI_BASE_URL || "");
  if(!base){
    base = "https://tu-usuario.github.io/";
    console.log("\n ⚠  WIKI_BASE_URL no definido. Usando placeholder: " + base);
    console.log("    Ejecuta con --base https://TU-USUARIO.github.io/ (o ponlo en env) para canonical/OG/sitemap reales.");
  }
  if(!base.endsWith("/")) base += "/";
  return base;
}

function escAttr(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escXml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ---------- SEO dinámico inyectado en index.html ---------- */
function genSEO(projects, base){
  const itemList = projects.map((p, idx) => {
    const m = p.meta;
    const type = SCHEMA_TYPE[m.category] || "LocalBusiness";
    const item = {
      "@type": type,
      "name": m.title,
      "description": m.summary || "",
      "address": { "@type":"PostalAddress", "streetAddress": m.location || "" }
    };
    if(m.hasHtml) item.url = base + "proyectos/" + m.page;
    if(m.schedule) item.openingHours = m.schedule;
    return { "@type":"ListItem", "position": idx+1, "item": item };
  });
  const graph = {
    "@context":"https://schema.org",
    "@graph":[
      { "@type":"WebSite", "url": base, "name":"Wiki · Comercios de proximidad", "description":"Catálogo de comercios de proximidad", "inLanguage":"es" },
      { "@type":"ItemList", "name":"Catálogo de comercios de proximidad", "description":"Comercios de proximidad: moda, restauración, hostelería, calzado, textil hogar, bazar y regalos.", "numberOfItems": projects.length, "itemListElement": itemList }
    ]
  };
  const ld = JSON.stringify(graph);
  const ogImage = base + "og-card.png";
  const block = []
    .concat([
      `<link rel="canonical" href="${escAttr(base)}">`,
      `<meta property="og:url" content="${escAttr(base)}">`,
      `<meta property="og:image" content="${escAttr(ogImage)}">`,
      `<meta name="twitter:image" content="${escAttr(ogImage)}">`,
      `<script type="application/ld+json" data-wiki="seo">${ld}</script>`
    ])
    .join("\n  ");

  const idxPath = join(HERE, "index.html");
  let html = readFileSync(idxPath, "utf8");
  const re = /<!--SEO:DYNAMIC START-->[\s\S]*?<!--SEO:DYNAMIC END-->/;
  const replacement = `<!--SEO:DYNAMIC START-->\n  ${block}\n  <!--SEO:DYNAMIC END-->`;
  if(re.test(html)){
    html = html.replace(re, replacement);
  } else {
    console.log(" ⚠  No encontré el marker <!--SEO:DYNAMIC START--> en index.html (no se inyectó JSON-LD/canonical).");
  }
  writeFileSync(idxPath, html);
}

/* ---------- sitemap.xml + robots.txt ---------- */
function genSitemap(projects, base){
  const today = new Date().toISOString().slice(0,10);
  const urls = [];
  urls.push(`  <url>\n    <loc>${escXml(base)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`);
  for(const p of projects){
    if(!p.meta.hasHtml) continue;
    const u = base + "proyectos/" + p.meta.page;
    urls.push(`  <url>\n    <loc>${escXml(u)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
  }
  // páginas legales (si existen)
  const legalPages = ["legal/aviso-legal.html","legal/privacidad.html","legal/cookies.html","legal/terminos.html"];
  for(const lp of legalPages){
    if(!existsSync(join(HERE, lp))) continue;
    urls.push(`  <url>\n    <loc>${escXml(base)}${lp}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  writeFileSync(join(HERE, "sitemap.xml"), xml);
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${escXml(base)}sitemap.xml\n`;
  writeFileSync(join(HERE, "robots.txt"), robots);
}

function build(){
  if(!existsSync(PROJ)){ console.error("✗ No existe la carpeta", PROJ); process.exit(1); }
  const t0 = Date.now();
  const { projects, slugs } = discoverProjects();
  const base = getBase();
  const updated = new Date().toISOString().slice(0,10);
  writeFileSync(join(PROJ, "manifest.json"),
    JSON.stringify({ version:1, updated, count: slugs.length, projects: slugs }, null, 2) + "\n");
  writeFileSync(join(PROJ, "index.json"),
    JSON.stringify({ version:1, updated, count: projects.length, generated: new Date().toISOString(), projects }, null, 2) + "\n");
  genSEO(projects, base);
  genSitemap(projects, base);
  console.log(`\n Wiki · ${projects.length} proyectos detectados en proyectos/`);
  for(const p of projects){
    console.log(`   ${p.meta.hasHtml ? "●" : "○"} ${p.meta.slug.padEnd(26)} ${p.meta.title.padEnd(20)} [${p.meta.category||"sin cat."}]  ${p.meta.hasHtml ? "html ✓" : "html ✗"}`);
  }
  const legalCount = ["legal/aviso-legal.html","legal/privacidad.html","legal/cookies.html","legal/terminos.html"]
    .filter(p => existsSync(join(HERE, p))).length;
  console.log(`\n ✓ proyectos/index.json   (${projects.length} entradas)`);
  console.log(` ✓ proyectos/manifest.json (${slugs.length} slugs)`);
  console.log(` ✓ index.html             (SEO dinámico inyectado: canonical, og:url, og:image, JSON-LD)`);
  console.log(` ✓ sitemap.xml            (${projects.filter(p=>p.meta.hasHtml).length+1+legalCount} URLs: home + comercios + ${legalCount} legales, base=${base})`);
  console.log(` ✓ robots.txt             (Sitemap: ${base}sitemap.xml)`);
  console.log(`   generado en ${Date.now()-t0}ms`);
}

if(process.argv.includes("--watch")){
  build();
  console.log("\n 👀  Modo watch: vigilando proyectos/ … (Ctrl+C para parar)\n");
  let t;
  // rebuilder con debounce
  function schedule(){ clearTimeout(t); t = setTimeout(build, 250); }
  try {
    watch(PROJ, { recursive: true }, (_ev, file) => {
      if(!file) return;
      if(file.endsWith(".md") || file.endsWith(".html") || file === "manifest.json" || file === "index.json") return; // no bucle
      console.log(`\n ↻ cambio detectado: ${file}`);
      schedule();
    });
  } catch(e) {
    // fallback: polling cada 2s
    console.log("   (watch recursivo no disponible, usando polling cada 2s)");
    let snap = readdirSync(PROJ).sort().join("|");
    setInterval(() => {
      const cur = readdirSync(PROJ).sort().join("|");
      if(cur !== snap){ snap = cur; console.log("\n ↻ cambio detectado en proyectos/"); schedule(); }
    }, 2000);
  }
} else {
  build();
}
