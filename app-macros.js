/* ════════════════════════════════════════════════════════════
   MACROS A PARTIR DE LA TABLA DE ALIMENTOS
   Los valores de ALIMENTOS son por 100 g. El texto del ingrediente
   trae la cantidad al final ("Huevo entero 2 piezas 100 g"), así
   que se extrae de ahí y se regla de tres.
   ════════════════════════════════════════════════════════════ */
let ALIMENTOS = [];
let _indiceAlimentos = null;
const FALTANTES = new Set();     // ingredientes sin datos, para avisar

function normalizar(s){
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,' ').trim();
}

function construirIndice(){
  _indiceAlimentos = new Map();
  ALIMENTOS.forEach(a=>{
    _indiceAlimentos.set(normalizar(a.alimento), a);
    (a.alias||[]).forEach(al=>{
      const k = normalizar(al);
      if(!_indiceAlimentos.has(k)) _indiceAlimentos.set(k, a);
    });
  });
}

/* "Huevo entero 2 piezas 100 g" → {nombre:'Huevo entero', g:100} */
function parseIngrediente(txt){
  const s = String(txt).trim();
  // La cantidad real siempre viene al final, en g o ml
  const m = s.match(/^(.*?)[\s,]+([\d.]+)\s*(g|ml)\.?\s*$/i);
  if(!m) return {nombre: limpiarNombre(s), g: null, crudo: s};
  return {nombre: limpiarNombre(m[1]), g: parseFloat(m[2]), crudo: s};
}

/* Quita las medidas caseras que quedan pegadas al nombre */
function limpiarNombre(n){
  return String(n)
    .replace(/[\s,]+(\d+(?:[.,]\d+)?|1?[½⅓¼⅔¾]|[½⅓¼⅔¾])\s*(piezas?|rebanadas?|tazas?|cucharadas?|cucharaditas?|unidad(?:es)?|medidas?|sobres?)\b.*$/i,'')
    .replace(/[\s,]+(cocid[oa]s?|crud[oa]s?|picad[oa]s?|rebanad[oa]s?|pelad[oa]s?|asad[oa]s?|mediano?a?)\s*$/i, m=>m)
    .replace(/\s*,\s*$/,'')
    .trim();
}

function buscarAlimento(nombre){
  if(!_indiceAlimentos) construirIndice();
  const n = normalizar(nombre);
  if(_indiceAlimentos.has(n)) return _indiceAlimentos.get(n);
  // Coincidencia parcial: el nombre del plan contiene al del alimento o viceversa
  let mejor = null, largo = 0;
  for(const [clave, a] of _indiceAlimentos){
    if(clave.length < 4) continue;
    if((n.includes(clave) || clave.includes(n)) && clave.length > largo){
      mejor = a; largo = clave.length;
    }
  }
  return mejor;
}

/* Macros de un ingrediente suelto. Devuelve null si no se puede calcular. */
function macrosIngrediente(txt){
  const p = parseIngrediente(txt);
  const a = buscarAlimento(p.nombre);
  if(!a){ FALTANTES.add(p.nombre); return null; }
  if(p.g == null) return {kcal:0, prot:0, carbs:0, grasas:0, sinCantidad:true, alimento:a};
  const f = p.g / 100;
  return {
    kcal:   a.kcal   * f,
    prot:   a.prot   * f,
    carbs:  a.carbs  * f,
    grasas: a.grasas * f,
    alimento: a, g: p.g
  };
}

/* Suma los ingredientes de una receta y le pone los totales. */
function calcularMacrosReceta(r){
  let kcal=0, prot=0, carbs=0, grasas=0, sinDatos=0;
  (r.ingredientes||[]).forEach(i=>{
    const txt = i.cantidad ? `${i.nombre} ${i.cantidad}` : i.nombre;
    const m = macrosIngrediente(txt);
    if(!m){ sinDatos++; return; }
    kcal+=m.kcal; prot+=m.prot; carbs+=m.carbs; grasas+=m.grasas;
    if(m.alimento && !i.cat) i.cat = m.alimento.categoria;
    if(m.g != null) i.g = m.g;
  });
  r.kcal   = Math.round(kcal);
  r.prot   = Math.round(prot);
  r.carbs  = Math.round(carbs);
  r.grasas = Math.round(grasas);
  r.sinDatos = sinDatos;
  return r;
}

/* Avisa de los ingredientes que no están en la tabla y ofrece
   completarlos con IA. Mientras falten, los totales van incompletos. */
