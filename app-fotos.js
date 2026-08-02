/* ════════════════════════════════════════════════════════════
   FOTOS DE PROGRESO
   ------------------------------------------------------------
   El modelo: una SESIÓN es un conjunto de fotos que comparten
   fecha, una por postura. No hay hoja de cálculo — el nombre del
   archivo en Drive (fecha + "__" + id de postura) es el dato. Por eso
   una sesión incompleta no rompe nada y añadir una postura nueva no
   obliga a migrar el histórico.

   La lista de posturas NO vive en este archivo: llega del Apps
   Script, que es privado. Este repositorio es público y no tiene por
   qué contar cómo se fotografía.

   La regla de oro: comparar SIEMPRE la misma postura entre fechas.
   Comparar de frente contra de perfil no informa de nada, así que la
   interfaz ni siquiera lo ofrece.

   Nunca se guardan en el navegador ni salen del Drive privado: se
   piden bajo demanda y se cachean solo en memoria.

   RENDIMIENTO — por qué hay dos cachés
   Con 7 posturas por sesión, pintar la galería con las imágenes
   completas serían decenas de peticiones de ~400 KB cada una:
   tarda minutos y agota la cuota del Apps Script. Las rejillas piden
   `fotoMini` (la miniatura que Drive ya tiene, ~10 KB) y solo el
   comparador y el visor grande piden la imagen completa.
   ════════════════════════════════════════════════════════════ */
let _fotos = [];                 // [{id, fecha, pose, orden, conocida}]
let POSTURAS = [];               // llega del Apps Script, no vive en este archivo
const _cacheFotos = new Map();   // id → dataURL completa (solo en memoria)
const _cacheMini  = new Map();   // id → dataURL miniatura (solo en memoria)
let _poseComparar = null;
let _poseLinea    = null;

async function initFotos(){
  const ctrl = document.getElementById('fotos-controles');
  ctrl.innerHTML = '<p class="reg-status">⏳ Cargando…</p>';
  try {
    const d = await api({action:'fotos'});
    _fotos   = d.fotos || [];
    POSTURAS = d.posturas || [];
    // El cliente puede ir por delante del backend: si el Apps Script
    // todavía es la versión vieja no manda `posturas`, y sin ellas
    // esta sección no puede agrupar nada. Mejor decirlo que
    // renderizar una pantalla vacía sin explicación.
    if(!POSTURAS.length){
      ctrl.innerHTML = `<div class="fotos-vacio">
        <div style="font-size:2.2rem">🔌</div>
        <p>El Apps Script todavía no envía la lista de posturas.</p>
        <p class="chico">Actualiza <strong>Codigo.gs</strong> a la versión nueva,
        publica una <strong>versión nueva</strong> de la implementación y vuelve a entrar aquí.</p>
      </div>`;
      document.getElementById('fotos-visor').innerHTML = '';
      return;
    }
    renderControlesFotos();
    renderLinea();
    renderGaleria();
    actualizarHomeFotos();
  } catch(e){
    ctrl.innerHTML = `<p class="reg-status">❌ ${esc(e.message)}</p>`;
  }
}

