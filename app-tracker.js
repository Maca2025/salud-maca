/* ================================================================
   RENDER DEL HORARIO / TRACKER
================================================================ */
function badgeHtml(supId) {
  const b = bloqueDeSup(supId);
  if(!b) return '';
  return `<span class="sups-badge" style="background:${b.color}22;color:${b.color}">${esc(b.label)}</span>`;
}

/* Estado de un bloque respecto a la hora actual.
   Solo aplica cuando se está registrando HOY. */
function estadoBloque(b){
  if(fechaActiva !== hoyISO()) return 'neutro';
  if(!b.desde) return 'neutro';
  const ahora = new Date();
  const min = ahora.getHours()*60 + ahora.getMinutes();
  const aMin = h => { const [H,M] = String(h).split(':').map(Number); return H*60 + (M||0); };
  const ini = aMin(b.desde);
  const fin = b.hasta ? aMin(b.hasta) : ini + 60;
  if(min < ini)  return 'proximo';
  if(min <= fin) return 'ahora';
  return 'pasado';
}

/* Resumen de lo que falta hoy, ordenado por urgencia. */
/* Cruza las interacciones documentadas con la distribución actual de
   bloques: si dos que interactúan quedaron en el mismo bloque, avisa.

   SOLO avisa de las de tipo "absorcion". El resto también son reales,
   pero el horario no las resuelve: las metabólicas ocurren en el hígado
   horas después de tragar la pastilla, y las aditivas coinciden de noche
   a propósito. Avisar de ellas aquí sería peor que no avisar, porque el
   texto invita a arrastrarlas a otro bloque — y eso haría desaparecer el
   aviso sin cambiar nada del problema. Viven en la lista de Interacciones,
   que es material de referencia para consulta.

   Una interacción sin `tipo` se trata como "absorcion" y avisa: si algún
   día se añade una y se olvida el campo, es mejor un aviso de más.
   El campo se define en INTERACCIONES, dentro del Apps Script. */
function detectarConflictos(){
  if(!INTERACCIONES.length || !SUPS.length) return [];
  // Índice de palabras clave → id de suplemento.
  // Ojo: solo indexa palabras de MÁS de 4 letras, así que "zinc" no entra
  // por sí sola. Por eso los títulos dicen "Picolinato de Zinc".
  const porNombre = {};
  SUPS.forEach(s=>{
    const base = String(s.sustancia||'').toLowerCase();
    porNombre[base] = s.id;
    base.split(/[\s+·,()]+/).forEach(p=>{ if(p.length>4 && !porNombre[p]) porNombre[p]=s.id; });
  });

  const conflictos = [];
  INTERACCIONES.forEach(it=>{
    if(it.nivel === 'verde') return;   // las sinergias no son conflicto
    if((it.tipo || 'absorcion') !== 'absorcion') return;  // el horario no las arregla
    const txt = (it.titulo||'').toLowerCase();
    const encontrados = [];
    Object.keys(porNombre).forEach(k=>{
      if(txt.includes(k) && !encontrados.includes(porNombre[k])) encontrados.push(porNombre[k]);
    });
    if(encontrados.length < 2) return;
    // ¿Quedaron en el mismo bloque?
    const bloques = {};
    encontrados.forEach(id=>{
      const b = bloqueDeSup(id);
      if(!b) return;
      (bloques[b.id] = bloques[b.id] || []).push(id);
    });
    Object.keys(bloques).forEach(bid=>{
      if(bloques[bid].length < 2) return;
      const b = BLOQUES.find(x=>x.id===bid);
      conflictos.push({
        bloque: b, nivel: it.nivel, titulo: it.titulo,
        sups: bloques[bid].map(id=>{ const s=supById(id); return s?s.sustancia:id; })
      });
    });
  });
  return conflictos;
}

function renderConflictos(){
  const cont = document.getElementById('conflictos-bloques');
  if(!cont) return;
  const cs = detectarConflictos();
  if(!cs.length){ cont.innerHTML=''; return; }
  cont.innerHTML = cs.map(x=>`
    <div class="conflicto ${x.nivel}">
      <span class="conf-ico">${x.nivel==='rojo'?'⚠️':'ℹ️'}</span>
      <div>
        <strong>${esc(x.sups.join(' + '))}</strong> están juntos en
        <strong>${esc(x.bloque.icon)} ${esc(x.bloque.label)}</strong>.
        <div class="conf-txt">${esc(x.titulo)} — compiten al absorberse: sepáralos arrastrando uno a otro bloque.</div>
      </div>
    </div>`).join('');
}

function renderPendientes(){
  const cont = document.getElementById('pendientes-hoy');
  if(!cont) return;

  // Registro retroactivo: los avisos de urgencia solo tienen sentido en vivo.
  // Completando un día pasado no hay nada "para más tarde" — hay que decir
  // qué día se está completando y quitarse de en medio.
  if(fechaActiva !== hoyISO()){
    const enJuego = supsEnJuego();
    const hechos  = enJuego.filter(s=>trackerState[s.id]).length;
    cont.innerHTML = `<div class="pend-box pend-retro">
      📅 Estás completando <strong>${fechaBonita(fechaActiva)}</strong> — llevas ${hechos} de ${enJuego.length}.
      <span class="pend-retro-sub">Marca lo que tomaste ese día. Lo que dejes sin marcar se guarda como no tomado,
      así que si no te acuerdas de algo, mejor déjalo y vuelve.</span></div>`;
    return;
  }

  const grupos = {ahora:[], pasado:[], proximo:[]};
  BLOQUES.forEach(b=>{
    const faltan = idsEnJuego(LAYOUT[b.id]).filter(id => !trackerState[id]);
    if(!faltan.length) return;
    const est = estadoBloque(b);
    if(grupos[est]) grupos[est].push({b, n:faltan.length});
  });

  const enJuego = supsEnJuego();
  const total = enJuego.length;
  const hechos = enJuego.filter(s=>trackerState[s.id]).length;

  if(hechos === total){
    cont.innerHTML = `<div class="pend-box pend-ok">🎉 Todo tomado hoy — ${total} de ${total}.
      No olvides <strong>guardar</strong>.</div>`;
    return;
  }

  const chip = (g, cls) => g.map(x =>
    `<span class="pend-chip ${cls}">${esc(x.b.icon)} ${esc(x.b.label)} · ${x.n}</span>`).join('');

  let html = `<div class="pend-box">
    <div class="pend-head">Hoy llevas <strong>${hechos} de ${total}</strong></div>
    <div class="pend-chips">`;
  if(grupos.ahora.length)   html += `<span class="pend-lbl">Toca ahora:</span>` + chip(grupos.ahora,'ahora');
  if(grupos.pasado.length)  html += `<span class="pend-lbl">Pendiente:</span>`  + chip(grupos.pasado,'pasado');
  if(grupos.proximo.length) html += `<span class="pend-lbl">Más tarde:</span>`  + chip(grupos.proximo,'proximo');
  html += '</div>';
  if(grupos.proximo.length) html += `<div class="pend-nota">Lo de «más tarde» no se guarda como olvido:
    queda sin respuesta hasta que vuelvas.</div>`;
  html += '</div>';
  cont.innerHTML = html;
}

