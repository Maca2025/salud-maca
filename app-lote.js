/* ================================================================
   REGISTRO EN LOTE
   Pensado para la computadora: una semana a la vista, una fila por
   suplemento y una columna por día. Sirve para llenar de golpe los
   días que se quedaron sin registrar o corregir varios a la vez.

   Cada celda tiene tres estados, igual que el historial:
     ✓  tomado          ✗  no tomado          ·  sin respuesta
   Tocar una celda la hace girar. Una celda que ya tenía respuesta
   gira solo entre ✓ y ✗: volver a «sin respuesta» no se ofrece,
   porque borrar una respuesta guardada no es lo mismo que corregirla.

   Al guardar se vuelve a leer la hoja (pudo cambiar desde el celular),
   se aplican encima SOLO las celdas que cambiaste y se manda cada día
   completo. Así nada que no hayas tocado se pierde.
================================================================ */
let _loteLunes  = null;   // Date del lunes de la semana a la vista
let _loteBase   = {};     // { iso: {supId: true|false} } lo que hay en la hoja
let _loteCambios = {};    // { iso: {supId: true|false|null} } lo que cambiaste
let _loteCargado = false;

function loteIso(d){ return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; }
function loteLunesDe(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;   // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
}
function loteDias(){
  return Array.from({length:7}, (_,i) => {
    const d = new Date(_loteLunes); d.setDate(d.getDate() + i); return loteIso(d);
  });
}

/* Historial → un mapa por día. Entre varios guardados del mismo día gana
   el sí, igual que en la adherencia. */
function lotePorDia(hist){
  const out = {};
  (hist || []).forEach(e => {
    const iso = entryFechaISO({fechaISO: e.fecha, fecha: e.fecha});
    if(!iso) return;
    const dia = out[iso] || (out[iso] = {});
    const t = e.tomas || {};
    Object.keys(t).forEach(id => {
      if(id === 'nota') return;
      if(t[id]) dia[id] = true;
      else if(!(id in dia)) dia[id] = false;
    });
  });
  return out;
}

async function cargarLote(){
  const cont = document.getElementById('lote-container');
  if(!cont) return;
  if(!_loteLunes) _loteLunes = loteLunesDe(new Date());
  cont.innerHTML = '<p class="reg-status">⏳ Cargando lo registrado…</p>';
  try {
    const d = await api({action:'historial'});
    _loteBase = lotePorDia(d.historial);
    _loteCargado = true;
    renderLote();
  } catch(e){
    cont.innerHTML = '<p class="reg-status">❌ ' + esc(e.message) + '</p>';
  }
}

function loteValor(iso, id){
  const c = _loteCambios[iso];
  if(c && id in c) return c[id];
  const b = _loteBase[iso];
  return (b && id in b) ? b[id] : null;
}
function loteNCambios(){
  return Object.values(_loteCambios).reduce((n, c) => n + Object.keys(c).length, 0);
}

