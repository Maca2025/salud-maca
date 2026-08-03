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

/* Tarjeta que sustituye a la lectura semanal de músculo. */
function tarjetaMasaMagra(){
  const last = DATA[DATA.length-1];
  if(!last) return '';
  const v  = variacionMagra();
  const c  = variacionMagraCorta();
  const h  = coefHidratacion();
  const dl = distribucionLiquidos();

  const alerta = v && !v.estable;
  const estilo = alerta ? ' style="border-left-color:#f59e0b;background:#fffbeb"' : '';

  const cuerpo = v
    ? `<div><strong style="display:inline;font-size:inherit;text-transform:none;letter-spacing:0">
         ${signoKg(v.delta)} kg</strong> desde ${esc(v.ref.fecha)} —
         ${v.dias} días · ${signoKg(v.ritmo)} kg/semana.
         ${v.estable
            ? 'Dentro de lo esperable acompañando la pérdida de grasa.'
            : 'Por encima del ritmo esperable. Es la señal para revisar proteína y entrenamiento de fuerza, no para bajar más rápido.'}</div>`
    : `<div>Sin lectura interpretable todavía: hacen falta ${VENTANA_MAGRA} días
         entre mediciones para distinguir músculo de hidratación.</div>`;

  const descarte = (c && c.excede)
    ? `<div style="color:#78350f">La comparación con la medición anterior
         (${c.dias} días) marcaría ${signoKg(c.ritmo)} kg/semana.
         <strong style="display:inline;font-size:inherit;text-transform:none;letter-spacing:0">Eso no es músculo</strong>
         — el músculo no cambia tan rápido en ningún sentido. Es agua.</div>`
    : '';

  const explica = h
    ? `<div class="progress-caveat" style="margin-top:9px">
         <strong>Por qué esta báscula no puede medirte el músculo.</strong>
         Mide agua, no músculo: la masa magra la calcula dividiendo el agua entre
         un coeficiente fijo. En tus ${h.n} mediciones ese coeficiente ha sido
         siempre <strong>${h.media} %</strong> (${h.min}–${h.max}).
         Si llegas menos hidratada, lo lee como músculo perdido. No es un fallo
         del aparato: es cómo funciona el método.</div>`
    : '';

  const liquidos = dl
    ? `<div class="progress-caveat" style="margin-top:7px">
         <strong>Distribución de líquidos — ${dl.actual}.</strong>
         ${dl.normal ? 'Normal' : 'Por encima de lo normal'}
         (referencia: por debajo de ${ECF_UMBRAL}).
         Estable en tus ${dl.n} mediciones (${dl.min}–${dl.max}).
         Es el agua fuera de las células sobre el agua total; cuando sube,
         suele indicar retención de líquidos. Contexto, no diagnóstico.</div>`
    : '';

  return `
      <div class="prog-insight${alerta ? '' : ' bueno'}"${estilo}>
        <strong>Masa libre de grasa — ${mlgDe(last)} kg</strong>
        ${cuerpo}
        ${descarte}
      </div>
      ${explica}
      ${liquidos}`;
}

