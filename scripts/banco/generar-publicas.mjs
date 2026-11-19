// Escribe la lista de consignas que puede ver el navegador: sólo el id y el texto, sin respuestas.
// Correrlo cada vez que se agregan o se quitan consignas; un test avisa si quedó desactualizada.
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const servidor = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { CONSIGNAS } = await servidor.ssrLoadModule('/privado/banco.ts');
const publicas = CONSIGNAS.map(({ id, texto }) => ({ id, texto }));
writeFileSync('src/datos/consignas-publicas.json', `${JSON.stringify(publicas, null, 1)}\n`);
console.log(`${publicas.length} consignas públicas`);
await servidor.close();