function renderHorario() {
  const container = document.getElementById('sups-horario-container');
  if (!container) return;
  SUPS.forEach(s => { if (!(s.id in trackerState)) trackerState[s.id] = false; });
  normalizeLayout();

  let html = '';
  // Se muestran en orden cronológico; los ya vencidos sin completar
  // quedan marcados para que salten a la vista.
  const orden = [...BLOQUES].sort((x,y)=>(x.desde||'99:99').localeCompare(y.desde||'99:99'));
  orden.forEach(b => {
    const ids   = LAYOUT[b.id] || [];
    const items = ids.map(supById).filter(Boolean);
    // Los pendientes de comprar se ven, pero no cuentan para el progreso:
    // un frasco que no tienes en casa no es un olvido.
    const activos = items.filter(s => !supPorComprar(s));
    const done  = activos.filter(s => trackerState[s.id]).length;
    const pct   = activos.length ? Math.round(done / activos.length * 100) : 0;
    const todosMarcados = activos.length > 0 && done === activos.length;
    const franja = (b.desde && b.hasta) ? `${b.desde}–${b.hasta}` : (b.desde || '');

    const est = estadoBloque(b);
    const incompleto = done < activos.length;
    html += `<div class="sups-slot est-${est}${est==='pasado'&&incompleto?' vencido':''}" data-blk-id="${b.id}">
      <div class="sups-slot-hdr" style="background:${b.color}">
        <span class="sups-slot-icon">${esc(b.icon)}</span>
        <div>
          <span class="sups-slot-label">${esc(b.label)}</span>
          <span class="sups-slot-sub">${esc(b.desc)}</span>
        </div>
        <span class="sups-slot-time">${esc(franja)}${
          est==='ahora'  ? ' <span class="slot-tag ahora">ahora</span>' :
          est==='pasado' && incompleto ? ' <span class="slot-tag vencido">pendiente</span>' : ''}</span>
        <span class="sups-slot-actions">
          <button class="blk-check-btn" title="Marcar o desmarcar todo el bloque"
            onclick="toggleBloque('${b.id}')">${todosMarcados?'☑ todo':'☐ todo'}</button>
          <button class="blk-ico-btn" title="Editar bloque" onclick="abrirModalBloque('${b.id}')">✎</button>
        </span>
      </div>
      <div class="sups-slot-body" data-blk-id="${b.id}">`;

    if(!items.length){
      html += `<div class="blk-empty" style="pointer-events:none">Bloque vacío — arrastra un suplemento aquí</div>`;
    }
    items.forEach(s => {
      const alertIco = s.nivel===2?'🔴':s.nivel===1?'🟡':'';

      // Pendiente de comprar: se ve para no olvidarlo, pero sin casilla.
      // Sin casilla no se puede marcar, y sin marcar no ensucia el registro.
      if(supPorComprar(s)){
        html += `<div class="tracker-item por-comprar" id="ti-${s.id}" data-sup-id="${s.id}">
          <span class="drag-handle" title="Arrastrar para mover o reordenar">⣿</span>
          <span class="tracker-cb-hueco" title="Todavía no lo tienes">🛒</span>
          <label>
            <strong>${esc(s.sustancia)} ${alertIco} <span class="tag-comprar">por comprar</span></strong>
            <em>${esc(s.dosis)} · ${esc(s.formato)}</em>
            <span>No cuenta en la adherencia ni en el costo hasta que lo tengas.</span>
          </label>
        </div>`;
        return;
      }

      const chk = trackerState[s.id] ? 'checked' : '';
      const guardado = !!(yaRegistrado && yaRegistrado[s.id]);
      const cls = (trackerState[s.id] ? 'checked' : '') + (guardado ? ' ya-guardado' : '');
      html += `<div class="tracker-item ${cls}" id="ti-${s.id}" data-sup-id="${s.id}">
        <span class="drag-handle" title="Arrastrar para mover o reordenar">⣿</span>
        <input type="checkbox" class="tracker-cb" id="cb-${s.id}" ${chk} onchange="toggleTracker('${s.id}',this)">
        <label for="cb-${s.id}">
          <strong>${esc(s.sustancia)} ${alertIco}</strong>
          <em>${esc(s.dosis)} · ${esc(s.formato)}</em>
          <span>${esc(s.absorcion)}</span>
        </label>
      </div>`;
    });

    html += `</div>
      <div class="sups-progress-bar-wrap">
        <div class="sups-prog-bar"><div class="sups-prog-fill" id="pbar-${b.id}" style="width:${pct}%;background:${b.color}"></div></div>
        <span class="sups-prog-txt" id="ptxt-${b.id}" style="color:${b.color}">${done}/${activos.length}</span>
      </div>
    </div>`;
  });
  container.innerHTML = html;
  attachDnD();
  renderPendientes();
  renderConflictos();
}

function toggleTracker(id, cb) {
  trackerState[id] = cb.checked;
  guardarBorrador();
  const item = document.getElementById('ti-'+id);
  if (item) item.classList.toggle('checked', cb.checked);
  const b = bloqueDeSup(id);
  if (!b) return;
  const ids  = idsEnJuego(LAYOUT[b.id]);
  const done = ids.filter(x => trackerState[x]).length;
  const pct  = ids.length ? Math.round(done/ids.length*100) : 0;
  const bar = document.getElementById('pbar-'+b.id);
  const txt = document.getElementById('ptxt-'+b.id);
  if(bar) bar.style.width = pct+'%';
  if(txt) txt.textContent = done+'/'+ids.length;
  const slot = document.querySelector(`.sups-slot[data-blk-id="${b.id}"]`);
  if(slot) slot.classList.toggle('vencido', estadoBloque(b)==='pasado' && done < ids.length);
  // (ids ya viene filtrado de pendientes de comprar)
  const btn = slot && slot.querySelector('.blk-check-btn');
  if(btn) btn.textContent = (done===ids.length && ids.length) ? '☑ todo' : '☐ todo';
  renderPendientes();
}

function resetTracker() {
  if(!confirm('¿Desmarcar todo lo del día en pantalla?\n\n(No borra lo que ya esté guardado en la hoja.)')) return;
  SUPS.forEach(s => { trackerState[s.id]=false; });
  limpiarBorrador();
  renderHorario();
  renderAvisoDia();
}

/* Marca o desmarca todos los suplementos de un bloque de una vez. */
function toggleBloque(blkId){
  const ids = idsEnJuego(LAYOUT[blkId]);
  if(!ids.length) return;
  const todosMarcados = ids.every(id => trackerState[id]);
  ids.forEach(id => { trackerState[id] = !todosMarcados; });
  guardarBorrador();
  renderHorario();
}

/* ================================================================
   DRAG & DROP — mover entre bloques y reordenar dentro del bloque
================================================================ */
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.tracker-item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset) return {offset, element: child};
    return closest;
  }, {offset: Number.NEGATIVE_INFINITY}).element || null;
}

function commitLayoutFromDOM(){
  const nuevo = {};
  document.querySelectorAll('#sups-horario-container .sups-slot-body').forEach(body=>{
    const blkId = body.dataset.blkId;
    nuevo[blkId] = [...body.querySelectorAll('.tracker-item')].map(el=>el.dataset.supId);
  });
  LAYOUT = nuevo;
  normalizeLayout();
  saveSupsConfig();
}

function attachDnD(){
  const root = document.getElementById('sups-horario-container');
  if(!root) return;

  // El item sólo es arrastrable si el gesto empieza en el handle
  root.querySelectorAll('.drag-handle').forEach(h=>{
    const item = h.closest('.tracker-item');
    h.addEventListener('mousedown', ()=> item.setAttribute('draggable','true'));
    h.addEventListener('touchstart', ()=> item.setAttribute('draggable','true'), {passive:true});
  });

  root.querySelectorAll('.tracker-item').forEach(item=>{
    item.addEventListener('dragstart', e=>{
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', item.dataset.supId); } catch(_){}
    });
    item.addEventListener('dragend', ()=>{
      item.classList.remove('dragging');
      item.removeAttribute('draggable');
      root.querySelectorAll('.sups-slot-body').forEach(b=>b.classList.remove('drag-target'));
      commitLayoutFromDOM();
      renderHorario();   // refresca barras de progreso y estado vacío
    });
  });

  root.querySelectorAll('.sups-slot-body').forEach(body=>{
    body.addEventListener('dragover', e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dragging = root.querySelector('.tracker-item.dragging');
      if(!dragging) return;
      body.classList.add('drag-target');
      const vacio = body.querySelector('.blk-empty');
      if(vacio) vacio.remove();
      const after = getDragAfterElement(body, e.clientY);
      if(after == null) body.appendChild(dragging);
      else body.insertBefore(dragging, after);
    });
    body.addEventListener('dragleave', e=>{
      if(!body.contains(e.relatedTarget)) body.classList.remove('drag-target');
    });
    body.addEventListener('drop', e=>{
      e.preventDefault();
      body.classList.remove('drag-target');
    });
  });
}

/* ================================================================
   MODAL: crear / editar / eliminar bloque
================================================================ */
const BLK_COLORES = ['#7B5EA7','#E67E22','#2D6A4F','#2471A3','#C0392B','#16A085','#D4A017','#8E44AD','#34495E'];

