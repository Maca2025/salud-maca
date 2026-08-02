/* ================================================================
   LOGIC MODULE: COMPOSICIÓN CORPORAL
   KPIs, widget de progreso, stacked bar, gráficas de línea, tablas.
================================================================ */
function renderProgress() {
  const first=DATA[0], last=DATA[DATA.length-1];
  if(!first || !last){ document.getElementById('progressWidget').innerHTML=''; return; }

  // ── Lo que de verdad importa: grasa fuera, músculo dentro ──
  const grasaIni = first.grasa, grasaAct = last.grasa;
  const grasaMeta = (OBJ.grasa != null) ? OBJ.grasa : 15;
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
      <h4>🎯 Progreso hacia ${grasaMeta} kg de grasa</h4>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pctGrasa}%"></div>
      </div>
      <div class="progress-labels">
        <span>Inicio: ${grasaIni} kg de grasa</span>
        <span style="color:#2d6a4f;font-weight:700">${pctGrasa}% completado</span>
        <span>Meta: ${grasaMeta} kg</span>
      </div>

      <div class="prog-destacado">
        <div class="prog-big">
          <strong>−${grasaFuera} kg</strong>
          <span>de grasa fuera</span>
        </div>
        <div class="prog-big ${musculo>=0?'bueno':'ojo'}">
          <strong>${musculo>=0?'+':''}${musculo} kg</strong>
          <span>de músculo</span>
        </div>
        ${calidad!=null ? `<div class="prog-big">
          <strong>${calidad}%</strong>
          <span>de lo perdido fue grasa</span>
        </div>` : ''}
      </div>

      <div class="progress-stats">
        <div class="progress-stat"><strong>${grasaFalta} kg</strong><br>de grasa por perder</div>
        <div class="progress-stat"><strong>${ritmoGrasa.toFixed(2)} kg/sem</strong><br>ritmo de grasa</div>
        <div class="progress-stat highlight"><strong>${metaStr}</strong><br>estimado por grasa</div>
        ${pesoEnMeta!=null ? `<div class="progress-stat"><strong>~${pesoEnMeta} kg</strong><br>peso si conservas músculo</div>` : ''}
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

      <div class="progress-caveat">La fecha asume que el ritmo actual de pérdida de grasa se mantiene.
      ${pesoEnMeta!=null && OBJ.peso ? `Ojo: llegar a ${grasaMeta} kg de grasa conservando tu músculo
      te dejaría cerca de <strong>${pesoEnMeta} kg</strong>, no de ${OBJ.peso} kg — bajar de ahí
      implicaría perder músculo.` : ''}</div>
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
    filas += `<tr class="${gano?'recomp-win':''}">
      <td>${esc(a.fecha)} → ${esc(b.fecha)}</td>
      <td class="${dP<0?'d-good':dP>0?'d-bad':''}">${dP>=0?'+':''}${dP}</td>
      <td class="${dG<0?'d-good':dG>0?'d-bad':''}">${dG>=0?'+':''}${dG}</td>
      <td class="${dS>0?'d-good':dS<0?'d-bad':''}">${dS>=0?'+':''}${dS}</td>
      <td>${cal!=null?cal+'%':'—'}</td>
      <td>${gano?'<span class="recomp-badge">recomposición</span>':''}</td>
    </tr>`;
  }
  const n = detectarRecomposicion().length;
  cont.innerHTML = `
    <div class="tbl-section">Cambio entre mediciones</div>
    <div class="recomp-leyenda">Marcados los periodos donde el peso se movió poco o subió,
      pero perdiste grasa o ganaste músculo — <strong>${n} de ${DATA.length-1}</strong> intervalos.
      La columna <em>calidad</em> es qué proporción de lo bajado fue grasa.</div>
    <div class="table-scroll"><table>
      <thead><tr><th>Periodo</th><th>Δ Peso</th><th>Δ Grasa</th><th>Δ Músculo</th><th>Calidad</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
}

function renderComposicionKPIs() {
  const first=DATA[0], last=DATA[DATA.length-1];
  function kpiCard(label,val,prev,unit,bg,clr,meta){
    const d=val-prev, sign=d>0?'+':'';
    let goal='';
    if(meta!==null && meta!==undefined && !isNaN(meta)){
      const dif = val-meta, s = dif>0?'':'+';
      goal = `<div class="kpi-goal">
        <div class="kpi-goal-label" style="color:${clr}99">Meta</div>
        <div class="kpi-goal-value" style="color:${clr}">${meta.toFixed(1)}${unit}</div>
        <div class="kpi-goal-sub" style="color:${clr}cc">Faltan bajar ${s}${dif.toFixed(1)}${unit}</div>
      </div>`;
    }
    return`<div class="kpi" style="background:${bg};border-color:${clr}33">
      <div class="kpi-main">
        <div class="kpi-label" style="color:${clr}aa">${label}</div>
        <div class="kpi-value" style="color:${clr}">${val}${unit}</div>
        <span class="kpi-delta" style="color:${clr}cc">${sign}${d.toFixed(1)} vs inicio</span>
      </div>${goal}</div>`;
  }
  document.getElementById('kpis').innerHTML=
    kpiCard('Peso total',   last.peso, first.peso,' kg','#ecfdf5','#064e3b', OBJ.peso)+
    kpiCard('Grasa corporal',last.grasa,first.grasa,' kg','#fff1f2','#9f1239', OBJ.grasa)+
    kpiCard('Minerales',    last.min,  first.min,' kg','#fffbeb','#78350f', OBJ.min)+
    kpiCard('Proteínas',    last.prot, first.prot,' kg','#f0fdf4','#14532d', OBJ.prot)+
    kpiCard('ICF · Intracelular',last.icf,first.icf,' kg','#dbeafe','#1e3a8a', OBJ.icf)+
    kpiCard('ECF · Extracelular',last.ecf,first.ecf,' kg','#eff6ff','#1d4ed8', OBJ.ecf);
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

function initComposicion() {
  renderProgress();
  const n=DATA.length;
  const sl=[...DATA.map(d=>d.fecha),'🎯 Objetivo'];
  const ga=[...DATA.map(d=>+(d.peso-d.ecf-d.icf-d.prot-d.min).toFixed(1)),OBJ.grasa];
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
        ctx.fillText('65.0 kg',bar.x,ty+3); ctx.restore();
        const dv=+(OBJ.peso-DATA[n-1].peso).toFixed(1);
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
      {label:'ECF',      data:[...DATA.map(d=>d.ecf),  OBJ.ecf],  backgroundColor:bgs('#5b9bd5','#5b9bd566'),  borderColor:bgs('rgba(0,0,0,0)','#1d4ed8'), borderWidth:bgs(0,2), stack:'s'},
      {label:'ICF',      data:[...DATA.map(d=>d.icf),  OBJ.icf],  backgroundColor:bgs('#2471a3','#2471a366'),  borderColor:bgs('rgba(0,0,0,0)','#1e3a8a'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Proteínas',data:[...DATA.map(d=>d.prot), OBJ.prot], backgroundColor:bgs('#52b788','#52b78866'),  borderColor:bgs('rgba(0,0,0,0)','#14532d'), borderWidth:bgs(0,2), stack:'s'},
      {label:'Minerales',data:[...DATA.map(d=>d.min),  OBJ.min],  backgroundColor:bgs('#f0b429','#f0b42966'),  borderColor:bgs('rgba(0,0,0,0)','#78350f'), borderWidth:bgs(0,2), stack:'s'},
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
