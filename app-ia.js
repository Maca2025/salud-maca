/* ════════════════════════════════════════════════════════════
   LECTURA DE DOCUMENTOS CON IA
   La IA solo PROPONE valores: siempre se revisan en el formulario
   antes de escribirlos. Son datos médicos, no se guardan a ciegas.
   ════════════════════════════════════════════════════════════ */
const TIPO_DOC = {
  lab:  {titulo:'Análisis de laboratorio', hint:'PDF o foto del análisis'},
  fit:  {titulo:'Reporte de composición',  hint:'PDF o foto del reporte de bioimpedancia'},
  plan: {titulo:'Plan nutricional',        hint:'PDF del plan semanal'},
};

function subirDocumento(tipo){
  const inp = document.getElementById('doc-input');
  inp.value = '';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if(!file) return;
    await procesarDocumento(tipo, file);
  };
  inp.click();
}

function overlayLectura(tipo, nombre){
  const t = TIPO_DOC[tipo] || {titulo:'Documento'};
  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg">
    <div class="form-modal" style="max-width:400px">
      <div class="blk-modal-hdr"><span>📄 ${esc(t.titulo)}</span></div>
      <div class="form-modal-body" style="text-align:center;padding:26px 20px">
        <div class="lector-spin">📄</div>
        <div id="lector-estado" style="font-size:.86rem;font-weight:700;color:#1b4332;margin-top:12px">
          Preparando el archivo…</div>
        <div style="font-size:.74rem;color:#999;margin-top:6px">${esc(nombre)}</div>
        <div style="font-size:.72rem;color:#bbb;margin-top:14px;line-height:1.5">
          Los valores que se extraigan los vas a revisar antes de guardarlos.</div>
      </div>
    </div>
  </div>`;
}
function estadoLectura(txt){
  const e = document.getElementById('lector-estado');
  if(e) e.textContent = txt;
}

async function procesarDocumento(tipo, file){
  overlayLectura(tipo, file.name);
  try {
    const prep = await prepararArchivo(file);
    estadoLectura('Leyendo el documento…');
    const r = await apiPost({action:'leerDocumento', tipo, mimeType:prep.mimeType, datos:prep.datos});
    cerrarForm();
    if(tipo === 'lab')  abrirFormAnalisis(r.datos);
    else if(tipo === 'fit')  abrirFormMedicion(r.datos);
    else if(tipo === 'plan') revisarPlan(r.datos);
  } catch(e){
    document.getElementById('form-host').innerHTML = `
    <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
      <div class="form-modal" style="max-width:400px">
        <div class="blk-modal-hdr"><span>No se pudo leer</span>
          <button onclick="cerrarForm()">×</button></div>
        <div class="form-modal-body">
          <div class="form-msg err">${esc(e.message)}</div>
          <div style="font-size:.76rem;color:#777;line-height:1.6">
            Puedes capturar los datos a mano, o intentar con una foto más nítida
            y bien encuadrada.</div>
        </div>
        <div class="blk-modal-foot">
          <button class="blk-btn ghost" onclick="cerrarForm()">Cerrar</button>
        </div>
      </div>
    </div>`;
  }
}

/* Revisión del plan extraído antes de guardarlo */
function revisarPlan(datos){
  const dias = (datos && datos.dias) || [];
  if(!dias.length){
    alert('No se reconocieron días en ese plan.');
    return;
  }
  const total = dias.reduce((n,d)=>{
    const c = d.comidas||{};
    return n + ['desayuno','comida','colacion','cena'].reduce((s,k)=>s+((c[k]||[]).length),0);
  },0);

  const cuerpo = dias.map(d=>{
    const c = d.comidas||{};
    const comidas = ['desayuno','comida','colacion','cena'].map(k=>{
      const l = c[k]||[];
      if(!l.length) return '';
      return `<div class="rp-comida"><span class="rp-tipo">${k}</span>
        ${l.map(p=>`<div class="rp-plat"><strong>${esc(p.platillo||'—')}</strong>
          <div class="rp-ing">${(p.ingredientes||[]).map(esc).join(' · ')}</div></div>`).join('')}
      </div>`;
    }).join('');
    return `<div class="rp-dia"><div class="rp-dia-nom">${esc(d.dia||'')}</div>${comidas}</div>`;
  }).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>🥗 Revisar plan extraído</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="plan-msg" class="form-msg info">
          Se reconocieron <strong>${dias.length} días</strong> y ${total} platillos.
          Revisa que esté bien antes de guardar.
        </div>
        <div class="form-campo" style="max-width:230px">
          <label for="plan-nombre">Nombre del plan</label>
          <input id="plan-nombre" value="${esc(datos.nombre||'')}" placeholder="Ej. Plan Agosto">
          <div class="form-calc">Si ya existe uno con ese nombre, se reemplaza.</div>
        </div>
        <div class="rp-lista">${cuerpo}</div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="plan-guardar"
          onclick='guardarPlanForm(${JSON.stringify(datos).replace(/'/g,"&#39;")})'>Guardar plan</button>
      </div>
    </div>
  </div>`;
}

