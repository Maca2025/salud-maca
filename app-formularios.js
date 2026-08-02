/* ════════════════════════════════════════════════════════════
   FORMULARIOS DE CAPTURA
   Escriben directo en las hojas vía Apps Script, para no tener
   que abrir Drive y teclear a mano.
   ════════════════════════════════════════════════════════════ */
const MEDICION_CAMPOS = [
  {k:'peso',  l:'Peso',        u:'kg',   req:true},
  {k:'grasa', l:'Grasa',       u:'kg'},
  {k:'smm',   l:'Músculo SMM', u:'kg'},
  {k:'pbf',   l:'% Grasa PBF', u:'%'},
  {k:'ecf',   l:'ECF',         u:'kg'},
  {k:'icf',   l:'ICF',         u:'kg'},
  {k:'prot',  l:'Proteínas',   u:'kg'},
  {k:'min',   l:'Minerales',   u:'kg'},
  {k:'bmi',   l:'IMC',         u:''},
  {k:'score', l:'Puntuación',  u:''},
  {k:'tmb',   l:'TMB',         u:'kcal'},
  {k:'grasaVisc', l:'Grasa visceral', u:'/20'},
];

/* "sep-26" → "2026-09" para el input month */
function etiquetaAMes(etq){
  if(!etq) return null;
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const m = String(etq).toLowerCase().match(/^([a-z]{3})-(\d{2})$/);
  if(!m) return null;
  const i = MESES.indexOf(m[1]);
  if(i < 0) return null;
  return `20${m[2]}-${String(i+1).padStart(2,'0')}`;
}

/* ════════════════════════════════════════════════════════════
   CRUCE LABORATORIO ↔ SUPLEMENTOS
   Cada marcador declara qué suplementos lo influyen. Aquí se mide
   qué tan consistentemente los estás tomando, para saber si un
   valor fuera de rango es por falta de adherencia o pese a ella.
   ════════════════════════════════════════════════════════════ */
function adherenciaDe(supId, dias = 30){
  if(!_regEntries || !_regEntries.length) return null;
  const corte = new Date(); corte.setDate(corte.getDate()-dias);
  const porDia = {};
  _regEntries.forEach(e=>{
    const iso = entryFechaISO(e); if(!iso) return;
    if(new Date(iso+'T00:00:00') < corte) return;
    const t = entryTomas(e);
    if(t[supId]) porDia[iso] = true;
    else if(!(iso in porDia)) porDia[iso] = false;
  });
  const total = Object.keys(porDia).length;
  if(!total) return null;
  const tomados = Object.values(porDia).filter(Boolean).length;
  return {dias: total, tomados, pct: Math.round(tomados/total*100)};
}

/* Resumen del cruce para un marcador: qué toma, con qué constancia. */
function soporteDe(key){
  const o = OPTIMOS[key];
  if(!o || !o.suplementos || !o.suplementos.length) return null;
  const items = o.suplementos.map(id=>{
    const s = supById(id);
    return {id, nombre: s ? s.sustancia : id, existe: !!s, adh: adherenciaDe(id)};
  });
  const conDatos = items.filter(x=>x.adh);
  const media = conDatos.length
    ? Math.round(conDatos.reduce((a,x)=>a+x.adh.pct,0)/conDatos.length)
    : null;
  return {items, media, sinRegistro: !conDatos.length};
}

