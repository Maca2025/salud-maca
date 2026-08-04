/* ════════════════════════════════════════════════════════════
   REGISTRO DE INGESTA Y CORRELACIÓN CON LA COMPOSICIÓN
   La pregunta que responde: ¿lo que como sostiene mi músculo?
   ════════════════════════════════════════════════════════════ */
function ingestaDe(iso){
  return INGESTA.find(x=>x.fecha===iso) || null;
}

/* La creatina es un suplemento: se marca en el Protocolo como todo lo demas y
   se cuenta desde el historial del tracker. Si todavia no existe la fila con
   id "creatina" en la hoja de suplementos, no se ensena la metrica en vez de
   ensenar un cero falso. */
function creatinaEnProtocolo(){
  return typeof supById === 'function' && !!supById('creatina');
}
function creatinaEn(iso){
  const h = (typeof HIST !== 'undefined' ? HIST : []).find(d=>d.fecha===iso);
  return !!(h && h.tomas && h.tomas.creatina);
}

let _itemsHoy = [];      // [{alimento, g, origen, prot, kcal}]

/* El agua NO se guarda en una variable de esta pantalla. Se lee siempre de
   INGESTA, que es lo que la hoja tiene. Antes se hidrataba una sola vez al dia
   y los vasos marcados despues desde Hoy no se veian aqui — y peor: "Guardar
   dia" mandaba el valor viejo y los borraba. */
function aguaLog(){
  const d = ingestaDe(hoyISO());
  return d ? (d.agua || 0) : 0;
}
let _fechaLog  = null;   // fecha del borrador cargado en memoria
/* 'ok' | 'pend' | 'guardando' | 'error'. Sustituye al viejo _sinGuardar: ahora
   la comida se guarda sola al tocarla, igual que el agua y los suplementos. */
let _estadoLog = 'ok';
let _timerLog  = null;
let _comprobado = null;  // fecha para la que ya se comprobo contra la hoja
const ING_KEY  = 'maca-ingesta-borrador';

/* El borrador vive en el navegador para que recargar no borre lo que
   llevas sin guardar. iOS cierra pestañas en segundo plano con facilidad. */
/* Antes esto solo marcaba "sin guardar" y esperaba al boton. Ahora programa el
   guardado. El borrador local se mantiene como red por si falla la escritura o
   se cierra la pestana antes de que salga.
   Va con retardo de 900 ms a proposito: sumar cuatro alimentos seguidos escribe
   UNA vez, no cuatro. La comida no se puede mandar en modo merge como los
   suplementos —guardarIngesta reemplaza el dia entero— asi que cada escritura
   cuesta, y conviene no encadenarlas. */
function marcarCambio(){
  guardarBorradorLog();
  _estadoLog = 'pend';
  pintarEstadoLog();
  clearTimeout(_timerLog);
  _timerLog = setTimeout(guardarLog, 900);
}

function pintarEstadoLog(){
  const el = document.getElementById('log-estado');
  if(!el) return;
  /* Solo el simbolo, sin texto: vive en la esquina de la tarjeta de proteina.
     El titulo si lleva la palabra, para quien use lector de pantalla.
     estilos.css tiene .log-estado.ok y .pend, pero no .err: el rojo va en
     linea para no tener que tocar la hoja de estilos. */
  const mapa = {
    ok:        ['ok',   '✓', 'Guardado'],
    pend:      ['pend', '●', 'Sin guardar'],
    guardando: ['pend', '⋯', 'Guardando'],
    error:     ['pend', '✗', 'No se guardó. Toca para reintentar'],
  };
  const [cls, simbolo, titulo] = mapa[_estadoLog] || mapa.ok;
  const malo = _estadoLog === 'error';
  el.className = 'log-estado ' + cls;
  el.textContent = simbolo;
  el.title = titulo;
  el.setAttribute('aria-label', titulo);
  el.style.color = malo ? '#c0392b' : '';
  el.style.cursor = malo ? 'pointer' : '';
  el.onclick = malo ? guardarLog : null;
}