function abrirModalBloque(blkId){
  const esNuevo = !blkId;
  const b = esNuevo
    ? {id:'blk-'+Date.now().toString(36), label:'', desc:'', icon:'💊', desde:'', hasta:'', color:BLK_COLORES[(BLOQUES.length)%BLK_COLORES.length]}
    : BLOQUES.find(x=>x.id===blkId);
  if(!b) return;

  const host = document.getElementById('blk-modal-host');
  host.innerHTML = `
  <div class="blk-modal-bg" onmousedown="blkFondoDown(event,this)" onclick="blkFondoClick(event,this)">
    <div class="blk-modal">
      <div class="blk-modal-hdr">
        <span>${esNuevo?'Nuevo bloque':'Editar bloque'}</span>
        <button onclick="cerrarModalBloque()">×</button>
      </div>
      <div class="blk-modal-body">
        <div class="blk-row">
          <div class="blk-field" style="max-width:88px">
            <label>Ícono</label>
            <input id="blk-f-icon" maxlength="4" value="${esc(b.icon)}" style="text-align:center;font-size:1.1rem">
          </div>
          <div class="blk-field">
            <label>Nombre del bloque</label>
            <input id="blk-f-label" value="${esc(b.label)}" placeholder="Ej. Media tarde">
          </div>
        </div>
        <div class="blk-row">
          <div class="blk-field">
            <label>Desde</label>
            <input id="blk-f-desde" type="time" value="${esc(b.desde)}">
          </div>
          <div class="blk-field">
            <label>Hasta</label>
            <input id="blk-f-hasta" type="time" value="${esc(b.hasta)}">
          </div>
        </div>
        <div class="blk-field">
          <label>Descripción</label>
          <textarea id="blk-f-desc" placeholder="Ej. Con la comida principal">${esc(b.desc)}</textarea>
        </div>
        <div class="blk-field">
          <label>Color</label>
          <div class="blk-colors" id="blk-f-colors">
            ${BLK_COLORES.map(c=>`<div class="blk-color ${c===b.color?'sel':''}" style="background:${c}" data-color="${c}" onclick="pickColor(this)"></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="blk-modal-foot">
        ${esNuevo?'':`<button class="blk-btn danger" onclick="eliminarBloque('${b.id}')">Eliminar bloque</button>`}
        <button class="blk-btn ghost" onclick="cerrarModalBloque()">Cancelar</button>
        <button class="blk-btn primary" onclick="guardarBloque('${b.id}',${esNuevo})">Guardar</button>
      </div>
    </div>
  </div>`;
}

function pickColor(el){
  el.parentNode.querySelectorAll('.blk-color').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
}
/* Un clic solo cierra si EMPEZO y TERMINO en el fondo. Sin esto, seleccionar
   texto de un campo arrastrando y soltar fuera del recuadro cerraba el modal.
   Bandera propia: fondoClick de app-base.js llama a cerrarForm() fijo. */
let _blkFondo = false;
function blkFondoDown(ev, el){ _blkFondo = (ev.target === el); }
function blkFondoClick(ev, el){
  const empezoFuera = _blkFondo;
  _blkFondo = false;
  if(ev.target === el && empezoFuera) cerrarModalBloque();
}
function cerrarModalBloque(){
  _blkFondo = false;
  const host = document.getElementById('blk-modal-host');
  if(host) host.innerHTML='';
}

function guardarBloque(id, esNuevo){
  const label = document.getElementById('blk-f-label').value.trim();
  if(!label){ alert('Ponle un nombre al bloque.'); return; }
  const selColor = document.querySelector('#blk-f-colors .blk-color.sel');
  const datos = {
    id,
    label,
    desc:  document.getElementById('blk-f-desc').value.trim(),
    icon:  document.getElementById('blk-f-icon').value.trim() || '💊',
    desde: document.getElementById('blk-f-desde').value,
    hasta: document.getElementById('blk-f-hasta').value,
    color: selColor ? selColor.dataset.color : '#2D6A4F'
  };
  if(esNuevo){
    BLOQUES.push(datos);
    LAYOUT[id] = [];
    // Ordena los bloques por hora de inicio (los sin hora, al final)
    BLOQUES.sort((a,c)=>(a.desde||'99:99').localeCompare(c.desde||'99:99'));
  } else {
    const i = BLOQUES.findIndex(x=>x.id===id);
    if(i>=0) BLOQUES[i] = datos;
    BLOQUES.sort((a,c)=>(a.desde||'99:99').localeCompare(c.desde||'99:99'));
  }
  normalizeLayout();
  saveSupsConfig();
  cerrarModalBloque();
  renderHorario();
  renderProtocolo();
}

function eliminarBloque(id){
  if(BLOQUES.length<=1){ alert('Debe quedar al menos un bloque.'); return; }
  const b = BLOQUES.find(x=>x.id===id);
  const items = LAYOUT[id]||[];
  const destino = BLOQUES.find(x=>x.id!==id);
  const aviso = items.length
    ? `Se eliminará "${b.label}" y sus ${items.length} suplemento(s) pasarán a "${destino.label}". El historial no se ve afectado.`
    : `Se eliminará el bloque "${b.label}".`;
  if(!confirm(aviso)) return;
  LAYOUT[destino.id] = (LAYOUT[destino.id]||[]).concat(items);
  delete LAYOUT[id];
  BLOQUES = BLOQUES.filter(x=>x.id!==id);
  normalizeLayout();
  saveSupsConfig();
  cerrarModalBloque();
  renderHorario();
  renderProtocolo();
}

function renderProtocolo() {
  const container = document.getElementById('sups-proto-cards');
  if (!container) return;
  let html = '';
  SUPS.forEach(s => {
    const alertIco = s.nivel===2?'🔴':s.nivel===1?'🟡':'';
    const precio = s.precio ? '$'+s.precio.toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:2}) : '';
    const linkHtml = s.link ? `<a href="${s.link}" target="_blank" class="sup-card-link">Ver →</a>` : '';
    const alertaHtml = s.alerta ? `<div class="sup-card-alerta">${alertIco} ${s.alerta}</div>` : '';
    html += `<div class="sup-card">
      <div class="sup-card-hdr">
        <span class="sup-card-name">${s.sustancia}${alertIco?' '+alertIco:''}</span>
        ${badgeHtml(s.id)}
      </div>
      <div class="sup-card-meta">
        <span>${s.nombre}</span><span class="sup-card-dot">·</span>
        <span>${s.marca}</span><span class="sup-card-dot">·</span>
        <strong>${s.dosis}</strong><span class="sup-card-dot">·</span>
        <span>${s.formato}</span>
      </div>
      <div class="sup-card-beneficio">${s.beneficio}</div>
      <div class="sup-card-absorcion">⏰ ${s.absorcion}</div>
      ${alertaHtml}
      <div class="sup-card-footer">
        <span>${s.sitio}${precio?' · <span class="sup-card-precio">'+precio+'</span>':''}</span>
        <span style="display:flex;gap:11px;align-items:center">
          <button class="link-btn" onclick="editarSuplemento('${s.id}')">Editar</button>
          ${linkHtml}
        </span>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

/* ── Costo estimado del protocolo ──────────────────────────
   `precio` es el del ENVASE. Con `unidades` (piezas que trae),
   `por_toma` y `frecuencia` sale el costo por pieza y el gasto al mes.
   `envase_de` agrupa las filas que comparten frasco, para no pagar
   dos veces el mismo bote ni subestimar lo rápido que se vacía.
   Todo se edita desde la app; ya no hace falta tocar la hoja.
   ──────────────────────────────────────────────────────────── */
function renderCostos(){
  const cont = document.getElementById('sups-costo');
  if(!cont) return;

  // Los pendientes de comprar no entran en "reponer todo": reponer es
  // volver a comprar algo que se acabó, no comprar algo que nunca tuviste.
  const enJuego = supsEnJuego();
  const conPrecio = enJuego.filter(s => Number(s.precio) > 0);
  const porComprar = SUPS.filter(supPorComprar);
  if(!conPrecio.length){ cont.innerHTML = ''; return; }

  // El precio vive en la fila que tiene el envase. Si dos filas comparten
  // frasco (calcio y calcio_noche), solo la raíz cuenta para "reponer todo":
  // si no, un mismo bote se pagaría dos veces.
  const grupos = gruposDeEnvase(enJuego);
  let totalEnvases = 0, mensual = 0, conDatos = 0, gruposConPrecio = 0;

  grupos.forEach((filas, raizId) => {
    const raiz = filas.find(x => x.id === raizId) || filas[0];
    const precio = Number(raiz.precio);
    if(!(precio > 0)) return;
    gruposConPrecio++;
    totalEnvases += precio;

    // Piezas al día que se llevan de ESE envase, sumando todas sus filas
    const u = unidadesDe(raiz);
    const diarias = filas.reduce((t,x) => t + piezasDia(x), 0);
    if(u > 0 && diarias > 0){
      mensual += (precio / u) * diarias * 30;
      conDatos++;
    }
  });

  const fmt = n => '$' + Math.round(n).toLocaleString('es-MX');
  const caros = [...conPrecio].sort((a,b)=>Number(b.precio)-Number(a.precio)).slice(0,3);
  const sinPrecio = enJuego.length - conPrecio.length;

  // A cuántos les falta el dato de piezas por envase para poder calcular
  const faltanUnidades = [];
  grupos.forEach((filas, raizId) => {
    const raiz = filas.find(x => x.id === raizId) || filas[0];
    if(Number(raiz.precio) > 0 && !unidadesDe(raiz)) faltanUnidades.push(raiz.sustancia);
  });

  cont.innerHTML = `
    <div class="costo-box">
      <div class="costo-head">💰 Costo del protocolo</div>
      <div class="costo-grid">
        <div class="costo-stat"><strong>${fmt(totalEnvases)}</strong><span>reponer todo</span></div>
        ${conDatos ? `<div class="costo-stat"><strong>${fmt(mensual)}</strong>
          <span>al mes${conDatos<gruposConPrecio?` · ${conDatos} de ${gruposConPrecio}`:''}</span></div>` : ''}
        <div class="costo-stat"><strong>${conPrecio.length}</strong><span>con precio${sinPrecio?` · ${sinPrecio} sin`:''}</span></div>
      </div>
      <div class="costo-top">Los tres más caros:
        ${caros.map(s=>`<span class="costo-chip">${esc(s.sustancia)} ${fmt(Number(s.precio))}</span>`).join('')}
      </div>
      ${sinPrecio ? `<div class="costo-aviso">⚠️ <strong>${sinPrecio} de ${enJuego.length}</strong> no tienen precio,
        así que el total va corto. Se ponen en Protocolo → Editar.</div>` : ''}
      ${faltanUnidades.length ? `<div class="costo-nota">
        Para el gasto mensual falta saber cuántas piezas trae el envase de:
        <strong>${faltanUnidades.map(esc).join(' · ')}</strong>.
        Se pone en Protocolo → Editar → <em>Piezas por envase</em>.
      </div>` : ''}
      ${porComprar.length ? `<div class="costo-nota">
        ${porComprar.length} pendiente${porComprar.length>1?'s':''} de comprar, fuera de este total:
        ${porComprar.map(s=>esc(s.sustancia)).join(' · ')}.
      </div>` : ''}
    </div>`;
}

/* Etiqueta de cada interacción según si el horario la resuelve.
   Es la misma clasificación que usa detectarConflictos() para decidir
   si avisa o no; mostrarla aquí evita que un aviso ausente parezca
   un olvido, y que uno presente parezca resoluble cuando no lo es. */
const INT_TIPOS = {
  absorcion:  {txt:'Se resuelve con el horario', ico:'⏱', color:'#2D6A4F'},
  metabolica: {txt:'No depende del horario',     ico:'🧬', color:'#7B5EA7'},
  aditiva:    {txt:'Efecto que se suma',         ico:'➕', color:'#B9770E'},
  contexto:   {txt:'Contexto, no un horario',    ico:'📋', color:'#5D6D7E'},
};

function renderInteracciones() {
  const container = document.getElementById('sups-int-container');
  if (!container) return;
  const orden = ['rojo','amarillo','verde'];
  const titulos = {rojo:'🔴 Atención — Revisar con médico', amarillo:'🟡 Precaución — Considerar', verde:'✅ Sinergias beneficiosas'};
  let html = '';
  orden.forEach(nv => {
    const items = INTERACCIONES.filter(i=>i.nivel===nv);
    if (!items.length) return;
    html += `<div class="int-section-title">${titulos[nv]}</div>`;
    items.forEach(it => {
      const t = INT_TIPOS[it.tipo] || INT_TIPOS.absorcion;
      html += `<div class="int-card ${nv}">
        <span class="int-icon">${nv==='rojo'?'⚠️':nv==='amarillo'?'ℹ️':'💚'}</span>
        <div class="int-text"><span class="int-title">${it.titulo}</span>${it.texto}
          <span class="int-tipo" style="background:${t.color}1a;color:${t.color}">${t.ico} ${esc(t.txt)}</span>
        </div>
      </div>`;
    });
  });
  container.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════
   HOY — la pantalla de inicio
   ---------------------------------------------------------------
   La app estaba organizada por tipo de dato: composicion, laboratorio,
   nutricion, suplementos, fotos. Esa es la estructura de la hoja de
   calculo, no la del dia. "Hoy" junta lo que se HACE, cada cosa a un
   toque, y deja las secciones debajo para lo que se REVISA.

   El principio: que la app pida menos disciplina, no que ayude a tener
   mas. Si algo cuesta tres toques, no se hace.

   POR QUE ESTO NO REUTILIZA toggleTracker NI guardarDia
   Las casillas del tracker solo marcan en memoria: lo que escribe en la
   hoja es el boton "Guardar dia". Desde aqui eso no sirve — marcarias y
   no se guardaria nada. Y guardarDia() depende de `fechaActiva`, que
   puede estar en un dia pasado, y puede sacar confirmaciones.

   Por eso Hoy guarda por su cuenta y SIEMPRE en modo merge, que el
   servidor ya soporta: merge solo agrega tomas y nunca convierte un 1
   en 0. Consecuencia deliberada: desde Hoy se puede marcar pero no
   desmarcar. Es lo que hace imposible que un toque por error borre lo
   del dia; para corregir se va al tracker.
   ═══════════════════════════════════════════════════════════════ */
const VASO_ML   = 250;
const VASOS_DIA = 8;
const PROT_MIN  = 1.2;   // g por kg de peso
const PROT_MAX  = 1.6;

/* Calculo propio del bloque activo, sin depender de `fechaActiva`: el
   tracker puede estar mirando un dia pasado y la portada habla de HOY. */
function bloqueAhora(){
  const ahora = new Date();
  const min = ahora.getHours()*60 + ahora.getMinutes();
  const aMin = h => { const t = String(h||'').split(':').map(Number); return t[0]*60 + (t[1]||0); };
  const lista = (BLOQUES||[]).filter(b => b.desde).slice()
                  .sort((a,b) => aMin(a.desde) - aMin(b.desde));
  if(!lista.length) return {actual:null, siguiente:null};

  let actual = null, siguiente = null;
  for(const b of lista){
    const ini = aMin(b.desde), fin = b.hasta ? aMin(b.hasta) : ini + 60;
    if(min >= ini && min <= fin){ actual = b; continue; }
    if(min < ini && !siguiente) siguiente = b;
  }
  if(!actual && !siguiente) siguiente = lista[0];   // ya no queda nada hoy
  return {actual, siguiente};
}

function supsDeBloque(b){
  if(!b) return [];
  return idsEnJuego(LAYOUT[b.id] || []).map(supById).filter(Boolean);
}

function tomasDeHoy(){
  const d = (HIST || []).find(h => h.fecha === hoyISO());
  return d ? (d.tomas || {}) : {};
}

function aguaHoyMl(){ const d = ingestaDe(hoyISO()); return d ? (d.agua || 0) : 0; }

function protHoyG(){
  const d = ingestaDe(hoyISO());
  return d ? Math.round((d.prot_animal || 0) + (d.prot_vegetal || 0)) : 0;
}

function protObjetivo(){
  const last = DATA.length ? DATA[DATA.length-1] : null;
  const kg = last ? last.peso : 100;
  return {min: Math.round(kg*PROT_MIN), max: Math.round(kg*PROT_MAX)};
}

/* Marca un suplemento y lo guarda en el acto. Merge: solo suma. */
async function tocarSup(id, cb){
  if(!cb.checked){
    cb.checked = true;
    alert('Desde aquí solo se puede marcar, nunca desmarcar.\n\n' +
          'Es lo que hace imposible que un toque por error borre lo del día. ' +
          'Para corregir, ve a Suplementos → Horario & Tracker.');
    return;
  }
  cb.disabled = true;
  try {
    await api({action:'save', fecha:hoyISO(), hora:horaAhora(),
               tomados:id, todos:id, modo:'merge'});
    // Se refleja en memoria sin recargarlo todo: la hoja ya tiene la verdad.
    let d = (HIST || []).find(h => h.fecha === hoyISO());
    if(!d){ d = {fecha:hoyISO(), hora:horaAhora(), tomas:{}, nota:''}; HIST.unshift(d); }
    d.tomas[id] = true;
    if(typeof trackerState === 'object') trackerState[id] = true;
    renderHoy();
  } catch(e){
    cb.checked = false; cb.disabled = false;
    alert('No se pudo guardar: ' + e.message);
  }
}

/* Un toque suma un vaso; volver a tocar el ultimo lo quita.
   Se manda SOLO el agua: guardarIngesta conserva lo que no se le envia,
   asi que esto no puede pisar la comida ya registrada. */
async function tocarVaso(n){
  const actual = Math.round(aguaHoyMl()/VASO_ML);
  const ml = Math.max(0, (n === actual ? n-1 : n) * VASO_ML);
  const host = document.getElementById('hoy-agua');
  if(host) host.style.opacity = '.5';
  try {
    await api({action:'guardarIngesta', fecha:hoyISO(), agua:ml});
    let d = ingestaDe(hoyISO());
    if(!d){ d = {fecha:hoyISO(), prot_animal:0, prot_vegetal:0, agua:0}; INGESTA.push(d); }
    d.agua = ml;
    renderHoy();
  } catch(e){
    if(host) host.style.opacity = '1';
    alert('No se pudo guardar el agua: ' + e.message);
  }
}

/* La linea de estado: las tres cosas que se mueven juntas, en una frase.
   Esta es la parte "holistica" — no cinco tarjetas de cinco secciones. */
function lineaEstado(){
  const last = DATA.length ? DATA[DATA.length-1] : null;
  if(!last) return 'Sin mediciones todavía.';
  const partes = [];

  const g = regresion('grasa', 6);
  if(g.valida && g.ratePerWeek < -0.05)      partes.push('grasa bajando');
  else if(g.valida && g.ratePerWeek > 0.05)  partes.push('grasa subiendo');
  else                                       partes.push('grasa estable');

  const v = variacionMagra();
  partes.push(v ? ('masa magra ' + (v.estable ? 'estable' : 'bajando rápido'))
                : 'masa magra sin lectura');

  const margen = +(mlgDe(last) - sueloMlg()).toFixed(1);
  if(margen <= 0) partes.push('por debajo del suelo de ' + sueloMlg() + ' kg');

  return partes.join(' · ');
}

/* switchPlanTab necesita el boton que se pulso, asi que se busca en el
   DOM. Y va en un frame aparte: la seccion tiene que estar visible antes
   de que se le cambie la pestaña. */
function irAIngesta(){
  gotoSection('planes');
  requestAnimationFrame(() => {
    const btn = document.querySelector('#plan-tab-nav .tab-btn[onclick*="ingesta"]');
    if(btn) switchPlanTab('ingesta', btn);
  });
}

function fechaLarga(){
  const D = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const M = ['enero','febrero','marzo','abril','mayo','junio','julio',
             'agosto','septiembre','octubre','noviembre','diciembre'];
  const f = new Date();
  return `${D[f.getDay()]} ${f.getDate()} de ${M[f.getMonth()]}`;
}

function renderHoy(){
  const host = document.getElementById('hoy-host');
  if(!host) return;

  const par = bloqueAhora(), actual = par.actual, siguiente = par.siguiente;
  const sups = supsDeBloque(actual);
  const tomas = tomasDeHoy();

  const listaSups = sups.map(s => {
    const hecho = tomas[s.id] === true;
    return `<label class="${hecho ? 'hecho' : ''}">
      <input type="checkbox" ${hecho ? 'checked' : ''}
        onchange="tocarSup('${esc(s.id)}',this)">
      <span><strong>${esc(s.sustancia || s.id)}</strong>
        ${s.dosis ? `<em>${esc(s.dosis)}</em>` : ''}</span></label>`;
  }).join('');

  const bloque = actual
    ? `<div class="hoy-card">
         <div class="hoy-hdr">
           <span>${esc(actual.icon || '')} ${esc(actual.label || actual.id)} ·
             ${esc(actual.desde)}–${esc(actual.hasta || '')}</span>
           <span class="hoy-chip">ahora</span>
         </div>
         ${sups.length ? `<div class="hoy-sups">${listaSups}</div>`
                       : '<div class="hoy-sub">Nada asignado a este bloque.</div>'}
         ${siguiente ? `<div class="hoy-sub">Después: ${esc(siguiente.label || siguiente.id)}
             a las ${esc(siguiente.desde)}</div>` : ''}
       </div>`
    : `<div class="hoy-card">
         <div class="hoy-hdr"><span>💊 Suplementos</span></div>
         <div class="hoy-sub">Ahora no toca ningún bloque.${siguiente
           ? ` El siguiente es <strong>${esc(siguiente.label || siguiente.id)}</strong>
               a las ${esc(siguiente.desde)}.` : ''}</div>
       </div>`;

  const vasos = Math.round(aguaHoyMl()/VASO_ML);
  const agua = `
    <div class="hoy-card">
      <div class="hoy-hdr"><span>💧 Agua</span>
        <span class="hoy-sub">${vasos} de ${VASOS_DIA} vasos</span></div>
      <div class="hoy-vasos" id="hoy-agua">${
        Array.from({length:VASOS_DIA}, (_,i) => i+1).map(n =>
          `<button class="vaso${n <= vasos ? ' lleno' : ''}" onclick="tocarVaso(${n})"
             aria-label="Vaso ${n}"></button>`).join('')}</div>
    </div>`;

  const p = protHoyG(), o = protObjetivo();
  const pct = Math.max(0, Math.min(100, Math.round(p/o.min*100)));
  const prot = `
    <div class="hoy-card">
      <div class="hoy-hdr"><span>🍗 Proteína</span>
        <span class="hoy-sub">${p} g de ${o.min}–${o.max}</span></div>
      <div class="hoy-barra"><div class="hoy-barra-fill${p >= o.min ? ' ok' : ''}"
        style="width:${pct}%"></div></div>
      <button class="blk-btn" style="width:100%;margin-top:10px"
        onclick="irAIngesta()">Registrar comida</button>
    </div>`;

  host.innerHTML = `
    <div class="hoy">
      <div class="hoy-top">
        <div class="hoy-top-fila"><span class="hoy-titulo">Hoy</span>
          <span class="hoy-fecha">${fechaLarga()}</span></div>
        <div class="hoy-estado">${lineaEstado()}</div>
      </div>
      ${bloque}${agua}${tarjetaMovimiento()}${prot}${tarjetaTirze()}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   EJERCICIO
   ---------------------------------------------------------------
   El objetivo nuevo (suelo de 47 kg de masa magra) depende entero de
   dos cosas que la app no veia: fuerza y proteina. Esto es la mitad.

   TRES DECISIONES DE DISEÑO, TODAS DELIBERADAS

   1. Se registra la CONDUCTA, no el resultado. Inmediata y suya.
   2. El contador es "N de los ultimos 14 dias", no una racha. Baja y
      sube, pero NUNCA se rompe: un dia perdido cuesta un punto, no el
      trabajo de dos semanas. Las rachas que se resetean a cero son de
      lo que mejor predice que alguien abandona.
   3. La opcion "suelo" —5 minutos de rebounder— cuenta como dia
      activo. Un dia malo con cinco minutos mantiene el habito; con
      cero lo mata. Es lo mas importante de esta seccion y parece lo
      menos.

   Y el cardio NO es la opcion menor: es el entrenamiento para el
   paddle. Matiz suyo, y mejor motivacion que "gasto calorico".
   ═══════════════════════════════════════════════════════════════ */
const VENTANA_HABITO   = 14;   // dias del contador que nunca se rompe
const SUELO_FUERZA_SEM = 2;    // sesiones de fuerza por semana
const SUELO_DIAS_SEM   = 4;    // dias con algo de movimiento
const SEG_INICIAL      = 30;   // segundos por posicion al empezar
const SEG_META         = 60;   // cuando se aguanten 45 comodas, subir

/* Tres sesiones que rotan. En un ciclo completo queda cubierto empuje,
   traccion, piernas, core anterior, lateral y posterior, y tobillo.
   Las instrucciones van en pantalla porque es donde hacen falta. */
const SESIONES = [
  {id:'A', nombre:'Empuje y core', ejercicios:[
    {n:'Sentadilla en la pared',
     c:'Espalda apoyada en la pared, pies separados y algo adelantados. Baja hasta donde aguantes sin dolor y sostén ahí. Cuanto más bajes, más duro.'},
    {n:'Empuje isométrico',
     c:'De pie frente a la pared o la encimera, manos a la altura del pecho. Empuja como si quisieras moverla y mantén la fuerza constante.'},
    {n:'Plancha en antebrazos',
     c:'Antebrazos y rodillas en el suelo, cuerpo en línea recta de la cabeza a las rodillas. Abdomen firme; la cadera ni sube ni se cae.'},
    {n:'Puente de glúteos',
     c:'Boca arriba, rodillas dobladas, pies apoyados. Sube la cadera hasta alinear rodillas, cadera y hombros. Aprieta los glúteos y sostén.'}]},

  {id:'B', nombre:'Tracción y espalda', ejercicios:[
    {n:'Remo con toalla',
     c:'Toalla enrollada, un extremo en cada mano, brazos al frente. Tira hacia fuera con las dos manos a la vez, como si quisieras romperla. Codos cerca del cuerpo.'},
    {n:'Superman',
     c:'Boca abajo, brazos estirados al frente. Despega a la vez pecho, brazos y piernas unos centímetros. Mirada al suelo, cuello relajado.'},
    {n:'Bisagra de cadera',
     c:'De pie, rodillas algo dobladas. Lleva la cadera atrás y baja el tronco con la espalda recta hasta notar la parte de atrás del muslo. Sostén ahí.'},
    {n:'Plancha lateral',
     c:'De lado, antebrazo y rodilla de abajo en el suelo. Sube la cadera hasta alinear el cuerpo. Mitad del tiempo por cada lado.'}]},

  {id:'C', nombre:'Piernas y tobillo', ejercicios:[
    {n:'Zancada sostenida',
     c:'Un pie adelante y otro atrás. Baja la rodilla de atrás sin llegar al suelo y sostén. Mitad del tiempo por pierna.'},
    {n:'Elevación de talones',
     c:'De pie, sube de puntillas todo lo que puedas y sostén arriba. Si pierdes el equilibrio, apoya un dedo en la pared.'},
    {n:'Media sentadilla',
     c:'Sin pared. Pies al ancho de las caderas, baja a media altura con el peso en los talones y sostén.'},
    {n:'Plancha con apoyo',
     c:'Plancha en antebrazos con rodillas apoyadas. Levanta un brazo unos segundos y cambia. El reto es que la cadera no rote.'}]}
];

const CARDIO = [
  {n:'Elíptica',   min:20, c:'Ritmo al que puedas hablar con frases cortas.'},
  {n:'Bicicleta',  min:20, c:'Ritmo al que puedas hablar con frases cortas.'},
  {n:'Rebounder',  min:15, c:'Rebote suave, sin despegar los pies del todo.'}
];

const AVISO_RESPIRAR =
  'Respira durante el aguante. Aguantar la respiración sube mucho la presión, ' +
  'y con la quetiapina eso no interesa. Si algo duele — no molesta, duele — se para.';

/* ── Lectura ─────────────────────────────────────────────────── */
function diasDesde(iso){
  const a = iso.split('-'), h = hoyISO().split('-');
  return Math.round((Date.UTC(+h[0], +h[1]-1, +h[2]) -
                     Date.UTC(+a[0], +a[1]-1, +a[2])) / 86400000);
}

function sesionesRecientes(dias){
  return (EJER || []).filter(e => {
    const d = diasDesde(e.fecha);
    return d >= 0 && d < dias;
  });
}

/* El contador que no se rompe: dias distintos con algo de movimiento. */
function habito(){
  const r = sesionesRecientes(VENTANA_HABITO);
  const dias = new Set(r.map(e => e.fecha));
  const fuerza = r.filter(e => e.tipo === 'fuerza').length;
  return {dias: dias.size, ventana: VENTANA_HABITO, fuerza,
          sesiones: r.length};
}

/* Cuantas de fuerza en los ultimos 28 dias: la misma ventana que la
   masa magra, a proposito. Es lo que cierra el circulo. */
function fuerza28(){
  return sesionesRecientes(28).filter(e => e.tipo === 'fuerza').length;
}

function hechoHoy(){
  return (EJER || []).filter(e => e.fecha === hoyISO());
}

/* Rota A → B → C → A segun la ultima sesion de fuerza registrada. */
function proximaSesion(){
  const f = (EJER || []).filter(e => e.tipo === 'fuerza');
  if(!f.length) return SESIONES[0];
  const ult = f[f.length-1].actividad || '';
  const i = SESIONES.findIndex(s => ult.indexOf('Sesión ' + s.id) === 0 ||
                                    ult.indexOf(s.id + ' ·') === 0);
  return SESIONES[i < 0 ? 0 : (i+1) % SESIONES.length];
}

/* El ancla: "despues de que". Engancharlo a algo que ya se hace es lo
   unico barato con evidencia decente para arrancar un habito, y ella
   ya tiene cinco anclas diarias funcionando — los bloques. */
function ultimaAncla(){
  const con = (EJER || []).filter(e => e.ancla);
  return con.length ? con[con.length-1].ancla : '';
}

/* ── Guardado ────────────────────────────────────────────────── */
async function guardarSesionEjercicio(tipo, actividad, minutos, ancla){
  await api({action:'ejercicio', fecha:hoyISO(), tipo, actividad,
             minutos, ancla: ancla || ''});
  if(!Array.isArray(EJER)) EJER = [];
  EJER.push({fecha:hoyISO(), tipo, actividad, minutos, ancla: ancla || '', nota:''});
  renderHoy();
}

async function hacerSuelo(){
  const b = document.getElementById('btn-suelo');
  if(b){ b.disabled = true; b.textContent = 'Guardando…'; }
  try { await guardarSesionEjercicio('suelo', 'Rebounder', 5, ultimaAncla()); }
  catch(e){
    if(b){ b.disabled = false; b.textContent = 'Suelo · 5 min'; }
    alert('No se pudo guardar: ' + e.message);
  }
}

/* ── La tarjeta de Hoy ───────────────────────────────────────── */
function tarjetaMovimiento(){
  const h = habito();
  const hoy = hechoHoy();
  const s = proximaSesion();

  if(hoy.length){
    const lista = hoy.map(e =>
      `<div class="mov-hecho">✓ ${esc(e.actividad || e.tipo)}${
        e.minutos ? ` · ${e.minutos} min` : ''}</div>`).join('');
    return `
      <div class="hoy-card">
        <div class="hoy-hdr"><span>🏃 Movimiento</span>
          <span class="hoy-sub">${h.dias} de los últimos ${h.ventana} días</span></div>
        ${lista}
        <button class="blk-btn" style="width:100%;margin-top:9px"
          onclick="abrirSesionFuerza()">Añadir otra</button>
      </div>`;
  }

  return `
    <div class="hoy-card">
      <div class="hoy-hdr"><span>🏃 Movimiento</span>
        <span class="hoy-sub">${h.dias} de los últimos ${h.ventana} días${
          h.fuerza ? ` · ${h.fuerza} de fuerza` : ''}</span></div>
      <div class="mov-ops">
        <button class="mov-op" onclick="abrirSesionFuerza()">
          <span class="mov-ico">💪</span>
          <span><strong>Fuerza · 12 min</strong>
            <em>Sesión ${s.id} — ${esc(s.nombre)} · protege tu masa magra</em></span>
        </button>
        <button class="mov-op" onclick="abrirCardio()">
          <span class="mov-ico">🚴</span>
          <span><strong>Cardio · 20 min</strong>
            <em>aguante para el paddle</em></span>
        </button>
        <button class="mov-op suelo" id="btn-suelo" onclick="hacerSuelo()">
          <span class="mov-ico">🔽</span>
          <span><strong>Suelo · 5 min</strong>
            <em>rebounder · cuenta como día activo</em></span>
        </button>
      </div>
    </div>`;
}

/* ── La sesión de fuerza, con las instrucciones en pantalla ──── */
function abrirSesionFuerza(sid){
  const s = sid ? SESIONES.find(x => x.id === sid) : proximaSesion();
  const otras = SESIONES.filter(x => x.id !== s.id);

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>💪 Sesión ${s.id} — ${esc(s.nombre)}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="fz-msg" class="form-msg info">
          <strong>${SEG_INICIAL} segundos por posición, dos rondas.</strong>
          Cuando aguantes 45 s cómoda, sube a ${SEG_META} o busca una versión más dura.
        </div>

        <ol class="fz-lista">${s.ejercicios.map(e => `
          <li><strong>${esc(e.n)}</strong><span>${esc(e.c)}</span></li>`).join('')}
        </ol>

        <div class="fz-aviso">${AVISO_RESPIRAR}</div>

        <div class="form-campo" style="max-width:200px">
          <label for="fz-ancla">Después de qué <span class="op">opcional</span></label>
          <input id="fz-ancla" placeholder="del bloque de la comida…"
            value="${esc(ultimaAncla())}">
        </div>
        <div class="fz-otras">¿Prefieres otra? ${otras.map(o =>
          `<button class="link-btn" onclick="abrirSesionFuerza('${o.id}')">${o.id} · ${esc(o.nombre)}</button>`
        ).join(' · ')}</div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Ahora no</button>
        <button class="blk-btn primary" id="fz-hecho"
          onclick="terminarFuerza('${s.id}','${esc(s.nombre)}')">Hecho</button>
      </div>
    </div>
  </div>`;
}

async function terminarFuerza(id, nombre){
  const btn = document.getElementById('fz-hecho');
  const msg = document.getElementById('fz-msg');
  const ancla = (document.getElementById('fz-ancla') || {}).value || '';
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await guardarSesionEjercicio('fuerza', `Sesión ${id} — ${nombre}`, 12, ancla.trim());
    msg.className = 'form-msg ok';
    msg.innerHTML = '✓ Guardada. <strong>Esto es lo que defiende tu masa magra.</strong>';
    btn.textContent = '✓ Hecho';
    setTimeout(cerrarForm, 1100);
  } catch(e){
    msg.className = 'form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Hecho';
  }
}

/* ── Cardio ──────────────────────────────────────────────────── */
function abrirCardio(){
  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>🚴 Cardio</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="cd-msg" class="form-msg info">
          Esto es lo que te va a dejar jugar un partido de paddle entero sin morirte.
        </div>
        <div class="mov-ops">${CARDIO.map(c => `
          <button class="mov-op" onclick="terminarCardio('${esc(c.n)}',${c.min})">
            <span><strong>${esc(c.n)} · ${c.min} min</strong><em>${esc(c.c)}</em></span>
          </button>`).join('')}
        </div>
        <div class="form-campo" style="max-width:200px;margin-top:10px">
          <label for="cd-ancla">Después de qué <span class="op">opcional</span></label>
          <input id="cd-ancla" value="${esc(ultimaAncla())}">
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Ahora no</button>
      </div>
    </div>
  </div>`;
}

async function terminarCardio(nombre, min){
  const msg = document.getElementById('cd-msg');
  const ancla = (document.getElementById('cd-ancla') || {}).value || '';
  try {
    await guardarSesionEjercicio('cardio', nombre, min, ancla.trim());
    msg.className = 'form-msg ok';
    msg.textContent = `✓ ${nombre}, ${min} min. Guardado.`;
    setTimeout(cerrarForm, 900);
  } catch(e){
    msg.className = 'form-msg err'; msg.textContent = e.message;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TIRZEPATIDA
   ---------------------------------------------------------------
   El efecto de la inyeccion no es plano: el apetito se suprime mas
   los primeros dias y afloja hacia el final. Por eso la ingesta se
   mira por DIA DEL CICLO, no por dia de la semana — comparar lunes
   con lunes mezcla dias del ciclo distintos.

   La zona rota para no pinchar siempre en el mismo sitio, y `dosis`
   permite ver el escalado contra el ritmo de perdida de grasa.
   ═══════════════════════════════════════════════════════════════ */
const CICLO_DIAS = 7;
const ZONAS = ['Abdomen izq.', 'Abdomen der.', 'Muslo izq.', 'Muslo der.'];
const DOSIS = [2.5, 5, 7.5, 10, 12.5, 15];

/* Ingesta muy por debajo del objetivo, varios dias seguidos, mas bypass
   es el patron de riesgo de deficit de tiamina: se agota en semanas, no
   en años. Este umbral no es diagnostico, es para que se hable en
   consulta antes de que sea un problema. */
const DIAS_INGESTA_BAJA = 3;
const UMBRAL_PROT_BAJA  = 0.5;   // fraccion del objetivo minimo

function ultimaInyeccion(){
  return (TIRZE || []).length ? TIRZE[TIRZE.length-1] : null;
}

/* Dia del ciclo: 1 el dia de la inyeccion. null si no hay ninguna. */
function diaDelCiclo(iso){
  const u = ultimaInyeccion();
  if(!u) return null;
  const d = diasDesde2(u.fecha, iso || hoyISO());
  return d < 0 ? null : d + 1;
}

function diasDesde2(isoA, isoB){
  const a = isoA.split('-'), b = isoB.split('-');
  return Math.round((Date.UTC(+b[0], +b[1]-1, +b[2]) -
                     Date.UTC(+a[0], +a[1]-1, +a[2])) / 86400000);
}

/* Cuando toca la siguiente, y si va con retraso. */
function proximaInyeccion(){
  const u = ultimaInyeccion();
  if(!u) return null;
  const transcurridos = diasDesde2(u.fecha, hoyISO());
  const faltan = CICLO_DIAS - transcurridos;
  const p = u.fecha.split('-');
  const f = new Date(Date.UTC(+p[0], +p[1]-1, +p[2] + CICLO_DIAS));
  const D = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  return {faltan, dia: D[f.getUTCDay()], hoy: faltan === 0,
          tarde: faltan < 0, transcurridos};
}

function zonaSugerida(){
  const u = ultimaInyeccion();
  if(!u || !u.zona) return ZONAS[0];
  const i = ZONAS.indexOf(u.zona);
  return ZONAS[i < 0 ? 0 : (i+1) % ZONAS.length];
}

function dosisActual(){
  const u = ultimaInyeccion();
  return u && u.dosis ? u.dosis : null;
}

/* ── La tarjeta de Hoy ───────────────────────────────────────── */
function tarjetaTirze(){
  const u = ultimaInyeccion();

  if(!u){
    return `
      <div class="hoy-card">
        <div class="hoy-hdr"><span>💉 Tirzepatida</span></div>
        <div class="hoy-sub">Sin registrar todavía. Con la primera inyección la app
          empieza a contar el ciclo y a ordenar tu comida por día del ciclo.</div>
        <button class="blk-btn" style="width:100%;margin-top:9px"
          onclick="abrirInyeccion()">Registrar inyección</button>
      </div>`;
  }

  const p = proximaInyeccion();
  const ciclo = diaDelCiclo();

  if(p.hoy || p.tarde){
    return `
      <div class="hoy-card" style="border-color:#f0b429">
        <div class="hoy-hdr"><span>💉 Tirzepatida</span>
          <span class="hoy-chip">${p.tarde ? Math.abs(p.faltan) + ' días tarde' : 'hoy'}</span></div>
        <div class="hoy-sub">${dosisActual() ? dosisActual() + ' mg · ' : ''}toca en
          <strong>${esc(zonaSugerida())}</strong></div>
        <button class="blk-btn primary" style="width:100%;margin-top:9px"
          onclick="abrirInyeccion()">Registrar inyección</button>
      </div>`;
  }

  return `
    <div class="hoy-card">
      <div class="hoy-hdr"><span>💉 Tirzepatida</span>
        <span class="hoy-sub">día ${ciclo} del ciclo</span></div>
      <div class="hoy-sub">${dosisActual() ? dosisActual() + ' mg · ' : ''}la siguiente,
        el <strong>${esc(p.dia)}</strong>${p.faltan === 1 ? ' (mañana)' : ` (en ${p.faltan} días)`}.</div>
    </div>`;
}

/* ── El formulario ───────────────────────────────────────────── */
function abrirInyeccion(){
  const zona = zonaSugerida();
  const dosis = dosisActual();

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>💉 Inyección</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="ty-msg" class="form-msg info">
          La zona propuesta es la siguiente de la rotación. Cámbiala si pinchaste en otra.
        </div>
        <div class="form-campo" style="max-width:190px">
          <label for="ty-fecha">Fecha</label>
          <input type="date" id="ty-fecha" value="${hoyISO()}" max="${hoyISO()}">
        </div>
        <div class="form-campo">
          <label for="ty-dosis">Dosis <span class="op">mg</span></label>
          <select id="ty-dosis">
            ${DOSIS.map(d => `<option value="${d}"${d === dosis ? ' selected' : ''}>${d} mg</option>`).join('')}
          </select>
        </div>
        <div class="form-campo">
          <label for="ty-zona">Zona</label>
          <select id="ty-zona">
            ${ZONAS.map(z => `<option${z === zona ? ' selected' : ''}>${z}</option>`).join('')}
          </select>
        </div>
        <div class="form-campo">
          <label for="ty-efectos">Cómo cayó <span class="op">opcional</span></label>
          <input id="ty-efectos" placeholder="náusea, sin apetito, bien…">
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="ty-guardar" onclick="guardarInyeccionForm()">Guardar</button>
      </div>
    </div>
  </div>`;
}

async function guardarInyeccionForm(){
  const msg = document.getElementById('ty-msg');
  const btn = document.getElementById('ty-guardar');
  const val = id => (document.getElementById(id) || {}).value || '';
  const datos = {action:'inyeccion', fecha: val('ty-fecha'), dosis: val('ty-dosis'),
                 zona: val('ty-zona'), efectos: val('ty-efectos').trim()};

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api(datos);
    if(!Array.isArray(TIRZE)) TIRZE = [];
    const i = TIRZE.findIndex(x => x.fecha === r.fecha);
    const fila = {fecha:r.fecha, dosis:Number(datos.dosis), zona:datos.zona,
                  efectos:datos.efectos, nota:''};
    if(i >= 0) TIRZE[i] = fila; else TIRZE.push(fila);
    TIRZE.sort((a,b) => a.fecha.localeCompare(b.fecha));

    msg.className = 'form-msg ok';
    msg.textContent = `✓ ${r.actualizado ? 'Corregida' : 'Guardada'}. Día 1 del ciclo.`;
    btn.textContent = '✓ Guardada';
    renderHoy();
    setTimeout(cerrarForm, 1000);
  } catch(e){
    msg.className = 'form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

/* ── La ingesta por día del ciclo ────────────────────────────── */
/* Comparar lunes con lunes mezcla dias del ciclo distintos. Esto
   promedia por dia del ciclo, que es donde se ve el patron real. */
function ingestaPorCiclo(){
  if(!(TIRZE || []).length || !(INGESTA || []).length) return null;
  const acum = {};
  INGESTA.forEach(d => {
    // la inyeccion vigente para ese dia es la ultima anterior o igual
    let ref = null;
    for(const t of TIRZE){ if(t.fecha <= d.fecha) ref = t; else break; }
    if(!ref) return;
    const dia = diasDesde2(ref.fecha, d.fecha) + 1;
    if(dia < 1 || dia > CICLO_DIAS) return;
    const prot = (d.prot_animal || 0) + (d.prot_vegetal || 0);
    if(!acum[dia]) acum[dia] = {dias:0, prot:0, kcal:0};
    acum[dia].dias++; acum[dia].prot += prot; acum[dia].kcal += (d.kcal || 0);
  });
  const out = [];
  for(let i = 1; i <= CICLO_DIAS; i++){
    const a = acum[i];
    out.push({dia:i, n: a ? a.dias : 0,
              prot: a ? Math.round(a.prot/a.dias) : null,
              kcal: a ? Math.round(a.kcal/a.dias) : null});
  }
  return out;
}

/* Aviso de ingesta baja sostenida. No es diagnostico: es para que se
   hable en consulta antes de que sea un problema. */
function avisoIngestaBaja(){
  if(!(INGESTA || []).length) return null;
  const o = protObjetivo();
  const umbral = o.min * UMBRAL_PROT_BAJA;
  const orden = INGESTA.slice().sort((a,b) => b.fecha.localeCompare(a.fecha));
  let seguidos = 0;
  for(const d of orden){
    const prot = (d.prot_animal || 0) + (d.prot_vegetal || 0);
    if(prot > 0 && prot < umbral) seguidos++;
    else break;
  }
  if(seguidos < DIAS_INGESTA_BAJA) return null;
  return `${seguidos} días seguidos por debajo de ${Math.round(umbral)} g de proteína. ` +
         `Con el bypass, la ingesta muy baja sostenida es el patrón de riesgo de ` +
         `déficit de tiamina, que se agota en semanas y no en años. Merece mencionarlo ` +
         `en consulta.`;
}

/* ═══════════════════════════════════════════════════════════════
   LA SECCIÓN DE EJERCICIO
   ---------------------------------------------------------------
   La tarjeta de Hoy sirve para hacer; esto sirve para mirar. Aqui va
   el suelo semanal, el historial y si se esta cumpliendo.

   El suelo se pinta en tramos, igual que el de masa magra: no se
   avanza hacia un minimo, se guarda distancia. Y NO hay rojo por una
   semana floja — a lo sumo ambar. Esa es la regla desde el principio:
   nada en la app puede hacerla sentir que fallo.
   ═══════════════════════════════════════════════════════════════ */

/* Lunes como primer dia: la semana de entrenamiento empieza el lunes,
   no el domingo, aunque getDay() diga otra cosa. */
function lunesDe(iso){
  const p = iso.split('-');
  const d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2]));
  const dow = (d.getUTCDay() + 6) % 7;          // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function semanas(n){
  const out = [];
  const p = lunesDe(hoyISO()).split('-');
  for(let i = n-1; i >= 0; i--){
    const d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2] - i*7));
    const ini = d.toISOString().slice(0, 10);
    const fin = new Date(Date.UTC(+p[0], +p[1]-1, +p[2] - i*7 + 6)).toISOString().slice(0, 10);
    const s = (EJER || []).filter(e => e.fecha >= ini && e.fecha <= fin);
    out.push({ini, fin, actual: i === 0,
              dias: new Set(s.map(e => e.fecha)).size,
              fuerza: s.filter(e => e.tipo === 'fuerza').length,
              minutos: s.reduce((t, e) => t + (e.minutos || 0), 0)});
  }
  return out;
}

