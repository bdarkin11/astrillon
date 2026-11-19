import { describe, expect, it } from 'vitest';
import { consignasDelDia, fechaDeHoy, fechaLegible, fechasDelArchivo, numeroDeViaje, PRIMER_VIAJE, sumarDias } from './diario';
import { MODOS } from './modos';
import { Partida } from './partida-prueba';
import {
  aGuardada,
  calcularRacha,
  guardarProgreso,
  leerProgreso,
  progresoVacio,
  registrarViaje,
  restaurarResultados,
} from './progreso';
import type { Almacen, Progreso } from './progreso';
import type { Consigna } from './tipos';

const consignas: Consigna[] = ['a', 'b', 'c'].map((id) => ({
  id,
  texto: `Consigna ${id}`,
  respuestas: [
    { nombre: `Comun ${id}`, nivel: 'basura', alias: [] },
    { nombre: `Joya ${id}`, nivel: 'astrillon', alias: [] },
  ],
}));

function almacenDePrueba(inicial?: string): Almacen {
  let dato = inicial ?? null;
  return { getItem: () => dato, setItem: (_clave, valor) => { dato = valor; } };
}

function conDias(...fechas: [string, string?][]): Progreso {
  const progreso = progresoVacio();
  for (const [fecha, jugadoEn] of fechas) {
    progreso.dias[fecha] = { jugadoEn: jugadoEn ?? fecha, respuestas: [], terminado: true };
  }
  return progreso;
}

describe('viaje del día', () => {
  it('cambia a la medianoche de Argentina, no a la de Greenwich', () => {
    expect(fechaDeHoy(new Date('2026-11-05T02:59:00Z'))).toBe('2026-11-04');
    expect(fechaDeHoy(new Date('2026-11-05T03:00:00Z'))).toBe('2026-11-05');
  });

  it('numera los viajes y cruza bien los cambios de mes y de año', () => {
    expect(numeroDeViaje(PRIMER_VIAJE)).toBe(1);
    expect(numeroDeViaje('2026-11-04')).toBe(4);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(fechaLegible('2026-11-04')).toBe('4 de noviembre de 2026');
  });

  it('da siempre el mismo orden para una fecha, con todas las consignas una vez', () => {
    const lista = Array.from({ length: 72 }, (_, i) => i);
    const dia = consignasDelDia('2026-11-04', lista);
    expect(dia).toEqual(consignasDelDia('2026-11-04', lista));
    expect([...dia].sort((a, b) => a - b)).toEqual(lista);
  });

  it('no repite las primeras consignas entre días seguidos, tampoco con un banco múltiplo del salto', () => {
    for (const largo of [72, 77]) {
      const lista = Array.from({ length: largo }, (_, i) => i);
      for (let d = 0; d < 6; d++) {
        const hoy = consignasDelDia(sumarDias(PRIMER_VIAJE, d), lista).slice(0, 10);
        const manana = consignasDelDia(sumarDias(PRIMER_VIAJE, d + 1), lista).slice(0, 10);
        expect(hoy.filter((c) => manana.includes(c))).toEqual([]);
      }
      const primeras = Array.from({ length: largo }, (_, d) => consignasDelDia(sumarDias(PRIMER_VIAJE, d), lista)[0]);
      expect(new Set(primeras).size).toBe(largo);
    }
  });

  it('el archivo lista los días pasados sin hoy, del más nuevo al más viejo', () => {
    expect(fechasDelArchivo('2026-11-04')).toEqual(['2026-11-03', '2026-11-02', '2026-11-01']);
    expect(fechasDelArchivo(PRIMER_VIAJE)).toEqual([]);
  });
});