/* ── Consultas sobre el conjunto de fotos ────────────────── */
function nombrePose(id){
  const p = POSTURAS.find(x=>x.id===id);
  return p ? p.nombre : id;
}
function esPoseConocida(id){ return POSTURAS.some(x=>x.id===id); }
function fotosDePose(pose){
  return _fotos.filter(f=>f.pose===pose).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function fechasDePose(pose){ return fotosDePose(pose).map(f=>f.fecha); }
function fotoDe(fecha, pose){ return _fotos.find(f=>f.fecha===fecha && f.pose===pose) || null; }
function sinClasificar(){ return _fotos.filter(f=>!esPoseConocida(f.pose)); }

/* Sesiones de más reciente a más antigua, con qué posturas faltan. */
function sesiones(){
  const m = {};
  _fotos.forEach(f=>{ (m[f.fecha] = m[f.fecha] || []).push(f); });
  return Object.keys(m).sort().reverse().map(fecha=>{
    const porPose = {};
    m[fecha].forEach(f=>{ if(esPoseConocida(f.pose)) porPose[f.pose] = f; });
    const hechas = POSTURAS.filter(p=>porPose[p.id]).length;
    return {fecha, porPose, hechas, total: POSTURAS.length,
            faltan: POSTURAS.filter(p=>!porPose[p.id]).map(p=>p.id)};
  });
}

/* Por defecto se abre la postura con más sesiones: es la que más
   probablemente tenga con qué comparar. */
function posePorDefecto(){
  if(!POSTURAS.length) return null;
  let mejor = POSTURAS[0].id, n = -1;
  POSTURAS.forEach(p=>{
    const c = fotosDePose(p.id).length;
    if(c > n){ n = c; mejor = p.id; }
  });
  return mejor;
}

/* ── Carga de imágenes ───────────────────────────────────── */
async function cargarFoto(id){
  if(_cacheFotos.has(id)) return _cacheFotos.get(id);
  const d = await api({action:'foto', id});
  const url = `data:${d.mimeType};base64,${d.datos}`;
  _cacheFotos.set(id, url);
  return url;
}
async function cargarMini(id){
  if(_cacheMini.has(id))  return _cacheMini.get(id);
  if(_cacheFotos.has(id)) return _cacheFotos.get(id);   // ya está la grande, no pidas otra
  const d = await api({action:'fotoMini', id});
  const url = `data:${d.mimeType};base64,${d.datos}`;
  _cacheMini.set(id, url);
  return url;
}

/* Pinta todas las miniaturas de un contenedor.
   De tres en tres: en serie tarda demasiado con 60 fotos, y todas a
   la vez el Apps Script empieza a devolver errores de cuota. */
async function pintarMinis(root){
  if(!root) return;
  const pendientes = [...root.querySelectorAll('[data-mini-id]')];
  let i = 0;
  async function trabajador(){
    while(i < pendientes.length){
      const el = pendientes[i++];
      const id = el.dataset.miniId;
      try {
        const url = await cargarMini(id);
        if(!el.isConnected) continue;
        el.style.backgroundImage = `url("${url}")`;
        el.classList.add('cargada');
      } catch(e){
        if(el.isConnected) el.textContent = '⚠';
      }
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador()]);
}

/* ── Contexto de composición corporal ────────────────────── */
/* Medición más cercana a una fecha, si cae dentro de tres semanas. */
function medicionCerca(iso){
  if(!DATA.length) return null;
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const objetivo = new Date(iso+'T00:00:00');
  let mejor = null, dif = Infinity;
  DATA.forEach(m=>{
    const p = String(m.fecha).split('-');
    if(p.length!==2) return;
    const mes = MESES.indexOf(p[1]);
    if(mes<0) return;
    const d = new Date(objetivo.getFullYear(), mes, parseInt(p[0],10));
    const dd = Math.abs(d-objetivo);
    if(dd < dif){ dif = dd; mejor = m; }
  });
  return (dif < 21*86400000) ? mejor : null;
}
function pieFoto(iso){
  const m = medicionCerca(iso);
  if(!m) return `<div class="foto-pie">${esc(iso)}</div>`;
  return `<div class="foto-pie">${esc(iso)}
    <span>${m.peso} kg · ${m.grasa} kg grasa · ${m.smm} kg músculo</span></div>`;
}

/* ── Tarjeta del home ────────────────────────────────────── */
function actualizarHomeFotos(){
  const sub = document.getElementById('hc-fotos-sub');
  const met = document.getElementById('hc-fotos-metrics');
  if(!sub || !met) return;
  if(!_fotos.length){
    sub.textContent = 'Sin fotos todavía';
    met.innerHTML = `<div class="hc-metric"><span class="hc-dot" style="background:#d1d5db"></span>
      Sube tu primera sesión para empezar a comparar</div>`;
    return;
  }
  const ses = sesiones();
  const ultima = ses[0];
  const completas = ses.filter(s=>s.hechas===s.total).length;
  const comparables = POSTURAS.filter(p=>fotosDePose(p.id).length>=2).length;
  const huerfanas = sinClasificar().length;
  sub.textContent = `${ses.length} sesion${ses.length>1?'es':''} · ${_fotos.length} fotos`;
  met.innerHTML = `
    <div class="hc-metric"><span class="hc-dot" style="background:#8e44ad"></span>
      Última: ${esc(ultima.fecha)} · ${ultima.hechas}/${ultima.total} posturas</div>
    <div class="hc-metric"><span class="hc-dot" style="background:${comparables?'#2d6a4f':'#d1d5db'}"></span>
      ${comparables} de ${POSTURAS.length} posturas ya se pueden comparar</div>
    <div class="hc-metric"><span class="hc-dot" style="background:${huerfanas?'#f59e0b':'#2980b9'}"></span>
      ${huerfanas ? `${huerfanas} foto${huerfanas>1?'s':''} sin clasificar`
                  : `${completas} sesion${completas===1?'':'es'} completa${completas===1?'':'s'}`}</div>`;
}

/* ════════════════════════════════════════════════════════════
   PESTAÑA 1 — COMPARAR dos fechas de la misma postura
   ════════════════════════════════════════════════════════════ */
function opcionesPose(seleccionada, conCuenta){
  return POSTURAS.map(p=>{
    const n = fotosDePose(p.id).length;
    const etq = conCuenta
      ? `${p.nombre} · ${n===0?'sin fotos':n+(n===1?' sesión':' sesiones')}`
      : p.nombre;
    return `<option value="${esc(p.id)}" ${p.id===seleccionada?'selected':''}>${esc(etq)}</option>`;
  }).join('');
}

function renderControlesFotos(){
  const ctrl  = document.getElementById('fotos-controles');
  const visor = document.getElementById('fotos-visor');
  if(!_fotos.length){
    ctrl.innerHTML = `<div class="fotos-vacio">
      <div style="font-size:2.6rem">📸</div>
      <p>Todavía no hay fotos.</p>
      <p class="chico">Una sesión son ${POSTURAS.length} fotos, una por postura.
      Misma luz, misma ropa y misma distancia cada vez: es lo que hace que la
      comparación diga algo de verdad.</p>
      <button class="blk-btn primary" onclick="abrirSubirFotos()">Subir la primera sesión</button>
    </div>`;
    visor.innerHTML = '';
    return;
  }
  if(!_poseComparar || !esPoseConocida(_poseComparar)) _poseComparar = posePorDefecto();
  const fechas = fechasDePose(_poseComparar);
  const iB = fechas.length-1, iA = Math.max(0, fechas.length-2);
  ctrl.innerHTML = `
    <div class="fotos-ctrl">
      <div class="fc-campo fc-ancho">
        <label for="fc-pose">Postura</label>
        <select id="fc-pose" onchange="cambiarPoseComparar(this.value)">${opcionesPose(_poseComparar,true)}</select>
      </div>
      <div class="fc-campo">
        <label for="fc-a">Antes</label>
        <select id="fc-a" onchange="renderVisor()" ${fechas.length<2?'disabled':''}>
          ${fechas.map((f,i)=>`<option value="${f}" ${i===iA?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div class="fc-campo">
        <label for="fc-b">Después</label>
        <select id="fc-b" onchange="renderVisor()" ${fechas.length<2?'disabled':''}>
          ${fechas.map((f,i)=>`<option value="${f}" ${i===iB?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div class="fc-campo">
        <label for="fc-modo">Vista</label>
        <select id="fc-modo" onchange="renderVisor()">
          <option value="lado">Lado a lado</option>
          <option value="slider">Deslizador</option>
        </select>
      </div>
    </div>`;
  renderVisor();
}

function cambiarPoseComparar(pose){
  _poseComparar = pose;
  renderControlesFotos();   // las fechas disponibles cambian con la postura
}

async function renderVisor(){
  const visor = document.getElementById('fotos-visor');
  const pose  = _poseComparar;
  const lista = fotosDePose(pose);

  if(!lista.length){
    visor.innerHTML = `<div class="fotos-vacio">
      <p>Todavía no hay ninguna foto de <strong>${esc(nombrePose(pose))}</strong>.</p>
      <p class="chico">Súbela en tu próxima sesión y aquí vas a poder compararla.</p>
      <button class="blk-btn primary" onclick="abrirSubirFotos(null,'${esc(pose)}')">Subir esta postura</button>
    </div>`;
    return;
  }
  if(lista.length === 1){
    const f = lista[0];
    visor.innerHTML = '<p class="reg-status">⏳ Cargando…</p>';
    try {
      const url = await cargarFoto(f.id);
      visor.innerHTML = `
        <div class="cmp-lado" style="grid-template-columns:minmax(0,340px);justify-content:center">
          <figure><img src="${url}" alt="${esc(nombrePose(pose))}">${pieFoto(f.fecha)}</figure>
        </div>
        <div class="cmp-aviso">Solo hay una sesión con esta postura, así que todavía no
        hay nada que comparar. En cuanto subas la siguiente, aquí aparece el antes y después.</div>`;
    } catch(e){
      visor.innerHTML = `<p class="reg-status">❌ ${esc(e.message)}</p>`;
    }
    return;
  }

  const fa = document.getElementById('fc-a').value;
  const fb = document.getElementById('fc-b').value;
  const modo = document.getElementById('fc-modo').value;
  const A = fotoDe(fa, pose), B = fotoDe(fb, pose);
  if(!A || !B){ visor.innerHTML = '<p class="reg-status">Falta una de las dos fotos.</p>'; return; }

  if(fa === fb){
    visor.innerHTML = `<div class="cmp-aviso">Elegiste la misma fecha en los dos lados.
      Cambia una de las dos para ver el cambio.</div>`;
    return;
  }

  visor.innerHTML = '<p class="reg-status">⏳ Cargando fotos…</p>';
  try {
    const [ua, ub] = await Promise.all([cargarFoto(A.id), cargarFoto(B.id)]);
    // Qué dice la báscula entre esas dos fechas
    const ma = medicionCerca(fa), mb = medicionCerca(fb);
    let resumen = '';
    if(ma && mb && ma !== mb){
      const dG = +(mb.grasa-ma.grasa).toFixed(1);
      const dS = +(mb.smm-ma.smm).toFixed(1);
      const dP = +(mb.peso-ma.peso).toFixed(1);
      resumen = `<div class="foto-delta">
        <span class="fd-item"><strong>${dP>=0?'+':''}${dP} kg</strong> peso</span>
        <span class="fd-item ${dG<0?'bueno':''}"><strong>${dG>=0?'+':''}${dG} kg</strong> grasa</span>
        <span class="fd-item ${dS>=0?'bueno':''}"><strong>${dS>=0?'+':''}${dS} kg</strong> músculo</span>
      </div>`;
    }
    const invertido = fa > fb
      ? `<div class="cmp-aviso">Ojo: la fecha de "antes" es posterior a la de "después",
         así que estás viendo la comparación al revés.</div>` : '';

    if(modo === 'slider'){
      visor.innerHTML = `
        ${resumen}
        <div class="cmp-slider" id="cmp">
          <img src="${ub}" alt="Después">
          <div class="cmp-antes" id="cmp-antes"><img src="${ua}" alt="Antes"></div>
          <div class="cmp-linea" id="cmp-linea"><span>↔</span></div>
        </div>
        <input type="range" min="0" max="100" value="50" class="cmp-rango"
          oninput="moverSlider(this.value)">
        <div class="cmp-pies"><span>${esc(fa)}</span><span>${esc(fb)}</span></div>
        ${invertido}`;
      moverSlider(50);
    } else {
      visor.innerHTML = `
        ${resumen}
        <div class="cmp-lado">
          <figure><img src="${ua}" alt="Antes">${pieFoto(fa)}</figure>
          <figure><img src="${ub}" alt="Después">${pieFoto(fb)}</figure>
        </div>
        ${invertido}`;
    }
  } catch(e){
    visor.innerHTML = `<p class="reg-status">❌ ${esc(e.message)}</p>`;
  }
}
function moverSlider(v){
  const a = document.getElementById('cmp-antes');
  const l = document.getElementById('cmp-linea');
  if(a) a.style.width = v+'%';
  if(l) l.style.left  = v+'%';
}

/* ════════════════════════════════════════════════════════════
   PESTAÑA 2 — LÍNEA DE TIEMPO de una postura
   Todas las sesiones de la misma postura, en orden. Sirve para ver
   la tendencia; el comparador sirve para ver la diferencia.
   ════════════════════════════════════════════════════════════ */
function renderLinea(){
  const cont = document.getElementById('fotos-linea-cont');
  if(!cont) return;
  if(!_fotos.length){
    cont.innerHTML = '<div class="fotos-vacio"><p>Sin fotos todavía.</p></div>';
    return;
  }
  if(!_poseLinea || !esPoseConocida(_poseLinea)) _poseLinea = posePorDefecto();
  const lista = fotosDePose(_poseLinea);
  const cuerpo = lista.length
    ? `<div class="linea-strip">
        ${lista.map((f,i)=>{
          const m = medicionCerca(f.fecha);
          const cls = i===0 ? ' primera' : (i===lista.length-1 ? ' ultima' : '');
          return `<figure class="linea-item${cls}">
            <div class="mini linea-thumb" data-mini-id="${f.id}"
              onclick="verFotoGrande('${f.id}')">⏳</div>
            <figcaption>${esc(f.fecha)}
              ${m?`<span>${m.peso} kg · ${m.grasa} kg grasa</span>`:''}</figcaption>
          </figure>`;
        }).join('')}
      </div>
      <div class="linea-pie">${lista.length} sesión${lista.length===1?'':'es'} con esta postura ·
        desliza para verlas todas · toca una para abrirla en grande</div>`
    : `<div class="fotos-vacio">
        <p>Todavía no hay fotos de <strong>${esc(nombrePose(_poseLinea))}</strong>.</p>
      </div>`;
  cont.innerHTML = `
    <div class="fotos-ctrl">
      <div class="fc-campo fc-ancho">
        <label for="fl-pose">Postura</label>
        <select id="fl-pose" onchange="cambiarPoseLinea(this.value)">${opcionesPose(_poseLinea,true)}</select>
      </div>
    </div>
    ${cuerpo}`;
  pintarMinis(cont);
}
function cambiarPoseLinea(pose){ _poseLinea = pose; renderLinea(); }

/* ════════════════════════════════════════════════════════════
   PESTAÑA 3 — SESIONES
   Cada fecha con sus huecos por postura. Los que faltan se ven como
   hueco a propósito: es la forma de saber si una sesión quedó a
   medias, y tocarlos sube esa foto directamente.
   ════════════════════════════════════════════════════════════ */
function renderGaleria(){
  const grid = document.getElementById('fotos-grid');
  if(!grid) return;
  const ses = sesiones();
  if(!ses.length){
    grid.innerHTML = `<div class="fotos-vacio"><p>Sin fotos todavía.</p>
      <button class="blk-btn primary" onclick="abrirSubirFotos()">Subir la primera sesión</button></div>`;
    return;
  }
  const huerfanas = sinClasificar();
  grid.innerHTML = (huerfanas.length ? bloqueHuerfanas(huerfanas) : '') + ses.map(s=>{
    const m = medicionCerca(s.fecha);
    const pct = Math.round(s.hechas/s.total*100);
    return `<div class="ses-card">
      <div class="ses-head">
        <div>
          <div class="ses-fecha">${esc(s.fecha)}
            <button class="link-btn" style="margin-left:9px;font-weight:600"
              onclick="abrirRefechar('${esc(s.fecha)}')"
              title="Cambiar la fecha de esta sesión">cambiar fecha</button></div>
          ${m?`<div class="ses-comp">${m.peso} kg · ${m.grasa} kg grasa · ${m.smm} kg músculo</div>`:''}
        </div>
        <span class="ses-cont ${s.hechas===s.total?'full':''}">${s.hechas}/${s.total}</span>
      </div>
      <div class="ses-barra"><div class="ses-fill" style="width:${pct}%"></div></div>
      <div class="gal-row">
        ${POSTURAS.map(p=>{
          const f = s.porPose[p.id];
          if(f) return `<figure class="gal-item">
            <div class="mini gal-thumb" data-mini-id="${f.id}"
              onclick="verFotoGrande('${f.id}')">⏳</div>
            <figcaption class="gal-pose">${esc(p.nombre)}</figcaption>
          </figure>`;
          return `<figure class="gal-item falta" title="Subir esta postura"
            onclick="abrirSubirFotos('${esc(s.fecha)}','${esc(p.id)}')">
            <div class="gal-thumb vacio">＋</div>
            <figcaption class="gal-pose">${esc(p.nombre)}</figcaption>
          </figure>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  pintarMinis(grid);
}

/* Fotos cuya postura no está en la lista: normalmente las de antes de
   fijar las posturas, o alguna subida con un id que luego cambió.
   No se pierden ni se borran solas — se reasignan aquí. */
function bloqueHuerfanas(lista){
  return `<div class="huerf-box">
    <div class="huerf-head">⚠️ ${lista.length} foto${lista.length>1?'s':''} sin clasificar</div>
    <div class="huerf-txt">Su postura no está en la lista actual, así que no entran en
      ninguna comparación. Asígnales una y se colocan solas en su sesión.</div>
    ${lista.map(f=>`
      <div class="huerf-fila">
        <div class="mini huerf-thumb" data-mini-id="${f.id}" onclick="verFotoGrande('${f.id}')">⏳</div>
        <div class="huerf-info">${esc(f.fecha)}<span>guardada como "${esc(f.pose)}"</span></div>
        <select onchange="reclasificarFoto('${f.id}', this.value)">
          <option value="">Asignar postura…</option>
          ${POSTURAS.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}
        </select>
      </div>`).join('')}
  </div>`;
}

async function reclasificarFoto(id, pose){
  if(!pose) return;
  const f = _fotos.find(x=>x.id===id);
  const choque = f && fotoDe(f.fecha, pose);
  if(choque && !confirm(
      `El ${f.fecha} ya tiene una foto de "${nombrePose(pose)}".\n\n` +
      `Si continúas, la anterior se manda a la papelera de Drive (se puede recuperar 30 días).\n\n` +
      `¿Continuar?`)) { renderGaleria(); return; }
  try {
    await api({action:'reclasificarFoto', id, pose});
    _cacheMini.delete(id); _cacheFotos.delete(id);
    await initFotos();
  } catch(e){
    alert('No se pudo reclasificar: ' + e.message);
  }
}

/* ── Cambiar la fecha de una sesión ya subida ─────────────
   La fecha no vive en ninguna hoja: es la primera parte del nombre
   del archivo en Drive. Re-fecharla es renombrar, así que las
   imágenes no se vuelven a subir ni pierden calidad, y los ids no
   cambian (la caché en memoria sigue sirviendo).                  */
let _refDe = null;

function abrirRefechar(fecha){
  _refDe = fecha;
  const n = _fotos.filter(f=>f.fecha===fecha).length;
  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="form-modal" style="max-width:380px">
      <div class="blk-modal-hdr"><span>📅 Fecha de la sesión</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="ref-msg" class="form-msg info">
          Vas a cambiar la fecha de las <strong>${n} foto${n>1?'s':''}</strong>
          guardadas como ${esc(fecha)}. Las imágenes no se tocan: solo se renombran.
        </div>
        <div class="form-campo" style="max-width:200px">
          <label for="ref-fecha">Fecha correcta</label>
          <input type="date" id="ref-fecha" value="${esc(fecha)}" max="${hoyISO()}">
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="ref-guardar" onclick="guardarRefecha()">Cambiar fecha</button>
      </div>
    </div>
  </div>`;
}

async function guardarRefecha(){
  const msg = document.getElementById('ref-msg');
  const btn = document.getElementById('ref-guardar');
  const nueva = document.getElementById('ref-fecha').value;
  if(!nueva){ msg.className='form-msg err'; msg.textContent='Elige una fecha.'; return; }
  if(nueva === _refDe){ cerrarForm(); return; }
  if(nueva > hoyISO()){
    msg.className='form-msg err'; msg.textContent='No se puede fechar una sesión en el futuro.'; return;
  }
  // Si la fecha destino ya existe, las dos sesiones se fusionan y las
  // posturas repetidas se pisan. Es recuperable, pero hay que decirlo.
  const posesQueMuevo = _fotos.filter(f=>f.fecha===_refDe).map(f=>f.pose);
  const choques = _fotos.filter(f=>f.fecha===nueva && posesQueMuevo.includes(f.pose));
  const yaHaySesion = _fotos.some(f=>f.fecha===nueva);
  if(yaHaySesion){
    const aviso = choques.length
      ? `El ${nueva} ya tiene ${choques.length} foto(s) de esas mismas posturas ` +
        `(${choques.map(f=>nombrePose(f.pose)).join(', ')}).\n\n` +
        `Se van a la papelera de Drive, recuperables 30 días.\n\n¿Continuar?`
      : `El ${nueva} ya tiene una sesión. Las dos se van a fusionar en una sola.\n\n¿Continuar?`;
    if(!confirm(aviso)) return;
  }
  btn.disabled = true; btn.textContent = 'Cambiando…';
  try {
    const r = await api({action:'refecharSesion', de:_refDe, a:nueva});
    cerrarForm();
    await initFotos();
    // Deja la vista en Sesiones, que es de donde venía
    switchFotosTab('galeria', document.querySelectorAll('#fotos-tab-nav .tab-btn')[2]);
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Cambiar fecha';
  }
}

/* ── Visor de una foto en grande, con salto entre sesiones ── */
async function verFotoGrande(id){
  const f = _fotos.find(x=>x.id===id);
  if(!f) return;
  // Se navega entre sesiones DENTRO de la misma postura: es el eje que
  // tiene sentido mirar seguido.
  const serie = fotosDePose(f.pose);
  const i = serie.findIndex(x=>x.id===id);
  const host = document.getElementById('form-host');
  host.innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="big-wrap">
      <div style="color:#fff;padding:40px 0"><span class="lector-spin">⏳</span></div>
    </div>
  </div>`;
  let url;
  try { url = await cargarFoto(id); }
  catch(e){ host.innerHTML = ''; alert('No se pudo abrir: ' + e.message); return; }
  const m = medicionCerca(f.fecha);
  host.innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="big-wrap">
      <img src="${url}" alt="${esc(f.fecha)} ${esc(nombrePose(f.pose))}">
      <div class="big-pie">${esc(nombrePose(f.pose))} · ${esc(f.fecha)}
        ${m?`<span>${m.peso} kg · ${m.grasa} kg grasa · ${m.smm} kg músculo</span>`:''}
        <span>${i+1} de ${serie.length} en esta postura</span></div>
      <div class="big-nav">
        <button onclick="verFotoGrande('${serie[i-1]?serie[i-1].id:''}')"
          ${i<=0?'disabled':''}>← Anterior</button>
        <button onclick="verFotoGrande('${serie[i+1]?serie[i+1].id:''}')"
          ${i>=serie.length-1?'disabled':''}>Siguiente →</button>
        <button onclick="compararDesdeFoto('${f.id}')" ${serie.length<2?'disabled':''}>↔️ Comparar</button>
        <button class="peligro" onclick="borrarFotoConfirm('${f.id}')">🗑 Borrar</button>
      </div>
    </div>
  </div>`;
}

/* Abre el comparador ya centrado en esta postura y esta fecha. */
function compararDesdeFoto(id){
  const f = _fotos.find(x=>x.id===id);
  if(!f) return;
  cerrarForm();
  _poseComparar = f.pose;
  switchFotosTab('comparar', document.querySelector('#fotos-tab-nav .tab-btn'));
  renderControlesFotos();
  const sel = document.getElementById('fc-b');
  if(sel){ sel.value = f.fecha; renderVisor(); }
}

async function borrarFotoConfirm(id){
  const f = _fotos.find(x=>x.id===id);
  if(!f) return;
  if(!confirm(`¿Borrar la foto de ${nombrePose(f.pose)} del ${f.fecha}?\n\n` +
              `Va a la papelera de tu Drive: se puede recuperar durante 30 días.`)) return;
  try {
    await api({action:'borrarFoto', id});
    _cacheMini.delete(id); _cacheFotos.delete(id);
    cerrarForm();
    await initFotos();
  } catch(e){
    alert('No se pudo borrar: ' + e.message);
  }
}

function switchFotosTab(id, btn){
  document.querySelectorAll('#section-fotos .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#fotos-tab-nav .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('fotos-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
}

/* ════════════════════════════════════════════════════════════
   SUBIR UNA SESIÓN
   Se eligen todas las fotos de golpe y luego se etiquetan. Al
   etiquetar se muestra al lado la última foto de esa misma postura:
   sirve tanto para no equivocarse de postura como para replicar el
   encuadre en la siguiente sesión.
   ════════════════════════════════════════════════════════════ */
let _subida = [];        // [{file, url, pose}]
let _subidaFecha = null;
let _subidaPoseFija = null;

function abrirSubirFotos(fechaPre, posePre){
  if(!POSTURAS.length){ alert('Todavía no se cargó la lista de posturas.'); return; }
  _subida = [];
  _subidaFecha = fechaPre || hoyISO();
  _subidaPoseFija = posePre || null;
  const p = posePre ? POSTURAS.find(x=>x.id===posePre) : null;
  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="form-modal" style="max-width:440px">
      <div class="blk-modal-hdr"><span>📸 ${p?`Subir ${esc(p.nombre)}`:'Nueva sesión'}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="foto-msg" class="form-msg info">
          ${p ? `Vas a subir la foto de <strong>${esc(p.nombre)}</strong> del ${esc(_subidaFecha)}.`
              : `Elige de una vez las <strong>${POSTURAS.length} fotos</strong> de la sesión.
                 En la pantalla siguiente le pones postura a cada una, con la foto anterior
                 al lado como referencia.`}
        </div>
        <div class="form-campo" style="max-width:200px">
          <label for="foto-fecha">Fecha de la sesión</label>
          <input type="date" id="foto-fecha" value="${esc(_subidaFecha)}" max="${hoyISO()}">
        </div>
        <div class="form-campo" style="margin-top:12px">
          <label for="foto-archivo">Fotos</label>
          <input type="file" id="foto-archivo" accept="image/*" ${p?'':'multiple'}
            onchange="archivosElegidos(this)">
          <div class="form-calc">Se reducen antes de subirlas, para que pesen menos.
            Se guardan en la carpeta privada de tu Drive.</div>
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
      </div>
    </div>
  </div>`;
}

function archivosElegidos(inp){
  const fecha = document.getElementById('foto-fecha').value;
  if(!fecha){ alert('Elige primero la fecha de la sesión.'); inp.value=''; return; }
  if(fecha > hoyISO()){ alert('No se puede registrar una sesión futura.'); inp.value=''; return; }
  _subidaFecha = fecha;
  const files = [...(inp.files||[])];
  if(!files.length) return;
  if(files.length > POSTURAS.length + 3){
    if(!confirm(`Elegiste ${files.length} fotos y solo hay ${POSTURAS.length} posturas. ` +
                `¿Seguro que quieres continuar?`)) { inp.value=''; return; }
  }
  const cola = colaDePosturas(_subidaFecha, _subidaPoseFija);
  _subida = files.map((f,i)=>({
    file: f,
    url: URL.createObjectURL(f),
    pose: cola[i] || (POSTURAS[POSTURAS.length-1] || {}).id
  }));
  renderEtiquetado();
}

/* Orden en que se proponen las posturas al etiquetar: primero las que
   le FALTAN a esa sesión, en el orden de la lista, y después el resto.
   Así completar una sesión a medias no obliga a tocar ningún selector,
   que es justo cuando más fácil es equivocarse. */
function colaDePosturas(fecha, poseFija){
  if(poseFija) return [poseFija];
  const ses = sesiones().find(s=>s.fecha===fecha);
  const todas = POSTURAS.map(p=>p.id);
  if(!ses) return todas;
  return ses.faltan.concat(todas.filter(id=>!ses.faltan.includes(id)));
}

/* Cuántas fotos de la tanda llevan cada postura. >1 es un duplicado:
   la segunda reemplazaría a la primera en Drive sin avisar. */
function contarPosturas(lista){
  const n = {};
  lista.forEach(s=>{ n[s.pose] = (n[s.pose]||0)+1; });
  return n;
}

function renderEtiquetado(){
  const dup = contarPosturas(_subida);
  const hayDup = Object.values(dup).some(n=>n>1);

  const filas = _subida.map((s,i)=>{
    // Última foto anterior de esta misma postura, como referencia
    const previas = fotosDePose(s.pose).filter(f=>f.fecha < _subidaFecha);
    const ref = previas.length ? previas[previas.length-1] : null;
    const yaHay = fotoDe(_subidaFecha, s.pose);
    return `<div class="sub-fila ${dup[s.pose]>1?'dup':''}">
      <img src="${s.url}" class="sub-nueva" alt="Foto ${i+1}">
      <div class="sub-centro">
        <div class="sub-nom">${esc(s.file.name)}</div>
        <select onchange="cambiarPoseSubida(${i}, this.value)">
          ${POSTURAS.map(p=>`<option value="${esc(p.id)}" ${p.id===s.pose?'selected':''}>${esc(p.nombre)}</option>`).join('')}
        </select>
        ${dup[s.pose]>1 ? `<div class="sub-dup-aviso">⚠️ Dos fotos con esta postura</div>` : ''}
        ${yaHay ? `<div class="sub-dup-aviso" style="color:#b45309">Reemplaza la que ya hay de ese día</div>` : ''}
      </div>
      <div class="sub-ref ${ref?'':'vacia'}">
        ${ref ? `<div class="mini" data-mini-id="${ref.id}"></div><span>${esc(ref.fecha)}</span>`
              : `<div class="mini">—</div><span>sin previa</span>`}
      </div>
    </div>`;
  }).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cancelarSubida()">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>Etiquetar sesión</span>
        <button onclick="cancelarSubida()">×</button></div>
      <div class="form-modal-body">
        <div class="form-campo" style="max-width:210px;margin-bottom:13px">
          <label for="sub-fecha">Fecha de la sesión</label>
          <input type="date" id="sub-fecha" value="${esc(_subidaFecha)}" max="${hoyISO()}"
            onchange="cambiarFechaSubida(this.value)">
          <div class="form-calc">Es el día en que te tomaste las fotos, no el día que las subes.
            Cámbiala aquí si hace falta: las referencias y los avisos se recalculan solos.</div>
        </div>
        <div id="sub-msg" class="form-msg ${hayDup?'err':'info'}">
          ${hayDup
            ? 'Hay dos fotos con la misma postura. Corrige antes de subir: la segunda reemplazaría a la primera.'
            : 'A la derecha, tu foto anterior de esa misma postura. Si el encuadre no se parece, la comparación va a engañar más que ayudar.'}
        </div>
        ${filas}
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cancelarSubida()">Cancelar</button>
        <button class="blk-btn primary" id="sub-guardar" onclick="subirSesion()" ${hayDup?'disabled':''}>
          Subir ${_subida.length} foto${_subida.length>1?'s':''}</button>
      </div>
    </div>
  </div>`;
  pintarMinis(document.getElementById('form-host'));
}

function cambiarPoseSubida(i, pose){
  if(!_subida[i]) return;
  const anterior = _subida[i].pose;
  const j = _subida.findIndex((s,k) => k !== i && s.pose === pose);
  if(j >= 0) _subida[j].pose = anterior;   // intercambia en vez de duplicar

  _subida[i].pose = pose;

  const antes = document.querySelector('#form-host .form-modal-body');
  const y = antes ? antes.scrollTop : 0;
  renderEtiquetado();
  const despues = document.querySelector('#form-host .form-modal-body');
  if(despues) despues.scrollTop = y;       // no saltes al principio en cada cambio
}

/* La fecha se puede corregir aquí, con las fotos delante, que es
   cuando de verdad te das cuenta de que no era hoy.

   Lo que NO se rehace es la autoasignación de posturas. Si la fecha
   nueva corresponde a una sesión a medias, el orden propuesto ya no
   sería el óptimo — pero rehacerlo pisaría los selectores que hayas
   tocado a mano, y eso molesta más de lo que ayuda. Lo que sí se
   recalcula es lo que importa: la foto de referencia de cada postura
   y el aviso de "reemplaza la que ya hay de ese día". */
function cambiarFechaSubida(v){
  if(!v) return;
  if(v > hoyISO()){
    alert('No se puede registrar una sesión futura.');
    renderEtiquetado();
    return;
  }
  _subidaFecha = v;
  renderEtiquetado();
}

function cancelarSubida(){
  if(_subida.length && !confirm('¿Descartar estas fotos sin subirlas?')) return;
  _subida.forEach(s=>{ try{ URL.revokeObjectURL(s.url); }catch(e){} });
  _subida = [];
  cerrarForm();
}

/* Subida en serie, no en paralelo: cada foto es un POST con la imagen
   en base64 y el Apps Script no lleva bien varias a la vez. Además así
   se puede mostrar progreso real y, si una falla, se sabe cuál. */
async function subirSesion(){
  const btn = document.getElementById('sub-guardar');
  const msg = document.getElementById('sub-msg');
  btn.disabled = true;
  const total = _subida.length;
  let hechas = 0;
  const fallos = [];

  msg.className = 'form-msg info';
  msg.innerHTML = `Subiendo…<div class="sub-prog"><div class="sub-prog-fill" id="sub-fill" style="width:0%"></div></div>
    <span id="sub-cuenta">0 de ${total}</span>`;

  for(const s of _subida){
    btn.textContent = `Subiendo ${hechas+1} de ${total}…`;
    try {
      const prep = await prepararArchivo(s.file, 1400, 0.85);
      await apiPost({action:'subirFoto', fecha:_subidaFecha, pose:s.pose,
                     mimeType:prep.mimeType, datos:prep.datos});
    } catch(e){
      fallos.push(`${nombrePose(s.pose)}: ${e.message}`);
    }
    hechas++;
    const fill = document.getElementById('sub-fill');
    const cta  = document.getElementById('sub-cuenta');
    if(fill) fill.style.width = Math.round(hechas/total*100)+'%';
    if(cta)  cta.textContent = `${hechas} de ${total}`;
  }

  _subida.forEach(s=>{ try{ URL.revokeObjectURL(s.url); }catch(e){} });
  _subida = [];

  if(fallos.length){
    msg.className = 'form-msg err';
    msg.innerHTML = `Se subieron ${total-fallos.length} de ${total}. No se pudo con:<br>` +
                    fallos.map(esc).join('<br>');
    btn.textContent = 'Cerrar';
    btn.disabled = false;
    btn.onclick = async () => { cerrarForm(); await initFotos(); };
    return;
  }
  msg.className = 'form-msg ok';
  msg.textContent = `✓ Sesión del ${_subidaFecha} guardada · ${total} foto${total>1?'s':''}.`;
  btn.textContent = '✓ Listo';
  setTimeout(async ()=>{ cerrarForm(); await initFotos(); }, 900);
}