async function guardarPlanForm(datos){
  const msg = document.getElementById('plan-msg');
  const btn = document.getElementById('plan-guardar');
  const nombre = document.getElementById('plan-nombre').value.trim();
  if(!nombre){ msg.className='form-msg err'; msg.textContent='Ponle nombre al plan.'; return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api({action:'guardarPlan', nombre, plan: JSON.stringify(datos)});
    msg.className='form-msg ok';
    msg.textContent = `✓ Plan "${r.plan}" guardado con ${r.platillos} platillos.`;
    setTimeout(()=>{ cerrarForm(); recargarDatos(); }, 900);
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar plan';
  }
}

/* ── Nuevo análisis de laboratorio ── */
function abrirFormAnalisis(pre){
  const vals = (pre && pre.valores) || {};
  const porSeccion = {};
  SSECTIONS.forEach(s=>{ porSeccion[s.title] = s.rows; });

  const bloques = Object.keys(porSeccion).map(sec=>`
    <div class="form-sec">${esc(sec)}</div>
    <div class="form-grid">
      ${porSeccion[sec].map(r=>`
        <div class="form-campo">
          <label for="lab-${r.key}">${esc(r.label)} <span class="op">${esc(r.unit||'')}</span></label>
          <input type="number" step="any" inputmode="decimal" id="lab-${r.key}"
            value="${vals[r.key]!=null ? vals[r.key] : ''}"
            class="${vals[r.key]!=null ? 'extraido' : ''}"
            placeholder="${esc(r.ref||'')}">
        </div>`).join('')}
    </div>`).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>🩸 Nuevo análisis</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="lab-msg" class="form-msg ${pre?'ok':'info'}">
          ${pre
            ? `📄 Se leyeron ${Object.keys(vals).length} marcadores del documento — <strong>revísalos</strong> antes de guardar.`
            : 'Llena solo los marcadores que trae tu análisis; los demás quedan vacíos. En gris aparece el rango de referencia.'}
        </div>
        <div class="form-campo" style="max-width:190px">
          <label for="lab-etiqueta">Fecha del análisis</label>
          <input type="month" id="lab-etiqueta" value="${etiquetaAMes(pre && pre.etiqueta) || hoyISO().slice(0,7)}" max="${hoyISO().slice(0,7)}">
          <div class="form-calc">Se guardará como columna nueva (ej. sep-26)</div>
        </div>
        ${bloques}
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="lab-guardar" onclick="guardarAnalisisForm()">Guardar análisis</button>
      </div>
    </div>
  </div>`;
}

async function guardarAnalisisForm(){
  const msg = document.getElementById('lab-msg');
  const btn = document.getElementById('lab-guardar');
  const ym  = document.getElementById('lab-etiqueta').value;   // AAAA-MM
  if(!ym){ msg.className='form-msg err'; msg.textContent='Elige la fecha del análisis.'; return; }

  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y,m] = ym.split('-');
  const etiqueta = `${MESES[parseInt(m,10)-1]}-${y.slice(2)}`;

  const valores = {};
  let malos = [];
  document.querySelectorAll('#form-host input[id^="lab-"]').forEach(el=>{
    const key = el.id.replace('lab-','');
    if(key==='etiqueta' || key==='guardar' || key==='msg') return;
    el.classList.remove('err');
    const v = el.value.trim();
    if(!v) return;
    if(isNaN(Number(v))){ el.classList.add('err'); malos.push(key); return; }
    valores[key] = Number(v);
  });
  if(malos.length){ msg.className='form-msg err'; msg.textContent='Revisa: '+malos.join(', '); return; }
  if(!Object.keys(valores).length){
    msg.className='form-msg err'; msg.textContent='Llena al menos un marcador.'; return;
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api({action:'analisis', etiqueta, valores: JSON.stringify(valores)});
    msg.className='form-msg ok';
    msg.textContent = `✓ ${r.escritos} marcador(es) guardados en la columna ${r.etiqueta}.`;
    btn.textContent = '✓ Guardado';
    setTimeout(()=>{ cerrarForm(); recargarDatos(); }, 900);
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar análisis';
  }
}

/* ── Ajustes de conexión ── */
function abrirAjustes(){
  const host = document.getElementById('ajustes-host');
  host.innerHTML = `
  <div class="blk-modal-bg" onmousedown="ajFondoDown(event,this)" onclick="ajFondoClick(event,this)">
    <div class="blk-modal">
      <div class="blk-modal-hdr"><span>⚙ Conexión con tus datos</span>
        <button onclick="cerrarAjustes()">×</button></div>
      <div class="blk-modal-body">
        <div style="font-size:.78rem;color:#666;line-height:1.55">
          Pega aquí la URL del <strong>Apps Script</strong> que desplegaste.
          Se guarda solo en este dispositivo — nunca viaja al repositorio de GitHub.
        </div>
        <div class="blk-field">
          <label>URL del Apps Script</label>
          <input id="aj-url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(apiUrl())}">
        </div>
        <div class="blk-field">
          <label>Token</label>
          <input id="aj-token" type="password" autocomplete="off" placeholder="tu clave del Apps Script" value="${esc(apiToken())}">
        </div>
        <div style="font-size:.72rem;color:#999;line-height:1.5">
          El token debe coincidir con la variable <code>TOKEN</code> del Apps Script.
        </div>
        <div style="font-size:.72rem;color:#999;line-height:1.5;border-top:1px solid #eee;
                    padding-top:8px;margin-top:2px">
          Versión del script que responde:
          <strong style="color:${VERSION_API?'#2d6a4f':'#c0392b'}">${VERSION_API
            ? esc(VERSION_API)
            : 'sin identificar — es una versión anterior a agosto de 2026'}</strong><br>
          Si acabas de cambiar el Apps Script y aquí sigue saliendo la fecha vieja,
          es que guardaste pero no publicaste una versión nueva.
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarAjustes()">Cancelar</button>
        <button class="blk-btn primary" onclick="guardarAjustes()">Guardar y conectar</button>
      </div>
    </div>
  </div>`;
}
/* Mismo arreglo que fondoDown/fondoClick de app-base.js, pero para Ajustes.
   Un clic solo cierra si EMPEZO y TERMINO en el fondo: al seleccionar la URL
   arrastrando, el raton se suelta fuera del recuadro y antes cerraba solo. */
let _ajFondo = false;
function ajFondoDown(ev, el){ _ajFondo = (ev.target === el); }
function ajFondoClick(ev, el){
  const empezoFuera = _ajFondo;
  _ajFondo = false;
  if(ev.target === el && empezoFuera) cerrarAjustes();
}
function cerrarAjustes(){ _ajFondo = false; document.getElementById('ajustes-host').innerHTML = ''; }
function guardarAjustes(){
  const u = document.getElementById('aj-url').value.trim();
  const t = document.getElementById('aj-token').value.trim();
  try {
    localStorage.setItem(API_KEY_URL, u);
    localStorage.setItem(API_KEY_TOKEN, t);
  } catch(e){ alert('El navegador bloqueó el almacenamiento local.'); return; }
  cerrarAjustes();
  arrancar();
}

/* Destino inicial: ?ir=ingesta abre directo en el registro de comida.
   Sirve para tener un icono aparte en la pantalla de inicio del celular. */
let _destinoInicial = null;

/* Permite abrir con ?api=URL&token=TOKEN para configurar de una vez,
   y con ?ir=<destino> para caer directo en una sección. */
(function(){
  const q = new URLSearchParams(location.search);
  if(q.get('api')){
    try {
      localStorage.setItem(API_KEY_URL, q.get('api'));
      if(q.get('token')) localStorage.setItem(API_KEY_TOKEN, q.get('token'));
    } catch(e){}
  }
  if(q.get('ir')) _destinoInicial = q.get('ir').toLowerCase();
  if(q.get('api') || q.get('token')){
    // Se limpian las credenciales de la barra pero se conserva el destino
    const limpio = location.pathname + (_destinoInicial ? '?ir='+_destinoInicial : '');
    history.replaceState({}, '', limpio);
  }
})();

/* Lleva a donde diga ?ir=, una vez cargados los datos. */
function irADestino(){
  if(!_destinoInicial) return;
  const dest = _destinoInicial;
  const SECCIONES = ['composicion','laboratorio','planes','suplementos','fotos'];

  if(dest === 'ingesta' || dest === 'comida'){
    gotoSection('planes');
    requestAnimationFrame(()=>{
      const btn = [...document.querySelectorAll('#plan-tab-nav .tab-btn')]
        .find(b=>b.textContent.includes('ingesta'));
      if(btn) switchPlanTab('ingesta', btn);
    });
  } else if(dest === 'tracker' || dest === 'suplementos'){
    gotoSection('suplementos');
  } else if(SECCIONES.includes(dest)){
    gotoSection(dest);
  }
}

document.addEventListener('click', ()=>{
  const t = document.getElementById('stip');
  if(t) t.style.display='none';
});

arrancar();

