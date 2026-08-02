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
  if(fechaActiva !== hoyISO()){ cont.innerHTML = ''; return; }

  const grupos = {ahora:[], pasado:[], proximo:[]};
  BLOQUES.forEach(b=>{
    const faltan = (LAYOUT[b.id]||[]).filter(id => !trackerState[id]);
    if(!faltan.length) return;
    const est = estadoBloque(b);
    if(grupos[est]) grupos[est].push({b, n:faltan.length});
  });

  const total = SUPS.length;
  const hechos = SUPS.filter(s=>trackerState[s.id]).length;

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
  html += '</div></div>';
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
    const done  = items.filter(s => trackerState[s.id]).length;
    const pct   = items.length ? Math.round(done / items.length * 100) : 0;
    const todosMarcados = items.length > 0 && done === items.length;
    const franja = (b.desde && b.hasta) ? `${b.desde}–${b.hasta}` : (b.desde || '');

    const est = estadoBloque(b);
    const incompleto = done < items.length;
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
      const chk = trackerState[s.id] ? 'checked' : '';
      const guardado = !!(yaRegistrado && yaRegistrado[s.id]);
      const cls = (trackerState[s.id] ? 'checked' : '') + (guardado ? ' ya-guardado' : '');
      const alertIco = s.nivel===2?'🔴':s.nivel===1?'🟡':'';
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
        <span class="sups-prog-txt" id="ptxt-${b.id}" style="color:${b.color}">${done}/${items.length}</span>
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
  const ids  = LAYOUT[b.id] || [];
  const done = ids.filter(x => trackerState[x]).length;
  const pct  = ids.length ? Math.round(done/ids.length*100) : 0;
  const bar = document.getElementById('pbar-'+b.id);
  const txt = document.getElementById('ptxt-'+b.id);
  if(bar) bar.style.width = pct+'%';
  if(txt) txt.textContent = done+'/'+ids.length;
  const slot = document.querySelector(`.sups-slot[data-blk-id="${b.id}"]`);
  if(slot) slot.classList.toggle('vencido', estadoBloque(b)==='pasado' && done < ids.length);
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
  const ids = LAYOUT[blkId] || [];
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
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarModalBloque()">
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
function cerrarModalBloque(){
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
   Usa la columna `precio` de la hoja. Si además hay `unidades`
   (piezas por envase) y `porDia`, calcula el costo mensual real;
   si no, informa solo el total de reposición.
   ──────────────────────────────────────────────────────────── */
function renderCostos(){
  const cont = document.getElementById('sups-costo');
  if(!cont) return;

  const conPrecio = SUPS.filter(s => Number(s.precio) > 0);
  if(!conPrecio.length){ cont.innerHTML = ''; return; }

  const totalEnvases = conPrecio.reduce((t,s) => t + Number(s.precio), 0);

  // Costo mensual sólo si la hoja trae unidades y dosis diaria
  let mensual = 0, conDatos = 0;
  conPrecio.forEach(s=>{
    const u  = Number(s.unidades), pd = Number(s.porDia);
    if(u > 0 && pd > 0){ mensual += (Number(s.precio)/u) * pd * 30; conDatos++; }
  });

  const fmt = n => '$' + Math.round(n).toLocaleString('es-MX');
  const caros = [...conPrecio].sort((a,b)=>Number(b.precio)-Number(a.precio)).slice(0,3);
  const sinPrecio = SUPS.length - conPrecio.length;

  cont.innerHTML = `
    <div class="costo-box">
      <div class="costo-head">💰 Costo del protocolo</div>
      <div class="costo-grid">
        <div class="costo-stat"><strong>${fmt(totalEnvases)}</strong><span>reponer todo</span></div>
        ${conDatos ? `<div class="costo-stat"><strong>${fmt(mensual)}</strong><span>al mes (${conDatos} de ${conPrecio.length})</span></div>` : ''}
        <div class="costo-stat"><strong>${conPrecio.length}</strong><span>con precio${sinPrecio?` · ${sinPrecio} sin`:''}</span></div>
      </div>
      <div class="costo-top">Los tres más caros:
        ${caros.map(s=>`<span class="costo-chip">${esc(s.sustancia)} ${fmt(Number(s.precio))}</span>`).join('')}
      </div>
      ${conDatos < conPrecio.length ? `<div class="costo-nota">
        Para estimar el gasto mensual completo, agrega en la hoja
        <em>Protocolo Suplementos</em> las columnas <code>unidades</code>
        (piezas por envase) y <code>porDia</code> (cuántas tomas al día).
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

