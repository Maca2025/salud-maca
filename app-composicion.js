/* ================================================================
   LOGIC MODULE: COMPOSICIÓN CORPORAL
   KPIs, widget de progreso, stacked bar, gráficas de línea, tablas.
================================================================ */

/* ═══════════════════════════════════════════════════════════════
   HIDRATACIÓN Y MASA MAGRA
   ---------------------------------------------------------------
   La bioimpedancia mide AGUA corporal y DERIVA la masa magra
   dividiéndola entre un coeficiente fijo de hidratación. En esta
   serie ese coeficiente ha sido siempre ~73.4 % (73.0–73.5), lo que
   significa que una variación de masa magra a corto plazo es, muy
   literalmente, una variación de hidratación. No es que el aparato
   se confunda a veces: el método no puede separar las dos cosas.

   La solución NO es ocultar el dato, sino elegir bien el punto de
   comparación. La masa magra se compara contra la primera medición
   que esté al menos VENTANA_MAGRA días atrás, no contra la anterior.

   Ejemplo real: del 20-jul al 27-jul la masa magra marcó −2.2 kg en
   7 días (−2.2 kg/semana, imposible). Contra el 23-jun, que está a
   34 días, marca −1.5 kg = −0.31 kg/semana, que sí es plausible.
   ═══════════════════════════════════════════════════════════════ */
const VENTANA_MAGRA   = 28;    // días mínimos para interpretar masa magra
const RITMO_MAGRO_MAX = 0.5;   // kg/semana: techo fisiológico del músculo
const ECF_UMBRAL      = 0.40;  // por encima: retención de líquidos

function mlgDe(d)    { return +(d.peso - d.grasa).toFixed(1); }
function aguaDe(d)   { return +(d.ecf + d.icf).toFixed(1); }
function ratioECF(d) { return +(d.ecf / (d.ecf + d.icf)).toFixed(3); }

/* Masa libre de grasa contra la referencia útil más cercana.
   null si la serie todavía no tiene VENTANA_MAGRA días de profundidad. */
function variacionMagra(iHasta){
  const i = (iHasta == null) ? DATA.length - 1 : iHasta;
  const b = DATA[i];
  if(!b || DAYS[i] == null) return null;
  for(let j = i - 1; j >= 0; j--){
    if(DAYS[j] == null) continue;
    const dias = DAYS[i] - DAYS[j];
    if(dias < VENTANA_MAGRA) continue;
    const delta = +(mlgDe(b) - mlgDe(DATA[j])).toFixed(1);
    const ritmo = +(delta / dias * 7).toFixed(2);
    return {ref:DATA[j], dias, delta, ritmo, estable:Math.abs(ritmo) <= RITMO_MAGRO_MAX};
  }
  return null;
}

/* La lectura corta — la que engaña. Se calcula solo para poder
   nombrarla y descartarla en voz alta, no para mostrarla como dato. */
function variacionMagraCorta(iHasta){
  const i = (iHasta == null) ? DATA.length - 1 : iHasta;
  if(i < 1 || DAYS[i] == null || DAYS[i-1] == null) return null;
  const dias = DAYS[i] - DAYS[i-1];
  if(!dias || dias >= VENTANA_MAGRA) return null;
  const delta = +(mlgDe(DATA[i]) - mlgDe(DATA[i-1])).toFixed(1);
  const ritmo = +(delta / dias * 7).toFixed(2);
  return {dias, delta, ritmo, excede:Math.abs(ritmo) > RITMO_MAGRO_MAX};
}

/* El coeficiente de hidratación observado, con sus propios datos.
   Es lo que hace creíble la explicación: no es teoría, es su serie. */
function coefHidratacion(){
  const rs = DATA.filter(d => d.peso && d.grasa && (d.peso - d.grasa) > 0)
                 .map(d => aguaDe(d) / mlgDe(d) * 100);
  if(!rs.length) return null;
  return {n:rs.length,
          media:+(rs.reduce((s,x)=>s+x,0)/rs.length).toFixed(1),
          min:+Math.min(...rs).toFixed(1),
          max:+Math.max(...rs).toFixed(1)};
}

/* ECF sobre agua total. A diferencia del coeficiente de arriba, este SÍ
   varía de forma informativa: por encima de 0.40 se asocia a retención
   de líquidos e inflamación. Nivel de evidencia: PRÁCTICA — es un umbral
   de uso extendido en bioimpedancia, no hay ensayo que lo fije. */
function distribucionLiquidos(){
  const rs = DATA.filter(d => d.ecf && d.icf).map(ratioECF);
  if(!rs.length) return null;
  const act = rs[rs.length-1];
  return {actual:act, min:+Math.min(...rs).toFixed(3), max:+Math.max(...rs).toFixed(3),
          n:rs.length, normal:act < ECF_UMBRAL};
}

function signoKg(x){ return (x >= 0 ? '+' : '') + x; }

/* La proyección, y nada más. Lo que vivía aquí o subió a la portada (masa
   magra, coeficiente de hidratación, líquidos) o se quitó por contradictorio:
   "Ejemplo reciente" celebraba intervalos de pocos días como recomposición, y
   con la regla de los 28 días eso es agua — se desmentía con la tarjeta que
   tenía justo debajo. */
function renderProgress() {
  const last = DATA[DATA.length-1];
  const cont = document.getElementById('progressWidget');
  if(!last){ cont.innerHTML=''; return; }

  const falta = +(last.grasa - grasaMetaKg()).toFixed(1);
  const gRec  = regresion('grasa', 6), gGlobal = regresion('grasa');
  const ritmo = Math.abs(gRec.valida ? gRec.ratePerWeek : gGlobal.ratePerWeek);
  const aterriza = +(sueloMlg() + grasaMetaKg()).toFixed(1);

  if(falta <= 0){
    cont.innerHTML = `<div class="proyeccion">Ya estás en la meta de
      ${metaPbf()} % de grasa. A partir de aquí el objetivo es sostenerla sin
      bajar de ${sueloMlg()} kg de masa magra.</div>`;
    return;
  }
  if(!(ritmo > 0.01)){
    cont.innerHTML = `<div class="proyeccion">Te faltan <strong>${falta} kg</strong>
      de grasa. Sin un ritmo reciente estable no se puede proyectar una fecha.</div>`;
    return;
  }

  const f = new Date(); f.setDate(f.getDate() + falta/ritmo*7);
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  cont.innerHTML = `
    <div class="proyeccion">
      Te faltan <strong>${falta} kg</strong> de grasa. Al ritmo de las últimas
      semanas (<strong>${ritmo.toFixed(2)} kg/sem</strong>) llegarías por
      <strong>${MESES[f.getMonth()]}-${f.getFullYear()}</strong>, cerca de
      <strong>${aterriza} kg</strong> de peso.
      <span class="pc-sub">La fecha asume que ese ritmo se mantiene.</span>
    </div>`;
}

