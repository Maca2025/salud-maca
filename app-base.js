/* ================================================================
   LOGIC MODULE: HELPERS
   Colores, fábricas de gráficas y utilidades compartidas.
   No es necesario modificar esto al añadir datos.
================================================================ */
const G='#2d6a4f', R='#e74c3c', B='#2980b9', O='#e67e22', P='#8e44ad', GRID='#f0f0ed';
const chartReg = {};

/* ────────────────────────────────────────────────────────────
   ESTADO DE UN SUPLEMENTO
   Columna `estado` de la hoja Protocolo Suplementos:
     activo      → se toma (es también lo que significa la celda vacía,
                   para que las filas viejas no haya que tocarlas)
     pendiente   → decidido pero todavía sin comprar. Se ve en el
                   protocolo, pero no cuenta en adherencia, ni en costo,
                   ni en el progreso del bloque: un producto que no
                   tienes en casa no es un olvido.
     suspendido  → ya no se toma. Se filtra en hidratar() y ni siquiera
                   entra en memoria.
   ──────────────────────────────────────────────────────────── */
function estadoSup(s){
  const e = String((s && s.estado) || '').trim().toLowerCase();
  return e || 'activo';
}
function supPorComprar(s){ return estadoSup(s) === 'pendiente'; }
function supSuspendido(s){ return estadoSup(s) === 'suspendido'; }

/* ────────────────────────────────────────────────────────────
   CERRAR UN MODAL AL TOCAR FUERA, SIN PERDER LO ESCRITO

   El fondo oscuro cierra el formulario cuando se hace clic en él.
   El problema: al seleccionar texto dentro de un campo y soltar el
   ratón fuera del recuadro, el navegador dispara un `click` cuyo
   destino ES el fondo. El formulario se cerraba en mitad de una
   edición y se perdía todo lo escrito. Pasaba justo en los campos
   largos, que son los que más se editan.

   La solución: un clic solo cierra si EMPEZÓ y TERMINÓ en el fondo.
   Si el botón del ratón se apretó dentro del formulario, no cuenta.
   ──────────────────────────────────────────────────────────── */
let _fondoAbajo = false;
function fondoDown(ev, el){ _fondoAbajo = (ev.target === el); }
function fondoClick(ev, el){
  const empezoFuera = _fondoAbajo;
  _fondoAbajo = false;
  if(ev.target === el && empezoFuera) cerrarForm();
}

/* ────────────────────────────────────────────────────────────
   ENVASE Y CONSUMO
   Cuatro campos que la hoja puede o no tener todavía; `editarDato`
   crea la columna la primera vez que se guarda uno.

     unidades   piezas que trae el envase
     por_toma   piezas que te tragas cada vez que marcas la casilla
     frecuencia diario / alterno / semanal
     envase_de  id de la fila de la que sale el frasco

   `envase_de` es el que evita contar dos veces: `calcio` y `calcio_noche`
   son filas separadas porque van a horas distintas — esa separación es la
   que protege al hierro — pero salen del mismo bote. Sin este campo, al
   ponerle precio a las dos el total se duplica solo.

   Las columnas llegan de la hoja en snake_case; el cliente ha usado
   camelCase en otras partes. Se aceptan las dos por si acaso.
   ──────────────────────────────────────────────────────────── */
const FACTOR_FREQ = {diario: 1, alterno: 0.5, semanal: 1/7};

function campo_(s, snake, camel){
  const v = (s && (s[snake] != null && s[snake] !== '' ? s[snake] : s[camel]));
  return v == null ? '' : v;
}
function unidadesDe(s){ const n = Number(campo_(s,'unidades','unidades')); return n > 0 ? n : 0; }
function porTomaDe(s){  const n = Number(campo_(s,'por_toma','porToma'));   return n > 0 ? n : 1; }
function frecuenciaDe(s){
  const f = String(campo_(s,'frecuencia','frecuencia')).trim().toLowerCase();
  return FACTOR_FREQ[f] ? f : 'diario';
}
/* id de la fila que tiene el envase. Si no se declara, cada uno es el suyo. */
function envaseDe(s){ return String(campo_(s,'envase_de','envaseDe')).trim() || (s && s.id) || ''; }

