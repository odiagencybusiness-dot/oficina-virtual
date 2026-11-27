// Escenas en pixel art de cada puesto de la oficina, dibujadas píxel a píxel en un <canvas>.
// Sin imágenes externas. Fase 1: escenas fijas que cambian según el estado del agente.
'use strict';

const W = 56;
const H = 44;

const PERSONAJES = {
  buscador: { pelo: '#6b3e26', piel: '#f2c29b', camisa: '#2a9d8f', cartel: '#264653' },
  envio: { pelo: '#e9c46a', piel: '#ffdbac', camisa: '#e76f51', cartel: '#6d2e46' },
  lector: { pelo: '#1d1d1d', piel: '#c68642', camisa: '#457b9d', cartel: '#1d3557' },
  contestador: { pelo: '#7b2cbf', piel: '#f1c27d', camisa: '#f28482', cartel: '#3c1642' },
  avisos: { pelo: '#c1121f', piel: '#8d5524', camisa: '#ffb703', cartel: '#3d2b1f' },
  recepcion: { pelo: '#d9d9d9', piel: '#e0ac69', camisa: '#6a994e', cartel: '#283618' },
};

const PANTALLA = { ok: '#3ddc84', trabajando: '#ffd166', durmiendo: '#1b1e2e', error: '#ef476f', 'sin datos': '#6c7086' };

