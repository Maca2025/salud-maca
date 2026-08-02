/* ════════════════════════════════════════════════════════════
   REGISTRO DE INGESTA Y CORRELACIÓN CON LA COMPOSICIÓN
   La pregunta que responde: ¿lo que como sostiene mi músculo?
   ════════════════════════════════════════════════════════════ */
function ingestaDe(iso){
  return INGESTA.find(x=>x.fecha===iso) || null;
}

let _itemsHoy = [];      // [{alimento, g, origen, prot, kcal}]
let _aguaHoy   = 0;
let _creatinaHoy = false;
let _fechaLog  = null;   // fecha del borrador cargado en memoria
let _sinGuardar = false; // hay cambios en pantalla que no están en la hoja
const ING_KEY  = 'maca-ingesta-borrador';

/* El borrador vive en el navegador para que recargar no borre lo que
   llevas sin guardar. iOS cierra pestañas en segundo plano con facilidad. */
function marcarCambio(){
  _sinGuardar = true;
  guardarBorradorLog();
}

function guardarBorradorLog(){
  try {
    localStorage.setItem(ING_KEY, JSON.stringify({
      fecha: hoyISO(),
      items: _itemsHoy.map(it=>({a:it.alimento, g:it.g})),
      agua: _aguaHoy, creatina: _creatinaHoy
    }));
  } catch(e){}
}
function limpiarBorradorLog(){
  try { localStorage.removeItem(ING_KEY); } catch(e){}
}
function leerBorradorLog(){
  try {
    const b = JSON.parse(localStorage.getItem(ING_KEY) || 'null');
    return (b && b.fecha === hoyISO()) ? b : null;
  } catch(e){ return null; }
}

/* Firma de un item, para comparar listas sin depender del orden */
function firmaItems(items){
  return items.map(it=>`${it.alimento}|${it.g}`).sort().join('||');
}

/* Reconstruye los items del día desde el texto guardado: "Huevo entero 100|Pollo 150" */
function parseDetalle(txt){
  return String(txt||'').split('|').map(s=>s.trim()).filter(Boolean).map(s=>{
    const m = s.match(/^(.*?)\s+([\d.]+)$/);
    const nombre = m ? m[1].trim() : s;
    const g = m ? parseFloat(m[2]) : 0;
    return itemDe(nombre, g);
  }).filter(Boolean);
}

function itemDe(nombre, g){
  const a = buscarAlimento(nombre);
  const f = g/100;
  return {
    alimento: a ? a.alimento : nombre,
    g,
    origen: a ? (a.origen||'') : '',
    prot: a ? +(a.prot*f).toFixed(1) : 0,
    kcal: a ? Math.round(a.kcal*f) : 0,
    desconocido: !a,
  };
}

function totalesHoy(){
  let pa=0, pv=0, kcal=0, shakes=0;
  _itemsHoy.forEach(it=>{
    kcal += it.kcal;
    if(it.origen==='animal') pa += it.prot;
    else if(it.origen==='vegetal') pv += it.prot;
    if(/whey|proteína|proteina|shake|batido/i.test(it.alimento)) shakes++;
  });
  return {pa:Math.round(pa), pv:Math.round(pv), kcal:Math.round(kcal), shakes};
}

