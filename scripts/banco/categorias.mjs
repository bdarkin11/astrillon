// Consignas que se generan desde Wikidata. La rareza sale de las visitas en Wikipedia en español.
// Sólo están las listas que resultaron confiables; las demás (jugadores, clubes, ciudades, volcanes,
// mares, idiomas, pintores, etc.) tenían huecos o intrusos y están curadas a mano en src/datos.
//
// consulta: define ?item en SPARQL.
// minimo: cantidad mínima de idiomas de Wikipedia, para sacar entradas demasiado oscuras.
// sacar: patrones que se quitan del nombre para crear un alias.
// prefijos: palabras que se ignoran al validar ("lago Titicaca" -> "titicaca").
// apellido: acepta también el apellido solo, si no se repite en la lista.
// nombrePila: acepta también el primer nombre solo, si no se repite en la lista.
// joya, vivos, excluir y demás correcciones: en privado/curaduria.mjs.

const ONU = '?p wdt:P31 wd:Q3624078; wdt:P463 wd:Q1065.';

export const CATEGORIAS = [
  { id: 'pais', texto: 'Nombrá un país', consulta: '?item wdt:P31 wd:Q3624078; wdt:P463 wd:Q1065.' },
  { id: 'pais-africa', texto: 'Nombrá un país de África', consulta: '?item wdt:P31 wd:Q3624078; wdt:P463 wd:Q1065; wdt:P30 wd:Q15.' },
  { id: 'pais-europa', texto: 'Nombrá un país de Europa', consulta: '?item wdt:P31 wd:Q3624078; wdt:P463 wd:Q1065; wdt:P30 wd:Q46.' },
  { id: 'pais-asia', texto: 'Nombrá un país de Asia', consulta: '?item wdt:P31 wd:Q3624078; wdt:P463 wd:Q1065; wdt:P30 wd:Q48.' },
  { id: 'capital-mundo', texto: 'Nombrá la capital de un país', consulta: `${ONU} ?p wdt:P36 ?item.` },
  { id: 'banda-argentina', texto: 'Nombrá una banda de música argentina', minimo: 1, consulta: '?item wdt:P31 wd:Q215380; wdt:P495 wd:Q414.' },
  { id: 'pelicula-argentina', texto: 'Nombrá una película argentina', minimo: 3, consulta: '?item wdt:P31 wd:Q11424; wdt:P495 wd:Q414.' },
  { id: 'elemento', texto: 'Nombrá un elemento químico', consulta: '?item wdt:P31 wd:Q11344.' },
  { id: 'constelacion', texto: 'Nombrá una constelación', consulta: '?item wdt:P31 wd:Q8928.' },
  { id: 'raza-perro', texto: 'Nombrá una raza de perro', prefijos: ['perro'], minimo: 8, consulta: '?item wdt:P31 wd:Q39367.' },
  { id: 'raza-gato', texto: 'Nombrá una raza de gato', prefijos: ['gato'], minimo: 5, consulta: '?item wdt:P31 wd:Q43577.' },
  { id: 'dios-griego', texto: 'Nombrá un dios o una diosa griega', minimo: 8, consulta: '?item wdt:P31 wd:Q22989102.' },
  { id: 'nobel-literatura', texto: 'Nombrá a alguien que ganó el Nobel de Literatura', apellido: true, consulta: '?item wdt:P166 wd:Q37922.' },
  { id: 'oscar-pelicula', texto: 'Nombrá una película que ganó el Oscar a Mejor Película', consulta: '?item wdt:P31 wd:Q11424; wdt:P166 wd:Q102427.' },
  { id: 'simpson', texto: 'Nombrá un personaje de Los Simpson', nombrePila: true, apellido: true, consulta: '?item wdt:P1441 wd:Q886; wdt:P31/wdt:P279* wd:Q95074.' },
  { id: 'harry-potter', texto: 'Nombrá un personaje de Harry Potter', nombrePila: true, apellido: true, consulta: '?item wdt:P1441 wd:Q8337; wdt:P31/wdt:P279* wd:Q95074.' },
  { id: 'lago', texto: 'Nombrá un lago', prefijos: ['lago'], minimo: 35, consulta: '?item wdt:P31 wd:Q23397.' },
  { id: 'montana', texto: 'Nombrá una montaña', prefijos: ['monte', 'cerro', 'volcan'], minimo: 40, consulta: '?item wdt:P31 wd:Q8502.' },
  { id: 'papa', texto: 'Nombrá a un papa', minimo: 40, consulta: '?item wdt:P39 wd:Q19546; wdt:P31 wd:Q5.' },
];