/* LAS METAS SE DIBUJAN A MANO, NO COMO DATASET, por lo mismo que en la
   grafica de proteina: un plugin pinta encima del area y no las tocan las
   escalas ni el apilado.

   Son las dos caras del MISMO objetivo, no dos metas sueltas: si la masa magra
   son 47 kg y la grasa el 30 % del peso, el peso objetivo sale 67.1 y la grasa
   objetivo 20.1. Por eso grasaMetaKg() se deriva del suelo y no se escribe a
   mano en ningun sitio. */
const plugMetas = {
  id:'metas',
  afterDatasetsDraw(chart, args, opts){
    const lineas = (opts && opts.lineas) || [];
    const {ctx, chartArea, scales} = chart;
    ctx.save();
    lineas.forEach(l => {
      if(l.valor == null) return;
      const y = scales.y.getPixelForValue(l.valor);
      if(y < chartArea.top || y > chartArea.bottom) return;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5,4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      /* A la IZQUIERDA y sobre un fondo claro. Pegados a la derecha se
         montaban encima de las lineas justo donde convergen. */
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const x = chartArea.left + 4;
      const w = ctx.measureText(l.texto).width;
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.fillRect(x - 2, y - 14, w + 4, 12);
      ctx.fillStyle = l.color;
      ctx.fillText(l.texto, x, y - 3);
    });
    ctx.restore();
  }
};

/* ════════════════════════════════════════════════════════════
   LA VISTA PRINCIPAL DE COMPOSICION
   ------------------------------------------------------------
   La tabla ya no va debajo: sus cifras se dibujan DENTRO del lienzo, cada una
   bajo su fecha. Tiene que ir en canvas y no en HTML porque es la unica forma
   de que las columnas caigan exactamente sobre su punto aunque cambie el ancho
   de la pantalla. El precio: esos numeros no se pueden seleccionar.

   COLAPSO POR MES. Con 19 mediciones los numeros no caben en un movil, y cada
   medicion nueva lo empeora. Por defecto se ensena una por mes —la ultima— y
   un toque las despliega todas.

   LA PRIMERA MEDICION NO SE PIERDE NUNCA al colapsar: es la linea base.

   OJO CON LOS DELTAS: se recalculan entre las mediciones VISIBLES. En la vista
   mensual el delta del 27-abr es contra el 30-mar, no contra el 21-abr. Es lo
   correcto —si no, las cifras no sumarian— pero significa que los mismos
   numeros cambian segun la vista.
   ════════════════════════════════════════════════════════════ */
const RECOMP_MODO_KEY = 'maca-recomp-modo';
const RECOMP_EPOCH    = Date.UTC(2026, 2, 16);   // 16-mar-2026, dia 0 de la serie
let _recompModo = 'mes';                          // 'mes' | 'todas'

/* Clave de mes a partir de `dias`, no del texto: las etiquetas son "16-mar" y
   no llevan año, asi que en enero se solaparian dos meses de años distintos. */
function mesClaveDe(d){
  if(d.dias == null) return String(d.fecha).split('-')[1] || '';
  const t = new Date(RECOMP_EPOCH + d.dias * 864e5);
  return t.getUTCFullYear() + '-' + t.getUTCMonth();
}

function indicesRecomp(modo){
  const m = modo || _recompModo;
  if(m === 'todas') return DATA.map((_, i) => i);
  const out = [];
  DATA.forEach((d, i) => {
    const sig = DATA[i + 1];
    if(!sig || mesClaveDe(sig) !== mesClaveDe(d)) out.push(i);
  });
  if(out[0] !== 0) out.unshift(0);
  return out;
}

/* Un solo estado para las DOS graficas de la seccion: si eliges "por mes",
   las barras apiladas y la de grasa vs masa magra cambian juntas. Dos
   interruptores para lo mismo, cada uno donde hace falta. */
function setRecompModo(m){
  _recompModo = m;
  try { localStorage.setItem(RECOMP_MODO_KEY, m); } catch(e){}
  initRecomposicion();
  if(typeof lazyInited === 'object' && lazyInited.composicion) initComposicion();
}

function renderRecompModo(){
  const btn = (m, txt) => `<button class="blk-btn${_recompModo===m?' primary':''}"
    style="padding:5px 13px;font-size:.76rem" onclick="setRecompModo('${m}')">${txt}</button>`;
  const botones = btn('mes',  `Por mes · ${indicesRecomp('mes').length}`) +
                  btn('todas', `Todas · ${DATA.length}`);
  const pon = (id, nota) => {
    const host = document.getElementById(id);
    if(host) host.innerHTML = botones +
      `<span style="font-size:.7rem;color:#aaa;margin-left:auto">${nota}</span>`;
  };
  pon('recomp-modo', 'Las cifras van bajo su fecha');
  pon('comp-modo',   'La última medición de cada mes');
}

