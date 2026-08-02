/* ================================================================
   LOGIC MODULE: PLANES NUTRICIONALES
   Planeador semanal, macros en vivo, recetas, lista de compras.
================================================================ */
function mealCell(key, dia, tipo) {
  const r = RECETAS[key]; if(!r) return '<td>—</td>';
  const pb = r.prot_shake?'<span class="prot-badge">🥤</span>':'';
  const cbId = 'chk-'+dia+'-'+tipo;
  return `<td style="position:relative"><div class="meal-cell">
    <label style="display:flex;align-items:flex-start;gap:7px;cursor:pointer">
      <input type="checkbox" id="${cbId}" data-key="${key}" checked
        style="margin-top:4px;accent-color:#2d6a4f;width:14px;height:14px;cursor:pointer;flex-shrink:0">
      <div>
        <div class="kcal-chip">${r.kcal} kcal${pb}</div>
        <div class="meal-name">${r.nombre}</div>
        <div class="meal-macros">
          <span>P ${r.prot}g</span><span>C ${r.carbs}g</span><span>G ${r.grasas}g</span>
        </div>
      </div>
    </label>
  </div></td>`;
}

function renderWeekTable() {
  const plan = PLANES[currentPlan];
  let h = `<thead><tr>
    <th>Día</th><th>☀️ Desayuno</th><th>🍽️ Comida</th><th>🍎 Colación</th><th>🌙 Cena</th><th>Total día</th>
  </tr></thead><tbody>`;
  plan.forEach(d=>{
    const meals = ['desayuno','comida','colacion','cena'].map(m=>RECETAS[d[m]]||{kcal:0,prot:0,carbs:0,grasas:0});
    const tot = meals.reduce((s,m)=>({kcal:s.kcal+m.kcal,prot:s.prot+m.prot,carbs:s.carbs+m.carbs,grasas:s.grasas+m.grasas}),{kcal:0,prot:0,carbs:0,grasas:0});
    h+=`<tr><td>${d.dia}</td>
      ${mealCell(d.desayuno,d.dia,'desayuno')}
      ${mealCell(d.comida,  d.dia,'comida')}
      ${mealCell(d.colacion,d.dia,'colacion')}
      ${mealCell(d.cena,    d.dia,'cena')}
      <td style="text-align:center;white-space:nowrap">
        <div class="meal-cell">
          <div class="kcal-chip" style="background:#1b4332;color:white">${tot.kcal} kcal</div>
          <div class="meal-macros" style="margin-top:3px">
            <span>P ${tot.prot}g</span><span>C ${tot.carbs}g</span><span>G ${tot.grasas}g</span>
          </div>
        </div>
      </td></tr>`;
  });
  h += '</tbody>';
  document.getElementById('weekTable').innerHTML = h;
  // Attach live macro totals listener
  const wt = document.getElementById('weekTable');
  wt.addEventListener('change', updateMacroTotals);
  updateMacroTotals();
}

function updateMacroTotals() {
  const checked = [...document.querySelectorAll('#weekTable input[type=checkbox]:checked')];
  const tot = checked.reduce((s,cb)=>{
    const r=RECETAS[cb.dataset.key]; if(!r) return s;
    return {kcal:s.kcal+r.kcal, prot:s.prot+r.prot, carbs:s.carbs+r.carbs, grasas:s.grasas+r.grasas};
  },{kcal:0,prot:0,carbs:0,grasas:0});
  const n = checked.length;
  const el = document.getElementById('macroTotals'); if(!el) return;
  if(n===0){
    el.innerHTML='<span style="color:#aaa">Selecciona comidas para ver los macros de la selección</span>';
    return;
  }
  el.innerHTML=`
    <strong style="color:#1b4332">${n} comida${n>1?'s':''} seleccionada${n>1?'s':''}</strong>
    <span style="color:#ccc">·</span>
    <span><strong style="color:#065f46">${tot.kcal} kcal</strong> totales</span>
    <span style="color:#ccc">·</span>
    <span style="color:#1e40af"><strong>P ${tot.prot}g</strong></span>
    <span style="color:#9a3412"><strong>C ${tot.carbs}g</strong></span>
    <span style="color:#7e22ce"><strong>G ${tot.grasas}g</strong></span>`;
}