function tarjetaSuelo(){
  const s = semanas(1)[0];
  const okF = s.fuerza >= SUELO_FUERZA_SEM;
  const okD = s.dias   >= SUELO_DIAS_SEM;
  const chip = (hecho, meta) => hecho >= meta ? 'bien' : (hecho >= meta-1 ? 'ojo' : 'ojo');

  return `
  <div class="pc-grid">
    <div class="pc-card">
      <div class="pc-label">Fuerza esta semana <span class="pc-sub">· suelo ${SUELO_FUERZA_SEM}</span></div>
      <div class="pc-fila">
        <span class="pc-num">${s.fuerza}</span><span class="pc-uni">de ${SUELO_FUERZA_SEM}</span>
        <span class="pc-chip ${chip(s.fuerza, SUELO_FUERZA_SEM)}">${
          okF ? 'suelo cumplido' : (SUELO_FUERZA_SEM - s.fuerza) + ' más'}</span>
      </div>
      <div class="pc-pie">Es lo único que defiende tus ${mlgDe(DATA[DATA.length-1] || {peso:0,grasa:0})} kg de masa magra.</div>
    </div>
    <div class="pc-card">
      <div class="pc-label">Días activos <span class="pc-sub">· suelo ${SUELO_DIAS_SEM}</span></div>
      <div class="pc-fila">
        <span class="pc-num">${s.dias}</span><span class="pc-uni">de ${SUELO_DIAS_SEM}</span>
        <span class="pc-chip ${chip(s.dias, SUELO_DIAS_SEM)}">${
          okD ? 'suelo cumplido' : (SUELO_DIAS_SEM - s.dias) + ' más'}</span>
      </div>
      <div class="pc-pie">Cinco minutos de rebounder cuentan igual que una sesión entera.</div>
    </div>
  </div>`;
}