function escena(canvas, agente, estado) {
  const p = PERSONAJES[agente] || PERSONAJES.buscador;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const dormido = estado === 'durmiendo';

  // Pared y suelo
  r(0, 0, W, 16, '#2b2d42');
  r(0, 14, W, 2, '#20223a');
  for (let y = 16; y < H; y += 4) for (let x = 0; x < W; x += 4) r(x, y, 4, 4, ((x + y) / 4) % 2 ? '#3a3f5c' : '#343954');

  // Cartel de la pared (cada puesto el suyo)
  r(42, 3, 11, 8, p.cartel);
  r(43, 4, 9, 6, '#f1faee');
  if (agente === 'buscador') { r(45, 5, 1, 1, '#e63946'); r(48, 7, 1, 1, '#e63946'); r(50, 5, 1, 1, '#e63946'); r(44, 8, 7, 1, '#a8dadc'); }
  else if (agente === 'envio') { r(44, 5, 7, 4, '#ffffff'); r(44, 5, 1, 1, '#999'); r(45, 6, 1, 1, '#999'); r(46, 7, 3, 1, '#999'); r(49, 6, 1, 1, '#999'); r(50, 5, 1, 1, '#999'); }
  else if (agente === 'lector') { r(44, 5, 7, 1, '#457b9d'); r(44, 7, 5, 1, '#457b9d'); r(44, 9, 6, 1, '#457b9d'); }
  else if (agente === 'contestador') { r(44, 5, 7, 3, '#f28482'); r(45, 8, 2, 1, '#f28482'); }
  else if (agente === 'avisos') { r(46, 4, 3, 1, '#ffb703'); r(45, 5, 5, 3, '#ffb703'); r(44, 8, 7, 1, '#ffb703'); r(47, 9, 1, 1, '#3d2b1f'); }
  else { for (let i = 0; i < 3; i++) r(44 + i * 2, 5 + i, 2, 4 - i, '#6a994e'); r(44, 9, 7, 1, '#283618'); }

  // Silla
  r(14, 19, 18, 12, '#1f2235');
  r(15, 20, 16, 1, '#2e3250');

  // Personaje
  r(18, 10, 10, 4, p.pelo);
  r(17, 12, 1, 5, p.pelo);
  r(28, 12, 1, 5, p.pelo);
  r(18, 13, 10, 8, p.piel);
  r(18, 13, 10, 1, p.pelo);
  if (dormido) { r(20, 17, 2, 1, '#2b2d42'); r(24, 17, 2, 1, '#2b2d42'); }
  else { r(20, 16, 1, 2, '#1b1b2f'); r(25, 16, 1, 2, '#1b1b2f'); }
  r(22, 19, 2, 1, estado === 'error' ? '#1b1b2f' : '#b5651d');
  r(21, 21, 4, 1, p.piel);
  r(17, 22, 12, 8, p.camisa);
  r(21, 22, 4, 1, '#f1faee');
  r(15, 24, 2, 6, p.camisa);
  r(29, 24, 2, 6, p.camisa);
  r(15, 30, 2, 1, p.piel);
  r(29, 30, 2, 1, p.piel);

  // Accesorios
  if (agente === 'lector') { r(19, 15, 3, 3, '#e0e0e0'); r(24, 15, 3, 3, '#e0e0e0'); r(20, 16, 1, 1, p.piel); r(25, 16, 1, 1, p.piel); r(22, 16, 2, 1, '#e0e0e0'); if (!dormido) { r(20, 16, 1, 1, '#1b1b2f'); r(25, 16, 1, 1, '#1b1b2f'); } }
  if (agente === 'recepcion') { r(17, 9, 12, 1, '#1b1b2f'); r(16, 10, 1, 6, '#1b1b2f'); r(15, 15, 2, 3, '#1b1b2f'); r(17, 18, 3, 1, '#1b1b2f'); }

  // Mesa
  r(6, 30, 44, 3, '#b07a52');
  r(6, 33, 44, 9, '#8d5a3b');
  r(6, 33, 44, 1, '#5e3a26');
  r(38, 37, 6, 1, '#5e3a26');
  r(7, 42, 2, 2, '#5e3a26');
  r(47, 42, 2, 2, '#5e3a26');

  // Monitor
  r(32, 17, 14, 11, '#2d3142');
  r(33, 18, 12, 8, PANTALLA[estado] || PANTALLA['sin datos']);
  if (estado === 'ok') { r(35, 20, 6, 1, '#1b5e3b'); r(35, 22, 8, 1, '#1b5e3b'); }
  if (estado === 'trabajando') { r(34, 19, 7, 1, '#7a5c00'); r(34, 21, 9, 1, '#7a5c00'); r(34, 23, 5, 1, '#7a5c00'); }
  if (estado === 'error') { r(38, 19, 2, 4, '#ffffff'); r(38, 24, 2, 1, '#ffffff'); }
  r(38, 28, 2, 2, '#2d3142');
  r(36, 29, 6, 1, '#2d3142');

  // Cosas de la mesa
  if (agente === 'buscador') { r(10, 26, 4, 1, '#c0c0c0'); r(9, 27, 1, 2, '#c0c0c0'); r(14, 27, 1, 2, '#c0c0c0'); r(10, 29, 4, 1, '#c0c0c0'); r(10, 27, 4, 2, '#a8dadc'); r(14, 29, 2, 1, '#5e3a26'); }
  if (agente === 'envio') { r(9, 27, 7, 3, '#ffffff'); r(9, 25, 7, 2, '#f1faee'); r(10, 26, 1, 1, '#bbb'); r(11, 27, 3, 1, '#bbb'); r(14, 26, 1, 1, '#bbb'); }
  if (agente === 'contestador') { r(3, 2, 13, 7, '#ffffff'); r(5, 9, 2, 2, '#ffffff'); r(5, 5, 1, 1, '#2b2d42'); r(9, 5, 1, 1, '#2b2d42'); r(13, 5, 1, 1, '#2b2d42'); }
  if (agente === 'avisos') { r(9, 26, 4, 1, '#ffb703'); r(8, 27, 6, 3, '#ffb703'); r(10, 25, 2, 1, '#ffb703'); }
  if (agente === 'recepcion') { r(8, 27, 8, 3, '#f1faee'); r(8, 27, 8, 1, '#e63946'); r(10, 28, 1, 1, '#2b2d42'); r(13, 28, 1, 1, '#2b2d42'); }
  if (agente === 'lector') { r(9, 28, 6, 2, '#f1faee'); r(10, 26, 6, 2, '#e9ecef'); }

  // Planta
  r(50, 36, 4, 6, '#a0522d');
  r(49, 30, 6, 6, '#4caf50');
  r(51, 28, 2, 2, '#2e7d32');

  // Estado sobre la cabeza
  if (dormido) { r(31, 9, 3, 1, '#a8dadc'); r(32, 10, 1, 1, '#a8dadc'); r(31, 11, 3, 1, '#a8dadc'); r(34, 5, 2, 1, '#a8dadc'); r(35, 6, 1, 1, '#a8dadc'); r(34, 7, 2, 1, '#a8dadc'); }
  if (estado === 'error') { r(22, 2, 2, 5, '#ef476f'); r(22, 8, 2, 1, '#ef476f'); }
}

window.OficinaSprites = { escena, PERSONAJES };