function renderIngestaHoy(){
  const cont = document.getElementById('ingesta-hoy');
  if(!cont) return;
  // Solo se hidrata una vez por día: después manda lo que hay en pantalla
  if(_fechaLog !== hoyISO()){
    _fechaLog = hoyISO();
    const y = ingestaDe(hoyISO());
    const b = leerBorradorLog();
    // Base: lo que ya está en la hoja
    if(y && y.detalle) {
      _itemsHoy = parseDetalle(y.detalle);
      _aguaHoy = y.agua || 0;
      _creatinaHoy = !!y.creatina;
      _sinGuardar = false;          // lo que vino de la hoja ya está guardado
    }
    // Encima, el borrador local si trae más cosas (quedó sin guardar)
    if(b && b.items && b.items.length > _itemsHoy.length){
      _itemsHoy = b.items.map(x=>itemDe(x.a, x.g));
      _aguaHoy = Math.max(_aguaHoy, b.agua || 0);
      _creatinaHoy = _creatinaHoy || !!b.creatina;
      _sinGuardar = true;           // el borrador traía cosas sin guardar
    }
  }
  const t = totalesHoy();
  const vasos = Math.round(_aguaHoy/250);

  // Chips: primero lo frecuente de la tabla, luego lo de hoy en el plan
  const frecuentes = ALIMENTOS.filter(a=>a.frecuente && a.porcion>0);
  const chips = frecuentes.map(a=>`
    <button class="chip-alim" onclick="agregarItem('${esc(a.alimento).replace(/'/g,"\\'")}',${a.porcion})">
      <span class="chip-nom">${esc(a.alimento)}</span>
      <span class="chip-por">${esc(a.porcionNombre||a.porcion+' g')}</span>
    </button>`).join('');

  const lista = _itemsHoy.length ? _itemsHoy.map((it,i)=>`
    <div class="item-log ${it.desconocido?'sin-datos':''}">
      <span class="il-nom">${esc(it.alimento)}</span>
      <span class="il-g">${it.g} g</span>
      <span class="il-prot">${it.prot} g prot</span>
      <button class="il-x" onclick="quitarItem(${i})" aria-label="Quitar">×</button>
    </div>`).join('') : '<div class="log-vacio">Toca un alimento, dicta o toma una foto.</div>';

  cont.innerHTML = `
    <div class="log-hoy">
      <div class="log-tot">
        <div class="lt-big"><strong>${t.pa+t.pv} g</strong><span>proteína hoy</span></div>
        ${(!_itemsHoy.length && !_aguaHoy && !_creatinaHoy) ? '' :
          (_sinGuardar
            ? '<div class="log-estado pend">● sin guardar</div>'
            : '<div class="log-estado ok">✓ guardado</div>')}
        <div class="lt-sub">
          <span class="lt-an">${t.pa} animal</span>
          <span class="lt-ve">${t.pv} vegetal</span>
          <span class="lt-kc">${t.kcal} kcal</span>
        </div>
      </div>

      <div class="log-acciones">
        <button class="acc-btn" onclick="dictarComida()" id="btn-dictar">🎤 Dictar</button>
        <button class="acc-btn" onclick="fotoComida()">📷 Foto</button>
        <button class="acc-btn" onclick="verComidasPlan()">🍽️ Del plan</button>
      </div>

      <div class="log-chips">${chips}</div>

      <div class="log-lista">${lista}</div>

      <div class="log-extras">
        <div class="agua-box">
          <div class="agua-lbl">💧 Agua <strong>${(_aguaHoy/1000).toFixed(2)} L</strong></div>
          <div class="agua-vasos">
            ${Array.from({length:10},(_,k)=>`
              <button class="vaso ${k<vasos?'lleno':''}" onclick="setAgua(${(k+1)*250})"
                aria-label="${k+1} vasos"></button>`).join('')}
          </div>
        </div>
        <button class="crea-btn ${_creatinaHoy?'on':''}" onclick="toggleCreatina()">
          💪 Creatina ${_creatinaHoy?'✓':''}
        </button>
      </div>

      <button class="blk-btn primary log-guardar" id="ing-guardar" onclick="guardarIngestaHoy()">
        Guardar día</button>
      <div id="ing-msg"></div>
    </div>`;
}

function agregarItem(nombre, g){
  _itemsHoy.push(itemDe(nombre, g));
  marcarCambio();
  renderIngestaHoy();
}
function quitarItem(i){
  _itemsHoy.splice(i,1);
  marcarCambio();
  renderIngestaHoy();
}
function setAgua(ml){
  _aguaHoy = (_aguaHoy === ml) ? ml-250 : ml;   // volver a tocar el mismo vaso lo quita
  if(_aguaHoy < 0) _aguaHoy = 0;
  marcarCambio();
  renderIngestaHoy();
}
function toggleCreatina(){
  _creatinaHoy = !_creatinaHoy;
  marcarCambio();
  renderIngestaHoy();
}

