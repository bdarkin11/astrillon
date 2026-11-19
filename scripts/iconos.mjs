// Genera los íconos de la app (public/iconos) a partir del dibujo de la nave.
// Uso: node scripts/iconos.mjs
// Se dibuja a 48x48 y se agranda sin suavizar, para que los píxeles queden parejos.
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { NAVE, PALETA_DE_LA_NAVE, TOBERAS } = await vite.ssrLoadModule('/src/viaje/nave.ts');
await vite.close();

const BASE = 48;
const FONDO = '#16123a';

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function dibujoChico() {
  const pixeles = Array.from({ length: BASE * BASE }, () => rgb(FONDO));
  const pintar = (x, y, hex) => {
    if (x >= 0 && y >= 0 && x < BASE && y < BASE) pixeles[y * BASE + x] = rgb(hex);
  };
  // Un planeta asomando abajo, con su borde de atmósfera.
  for (let y = 0; y < BASE; y++) for (let x = 0; x < BASE; x++) if ((x - 24) ** 2 + (y - 70) ** 2 < 31 * 31) pintar(x, y, '#2c3a78');
  for (let x = 0; x < BASE; x++) pintar(x, Math.round(70 - Math.sqrt(Math.max(0, 31 * 31 - (x - 24) ** 2))), '#3ad6c5');
  for (const [x, y] of [[6, 7], [40, 5], [34, 15], [9, 26], [43, 30], [17, 4], [28, 9]]) pintar(x, y, '#ffffff');
  pintar(39, 5, '#ffb238');
  pintar(41, 5, '#ffb238');
  pintar(40, 4, '#ffb238');
  pintar(40, 6, '#ffb238');
  const alto = NAVE.length;
  const ancho = NAVE[0].length;
  const ox = Math.round((BASE - ancho) / 2);
  const oy = Math.round((BASE - alto) / 2) - 3;
  for (const columna of TOBERAS) {
    for (let i = 0; i < 3; i++) pintar(ox + columna, oy + alto - 2 + i, '#ffe066');
    for (let i = 3; i < 5; i++) pintar(ox + columna, oy + alto - 2 + i, '#ff8a3c');
  }
  NAVE.forEach((fila, y) => [...fila].forEach((letra, x) => PALETA_DE_LA_NAVE[letra] && pintar(ox + x, oy + y, PALETA_DE_LA_NAVE[letra])));
  return pixeles;
}

function png(lado, margen) {
  const chico = dibujoChico();
  const escala = Math.floor((lado - margen * 2) / BASE);
  const inicio = Math.round((lado - BASE * escala) / 2);
  const filas = Buffer.alloc((lado * 3 + 1) * lado);
  const fondo = rgb(FONDO);
  for (let y = 0; y < lado; y++) {
    filas[y * (lado * 3 + 1)] = 0;
    for (let x = 0; x < lado; x++) {
      const cx = Math.floor((x - inicio) / escala);
      const cy = Math.floor((y - inicio) / escala);
      const color = cx >= 0 && cy >= 0 && cx < BASE && cy < BASE ? chico[cy * BASE + cx] : fondo;
      filas.set(color, y * (lado * 3 + 1) + 1 + x * 3);
    }
  }
  const bloque = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const control = Buffer.alloc(4);
    control.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, control]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(filas)),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/iconos', { recursive: true });
// "mascara" deja margen: Android recorta los íconos en círculo o en gota.
for (const [nombre, lado, margen] of [['icono-192.png', 192, 0], ['icono-512.png', 512, 0], ['icono-mascara-512.png', 512, 56], ['apple-touch-icon.png', 180, 0]]) {
  writeFileSync(`public/iconos/${nombre}`, png(lado, margen));
}
console.log('Íconos generados en public/iconos');
