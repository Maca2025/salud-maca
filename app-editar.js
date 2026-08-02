/* ════════════════════════════════════════════════════════════
   EDITAR EL PROTOCOLO DE SUPLEMENTOS DESDE LA APP
   ════════════════════════════════════════════════════════════ */
function editarSuplemento(id){
  const nuevo = !id;
  const s = nuevo
    ? {id:'',sustancia:'',nombre:'',marca:'',dosis:'',formato:'Cápsula',sitio:'',
       precio:'',link:'',slot:(BLOQUES[0]||{}).id||'desayuno',nivel:0,
       beneficio:'',absorcion:'',alerta:''}
    : SUPS.find(x=>x.id===id);
  if(!s) return;

  const txt = (k,l,ph,v) => `
    <div class="form-campo">
      <label for="su-${k}">${l}</label>
      <input id="su-${k}" value="${esc(v==null?'':v)}" placeholder="${esc(ph)}">
    </div>`;
  const area = (k,l,ph,v) => `
    <div class="form-campo">
      <label for="su-${k}">${l}</label>
      <textarea id="su-${k}" rows="3" placeholder="${esc(ph)}">${esc(v==null?'':v)}</textarea>
    </div>`;

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>${nuevo?'Nuevo suplemento':'Editar suplemento'}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="su-msg" class="form-msg info">
          El identificador es el que enlaza este suplemento con tu historial y con
          los objetivos de laboratorio. No se puede cambiar después.
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-id">Identificador</label>
            <input id="su-id" value="${esc(s.id)}" ${nuevo?'':'readonly'}
              placeholder="ej. creatina">
          </div>
          ${txt('sustancia','Sustancia','Creatina monohidratada',s.sustancia)}
        </div>

        <div class="form-grid">
          ${txt('nombre','Producto','Creapure',s.nombre)}
          ${txt('marca','Marca','B Life',s.marca)}
        </div>

        <div class="form-grid">
          ${txt('dosis','Dosis','5 g',s.dosis)}
          <div class="form-campo">
            <label for="su-formato">Formato</label>
            <select id="su-formato">
              ${['Cápsula','Pastilla','GelCap','Polvo','Líquido','Complejo'].map(f=>
                `<option value="${f}" ${f===s.formato?'selected':''}>${f}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-slot">Bloque del día</label>
            <select id="su-slot">
              ${BLOQUES.map(b=>`<option value="${b.id}" ${b.id===s.slot?'selected':''}>
                ${esc(b.icon)} ${esc(b.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-campo">
            <label for="su-nivel">Nivel de alerta</label>
            <select id="su-nivel">
              <option value="0" ${Number(s.nivel)===0?'selected':''}>Sin alerta</option>
              <option value="1" ${Number(s.nivel)===1?'selected':''}>🟡 Precaución</option>
              <option value="2" ${Number(s.nivel)===2?'selected':''}>🔴 Requiere seguimiento</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-estado">Estado</label>
            <select id="su-estado">
              <option value="activo"     ${estadoSup(s)==='activo'?'selected':''}>Activo — lo tomo</option>
              <option value="pendiente"  ${estadoSup(s)==='pendiente'?'selected':''}>🛒 Por comprar — todavía no lo tengo</option>
              <option value="suspendido" ${estadoSup(s)==='suspendido'?'selected':''}>Suspendido — ya no lo tomo</option>
            </select>
            <span class="form-hint">Los que están por comprar se ven en el protocolo pero no cuentan
              en la adherencia ni en el costo. Los suspendidos desaparecen de la app sin borrar su historial.</span>
          </div>
        </div>

        <div class="form-grid">
          ${txt('sitio','Dónde lo compras','Amazon',s.sitio)}
          <div class="form-campo">
            <label for="su-precio">Precio del envase <span class="op">$</span></label>
            <input type="number" step="any" inputmode="decimal" id="su-precio"
              value="${s.precio==null?'':s.precio}">
          </div>
        </div>

        <div class="form-sec">Envase y consumo</div>
        <div class="form-grid">
          <div class="form-campo">
            <label for="su-unidades">Piezas por envase</label>
            <input type="number" step="1" inputmode="numeric" id="su-unidades"
              value="${unidadesDe(s) || ''}" placeholder="60">
            <span class="form-hint">Cápsulas, pastillas o tomas que trae el bote.
              Con esto y el precio sale el costo por toma y el gasto al mes.</span>
          </div>
          <div class="form-campo">
            <label for="su-portoma">Piezas por toma</label>
            <input type="number" step="1" inputmode="numeric" id="su-portoma"
              value="${porTomaDe(s)}" placeholder="1">
            <span class="form-hint">Cuántas te tragas cada vez que marcas la casilla.
              Casi siempre 1.</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-frecuencia">Cada cuánto</label>
            <select id="su-frecuencia">
              <option value="diario"  ${frecuenciaDe(s)==='diario'?'selected':''}>Todos los días</option>
              <option value="alterno" ${frecuenciaDe(s)==='alterno'?'selected':''}>Días alternos</option>
              <option value="semanal" ${frecuenciaDe(s)==='semanal'?'selected':''}>Una vez por semana</option>
            </select>
          </div>
          <div class="form-campo">
            <label for="su-envase">Sale del envase de</label>
            <select id="su-envase">
              <option value="" ${envaseDe(s)===s.id?'selected':''}>— Su propio envase —</option>
              ${SUPS.filter(x=>x.id && x.id!==s.id).map(x=>
                `<option value="${esc(x.id)}" ${envaseDe(s)===x.id?'selected':''}>${esc(x.sustancia)}</option>`
              ).join('')}
            </select>
            <span class="form-hint">Solo si dos filas comparten frasco, como el calcio
              de la comida y el de la noche. Evita que el costo se cuente dos veces.</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-existencias">Piezas que te quedan</label>
            <input type="number" step="1" inputmode="numeric" id="su-existencias"
              value="${existenciasDe(s) || ''}" placeholder="0">
            <span class="form-hint">A ojo vale: el cálculo se va corrigiendo solo
              conforme registras días.</span>
          </div>
          <div class="form-campo">
            <label for="su-fechastock">Contadas el día</label>
            <input type="date" id="su-fechastock" value="${fechaStockDe(s)}" max="${hoyISO()}">
            <span class="form-hint">Desde esa fecha la app descuenta lo que marcas.</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="su-caducidad">Caduca el</label>
            <input type="date" id="su-caducidad" value="${caducidadDe(s)}">
            <span class="form-hint">Opcional. Avisa a los 60 días y en rojo si ya pasó.</span>
          </div>
          <div class="form-campo" style="display:flex;flex-direction:column;justify-content:center">
            <button type="button" class="blk-btn ghost" onclick="envaseNuevo()">📦 Envase nuevo</button>
            <span class="form-hint">Abriste uno sin empezar: pone las existencias al total
              del envase y la fecha de hoy. No hay que contar nada.</span>
          </div>
        </div>

        ${txt('link','Enlace de compra','https://…',s.link)}

        <div class="form-sec">Información</div>
        ${area('beneficio','Para qué sirve','Qué hace en el cuerpo',s.beneficio)}
        ${area('absorcion','Cómo tomarlo','Con comida, en ayunas, separado de…',s.absorcion)}
        ${area('alerta','Advertencias','Interacciones o cosas a vigilar',s.alerta)}
      </div>
      <div class="blk-modal-foot">
        ${nuevo?'':`<button class="blk-btn danger" onclick="borrarSuplemento('${s.id}')">Borrar</button>`}
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="su-guardar" onclick="guardarSuplementoForm(${nuevo})">Guardar</button>
      </div>
    </div>
  </div>`;
  if(nuevo) setTimeout(()=>{ const e=document.getElementById('su-id'); if(e) e.focus(); }, 60);
}

/* Abriste un envase sin empezar: existencias = lo que trae, fecha = hoy.
   Rellena los campos; se guarda al pulsar Guardar como cualquier otro cambio. */
function envaseNuevo(){
  const u = document.getElementById('su-unidades');
  const e = document.getElementById('su-existencias');
  const f = document.getElementById('su-fechastock');
  const msg = document.getElementById('su-msg');
  if(!u || !e || !f) return;
  if(!(Number(u.value) > 0)){
    if(msg){ msg.className='form-msg err'; msg.textContent='Primero pon cuántas piezas trae el envase.'; }
    u.focus();
    return;
  }
  e.value = Number(u.value);
  f.value = hoyISO();
  if(msg){ msg.className='form-msg info'; msg.textContent='Envase nuevo. Dale a Guardar para que quede.'; }
}

/* ════════════════════════════════════════════════════════════
   HACER INVENTARIO — CONTAR TODO DE UNA SENTADA

   El campo de "quedan" nace VACÍO a propósito, con lo que hay
   guardado como pista en gris. Así no hay ambigüedad: lo que
   escribes es un conteo nuevo, lo que dejas en blanco no se toca.
   Si viniera relleno con el número anterior no habría forma de
   distinguir "conté y son las mismas" de "no lo conté".

   La fecha del control es UNA para todo lo que cuentes ahora.
   ════════════════════════════════════════════════════════════ */
let _invFilas = [];

function abrirInventario(){
  _invFilas = inventario();
  if(!_invFilas.length){ alert('No hay suplementos activos que contar.'); return; }

  const fila = f => {
    const u  = unidadTexto(f.raiz, 2);
    const st = f.stock;
    const pista = st
      ? `el cálculo dice ${st.restantes}${st.estimado || st.cobertura < 70 ? ' (aproximado)' : ''}`
      : 'nunca contado';
    return `
    <div class="inv-row">
      <div class="inv-row-nom">${esc(f.nombre)}
        ${f.raiz.nombre ? `<span class="inv-row-marca">${esc(f.raiz.nombre)}</span>` : ''}
        ${f.acompanan.length ? `<span class="inv-row-marca">+ ${f.acompanan.map(esc).join(' + ')}</span>` : ''}
      </div>
      <div class="inv-row-campos">
        <div class="form-campo">
          <label for="inv-ex-${f.id}">Quedan <span class="op">${u}</span></label>
          <input type="number" step="any" min="0" inputmode="decimal" id="inv-ex-${f.id}"
            placeholder="${st ? st.restantes : ''}">
        </div>
        <div class="form-campo">
          <label for="inv-cad-${f.id}">Caduca</label>
          <input type="date" id="inv-cad-${f.id}" value="${f.caducidad}"
            data-orig="${f.caducidad}">
        </div>
      </div>
      <div class="inv-row-pista">${pista}${f.total
        ? ` · <button type="button" class="inv-lleno" onclick="invLleno('${esc(f.id)}',${f.total})">envase nuevo: ${f.total}</button>`
        : ''}</div>
    </div>`;
  };

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>📦 Hacer inventario</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="inv-msg" class="form-msg info">
          Cuenta lo que tengas y escríbelo. <strong>Lo que dejes en blanco no se toca</strong>,
          así que puedes contar tres hoy y el resto otro día.
        </div>

        <div class="form-campo">
          <label for="inv-fecha">Fecha del control</label>
          <input type="date" id="inv-fecha" value="${hoyISO()}" max="${hoyISO()}">
          <span class="form-hint">Se aplica a todo lo que cuentes ahora. Es desde esta fecha
            desde cuando se empieza a descontar el consumo.</span>
        </div>

        <div class="inv-rows">${_invFilas.map(fila).join('')}</div>
      </div>
      <div class="blk-modal-foot">
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="inv-guardar" onclick="guardarInventario()">Guardar inventario</button>
      </div>
    </div>
  </div>`;
}

/* Abriste uno sin empezar: el conteo es lo que trae el envase. */
function invLleno(id, total){
  const e = document.getElementById('inv-ex-' + id);
  if(e){ e.value = total; e.focus(); }
}

async function guardarInventario(){
  const msg   = document.getElementById('inv-msg');
  const btn   = document.getElementById('inv-guardar');
  const fecha = document.getElementById('inv-fecha').value.trim();
  const fallo = t => { msg.className = 'form-msg err'; msg.textContent = t; };

  if(!RE_FECHA.test(fecha)){ fallo('Ponle una fecha al control.'); return; }

  // Solo lo que de verdad cambió: contar tres envases son tres
  // llamadas, no diecinueve.
  const pend = [];
  _invFilas.forEach(f => {
    const ex = document.getElementById('inv-ex-'  + f.id);
    const cd = document.getElementById('inv-cad-' + f.id);
    const datos = {};
    if(ex && ex.value.trim() !== ''){
      datos.existencias = Number(ex.value);
      datos.fecha_stock = fecha;
    }
    if(cd && cd.value !== cd.dataset.orig) datos.caducidad = cd.value;
    if(Object.keys(datos).length) pend.push({f, datos});
  });

  if(!pend.length){ fallo('No cambiaste nada. Escribe al menos un conteo.'); return; }

  btn.disabled = true;
  const fallidos = [];
  for(let i = 0; i < pend.length; i++){
    const {f, datos} = pend[i];
    btn.textContent = `Guardando ${i+1} de ${pend.length}…`;
    try {
      await api({action:'editarDato', tabla:'suplementos', clave:f.id,
                 datos: JSON.stringify(datos)});
      const s = SUPS.find(x => x.id === f.id);
      if(s) Object.assign(s, datos);
    } catch(e){
      // Que falle uno no debe tirar los demás: lo ya guardado se queda.
      fallidos.push(f.nombre);
    }
  }

  renderProtocolo(); renderCostos(); renderStock(); renderAvisoStock();

  if(fallidos.length){
    btn.disabled = false; btn.textContent = 'Reintentar los que faltan';
    fallo(`Se guardaron ${pend.length - fallidos.length} de ${pend.length}. ` +
          `No se pudo con: ${fallidos.join(' · ')}. Los demás ya quedaron.`);
    return;
  }
  cerrarForm();
}

async function guardarSuplementoForm(nuevo){
  const msg = document.getElementById('su-msg');
  const btn = document.getElementById('su-guardar');
  const v = k => document.getElementById('su-'+k).value.trim();

  const id = v('id').toLowerCase().replace(/[^a-z0-9_]/g,'_');
  if(!id){ msg.className='form-msg err'; msg.textContent='El identificador es obligatorio.'; return; }
  if(nuevo && SUPS.some(x=>x.id===id)){
    msg.className='form-msg err'; msg.textContent='Ya existe un suplemento con ese identificador.'; return;
  }
  if(!v('sustancia')){ msg.className='form-msg err'; msg.textContent='Ponle nombre a la sustancia.'; return; }

  const datos = {
    sustancia:v('sustancia'), nombre:v('nombre'), marca:v('marca'), dosis:v('dosis'),
    formato:v('formato'), sitio:v('sitio'),
    precio: v('precio')==='' ? '' : Number(v('precio')),
    link:v('link'), slot:v('slot'), nivel:Number(v('nivel'))||0,
    beneficio:v('beneficio'), absorcion:v('absorcion'), alerta:v('alerta'),
    // Estas columnas pueden no existir todavía en la hoja: editarDato las
    // crea al vuelo la primera vez que se guarda una.
    estado:v('estado'),
    unidades: v('unidades')==='' ? '' : Number(v('unidades')),
    por_toma: v('portoma')==='' ? '' : Number(v('portoma')),
    frecuencia: v('frecuencia'),
    envase_de: v('envase'),
    existencias: v('existencias')==='' ? '' : Number(v('existencias')),
    fecha_stock: v('fechastock'),
    caducidad: v('caducidad'),
  };

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api({action:'editarDato', tabla:'suplementos', clave:id, datos: JSON.stringify(datos)});
    const obj = Object.assign({id}, datos);
    const i = SUPS.findIndex(x=>x.id===id);
    if(i>=0) SUPS[i] = obj; else SUPS.push(obj);
    normalizeLayout(); saveSupsConfig();
    cerrarForm();
    renderHorario(); renderProtocolo(); renderCostos(); renderStock();
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function borrarSuplemento(id){
  const s = SUPS.find(x=>x.id===id);
  if(!s) return;
  if(!confirm(`¿Quitar "${s.sustancia}" del protocolo?\n\n` +
              `Tu historial no se toca: los días en que lo tomaste siguen registrados, ` +
              `y aparecerá al final del registro marcado como "ya no se toma".`)) return;
  try {
    await api({action:'editarDato', tabla:'suplementos', clave:id, borrar:'1'});
    const i = SUPS.findIndex(x=>x.id===id);
    if(i>=0) SUPS.splice(i,1);
    delete trackerState[id];
    normalizeLayout(); saveSupsConfig();
    cerrarForm();
    renderHorario(); renderProtocolo(); renderCostos(); renderStock();
  } catch(e){
    alert('No se pudo borrar: ' + e.message);
  }
}

/* ════════════════════════════════════════════════════════════
   EDITAR LOS OBJETIVOS DE LABORATORIO
   ════════════════════════════════════════════════════════════ */
function switchLabTab(id, btn){
  document.querySelectorAll('#section-laboratorio .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#lab-tab-nav .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('lab-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='objetivos') renderListaObjetivos();
}

function renderListaObjetivos(){
  const cont = document.getElementById('obj-lista');
  if(!cont) return;
  const marcadores = SSECTIONS.flatMap(s=>s.rows);
  if(!marcadores.length){ cont.innerHTML='<div class="alim-vacio">Sin marcadores cargados.</div>'; return; }

  const conObj = marcadores.filter(m=>OPTIMOS[m.key]);
  const sinObj = marcadores.filter(m=>!OPTIMOS[m.key]);
  const fila = m => {
    const o = OPTIMOS[m.key];
    const rango = o
      ? `${o.min!=null?o.min:''}${o.min!=null&&o.max!=null?'–':''}${o.max!=null?(o.min==null?'< '+o.max:o.max):(o.min!=null?'+':'')}`
      : 'sin objetivo';
    const EV = {guia:'guía', practica:'clínico', funcional:'funcional'};
    return `<div class="alim-fila ${o&&o.destacado?'es-frecuente':''}">
      <button class="alim-sw ${o&&o.destacado?'on':''}" title="Mostrar como tarjeta"
        onclick="toggleDestacado('${m.key}')" aria-label="Tarjeta"></button>
      <button class="alim-info" onclick="editarObjetivo('${m.key}')">
        <span class="af-nom">${esc(m.label)}</span>
        <span class="af-det">objetivo ${esc(rango)} ${esc(m.unit||'')}
          ${o?`· ${EV[o.evidencia]||o.evidencia}`:''}
          ${o&&o.suplementos&&o.suplementos.length?`· ${o.suplementos.length} suplemento(s)`:''}</span>
      </button>
    </div>`;
  };
  cont.innerHTML =
    (conObj.length?`<div class="tbl-section">Con objetivo</div>${conObj.map(fila).join('')}`:'') +
    (sinObj.length?`<div class="tbl-section">Sin objetivo definido</div>${sinObj.map(fila).join('')}`:'');
}

async function toggleDestacado(key){
  const o = OPTIMOS[key];
  if(!o){
    alert('Este marcador todavía no tiene objetivo. Ábrelo y define uno primero.');
    editarObjetivo(key);
    return;
  }
  o.destacado = !o.destacado;
  renderListaObjetivos();
  try {
    await api({action:'editarDato', tabla:'optimos', clave:key,
               datos: JSON.stringify({destacado: o.destacado ? 1 : ''})});
    if(lazyInited.sangre) initSangre();
  } catch(e){
    o.destacado = !o.destacado;
    renderListaObjetivos();
    alert('No se pudo guardar: ' + e.message);
  }
}

function editarObjetivo(key){
  const m = (SSECTIONS.flatMap(s=>s.rows)).find(r=>r.key===key);
  if(!m) return;
  const o = OPTIMOS[key] || {min:null,max:null,destacado:false,evidencia:'practica',
                             suplementos:[],tiempo:'',nota:'',efectoBajo:'',efectoAlto:'',alOptimo:''};
  const area = (k,l,ph,v) => `
    <div class="form-campo">
      <label for="ob-${k}">${l}</label>
      <textarea id="ob-${k}" rows="3" placeholder="${esc(ph)}">${esc(v||'')}</textarea>
    </div>`;

  document.getElementById('form-host').innerHTML = `
  <div class="blk-modal-bg" onmousedown="fondoDown(event,this)" onclick="fondoClick(event,this)">
    <div class="form-modal">
      <div class="blk-modal-hdr"><span>Objetivo · ${esc(m.label)}</span>
        <button onclick="cerrarForm()">×</button></div>
      <div class="form-modal-body">
        <div id="ob-msg" class="form-msg info">
          Rango del laboratorio: <strong>${esc(m.ref||'—')} ${esc(m.unit||'')}</strong>.
          Ese dice que no estás enferma; el objetivo dice a dónde quieres llegar.
        </div>

        <div class="form-grid">
          <div class="form-campo">
            <label for="ob-min">Mínimo <span class="op">${esc(m.unit||'')}</span></label>
            <input type="number" step="any" inputmode="decimal" id="ob-min" value="${o.min??''}">
          </div>
          <div class="form-campo">
            <label for="ob-max">Máximo <span class="op">${esc(m.unit||'')}</span></label>
            <input type="number" step="any" inputmode="decimal" id="ob-max" value="${o.max??''}">
          </div>
        </div>
        <div class="form-calc">Deja vacío el lado que no tenga límite.</div>

        <div class="form-campo" style="margin-top:12px">
          <label for="ob-evidencia">De dónde sale este objetivo</label>
          <select id="ob-evidencia">
            <option value="guia" ${o.evidencia==='guia'?'selected':''}>Guía clínica — sociedades médicas</option>
            <option value="practica" ${o.evidencia==='practica'?'selected':''}>Criterio clínico — sin guía formal</option>
            <option value="funcional" ${o.evidencia==='funcional'?'selected':''}>Medicina funcional — sin respaldo en guías</option>
          </select>
          <div class="form-calc">Marcarlo con honestidad es lo que hace útil la distinción
            cuando lo comentes con tu médico.</div>
        </div>

        <div class="form-campo" style="margin-top:12px">
          <label>Suplementos que lo influyen</label>
          <div class="obj-sups">
            ${SUPS.map(s=>`
              <label class="obj-sup">
                <input type="checkbox" value="${s.id}"
                  ${(o.suplementos||[]).includes(s.id)?'checked':''}>
                <span>${esc(s.sustancia)}</span>
              </label>`).join('')}
          </div>
          <div class="form-calc">Se cruzan con tu adherencia para saber si un valor fuera
            de rango es por falta de constancia o pese a ella.</div>
        </div>

        <div class="form-campo" style="margin-top:12px">
          <label for="ob-tiempo">Cuánto tarda en moverse</label>
          <input id="ob-tiempo" value="${esc(o.tiempo||'')}" placeholder="3 a 6 meses">
        </div>

        <div class="form-sec">Qué explicar</div>
        ${area('efectoBajo','Estando por debajo','Qué se siente y qué implica',o.efectoBajo)}
        ${area('efectoAlto','Estando por encima','Qué riesgo tiene pasarse',o.efectoAlto)}
        ${area('alOptimo','Al llegar al objetivo','Qué esperar',o.alOptimo)}
        ${area('nota','Nota sobre el objetivo','De dónde sale el número',o.nota)}

        <label class="ing-check" style="margin-top:13px">
          <input type="checkbox" id="ob-destacado" ${o.destacado?'checked':''}>
          <span>Mostrar como tarjeta arriba en Sangre</span>
        </label>
      </div>
      <div class="blk-modal-foot">
        ${OPTIMOS[key]?`<button class="blk-btn danger" onclick="borrarObjetivo('${key}')">Quitar objetivo</button>`:''}
        <button class="blk-btn ghost" onclick="cerrarForm()">Cancelar</button>
        <button class="blk-btn primary" id="ob-guardar" onclick="guardarObjetivoForm('${key}')">Guardar</button>
      </div>
    </div>
  </div>`;
}

async function guardarObjetivoForm(key){
  const msg = document.getElementById('ob-msg');
  const btn = document.getElementById('ob-guardar');
  const v = k => document.getElementById('ob-'+k).value.trim();
  const min = v('min')===''?null:Number(v('min'));
  const max = v('max')===''?null:Number(v('max'));
  if(min===null && max===null){
    msg.className='form-msg err'; msg.textContent='Define al menos un límite.'; return;
  }
  if(min!==null && max!==null && min>max){
    msg.className='form-msg err'; msg.textContent='El mínimo no puede ser mayor que el máximo.'; return;
  }
  const sups = [...document.querySelectorAll('.obj-sups input:checked')].map(x=>x.value);
  const destacado = document.getElementById('ob-destacado').checked;

  const datos = {
    opt_min: min===null?'':min, opt_max: max===null?'':max,
    destacado: destacado?1:'', nivel_evidencia: v('evidencia'),
    suplementos: sups, tiempo: v('tiempo'), nota: v('nota'),
    efecto_bajo: v('efectoBajo'), efecto_alto: v('efectoAlto'), al_optimo: v('alOptimo'),
  };

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api({action:'editarDato', tabla:'optimos', clave:key, datos: JSON.stringify(datos)});
    OPTIMOS[key] = {min, max, destacado, evidencia:datos.nivel_evidencia,
      suplementos:sups, tiempo:datos.tiempo, nota:datos.nota,
      efectoBajo:datos.efecto_bajo, efectoAlto:datos.efecto_alto, alOptimo:datos.al_optimo};
    cerrarForm();
    renderListaObjetivos();
    if(lazyInited.sangre) initSangre();
  } catch(e){
    msg.className='form-msg err'; msg.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function borrarObjetivo(key){
  if(!confirm('¿Quitar el objetivo de este marcador?\n\nSeguirás viendo sus valores y el rango del laboratorio.')) return;
  try {
    await api({action:'editarDato', tabla:'optimos', clave:key, borrar:'1'});
    delete OPTIMOS[key];
    cerrarForm();
    renderListaObjetivos();
    if(lazyInited.sangre) initSangre();
  } catch(e){
    alert('No se pudo quitar: ' + e.message);
  }
}

function initSuplementos() {
  loadSupsConfig();
  if(!_regEntries || !_regEntries.length) cargarRegistro();  // para cruzar con laboratorio
  renderHorario();
  renderProtocolo();
  renderCostos();
  renderStock();
  renderInteracciones();
  const inp = document.getElementById('dia-input');
  if(inp){ inp.value = fechaActiva; inp.max = hoyISO(); }
  cargarDia(fechaActiva);   // trae lo ya registrado para no sobrescribirlo
}

let _regEntries = [];

/* Un array vacío es truthy y `_regEntries` nace como `[]`, así que no
   sirve para saber si el historial ya llegó. Sin este flag el
   inventario calcularía cero consumo y diría que todos los botes
   están llenos — un error silencioso y en la dirección peor. */
let _histListo = false;

function switchRegView(v) {
  ['calendario','historial','adherencia'].forEach(k=>{
    const vista = document.getElementById('reg-view-'+k);
    const btn   = document.getElementById('rbtn-'+k);
    if(vista) vista.style.display = (k===v) ? 'block' : 'none';
    if(btn)   btn.classList.toggle('active', k===v);
  });
}