/* Piezas al día que consume una fila. */
function piezasDia(s){ return FACTOR_FREQ[frecuenciaDe(s)] * porTomaDe(s); }

/* Agrupa los suplementos que comparten envase. Devuelve Map raiz -> [sups] */
function gruposDeEnvase(lista){
  const g = new Map();
  (lista || []).forEach(s => {
    const raiz = envaseDe(s);
    if(!g.has(raiz)) g.set(raiz, []);
    g.get(raiz).push(s);
  });
  return g;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
function existenciasDe(s){ const n = Number(campo_(s,'existencias','existencias')); return n > 0 ? n : 0; }
function fechaStockDe(s){ const v = String(campo_(s,'fecha_stock','fechaStock')).trim(); return RE_FECHA.test(v) ? v : ''; }
function caducidadDe(s){  const v = String(campo_(s,'caducidad','caducidad')).trim();   return RE_FECHA.test(v) ? v : ''; }

/* Días hasta caducar. Negativo = ya caducó. null = sin fecha. */
function diasParaCaducar(cad, hoy){
  if(!RE_FECHA.test(String(cad||''))) return null;
  return Math.round((new Date(cad+'T00:00:00') - new Date((hoy||hoyISO())+'T00:00:00')) / 86400000);
}

/* ────────────────────────────────────────────────────────────
   CUÁNTO QUEDA DE UN ENVASE

   Se descuenta por lo REGISTRADO, no por lo declarado: si dices
   «diario» pero lo tomas cinco de cada siete días, el bote dura más
   y el cálculo lo refleja solo.

   Lo que el método NO puede saber: un día que tomaste pero no
   marcaste. Ese día no se descuenta y el número va optimista. Por eso
   devuelve `cobertura` — qué porcentaje de los días transcurridos
   tienen registro — y la tarjeta avisa cuando baja del 70 %.

   Con menos de una semana desde el conteo no hay datos suficientes
   para medir el ritmo real, así que se cae a la frecuencia declarada
   y se marca `estimado`.
   ──────────────────────────────────────────────────────────── */
function stockDe(id){
  const s = supById(id); if(!s) return null;
  const raiz  = supById(envaseDe(s)) || s;
  const total = existenciasDe(raiz);
  const desde = fechaStockDe(raiz);
  if(!total || !desde) return null;

  const hoy = hoyISO();
  const raizId = envaseDe(raiz);
  const grupo = supsEnJuego().filter(x => envaseDe(x) === raizId);

  // Un día cuenta una sola vez aunque tenga varios guardados
  const porDia = {};
  (typeof _regEntries !== 'undefined' ? (_regEntries || []) : []).forEach(e => {
    const iso = entryFechaISO(e);
    if(!iso || iso < desde || iso > hoy) return;
    if(!porDia[iso]) porDia[iso] = {};
    const t = entryTomas(e);
    Object.keys(t).forEach(k => { if(t[k]) porDia[iso][k] = true; });
  });
  const diasReg = Object.keys(porDia);

  let consumidas = 0;
  diasReg.forEach(d => grupo.forEach(x => { if(porDia[d][x.id]) consumidas += porTomaDe(x); }));

  const restantes = Math.max(0, total - consumidas);
  const transcurridos = Math.max(1,
    Math.round((new Date(hoy+'T00:00:00') - new Date(desde+'T00:00:00')) / 86400000) + 1);
  const cobertura = Math.min(100, Math.round(diasReg.length / transcurridos * 100));

  let ritmo = transcurridos >= 7 ? consumidas / transcurridos : 0;
  let estimado = false;
  if(!(ritmo > 0)){ ritmo = grupo.reduce((t,x) => t + piezasDia(x), 0); estimado = true; }

  return {
    restantes, total, cobertura, estimado,
    dias: ritmo > 0 ? Math.floor(restantes / ritmo) : null,
    compartido: grupo.length > 1,
    raiz: raiz.id,
    desde
  };
}

/* ────────────────────────────────────────────────────────────
   INVENTARIO

   Un renglón por ENVASE, no por suplemento: si dos filas comparten
   frasco hay un solo bote que contar. Hoy ninguna lo comparte, pero
   `envase_de` sigue aquí para cuando el calcio vuelva a partirse en
   dos tomas — y entonces contarlo dos veces sería peor que no
   contarlo, porque el número saldría al doble y parecería fiable.
   ──────────────────────────────────────────────────────────── */

/* Una cápsula tiene piezas; un líquido tiene mililitros y un polvo,
   porciones. Decir "34 piezas" de la levotiroxina, que es líquida,
   sería sencillamente falso. */
const UNIDAD_FORMATO = {
  'Líquido': ['ml', 'ml'],
  'Polvo':   ['porción', 'porciones'],
};
function unidadTexto(s, n){
  const par = UNIDAD_FORMATO[String((s && s.formato) || '').trim()] || ['pieza', 'piezas'];
  return Math.abs(Number(n)) === 1 ? par[0] : par[1];
}

/* Días hasta lo primero malo que pueda pasar: quedarse sin envase o
   que caduque. Infinity = no hay datos para saberlo. */
function urgenciaInv(f){
  const a = (f.dias    == null) ? Infinity : f.dias;
  const b = (f.diasCad == null) ? Infinity : f.diasCad;
  return Math.min(a, b);
}

function nivelInv(f){
  const u = urgenciaInv(f);
  if(u === Infinity) return 'sindato';
  if(u <  0)  return 'caducado';
  if(u <  7)  return 'rojo';
  if(u < 14)  return 'ambar';
  if(f.diasCad != null && f.diasCad <= 60) return 'ambar';
  return 'ok';
}

/* Un renglón por envase, lo que urge primero arriba. */
function inventario(){
  const filas = [];
  gruposDeEnvase(supsEnJuego()).forEach((sups, raizId) => {
    const raiz = sups.find(x => x.id === raizId) || sups[0];
    const cad  = caducidadDe(raiz);
    const st   = stockDe(raiz.id);
    const f = {
      id: raiz.id, raiz, sups,
      nombre: raiz.sustancia || raiz.id,
      acompanan: sups.filter(x => x.id !== raiz.id).map(x => x.sustancia || x.id),
      total:     unidadesDe(raiz),
      contado:   fechaStockDe(raiz),
      caducidad: cad,
      diasCad:   diasParaCaducar(cad),
      stock:     st,
      dias:      st ? st.dias : null,
      restantes: st ? st.restantes : null,
      sinContar: !st,
      // Lo que duraría tomándolo exactamente como está declarado. Es el
      // número conservador: cuando hay días sin marcar, el cálculo por
      // consumo real se va hacia arriba y este no se mueve. Se enseñan
      // los dos en vez de elegir por ella cuál creer.
      diasDecl: null,
    };
    const ritmoDecl = sups.reduce((tt, x) => tt + piezasDia(x), 0);
    if(st && ritmoDecl > 0) f.diasDecl = Math.floor(st.restantes / ritmoDecl);
    f.nivel = nivelInv(f);
    filas.push(f);
  });
  // Sin el if explícito, Infinity - Infinity daría NaN y el orden
  // de los que no tienen datos quedaría a merced del navegador.
  filas.sort((a, b) => {
    const ua = urgenciaInv(a), ub = urgenciaInv(b);
    if(ua !== ub) return ua < ub ? -1 : 1;
    return String(a.nombre).localeCompare(String(b.nombre), 'es');
  });
  return filas;
}

/* Fecha para el inventario: como el conteo puede ser de hace meses y
   una caducidad puede caer en otro año, `fechaBonita` no sirve — se
   come el año. */
function fechaInv(iso){
  if(!RE_FECHA.test(String(iso || ''))) return '';
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y, m, d] = iso.split('-').map(Number);
  const esteAno = new Date().getFullYear();
  return `${d} ${MESES[m-1]}${y === esteAno ? '' : ' ' + y}`;
}

