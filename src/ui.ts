/** Crea un elemento. El texto siempre va como textContent, así lo que escribe el jugador no se interpreta como HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase = '',
  texto = '',
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto) elemento.textContent = texto;
  return elemento;
}

export function boton(clase: string, texto: string, alTocar: () => void): HTMLButtonElement {
  const elemento = el('button', clase, texto);
  elemento.type = 'button';
  elemento.addEventListener('click', alTocar);
  return elemento;
}