function selectPlan(p, btn) {
  currentPlan = p;
  document.querySelectorAll('.plan-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderWeekTable();
  document.getElementById('shoppingList').innerHTML =
    '<div class="shop-empty">Selecciona un plan y haz clic en<br><strong>"Generar lista de compras"</strong> para ver los ingredientes.</div>';
}

function switchPlanTab(id, btn) {
  document.querySelectorAll('#section-planes .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#plan-tab-nav .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ptab-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='ingesta') initIngesta();
  if(id==='alimentos') initAlimentos();
}

function renderRecipes() {
  const grid = document.getElementById('recipesGrid');
  const keys = Object.keys(RECETAS).filter(k=>{
    const r=RECETAS[k];
    if(currentRecipeFilter==='todos') return true;
    if(currentRecipeFilter==='prot_shake') return r.prot_shake;
    return r.tipo===currentRecipeFilter;
  });
  if(!keys.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:30px">No hay recetas con ese filtro.</div>';
    return;
  }
  const tipos = {desayuno:'☀️ Desayuno', comida:'🍽️ Comida', colacion:'🍎 Colación', cena:'🌙 Cena'};
  grid.innerHTML = keys.map(k=>{
    const r = RECETAS[k];
    const ing  = r.ingredientes.map(i=>`<div class="rc-ing-item"><span class="ing-name">${i.nombre}</span><span class="ing-qty">${i.cantidad}</span></div>`).join('');
    const pasos= r.pasos.map((p,i)=>`<li>${p}</li>`).join('');
    return `<div class="recipe-card">
      ${r.prot_shake?'<div style="margin-bottom:6px"><span class="prot-badge" style="font-size:0.68rem;padding:2px 7px">🥤 Incluye proteína</span></div>':''}
      <div class="rc-header"><span class="rc-type ${r.tipo}">${tipos[r.tipo]||r.tipo}</span></div>
      <div class="rc-name">${r.nombre}</div>
      <div class="rc-macros">
        <span class="macro-chip macro-kcal">${r.kcal} kcal${r.sinDatos?' *':''}</span>
        <span class="macro-chip macro-p">P ${r.prot}g</span>
        <span class="macro-chip macro-c">C ${r.carbs}g</span>
        <span class="macro-chip macro-g">G ${r.grasas}g</span>
      </div>
      <div class="rc-ing">${ing}</div>
      ${r.sinDatos?`<div class="rc-incompleto">* faltan datos de ${r.sinDatos} ingrediente${r.sinDatos>1?'s':''}</div>`:''}
      <details class="rc-pasos">
        <summary>▶ Preparación</summary>
        <ol>${pasos}</ol>
      </details>
    </div>`;
  }).join('');
}

function filterRecipes(f, btn) {
  currentRecipeFilter = f;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderRecipes();
}

function toggleAll(state) {
  document.querySelectorAll('#weekTable input[type=checkbox]').forEach(cb=>cb.checked=state);
  updateMacroTotals();
}

function generarLista() {
  const persons = parseInt(document.getElementById('personsInput').value)||1;
  const checked = [...document.querySelectorAll('#weekTable input[type=checkbox]:checked')];
  if(!checked.length){ alert('Selecciona al menos una comida para generar la lista.'); return; }
  const totals = {};
  checked.forEach(cb=>{
    const r=RECETAS[cb.dataset.key]; if(!r) return;
    r.ingredientes.forEach(i=>{
      const key=i.nombre+'__'+i.cat;
      if(!totals[key]) totals[key]={nombre:i.nombre, g:0, cat:i.cat};
      totals[key].g += i.g*persons;
    });
  });
  const bycat = {};
  Object.values(totals).forEach(item=>{
    if(!bycat[item.cat]) bycat[item.cat]=[];
    bycat[item.cat].push(item);
  });
  const nM = checked.length;
  let html = `<div style="font-size:0.78rem;color:#666;margin-bottom:14px">
    Lista para <strong>${persons} persona${persons>1?'s':''}</strong> ·
    Plan ${currentPlan} ·
    <strong>${nM}</strong> comida${nM>1?'s':''} seleccionada${nM>1?'s':''}
  </div>`;
  CAT_ORDER.forEach(cat=>{
    if(!bycat[cat]) return;
    html += `<div class="shop-cat">${catEmoji(cat)} ${cat.charAt(0).toUpperCase()+cat.slice(1)}</div><div class="shop-items">`;
    bycat[cat].sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(item=>{
      const label = item.g>0?`${Math.round(item.g)} g`:'c/n';
      html += `<label class="shop-item" onclick="this.classList.toggle('checked')">
        <input type="checkbox" onclick="event.stopPropagation();this.closest('.shop-item').classList.toggle('checked')">
        <span class="shop-ing-name">${item.nombre}</span>
        <span class="shop-ing-qty">${label}</span>
      </label>`;
    });
    html += '</div>';
  });
  document.getElementById('shoppingList').innerHTML = html;
  // Cambiar a pestaña de compras
  document.querySelectorAll('#section-planes .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#plan-tab-nav .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ptab-compras').classList.add('active');
  document.querySelector('#plan-tab-nav .tab-btn:last-child').classList.add('active');
}

function initPlanes() {
  renderWeekTable();
  renderRecipes();
}