/* Los suplementos que de verdad entran en los cálculos del día. */
function supsEnJuego(){ return SUPS.filter(s => !supPorComprar(s)); }
function idsEnJuego(ids){ return (ids||[]).filter(id => { const s = supById(id); return s && !supPorComprar(s); }); }

function mkLine(id, datasets, yOpts={}, extraOpts={}) {
  const labels = DATA.map(d=>d.fecha);
  if(chartReg[id]) chartReg[id].destroy();
  chartReg[id] = new Chart(document.getElementById(id), {
    type:'line',
    data:{labels, datasets},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}},
      scales:{
        x:{grid:{color:GRID}, ticks:{font:{size:9}, maxRotation:45}},
        y:{grid:{color:GRID}, ticks:{font:{size:9}}, ...yOpts}
      },
      elements:{point:{radius:3, hoverRadius:5}},
      ...extraOpts
    }
  });
}
function mkLineC(id, lbs, datasets, yOpts={}) {
  if(chartReg[id]) chartReg[id].destroy();
  chartReg[id] = new Chart(document.getElementById(id), {
    type:'line',
    data:{labels:lbs, datasets},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}},
      scales:{
        x:{grid:{color:GRID}, ticks:{font:{size:9}, maxRotation:45}},
        y:{grid:{color:GRID}, ticks:{font:{size:9}}, ...yOpts}
      },
      elements:{point:{radius:3, hoverRadius:5}}
    }
  });
}
function ds(label, data, color, opts={}) {
  return {label, data, borderColor:color, backgroundColor:color+'22', fill:false, tension:0.3, ...opts};
}
function catEmoji(cat) {
  const m = {'proteínas':'🥩','lácteos':'🧀','verduras':'🥦','frutas':'🍓',
    'granos y cereales':'🌾','leguminosas':'🫘','grasas y semillas':'🥑',
    'suplementos':'💊','salsas y condimentos':'🫙'};
  return m[cat]||'🛒';
}
function pDelta(val, dir) {
  if(val===null) return'<td>—</td>';
  const s=val>0?'+':'';
  const cl=(dir==='down'?val<0:val>0)?'d-good':(val===0?'':'d-bad');
  return`<td class="${cl}">${s}${val.toFixed(1)}</td>`;
}