function guardarBorradorLog(){
  try {
    localStorage.setItem(ING_KEY, JSON.stringify({
      fecha: hoyISO(),
      items: _itemsHoy.map(it=>({a:it.alimento, g:it.g, gr:it.grupo}))
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
/* Cada cosa registrada puede llevar delante la etiqueta del batido del que
   salio: "#B1@0815 Dragon Whey proteína 30.5". Sin etiqueta es comida suelta,
   que es como esta TODO lo registrado hasta ahora: el formato viejo sigue
   leyendose igual y no hay que migrar nada. */
const RE_GRUPO = /^(#B\d+@\d{4})\s+/;

function parseDetalle(txt){
  return String(txt||'').split('|').map(s=>s.trim()).filter(Boolean).map(s=>{
    let grupo = null;
    const mg = s.match(RE_GRUPO);
    if(mg){ grupo = mg[1]; s = s.slice(mg[0].length); }
    const m = s.match(/^(.*?)\s+([\d.]+)$/);
    const nombre = m ? m[1].trim() : s;
    const g = m ? parseFloat(m[2]) : 0;
    return itemDe(nombre, g, grupo);
  }).filter(Boolean);
}

function serializarDetalle(items){
  return items.map(it =>
    `${it.grupo ? it.grupo + ' ' : ''}${it.alimento} ${it.g}`).join('|');
}

/* Agrupa lo registrado hoy por batido. Devuelve [{tag, n, hora, items, prot, kcal}] */
function batidosDeHoy(){
  const mapa = new Map();
  _itemsHoy.forEach(it=>{
    if(!it.grupo) return;
    if(!mapa.has(it.grupo)) mapa.set(it.grupo, []);
    mapa.get(it.grupo).push(it);
  });
  return [...mapa.entries()].map(([tag, items])=>{
    const m = tag.match(/^#B(\d+)@(\d{2})(\d{2})$/) || [];
    return {tag, n: +(m[1]||0), hora: m[2] ? `${m[2]}:${m[3]}` : '',
      items,
      prot: Math.round(items.reduce((s,x)=>s+x.prot,0)),
      kcal: Math.round(items.reduce((s,x)=>s+x.kcal,0))};
  }).sort((a,b)=>a.n-b.n);
}

/* ════════════════════════════════════════════════════════════
   EL BATIDO
   ------------------------------------------------------------
   Tres ingredientes del batido no estan —ni deben estar— en la tabla de
   alimentos: la creatina y el myo-inositol son suplementos del Protocolo y el
   cafe no aporta nada. Pero SI tienen que poder guardarse y volver a leerse,
   o al recargar la pagina el batido perderia la mitad de su composicion.
   Por eso viven aqui, con macros por 100 g como el resto, y itemDe los
   consulta cuando buscarAlimento no encuentra nada.
   Los valores: creatina 0 kcal · myo-inositol ~400 kcal/100 g (4 g = 16 kcal)
   · cafe solo ~1 kcal/100 ml. A su escala son ruido, pero se cuentan. */
const EXTRAS_BATIDO = {
  'creatina':     {alimento:'Creatina',     kcal:0,   prot:0, origen:''},
  'myo-inositol': {alimento:'Myo-inositol', kcal:400, prot:0, origen:''},
  'cafe':         {alimento:'Café',         kcal:1,   prot:0, origen:''},
  'café':         {alimento:'Café',         kcal:1,   prot:0, origen:''},
};
function extraBatido(nombre){
  return EXTRAS_BATIDO[normalizar ? normalizar(nombre) : String(nombre).toLowerCase()]
      || EXTRAS_BATIDO[String(nombre).toLowerCase()] || null;
}

function itemDe(nombre, g, grupo){
  const a = buscarAlimento(nombre) || extraBatido(nombre);
  const f = g/100;
  return {
    alimento: a ? a.alimento : nombre,
    g,
    origen: a ? (a.origen||'') : '',
    prot: a ? +((a.prot||0)*f).toFixed(1) : 0,
    kcal: a ? Math.round((a.kcal||0)*f) : 0,
    desconocido: !a,
    grupo: grupo || null,   // '#B1@0815' si vino de un batido
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

/* Carga lo del dia UNA vez. Antes vivia dentro de renderIngestaHoy, pero la
   tarjeta del batido escribe desde la pantalla Hoy sin haber abierto nunca la
   pestana de ingesta: sin esto, _itemsHoy estaria vacio y guardar el batido
   BORRARIA la comida del dia. */
function asegurarLogDeHoy(){
  if(_fechaLog === hoyISO()) return;
  _fechaLog = hoyISO();
  const y = ingestaDe(hoyISO());
  const b = leerBorradorLog();
  _itemsHoy = [];
  // Base: lo que ya está en la hoja
  if(y && y.detalle) {
    _itemsHoy = parseDetalle(y.detalle);
    _estadoLog = 'ok';            // lo que vino de la hoja ya está guardado
  }
  // Encima, el borrador local si trae más cosas (quedó sin guardar)
  if(b && b.items && b.items.length > _itemsHoy.length){
    _itemsHoy = b.items.map(x=>itemDe(x.a, x.g, x.gr));
    _estadoLog = 'pend';          // el borrador traía cosas sin guardar
  }
}

function renderIngestaHoy(){
  const cont = document.getElementById('ingesta-hoy');
  if(!cont) return;
  asegurarLogDeHoy();
  const t = totalesHoy();
  const aguaMl = aguaLog();
  const vasos = Math.round(aguaMl/250);

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
      <div class="log-acciones">
        <button class="acc-btn" onclick="dictarComida()" id="btn-dictar">🎤 Dictar</button>
        <button class="acc-btn" onclick="fotoComida()">📷 Foto</button>
        <button class="acc-btn" onclick="verComidasPlan()">🍽️ Del plan</button>
      </div>

      <div class="log-chips">${chips}</div>

      <div class="log-lista">${lista}</div>

      <div class="log-extras">
        <div class="agua-box">
          <div class="agua-lbl">💧 Agua <strong>${(aguaMl/1000).toFixed(2)} L</strong></div>
          <div class="agua-vasos">
            ${Array.from({length:10},(_,k)=>`
              <button class="vaso ${k<vasos?'lleno':''}" onclick="setAgua(${(k+1)*250})"
                aria-label="${k+1} vasos"></button>`).join('')}
          </div>
        </div>
      </div>

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
/* Guarda en el acto, igual que tocarVaso en Hoy: el agua es el unico dato de
   esta pantalla que se escribe solo. Manda unicamente {fecha, agua}, y
   guardarIngesta conserva lo que no se le envia, asi que no pisa la comida. */
async function setAgua(ml){
  const actual = aguaLog();
  let nuevo = (actual === ml) ? ml-250 : ml;   // volver a tocar el mismo vaso lo quita
  if(nuevo < 0) nuevo = 0;
  const caja = document.querySelector('#ingesta-hoy .agua-box');
  if(caja) caja.style.opacity = '.5';
  try {
    await api({action:'guardarIngesta', fecha:hoyISO(), agua:nuevo});
    let d = ingestaDe(hoyISO());
    if(!d){ d = {fecha:hoyISO(), prot_animal:0, prot_vegetal:0, agua:0}; INGESTA.push(d); }
    d.agua = nuevo;
    renderIngestaHoy();
    if(typeof renderHoy === 'function') renderHoy();
    renderIngestaResumen(); renderIngestaTabla();
  } catch(e){
    if(caja) caja.style.opacity = '1';
    alert('No se pudo guardar el agua: ' + e.message);
  }
}

/* ════════════════════════════════════════════════════════════
   TARJETA DEL BATIDO
   ------------------------------------------------------------
   Un batido puede llevar de todo y cambiar cada vez, asi que en vez de un
   alimento fijo se marca lo que lleva y la app calcula. Escribe en DOS sitios
   de un solo toque:
     - polvo, leche, fruta, agua y cafe -> el registro de comida del dia;
     - creatina e inositol -> el tracker del Protocolo, en modo merge.
   Asi no hay doble captura, que es justo lo que se queria evitar.

   El AGUA del batido NO suma un vaso al conteo de hidratacion: los vasos los
   marca ella. Se guarda como ingrediente (0 kcal) solo para saber como estaba
   preparado. Decision suya, 3-ago.
   ════════════════════════════════════════════════════════════ */
const BATIDO_ING = [
  {k:'polvo',    label:'Polvo de proteína', alimento:'Dragon Whey proteína', g:30.5, paso:15.25, unidad:'medida'},
  {k:'creatina', label:'Creatina',          alimento:'Creatina',     g:5,   paso:5,   unidad:'g', sup:'creatina'},
  {k:'inositol', label:'Myo-inositol',      alimento:'Myo-inositol', g:4,   paso:4,   unidad:'g', sup:'inositol'},
  {k:'leche',    label:'Leche',             alimento:'Leche semidescremada', g:240, paso:120, unidad:'ml'},
  {k:'agua',     label:'Agua',              alimento:'Agua',         g:250, paso:250, unidad:'ml'},
  {k:'cafe',     label:'Café',              alimento:'Café',         g:240, paso:120, unidad:'ml'},
];
const BATIDO_FRUTAS = ['Plátano','Fresas','Mora azul','Manzana'];

/* En linea a proposito: son cinco piezas de un solo formulario y asi el
   despliegue no arrastra estilos.css. Si algun dia hacen falta en mas sitios,
   se mudan a la hoja. */
const BAT_CSS = {
  fila:  'display:flex;align-items:center;gap:8px;padding:9px 2px;border-bottom:1px solid #f0f0ed',
  cant:  'display:flex;align-items:center;gap:7px;font-size:.78rem;color:#666;white-space:nowrap',
  paso:  'width:24px;height:24px;border-radius:7px;border:1px solid #e0e0dd;background:#fff;font-size:.9rem;line-height:1;color:#1b4332',
  frutas:'display:flex;gap:6px;flex-wrap:wrap;padding:2px 0 9px 26px',
  fruta: 'font-size:.76rem;padding:4px 11px;border-radius:13px;border:1px solid #e8e8e6;background:#fff;color:#666',
  frutaOn:'font-size:.76rem;padding:4px 11px;border-radius:13px;border:1px solid #86efac;background:#f0fdf4;color:#15803d;font-weight:700',
};

let _bat = null;   // seleccion del formulario abierto

function abrirFormBatido(){
  asegurarLogDeHoy();
  _bat = {polvo:true, creatina:false, inositol:false, leche:false,
          agua:false, cafe:false, fruta:null, g:{}};
  BATIDO_ING.forEach(i=>{ _bat.g[i.k] = i.g; });
  pintarFormBatido();
}

function togBatido(k){
  _bat[k] = !_bat[k];
  pintarFormBatido();
}
function ajustarBatido(k, signo){
  const ing = BATIDO_ING.find(i=>i.k===k);
  if(!ing) return;
  _bat.g[k] = Math.max(ing.paso, +(_bat.g[k] + signo*ing.paso).toFixed(2));
  pintarFormBatido();
}
function ponerFruta(nombre){
  _bat.fruta = (_bat.fruta === nombre) ? null : nombre;
  pintarFormBatido();
}

/* Los items que produciria la seleccion actual, sin escribir nada. */
function itemsDelBatido(sel){
  const out = [];
  BATIDO_ING.forEach(i=>{
    if(sel[i.k]) out.push(itemDe(i.alimento, sel.g[i.k]));
  });
  if(sel.fruta){
    const a = buscarAlimento(sel.fruta);
    out.push(itemDe(sel.fruta, a ? a.porcion : 100));
  }
  return out;
}

function pintarFormBatido(){
  const items = itemsDelBatido(_bat);
  const prot = Math.round(items.reduce((s,x)=>s+x.prot,0));
  const kcal = Math.round(items.reduce((s,x)=>s+x.kcal,0));
  const sups = BATIDO_ING.filter(i=>i.sup && _bat[i.k]).map(i=>i.label);

  const filas = BATIDO_ING.map(i=>{
    const on = !!_bat[i.k];
    const cant = i.k==='polvo'
      ? `${+(_bat.g[i.k]/30.5).toFixed(2)} ${i.unidad}${_bat.g[i.k]>30.5?'s':''}`
      : `${_bat.g[i.k]} ${i.unidad}`;
    return `<div style="${BAT_CSS.fila}">
      <label class="ing-check" style="flex:1;margin:0">
        <input type="checkbox" ${on?'checked':''} onchange="togBatido('${i.k}')">
        <span>${esc(i.label)}</span>
      </label>
      ${on ? `<span style="${BAT_CSS.cant}">
        <button style="${BAT_CSS.paso}" onclick="ajustarBatido('${i.k}',-1)" aria-label="Menos">−</button>
        ${esc(cant)}
        <button style="${BAT_CSS.paso}" onclick="ajustarBatido('${i.k}',1)" aria-label="Más">+</button>
      </span>` : ''}
    </div>`;
  }).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal" style="max-width:430px">
      <div class="blk-modal-hdr"><span>🥤 Preparar batido</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        ${filas}
        <div style="${BAT_CSS.fila};border-bottom:none">
          <label class="ing-check" style="flex:1;margin:0">
            <input type="checkbox" ${_bat.fruta?'checked':''}
              onchange="ponerFruta(this.checked ? '${esc(BATIDO_FRUTAS[0])}' : null)">
            <span>Fruta</span>
          </label>
        </div>
        ${_bat.fruta ? `<div style="${BAT_CSS.frutas}">${BATIDO_FRUTAS.map(f=>
          `<button style="${f===_bat.fruta?BAT_CSS.frutaOn:BAT_CSS.fruta}"
            onclick="ponerFruta('${esc(f)}')">${esc(f)}</button>`).join('')}</div>` : ''}

        <div class="lt-sub" style="justify-content:flex-start;margin-top:14px">
          <span class="lt-an">${prot} g proteína</span>
          <span class="lt-kc">${kcal} kcal</span>
          ${sups.length ? `<span class="lt-ve">${esc(sups.join(' y '))} al Protocolo</span>` : ''}
        </div>
        <div id="bat-msg"></div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="bat-guardar" onclick="guardarBatido()"
          ${items.length ? '' : 'disabled'}>Añadir al día</button>
      </div>
    </div>
  </div>`;
}

async function guardarBatido(){
  const items = itemsDelBatido(_bat);
  if(!items.length) return;
  const btn = document.getElementById('bat-guardar');
  if(btn){ btn.disabled = true; btn.textContent = 'Añadiendo…'; }

  asegurarLogDeHoy();
  /* El numero del batido sale del mayor que ya haya hoy, no del total: si
     borra el primero, el segundo sigue siendo el 2 y no se solapan. */
  const previos = batidosDeHoy();
  const n = previos.length ? Math.max(...previos.map(b=>b.n)) + 1 : 1;
  const tag = `#B${n}@${horaAhora().replace(':','')}`;
  items.forEach(it => { it.grupo = tag; _itemsHoy.push(it); });
  marcarCambio();          // guarda el dia solo, con el retardo de siempre
  renderIngestaHoy();

  /* Los suplementos van aparte, en merge: solo suman y nunca borran. */
  const ids = BATIDO_ING.filter(i=>i.sup && _bat[i.k]).map(i=>i.sup);
  if(ids.length){
    try {
      await api({action:'save', fecha:hoyISO(), hora:horaAhora(),
                 tomados:ids.join(','), todos:ids.join(','), modo:'merge'});
      let d = (HIST || []).find(h => h.fecha === hoyISO());
      if(!d){ d = {fecha:hoyISO(), hora:horaAhora(), tomas:{}, nota:''}; HIST.unshift(d); }
      ids.forEach(id => { d.tomas[id] = true; });
    } catch(e){
      alert('El batido se guardó, pero no se pudo marcar en el Protocolo: ' + e.message +
            '\n\nMárcalo a mano en Suplementos.');
    }
  }

  cerrarForm();
  if(typeof renderHoy === 'function') renderHoy();
  renderIngestaResumen();
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

/* Guarda la comida del dia. Ya no hay boton: lo dispara marcarCambio con
   retardo, igual que el agua y los suplementos se guardan al tocarlos.

   LA COMPROBACION CONTRA LA HOJA VA UNA VEZ POR DIA, NO EN CADA ESCRITURA.
   Existe porque guardarIngesta REEMPLAZA el dia entero: si otro dispositivo
   registro algo que aqui no esta, se perderia. El riesgo real es abrir esta
   pantalla con datos viejos, y eso se cubre comprobando la primera vez que se
   escribe hoy. Un confirm en cada toque seria inusable. */
async function guardarLog(){
  clearTimeout(_timerLog);
  if(_estadoLog === 'guardando'){ _estadoLog = 'pend'; return; }
  _estadoLog = 'guardando';
  pintarEstadoLog();

  if(_comprobado !== hoyISO()){
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
            guardarBorradorLog();
            renderIngestaHoy();
          }
        }
      }
      INGESTA = d.ingesta || INGESTA;
      _comprobado = hoyISO();
    } catch(e){
      /* Sin conexion no se puede comprobar: se escribe igual y se reintenta la
         comprobacion la proxima vez. El borrador local sigue de red. */
    }
  }

  const t = totalesHoy();
  const detalle = serializarDetalle(_itemsHoy);

  // Sin `agua`: la escribe setAgua en el acto y guardarIngesta conserva lo que
  // no se le manda. Mandarla desde aqui era lo que borraba los vasos de Hoy.
  const datos = {action:'guardarIngesta', fecha: hoyISO(),
    prot_animal:t.pa, prot_vegetal:t.pv, shakes:t.shakes, kcal:t.kcal, detalle};

  try {
    await api(datos);
    const i = INGESTA.findIndex(x=>x.fecha===datos.fecha);
    const fila = {fecha:datos.fecha, nota:'', detalle,
      prot_animal:t.pa, prot_vegetal:t.pv, shakes:t.shakes,
      agua:aguaLog(), creatina:(ingestaDe(datos.fecha)||{}).creatina||0, kcal:t.kcal};
    if(i>=0) INGESTA[i] = fila; else INGESTA.push(fila);
    INGESTA.sort((a,b)=>a.fecha.localeCompare(b.fecha));
    limpiarBorradorLog();
    /* Si llegaron cambios mientras se escribia, se vuelve a programar. */
    const habiaMas = _estadoLog === 'pend';
    _estadoLog = habiaMas ? 'pend' : 'ok';
    pintarEstadoLog();
    if(habiaMas){ _timerLog = setTimeout(guardarLog, 900); return; }
    renderIngestaResumen(); renderIngestaTabla(); initGraficaIngesta();
    if(typeof renderHoy === 'function') renderHoy();
  } catch(e){
    _estadoLog = 'error';
    pintarEstadoLog();
  }
}

/* El boton ya no existe; el nombre viejo se conserva como alias. */
function guardarIngestaHoy(){ return guardarLog(); }

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
    s.shakes += x.shakes; s.agua += x.agua; s.creatina += creatinaEn(x.fecha) ? 1 : 0;
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

/* Las tarjetas dicen si el numero es bueno o malo. Mismo lenguaje de tres
   tramos que la tarjeta de masa magra en Composicion: rojo bajo el suelo,
   ambar cerca, verde dentro. Un numero sin juicio no sirve de nada: 0.68 g/kg
   se leia igual de neutro que "2/3 dias con creatina", y es la cifra de la que
   depende el suelo de masa magra.
   protObjetivo, VASO_ML y VASOS_DIA viven en app-tracker.js, que carga
   DESPUES: de ahi las guardas con typeof. */
function metaProteina(){
  return (typeof protObjetivo === 'function') ? protObjetivo() : null;
}
function metaAguaMl(){
  return (typeof VASO_ML === 'number' && typeof VASOS_DIA === 'number')
    ? VASO_ML * VASOS_DIA : 2000;
}
function posEnEscala(v, tope){
  if(!tope) return 1;
  return Math.max(1, Math.min(99, +(v / tope * 100).toFixed(1)));
}

/* UNA sola definicion para las dos pantallas: Ingesta y Hoy pintan estas
   mismas tarjetas. Reciben el valor ya calculado porque cada pantalla tiene el
   suyo — en Ingesta cuenta lo que hay en pantalla sin guardar, en Hoy lo que
   ya esta en la hoja. `pie` y `extra` los pone quien la llama.
   Vive en app-ingesta.js, que carga ANTES que app-tracker.js: desde alli se
   llama en tiempo de ejecucion, con la guarda de typeof. */
/* El rango de kcal que prescriben SUS planes, calculado de la misma tabla de
   alimentos que usa todo lo demas. No esta escrito a mano en ningun sitio: si
   sube un plan nuevo desde la app, el rango se mueve solo.
   Con los planes de marzo y abril salen 1103-1330 kcal al dia. */
/* Un ingrediente de receta llega de DOS formas segun cuando se mire: como
   texto crudo de la hoja ("Huevo entero 2 piezas 100 g") o ya convertido en
   {nombre, g} por recalcularTodasLasRecetas. sumarReceta, en este mismo
   archivo, asume la segunda. Aqui se aceptan las dos, que era justo lo que
   dejaba el rango vacio. */
function kcalDeIngrediente(ing){
  if(ing && typeof ing === 'object'){
    const g = ing.g || 0;
    if(!g || !ing.nombre) return 0;
    const it = itemDe(ing.nombre, g);
    return it ? (it.kcal || 0) : 0;
  }
  if(typeof macrosIngrediente === 'function'){
    const m = macrosIngrediente(ing);
    if(m && m.kcal) return m.kcal;
  }
  /* Ultimo recurso: el mismo formato que usa parseDetalle, nombre + gramos. */
  const s = String(ing || '').trim();
  const m2 = s.match(/^(.*?)\s+([\d.]+)\s*(?:g|ml)?$/);
  if(!m2) return 0;
  const it = itemDe(m2[1].replace(/\s*(\d+[½⅓¼⅔.]*|[½⅓¼⅔])\s*\S*$/,'').trim(), parseFloat(m2[2]));
  return it ? (it.kcal || 0) : 0;
}

function rangoPlanKcal(){
  if(typeof PLANES !== 'object' || !PLANES) return null;
  if(typeof RECETAS !== 'object' || !RECETAS) return null;
  const dias = [];
  Object.keys(PLANES).forEach(nombre => {
    (PLANES[nombre] || []).forEach(fila => {
      let kc = 0;
      ['desayuno','comida','colacion','cena'].forEach(c => {
        const r = RECETAS[fila[c]];
        if(!r) return;
        (r.ingredientes || []).forEach(ing => { kc += kcalDeIngrediente(ing); });
      });
      if(kc > 0) dias.push(Math.round(kc));
    });
  });
  if(dias.length < 2) return null;
  return {min: Math.min(...dias), max: Math.max(...dias)};
}

/* Los mismos chips que habia sueltos debajo del registro, ahora dentro de la
   tarjeta. Las clases lt-an / lt-ve / lt-kc ya existen en estilos.css.

   EL DE KCAL NO ES UN TOPE, ES UN RANGO. Y solo se colorea POR ARRIBA, nunca
   por abajo: a media mañana siempre vas por debajo del plan porque todavia no
   has comido, asi que pintarlo de rojo seria mentir. Pasarse, en cambio, es
   pasarse a cualquier hora.
   El riesgo medido de Maca es quedarse corta, no excederse: 68 g de proteina
   de media contra un suelo de 118, y entre el 28 y el 39 % de lo perdido en
   masa magra. Por eso esto informa y no persigue. */
function chipsProteina(pa, pv, kcal){
  const r = rangoPlanKcal();
  let chipK = `<span class="lt-kc">${kcal} kcal</span>`;
  if(r){
    const alto = kcal > r.max;
    chipK = `<span class="lt-kc"${alto ? ' style="background:#fef3c7;color:#b45309"' : ''}
      title="Tu plan va de ${r.min} a ${r.max} kcal al día">${kcal} kcal<span
      style="opacity:.6"> · plan ${r.min}–${r.max}</span></span>`;
  }
  return `<div class="lt-sub" style="justify-content:flex-start;margin-top:0">
    <span class="lt-an">${pa} animal</span>
    <span class="lt-ve">${pv} vegetal</span>
    ${chipK}
  </div>`;
}

function tarjetaProteina(o){
  const prot = o.prot, obj = o.obj;
  if(!obj){
    return `<div class="pc-card">
      <div class="pc-label">Proteina ${o.periodo ? '<span class="pc-sub">&middot; '+o.periodo+'</span>' : ''}</div>
      <div class="pc-fila"><span class="pc-num">${prot}</span><span class="pc-uni">g</span></div>
      <div class="pc-pie">Hace falta una medicion de peso para saber tu objetivo.</div>
      ${o.extra || ''}
    </div>`;
  }
  const alerta = Math.round(obj.min * 0.75);
  const estado = prot < alerta ? 'mal' : (prot < obj.min ? 'ojo' : 'bien');
  const chip = prot < obj.min ? `faltan ${obj.min - prot} g`
             : (prot > obj.max ? 'por encima del rango' : 'en rango');
  /* El visto de guardado va aqui, en la esquina de la tarjeta, sin texto.
     Lo actualiza pintarEstadoLog sin repintar la tarjeta entera. */
  const visto = o.estado
    ? '<span id="log-estado" class="log-estado ok" style="float:right;margin:0"></span>' : '';
  return `
  <div class="pc-card">
    <div class="pc-label">${visto}Proteina <span class="pc-sub">&middot; ${o.periodo || 'hoy'} &middot; suelo ${obj.min} g</span></div>
    <div class="pc-fila">
      <span class="pc-num">${prot}</span><span class="pc-uni">g</span>
      <span class="pc-chip ${estado}">${chip}</span>
    </div>
    <div class="pc-tramos">
      <i class="t-mal" style="flex:${alerta}"></i>
      <i class="t-ojo" style="flex:${obj.min - alerta}"></i>
      <i class="t-bien" style="flex:${Math.max(1, obj.max - obj.min)}"></i>
      <b style="left:${posEnEscala(prot, obj.max)}%"></b>
    </div>
    <div class="pc-pie">${o.pie || ''}</div>
    ${o.extra || ''}
  </div>`;
}

function tarjetaAgua(o){
  const agua = o.agua, meta = metaAguaMl();
  const estado = agua < meta*0.5 ? 'mal' : (agua < meta ? 'ojo' : 'bien');
  const falta = Math.max(0, meta - agua);
  const chip = agua >= meta ? 'meta cubierta' : `${(falta/1000).toFixed(1)} L por debajo`;
  return `
  <div class="pc-card">
    <div class="pc-label">Agua <span class="pc-sub">&middot; ${o.periodo || 'hoy'} &middot; meta ${(meta/1000).toFixed(1)} L</span></div>
    <div class="pc-fila">
      <span class="pc-num">${(agua/1000).toFixed(2)}</span><span class="pc-uni">L</span>
      <span class="pc-chip ${estado}">${chip}</span>
    </div>
    <div class="pc-tramos">
      <i class="t-mal" style="flex:50"></i>
      <i class="t-ojo" style="flex:50"></i>
      <i class="t-bien" style="flex:25"></i>
      <b style="left:${posEnEscala(agua, meta*1.25)}%"></b>
    </div>
    <div class="pc-pie">${o.pie || ''}</div>
    ${o.extra || ''}
  </div>`;
}

function renderIngestaResumen(){
  const cont = document.getElementById('ingesta-resumen');
  if(!cont) return;

  const obj = metaProteina();
  const peso = DATA.length ? DATA[DATA.length-1].peso : null;

  /* HOY, no el promedio. En esta pantalla cuenta lo que hay en la lista aunque
     no se haya guardado: es lo que ella acaba de anotar. */
  const th = (typeof totalesHoy === 'function') ? totalesHoy() : {pa:0,pv:0,kcal:0};
  const protHoy = th.pa + th.pv;
  const aguaHoy = aguaLog();
  const chips = chipsProteina(th.pa, th.pv, th.kcal);

  /* El promedio sigue siendo util, pero como contexto en el pie, no como
     titular: mezclar los dos periodos sin decirlo fue lo que confundio. */
  const ult7 = INGESTA.slice(-7);
  let pieProt = chips;
  let pieAgua = 'Se guarda sola al tocar un vaso.';
  if(ult7.length){
    const prom = k => Math.round(ult7.reduce((s,x)=>s+(x[k]||0),0)/ult7.length);
    const pProm = prom('prot_animal') + prom('prot_vegetal');
    const dias = `${ult7.length} ${ult7.length===1?'dia':'dias'}`;
    pieProt += `<div style="margin-top:5px">Promedio de ${dias}: ${pProm} g`;
    if(peso) pieProt += ` (${(pProm/peso).toFixed(2)} g/kg)`;
    pieProt += '</div>';
    pieAgua += `<br>Promedio de ${dias}: ${(prom('agua')/1000).toFixed(2)} L`;
  }

  const conCrea = ult7.map(x=>x.fecha).filter(creatinaEn).length;
  const crea = (creatinaEnProtocolo() && ult7.length)
    ? `<div class="ing-stats" style="margin-top:10px">
         <div class="ing-stat"><strong>${conCrea}/${ult7.length}</strong><span>dias con creatina</span></div>
       </div>` : '';

  cont.innerHTML = `
    <div class="pc-grid">
      ${tarjetaProteina({prot:protHoy, obj, peso, periodo:'hoy', pie:pieProt, estado:true})}
      ${tarjetaAgua({agua:aguaHoy, periodo:'hoy', pie:pieAgua})}
    </div>
    ${crea}`;
  pintarEstadoLog();
}

/* UN SOLO EJE, y por DIA. Antes iba proteina a la izquierda y musculo a la
   derecha: con dos escalas elegidas a mano, "van juntas" lo decide el eje y no
   el dato. El musculo se lee en la columna delta de la tabla.
   Una barra por dia y una sola marca horizontal: el suelo. Lo unico que hay
   que leer de un vistazo es que dias lo pasan y cuales no.
   Los dias sin registrar van en null, NO en cero: no anotar no es lo mismo que
   no comer, igual que la celda vacia del tracker de suplementos.
   p2() vive en app-suplementos.js, que carga antes. */
const DIAS_GRAFICA = 35;

/* EL UMBRAL SE DIBUJA A MANO, NO COMO DATASET.
   Con el eje Y en `stacked`, Chart.js apila TAMBIEN las lineas sobre las
   barras: el suelo de 118 g salia pintado a 224 el dia que habia 106 g de
   barra. Un plugin dibuja encima del area y se salta las escalas apiladas,
   asi que la linea no se puede volver a mover. */
const plugSuelo = {
  id:'suelo',
  afterDatasetsDraw(chart, args, opts){
    const v = opts && opts.valor;
    if(v == null) return;
    const {ctx, chartArea, scales} = chart;
    const y = scales.y.getPixelForValue(v);
    if(y < chartArea.top || y > chartArea.bottom) return;
    ctx.save();
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5,4]);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b91c1c';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`suelo ${v} g`, chartArea.right - 3, y - 3);
    ctx.restore();
  }
};

function lunesISO(iso){
  const d = new Date(iso+'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
}

function diasIngesta(){
  if(!INGESTA.length) return [];
  const orden = [...INGESTA].sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const desde = new Date(orden[0].fecha+'T00:00:00');
  const hasta = new Date(hoyISO()+'T00:00:00');
  if(hasta < desde) return [];

  const fuera = [];
  for(let d = new Date(hasta); d >= desde; d.setDate(d.getDate()-1)){
    const iso = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    const r = INGESTA.find(x=>x.fecha===iso);
    fuera.push({iso,
      protA: r ? (r.prot_animal||0) : null,
      protV: r ? (r.prot_vegetal||0) : null});
    if(fuera.length >= DIAS_GRAFICA) break;
  }
  return fuera.reverse();
}

function initGraficaIngesta(){
  const el = document.getElementById('cIngesta');
  const card = el ? el.closest('.chart-card') : null;
  if(!el) return;
  const dias = diasIngesta();
  const conDato = dias.filter(d=>d.protA != null).length;
  if(conDato < 2){
    if(card) card.style.display = 'none';
    return;
  }
  if(card) card.style.display = '';

  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const etiqueta = d => {
    const f = new Date(d.iso+'T00:00:00');
    return `${f.getDate()} ${MESES[f.getMonth()]}`;
  };
  const obj = metaProteina();
  const datos = [
    {type:'bar', label:'Proteina animal g', data:dias.map(d=>d.protA),
     backgroundColor:'#c98a7a', stack:'p', borderRadius:2},
    {type:'bar', label:'Proteina vegetal g', data:dias.map(d=>d.protV),
     backgroundColor:'#7fb3a0', stack:'p', borderRadius:2},
  ];

  if(chartReg.cIngesta) chartReg.cIngesta.destroy();
  chartReg.cIngesta = new Chart(el, {
    data:{labels:dias.map(etiqueta), datasets:datos},
    plugins:[plugSuelo],
    options:{responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}},
        suelo:{valor: obj ? obj.min : null},
        tooltip:{callbacks:{label:c=>
          c.parsed.y == null ? null : `${c.dataset.label}: ${Math.round(c.parsed.y)} g`}}},
      scales:{
        x:{stacked:true, grid:{display:false},
           ticks:{font:{size:9}, autoSkip:true, maxRotation:0}},
        y:{stacked:true, beginAtZero:true, grid:{color:GRID}, ticks:{font:{size:9}},
           title:{display:true,text:'g proteina/dia',font:{size:9}}},
      }}
  });
}

function renderIngestaTabla(){
  const cont = document.getElementById('ingesta-tabla');
  if(!cont) return;
  const sem = semanasIngesta();
  if(!sem.length){ cont.innerHTML=''; return; }
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const hayCrea = creatinaEnProtocolo();
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
      ${hayCrea ? `<td>${s.creatina}/${s.dias}</td>` : ''}
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
        <th>Agua</th>${hayCrea ? '<th>Creatina</th>' : ''}<th>Δ Grasa</th><th>Δ Músculo</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    <div class="ing-caveat" style="margin-top:9px">Δ compara la medición de esa semana
      con la anterior disponible. Las semanas sin medición muestran guion.</div>`;
}

