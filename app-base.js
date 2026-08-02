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