/* Explica de dónde sale el objetivo óptimo de un marcador. */
function verNotaOptimo(key){
  const o = OPTIMOS[key];
  if(!o) return;
  const m = (SSECTIONS.flatMap(s=>s.rows)).find(r=>r.key===key);
  const EV = {
    guia:      {t:'Guía clínica', d:'Recomendación de guías o sociedades médicas.'},
    practica:  {t:'Criterio clínico', d:'Práctica habitual, sin una guía formal detrás.'},
    funcional: {t:'Medicina funcional', d:'Objetivo de medicina funcional. NO respaldado por guías de consenso — tómalo como referencia para conversar con tu médico, no como un umbral establecido.'},
  };
  const ev = EV[o.evidencia] || EV.practica;
  const rango = `${o.min!=null?o.min:'—'} a ${o.max!=null?o.max:'—'}`;

  // Dónde está ahora y hacia dónde
  const a = SD[key] || [];
  let ult=null, prev=null;
  for(let k=a.length-1;k>=0;k--){
    if(a[k]==null) continue;
    if(ult===null) ult=a[k]; else { prev=a[k]; break; }
  }
  const bajo  = o.min!=null && ult!=null && ult < o.min;
  const alto  = o.max!=null && ult!=null && ult > o.max;
  const dentro = ult!=null && !bajo && !alto;

  // Qué falta para llegar
  let brecha = '';
  if(bajo)      brecha = `Te faltan <strong>${(o.min-ult).toFixed(1)} ${esc(m?m.unit:'')}</strong> para entrar al objetivo.`;
  else if(alto) brecha = `Estás <strong>${(ult-o.max).toFixed(1)} ${esc(m?m.unit:'')}</strong> por encima del objetivo.`;

  // Tendencia
  let tend = '';
  if(prev!=null && ult!=null){
    const d = +(ult-prev).toFixed(2);
    if(d!==0){
      const acercando = bajo ? d>0 : alto ? d<0 : true;
      tend = `<span class="tend ${acercando?'bien':'mal'}">
        ${d>0?'▲':'▼'} ${Math.abs(d)} desde la medición anterior
        ${acercando?'· vas en la dirección correcta':'· se está alejando'}</span>`;
    }
  }

  // Cruce con suplementos
  const sop = soporteDe(key);
  let bloqueSup = '';
  if(sop){
    const filas = sop.items.map(x=>{
      if(!x.existe) return `<div class="sop-item falta">
        <span class="sop-nom">${esc(x.nombre)}</span>
        <span class="sop-est">no está en tu protocolo</span></div>`;
      if(!x.adh) return `<div class="sop-item">
        <span class="sop-nom">${esc(x.nombre)}</span>
        <span class="sop-est">sin registro suficiente</span></div>`;
      const cls = x.adh.pct>=80?'alta':x.adh.pct>=50?'media':'baja';
      return `<div class="sop-item">
        <span class="sop-nom">${esc(x.nombre)}</span>
        <div class="sop-bar"><div class="sop-fill ${cls}" style="width:${x.adh.pct}%"></div></div>
        <span class="sop-pct ${cls}">${x.adh.pct}%</span>
      </div>`;
    }).join('');

    // La lectura que importa
    let lectura = '';
    if(!sop.sinRegistro && (bajo||alto)){
      if(sop.media < 60){
        lectura = `<div class="sop-lectura ojo">Estás tomando esto el <strong>${sop.media}%</strong>
          de los días. Antes de concluir que el tratamiento no funciona, vale la pena
          subir la constancia y volver a medir.</div>`;
      } else {
        lectura = `<div class="sop-lectura">Tu adherencia es del <strong>${sop.media}%</strong>,
          o sea que el valor sigue fuera de rango <em>pese a</em> estar tomándolo.
          Eso es justo lo que conviene comentarle a tu médico.</div>`;
      }
    } else if(!sop.sinRegistro && dentro){
      lectura = `<div class="sop-lectura bien">Estás en objetivo con una adherencia del
        <strong>${sop.media}%</strong>. Mantener eso es lo que sostiene el resultado.</div>`;
    }

    bloqueSup = `<div class="opt-sec">
      <strong>Qué estás tomando para esto</strong>
      ${filas}${lectura}
      <div class="sop-pie">Adherencia de los últimos 30 días registrados.</div>
    </div>`;
  }

  const secciones = [
    (bajo && o.efectoBajo)  ? {t:'Qué pasa estando por debajo', c:o.efectoBajo, cls:'ojo'} : null,
    (alto && o.efectoAlto)  ? {t:'Qué pasa estando por encima', c:o.efectoAlto, cls:'ojo'} : null,
    o.alOptimo              ? {t:dentro?'Lo que sostienes al estar aquí':'Qué esperar al llegar al objetivo', c:o.alOptimo, cls:'bien'} : null,
    (!bajo && o.efectoBajo) ? {t:'Si bajara del objetivo', c:o.efectoBajo, cls:''} : null,
    (!alto && o.efectoAlto) ? {t:'Si subiera de más', c:o.efectoAlto, cls:''} : null,
  ].filter(Boolean);

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="form-modal">
      <div class="blk-modal-hdr">
        <span>${esc(m?m.label:key)} · objetivo ${esc(rango)}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        ${ult!=null ? `<div class="opt-ahora ${bajo||alto?'fuera':'dentro'}">
          <div class="oa-val">${ult} <span>${esc(m?m.unit:'')}</span></div>
          <div class="oa-txt">${brecha || 'Dentro del objetivo.'} ${tend}</div>
        </div>` : ''}

        ${secciones.map(s=>`<div class="opt-sec ${s.cls}">
          <strong>${s.t}</strong>
          <p>${esc(s.c)}</p>
        </div>`).join('')}

        ${bloqueSup}

        ${o.tiempo ? `<div class="opt-tiempo">⏱️ Este marcador tarda
          <strong>${esc(o.tiempo)}</strong> en reflejar un cambio. Medirlo antes
          suele confundir más que ayudar.</div>` : ''}

        <div class="opt-ev ${o.evidencia==='funcional'?'ojo':''}">
          <strong>${ev.t}</strong>
          <div>${ev.d}</div>
        </div>
        <div class="opt-nota">${esc(o.nota)}</div>
        <div class="opt-pie">Rango del laboratorio: ${esc(m?m.ref:'—')} ${esc(m?m.unit:'')}.
          Ese rango indica ausencia de enfermedad; el objetivo óptimo es a dónde quieres llegar.
          Nada de esto sustituye la opinión de tu médico.</div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cerrar</button>
      </div>
    </div>
  </div>`;
}

function cerrarForm(){ const h=document.getElementById('form-host'); if(h) h.innerHTML=''; }

function abrirFormMedicion(pre){
  const ult = DATA.length ? DATA[DATA.length-1] : null;
  const campo = f => `
    <div class="form-campo">
      <label for="med-${f.k}">${esc(f.l)} ${f.u?`<span class="op">${esc(f.u)}</span>`:''}
        ${f.req?'<span style="color:#c0392b">*</span>':''}</label>
      <input type="number" step="any" inputmode="decimal" id="med-${f.k}"
        value="${pre && pre[f.k]!=null ? pre[f.k] : ''}"
        class="${pre && pre[f.k]!=null ? 'extraido' : ''}"
        placeholder="${ult && ult[f.k]!=null ? ult[f.k] : ''}">
    </div>`;

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onclick="if(event.target===this)cerrarForm()">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>🌿 Nueva medición</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="med-msg" class="form-msg ${pre?'ok':'info'}">
          ${pre
            ? '📄 Valores leídos del documento — <strong>revísalos</strong> antes de guardar.'
            : `Solo el peso es obligatorio. Los grises son los valores de tu última medición${ult?` (${esc(ult.fecha)})`:''}, como referencia.`}
        </div>
        <div class="form-campo" style="max-width:190px">
          <label for="med-fecha">Fecha de la medición</label>
          <input type="date" id="med-fecha" value="${(pre && /^\d{4}-\d{2}-\d{2}$/.test(pre.fecha)) ? pre.fecha : hoyISO()}" max="${hoyISO()}"
            onchange="document.getElementById('med-dias').textContent=diasTexto(this.value)">
          <div class="form-calc" id="med-dias">${diasTexto((pre && /^\d{4}-\d{2}-\d{2}$/.test(pre.fecha)) ? pre.fecha : hoyISO())}</div>
        </div>
        <div class="form-sec">Principales</div>
        <div class="form-grid">${MEDICION_CAMPOS.slice(0,4).map(campo).join('')}</div>
        <div class="form-sec">Composición molecular</div>
        <div class="form-grid">${MEDICION_CAMPOS.slice(4,8).map(campo).join('')}</div>
        <div class="form-sec">Índices</div>
        <div class="form-grid">${MEDICION_CAMPOS.slice(8).map(campo).join('')}</div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="med-guardar" onclick="guardarMedicionForm()">Guardar medición</button>
      </div>
    </div>
  </div>`;
  setTimeout(()=>{ const e=document.getElementById('med-peso'); if(e) e.focus(); }, 60);
}