/* ── Dictado: usa el reconocimiento del navegador y luego Gemini ── */
function dictarComida(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    // Sin reconocimiento nativo: caja de texto con el dictado del teclado
    pedirTextoComida();
    return;
  }
  const rec = new SR();
  rec.lang = 'es-MX';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  const btn = document.getElementById('btn-dictar');
  btn.classList.add('grabando');
  btn.textContent = '🔴 Escuchando…';

  rec.onresult = e => {
    const txt = e.results[0][0].transcript;
    btn.classList.remove('grabando'); btn.textContent = '🎤 Dictar';
    interpretarComida(txt);
  };
  rec.onerror = () => {
    btn.classList.remove('grabando'); btn.textContent = '🎤 Dictar';
    pedirTextoComida();
  };
  rec.onend = () => { btn.classList.remove('grabando'); btn.textContent = '🎤 Dictar'; };
  rec.start();
}

/* Alternativa: campo de texto donde puede usar el dictado del teclado */
function pedirTextoComida(){
  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal" style="max-width:400px">
      <div class="blk-modal-hdr"><span>🎤 ¿Qué comiste?</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div class="form-msg info">Usa el micrófono de tu teclado para dictarlo,
          o escríbelo como lo dirías: <em>"dos huevos, un pan y café con leche"</em>.</div>
        <div class="form-campo">
          <textarea id="txt-comida" rows="3" placeholder="dos huevos con jamón y un vaso de leche"></textarea>
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" onclick="interpretarComida(document.getElementById('txt-comida').value)">
          Interpretar</button>
      </div>
    </div>
  </div>`;
  setTimeout(()=>{ const e=document.getElementById('txt-comida'); if(e) e.focus(); }, 80);
}

async function interpretarComida(texto){
  if(!texto || !texto.trim()) return;
  overlayLectura('comida', texto.slice(0,60));
  try {
    const r = await apiPost({action:'leerDocumento', tipo:'comida',
                             mimeType:'text/plain',
                             datos: btoa(unescape(encodeURIComponent(texto)))});
    cerrarForm();
    revisarComida(r.datos, texto);
  } catch(e){
    cerrarForm();
    alert('No se pudo interpretar: ' + e.message);
  }
}

async function fotoComida(){
  const inp = document.getElementById('doc-input');
  inp.value = '';
  inp.accept = 'image/*';
  inp.setAttribute('capture','environment');
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    inp.removeAttribute('capture'); inp.accept = 'application/pdf,image/*';
    if(!f) return;
    overlayLectura('comida', f.name);
    try {
      const prep = await prepararArchivo(f, 1100, 0.8);
      const r = await apiPost({action:'leerDocumento', tipo:'comida',
                               mimeType:prep.mimeType, datos:prep.datos});
      cerrarForm();
      revisarComida(r.datos, 'foto');
    } catch(e){
      cerrarForm();
      alert('No se pudo leer la foto: ' + e.message);
    }
  };
  inp.click();
}

/* Lo que la IA entendió se revisa y se puede ajustar antes de sumarlo. */
function revisarComida(datos, origen){
  const items = (datos && datos.items) || [];
  if(!items.length){
    alert('No se reconoció ningún alimento. Intenta de nuevo o usa los botones.');
    return;
  }
  const filas = items.map((it,i)=>{
    const a = buscarAlimento(it.alimento);
    const conf = it.confianza || 'media';
    return `<div class="rev-item">
      <div class="rev-nom">
        ${esc(it.alimento)}
        ${!a?'<span class="rev-nuevo">nuevo</span>':''}
        <span class="rev-conf conf-${conf}">${conf}</span>
      </div>
      <div class="rev-ctrl">
        <button onclick="ajustarG(${i},-25)">−</button>
        <input type="number" id="rev-g-${i}" value="${it.gramos||0}" step="5">
        <span>g</span>
        <button onclick="ajustarG(${i},25)">+</button>
        <button class="rev-x" onclick="this.closest('.rev-item').remove()">×</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal" style="max-width:420px">
      <div class="blk-modal-hdr"><span>Revisar lo que entendí</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div class="form-msg ${origen==='foto'?'info':'ok'}">
          ${origen==='foto'
            ? 'Los gramos de una foto son una estimación. Ajústalos si sabes la cantidad.'
            : 'Ajusta los gramos si hace falta.'}
        </div>
        ${filas}
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" onclick='sumarComida(${JSON.stringify(items).replace(/'/g,"&#39;")})'>
          Agregar al día</button>
      </div>
    </div>
  </div>`;
}

function ajustarG(i, d){
  const e = document.getElementById('rev-g-'+i);
  if(!e) return;
  e.value = Math.max(0, (Number(e.value)||0) + d);
}

function sumarComida(items){
  items.forEach((it,i)=>{
    const e = document.getElementById('rev-g-'+i);
    if(!e) return;                       // se quitó de la lista
    const g = Number(e.value)||0;
    if(g>0) _itemsHoy.push(itemDe(it.alimento, g));
  });
  marcarCambio();
  cerrarForm();
  renderIngestaHoy();
}

/* Atajo: las comidas del plan de hoy, para sumarlas de un toque */
function verComidasPlan(){
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const dia = DIAS[new Date().getDay()];
  const plan = PLANES[currentPlan] || [];
  const hoy = plan.find(d=>d.dia===dia);
  if(!hoy){
    alert('No hay plan cargado para hoy ('+dia+').');
    return;
  }
  const comidas = ['desayuno','comida','colacion','cena'].map(k=>{
    const r = RECETAS[hoy[k]];
    if(!r) return '';
    const ICO = {desayuno:'☀️',comida:'🍽️',colacion:'🍎',cena:'🌙'};
    return `<button class="plan-item" onclick="sumarReceta('${hoy[k]}',this)">
      <span class="pi-ico">${ICO[k]}</span>
      <span class="pi-nom">${esc(r.nombre)}</span>
      <span class="pi-mac">${r.prot} g prot · ${r.kcal} kcal</span>
    </button>`;
  }).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal" style="max-width:400px">
      <div class="blk-modal-hdr"><span>🍽️ Tu plan de hoy · ${esc(dia)}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div class="form-msg info">Toca lo que sí comiste. Se suman sus ingredientes reales.</div>
        ${comidas || '<div class="log-vacio">Sin comidas para hoy.</div>'}
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn primary" onclick="cerrarForm()">Listo</button>
      </div>
    </div>
  </div>`;
}