function renderAvisoAlimentos(){
  const cont = document.getElementById('aviso-alimentos');
  if(!cont) return;
  const faltan = [...FALTANTES].filter(Boolean).sort();
  if(!faltan.length){ cont.innerHTML=''; return; }
  cont.innerHTML = `
    <div class="alim-aviso">
      <div class="alim-head">⚠️ ${faltan.length} ingrediente${faltan.length>1?'s':''} sin datos nutricionales</div>
      <div class="alim-txt">Los platillos que ${faltan.length>1?'los':'lo'} usan muestran
        calorías incompletas. Puedes completarlos con IA o agregarlos a mano en la
        hoja <em>Salud Maca — Alimentos</em>.</div>
      <div class="alim-chips">${faltan.slice(0,14).map(n=>`<span>${esc(n)}</span>`).join('')}
        ${faltan.length>14?`<span class="mas">+${faltan.length-14} más</span>`:''}</div>
      <button class="blk-btn primary" id="btn-completar-alim"
        onclick="completarAlimentos()">✨ Completar con IA</button>
    </div>`;
}

async function completarAlimentos(){
  const btn = document.getElementById('btn-completar-alim');
  const faltan = [...FALTANTES].filter(Boolean);
  if(!faltan.length) return;
  btn.disabled = true; btn.textContent = 'Consultando…';
  try {
    const r = await api({action:'estimarAlimentos', nombres: JSON.stringify(faltan)});
    const nuevos = r.alimentos || [];
    if(!nuevos.length) throw new Error('La IA no devolvió valores.');
    revisarAlimentos(nuevos);
  } catch(e){
    btn.disabled = false; btn.textContent = '✨ Completar con IA';
    alert('No se pudieron estimar: ' + e.message);
  }
}

