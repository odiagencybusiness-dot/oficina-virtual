// Oficina virtual: descifra panel.enc.json con la contraseña (en el navegador) y pinta
// la oficina y las salas. Nada sale del navegador: no hay servidor ni analítica.
'use strict';

const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const KEY_STORE = 'oficina-key';
const REFRESH_MS = 5 * 60_000;
let panel = null;
let cryptoKey = null;

// ---------- utilidades ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const n = (x) => Number(x || 0).toLocaleString('es-ES');
const safeUrl = (u) => {
  if (!u) return '';
  try { const p = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch { return ''; }
};
const link = (u, label) => (safeUrl(u) ? `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(label || u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '');

function rel(iso) {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}
const fmt = (iso, tz = 'Europe/Madrid', opts = { dateStyle: 'medium', timeStyle: 'short' }) => (iso ? new Date(iso).toLocaleString('es-ES', { timeZone: tz, ...opts }) : '');
const fecha = (iso) => fmt(iso, 'Europe/Madrid', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ---------- cifrado ----------
async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
async function fetchFile() {
  const r = await fetch(`panel.enc.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('No se pudo descargar la oficina');
  return r.json();
}
async function decrypt(file, key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(file.iv) }, key, b64(file.data));
  const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

async function login(password) {
  const file = await fetchFile();
  const key = await deriveKey(password, file.salt, file.iter);
  panel = await decrypt(file, key); // lanza error si la contraseña no es la correcta
  cryptoKey = key;
  try { sessionStorage.setItem(KEY_STORE, toB64(await crypto.subtle.exportKey('raw', key))); } catch { /* sin almacenamiento */ }
}

async function restore() {
  let raw = null;
  try { raw = sessionStorage.getItem(KEY_STORE); } catch { return false; }
  if (!raw) return false;
  try {
    cryptoKey = await crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', true, ['decrypt']);
    panel = await decrypt(await fetchFile(), cryptoKey);
    return true;
  } catch {
    try { sessionStorage.removeItem(KEY_STORE); } catch { /* nada */ }
    return false;
  }
}

async function refresh() {
  if (!cryptoKey) return;
  try {
    panel = await decrypt(await fetchFile(), cryptoKey);
    render(true);
  } catch { /* se reintenta en el siguiente ciclo */ }
}

// ---------- agentes ----------
const PUESTOS = [
  { id: 'buscador', titulo: 'Buscador de leads', icono: '🔍', desc: 'Busca restaurantes independientes cada lunes y mantiene la reserva.' },
  { id: 'envio', titulo: 'Envío', icono: '✉️', desc: 'Calienta las cuentas y envía la secuencia de 3 emails en horario de EE. UU.' },
  { id: 'lector', titulo: 'Lector de respuestas', icono: '📥', desc: 'Lee el correo cada media hora y clasifica cada respuesta.' },
  { id: 'contestador', titulo: 'Contestador', icono: '💬', desc: 'Contesta solo a los "sí" claros con el enlace de reserva.' },
  { id: 'avisos', titulo: 'Avisos', icono: '🔔', desc: 'Te avisa por Telegram de cada respuesta y de la búsqueda semanal.' },
  { id: 'recepcion', titulo: 'Recepción', icono: '📅', desc: 'El CRM con todos los leads y las llamadas reservadas.' },
];
const ESTADO_TXT = { ok: 'OK', trabajando: 'Trabajando', durmiendo: 'Durmiendo', error: 'Error', 'sin datos': 'Sin datos' };
const estadoDe = (id) => panel.agentes?.[id] || { estado: 'sin datos', resumen: 'Todavía no ha fichado' };
const stClass = (e) => (ESTADO_TXT[e] ? e.replace(' ', '') : 'none').replace('sindatos', 'none');

function pintarCanvas(root = document) {
  root.querySelectorAll('canvas[data-agente]').forEach((c) => window.OficinaSprites.escena(c, c.dataset.agente, c.dataset.estado));
}