/* La rejilla de cifras, bajo el area del grafico y alineada con cada punto. */
function plugRejilla(idx){
  const FILAS = [
    {k:'Δ peso',  v:(a,b)=>+(b.peso - a.peso).toFixed(1),     bueno:-1},
    {k:'Δ grasa', v:(a,b)=>+(b.grasa - a.grasa).toFixed(1),   bueno:-1},
    {k:'Δ magra', v:(a,b)=>+(mlgDe(b) - mlgDe(a)).toFixed(1), bueno:+1},
    {k:'calidad', v:(a,b)=>calidadPerdida(+(b.peso-a.peso).toFixed(1),
                                          +(b.grasa-a.grasa).toFixed(1)), cal:true},
  ];
  const marcados = new Set(detectarRecomposicion().map(r => r.a));
  return {
    id:'rejilla',
    afterDraw(chart){
      const {ctx, chartArea:A, scales} = chart;
      const alto = 17, y0 = A.bottom + 34;
      ctx.save();
      ctx.font = '9px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      FILAS.forEach((fila, r) => {
        const y = y0 + r * alto;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#9aa0a6';
        ctx.fillText(fila.k, A.left - 6, y);
        ctx.strokeStyle = '#f2f2ef';
        ctx.beginPath(); ctx.moveTo(A.left, y + alto/2); ctx.lineTo(A.right, y + alto/2); ctx.stroke();
        ctx.textAlign = 'center';
        idx.forEach((di, c) => {
          if(c === 0) return;      // la primera columna no tiene contra que comparar
          const val = fila.v(DATA[idx[c-1]], DATA[di]);
          const x = scales.x.getPixelForValue(c);
          let color, txt;
          if(fila.cal){
            txt = val == null ? '—' : val + '%';
            color = val == null ? '#9aa0a6' : val > 100 ? '#15803d' : val < 50 ? '#b91c1c' : '#3d3d3a';
          } else {
            txt = (val > 0 ? '+' : '') + val.toFixed(1);
            const signo = val === 0 ? 0 : (val > 0 ? 1 : -1);
            color = signo === 0 ? '#9aa0a6' : (signo === fila.bueno ? '#15803d' : '#b91c1c');
          }
          ctx.fillStyle = color;
          ctx.fillText(txt, x, y);
        });
      });
      /* Las recomposiciones se marcan bajo la fecha donde CIERRA su ventana. */
      const yR = y0 + FILAS.length * alto;
      ctx.textAlign = 'right'; ctx.fillStyle = '#9aa0a6';
      ctx.fillText('recomp.', A.left - 6, yR);
      ctx.textAlign = 'center';
      idx.forEach((di, c) => {
        if(!marcados.has(DATA[di].fecha)) return;
        ctx.fillStyle = '#15803d';
        ctx.fillText('●', scales.x.getPixelForValue(c), yR);
      });
      ctx.restore();
    }
  };
}