function sumarReceta(key, btn){
  const r = RECETAS[key];
  if(!r) return;
  (r.ingredientes||[]).forEach(ing=>{
    const g = ing.g || 0;
    if(g>0) _itemsHoy.push(itemDe(ing.nombre, g));
  });
  btn.classList.add('sumado');
  btn.querySelector('.pi-nom').textContent += ' ✓';
  btn.disabled = true;
  marcarCambio();
  renderIngestaHoy();
}

async function guardarIngestaHoy(){
  const btn = document.getElementById('ing-guardar');
  const msg = document.getElementById('ing-msg');

  // Antes de escribir, comprobar qué hay en la hoja para hoy.
  // Guardar reemplaza el día entero, así que si otro dispositivo
  // registró algo que aquí no está, hay que avisarlo.
  btn.disabled = true; btn.textContent = 'Comprobando…';
  try {
    const d = await api({action:'ingesta'});
    const serv = (d.ingesta || []).find(x=>x.fecha===hoyISO());
    if(serv && serv.detalle){
      const enServidor = parseDetalle(serv.detalle);
      const faltan = enServidor.filter(s =>
        !_itemsHoy.some(l => l.alimento===s.alimento && l.g===s.g));
      if(faltan.length){
        const nombres = faltan.map(x=>`${x.alimento} ${x.g} g`).join(', ');
        const sumar = confirm(
          `Hay ${faltan.length} cosa(s) registradas hoy que no están en esta pantalla:\n\n` +
          nombres + `\n\n¿Las sumo a lo que llevas aquí?\n\n` +
          `Aceptar = conservarlas · Cancelar = reemplazar el día con lo que ves.`
        );
        if(sumar){
          faltan.forEach(x=>_itemsHoy.push(x));
          if((serv.agua||0) > _aguaHoy) _aguaHoy = serv.agua;
          _creatinaHoy = _creatinaHoy || !!serv.creatina;
          guardarBorradorLog();
          renderIngestaHoy();
        }
      }
    }
    // Actualizar la copia local con lo que trae el servidor
    INGESTA = d.ingesta || INGESTA;
  } catch(e){
    // Sin conexión no se puede comprobar: se avisa y se deja decidir
    if(!confirm('No se pudo comprobar lo ya registrado hoy.\n\n¿Guardar de todas formas? ' +
                'Si registraste algo desde otro dispositivo, podría reemplazarse.')){
      btn.disabled = false; btn.textContent = 'Guardar día';
      return;
    }
  }

  const t = totalesHoy();
  const detalle = _itemsHoy.map(it=>`${it.alimento} ${it.g}`).join('|');

  const datos = {action:'guardarIngesta', fecha: hoyISO(),
    prot_animal:t.pa, prot_vegetal:t.pv, shakes:t.shakes, kcal:t.kcal,
    agua:_aguaHoy, creatina:_creatinaHoy?1:0, detalle};

  btn.textContent = 'Guardando…';
  try {
    const r = await api(datos);
    const i = INGESTA.findIndex(x=>x.fecha===datos.fecha);
    const nuevo = {fecha:datos.fecha, nota:'', detalle,
      prot_animal:t.pa, prot_vegetal:t.pv, shakes:t.shakes,
      agua:_aguaHoy, creatina:datos.creatina, kcal:t.kcal};
    if(i>=0) INGESTA[i] = nuevo; else INGESTA.push(nuevo);
    INGESTA.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    limpiarBorradorLog();   // ya está en la hoja, el borrador sobra
    _sinGuardar = false;
    renderIngestaHoy();     // faltaba: el indicador no se actualizaba tras guardar
    const m2 = document.getElementById('ing-msg');
    if(m2) m2.innerHTML = `<span class="ing-ok">✓ ${r.actualizado?'Actualizado':'Guardado'} · ${t.pa+t.pv} g de proteína</span>`;
    renderIngestaResumen(); renderIngestaTabla(); initGraficaIngesta();
  } catch(e){
    const m2 = document.getElementById('ing-msg');
    if(m2) m2.innerHTML = `<span class="ing-err">✗ ${esc(e.message)}</span>`;
  }
  const b2 = document.getElementById('ing-guardar');
  if(b2){ b2.disabled = false; b2.textContent = 'Guardar día'; }
  setTimeout(()=>{ const m3=document.getElementById('ing-msg'); if(m3) m3.innerHTML=''; }, 3500);
}