function tablaSemanas(){
  const ss = semanas(8).slice().reverse();
  const filas = ss.map(s => {
    const okF = s.fuerza >= SUELO_FUERZA_SEM, okD = s.dias >= SUELO_DIAS_SEM;
    return `<tr${s.actual ? ' class="latest"' : ''}>
      <td>${esc(s.ini)}${s.actual ? ' ★' : ''}</td>
      <td class="${okF ? 'd-good' : ''}">${s.fuerza}</td>
      <td class="${okD ? 'd-good' : ''}">${s.dias}</td>
      <td>${s.minutos || '—'}</td>
      <td>${okF && okD ? '<span class="recomp-badge">suelo</span>' : ''}</td>
    </tr>`;
  }).join('');
  return `
    <div class="tbl-section">Las últimas ocho semanas</div>
    <div class="recomp-leyenda">Verde cuando la semana llega al suelo. Una semana floja
      no es un fallo: el objetivo es la tendencia, no la perfección.</div>
    <div class="table-scroll"><table>
      <thead><tr><th>Semana del</th><th>Fuerza</th><th>Días</th><th>Min</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table></div>`;
}

const ICONO_TIPO = {fuerza:'💪', cardio:'🚴', movilidad:'🧘', suelo:'🔽'};

function tablaSesiones(){
  if(!(EJER || []).length) return '';
  const ult = EJER.slice(-30).reverse();
  return `
    <div class="tbl-section">Sesiones</div>
    <div class="table-scroll"><table>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Qué</th><th>Min</th><th>Después de</th></tr></thead>
      <tbody>${ult.map(e => `<tr>
        <td>${esc(e.fecha)}</td>
        <td>${ICONO_TIPO[e.tipo] || ''} ${esc(e.tipo)}</td>
        <td>${esc(e.actividad || '')}</td>
        <td>${e.minutos || '—'}</td>
        <td>${esc(e.ancla || '')}</td></tr>`).join('')}
      </tbody></table></div>`;
}