// ---------- vistas ----------
function vistaOficina() {
  const t = panel.totales || {};
  const desks = PUESTOS.map((p) => {
    const a = estadoDe(p.id);
    return `
      <button type="button" class="desk" data-go="sala/${p.id}" aria-label="Entrar en la sala de ${esc(p.titulo)}">
        <canvas class="pixel" data-agente="${p.id}" data-estado="${esc(a.estado)}" width="56" height="44"></canvas>
        <div class="desk-head"><span class="desk-name">${p.icono} ${esc(p.titulo)}</span><span class="st ${stClass(a.estado)}">${esc(ESTADO_TXT[a.estado] || a.estado)}</span></div>
        <p class="desk-sum">${esc(a.resumen || '—')}</p>
        ${a.estado === 'error' && a.error ? `<p class="err">⚠ ${esc(a.error)}</p>` : ''}
        <p class="desk-when">${a.ultima ? `Último trabajo ${rel(a.ultima)}` : 'Aún no ha trabajado'}</p>
      </button>`;
  }).join('');
  return `
    <div class="office-title"><h1>Bar Ops · Oficina</h1><p>Haz clic en un puesto para entrar en su sala.</p></div>
    <section class="board" aria-label="Pizarra">
      <div><div class="k">Reserva</div><div class="v">${n(panel.reserva?.actual)}<small> / ${n(panel.reserva?.objetivo)}</small></div></div>
      <div><div class="k">Leads</div><div class="v">${n(t.leads)}</div></div>
      <div><div class="k">A revisar</div><div class="v">${n(t.revisar)}</div></div>
      <div><div class="k">Respuestas</div><div class="v">${n(Object.values(panel.respuestas?.por_tipo || {}).reduce((a, b) => a + b, 0))}</div></div>
      <div><div class="k">Te toca responder</div><div class="v">${n(panel.respuestas?.pendientes_humano?.length)}</div></div>
      <div><div class="k">Llamadas próximas</div><div class="v">${n(t.llamadas_proximas)}</div></div>
    </section>
    <section class="floor" aria-label="Puestos">${desks}</section>`;
}

function cabeceraSala(id, extra = '') {
  const p = PUESTOS.find((x) => x.id === id);
  const a = estadoDe(id);
  return `
    <a href="#oficina" class="back">← Volver a la oficina</a>
    <div class="room-head">
      <canvas class="pixel" data-agente="${id}" data-estado="${esc(a.estado)}" width="56" height="44"></canvas>
      <div>
        <h1>${p.icono} ${esc(p.titulo)}</h1>
        <p class="muted">${esc(p.desc)}</p>
        <p><span class="st ${stClass(a.estado)}">${esc(ESTADO_TXT[a.estado] || a.estado)}</span> ${esc(a.resumen || '')}</p>
        <p class="muted">${a.ultima ? `Último trabajo: ${fecha(a.ultima)} (${rel(a.ultima)})` : 'Aún no ha trabajado'}</p>
        ${a.error ? `<p class="err" style="color:var(--err)">⚠ ${esc(a.error)}${a.ultimo_error ? ` · ${rel(a.ultimo_error)}` : ''}</p>` : ''}
        ${extra}
      </div>
    </div>`;
}

const kpi = (k, v) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
const vacio = (t) => `<p class="empty">${esc(t)}</p>`;

function barras(rows, max) {
  const m = max || Math.max(1, ...rows.map((r) => r.valores.reduce((a, b) => a + b, 0)));
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row"><span class="lbl" title="${esc(r.label)}">${esc(r.label)}</span>
      <span class="bar">${r.valores.map((v, i) => (v ? `<span class="c${i + 1}" style="width:${(v / m) * 100}%" title="${v}"></span>` : '')).join('')}</span>
      <span>${r.valores.map(n).join(' · ')}</span></div>`).join('')}</div>`;
}

function columnas(dias, series) {
  const max = Math.max(1, ...dias.map((d) => series.reduce((a, s) => a + (d[s.k] || 0), 0)));
  const cols = dias.map((d) => `<div class="col" title="${esc(d.fecha)}: ${series.map((s) => `${s.label} ${d[s.k] || 0}`).join(', ')}">${series.map((s, i) => (d[s.k] ? `<span class="c${i + 1}" style="height:${(d[s.k] / max) * 100}%"></span>` : '')).join('')}</div>`).join('');
  const labels = dias.map((d, i) => `<span>${i % 3 === 0 ? esc(d.fecha.slice(8)) : ''}</span>`).join('');
  return `<div class="legend">${series.map((s, i) => `<span><i class="c${i + 1}"></i>${esc(s.label)}</span>`).join('')}</div><div class="cols">${cols}</div><div class="col-labels">${labels}</div>`;
}