function renderLote(){
  const cont = document.getElementById('lote-container');
  if(!cont || !_loteCargado) return;
  const dias = loteDias();
  const hoy = hoyISO();
  const D = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const f = iso => `${Number(iso.slice(8,10))} ${M[Number(iso.slice(5,7))-1]}`;
  const orden = [...BLOQUES].sort((x,y)=>(x.desde||'99:99').localeCompare(y.desde||'99:99'));
  const n = loteNCambios();
  const diasCambiados = Object.keys(_loteCambios).filter(k => Object.keys(_loteCambios[k]).length).length;

  let h = `<div class="lote-bar">
      <button class="cal-btn" onclick="loteSemana(-1)" title="Semana anterior">‹</button>
      <span class="lote-rango">${f(dias[0])} – ${f(dias[6])}</span>
      <button class="cal-btn" onclick="loteSemana(1)" title="Semana siguiente" ${dias[6] >= hoy ? 'disabled' : ''}>›</button>
      <button class="dia-hoy-btn" onclick="loteSemana(0)">Esta semana</button>
      <div style="flex:1"></div>
      <span class="lote-n">${n ? `${n} cambio${n>1?'s':''} en ${diasCambiados} día${diasCambiados>1?'s':''}` : 'Sin cambios'}</span>
      <button class="sups-reset-btn" style="margin:0" onclick="loteDescartar()" ${n?'':'disabled'}>Descartar</button>
      <button class="sups-save-btn" id="lote-guardar" onclick="guardarLote()" ${n?'':'disabled'}>💾 Guardar cambios</button>
    </div>
    <div class="lote-ayuda">Toca una celda para cambiarla: <b>✓</b> tomado · <b>✗</b> no tomado · <b>·</b> sin respuesta.
      Toca el <b>día</b> para marcar como tomado todo lo que falta ese día (menos lo de «cuando lo necesite»).
      Nada se guarda hasta que pulses <b>Guardar cambios</b>.</div>
    <div class="reg-wrap"><table class="lote-tabla"><thead><tr><th class="lote-nom">Suplemento</th>`;
  dias.forEach((iso, i) => {
    const fut = iso > hoy;
    const reg = _loteBase[iso] && Object.keys(_loteBase[iso]).length;
    h += `<th class="lote-dia${iso===hoy?' hoy':''}${fut?' futuro':''}${!reg&&!fut?' sin-reg':''}"
      ${fut ? '' : `onclick="loteLlenarDia('${iso}')" title="Marcar lo que falta como tomado"`}>
      <span>${D[i]}</span><strong>${Number(iso.slice(8,10))}</strong>
      <small>${fut ? '' : reg ? 'con registro' : 'vacío'}</small></th>`;
  });
  h += '</tr></thead><tbody>';

  orden.forEach(b => {
    const ids = idsEnJuego(LAYOUT[b.id] || []);
    if(!ids.length) return;
    h += `<tr class="lote-grupo"><td colspan="8" style="border-left:5px solid ${esc(b.color)}">
      ${esc(b.icon)} ${esc(b.label)} <span>${esc(b.desde||'')}</span></td></tr>`;
    ids.forEach(id => {
      const s = supById(id);
      h += `<tr><td class="lote-nom">${esc(s.sustancia)}${supPRN(s)?' <span class="tag-prn">si lo necesitas</span>':''}
        <em>${esc(s.dosis||'')}</em></td>`;
      dias.forEach(iso => {
        if(iso > hoy){ h += '<td class="lote-celda futuro"></td>'; return; }
        const v = loteValor(iso, id);
        const cambiado = _loteCambios[iso] && id in _loteCambios[iso];
        const cls = v === true ? 'si' : v === false ? 'no' : 'nada';
        h += `<td class="lote-celda ${cls}${cambiado?' cambiado':''}" onclick="loteCelda('${iso}','${esc(id)}')">${
          v === true ? '✓' : v === false ? '✗' : '·'}</td>`;
      });
      h += '</tr>';
    });
  });
  h += '</tbody></table></div>';
  cont.innerHTML = h;
}

/* Giro de una celda. Si la hoja ya tenía respuesta: ✓ ↔ ✗.
   Si no la tenía: · → ✓ → ✗ → ·   («cuando lo necesite»: · ↔ ✓). */
function loteCelda(iso, id){
  const base = (_loteBase[iso] && id in _loteBase[iso]) ? _loteBase[iso][id] : null;
  const s = supById(id);
  const ciclo = base !== null ? [true, false]
              : (s && supPRN(s)) ? [null, true] : [null, true, false];
  const actual = loteValor(iso, id);
  const i = ciclo.indexOf(actual);
  const sig = ciclo[(i + 1) % ciclo.length];
  const c = _loteCambios[iso] || (_loteCambios[iso] = {});
  if(sig === base) delete c[id]; else c[id] = sig;
  renderLote();
}

