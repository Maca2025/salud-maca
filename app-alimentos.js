/* ════════════════════════════════════════════════════════════
   TABLA DE ALIMENTOS EDITABLE
   Todo desde la app: no hace falta abrir Sheets.
   ════════════════════════════════════════════════════════════ */
const CATEGORIAS = ['proteínas','lácteos','verduras','frutas','granos y cereales',
                    'leguminosas','grasas y semillas','suplementos','salsas y condimentos','otros'];

function renderTablaAlimentos(){
  const cont = document.getElementById('alim-lista');
  if(!cont) return;
  const q = normalizar((document.getElementById('alim-buscar')||{value:''}).value);
  const lista = ALIMENTOS.filter(a=>{
    if(!q) return true;
    return normalizar(a.alimento).includes(q) ||
           (a.alias||[]).some(x=>normalizar(x).includes(q)) ||
           normalizar(a.categoria).includes(q);
  });

  if(!lista.length){
    cont.innerHTML = `<div class="alim-vacio">Ningún alimento coincide.
      <button class="link-btn" onclick="editarAlimento(null)">Crear uno nuevo</button></div>`;
    return;
  }

  // Los frecuentes primero, luego alfabético
  lista.sort((a,b)=>{
    if(a.frecuente !== b.frecuente) return a.frecuente ? -1 : 1;
    return a.alimento.localeCompare(b.alimento,'es');
  });

  cont.innerHTML = lista.map(a=>{
    const id = a.alimento.replace(/'/g,"\\'");
    return `<div class="alim-fila ${a.frecuente?'es-frecuente':''}">
      <button class="alim-sw ${a.frecuente?'on':''}" title="Mostrar como botón en Mi ingesta"
        onclick="toggleFrecuente('${id}')" aria-label="Botón rápido"></button>
      <button class="alim-info" onclick="editarAlimento('${id}')">
        <span class="af-nom">${esc(a.alimento)}</span>
        <span class="af-det">${a.kcal} kcal · ${a.prot} g prot
          ${a.porcion ? `· porción ${esc(a.porcionNombre||a.porcion+' g')}` : '· sin porción'}
          ${a.origen ? `· ${esc(a.origen)}` : ''}</span>
      </button>
    </div>`;
  }).join('');
}

async function toggleFrecuente(nombre){
  const a = ALIMENTOS.find(x=>x.alimento===nombre);
  if(!a) return;
  if(!a.frecuente && !a.porcion){
    alert('Antes de ponerlo como botón, dale una porción típica.\n\n' +
          'Ábrelo y llena "Porción" con los gramos que sueles comer.');
    editarAlimento(nombre);
    return;
  }
  a.frecuente = !a.frecuente;      // optimista: se ve al instante
  renderTablaAlimentos();
  try {
    await api({action:'editarDato', tabla:'alimentos', clave:nombre,
               datos: JSON.stringify({frecuente: a.frecuente ? 1 : ''})});
    _indiceAlimentos = null;
    if(document.getElementById('ingesta-hoy')) renderIngestaHoy();
  } catch(e){
    a.frecuente = !a.frecuente;    // revertir si falló
    renderTablaAlimentos();
    alert('No se pudo guardar: ' + e.message);
  }
}

function editarAlimento(nombre){
  const nuevo = !nombre;
  const a = nuevo
    ? {alimento:'',alias:[],categoria:'otros',origen:'',kcal:'',prot:'',carbs:'',grasas:'',
       porcion:'',porcionNombre:'',frecuente:false,fuente:''}
    : ALIMENTOS.find(x=>x.alimento===nombre);
  if(!a) return;

  const num = (k,l,u,v) => `
    <div class="form-campo">
      <label for="al-${k}">${l} <span class="op">${u}</span></label>
      <input type="number" step="any" inputmode="decimal" id="al-${k}" value="${v===''||v==null?'':v}">
    </div>`;

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>${nuevo?'Nuevo alimento':'Editar alimento'}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="al-msg" class="form-msg info">
          Los valores son <strong>por cada 100 g</strong>. La porción es lo que suma
          un toque del botón en Mi ingesta.
        </div>

        <div class="form-campo">
          <label for="al-nombre">Nombre</label>
          <input id="al-nombre" value="${esc(a.alimento)}" ${nuevo?'':'readonly'}
            placeholder="Ej. Yogurt griego natural">
          ${nuevo?'':'<div class="form-calc">El nombre no se puede cambiar: se usa para enlazar con tus planes.</div>'}
        </div>

        <div class="form-sec">Por cada 100 g</div>
        <div class="form-grid">
          ${num('kcal','Calorías','kcal',a.kcal)}
          ${num('prot','Proteína','g',a.prot)}
          ${num('carbs','Carbohidratos','g',a.carbs)}
          ${num('grasas','Grasas','g',a.grasas)}
        </div>

        <div class="form-sec">Porción típica</div>
        <div class="form-grid">
          ${num('porcion','Gramos','g',a.porcion)}
          <div class="form-campo">
            <label for="al-porcionNombre">Cómo se llama</label>
            <input id="al-porcionNombre" value="${esc(a.porcionNombre)}" placeholder="1 pieza">
          </div>
        </div>

        <div class="form-sec">Clasificación</div>
        <div class="form-grid">
          <div class="form-campo">
            <label for="al-categoria">Categoría</label>
            <select id="al-categoria">
              ${CATEGORIAS.map(x=>`<option value="${x}" ${x===a.categoria?'selected':''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-campo">
            <label for="al-origen">Origen de la proteína</label>
            <select id="al-origen">
              <option value="" ${!a.origen?'selected':''}>—</option>
              <option value="animal" ${a.origen==='animal'?'selected':''}>animal</option>
              <option value="vegetal" ${a.origen==='vegetal'?'selected':''}>vegetal</option>
            </select>
          </div>
        </div>

        <div class="form-campo" style="margin-top:11px">
          <label for="al-alias">Otros nombres <span class="op">separados por coma</span></label>
          <input id="al-alias" value="${esc((a.alias||[]).join(', '))}" placeholder="yogurt, yogur griego">
          <div class="form-calc">Sirve para reconocerlo cuando tus planes lo escriben distinto.</div>
        </div>

        <label class="ing-check" style="margin-top:13px">
          <input type="checkbox" id="al-frecuente" ${a.frecuente?'checked':''}>
          <span>Mostrar como botón en Mi ingesta</span>
        </label>
      </div>
      <div class="blk-modal-foot">
        ${nuevo?'':`<button class="blk-btn danger" onclick="borrarAlimento('${esc(a.alimento).replace(/'/g,"\\'")}')">Borrar</button>`}
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="al-guardar" onclick="guardarAlimentoForm(${nuevo})">Guardar</button>
      </div>
    </div>
  </div>`;
  if(nuevo) setTimeout(()=>{ const e=document.getElementById('al-nombre'); if(e) e.focus(); }, 60);
}

async function guardarAlimentoForm(nuevo){
  const msg = document.getElementById('al-msg');
  const btn = document.getElementById('al-guardar');
  const v = k => document.getElementById('al-'+k).value.trim();
  const nombre = v('nombre');
  if(!nombre){ msg.className='form-msg err'; msg.textContent='Ponle nombre.'; return; }
  if(nuevo && ALIMENTOS.some(x=>normalizar(x.alimento)===normalizar(nombre))){
    msg.className='form-msg err'; msg.textContent='Ya existe un alimento con ese nombre.'; return;
  }
  const nProt = Number(v('prot'));
  if(v('prot')!=='' && isNaN(nProt)){ msg.className='form-msg err'; msg.textContent='La proteína no es un número.'; return; }

  const frecuente = document.getElementById('al-frecuente').checked;
  const porcion = Number(v('porcion')) || 0;
  if(frecuente && !porcion){
    msg.className='form-msg err';
    msg.textContent='Para que salga como botón necesita una porción en gramos.';
    return;
  }

  const datos = {
    alias: v('alias').split(',').map(s=>s.trim()).filter(Boolean),
    categoria: v('categoria'), origen: v('origen'),
    kcal: Number(v('kcal'))||0, prot: Number(v('prot'))||0,
    carbs: Number(v('carbs'))||0, grasas: Number(v('grasas'))||0,
    porcion_g: porcion, porcion_nombre: v('porcionNombre'),
    frecuente: frecuente ? 1 : '',
  };
  if(nuevo) datos.fuente = 'manual';

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api({action:'editarDato', tabla:'alimentos', clave:nombre, datos: JSON.stringify(datos)});
    // Refleja el cambio en memoria sin recargar toda la app
    const obj = {alimento:nombre, alias:datos.alias, categoria:datos.categoria, origen:datos.origen,
      kcal:datos.kcal, prot:datos.prot, carbs:datos.carbs, grasas:datos.grasas,
      porcion:porcion, porcionNombre:datos.porcion_nombre, frecuente:frecuente,
      fuente: nuevo ? 'manual' : ''};
    const i = ALIMENTOS.findIndex(x=>x.alimento===nombre);
    if(i>=0) ALIMENTOS[i] = obj; else ALIMENTOS.push(obj);
    _indiceAlimentos = null;
    recalcularTodasLasRecetas();
    cerrarForm();
    renderTablaAlimentos();
    if(document.getElementById('ingesta-hoy')) renderIngestaHoy();
    renderWeekTable();
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function borrarAlimento(nombre){
  const usado = Object.values(RECETAS).some(r=>
    (r.ingredientes||[]).some(i=>normalizar(i.nombre)===normalizar(nombre)));
  const aviso = usado
    ? `"${nombre}" se usa en alguno de tus platillos. Si lo borras, esos platillos van a quedar con calorías incompletas.\n\n¿Borrarlo de todas formas?`
    : `¿Borrar "${nombre}" de la tabla de alimentos?`;
  if(!confirm(aviso)) return;
  try {
    await api({action:'editarDato', tabla:'alimentos', clave:nombre, borrar:'1'});
    const i = ALIMENTOS.findIndex(x=>x.alimento===nombre);
    if(i>=0) ALIMENTOS.splice(i,1);
    _indiceAlimentos = null;
    recalcularTodasLasRecetas();
    cerrarForm();
    renderTablaAlimentos();
    if(document.getElementById('ingesta-hoy')) renderIngestaHoy();
  } catch(e){
    alert('No se pudo borrar: ' + e.message);
  }
}

function initAlimentos(){ renderTablaAlimentos(); }

function initIngesta(){
  renderIngestaHoy();
  renderIngestaResumen();
  renderIngestaTabla();
  requestAnimationFrame(initGraficaIngesta);
}

/* ── Nota libre del día ── */
let _notaOriginal = '';

async function guardarNotaDia(){
  const el  = document.getElementById('nota-input');
  const msg = document.getElementById('nota-msg');
  if(!el) return;
  const texto = el.value.trim();
  if(texto === _notaOriginal) return;         // no cambió, no molestar a la API
  if(msg){ msg.textContent = 'guardando…'; msg.className = ''; }
  try {
    await api({action:'nota', fecha: fechaActiva, texto});
    _notaOriginal = texto;
    if(msg){ msg.textContent = '✓ guardada'; msg.className = 'ok'; }
    _regEntries = null;
  } catch(e){
    if(msg){ msg.textContent = '✗ ' + e.message; msg.className = 'err'; }
  }
  setTimeout(()=>{ if(msg) msg.textContent=''; }, 2500);
}

/* Cambiar el día que se está registrando (para llenar uno olvidado). */
function cambiarDia(iso){
  if(!iso) return;
  if(iso > hoyISO()){ alert('No se puede registrar un día futuro.'); return; }
  limpiarBorrador();
  const inp = document.getElementById('dia-input');
  if(inp) inp.value = iso;
  cargarDia(iso);
}
function volverAHoy(){ cambiarDia(hoyISO()); }

