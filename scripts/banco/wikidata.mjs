// Consulta Wikidata y las visitas de Wikipedia en español. Sólo lee datos públicos.
const URL_CONSULTAS = 'https://query.wikidata.org/sparql';
// El contacto se pasa por variable de entorno para que no quede en el código publicado.
const CONTACTO = process.env.ASTRILLON_CONTACTO;
const AGENTE = `AstrillonBanco/0.2 (generador de un juego de preguntas${CONTACTO ? `; ${CONTACTO}` : ''})`;

/**
 * Devuelve las entidades que cumplen `cuerpo` (que debe definir ?item) y tienen artículo
 * en Wikipedia en español: sin artículo, el nombre casi nunca es algo que alguien escribiría.
 */
export async function consultar(cuerpo, minimoEnlaces = 0) {
  const sparql = `
    SELECT ?item ?itemLabel ?links ?titulo (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alias) WHERE {
      ${cuerpo}
      ?item wikibase:sitelinks ?links.
      FILTER(?links >= ${minimoEnlaces})
      ?articulo schema:about ?item; schema:isPartOf <https://es.wikipedia.org/>; schema:name ?titulo.
      ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "es")
      OPTIONAL { ?item skos:altLabel ?alt. FILTER(LANG(?alt) = "es") }
    } GROUP BY ?item ?itemLabel ?links ?titulo`;
  const respuesta = await fetch(URL_CONSULTAS, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': AGENTE,
    },
    body: new URLSearchParams({ query: sparql }),
  });
  if (!respuesta.ok) throw new Error(`Wikidata respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  return datos.results.bindings.map((fila) => ({
    id: fila.item.value.split('/').pop(),
    nombre: fila.itemLabel.value,
    titulo: fila.titulo.value,
    links: Number(fila.links.value),
    alias: fila.alias?.value ? fila.alias.value.split('|') : [],
  }));
}

/** Visitas de un artículo de Wikipedia en español durante 2025. Si no hay datos, 0. */
export async function visitasDe(titulo) {
  const pagina = encodeURIComponent(titulo.replaceAll(' ', '_'));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/${pagina}/monthly/20250101/20260101`;
  for (let intento = 0; intento < 8; intento++) {
    const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
    if (respuesta.status === 404) return 0;
    if (respuesta.status === 429) {
      // Respeta el tiempo de espera que pide la API antes de volver a intentar.
      const segundos = Number(respuesta.headers.get('retry-after')) || 10;
      await respuesta.text();
      await new Promise((resolver) => setTimeout(resolver, (segundos + 1) * 1000));
      continue;
    }
    if (!respuesta.ok) throw new Error(`Wikimedia respondió ${respuesta.status} para ${titulo}`);
    const datos = await respuesta.json();
    return datos.items.reduce((suma, item) => suma + item.views, 0);
  }
  throw new Error(`Wikimedia sigue limitando los pedidos para ${titulo}`);
}
