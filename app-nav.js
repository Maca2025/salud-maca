/* ================================================================
   LOGIC MODULE: NAVEGACIÓN
   Maneja el flujo home ↔ secciones y pestañas internas.
   HOW TO UPDATE: Al añadir sección nueva, incluir su id en el
   array de secciones de goHome() y gotoSection().
================================================================ */
const lazyInited = {composicion:false, recomposicion:false, resumen:false, sangre:false, planes:false, suplementos:false, fotos:false};

function goHome() {
  ['composicion','laboratorio','planes','suplementos','fotos'].forEach(s=>document.getElementById('section-'+s).style.display='none');
  document.getElementById('home-view').style.display='block';
}

function gotoSection(id) {
  document.getElementById('home-view').style.display='none';
  ['composicion','laboratorio','planes','suplementos','fotos'].forEach(s=>document.getElementById('section-'+s).style.display='none');
  document.getElementById('section-'+id).style.display='block';
  if(id==='composicion'&&!lazyInited.composicion){
    requestAnimationFrame(()=>{initComposicion(); lazyInited.composicion=true;});
  }
  if(id==='laboratorio'&&!lazyInited.sangre){
    requestAnimationFrame(()=>{initSangre(); lazyInited.sangre=true;});
  }
  if(id==='planes'&&!lazyInited.planes){
    requestAnimationFrame(()=>{initPlanes(); lazyInited.planes=true;});
  }
  if(id==='suplementos'&&!lazyInited.suplementos){
    requestAnimationFrame(()=>{initSuplementos(); lazyInited.suplementos=true;});
  }
  if(id==='fotos'&&!lazyInited.fotos){
    requestAnimationFrame(()=>{initFotos(); lazyInited.fotos=true;});
  }
}

function switchCompTab(id, btn) {
  document.querySelectorAll('#section-composicion .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#comp-tab-nav .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('comp-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='composicion'&&!lazyInited.composicion){
    requestAnimationFrame(()=>{initComposicion(); lazyInited.composicion=true;});
  }
  if(id==='resumen'&&!lazyInited.resumen){
    requestAnimationFrame(()=>{initResumen(); lazyInited.resumen=true;});
  }
  if(id==='recomposicion'&&!lazyInited.recomposicion){
    requestAnimationFrame(()=>{initRecomposicion(); lazyInited.recomposicion=true;});
  }
}


/* ================================================================
   LOGIC MODULE: INIT
   Corre al cargar la página (el script está al final del body,
   así que el DOM ya está listo).
   Pobla home y las partes estáticas de composición.
================================================================ */

/* Convierte la respuesta de la API en las estructuras que ya usa la página */
function pon(id, html){ const e=document.getElementById(id); if(e) e.innerHTML = html||''; }

function hidratar(d){
  // Textos con información clínica: llegan del Apps Script, no del repositorio
  const t = d.textos || {};
  pon('lab-alerta',   t.alertaLab ? `<div class="alert-box">${t.alertaLab}</div>` : '');
  pon('lab-notas',    t.notasLab || '');
  pon('gloss-device', t.notaDispositivo || '');
  pon('pie',          t.pie || 'Datos cargados desde Google Sheets');
  EQUIPO = t.equipo || '';

  // ── Composición corporal ──
  DATA = (d.composicion || []).map(m => ({
    fecha: m.fecha, peso: m.peso, ecf: m.ecf, icf: m.icf, prot: m.prot, min: m.min,
    grasa: m.grasa, smm: m.smm, pbf: m.pbf, bmi: m.bmi, score: m.score,
    tmb: m.tmb, grasaVisc: m.grasaVisc
  }));
  DAYS = (d.composicion || []).map(m => m.dias);
  if(d.objetivo) OBJ = Object.assign({}, OBJ, d.objetivo);
  if(d.suelo)    SUELO = Object.assign({}, SUELO, d.suelo);
  VERSION_API = d.version || '';

  // ── Laboratorio ──
  const lab = d.laboratorio || {fechas:[], marcadores:[], secciones:[]};
  SFECHAS = lab.fechas || [];
  SD = {}; SR = {};
  (lab.marcadores || []).forEach(m => { SD[m.key] = m.valores; SR[m.key] = [m.min, m.max]; });
  const porKey = {};
  (lab.marcadores || []).forEach(m => { porKey[m.key] = m; });
  SSECTIONS = (lab.secciones || []).map(s => ({
    title: s.title,
    rows: (s.keys || []).filter(k => porKey[k]).map(k => ({
      key: k, label: porKey[k].label, unit: porKey[k].unit,
      ref: porKey[k].ref, note: porKey[k].note || undefined
    }))
  }));

  // ── Suplementos y textos clínicos ──
  SUPS.length = 0;
  // Los suspendidos no entran en memoria: no se muestran, no se cuentan
  // y no pueden reaparecer por accidente en ningún cálculo.
  (d.suplementos || []).forEach(s => { if(!supSuspendido(s)) SUPS.push(s); });
  // Tabla de alimentos: primero, porque los planes la necesitan
  ALIMENTOS = d.alimentos || [];
  _indiceAlimentos = null;
  OPTIMOS = d.optimos || {};
  INGESTA = d.ingesta || [];

  // Planes nutricionales: si la hoja trae planes, sustituyen a los del archivo
  if(d.planes && Object.keys(d.planes).length){
    hidratarPlanes(d.planes);
  }
  if(ALIMENTOS.length) recalcularTodasLasRecetas();
  EXP = d.explicaciones || {};
  INTERACCIONES = d.interacciones || [];
  STATUS_PANEL = d.estado || {controlados:[], vigilancia:[], pendientes:[]};
}