function renderEjercicio(){
  const host = document.getElementById('ejercicio-host');
  if(!host) return;

  if(!(EJER || []).length){
    host.innerHTML = `
      <div class="proyeccion">Todavía no hay ninguna sesión registrada. El objetivo de
        masa magra —no bajar de ${sueloMlg()} kg— depende entero de esto y de la proteína.
        <br><br>El suelo son <strong>${SUELO_FUERZA_SEM} sesiones de fuerza</strong> y
        <strong>${SUELO_DIAS_SEM} días con movimiento</strong> por semana. Y cinco minutos
        de rebounder cuentan como día activo: los días malos existen.
        <button class="blk-btn primary" style="margin-top:10px" onclick="abrirSesionFuerza()">
          Empezar por la sesión A</button>
      </div>`;
    return;
  }

  const h = habito();
  host.innerHTML = `
    ${tarjetaSuelo()}
    <div class="pc-aviso" style="margin-top:12px">
      <strong>${h.dias} de los últimos ${h.ventana} días</strong> con movimiento ·
      ${fuerza28()} sesiones de fuerza en los últimos 28 días, que es la misma ventana
      con la que se lee tu masa magra.
    </div>
    ${tablaSemanas()}
    ${tablaSesiones()}`;
}

function initEjercicio(){
  renderEjercicio();
  const cv = document.getElementById('cEjer');
  if(!cv) return;
  const ss = semanas(8);
  if(chartReg.cEjer) chartReg.cEjer.destroy();
  chartReg.cEjer = new Chart(cv, {
    type:'bar',
    data:{labels: ss.map(s => s.ini.slice(5)), datasets:[
      {label:'Fuerza', data: ss.map(s => s.fuerza), backgroundColor:'#993556'},
      {label:'Días activos', data: ss.map(s => s.dias), backgroundColor:'#52b788'}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
      scales:{x:{grid:{color:GRID},ticks:{font:{size:9}}},
              y:{grid:{color:GRID},ticks:{font:{size:9},stepSize:1},beginAtZero:true}}}
  });
}