function tabla(cols, rows) {
  if (!rows.length) return vacio('Nada por aquí todavía.');
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function salaBuscador() {
  const b = panel.buscador || {};
  const zonas = b.zonas || [];
  const tiles = zonas.map((z) => `<div class="tile ${z.estado.replace(' ', '')} ${z.siguiente ? 'next' : ''}" title="${esc(z.estado)}">
      <b>${esc(z.nombre)}</b><span class="muted">${esc(z.estado)}${z.nuevos ? ` · +${z.nuevos}` : ''}${z.siguiente ? ' · siguiente' : ''}</span>
      ${z.agotada_hasta ? `<span class="muted">vuelve el ${esc(z.agotada_hasta)}</span>` : ''}</div>`).join('');
  return `${cabeceraSala('buscador')}
    <div class="kpis">${kpi('Reserva', `${n(panel.reserva?.actual)} / ${n(panel.reserva?.objetivo)}`)}${kpi('Leads', n(panel.totales?.leads))}${kpi('A revisar', n(panel.totales?.revisar))}${kpi('Descartados', n(b.descartados?.total))}${kpi('Ciudades hechas', `${zonas.filter((z) => z.estado !== 'pendiente').length} / ${zonas.length}`)}</div>
    <div class="grid2">
      <section class="card"><h2>Leads por ciudad</h2><div class="legend"><span><i class="c1"></i>Leads</span><span><i class="c2"></i>A revisar</span></div>
        ${barras((b.por_ciudad || []).map((c) => ({ label: c.zona, valores: [c.leads, c.revisar] })))}</section>
      <section class="card"><h2>Por qué se descartan</h2>${barras((b.descartados?.motivos || []).map(([m, v]) => ({ label: m, valores: [v] })))}</section>
    </div>
    <section class="card"><h2>Rotación de ciudades</h2><p class="muted">La línea discontinua marca dónde empezará la próxima búsqueda.</p><div class="tiles">${tiles}</div></section>
    <section class="card"><h2>Últimas búsquedas</h2>${(b.historial || []).map((h) => `<div class="msg"><div class="msg-head"><b>${fecha(h.fecha)}</b></div><pre class="aviso">${esc(h.texto)}</pre></div>`).join('') || vacio('Aún no hay búsquedas semanales.')}</section>
    <section class="card"><h2>A revisar (${n(b.revisar?.length)})</h2><p class="muted">Casos dudosos: no entran en la lista de envío hasta que alguien los revise.</p>
      ${tabla(['Restaurante', 'Ciudad', 'Motivo', 'Web'], (b.revisar || []).map((r) => [esc(r.nombre), esc(r.zona), esc(r.motivo), link(r.web)]))}</section>`;
}

function salaEnvio() {
  const e = panel.envio || {};
  const cuentas = (e.cuentas || []).map((c) => `
    <div class="kpi"><div class="k">Cuenta ${c.n} · ${esc(c.fase)}</div><div class="v" style="font-size:15px">${esc(c.user)}</div>
      ${c.fase === 'calentamiento'
    ? `<p class="muted" style="margin:4px 0">Día ${c.dia} de ${e.warmup_dias} · hoy ${c.calentamiento_hoy}/${c.calentamiento_cupo} al equipo</p><div class="bar"><span class="c2" style="width:${Math.min(100, (c.dia / e.warmup_dias) * 100)}%"></span></div>`
    : `<p class="muted" style="margin:4px 0">Hoy ${c.leads_hoy}/${c.leads_cupo} a restaurantes</p><div class="bar"><span class="c1" style="width:${c.leads_cupo ? Math.min(100, (c.leads_hoy / c.leads_cupo) * 100) : 0}%"></span></div>`}
    </div>`).join('');
  const sec = e.secuencia || {};
  const paso = e.por_paso || {};
  return `${cabeceraSala('envio', `<p class="muted">Horario: ${esc(e.horario || '')}</p>`)}
    <div class="kpis">${cuentas || kpi('Cuentas', '0')}</div>
    <section class="card"><h2>Emails por día (últimos 21 días)</h2>${columnas(e.por_dia || [], [{ k: 'leads', label: 'A restaurantes' }, { k: 'calentamiento', label: 'Calentamiento' }, { k: 'contestadas', label: 'Respuestas automáticas' }, { k: 'test', label: 'Pruebas' }])}</section>
    <div class="grid2">
      <section class="card"><h2>Secuencia</h2><div class="kpis">${kpi('Email 1', n(paso[1]))}${kpi('Email 2', n(paso[2]))}${kpi('Email 3', n(paso[3]))}</div>
        ${barras([{ label: 'En curso', valores: [sec.activa || 0] }, { label: 'Terminada', valores: [sec.terminada || 0] }, { label: 'Respondió', valores: [sec.respondio || 0] }, { label: 'Rebotado', valores: [sec.rebotado || 0] }, { label: 'Baja', valores: [(sec.baja || 0) + (sec.no_interesado || 0)] }])}</section>
      <section class="card"><h2>Últimos errores</h2>${tabla(['Cuándo', 'Cuenta', 'Qué', 'Detalle'], (e.errores || []).map((x) => [fecha(x.fecha), esc(x.cuenta), esc(x.paso), esc(x.detalle)]))}</section>
    </div>`;
}

const TIPO_TXT = { interesado: '🟢 Interesado', pregunta: '❓ Pregunta', revisar: '🔎 Revisar', mas_tarde: '🕐 Más tarde', no_interesado: '🙅 No interesado', baja: '⛔ Baja', rebote: '↩️ Rebote', automatica: '🤖 Automática', respuesta: '💬 Respuesta' };

function conversaciones(lista) {
  if (!lista.length) return vacio('Todavía no ha respondido nadie.');
  return `<div class="conv">${lista.map((c) => `
    <div class="msg ${esc(c.tipo)}"><div class="msg-head"><b>${esc(c.nombre)}</b><span>${esc(c.zona)}</span><span class="chip">${esc(TIPO_TXT[c.tipo] || c.tipo)}</span>${c.modo === 'test' ? '<span class="chip test">test</span>' : ''}<span>${fecha(c.fecha)}</span></div>
      ${c.extracto ? `<p>“${esc(c.extracto)}”</p>` : ''}
      ${c.contestada ? `<div class="reply">↪ Contestado automáticamente con el enlace de reserva · ${fecha(c.contestada)}</div>` : ''}</div>`).join('')}</div>`;
}

function salaLector() {
  const r = panel.respuestas || {};
  const tipos = Object.entries(r.por_tipo || {}).map(([t, v]) => kpi(TIPO_TXT[t] || t, n(v))).join('');
  return `${cabeceraSala('lector')}
    <div class="kpis">${tipos || kpi('Respuestas', '0')}</div>
    <section class="card"><h2>🙋 Te toca responder (${n(r.pendientes_humano?.length)})</h2>${tabla(['Restaurante', 'Ciudad', 'Email', 'Motivo'], (r.pendientes_humano || []).map((p) => [esc(p.nombre), esc(p.zona), esc(p.email), esc(p.motivo === 'pregunta' ? 'Tiene una pregunta' : 'No está claro qué quiere')]))}</section>
    <section class="card"><h2>Conversaciones</h2>${conversaciones(r.conversaciones || [])}</section>`;
}

function salaContestador() {
  const r = panel.respuestas || {};
  const contestadas = (r.conversaciones || []).filter((c) => c.contestada || c.tipo === 'interesado');
  return `${cabeceraSala('contestador')}
    <div class="kpis">${kpi('Contestadas solas', n(r.contestadas))}${kpi('En cola', n((r.cola || []).filter((c) => c.estado === 'pendiente').length))}${kpi('Para ti', n(r.pendientes_humano?.length))}</div>
    <section class="card"><h2>Cola de respuestas automáticas</h2><p class="muted">Espera al menos 20 minutos y al horario laboral del restaurante. Nunca contesta dos veces al mismo lead.</p>
      ${tabla(['Restaurante', 'Estado', 'Recibido', 'Enviada', 'Motivo'], (r.cola || []).map((c) => [esc(c.nombre), `${esc(c.estado)}${c.modo === 'test' ? ' <span class="chip test">test</span>' : ''}`, fecha(c.recibido), fecha(c.enviada), esc(c.motivo || '')]))}</section>
    <section class="card"><h2>Interesados y contestados</h2>${conversaciones(contestadas)}</section>`;
}

function salaAvisos() {
  const a = panel.avisos || [];
  return `${cabeceraSala('avisos')}
    <div class="kpis">${kpi('Avisos', n(a.length))}${kpi('Por Telegram', n(a.filter((x) => x.canales.includes('telegram')).length))}${kpi('Pendientes', n(a.filter((x) => !x.canales.includes('telegram')).length))}</div>
    <section class="card"><h2>Historial</h2>${a.length ? `<div class="conv">${a.map((x) => `<div class="msg"><div class="msg-head"><b>${fecha(x.fecha)}</b>${x.canales.includes('telegram') ? '<span class="chip live">Telegram ✓</span>' : '<span class="chip test">sin enviar</span>'}</div><pre class="aviso">${esc(x.texto)}</pre></div>`).join('')}</div>` : vacio('Sin avisos todavía.')}</section>`;
}

const ETAPAS = ['Nuevo', 'Contactado', 'Respondió', 'Interesado', 'Llamada agendada', 'Cliente'];
const LATERALES = ['No interesado', 'Más tarde / Frío', 'Baja'];
let filtroCrm = '';

function tarjeta(l) {
  return `<button type="button" class="lead" data-lead="${esc(l.id)}">${esc(l.nombre)}<small>${esc(l.zona)}${Number(l.locales) > 1 ? ` · ${esc(l.locales)} locales` : ''}${l.secuencia_paso ? ` · email ${esc(l.secuencia_paso)}/3` : ''}${l.pendiente_humano && l.estado_embudo === 'Respondió' ? ' · 🙋' : ''}</small></button>`;
}

function salaRecepcion() {
  const L = panel.llamadas || {};
  const q = filtroCrm.toLowerCase();
  const leads = (panel.crm || []).filter((l) => !q || `${l.nombre} ${l.zona} ${l.email} ${l.dueno_nombre}`.toLowerCase().includes(q));
  const por = (e) => leads.filter((l) => (l.estado_embudo || 'Nuevo') === e);
  const LIMITE = 60;
  const lanes = ETAPAS.map((e) => {
    const ls = por(e);
    return `<div class="lane"><h3><span>${esc(e)}</span><span>${ls.length}</span></h3>${ls.slice(0, LIMITE).map(tarjeta).join('')}${ls.length > LIMITE ? `<p class="muted">… y ${ls.length - LIMITE} más (usa el buscador)</p>` : ''}</div>`;
  }).join('');
  const laterales = LATERALES.map((e) => `<span class="chip">${esc(e)}: ${por(e).length}</span>`).join('');
  const filaLlamada = (c) => [fmt(c.inicio, 'Europe/Madrid'), esc(c.nombre || c.invitado_nombre || '—'), esc(c.zona), esc(c.invitado), esc(c.titulo)];
  return `${cabeceraSala('recepcion')}
    <div class="kpis">${kpi('Llamadas próximas', n(L.proximas?.length))}${kpi('Leads', n(panel.crm?.length))}${kpi('Interesados', n(por('Interesado').length))}${kpi('Clientes', n(por('Cliente').length))}</div>
    <section class="card"><h2>📅 Llamadas reservadas</h2>
      ${L.conectado ? `<p class="muted">Calendario leído ${rel(L.actualizado)}. Horas de Madrid.</p>` : '<p class="muted">El calendario aún no está conectado (falta la dirección secreta iCal).</p>'}
      <h3 class="muted" style="font:700 11px var(--pix);text-transform:uppercase">Próximas</h3>${tabla(['Cuándo (Madrid)', 'Restaurante', 'Ciudad', 'Email', 'Cita'], (L.proximas || []).map(filaLlamada))}
      ${(L.pasadas || []).length ? `<h3 class="muted" style="font:700 11px var(--pix);text-transform:uppercase;margin-top:12px">Pasadas (30 días)</h3>${tabla(['Cuándo (Madrid)', 'Restaurante', 'Ciudad', 'Email', 'Cita'], L.pasadas.map(filaLlamada))}` : ''}</section>
    <section class="card"><h2>CRM (solo lectura)</h2>
      <div class="crm-tools"><input type="search" id="crm-q" placeholder="Buscar por nombre, ciudad, email o dueño…" value="${esc(filtroCrm)}" aria-label="Buscar leads"></div>
      <div class="kanban">${lanes}</div><div class="side-states">${laterales}</div></section>`;
}

function fichaLead(id) {
  const l = (panel.crm || []).find((x) => x.id === id);
  if (!l) return;
  const f = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '');
  $('#modal-body').innerHTML = `
    <h2 id="modal-title">${esc(l.nombre)}</h2><p class="muted">${esc(l.direccion || l.zona)}</p>
    <p><span class="chip">${esc(l.estado_embudo || 'Nuevo')}</span> ${l.pendiente_humano && l.estado_embudo === 'Respondió' ? '<span class="chip test">🙋 te toca responder</span>' : ''}</p>
    <dl class="fields">
      ${f('Email', `${esc(l.email)}${l.email_estado ? ` <span class="muted">(${esc(l.email_estado)})</span>` : ''}`)}
      ${f('Dueño', esc(l.dueno_nombre))}
      ${f('Teléfono', esc(l.telefono))}
      ${f('Web', link(l.web))}
      ${f('Instagram', link(l.instagram))}
      ${f('Facebook', link(l.facebook))}
      ${f('Tipo', esc([l.tipo, (l.cocina || '').replace(/;/g, ', ').replace(/_/g, ' ')].filter(Boolean).join(' · ')))}
      ${f('Locales', esc(l.locales || '1'))}
      ${f('Envío', l.canal ? esc(l.canal === 'formulario' ? 'Formulario de la web' : `Email ${l.secuencia_paso || '?'} de 3 · ${l.secuencia_estado || ''}`) : '')}
      ${f('Último envío', l.ultimo_envio ? fecha(l.ultimo_envio) : '')}
      ${f('Respuesta auto.', l.respuesta_auto ? fecha(l.respuesta_auto) : '')}
      ${f('Próxima acción', esc(l.proxima_accion))}
      ${f('Motivo ICP', esc(l.motivo_icp))}
      ${f('Alta', esc(`${l.fecha_alta} · ${l.origen}`))}
    </dl>`;
  $('#modal').hidden = false;
}