/* ================================================================
   LOGIC MODULE: HOME
   Llena las tarjetas del home con datos calculados desde DATA y SD.
   HOW TO UPDATE: Si añades una sección nueva, agregar su bloque aquí.
================================================================ */
/* Regresión sobre cualquier métrica y sobre cualquier tramo.
   `campo` puede ser 'peso', 'grasa' o 'smm'.
   `desde` limita a las últimas N mediciones (para el ritmo reciente). */
function regresion(campo, desde){
  const idx = desde ? Math.max(0, DATA.length - desde) : 0;
  const sub = DATA.slice(idx), xs = DAYS.slice(idx);
  const n = sub.length;
  if(n < 2) return {slope:0, ratePerWeek:0, valida:false};
  const ys = sub.map(d => d[campo]);
  const sx = xs.reduce((s,x)=>s+x,0), sy = ys.reduce((s,y)=>s+y,0);
  const sxy = xs.reduce((s,x,i)=>s+x*ys[i],0), sxx = xs.reduce((s,x)=>s+x*x,0);
  const den = n*sxx - sx*sx;
  if(!den) return {slope:0, ratePerWeek:0, valida:false};
  const slope = (n*sxy - sx*sy)/den;
  return {slope, intercept:(sy-slope*sx)/n, ratePerWeek:slope*7, valida:true};
}

/* Intervalos donde el peso engañó: se movió poco o subió,
   pero la composición mejoró. */