function renderProgress() {
  const first=DATA[0], last=DATA[DATA.length-1];
  if(!first || !last){ document.getElementById('progressWidget').innerHTML=''; return; }

  // ── Lo que de verdad importa: grasa fuera, músculo dentro ──
  const grasaIni = first.grasa, grasaAct = last.grasa;
  const grasaMeta = grasaMetaKg();
  const grasaFuera = +(grasaIni - grasaAct).toFixed(1);
  const grasaFalta = +(grasaAct - grasaMeta).toFixed(1);
  const rangoGrasa = grasaIni - grasaMeta;
  const pctGrasa = rangoGrasa>0 ? Math.max(0,Math.min(100,Math.round(grasaFuera/rangoGrasa*100))) : 0;

  const musculo = +(last.smm - first.smm).toFixed(1);
  const pesoFuera = +(first.peso - last.peso).toFixed(1);
  // Calidad: qué proporción de lo perdido fue grasa
  const calidad = pesoFuera>0 ? Math.round(grasaFuera/pesoFuera*100) : null;

  // Ritmos: global vs reciente (últimas 6 mediciones)
  const gGlobal = regresion('grasa'), gRec = regresion('grasa', 6);
  const mRec = regresion('smm', 6);
  const ritmoGrasa = Math.abs(gRec.valida ? gRec.ratePerWeek : gGlobal.ratePerWeek);

  // Proyección por GRASA, no por peso
  let metaStr = 'sin estimar', pesoEnMeta = null;
  if(ritmoGrasa > 0.01 && grasaFalta > 0){
    const semanas = grasaFalta / ritmoGrasa;
    const f = new Date(); f.setDate(f.getDate() + semanas*7);
    const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    metaStr = `${MESES[f.getMonth()]}-${f.getFullYear()}`;
    pesoEnMeta = +(last.peso - grasaFalta).toFixed(1);   // si conserva el músculo
  }

  // Comparativa de ritmos
  const pRec = regresion('peso', 6), pGlobal = regresion('peso');
  const acelerando = gRec.valida && gGlobal.valida &&
                     Math.abs(gRec.ratePerWeek) > Math.abs(gGlobal.ratePerWeek);
  const musculoSube = mRec.valida && mRec.ratePerWeek > -0.02;

  const recomp = detectarRecomposicion();
  const ultRecomp = recomp.length ? recomp[recomp.length-1] : null;

  document.getElementById('progressWidget').innerHTML=`
    <div class="progress-widget">
      <h4>Proyección por ritmo de grasa</h4>
      <div class="progress-stats">
        <div class="progress-stat"><strong>${grasaFalta} kg</strong><br>de grasa por perder</div>
        <div class="progress-stat"><strong>${ritmoGrasa.toFixed(2)} kg/sem</strong><br>ritmo reciente</div>
        <div class="progress-stat highlight"><strong>${metaStr}</strong><br>si el ritmo se mantiene</div>
      </div>
      ${(acelerando || musculoSube) ? `
      <div class="prog-insight bueno">
        <strong>Lo que la báscula no te dice</strong>
        ${acelerando ? `<div>Tu peso baja más lento que antes
          (${Math.abs(pGlobal.ratePerWeek).toFixed(2)} → ${Math.abs(pRec.ratePerWeek).toFixed(2)} kg/sem)
          pero la <strong>grasa se está yendo más rápido</strong>
          (${Math.abs(gGlobal.ratePerWeek).toFixed(2)} → ${Math.abs(gRec.ratePerWeek).toFixed(2)} kg/sem).</div>` : ''}
        ${musculoSube ? `<div>El músculo dejó de bajar${mRec.ratePerWeek>0?' y está subiendo':''} —
          justo lo que se busca en una recomposición.</div>` : ''}
      </div>` : ''}

      ${ultRecomp ? `
      <div class="prog-insight">
        <strong>Ejemplo reciente</strong>
        <div>Entre <strong>${esc(ultRecomp.de)}</strong> y <strong>${esc(ultRecomp.a)}</strong> la báscula
        marcó ${ultRecomp.dP>=0?'+':''}${ultRecomp.dP} kg,
        pero perdiste ${Math.abs(ultRecomp.dG)} kg de grasa
        ${ultRecomp.dS>=0?`y ganaste ${ultRecomp.dS} kg de músculo`:''}.
        ${recomp.length>1?`<button class="link-btn" onclick="switchCompTab('recomposicion',document.querySelector('#comp-tab-nav .tab-btn[data-tab=recomposicion]'))">Ver los ${recomp.length} periodos →</button>`:''}</div>
      </div>` : ''}

      ${tarjetaMasaMagra()}

      <div class="progress-caveat">La fecha asume que el ritmo actual de pérdida
      de grasa se mantiene. El peso al que llegues depende de cuánta masa magra conserves:
      con el suelo de ${sueloMlg()} kg y la meta de ${metaPbf()} % de grasa, aterrizarías
      cerca de <strong>${(sueloMlg() + grasaMetaKg()).toFixed(1)} kg</strong>.</div>
    </div>`;
}