/* Agrupa la ingesta por semana ISO y la cruza con el cambio de
   composición de esa misma semana. */
function semanasIngesta(){
  if(!INGESTA.length) return [];
  const lunesDe = iso => {
    const d = new Date(iso+'T00:00:00');
    const dow = (d.getDay()+6)%7;      // 0 = lunes
    d.setDate(d.getDate()-dow);
    return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  };

  const sem = {};
  INGESTA.forEach(x=>{
    const k = lunesDe(x.fecha);
    if(!sem[k]) sem[k] = {inicio:k, dias:0, protA:0, protV:0, shakes:0, agua:0, creatina:0};
    const s = sem[k];
    s.dias++; s.protA += x.prot_animal; s.protV += x.prot_vegetal;
    s.shakes += x.shakes; s.agua += x.agua; s.creatina += x.creatina?1:0;
  });

  // Composición: medición más cercana al inicio y al final de cada semana
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fechaDeMedicion = (m, anio) => {
    const p = String(m.fecha).split('-');
    if(p.length!==2) return null;
    const mes = MESES.indexOf(p[1]);
    if(mes<0) return null;
    return new Date(anio, mes, parseInt(p[0],10));
  };

  return Object.values(sem).sort((a,b)=>a.inicio.localeCompare(b.inicio)).map(s=>{
    const ini = new Date(s.inicio+'T00:00:00');
    const fin = new Date(ini); fin.setDate(fin.getDate()+6);
    const anio = ini.getFullYear();
    const dentro = DATA.filter(m=>{
      const f = fechaDeMedicion(m, anio);
      return f && f>=ini && f<=fin;
    });
    const antes = DATA.filter(m=>{ const f=fechaDeMedicion(m,anio); return f && f<ini; }).pop();
    const ultima = dentro.length ? dentro[dentro.length-1] : null;

    let dGrasa=null, dSMM=null;
    if(ultima && antes){
      dGrasa = +(ultima.grasa-antes.grasa).toFixed(1);
      dSMM   = +(ultima.smm-antes.smm).toFixed(1);
    }
    return {...s,
      protDia: Math.round((s.protA+s.protV)/s.dias),
      protADia: Math.round(s.protA/s.dias),
      protVDia: Math.round(s.protV/s.dias),
      aguaDia: Math.round(s.agua/s.dias),
      shakesDia: +(s.shakes/s.dias).toFixed(1),
      smm: ultima ? ultima.smm : null,
      grasa: ultima ? ultima.grasa : null,
      dGrasa, dSMM};
  });
}