function detectarRecomposicion(){
  const out = [];
  for(let i=1;i<DATA.length;i++){
    const a=DATA[i-1], b=DATA[i];
    const dP=+(b.peso-a.peso).toFixed(1);
    const dG=+(b.grasa-a.grasa).toFixed(1);
    const dS=+(b.smm-a.smm).toFixed(1);
    if(dP >= -0.6 && (dG <= -0.3 || dS >= 0.2)){
      out.push({de:a.fecha, a:b.fecha, dP, dG, dS});
    }
  }
  return out;
}

function computeRegression() {
  const n=DATA.length, xs=DAYS, ys=DATA.map(d=>d.peso);
  // Con menos de 2 puntos, o si todas las mediciones son del mismo día,
  // no hay pendiente que calcular: se devuelve un resultado "sin proyección"
  // en vez de propagar NaN por toda la interfaz.
  if(n < 2) return {slope:0, intercept:ys[0]||0, ratePerWeek:0, daysToGoal:null, goalDate:null, valida:false};
  const sx=xs.reduce((s,x)=>s+x,0), sy=ys.reduce((s,y)=>s+y,0);
  const sxy=xs.reduce((s,x,i)=>s+x*ys[i],0);
  const sxx=xs.reduce((s,x)=>s+x*x,0);
  const denom=(n*sxx-sx*sx);
  if(!denom) return {slope:0, intercept:sy/n, ratePerWeek:0, daysToGoal:null, goalDate:null, valida:false};
  const slope=(n*sxy-sx*sy)/denom;
  const intercept=(sy-slope*sx)/n;
  const ratePerWeek=slope*7;
  // Si el peso no baja (pendiente >= 0) la meta no se alcanza extrapolando
  if(slope >= 0) return {slope, intercept, ratePerWeek, daysToGoal:null, goalDate:null, valida:false};
  const daysToGoal=(OBJ.peso-intercept)/slope;
  const goalDate=new Date(START_DATE.getTime()+daysToGoal*864e5);
  return {slope, intercept, ratePerWeek, daysToGoal, goalDate, valida:true};
}