describe('racha', () => {
  it('sigue viva si hoy todavía no se jugó, y se corta si faltó un día', () => {
    const progreso = conDias(['2026-11-02'], ['2026-11-03']);
    expect(calcularRacha(progreso, '2026-11-03').actual).toBe(2);
    expect(calcularRacha(progreso, '2026-11-04').actual).toBe(2);
    expect(calcularRacha(progreso, '2026-11-05').actual).toBe(0);
  });

  it('no cuenta los viajes del archivo ni los que quedaron sin terminar', () => {
    const progreso = conDias(['2026-11-01', '2026-11-04'], ['2026-11-03']);
    progreso.dias['2026-11-02'] = { jugadoEn: '2026-11-02', respuestas: [], terminado: false };
    expect(calcularRacha(progreso, '2026-11-03')).toEqual({ actual: 1, mejor: 1 });
  });

  it('recuerda la mejor racha aunque la actual sea menor', () => {
    const progreso = conDias(['2026-11-01'], ['2026-11-02'], ['2026-11-03'], ['2026-11-07']);
    expect(calcularRacha(progreso, '2026-11-07')).toEqual({ actual: 1, mejor: 3 });
  });
});

describe('progreso guardado', () => {
  it('sobrevive a guardar y volver a leer', () => {
    const almacen = almacenDePrueba();
    const progreso = conDias(['2026-11-01']);
    progreso.mejorTotal = 120;
    guardarProgreso(almacen, progreso);
    expect(leerProgreso(almacen)).toEqual(progreso);
  });

  it('arranca de cero con datos rotos, de otra versión o sin almacén', () => {
    expect(leerProgreso(almacenDePrueba('{roto'))).toEqual(progresoVacio());
    expect(leerProgreso(almacenDePrueba('{"version":99}'))).toEqual(progresoVacio());
    expect(leerProgreso(null)).toEqual(progresoVacio());
  });

  it('no rompe si el almacén falla al escribir', () => {
    const almacen: Almacen = { getItem: () => null, setItem: () => { throw new Error('lleno'); } };
    expect(() => guardarProgreso(almacen, progresoVacio())).not.toThrow();
  });

  it('retoma un viaje con los mismos puntos y errores, y salteando lo que ya no existe', () => {
    const partida = new Partida(consignas, MODOS[0], false);
    partida.responder('Joya a');
    partida.responder('cualquier cosa');
    partida.agotarTiempo();
    const guardadas = partida.resultados.map(aGuardada);

    const retomada = new Partida(consignas, MODOS[0], false, restaurarResultados(guardadas, consignas));
    expect(retomada.total).toBe(100);
    expect(retomada.cantidadErrores).toBe(1);
    expect(retomada.aciertos).toBe(1);
    expect(retomada.consignaActual?.id).toBe('c');

    const sinLaPrimera = consignas.filter((c) => c.id !== 'a');
    expect(restaurarResultados(guardadas, sinLaPrimera)).toHaveLength(1);
  });

  it('con otro error termina un viaje retomado de 2 errores', () => {
    const partida = new Partida(consignas, MODOS[0], false);
    partida.agotarTiempo();
    const retomada = new Partida(consignas, MODOS[0], false, restaurarResultados(partida.resultados.map(aGuardada), consignas));
    retomada.responder('tampoco');
    expect(retomada.terminada).toBe(false);
    retomada.agotarTiempo();
    expect(retomada.terminada).toBe(true);
  });
});

describe('atlas', () => {
  it('suma sólo lo nuevo y marca récord desde el segundo viaje', () => {
    const progreso = progresoVacio();
    const primera = new Partida(consignas, MODOS[0], false);
    primera.responder('Joya a');
    expect(registrarViaje(progreso, primera.resultados, primera.total)).toEqual({ paradas: 6, joyas: 1, record: false });
    expect(progreso.joyas).toEqual({ a: 'Joya a' });

    expect(registrarViaje(progreso, primera.resultados, primera.total)).toEqual({ paradas: 0, joyas: 0, record: false });

    const segunda = new Partida(consignas, MODOS[0], false);
    segunda.responder('Joya a');
    segunda.responder('Joya b');
    expect(registrarViaje(progreso, segunda.resultados, segunda.total)).toEqual({ paradas: 4, joyas: 1, record: true });
    expect(progreso.viajes).toBe(3);
    expect(progreso.mejorTotal).toBe(200);
  });
});