function loteLlenarDia(iso){
  const c = _loteCambios[iso] || (_loteCambios[iso] = {});
  supsCuentan().forEach(s => {
    if(loteValor(iso, s.id) === null){
      const base = (_loteBase[iso] && s.id in _loteBase[iso]) ? _loteBase[iso][s.id] : null;
      if(base === true) delete c[s.id]; else c[s.id] = true;
    }
  });
  renderLote();
}

function loteSemana(delta){
  if(loteNCambios() && !confirm('Tienes cambios sin guardar en esta semana. ¿Cambiar de semana y conservarlos para después?')) return;
  if(delta === 0) _loteLunes = loteLunesDe(new Date());
  else { const d = new Date(_loteLunes); d.setDate(d.getDate() + 7*delta); _loteLunes = d; }
  renderLote();
}

function loteDescartar(){
  if(!confirm('¿Descartar todos los cambios sin guardar?')) return;
  _loteCambios = {};
  renderLote();
}

async function guardarLote(){
  const dias = Object.keys(_loteCambios).filter(k => Object.keys(_loteCambios[k]).length).sort();
  if(!dias.length) return;
  // Aviso si algo que la hoja tenía como tomado deja de estarlo.
  const quitados = [];
  dias.forEach(iso => Object.keys(_loteCambios[iso]).forEach(id => {
    if(_loteBase[iso] && _loteBase[iso][id] === true && _loteCambios[iso][id] !== true){
      const s = supById(id); quitados.push(`${iso.slice(8,10)}/${iso.slice(5,7)} ${s ? s.sustancia : id}`);
    }
  }));
  if(quitados.length && !confirm(`${quitados.length} toma(s) que estaban como tomadas quedarán como no tomadas:\n\n` +
      quitados.slice(0,12).join('\n') + (quitados.length>12?'\n…':'') + '\n\n¿Guardar de todas formas?')) return;

  const btn = document.getElementById('lote-guardar');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  let hechos = 0;
  try {
    // La hoja pudo cambiar desde que abriste la pantalla: se lee de nuevo
    // y los cambios se aplican encima de lo más reciente.
    const fresco = lotePorDia((await api({action:'historial'})).historial);
    for(const iso of dias){
      const tomas = Object.assign({}, fresco[iso] || {});
      Object.keys(_loteCambios[iso]).forEach(id => {
        const v = _loteCambios[iso][id];
        if(v === null) delete tomas[id]; else tomas[id] = v;
      });
      const tomados = [], todos = [], pendientes = [];
      supsEnJuego().forEach(s => {
        if(tomas[s.id] === true){ tomados.push(s.id); todos.push(s.id); }
        else if(tomas[s.id] === false) todos.push(s.id);
        else pendientes.push(s.id);
      });
      await api({action:'save', fecha:iso, hora:horaAhora(), modo:'reemplazo',
        tomados:tomados.join(','), todos:todos.join(','), pendientes:pendientes.join(',')});
      fresco[iso] = tomas;
      delete _loteCambios[iso];
      hechos++;
      // Lo que ve la pantalla Hoy sale de HIST: se mantiene al día.
      let hh = (HIST || []).find(x => x.fecha === iso);
      if(!hh){ hh = {fecha:iso, hora:horaAhora(), tomas:{}, nota:''}; HIST.unshift(hh); }
      hh.tomas = Object.assign({}, tomas);
    }
    _loteBase = fresco;
    _regEntries = null;
    renderLote();
    if(typeof renderHoy === 'function') renderHoy();
    const msg = document.createElement('div');
    msg.className = 'lote-ok';
    msg.textContent = `✅ Guardados ${hechos} día${hechos>1?'s':''}.`;
    const cont = document.getElementById('lote-container');
    if(cont) cont.prepend(msg);
  } catch(e){
    renderLote();
    alert(`Se guardaron ${hechos} de ${dias.length} días. Error: ${e.message}\n\nLos días que faltan siguen marcados como cambios; puedes reintentar.`);
  }
}