/* Los valores estimados se revisan y se pueden corregir antes de guardarlos. */
function revisarAlimentos(nuevos){
  const filas = nuevos.map((a,i)=>`
    <tr>
      <td><input id="al-nom-${i}" value="${esc(a.alimento||'')}" class="al-in al-nom"></td>
      <td><input id="al-kcal-${i}"  type="number" step="any" value="${a.kcal??''}"   class="al-in"></td>
      <td><input id="al-prot-${i}"  type="number" step="any" value="${a.prot??''}"   class="al-in"></td>
      <td><input id="al-carbs-${i}" type="number" step="any" value="${a.carbs??''}"  class="al-in"></td>
      <td><input id="al-gras-${i}"  type="number" step="any" value="${a.grasas??''}" class="al-in"></td>
      <td><input id="al-cat-${i}"   value="${esc(a.categoria||'otros')}" class="al-in al-cat"></td>
    </tr>`).join('');

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>✨ Revisar alimentos estimados</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="alim-msg" class="form-msg info">
          Valores <strong>por cada 100 g</strong>, estimados por IA. Revísalos y
          corrige lo que haga falta antes de guardarlos.
        </div>
        <div class="table-scroll">
          <table class="alim-tabla">
            <thead><tr><th>Alimento</th><th>kcal</th><th>Prot</th><th>Carbs</th><th>Grasas</th><th>Categoría</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="alim-guardar"
          onclick="guardarAlimentosForm(${nuevos.length})">Guardar en la tabla</button>
      </div>
    </div>
  </div>`;
}

async function guardarAlimentosForm(n){
  const msg = document.getElementById('alim-msg');
  const btn = document.getElementById('alim-guardar');
  const lista = [];
  for(let i=0;i<n;i++){
    const nom = document.getElementById('al-nom-'+i).value.trim();
    if(!nom) continue;
    lista.push({
      alimento: nom,
      kcal:   Number(document.getElementById('al-kcal-'+i).value)  || 0,
      prot:   Number(document.getElementById('al-prot-'+i).value)  || 0,
      carbs:  Number(document.getElementById('al-carbs-'+i).value) || 0,
      grasas: Number(document.getElementById('al-gras-'+i).value)  || 0,
      categoria: document.getElementById('al-cat-'+i).value.trim() || 'otros',
    });
  }
  if(!lista.length){ msg.className='form-msg err'; msg.textContent='No hay nada que guardar.'; return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api({action:'guardarAlimentos', alimentos: JSON.stringify(lista)});
    msg.className='form-msg ok';
    msg.textContent = `✓ ${r.agregados} alimento(s) agregados a la tabla.`;
    setTimeout(()=>{ cerrarForm(); recargarDatos(); }, 900);
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar en la tabla';
  }
}

function recalcularTodasLasRecetas(){
  FALTANTES.clear();
  Object.keys(RECETAS).forEach(k=>calcularMacrosReceta(RECETAS[k]));
  renderAvisoAlimentos();
}

/* Convierte los planes de la hoja al formato que ya usa la sección:
   crea una receta por platillo y arma el plan semanal. */
function hidratarPlanes(planesHoja){
  Object.keys(RECETAS).forEach(k=>delete RECETAS[k]);
  Object.keys(PLANES).forEach(k=>delete PLANES[k]);

  const slug = s => String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,42) || 'platillo';

  Object.keys(planesHoja).forEach(nombrePlan=>{
    const dias = planesHoja[nombrePlan];
    const semana = [];
    ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].forEach(dia=>{
      const d = dias[dia];
      if(!d) return;
      const fila = {dia};
      ['desayuno','comida','colacion','cena'].forEach(com=>{
        const lista = d[com] || [];
        if(!lista.length){ fila[com] = null; return; }
        // Varios platillos en una comida se juntan en una sola "receta"
        const nom = lista.map(p=>p.platillo).filter(Boolean).join(' + ');
        const key = slug(nombrePlan + '_' + dia + '_' + com);
        const ing = [];
        lista.forEach(p=>(p.ingredientes||[]).forEach(t=>{
          const pi = parseIngrediente(t);
          const a  = buscarAlimento(pi.nombre);
          ing.push({nombre: pi.nombre,
                    cantidad: pi.crudo.slice(pi.nombre.length).trim(),
                    g: pi.g || 0,
                    cat: a ? a.categoria : 'otros'});
        }));
        RECETAS[key] = {nombre:nom||com, tipo:com==='colacion'?'colacion':com,
                        prot_shake:/proteina|proteína|whey/i.test(nom),
                        kcal:0, prot:0, carbs:0, grasas:0,
                        ingredientes:ing, pasos:[]};
        fila[com] = key;
      });
      semana.push(fila);
    });
    if(semana.length) PLANES[nombrePlan] = semana;
  });

  const claves = Object.keys(PLANES);
  if(claves.length && !claves.includes(currentPlan)) currentPlan = claves[0];
  renderSelectorPlanes();
}

/* El selector de planes se arma según lo que haya en la hoja */
function renderSelectorPlanes(){
  const cont = document.querySelector('#section-planes .plan-selector');
  if(!cont) return;
  const claves = Object.keys(PLANES);
  if(!claves.length){ cont.innerHTML = '<span style="color:#aaa;font-size:.8rem">Sin planes cargados.</span>'; return; }
  cont.innerHTML = claves.map(k=>
    `<button class="plan-btn ${k===currentPlan?'active':''}"
      onclick="selectPlan('${esc(k)}',this)">${esc(k.charAt(0).toUpperCase()+k.slice(1))}</button>`
  ).join('');
}

function bootMensaje(titulo, sub, acciones){
  const t = document.getElementById('boot-title');
  const s = document.getElementById('boot-sub');
  const a = document.getElementById('boot-actions');
  if(t) t.textContent = titulo;
  if(s) s.textContent = sub;
  if(a) a.innerHTML = acciones || '';
}

async function arrancar(){
  document.getElementById('boot').classList.remove('oculto');
  if(!apiConfigurada()){
    bootMensaje('Falta conectar tus datos',
      'Esta página no guarda información médica. Necesita la URL de tu Apps Script para leerla desde Google Sheets.',
      '<button onclick="abrirAjustes()">Configurar conexión</button>');
    return;
  }
  bootMensaje('Cargando tus datos…', 'Conectando con Google Sheets');
  try {
    const d = await api({action:'all'});
    hidratar(d);

    if(!DATA.length && !SUPS.length){
      bootMensaje('Se conectó, pero no llegaron datos',
        'Revisa que las hojas de la carpeta "Salud Maca — Datos" tengan contenido.',
        '<button onclick="arrancar()">Reintentar</button><button class="sec" onclick="abrirAjustes()">Ajustes</button>');
      return;
    }

    // Reset de estado por si es una recarga
    Object.keys(lazyInited).forEach(k => lazyInited[k] = false);
    Object.keys(chartReg).forEach(k => { try{ chartReg[k].destroy(); }catch(e){} delete chartReg[k]; });
    document.getElementById('tbodyMain').innerHTML = '';
    document.getElementById('tbodyComp').innerHTML = '';

    initHome();
    renderComposicionKPIs();
    renderComposicionTables();
    loadSupsConfig();
    // Hoy va DESPUES de loadSupsConfig: es quien llena BLOQUES y LAYOUT desde
    // localStorage. Pintarla antes daba siempre "no toca ningun bloque".
    renderHoy();
    document.getElementById('boot').classList.add('oculto');
    irADestino();
  } catch(e){
    bootMensaje('No se pudieron cargar los datos', e.message,
      '<button onclick="arrancar()">Reintentar</button><button class="sec" onclick="abrirAjustes()">Ajustes</button>');
  }
}

function recargarDatos(){ goHome(); arrancar(); }