function renderIngestaResumen(){
  const cont = document.getElementById('ingesta-resumen');
  if(!cont) return;
  if(!INGESTA.length){
    cont.innerHTML = `<div class="ing-vacio">
      Aún no hay registros. Anota unos días y aquí vas a ver si tu ingesta de
      proteína está sosteniendo tu músculo.</div>`;
    return;
  }
  const ult7 = INGESTA.slice(-7);
  const prom = k => Math.round(ult7.reduce((s,x)=>s+x[k],0)/ult7.length);
  const protProm = prom('prot_animal')+prom('prot_vegetal');
  const peso = DATA.length ? DATA[DATA.length-1].peso : null;
  const gxkg = peso ? (protProm/peso).toFixed(2) : null;
  const diasCreatina = ult7.filter(x=>x.creatina).length;

  cont.innerHTML = `
    <div class="ing-stats">
      <div class="ing-stat"><strong>${protProm} g</strong><span>proteína al día</span></div>
      ${gxkg ? `<div class="ing-stat"><strong>${gxkg}</strong><span>g por kg de peso</span></div>` : ''}
      <div class="ing-stat"><strong>${prom('agua')} ml</strong><span>agua al día</span></div>
      <div class="ing-stat"><strong>${diasCreatina}/${ult7.length}</strong><span>días con creatina</span></div>
    </div>
    <div class="ing-nota">Promedios de los últimos ${ult7.length} días registrados.
      Animal ${prom('prot_animal')} g · vegetal ${prom('prot_vegetal')} g.</div>`;
}