function initRecomposicion(){
  if(!DATA.length) return;
  const labels = DATA.map(d=>d.fecha);

  if(chartReg.cRecomp) chartReg.cRecomp.destroy();
  chartReg.cRecomp = new Chart(document.getElementById('cRecomp'), {
    type:'line',
    data:{labels, datasets:[
      {label:'Peso (contexto)', data:DATA.map(d=>d.peso), borderColor:'#d5d5d0',
       backgroundColor:'#d5d5d022', fill:false, tension:.3, borderDash:[4,4],
       pointRadius:0, yAxisID:'yPeso'},
      {label:'Grasa kg', data:DATA.map(d=>d.grasa), borderColor:'#e74c3c',
       backgroundColor:'#e74c3c22', fill:true, tension:.3, yAxisID:'yComp'},
      {label:'Músculo SMM kg', data:DATA.map(d=>d.smm), borderColor:'#2980b9',
       backgroundColor:'#2980b922', fill:true, tension:.3, yAxisID:'yComp'},
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},
      scales:{
        x:{grid:{color:GRID},ticks:{font:{size:9},maxRotation:45}},
        yComp:{type:'linear',position:'left',grid:{color:GRID},ticks:{font:{size:9}},
               title:{display:true,text:'kg',font:{size:9}}},
        yPeso:{type:'linear',position:'right',grid:{drawOnChartArea:false},
               ticks:{font:{size:9},color:'#bbb'}},
      },
      elements:{point:{radius:3,hoverRadius:5}}}
  });

  // Tabla intervalo por intervalo
  const cont = document.getElementById('recomp-tabla');
  let filas = '';
  for(let i=1;i<DATA.length;i++){
    const a=DATA[i-1], b=DATA[i];
    const dP=+(b.peso-a.peso).toFixed(1);
    const dG=+(b.grasa-a.grasa).toFixed(1);
    const dS=+(b.smm-a.smm).toFixed(1);
    const gano = dP >= -0.6 && (dG <= -0.3 || dS >= 0.2);
    const cal = dP < 0 ? Math.round(Math.min(100, Math.abs(dG)/Math.abs(dP)*100)) : null;
    // Por debajo de VENTANA_MAGRA dias el delta de musculo no separa musculo
    // de hidratacion: se muestra atenuado y con la explicacion al pasar encima,
    // en vez de en verde o rojo como si fuera una lectura fiable.
    const dias  = (DAYS[i]!=null && DAYS[i-1]!=null) ? DAYS[i]-DAYS[i-1] : null;
    const corto = dias!=null && dias < VENTANA_MAGRA;
    const clsS  = corto ? 'd-agua' : (dS>0?'d-good':dS<0?'d-bad':'');
    const ttS   = corto
      ? ` title="Intervalo de ${dias} días. Por debajo de ${VENTANA_MAGRA} no se puede distinguir músculo de hidratación."`
      : '';
    filas += `<tr class="${gano?'recomp-win':''}">
      <td>${esc(a.fecha)} → ${esc(b.fecha)}</td>
      <td class="${dP<0?'d-good':dP>0?'d-bad':''}">${dP>=0?'+':''}${dP}</td>
      <td class="${dG<0?'d-good':dG>0?'d-bad':''}">${dG>=0?'+':''}${dG}</td>
      <td class="${clsS}"${ttS} style="${corto?'color:#9aa0a6':''}">${dS>=0?'+':''}${dS}${corto?' ~':''}</td>
      <td>${cal!=null?cal+'%':'—'}</td>
      <td>${gano?'<span class="recomp-badge">recomposición</span>':''}</td>
    </tr>`;
  }
  const n = detectarRecomposicion().length;
  cont.innerHTML = `
    <div class="tbl-section">Cambio entre mediciones</div>
    <div class="recomp-leyenda">Marcados los periodos donde el peso se movió poco o subió,
      pero perdiste grasa o ganaste músculo — <strong>${n} de ${DATA.length-1}</strong> intervalos.
      La columna <em>calidad</em> es qué proporción de lo bajado fue grasa.
      Los cambios de músculo marcados con <strong>~</strong> vienen de intervalos
      de menos de ${VENTANA_MAGRA} días: ahí la báscula no puede separar músculo
      de hidratación, así que son orientativos y no cuentan como progreso.</div>
    <div class="table-scroll"><table>
      <thead><tr><th>Periodo</th><th>Δ Peso</th><th>Δ Grasa</th><th>Δ Músculo</th><th>Calidad</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
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

  const pie = v
    ? `${signoKg(v.delta)} kg en ${v.dias} días · ${signoKg(v.ritmo)} kg/sem ·
       ${v.estable ? 'estable' : 'ritmo alto'}`
    : `hacen falta ${VENTANA_MAGRA} días entre mediciones para leerlo`;

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

function renderComposicionKPIs() {
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
  renderProgress();
  const n=DATA.length;
  const MET=objetivoMolecular();
  const sl=[...DATA.map(d=>d.fecha),'🎯 Objetivo'];
  const ga=[...DATA.map(d=>+(d.peso-d.ecf-d.icf-d.prot-d.min).toFixed(1)),grasaMetaKg()];
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
        const dv=+((sueloMlg()+grasaMetaKg())-DATA[n-1].peso).toFixed(1);
        ctx.save(); ctx.font='bold 8.5px system-ui'; ctx.fillStyle='#15803d';
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(dv.toFixed(1),bar.x,bar.y-2); ctx.restore(); return;
      }
      ctx.save(); ctx.font='bold 9.5px system-ui'; ctx.fillStyle='#064e3b';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(DATA[i].peso.toFixed(1)+' kg',bar.x,ty+3); ctx.restore();
      if(i===0) return;
      const dP=+(DATA[i].peso-DATA[i-1].peso).toFixed(1);
      ctx.save(); ctx.font='bold 8.5px system-ui';
      ctx.fillStyle=dP<0?'#15803d':'#dc2626';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText((dP>=0?'+':'')+dP.toFixed(1),bar.x,bar.y-2); ctx.restore();
    });
  }};
  if(chartReg.cStack) chartReg.cStack.destroy();
  chartReg.cStack=new Chart(document.getElementById('cStack'),{type:'bar',
    data:{labels:sl, datasets:[
      {label:'ECF',      data:[...DATA.map(d=>d.ecf),  MET.ecf],  backgroundColor:bgs('#5b9bd5','#5b9bd566'),  borderColor:bgs('rgba(0,0,0,0)','#1d4ed8'), borderWidth:bgs(0,2), stack:'s'},
      {label:'ICF',      data:[...DATA.map(d=>d.icf),  MET.icf],  backgroundColor:bgs('#2471a3','#2471a366'),  borderColor:bgs('rgba(0,0,0,0)','#1e3a8a'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Proteínas',data:[...DATA.map(d=>d.prot), MET.prot], backgroundColor:bgs('#52b788','#52b78866'),  borderColor:bgs('rgba(0,0,0,0)','#14532d'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Minerales',data:[...DATA.map(d=>d.min),  MET.min],  backgroundColor:bgs('#f0b429','#f0b42966'),  borderColor:bgs('rgba(0,0,0,0)','#78350f'), borderWidth:bgs(0,2), stack:'s'},
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