function initHome() {
  const first=DATA[0], last=DATA[DATA.length-1];
  const {ratePerWeek, goalDate, valida}=computeRegression();
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const goalStr = valida ? `${MESES[goalDate.getMonth()]}-${goalDate.getFullYear()}` : null;

  // — Composición —
  document.getElementById('hc-comp-sub').textContent=
    `${DATA.length} mediciones · ${first.fecha} – ${last.fecha}${EQUIPO?' · '+EQUIPO:''}`;
  const gRec = regresion('grasa', 6), mRec = regresion('smm', 6);
  const grasaFuera = +(first.grasa - last.grasa).toFixed(1);
  const musculoD   = +(last.smm - first.smm).toFixed(1);
  const pesoFuera  = +(first.peso - last.peso).toFixed(1);
  const calidad    = pesoFuera > 0 ? Math.round(grasaFuera/pesoFuera*100) : null;
  const ritmoG     = Math.abs(gRec.valida ? gRec.ratePerWeek : 0);

  document.getElementById('hc-comp-metrics').innerHTML=`
    <div class="hc-metric"><span class="hc-dot" style="background:#e74c3c"></span>
      Grasa: <strong>${last.grasa} kg</strong> · <strong style="color:#2d6a4f">−${grasaFuera} kg</strong> desde el inicio</div>
    <div class="hc-metric"><span class="hc-dot" style="background:#2980b9"></span>
      Músculo: <strong>${last.smm} kg</strong> · <strong style="color:${musculoD>=0?'#15803d':'#b45309'}">${musculoD>=0?'+':''}${musculoD} kg</strong></div>
    <div class="hc-metric"><span class="hc-dot" style="background:#2d6a4f"></span>
      ${calidad!=null ? `<strong>${calidad}%</strong> de lo perdido fue grasa` : `Peso: ${last.peso} kg`}${
        ritmoG>0.01 ? ` · ${ritmoG.toFixed(2)} kg grasa/sem` : ''}</div>`;

  // — Laboratorio —
  // Tolerante: si un marcador no está en la hoja, se omite en vez de romper.
  const ultimo = k => {
    const a = SD[k];
    if(!Array.isArray(a)) return null;
    for(let i=a.length-1;i>=0;i--) if(a[i]!==null && a[i]!==undefined) return a[i];
    return null;
  };
  const primero = k => {
    const a = SD[k];
    if(!Array.isArray(a)) return null;
    for(let i=0;i<a.length;i++) if(a[i]!==null && a[i]!==undefined) return a[i];
    return null;
  };
  const enRango = k => {
    const v = ultimo(k), r = SR[k];
    if(v===null || !r) return null;
    const [lo,hi] = r;
    return !((lo!==null && lo!==undefined && v<lo) || (hi!==null && hi!==undefined && v>hi));
  };
  document.getElementById('hc-lab-sub').textContent = SFECHAS.length
    ? `${SFECHAS.length} análisis · ${SFECHAS[0]} – ${SFECHAS[SFECHAS.length-1]}`
    : 'Sin análisis cargados';

  const destacados = [
    {k:'tsh',    nom:'TSH',        unidad:'µUI/mL'},
    {k:'vitD',   nom:'Vitamina D', unidad:'ng/mL'},
    {k:'ferrit', nom:'Ferritina',  unidad:'ng/mL'},
    {k:'col',    nom:'Colesterol', unidad:'mg/dL'},
    {k:'hgb',    nom:'Hemoglobina',unidad:'g/dL'},
  ].filter(x => ultimo(x.k) !== null).slice(0,3);

  document.getElementById('hc-lab-metrics').innerHTML = destacados.length
    ? destacados.map(x => {
        const v = ultimo(x.k), ini = primero(x.k), ok = enRango(x.k);
        const color = ok===null ? '#94a3b8' : ok ? '#16a34a' : '#f59e0b';
        const cambio = (ini!==null && ini!==v) ? ` · era ${ini}` : '';
        return `<div class="hc-metric"><span class="hc-dot" style="background:${color}"></span>
          ${x.nom} ${v} ${x.unidad} ${ok===null?'':ok?'✓':'· seguimiento'}${cambio}</div>`;
      }).join('')
    : '<div class="hc-metric"><span class="hc-dot" style="background:#d1d5db"></span>Sin marcadores cargados</div>';

  // — Planes —
  const nP=Object.keys(PLANES).length, nR=Object.keys(RECETAS).length;


  // Suplementos home card
  // La clasificación viene del dato (columna `rx` opcional), no de una
  // lista de nombres escrita en el código.
  const esRx = s => String(s.rx||'').trim()==='1' || Number(s.nivel)===2;
  const nMeds  = SUPS.filter(esRx).length;
  const nSups  = Math.max(0, SUPS.length - nMeds);
  const nBloq  = (typeof BLOQUES!=='undefined' && BLOQUES.length) ? BLOQUES.length : 4;
  document.getElementById('hc-sups-sub').textContent = `${SUPS.length} sustancias · ${nBloq} bloques del día`;
  document.getElementById('hc-sups-metrics').innerHTML=`
    <div class="hc-metric"><span class="hc-dot" style="background:#dc2626"></span>${nMeds} requieren seguimiento médico</div>
    <div class="hc-metric"><span class="hc-dot" style="background:#2d6a4f"></span>${nSups} suplementos</div>
    <div class="hc-metric"><span class="hc-dot" style="background:#2980b9"></span>${INTERACCIONES.length} interacciones documentadas</div>`;
  document.getElementById('hc-plan-sub').textContent=
    `${nP} planes · ${nR} recetas`;
  document.getElementById('hc-plan-metrics').innerHTML=`
    <div class="hc-metric"><span class="hc-dot" style="background:#2d6a4f"></span>
      Planeador semanal con macros por comida</div>
    <div class="hc-metric"><span class="hc-dot" style="background:#f59e0b"></span>
      Recetas con ingredientes y preparación</div>
    <div class="hc-metric"><span class="hc-dot" style="background:#2980b9"></span>
      Macros · recetas · lista de compras</div>`;
}