// ---------- router ----------
const SALAS = { buscador: salaBuscador, envio: salaEnvio, lector: salaLector, contestador: salaContestador, avisos: salaAvisos, recepcion: salaRecepcion };

function render(keepScroll = false) {
  if (!panel) return;
  const y = window.scrollY;
  const [, sala] = (location.hash.match(/^#sala\/(\w+)/) || []);
  $('#view').innerHTML = SALAS[sala] ? SALAS[sala]() : vistaOficina();
  pintarCanvas($('#view'));
  const modo = panel.modo === 'live' ? 'live' : 'test';
  $('#modo').className = `chip ${modo}`;
  $('#modo').textContent = modo === 'live' ? 'Envío real' : 'Modo test';
  $('#updated').textContent = `Datos ${rel(panel.generado)}`;
  $('#updated').title = `Generados el ${fmt(panel.generado)} (Madrid). Se actualizan cada 30–60 min.`;
  document.title = SALAS[sala] ? `${PUESTOS.find((p) => p.id === sala).titulo} · Oficina` : 'Oficina';
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  const q = $('#crm-q');
  if (q) q.oninput = (e) => { filtroCrm = e.target.value; const pos = e.target.selectionStart; render(true); const nq = $('#crm-q'); nq.focus(); nq.setSelectionRange(pos, pos); };
}

function relojes() {
  const t = (tz) => new Date().toLocaleTimeString('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  $('#clocks').innerHTML = `<span>Madrid <b>${t('Europe/Madrid')}</b></span><span>Kentucky <b>${t('America/New_York')}</b></span><span>Nashville <b>${t('America/Chicago')}</b></span>`;
}

function entrar() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  relojes();
  render();
  setInterval(relojes, 30_000);
  setInterval(refresh, REFRESH_MS);
  setInterval(() => { if (panel) $('#updated').textContent = `Datos ${rel(panel.generado)}`; }, 60_000);
}

// ---------- eventos ----------
window.addEventListener('hashchange', () => render());
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = go.dataset.go; return; }
  const lead = e.target.closest('[data-lead]');
  if (lead) { fichaLead(lead.dataset.lead); return; }
  if (e.target.id === 'modal' || e.target.closest('#modal-close')) $('#modal').hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').hidden = true; });
$('#logout').onclick = () => {
  try { sessionStorage.removeItem(KEY_STORE); } catch { /* nada */ }
  panel = null; cryptoKey = null;
  location.hash = '';
  location.reload();
};
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const err = $('#login-error');
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Abriendo…';
  try {
    await login($('#pass').value);
    $('#pass').value = '';
    entrar();
  } catch (ex) {
    err.textContent = /descargar/.test(ex.message) ? ex.message : 'Contraseña incorrecta.';
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

(async () => {
  window.OficinaSprites.escena($('#login-sprite'), 'recepcion', 'ok');
  if (!window.crypto?.subtle || !window.DecompressionStream) {
    $('#login-error').textContent = 'Este navegador es demasiado antiguo para abrir la oficina.';
    $('#login-error').hidden = false;
    return;
  }
  if (await restore()) entrar();
})();