function initGraficaIngesta(){
  const el = document.getElementById('cIngesta');
  if(!el) return;
  const sem = semanasIngesta();
  if(!sem.length) return;
  const etiqueta = s => {
    const d = new Date(s.inicio+'T00:00:00');
    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  };
  if(chartReg.cIngesta) chartReg.cIngesta.destroy();
  chartReg.cIngesta = new Chart(el, {
    type:'bar',
    data:{labels:sem.map(etiqueta), datasets:[
      {type:'bar', label:'Proteína animal g/día', data:sem.map(s=>s.protADia),
       backgroundColor:'#e74c3c99', stack:'p', yAxisID:'yP'},
      {type:'bar', label:'Proteína vegetal g/día', data:sem.map(s=>s.protVDia),
       backgroundColor:'#52b78899', stack:'p', yAxisID:'yP'},
      {type:'line', label:'Músculo SMM kg', data:sem.map(s=>s.smm),
       borderColor:'#2980b9', backgroundColor:'#2980b922', tension:.3,
       spanGaps:true, yAxisID:'ySMM'},
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
      scales:{
        x:{stacked:true, grid:{color:GRID}, ticks:{font:{size:9}}},
        yP:{stacked:true, position:'left', grid:{color:GRID}, ticks:{font:{size:9}},
            title:{display:true,text:'g proteína/día',font:{size:9}}},
        ySMM:{position:'right', grid:{drawOnChartArea:false}, ticks:{font:{size:9}},
              title:{display:true,text:'músculo kg',font:{size:9}}},
      }}
  });
}

function renderIngestaTabla(){
  const cont = document.getElementById('ingesta-tabla');
  if(!cont) return;
  const sem = semanasIngesta();
  if(!sem.length){ cont.innerHTML=''; return; }
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const filas = [...sem].reverse().map(s=>{
    const d = new Date(s.inicio+'T00:00:00');
    const cls = v => v==null ? '' : v<0 ? 'd-good' : v>0 ? 'd-bad' : '';
    const clsM = v => v==null ? '' : v>0 ? 'd-good' : v<0 ? 'd-bad' : '';
    return `<tr>
      <td>${d.getDate()} ${MESES[d.getMonth()]}<span class="sem-dias">${s.dias}d</span></td>
      <td>${s.protDia} g</td>
      <td>${s.protADia}/${s.protVDia}</td>
      <td>${s.shakesDia}</td>
      <td>${(s.aguaDia/1000).toFixed(1)} L</td>
      <td>${s.creatina}/${s.dias}</td>
      <td class="${cls(s.dGrasa)}">${s.dGrasa!=null?(s.dGrasa>0?'+':'')+s.dGrasa:'—'}</td>
      <td class="${clsM(s.dSMM)}">${s.dSMM!=null?(s.dSMM>0?'+':'')+s.dSMM:'—'}</td>
    </tr>`;
  }).join('');

  const conDatos = sem.filter(s=>s.dSMM!=null);
  let insight = '';
  if(conDatos.length>=3){
    const alto = conDatos.filter(s=>s.protDia >= 100);
    const bajo = conDatos.filter(s=>s.protDia < 100);
    if(alto.length && bajo.length){
      const prom = a => +(a.reduce((s,x)=>s+x.dSMM,0)/a.length).toFixed(2);
      insight = `<div class="ing-insight">
        En las semanas con <strong>100 g o más</strong> de proteína al día tu músculo
        cambió <strong>${prom(alto)>0?'+':''}${prom(alto)} kg</strong> en promedio;
        en las de menos, <strong>${prom(bajo)>0?'+':''}${prom(bajo)} kg</strong>.
        <span class="ing-caveat">Con ${conDatos.length} semanas esto es apenas una señal,
        no una conclusión — y hay muchas otras cosas influyendo.</span></div>`;
    }
  }

  cont.innerHTML = `
    <div class="tbl-section" style="margin-top:20px">Semana a semana</div>
    ${insight}
    <div class="table-scroll"><table>
      <thead><tr><th>Semana</th><th>Proteína</th><th>An/Veg</th><th>Batidos</th>
        <th>Agua</th><th>Creatina</th><th>Δ Grasa</th><th>Δ Músculo</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    <div class="ing-caveat" style="margin-top:9px">Δ compara la medición de esa semana
      con la anterior disponible. Las semanas sin medición muestran guion.</div>`;
}