function diasTexto(iso){
  const a = new Date('2026-03-16T00:00:00'), b = new Date(iso+'T00:00:00');
  const d = Math.round((b-a)/86400000);
  return d>=0 ? `Día ${d} de la serie` : '⚠️ Anterior al inicio de la serie';
}

async function guardarMedicionForm(){
  const msg = document.getElementById('med-msg');
  const btn = document.getElementById('med-guardar');
  const params = {action:'medicion', fecha: document.getElementById('med-fecha').value};

  document.querySelectorAll('#form-host input').forEach(i=>i.classList.remove('err'));

  const peso = document.getElementById('med-peso');
  if(!peso.value.trim()){
    peso.classList.add('err');
    msg.className='form-msg err'; msg.textContent='El peso es obligatorio.';
    peso.focus(); return;
  }
  let malos = [];
  MEDICION_CAMPOS.forEach(f=>{
    const el = document.getElementById('med-'+f.k);
    const v  = el.value.trim();
    if(!v) return;
    if(isNaN(Number(v))){ el.classList.add('err'); malos.push(f.l); return; }
    params[f.k] = v;
  });
  if(malos.length){
    msg.className='form-msg err'; msg.textContent='Revisa: '+malos.join(', ');
    return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api(params);
    msg.className='form-msg ok';
    msg.textContent = `✓ ${r.actualizado?'Actualizada':'Guardada'} la medición del ${r.fecha} (día ${r.dias}).`;
    btn.textContent = '✓ Guardada';
    setTimeout(()=>{ cerrarForm(); recargarDatos(); }, 900);
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar medición';
  }
}

