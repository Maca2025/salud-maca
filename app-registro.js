/* ================================================================
   REGISTRO HISTÓRICO
   Cada entrada se resuelve por ID de suplemento. Un suplemento
   movido de bloque o reordenado sigue apuntando al mismo dato.
   Se aceptan dos formatos:
     v2 → {tomas:{supId:bool}, fechaISO, hora, ts}
     v1 → {sups:[{nombre,tomado}]}  (formato viejo, mapeado por nombre)
================================================================ */

// Mapa nombre→id para leer registros v1 y migraciones antiguas
const NOMBRE_A_ID = SUPS.reduce((o,s)=>{ o[s.sustancia.toLowerCase()] = s.id; return o; }, {});

/* Drive devuelve el contenido con escapes de markdown (p. ej. "inositol\_noche"),
   lo que rompe JSON.parse. Se limpian los backslashes que no sean escapes
   válidos de JSON antes de reintentar. */
function parseLog(txt){
  try { return JSON.parse(txt); } catch(e){}
  try { return JSON.parse(txt.replace(/\\(?!["\\\/bfnrtu])/g, '')); } catch(e){}
  console.warn('No se pudo interpretar un registro del historial.');
  return null;
}

function entryTomas(e){
  if(e && e.tomas && typeof e.tomas === 'object'){
    const t = Object.assign({}, e.tomas);
    delete t.nota;              // la nota es texto, no una toma
    return t;
  }
  const out = {};
  if(e && Array.isArray(e.sups)){
    e.sups.forEach(s=>{
      const id = NOMBRE_A_ID[String(s.nombre||'').toLowerCase()];
      if(id) out[id] = !!s.tomado;
    });
  }
  return out;
}

function entryFechaISO(e){
  if(e && e.fechaISO) return e.fechaISO;
  const d = String((e && e.fecha) || '').split(' ')[0];
  const p = d.split('/');
  return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}

/* Orden de suplementos en el historial = orden actual de los bloques.
   Devuelve [{id, sustancia, dosis, color}] */
function ordenSupsParaRegistro(){
  const out = [];
  BLOQUES.forEach(b=>{
    (LAYOUT[b.id]||[]).forEach(id=>{
      const s = supById(id);
      if(s) out.push({id:s.id, sustancia:s.sustancia, dosis:s.dosis, color:b.color});
    });
  });
  // Suplementos que ya no están en el protocolo pero sí en el historial
  return out;
}

function renderHistorial(entries) {
  const container = document.getElementById('reg-table-container');
  const filas = ordenSupsParaRegistro();

  // IDs presentes en el historial que ya no existen en SUPS → se muestran al final
  const conocidos = new Set(filas.map(f=>f.id));
  const huerfanos = new Set();
  entries.forEach(e=>{
    Object.keys(entryTomas(e)).forEach(id=>{
      if(!conocidos.has(id)) huerfanos.add(id);
    });
  });
  huerfanos.forEach(id=>{
    const et = entries.find(e=>e.etiquetas && e.etiquetas[id]);
    filas.push({id, sustancia:(et?et.etiquetas[id]:id), dosis:'', color:'#bbb', baja:true});
  });

  let t = '<table class="reg-table"><thead><tr><th style="text-align:left;min-width:140px">Suplemento</th>';
  entries.forEach(e => {
    const iso = entryFechaISO(e);
    const dm  = iso ? iso.slice(8,10)+'/'+iso.slice(5,7) : (e.fecha||'');
    const hr  = e.hora || (String(e.fecha||'').split(' ')[1] || '');
    t += `<th style="min-width:36px;max-width:48px;padding:4px 2px">
      <span style="display:block;font-size:.62rem">${dm}</span>
      <span style="display:block;font-size:.58rem;opacity:.75">${hr}</span></th>`;
  });
  t += '</tr></thead><tbody>';
  filas.forEach(f => {
    t += `<tr><td style="text-align:left;font-size:.78rem;font-weight:600;white-space:normal;line-height:1.3">
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${f.color};margin-right:6px"></span>
      ${esc(f.sustancia)}${f.baja?' <span style="font-size:.6rem;color:#bbb">(ya no se toma)</span>':''}</td>`;
    entries.forEach(e => {
      const v = entryTomas(e)[f.id];
      t += '<td>' + (v===true ? '✅' : v===false ? '—' : '<span style="color:#e5e5e5">·</span>') + '</td>';
    });
    t += '</tr>';
  });
  t += '</tbody></table>';
  container.innerHTML = t;
}

function renderAdherencia(entries) {
  const adh = document.getElementById('reg-adh-container');
  if(!entries.length){ adh.innerHTML='<p class="reg-status">Sin datos.</p>'; return; }

  // Un día cuenta una sola vez aunque tenga varios guardados
  const porDia = {};
  entries.forEach(e=>{
    const iso = entryFechaISO(e); if(!iso) return;
    if(!porDia[iso]) porDia[iso] = {};
    const tomas = entryTomas(e);
    Object.keys(tomas).forEach(id=>{ if(tomas[id]) porDia[iso][id] = true; });
  });
  const dias = Object.keys(porDia).sort();
  if(!dias.length){ adh.innerHTML='<p class="reg-status">Sin datos.</p>'; return; }

  const first = new Date(dias[0]+'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const transcurridos = Math.max(1, Math.round((today-first)/86400000)+1);
  const cobertura = Math.min(100, Math.round(dias.length/transcurridos*100));

  // Racha actual: días consecutivos con registro, contando hacia atrás desde hoy
  const setDias = new Set(dias);
  const isoDe = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  let racha = 0;
  const cursor = new Date(today);
  if(!setDias.has(isoDe(cursor))) cursor.setDate(cursor.getDate()-1);  // hoy aún puede estar pendiente
  while(setDias.has(isoDe(cursor))){ racha++; cursor.setDate(cursor.getDate()-1); }

  // Racha más larga
  let mejor = 0, corrida = 0, previa = null;
  dias.forEach(iso=>{
    const d = new Date(iso+'T00:00:00');
    corrida = (previa && (d-previa)===86400000) ? corrida+1 : 1;
    if(corrida>mejor) mejor = corrida;
    previa = d;
  });

  // % sobre los días efectivamente registrados
  const filas = ordenSupsParaRegistro().map(f=>{
    const count = dias.filter(d=>porDia[d][f.id]).length;
    return {...f, count};
  });

  const cabecera = `
    <div class="adh-resumen">
      <div class="adh-stat"><strong>${racha}</strong><span>racha actual (días)</span></div>
      <div class="adh-stat"><strong>${mejor}</strong><span>mejor racha</span></div>
      <div class="adh-stat"><strong>${dias.length}</strong><span>días registrados</span></div>
      <div class="adh-stat"><strong>${cobertura}%</strong><span>de ${transcurridos} días</span></div>
    </div>
    <div class="adh-nota">Los porcentajes se calculan sobre los <strong>${dias.length} días que registraste</strong>,
    no sobre los ${transcurridos} transcurridos. Así el % mide si tomaste el suplemento, no si abriste la app.</div>`;

  const sorted = [...filas].sort((a,b)=>a.count-b.count);
  let h = cabecera + '<div class="adh-list">';
  sorted.forEach(s => {
    const pct = Math.min(100, Math.round(s.count/dias.length*100));
    const color = pct>=80?'#2D6A4F':pct>=50?'#E67E22':'#C0392B';
    h += `<div class="adh-item">
      <div class="adh-slot-dot" style="background:${s.color}"></div>
      <span class="adh-name">${esc(s.sustancia)}</span>
      <span class="adh-frac">${s.count}/${dias.length}</span>
      <div class="adh-bar-wrap"><div class="adh-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="adh-pct" style="color:${color}">${pct}%</span>
    </div>`;
  });
  h += '</div>';
  adh.innerHTML = h;
}

/* ── Calendario mensual: alternativa a la tabla de columnas infinitas ── */
let _calMes = null;   // Date del primer día del mes mostrado

function renderCalendario(entries){
  const cont = document.getElementById('reg-cal-container');
  if(!cont) return;
  if(!entries || !entries.length){ cont.innerHTML='<p class="reg-status">Sin datos.</p>'; return; }

  const porDia = {}, notasPorDia = {};
  entries.forEach(e=>{
    const iso = entryFechaISO(e); if(!iso) return;
    if(!porDia[iso]) porDia[iso] = {};
    const t = entryTomas(e);
    Object.keys(t).forEach(id=>{ if(t[id]) porDia[iso][id]=true; });
    if(e.nota) notasPorDia[iso] = e.nota;
  });

  const totalSups = Math.max(1, ordenSupsParaRegistro().length);
  if(!_calMes){
    const ult = Object.keys(porDia).sort().pop();
    const d = ult ? new Date(ult+'T00:00:00') : new Date();
    _calMes = new Date(d.getFullYear(), d.getMonth(), 1);
  }

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const y = _calMes.getFullYear(), m = _calMes.getMonth();
  const primerDia = new Date(y, m, 1);
  const diasEnMes = new Date(y, m+1, 0).getDate();
  let offset = primerDia.getDay() - 1; if(offset < 0) offset = 6;   // semana inicia el lunes

  let html = `<div class="cal-nav">
      <button class="cal-btn" onclick="calMover(-1)">‹</button>
      <span class="cal-titulo">${MESES[m]} ${y}</span>
      <button class="cal-btn" onclick="calMover(1)">›</button>
    </div>
    <div class="cal-grid">` +
    ['L','M','X','J','V','S','D'].map(d=>`<div class="cal-dow">${d}</div>`).join('');

  for(let i=0;i<offset;i++) html += '<div class="cal-celda vacia"></div>';

  const hoy = hoyISO();
  for(let dia=1; dia<=diasEnMes; dia++){
    const iso = `${y}-${p2(m+1)}-${p2(dia)}`;
    const n = porDia[iso] ? Object.keys(porDia[iso]).length : 0;
    const pct = n/totalSups;
    let cls = 'cal-celda';
    if(!porDia[iso])      cls += ' sin-registro';
    else if(pct >= 0.8)   cls += ' nivel-alto';
    else if(pct >= 0.5)   cls += ' nivel-medio';
    else                  cls += ' nivel-bajo';
    if(iso === hoy) cls += ' es-hoy';
    if(iso > hoy)   cls += ' futuro';
    const tieneNota = notasPorDia[iso];
    const tip = (porDia[iso] ? `${n} de ${totalSups} tomas` : 'sin registro') +
                (tieneNota ? ' · con nota' : '');
    if(tieneNota) cls += ' con-nota';
    html += `<div class="${cls}" title="${iso} · ${tip}"
      ${iso<=hoy?`onclick="irARegistrarDia('${iso}')"`:''}>
      <span class="cal-num">${dia}</span>
      ${porDia[iso]?`<span class="cal-n">${n}</span>`:''}
    </div>`;
  }
  html += `</div>
    <div class="cal-leyenda">
      <span><i class="cal-mini nivel-alto"></i> ≥80%</span>
      <span><i class="cal-mini nivel-medio"></i> 50–79%</span>
      <span><i class="cal-mini nivel-bajo"></i> &lt;50%</span>
      <span><i class="cal-mini sin-registro"></i> sin registro</span>
      <span style="color:#888">Toca un día para completarlo</span>
    </div>`;
  cont.innerHTML = html;
}

function calMover(delta){
  if(!_calMes) return;
  _calMes = new Date(_calMes.getFullYear(), _calMes.getMonth()+delta, 1);
  renderCalendario(_regEntries || []);
}

/* Desde el calendario, saltar al tracker con ese día cargado */
function irARegistrarDia(iso){
  switchSupsTab('horario', document.querySelector('#sups-tab-nav .sups-tab-btn'));
  cambiarDia(iso);
}

async function cargarRegistro() {
  const container = document.getElementById('reg-table-container');
  const adh = document.getElementById('reg-adh-container');
  const status = document.getElementById('reg-status');
  if(container) container.innerHTML = '<p class="reg-status">⏳ Cargando…</p>';
  if(adh) adh.innerHTML = '<p class="reg-status">⏳ Cargando…</p>';
  if(status) status.textContent = '';
  try {
    const d = await api({action:'historial'});
    const entries = (d.historial || []).map(e => ({
      fechaISO: e.fecha, fecha: e.fecha, hora: e.hora, tomas: e.tomas, nota: e.nota || ''
    }));
    if(!entries.length){
      container.innerHTML = '<p class="reg-status">No hay días registrados aún.</p>';
      if(adh) adh.innerHTML = '<p class="reg-status">Sin datos todavía.</p>';
      return;
    }
    entries.sort((a,b)=>(b.fechaISO+' '+(b.hora||'')).localeCompare(a.fechaISO+' '+(a.hora||'')));
    _regEntries = entries;
    if(status) status.textContent = entries.length+' día(s)';
    renderHistorial(entries);
    renderAdherencia(entries);
    renderCalendario(entries);
  } catch(err){
    container.innerHTML = '<p class="reg-status">❌ '+err.message+'</p>';
    if(adh) adh.innerHTML = '<p class="reg-status">❌ '+err.message+'</p>';
    const cal = document.getElementById('reg-cal-container');
    if(cal) cal.innerHTML = '<p class="reg-status">❌ '+err.message+'</p>';
    console.error(err);
  }
}

function switchSupsTab(id, btn) {
  document.querySelectorAll('#section-suplementos .sups-tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sups-tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('stab-'+id).classList.add('active');
  btn.classList.add('active');
}