function initRecomposicion(){
  if(!DATA.length) return;
  try {
    const m = localStorage.getItem(RECOMP_MODO_KEY);
    if(m === 'mes' || m === 'todas') _recompModo = m;
  } catch(e){}

  const idx = indicesRecomp();
  renderRecompModo();
  const sub = idx.map(i => DATA[i]);

  if(chartReg.cRecomp) chartReg.cRecomp.destroy();
  chartReg.cRecomp = new Chart(document.getElementById('cRecomp'), {
    type:'line',
    plugins:[plugMetas, plugRejilla(idx)],
    data:{labels: sub.map(d=>d.fecha), datasets:[
      {label:'Peso (contexto)', data:sub.map(d=>d.peso), borderColor:'#c9c9c3',
       fill:false, tension:.3, borderDash:[4,4], borderWidth:1.5, pointRadius:0},
      {label:'Grasa kg', data:sub.map(d=>d.grasa), borderColor:'#e74c3c',
       fill:false, tension:.3, borderWidth:2, pointRadius:2.5},
      {label:'Masa magra kg', data:sub.map(d=>mlgDe(d)), borderColor:'#2980b9',
       fill:false, tension:.3, borderWidth:2.5, pointRadius:2.5},
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      /* Hueco abajo para la rejilla y a la izquierda para sus etiquetas. */
      layout:{padding:{bottom:104, left:46}},
      interaction:{mode:'index', intersect:false},
      /* La leyenda va ARRIBA: abajo se le montaba encima a la rejilla de
         cifras, que ocupa justo ese hueco. */
      plugins:{legend:{position:'top',align:'start',
                       labels:{boxWidth:10,font:{size:10},padding:12}},
        metas:{lineas:[
          {valor: grasaMetaKg(), color:'#e74c3c',
           texto:`objetivo grasa ${grasaMetaKg()} kg (${metaPbf()} %)`},
          {valor: sueloMlg(),    color:'#2980b9',
           texto:`objetivo masa magra ${sueloMlg()} kg`},
          {valor: pesoMetaKg(),  color:'#9a9a94',
           texto:`peso resultante ${pesoMetaKg()} kg`},
        ]},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y} kg`}}},
      scales:{
        /* offset:false pega los puntos a los bordes: menos aire entre columnas. */
        x:{grid:{display:false}, offset:false,
           ticks:{font:{size:9}, autoSkip:false, maxRotation:0}},
        y:{grid:{color:GRID},ticks:{font:{size:9}},beginAtZero:false,
           suggestedMin: Math.max(0, Math.floor(grasaMetaKg() - 5)),
           title:{display:true,text:'kg',font:{size:9}}},
      },
      elements:{point:{radius:3,hoverRadius:5}}}
  });

  /* Debajo ya no hay tabla: solo la explicacion de lo que se ve arriba. */
  const cont = document.getElementById('recomp-tabla');
  if(cont) cont.innerHTML = `
    <div class="recomp-leyenda">
      La fila <em>calidad</em> es qué proporción de lo que bajaste fue grasa.
      <strong>Por encima de 100 % significa que además ganaste masa magra</strong>:
      perdiste más grasa que peso total. Si la grasa sube, la calidad es 0.
      <br><br>
      El punto de <strong>recomp.</strong> marca las mediciones que cierran un tramo
      de <strong>${VENTANA_MAGRA} días o más</strong> con la grasa bajando más de
      ${RUIDO_GRASA} kg y la calidad por encima de 100 % — <strong>${
        detectarRecomposicion().length}</strong> hasta ahora. Los ${VENTANA_MAGRA} días
      no son un capricho: por debajo, el cambio de músculo que mide la báscula es sobre
      todo hidratación. El umbral de ${RUIDO_GRASA} kg es el ruido medido en tus propias
      mediciones.
      <br><br>
      <strong>Las cifras se recalculan según la vista.</strong> Con el detalle mensual
      cada columna se compara con la del mes anterior; con todas, con la medición
      inmediatamente previa.
    </div>`;
}


/* ═══════════════════════════════════════════════════════════════
   PORTADA — dos números, no seis
   ---------------------------------------------------------------
   Las cuatro tarjetas de minerales, proteínas, ICF y ECF tenían
   "meta" y pedían BAJARLAS. Esas metas eran los valores de marzo
   copiados en la fila OBJETIVO, y proteínas y minerales son masa
   magra: justo lo que no se quiere perder. Se van al detalle.

   Quedan las dos cosas sobre las que se puede actuar:
     · grasa, con meta de porcentaje
     · masa magra, con un SUELO que no se cruza

   El peso baja a una línea de contexto. No es objetivo: es
   consecuencia de las otras dos.
   ═══════════════════════════════════════════════════════════════ */
const PBF_META_DEF  = 30;   // % de grasa objetivo, si la hoja no lo trae
const MLG_SUELO_DEF = 47;   // kg de masa magra que no bajar
const MLG_MARGEN    = 3;    // kg por encima del suelo donde ya se avisa

function metaPbf(){
  return (typeof OBJ === 'object' && OBJ && OBJ.pbf > 0) ? OBJ.pbf : PBF_META_DEF;
}
function sueloMlg(){
  return (typeof SUELO === 'object' && SUELO && SUELO.mlg > 0) ? SUELO.mlg : MLG_SUELO_DEF;
}

/* Los kg de grasa que corresponden a la meta de porcentaje, anclados
   al suelo de masa magra: es el punto donde las dos metas se cumplen
   a la vez. Con suelo 47 y meta 30 %, son 20.1 kg de grasa y 67.1 de peso. */
function grasaMetaKg(){
  const p = metaPbf();
  return +(sueloMlg() * p / (100 - p)).toFixed(1);
}

/* El peso objetivo NO se escribe en ningun sitio: es lo que sale de sumar las
   otras dos. 47 de masa magra + 20.1 de grasa = 67.1 kg. Sigue siendo
   consecuencia y no meta, por eso va en gris como la linea del peso. */
function pesoMetaKg(){
  return +(sueloMlg() + grasaMetaKg()).toFixed(1);
}

function tarjetaGrasa(){
  const first = DATA[0], last = DATA[DATA.length-1];
  const meta  = grasaMetaKg();
  const fuera = +(first.grasa - last.grasa).toFixed(1);
  const rango = first.grasa - meta;
  const pct   = rango > 0 ? Math.max(0, Math.min(100, Math.round(fuera/rango*100))) : 0;
  const enMeta = last.pbf <= metaPbf();

  return `
  <div class="pc-card">
    <div class="pc-label">Grasa corporal</div>
    <div class="pc-fila">
      <span class="pc-num">${last.pbf.toFixed(1)}</span><span class="pc-uni">%</span>
      <span class="pc-meta">meta ≤ ${metaPbf()} %</span>
    </div>
    <div class="pc-barra"><div class="pc-barra-fill" style="width:${pct}%"></div></div>
    <div class="pc-pie">${last.grasa.toFixed(1)} kg ·
      <span class="pc-bien">−${fuera} kg</span> desde ${esc(first.fecha)} ·
      ${enMeta ? 'en meta' : pct + ' % del camino'}</div>
  </div>`;
}

function tarjetaMagra(){
  const last  = DATA[DATA.length-1];
  const mlg   = mlgDe(last);
  const suelo = sueloMlg();
  const margen = +(mlg - suelo).toFixed(1);
  const v = variacionMagra();
  const c = variacionMagraCorta();

  // Tres tramos, no progreso: no se avanza hacia un suelo, se guarda distancia
  const estado = margen <= 0 ? 'mal' : (margen <= MLG_MARGEN ? 'ojo' : 'bien');
  const texto  = margen <= 0
    ? `${Math.abs(margen)} kg por debajo`
    : `margen ${margen} kg`;

  // Cierra el circulo: la conducta que sostiene este numero, en la misma
  // ventana de 28 dias con la que se lee la masa magra. app-tracker.js
  // carga despues, de ahi la guarda con typeof.
  const nf = (typeof fuerza28 === 'function') ? fuerza28() : null;
  const conducta = nf === null ? ''
    : (nf ? ` · <strong style="display:inline;font-size:inherit;text-transform:none;letter-spacing:0">${nf}</strong> ${nf===1?'sesión':'sesiones'} de fuerza en 28 días`
          : ' · <span class="pc-sub">sin sesiones de fuerza en 28 días</span>');

  const pie = v
    ? `${signoKg(v.delta)} kg en ${v.dias} días · ${signoKg(v.ritmo)} kg/sem ·
       ${v.estable ? 'estable' : 'ritmo alto'}${conducta}`
    : `hacen falta ${VENTANA_MAGRA} días entre mediciones para leerlo${conducta}`;

  return `
  <div class="pc-card">
    <div class="pc-label">Masa magra <span class="pc-sub">· no bajar de ${suelo}</span></div>
    <div class="pc-fila">
      <span class="pc-num">${mlg}</span><span class="pc-uni">kg</span>
      <span class="pc-chip ${estado}">${texto}</span>
    </div>
    <div class="pc-tramos">
      <i class="t-mal"></i><i class="t-ojo"></i><i class="t-bien"></i>
      <b style="left:${posSuelo(mlg, suelo)}%"></b>
    </div>
    <div class="pc-pie">${pie}${c && c.excede ? ' <span class="pc-sub">· la lectura de ' +
      c.dias + ' días no es interpretable</span>' : ''}</div>
  </div>`;
}

/* Sitúa el marcador en la barra de tramos. La escala va de 3 kg por
   debajo del suelo a 6 por encima, que es el rango donde la decisión
   cambia; fuera de ahí se pega a los extremos. */
function posSuelo(mlg, suelo){
  const p = (mlg - (suelo - 3)) / 9 * 100;
  return Math.max(1, Math.min(99, +p.toFixed(1)));
}

/* La tarjeta de tirzepatida se mudo aqui desde Hoy. La construye
   tarjetaTirze() en app-tracker.js, que carga DESPUES que este archivo: por eso
   la llamada va en tiempo de ejecucion y con la guarda de typeof.
   No se toco nada de su logica — ciclo, rotacion de zona, ingestaPorCiclo y el
   formulario siguen exactamente igual. */
function renderTirze(){
  const host = document.getElementById('tirze-host');
  if(!host) return;
  host.innerHTML = (typeof tarjetaTirze === 'function') ? tarjetaTirze() : '';
}

function renderComposicionKPIs() {
  renderTirze();
  const last = DATA[DATA.length-1], first = DATA[0];
  if(!last || !first){ document.getElementById('kpis').innerHTML = ''; return; }
  const h  = coefHidratacion();
  const dl = distribucionLiquidos();

  document.getElementById('kpis').innerHTML = `
  <div class="portada">
    <div class="pc-grid">${tarjetaGrasa()}${tarjetaMagra()}</div>

    <div class="pc-peso">
      <span>Peso <strong>${last.peso.toFixed(1)} kg</strong>
        (${signoKg(+(last.peso - first.peso).toFixed(1))} desde ${esc(first.fecha)})</span>
      <span class="pc-sub">contexto, no objetivo</span>
    </div>

    <div class="pc-aviso">
      La báscula mide agua y calcula el músculo a partir de ella. Por eso la masa
      magra se compara a ${VENTANA_MAGRA} días, no semana a semana.
      <button class="link-btn" onclick="verDetalleHidratacion()">Ver detalle</button>
      <div id="pc-detalle" hidden>
        ${h ? `<div>En tus ${h.n} mediciones, el agua ha sido siempre el
          <strong>${h.media} %</strong> de tu masa magra (${h.min}–${h.max}). Si llegas
          menos hidratada, la báscula lo lee como músculo perdido. No es un fallo del
          aparato: es cómo funciona el método.</div>` : ''}
        ${dl ? `<div>Distribución de líquidos <strong>${dl.actual}</strong> —
          ${dl.normal ? 'normal' : 'por encima de lo normal'}, referencia por debajo de
          ${ECF_UMBRAL}. Estable en tus ${dl.n} mediciones (${dl.min}–${dl.max}).
          Es el agua fuera de las células sobre el agua total; cuando sube, suele
          indicar retención de líquidos. Contexto, no diagnóstico.</div>` : ''}
      </div>
    </div>
  </div>`;
}

function verDetalleHidratacion(){
  const d = document.getElementById('pc-detalle');
  if(d) d.hidden = !d.hidden;
}

function renderComposicionTables() {
  const tbM=document.getElementById('tbodyMain');
  const tbC=document.getElementById('tbodyComp');
  DATA.forEach((d,i)=>{
    const p=i>0?DATA[i-1]:null;
    const lat=i===DATA.length-1?' class="latest"':'';
    const tag=i===DATA.length-1?' ★':'';
    const agua=(d.ecf+d.icf).toFixed(1);
    const ratio=(d.icf/d.ecf).toFixed(2);
    const rCl=parseFloat(ratio)>=1.6?'':'style="color:#c0392b"';
    tbM.innerHTML+=`<tr${lat}><td>${d.fecha}${tag}</td><td>${d.peso.toFixed(1)}</td>
      ${p?pDelta(d.peso-p.peso,'down'):'<td>—</td>'}
      <td>${d.grasa.toFixed(1)}</td>${p?pDelta(d.grasa-p.grasa,'down'):'<td>—</td>'}
      <td>${d.smm.toFixed(1)}</td>${p?pDelta(d.smm-p.smm,'up'):'<td>—</td>'}
      <td>${d.pbf.toFixed(1)}%</td><td>${d.bmi.toFixed(1)}</td>
      <td>${d.score.toFixed(1)}</td><td>${d.tmb}</td></tr>`;
    tbC.innerHTML+=`<tr${lat}><td>${d.fecha}${tag}</td><td>${agua}</td>
      <td>${d.ecf.toFixed(1)}</td><td>${d.icf.toFixed(1)}</td>
      <td ${rCl}>${ratio}</td><td>${d.prot.toFixed(1)}</td>
      <td>${d.min.toFixed(1)}</td><td>${d.grasaVisc}/20</td></tr>`;
  });
}

function initResumen() {
  const labels=DATA.map(d=>d.fecha);
  mkLine('cPeso',[ds('Peso kg',DATA.map(d=>d.peso),G,{fill:true})]);
  mkLine('cGrasaSMM',[ds('Grasa kg',DATA.map(d=>d.grasa),R),ds('SMM músculo kg',DATA.map(d=>d.smm),B)]);
  mkLine('cPBF',[ds('% Grasa',DATA.map(d=>d.pbf),O,{fill:true})],{min:48,max:55});
  if(chartReg.cScore) chartReg.cScore.destroy();
  chartReg.cScore=new Chart(document.getElementById('cScore'),{type:'line',
    data:{labels,datasets:[
      {label:'Puntuación',data:DATA.map(d=>d.score),borderColor:G,fill:false,tension:0.3,yAxisID:'yS'},
      {label:'IMC',data:DATA.map(d=>d.bmi),borderColor:R,fill:false,tension:0.3,borderDash:[4,3],yAxisID:'yB'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
      scales:{
        x:{grid:{color:GRID},ticks:{font:{size:9},maxRotation:45}},
        yS:{type:'linear',position:'left',grid:{color:GRID},ticks:{font:{size:9}},min:43,max:54},
        yB:{type:'linear',position:'right',grid:{drawOnChartArea:false},ticks:{font:{size:9}},min:37,max:45}
      },
      elements:{point:{radius:3,hoverRadius:5}}}});
  mkLine('cAgua',[ds('ECF',DATA.map(d=>d.ecf),B),ds('ICF',DATA.map(d=>d.icf),G)]);
  mkLine('cProt',[ds('Proteínas kg',DATA.map(d=>d.prot),P,{fill:true})],{min:9,max:12});
  mkLine('cMin', [ds('Minerales kg',DATA.map(d=>d.min),O,{fill:true})],{min:3,max:4.5});
  mkLine('cTMB', [ds('TMB kcal',DATA.map(d=>d.tmb),G,{fill:true})],{min:1400,max:1620});
}

/* Reparto molecular del objetivo. La fila OBJETIVO traia los valores de marzo,
   que no eran metas de nada. Esto los deriva del suelo de masa magra usando las
   proporciones reales de su serie, asi la barra de objetivo cuadra con las dos
   metas nuevas en vez de contradecirlas. */
function objetivoMolecular(){
  const last = DATA[DATA.length-1];
  const suelo = sueloMlg();
  if(!last) return {ecf:0, icf:0, prot:0, min:0, grasa:grasaMetaKg()};
  const mlg = mlgDe(last), agua = aguaDe(last);
  const rAgua = agua/mlg, rProt = last.prot/mlg, rMin = last.min/mlg;
  const rEcf  = last.ecf/agua;
  const aguaObj = suelo*rAgua;
  return {
    ecf:  +(aguaObj*rEcf).toFixed(1),
    icf:  +(aguaObj*(1-rEcf)).toFixed(1),
    prot: +(suelo*rProt).toFixed(1),
    min:  +(suelo*rMin).toFixed(1),
    grasa: grasaMetaKg()
  };
}

function initComposicion() {
  /* Al intercambiar el orden de las pestañas, la que se ve al entrar en la
     sección es "Grasa vs Músculo". gotoSection solo dispara initComposicion,
     así que esta se encarga de pintar la visible primero. Las barras apiladas
     se dibujan en un panel oculto y Chart.js las redimensiona sola al
     mostrarse. */
  if(typeof lazyInited === 'object' && !lazyInited.recomposicion){
    initRecomposicion();
    lazyInited.recomposicion = true;
  }
  renderProgress();
  renderRecompModo();
  /* Mismo colapso por mes que la grafica de grasa vs masa magra, y con el mismo
     interruptor: D es el subconjunto visible, no DATA entera. La columna de
     objetivo se añade aparte y no depende de esto. */
  const D = indicesRecomp().map(i => DATA[i]);
  const n=D.length;
  const MET=objetivoMolecular();
  const sl=[...D.map(d=>d.fecha),'🎯 Objetivo'];
  const ga=[...D.map(d=>+(d.peso-d.ecf-d.icf-d.prot-d.min).toFixed(1)),grasaMetaKg()];
  function bgs(s,l){return[...Array(n).fill(s),l];}
  const dp={id:'dp',afterDraw(chart){
    const ctx=chart.ctx, tc=['#fff','#fff','#fff','#333','#fff'];
    chart.data.datasets.forEach((dst,di)=>{
      const m=chart.getDatasetMeta(di); if(m.hidden) return;
      m.data.forEach((bar,i)=>{
        if(i===0||i>=n) return;
        const c=dst.data[i],p=dst.data[i-1]; if(c==null||p==null) return;
        const dv=+(c-p).toFixed(1), h=Math.abs(bar.base-bar.y); if(h<10) return;
        ctx.save(); ctx.font='bold 8px system-ui'; ctx.fillStyle=tc[di]||'#fff';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText((dv>=0?'+':'')+dv.toFixed(1),bar.x,(bar.y+bar.base)/2); ctx.restore();
      });
    });
    const gm=chart.getDatasetMeta(4), ty=chart.chartArea.top;
    gm.data.forEach((bar,i)=>{
      if(i===n){
        ctx.save(); ctx.font='bold 9.5px system-ui'; ctx.fillStyle='#2d6a4f';
        ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText((sueloMlg()+grasaMetaKg()).toFixed(1)+' kg',bar.x,ty+3); ctx.restore();
        const dv=+((sueloMlg()+grasaMetaKg())-D[n-1].peso).toFixed(1);
        ctx.save(); ctx.font='bold 8.5px system-ui'; ctx.fillStyle='#15803d';
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(dv.toFixed(1),bar.x,bar.y-2); ctx.restore(); return;
      }
      ctx.save(); ctx.font='bold 9.5px system-ui'; ctx.fillStyle='#064e3b';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(D[i].peso.toFixed(1)+' kg',bar.x,ty+3); ctx.restore();
      if(i===0) return;
      const dP=+(D[i].peso-D[i-1].peso).toFixed(1);
      ctx.save(); ctx.font='bold 8.5px system-ui';
      ctx.fillStyle=dP<0?'#15803d':'#dc2626';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText((dP>=0?'+':'')+dP.toFixed(1),bar.x,bar.y-2); ctx.restore();
    });
  }};
  if(chartReg.cStack) chartReg.cStack.destroy();
  chartReg.cStack=new Chart(document.getElementById('cStack'),{type:'bar',
    data:{labels:sl, datasets:[
      {label:'ECF',      data:[...D.map(d=>d.ecf),  MET.ecf],  backgroundColor:bgs('#5b9bd5','#5b9bd566'),  borderColor:bgs('rgba(0,0,0,0)','#1d4ed8'), borderWidth:bgs(0,2), stack:'s'},
      {label:'ICF',      data:[...D.map(d=>d.icf),  MET.icf],  backgroundColor:bgs('#2471a3','#2471a366'),  borderColor:bgs('rgba(0,0,0,0)','#1e3a8a'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Proteínas',data:[...D.map(d=>d.prot), MET.prot], backgroundColor:bgs('#52b788','#52b78866'),  borderColor:bgs('rgba(0,0,0,0)','#14532d'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Minerales',data:[...D.map(d=>d.min),  MET.min],  backgroundColor:bgs('#f0b429','#f0b42966'),  borderColor:bgs('rgba(0,0,0,0)','#78350f'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Grasa',    data:ga,                                   backgroundColor:bgs('#e74c3c','#e74c3c66'),  borderColor:bgs('rgba(0,0,0,0)','#9f1239'), borderWidth:bgs(0,2), stack:'s'},
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:12,font:{size:10},padding:12}},
        tooltip:{callbacks:{footer:items=>'Total: '+items.reduce((s,i)=>s+i.parsed.y,0).toFixed(1)+' kg'}}
      },
      scales:{
        x:{stacked:true, grid:{color:GRID}, ticks:{font:c=>({size:9,weight:c.tick?.label==='🎯 Objetivo'?'bold':'normal'}), color:c=>c.tick?.label==='🎯 Objetivo'?'#2d6a4f':'#666', maxRotation:45}},
        y:{stacked:true, grid:{color:GRID}, ticks:{font:{size:9}}, min:0, max:125}
      }
    },
    plugins:[dp]
  });
}

/* ═══════════════════════════════════════════════════════════════
   MEDIDAS CON CINTA
   ---------------------------------------------------------------
   La cinta metrica mide algo que la bioimpedancia NO puede: toda la
   composicion corporal sale del agua corporal (coeficiente 73.3 %),
   y esto no. Es el contraste independiente.

   La cintura es la que manda. El umbral practico es cintura/altura
   por debajo de 0.5 — con 163 cm, 81.5 cm. Es mejor marcador
   metabolico que el IMC y se mide en diez segundos.

   Misma logica que la masa magra: la cinta tiene ~1 cm de error
   entre mediciones y al ritmo actual un centimetro tarda unas dos
   semanas en aparecer. Medir cada siete dias es medir ruido.
   ═══════════════════════════════════════════════════════════════ */
const VENTANA_CINTA = 14;    // dias minimos entre medidas para interpretar
const ERROR_CINTA   = 1.0;   // cm de error tipico entre dos mediciones
const CINTURA_RATIO = 0.5;   // cintura/altura: umbral de riesgo metabolico
const WHR_MAX       = 0.85;  // cintura/cadera, referencia en mujeres

const CAMPOS_CINTA = [
  {k:'cintura',     l:'Cintura',     estrella:true},
  {k:'cadera',      l:'Cadera'},
  {k:'brazo',       l:'Brazo'},
  {k:'muslo',       l:'Muslo'},
  {k:'pantorrilla', l:'Pantorrilla'}
];

function alturaCm(){ return (typeof ALTURA_CM === 'number' && ALTURA_CM > 0) ? ALTURA_CM : 163; }
function cinturaUmbral(){ return +(alturaCm() * CINTURA_RATIO).toFixed(1); }

function diasEntre(isoA, isoB){
  const a = isoA.split('-'), b = isoB.split('-');
  return Math.round((Date.UTC(+b[0], +b[1]-1, +b[2]) -
                     Date.UTC(+a[0], +a[1]-1, +a[2])) / 86400000);
}

/* La referencia util mas cercana: la primera medida al menos VENTANA_CINTA
   dias atras. Igual que con la masa magra, no se oculta el dato: se elige
   bien el punto de comparacion. */
function medidaPrevia(campo){
  if(PERIM.length < 2) return null;
  const ult = PERIM[PERIM.length-1];
  if(ult[campo] == null) return null;
  for(let i = PERIM.length-2; i >= 0; i--){
    if(PERIM[i][campo] == null) continue;
    const dias = diasEntre(PERIM[i].fecha, ult.fecha);
    if(dias < VENTANA_CINTA) continue;
    const delta = +(ult[campo] - PERIM[i][campo]).toFixed(1);
    return {ref:PERIM[i], dias, delta, fiable:Math.abs(delta) >= ERROR_CINTA};
  }
  return null;
}

function tarjetaCintura(){
  const ult = PERIM.length ? PERIM[PERIM.length-1] : null;
  if(!ult || ult.cintura == null) return '';
  const umbral = cinturaUmbral();
  const ratio  = +(ult.cintura / alturaCm()).toFixed(3);
  const falta  = +(ult.cintura - umbral).toFixed(1);
  const estado = falta <= 0 ? 'bien' : (falta <= 5 ? 'ojo' : 'mal');
  const v = medidaPrevia('cintura');

  const pie = v
    ? `${signoKg(v.delta)} cm desde ${esc(v.ref.fecha)} — ${v.dias} días.` +
      (v.fiable ? '' : ' <span class="pc-sub">Por debajo del error de la cinta: todavía no es un cambio.</span>')
    : (PERIM.length < 2
        ? 'Primera medida. La siguiente, en 2 a 4 semanas.'
        : `Hacen falta ${VENTANA_CINTA} días entre medidas para leer el cambio.`);

  return `
  <div class="pc-card">
    <div class="pc-label">Cintura <span class="pc-sub">· el marcador metabólico</span></div>
    <div class="pc-fila">
      <span class="pc-num">${ult.cintura.toFixed(1)}</span><span class="pc-uni">cm</span>
      <span class="pc-chip ${estado}">${falta <= 0 ? 'en objetivo' : signoKg(falta) + ' cm'}</span>
    </div>
    <div class="pc-barra"><div class="pc-barra-fill" style="width:${
      Math.max(0, Math.min(100, Math.round(umbral / ult.cintura * 100)))}%"></div></div>
    <div class="pc-pie">cintura ÷ altura = <strong>${ratio}</strong> · objetivo por debajo de
      ${CINTURA_RATIO} (${umbral} cm)<br>${pie}</div>
  </div>`;
}

function tarjetaWhr(){
  const ult = PERIM.length ? PERIM[PERIM.length-1] : null;
  if(!ult || ult.cintura == null || !ult.cadera) return '';
  const whr = +(ult.cintura / ult.cadera).toFixed(2);
  const estado = whr <= WHR_MAX ? 'bien' : (whr <= WHR_MAX + 0.1 ? 'ojo' : 'mal');
  const v = medidaPrevia('cadera');

  return `
  <div class="pc-card">
    <div class="pc-label">Cintura ÷ cadera</div>
    <div class="pc-fila">
      <span class="pc-num">${whr}</span>
      <span class="pc-chip ${estado}">${whr <= WHR_MAX ? 'en rango' : 'sobre ' + WHR_MAX}</span>
    </div>
    <div class="pc-pie">Referencia en mujeres: por debajo de ${WHR_MAX}. Mide cómo se
      reparte la grasa, no cuánta hay.${v ? ` Cadera ${signoKg(v.delta)} cm en ${v.dias} días.` : ''}</div>
  </div>`;
}

function tablaMedidas(){
  if(!PERIM.length) return '';
  let filas = '';
  for(let i = PERIM.length-1; i >= 0; i--){
    const m = PERIM[i], p = i > 0 ? PERIM[i-1] : null;
    const dias = p ? diasEntre(p.fecha, m.fecha) : null;
    const corto = dias != null && dias < VENTANA_CINTA;
    let celdas = '';
    CAMPOS_CINTA.forEach(c => {
      const v = m[c.k];
      if(v == null){ celdas += '<td>—</td><td>—</td>'; return; }
      celdas += `<td>${v.toFixed(1)}</td>`;
      if(!p || p[c.k] == null){ celdas += '<td>—</td>'; return; }
      const d = +(v - p[c.k]).toFixed(1);
      const ruido = corto || Math.abs(d) < ERROR_CINTA;
      celdas += `<td class="${ruido ? 'd-agua' : (d < 0 ? 'd-good' : 'd-bad')}"${
        ruido ? ' title="Por debajo del error de la cinta o con menos de ' + VENTANA_CINTA +
        ' días de diferencia: orientativo."' : ''}${
        ruido ? ' style="color:#9aa0a6"' : ''}>${d >= 0 ? '+' : ''}${d}${ruido ? ' ~' : ''}</td>`;
    });
    filas += `<tr${i === PERIM.length-1 ? ' class="latest"' : ''}>
      <td>${esc(m.fecha)}${i === PERIM.length-1 ? ' ★' : ''}</td>${celdas}
      <td>${esc(m.nota || '')}</td></tr>`;
  }
  const th = CAMPOS_CINTA.map(c => `<th>${c.l}</th><th>Δ</th>`).join('');
  return `
    <div class="tbl-section">Todas las medidas</div>
    <div class="recomp-leyenda">Los cambios marcados con <strong>~</strong> están por debajo
      del error de la cinta (±${ERROR_CINTA} cm) o vienen de menos de ${VENTANA_CINTA} días:
      son orientativos, no progreso.</div>
    <div class="table-scroll"><table>
      <thead><tr><th>Fecha</th>${th}<th>Nota</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
}

function guiaCinta(){
  return `
  <div class="pc-aviso" style="margin-top:14px">
    Los cinco puntos, y las reglas que hacen que los números sirvan.
    <button class="link-btn" onclick="verGuiaCinta()">Ver cómo medir</button>
    <div id="guia-cinta" hidden>
      <div><strong>1 · Cintura</strong> — en el punto medio entre la última costilla y el hueso
        de la cadera. Palpa los dos y mide a media altura; queda por encima del ombligo.
        Suelta el aire y mide al final, sin meter barriga.</div>
      <div><strong>2 · Cadera</strong> — por la parte más ancha de los glúteos, pies juntos.</div>
      <div><strong>3 · Brazo derecho</strong> — punto medio entre hombro y codo,
        con el brazo colgando relajado. Sin contraer.</div>
      <div><strong>4 · Muslo derecho</strong> — punto medio entre el pliegue de la ingle
        y el borde de la rótula, de pie y con el peso repartido.</div>
      <div><strong>5 · Pantorrilla derecha</strong> — por la parte más gruesa.</div>
      <div style="margin-top:7px"><strong>Siempre igual:</strong> por la mañana, en ayunas,
        antes de beber y después del baño · sobre la piel · ajustada sin hundir ·
        paralela al suelo también por detrás · <strong>mide dos veces</strong> y si difieren
        más de 1 cm, una tercera y apunta la media.</div>
    </div>
  </div>`;
}

function verGuiaCinta(){
  const d = document.getElementById('guia-cinta');
  if(d) d.hidden = !d.hidden;
}

function renderMedidas(){
  const host = document.getElementById('medidas-host');
  if(!host) return;
  if(!PERIM.length){
    host.innerHTML = `
      <div class="proyeccion">Todavía no hay ninguna medida. Con la cinta tienes el único
        dato de tu cuerpo que no depende de la hidratación — y la cintura es mejor marcador
        metabólico que el IMC.
        <button class="blk-btn primary" style="margin-top:9px" onclick="abrirFormMedida()">Tomar la primera</button>
      </div>${guiaCinta()}`;
    return;
  }
  host.innerHTML = `
    <div class="portada">
      <div class="pc-grid">${tarjetaCintura()}${tarjetaWhr()}</div>
      ${guiaCinta()}
    </div>
    ${tablaMedidas()}`;
}

function initMedidas(){
  renderMedidas();
  const cv = document.getElementById('cCinta');
  if(!cv || PERIM.length < 2) return;
  if(chartReg.cCinta) chartReg.cCinta.destroy();
  chartReg.cCinta = new Chart(cv, {
    type:'line',
    data:{labels: PERIM.map(m => m.fecha), datasets:[
      {label:'Cintura cm', data:PERIM.map(m => m.cintura), borderColor:R,
       backgroundColor:'#e74c3c22', fill:true, tension:.3},
      {label:'Cadera cm', data:PERIM.map(m => m.cadera), borderColor:B,
       fill:false, tension:.3, borderDash:[4,3]}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
      scales:{x:{grid:{color:GRID},ticks:{font:{size:9},maxRotation:45}},
              y:{grid:{color:GRID},ticks:{font:{size:9}}}},
      elements:{point:{radius:3,hoverRadius:5}}}
  });
}

/* ── Formulario ─────────────────────────────────────────────── */
function abrirFormMedida(){
  const ult = PERIM.length ? PERIM[PERIM.length-1] : null;
  const campo = c => `
    <div class="form-campo">
      <label for="cin-${c.k}">${esc(c.l)} <span class="op">cm</span>
        ${c.estrella ? '<span style="color:#c0392b">*</span>' : ''}</label>
      <input type="number" step="0.1" inputmode="decimal" id="cin-${c.k}"
        placeholder="${ult && ult[c.k] != null ? ult[c.k] : ''}">
    </div>`;

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>📏 Medidas con cinta</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="cin-msg" class="form-msg info">
          Solo la cintura es obligatoria. Los grises son tu última medida${
            ult ? ` (${esc(ult.fecha)})` : ''}, como referencia.
        </div>
        <div class="form-campo" style="max-width:190px">
          <label for="cin-fecha">Fecha</label>
          <input type="date" id="cin-fecha" value="${hoyISO()}" max="${hoyISO()}">
        </div>
        <div class="form-grid">${CAMPOS_CINTA.map(campo).join('')}</div>
        <div class="form-campo">
          <label for="cin-nota">Nota</label>
          <input id="cin-nota" placeholder="En ayunas, antes de beber…">
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="cin-guardar" onclick="guardarMedidaForm()">Guardar</button>
      </div>
    </div>
  </div>`;
  setTimeout(() => { const e = document.getElementById('cin-cintura'); if(e) e.focus(); }, 60);
}

async function guardarMedidaForm(){
  const msg = document.getElementById('cin-msg');
  const btn = document.getElementById('cin-guardar');
  const params = {action:'perimetro', fecha: document.getElementById('cin-fecha').value,
                  nota: document.getElementById('cin-nota').value.trim()};

  document.querySelectorAll('#form-host input').forEach(i => i.classList.remove('err'));
  const cin = document.getElementById('cin-cintura');
  if(!cin.value.trim()){
    cin.classList.add('err');
    msg.className = 'form-msg err'; msg.textContent = 'La cintura es obligatoria.';
    cin.focus(); return;
  }
  let malos = [];
  CAMPOS_CINTA.forEach(c => {
    const el = document.getElementById('cin-'+c.k), v = el.value.trim();
    if(!v) return;
    if(isNaN(Number(v))){ el.classList.add('err'); malos.push(c.l); return; }
    params[c.k] = v;
  });
  if(malos.length){
    msg.className = 'form-msg err'; msg.textContent = 'Revisa: ' + malos.join(', ');
    return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api(params);
    msg.className = 'form-msg ok';
    msg.textContent = `✓ ${r.actualizado ? 'Corregida' : 'Guardada'} la medida del ${r.fecha}.`;
    btn.textContent = '✓ Guardada';
    setTimeout(() => { cerrarForm(); recargarDatos(); }, 900);
  } catch(e){
    msg.className = 'form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}
