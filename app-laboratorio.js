/* ================================================================
   LOGIC MODULE: LABORATORIO
   Panel de estado, tooltip clínico, tabla y gráficas de sangre.
================================================================ */
function renderStatusPanel() {
  function col(cls, icon, title, items) {
    return `<div class="status-col ${cls}">
      <div class="status-col-title">${icon} ${title}</div>
      ${items.map(it=>`<div class="status-item">
        <strong>${it.label} — ${it.val}</strong>
        <span>${it.note}</span>
      </div>`).join('')}
    </div>`;
  }
  document.getElementById('statusPanel').innerHTML = `<div class="status-panel">
    ${col('ok',  '✅', 'Controlados', STATUS_PANEL.controlados)}
    ${col('warn','⚠️', 'Vigilancia',  STATUS_PANEL.vigilancia)}
    ${col('bad', '❌', 'Pendientes',  STATUS_PANEL.pendientes)}
  </div>`;
}

function sCell(key, i, dateLabel) {
  const v = SD[key][i];
  if(v===null) return '<td class="val-none">—</td>';
  const [lo, hi] = SR[key];
  const tooLow  = lo!==null && v<lo;
  const tooHigh = hi!==null && v>hi;
  const disp = (key==='vitB12'&&v===2000)?'>2,000' : (key==='antiTPO'&&v===1000)?'>1,000' : v;
  const arrow = tooLow?' ↓' : tooHigh?' ↑' : '';
  if(tooLow||tooHigh) {
    const dir  = tooLow?'low':'high';
    const ek   = `${key}_${dir}`;
    const cl   = tooLow?'val-low':'val-high';
    const dStr = `${disp}${arrow}`.replace(/'/g,"\\'");
    const dEsc = dateLabel.replace(/'/g,"\\'");
    if(EXP[ek]) return `<td class="${cl}" onclick="showTip(event,'${ek}','${dStr}','${dEsc}')" title="Haz clic para explicación clínica">${disp}${arrow} ⓘ</td>`;
    return `<td class="${cl}">${disp}${arrow}</td>`;
  }
  return `<td class="val-ok">${disp}</td>`;
}

function showTip(event, expKey, dispVal, dateLabel) {
  const exp = EXP[expKey]; if(!exp) return;
  document.getElementById('stip-titulo').textContent = exp.titulo;
  document.getElementById('stip-val').textContent    = dispVal+' · '+dateLabel;
  document.getElementById('stip-que').textContent    = exp.que;
  document.getElementById('stip-efecto').textContent = exp.efecto;
  document.getElementById('stip-trat').textContent   = exp.tratamiento;
  const box = document.getElementById('stip');
  box.style.display = 'block';
  const vw=window.innerWidth, vh=window.innerHeight;
  let x=event.clientX+14, y=event.clientY+14;
  box.style.left=x+'px'; box.style.top=y+'px';
  requestAnimationFrame(()=>{
    const r=box.getBoundingClientRect();
    if(r.right>vw-8)  box.style.left=Math.max(8,vw-r.width-8)+'px';
    if(r.bottom>vh-8) box.style.top=Math.max(8,event.clientY-r.height-14)+'px';
  });
  event.stopPropagation();
}
function closeTip() { document.getElementById('stip').style.display='none'; }

function initSangre() {
  // El cruce con suplementos necesita el historial; si no está, se pide y se repinta
  if(!_regEntries || !_regEntries.length){
    cargarRegistro().then(()=>{ if(_regEntries && _regEntries.length) initSangre(); });
  }
  // KPI cards
  const ks = document.getElementById('kpisSangre');

  // Valor más reciente y el anterior de un marcador
  const serie = k => {
    const a = SD[k];
    if(!Array.isArray(a)) return {ult:null, prev:null, iUlt:-1};
    let ult=null, prev=null, iUlt=-1;
    for(let i=a.length-1;i>=0;i--){
      if(a[i]===null || a[i]===undefined) continue;
      if(ult===null){ ult=a[i]; iUlt=i; } else { prev=a[i]; break; }
    }
    return {ult, prev, iUlt};
  };

  /* Posición del valor en una escala que abarca referencia y óptimo,
     para dibujar la barrita de contexto. */
  function escala(v, ref, opt){
    const cand = [v];
    [ref, opt].forEach(r=>{ if(!r) return;
      if(r.min!=null) cand.push(r.min);
      if(r.max!=null) cand.push(r.max); });
    let lo = Math.min(...cand), hi = Math.max(...cand);
    const margen = (hi-lo)*0.18 || Math.abs(v*0.2) || 1;
    lo -= margen; hi += margen;
    const pos = x => x==null ? null : Math.max(0, Math.min(100, (x-lo)/(hi-lo)*100));
    return {pos};
  }

  const EVID = {
    guia:      {txt:'guía clínica',    cls:'ev-guia'},
    practica:  {txt:'criterio clínico',cls:'ev-practica'},
    funcional: {txt:'medicina funcional', cls:'ev-funcional'},
  };

  function tarjetaLab(key){
    const m = (SSECTIONS.flatMap(s=>s.rows)).find(r=>r.key===key);
    if(!m) return '';
    const {ult, prev, iUlt} = serie(key);
    if(ult===null) return '';
    const ref = SR[key] ? {min:SR[key][0], max:SR[key][1]} : null;
    const o   = OPTIMOS[key] || null;

    const enOptimo = o && (o.min==null || ult>=o.min) && (o.max==null || ult<=o.max);
    const enRef    = ref && (ref.min==null || ult>=ref.min) && (ref.max==null || ult<=ref.max);

    let estado, clr, bg;
    if(enOptimo){        estado='en óptimo';       clr='#15803d'; bg='#f0fdf4'; }
    else if(enRef){      estado='normal, no óptimo'; clr='#b45309'; bg='#fffbeb'; }
    else {               estado='fuera de rango';  clr='#be123c'; bg='#fff1f2'; }

    // Cambio respecto a la medición anterior
    let delta = '';
    if(prev!==null){
      const d = +(ult-prev).toFixed(2);
      if(d!==0) delta = `<span class="lab-delta">${d>0?'▲':'▼'} desde ${prev}</span>`;
    }

    // Barra de contexto
    let barra = '';
    if(o || ref){
      const e = escala(ult, ref, o);
      const seg = (r, cls) => {
        if(!r) return '';
        const a = e.pos(r.min!=null?r.min:null), b = e.pos(r.max!=null?r.max:null);
        const x0 = a!=null?a:0, x1 = b!=null?b:100;
        return `<div class="lab-seg ${cls}" style="left:${x0}%;width:${Math.max(1,x1-x0)}%"></div>`;
      };
      barra = `<div class="lab-barra">
        ${seg(ref,'seg-ref')}${seg(o,'seg-opt')}
        <div class="lab-marca" style="left:${e.pos(ult)}%"></div>
      </div>`;
    }

    const objetivo = o
      ? `${o.min!=null?o.min:''}${o.min!=null&&o.max!=null?'–':''}${o.max!=null?(o.min==null?'< '+o.max:o.max):(o.min!=null?'+':'')}`
      : null;
    const ev = o ? (EVID[o.evidencia] || EVID.practica) : null;

    return `<div class="lab-card" style="background:${bg};border-color:${clr}33">
      <div class="lab-nom" style="color:${clr}aa">${esc(m.label)}</div>
      <div class="lab-val" style="color:${clr}">${ult}<span>${esc(m.unit||'')}</span></div>
      <div class="lab-estado" style="color:${clr}">${estado} ${delta}</div>
      ${barra}
      <div class="lab-rangos">
        ${o ? `<span class="lab-opt">óptimo ${objetivo}</span>` : ''}
        <span class="lab-ref">lab ${esc(m.ref||'')}</span>
      </div>
      ${(()=>{ const s=soporteDe(key);
        if(!s || s.sinRegistro || enOptimo || s.media>=60) return '';
        return `<div class="lab-adh">💊 adherencia ${s.media}%</div>`; })()}
      ${o && o.nota ? `<button class="lab-info" onclick="verNotaOptimo('${key}')">
        ver detalle <span class="ev-tag ${ev.cls}">${ev.txt}</span></button>` : ''}
    </div>`;
  }

  // Se muestran los marcadores marcados como destacado en la hoja de óptimos
  const destacados = Object.keys(OPTIMOS).filter(k=>OPTIMOS[k].destacado);
  const orden = ['ferrit','vitD','tsh','hierro','hba1c','ldl'];
  destacados.sort((a,b)=>{
    const ia = orden.indexOf(a), ib = orden.indexOf(b);
    return (ia<0?99:ia) - (ib<0?99:ib);
  });
  const htmlCards = destacados.map(tarjetaLab).filter(Boolean).join('');
  ks.innerHTML = htmlCards || '<div style="color:#aaa;font-size:.82rem">Sin marcadores destacados. Marca alguno con 1 en la hoja de óptimos.</div>';
  ks.className = 'lab-cards';

  // Panel de estado
  renderStatusPanel();

  // Gráficas de seguimiento
  function refLine(val,lbl){
    return {label:lbl, data:SFECHAS.map(()=>val), borderColor:'#ef444488',
      borderDash:[5,3], pointRadius:0, fill:false, tension:0};
  }
  mkLineC('cTSH', SFECHAS,[ds('TSH',SD.tsh,'#e74c3c',{spanGaps:false}),refLine(4.45,'Límite (4.45)')],{min:0,max:8});
  mkLineC('cVitD',SFECHAS,[ds('Vitamina D',SD.vitD,'#2980b9',{spanGaps:true,fill:true}),refLine(30,'Suficiencia (30)')],{min:0,max:55});
  mkLineC('cHgb', SFECHAS,[ds('Hemoglobina',SD.hgb,'#8e44ad',{fill:true}),refLine(12.0,'Mín. (12.0)')],{min:10.5,max:14.5});
  mkLineC('cColS',SFECHAS,[ds('Colesterol total',SD.col,'#e67e22',{fill:true}),refLine(200,'Límite (<200)')],{min:180,max:275});

  // Tabla de marcadores
  let html='';
  SSECTIONS.forEach(sec=>{
    html+=`<tr class="tbl-sep"><td colspan="6">${sec.title}</td></tr>`;
    sec.rows.forEach(r=>{
      html+=`<tr>
        <td style="font-weight:600;color:#333;white-space:normal;min-width:120px">
          ${r.label}${r.note?`<br><span style="font-size:0.62rem;color:#aaa;font-weight:400">${r.note}</span>`:''}
        </td>
        <td style="color:#aaa;font-size:0.68rem;font-weight:400;text-align:left;white-space:normal">
          ${r.unit}<br><span style="color:#bbb">${r.ref}</span>
        </td>
        ${sCell(r.key,0,SFECHAS[0])}${sCell(r.key,1,SFECHAS[1])}
        ${sCell(r.key,2,SFECHAS[2])}${sCell(r.key,3,SFECHAS[3])}</tr>`;
    });
  });
  document.getElementById('tbodySangre').innerHTML = html;
}


