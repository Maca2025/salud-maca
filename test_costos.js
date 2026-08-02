/* Pruebas del costo con envase compartido — campos unidades, por_toma,
   frecuencia y envase_de. Reimplementa la lógica pura de los bloques.
   Correr:  node test_costos.js                                          */

let ok = 0, fail = 0;
function t(nombre, real, esperado) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log('  ok   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + '\n         esperado ' + b + '\n         real     ' + a); }
}
function seccion(s){ console.log('\n' + s); }

/* ─── Copia de los bloques de app-base.js y renderCostos() ─── */
const FACTOR_FREQ = {diario: 1, alterno: 0.5, semanal: 1/7};

function campo_(s, snake, camel){
  const v = (s && (s[snake] != null && s[snake] !== '' ? s[snake] : s[camel]));
  return v == null ? '' : v;
}
const unidadesDe = s => { const n = Number(campo_(s,'unidades','unidades')); return n > 0 ? n : 0; };
const porTomaDe  = s => { const n = Number(campo_(s,'por_toma','porToma'));   return n > 0 ? n : 1; };
function frecuenciaDe(s){
  const f = String(campo_(s,'frecuencia','frecuencia')).trim().toLowerCase();
  return FACTOR_FREQ[f] ? f : 'diario';
}
const envaseDe  = s => String(campo_(s,'envase_de','envaseDe')).trim() || (s && s.id) || '';
const piezasDia = s => FACTOR_FREQ[frecuenciaDe(s)] * porTomaDe(s);

function gruposDeEnvase(lista){
  const g = new Map();
  (lista||[]).forEach(s => {
    const raiz = envaseDe(s);
    if(!g.has(raiz)) g.set(raiz, []);
    g.get(raiz).push(s);
  });
  return g;
}

function costos(sups){
  const grupos = gruposDeEnvase(sups);
  let totalEnvases = 0, mensual = 0, conDatos = 0, gruposConPrecio = 0;
  grupos.forEach((filas, raizId) => {
    const raiz = filas.find(x => x.id === raizId) || filas[0];
    const precio = Number(raiz.precio);
    if(!(precio > 0)) return;
    gruposConPrecio++;
    totalEnvases += precio;
    const u = unidadesDe(raiz);
    const diarias = filas.reduce((tt,x) => tt + piezasDia(x), 0);
    if(u > 0 && diarias > 0){ mensual += (precio/u) * diarias * 30; conDatos++; }
  });
  return {totalEnvases, mensual: Math.round(mensual), conDatos, gruposConPrecio};
}

/* ══════════════════════════════════════════════════════════ */
seccion('Caso simple');

let r = costos([{id:'vitc', precio:156, unidades:100, por_toma:1, frecuencia:'diario'}]);
t('reponer todo = el precio del envase', r.totalEnvases, 156);
t('100 piezas a 1/dia: 1.56 por dia -> 47 al mes', r.mensual, 47);

seccion('Dos piezas por toma vacian el bote al doble de velocidad');

r = costos([{id:'multi', precio:600, unidades:60, por_toma:2, frecuencia:'diario'}]);
t('600/60 = 10 por pieza, 2 al dia -> 600 al mes', r.mensual, 600);

seccion('Dias alternos');

r = costos([{id:'hierro', precio:464, unidades:30, por_toma:1, frecuencia:'alterno'}]);
t('media pieza al dia -> la mitad', r.mensual, Math.round(464/30*0.5*30));

seccion('Semanal: el caso de la tirzepatida');

r = costos([{id:'tirze', precio:4000, unidades:4, por_toma:1, frecuencia:'semanal'}]);
t('4 dosis semanales -> ~1 envase al mes', r.mensual, Math.round(4000/4*(1/7)*30));

seccion('EL CASO DEL CALCIO: dos filas, un solo bote');

const calcio = [
  {id:'calcio',       precio:400, unidades:120, por_toma:1, frecuencia:'diario'},
  {id:'calcio_noche', precio:'',  envase_de:'calcio', por_toma:1, frecuencia:'diario'},
];
r = costos(calcio);
t('reponer todo cuenta UN bote, no dos', r.totalEnvases, 400);
t('un solo grupo con precio', r.gruposConPrecio, 1);
t('pero se consume a 2 piezas/dia', r.mensual, Math.round(400/120*2*30));

seccion('El error que evita envase_de');

const malo = [
  {id:'calcio',       precio:400, unidades:120, por_toma:1, frecuencia:'diario'},
  {id:'calcio_noche', precio:400, unidades:120, por_toma:1, frecuencia:'diario'},
];
r = costos(malo);
t('sin declarar el envase compartido, se paga dos veces', r.totalEnvases, 800);
t('y eso es justo lo que el campo evita', costos(calcio).totalEnvases, 400);

seccion('Valores por defecto y ausencias');

t('sin por_toma se asume 1', porTomaDe({id:'x'}), 1);
t('sin frecuencia se asume diario', frecuenciaDe({id:'x'}), 'diario');
t('una frecuencia inventada cae en diario', frecuenciaDe({id:'x', frecuencia:'cuando me acuerde'}), 'diario');
t('sin envase_de cada uno es el suyo', envaseDe({id:'x'}), 'x');
t('por_toma 0 no divide por cero', porTomaDe({id:'x', por_toma:0}), 1);

r = costos([{id:'a', precio:300}]);
t('con precio pero sin unidades: no hay mensual', r.mensual, 0);
t('pero sigue contando para reponer', r.totalEnvases, 300);
t('y se marca como sin datos', r.conDatos, 0);

r = costos([{id:'a', unidades:60, por_toma:1}]);
t('sin precio no cuenta en nada', r, {totalEnvases:0, mensual:0, conDatos:0, gruposConPrecio:0});

seccion('camelCase o snake_case, da igual');

t('porToma camelCase', porTomaDe({id:'x', porToma:2}), 2);
t('por_toma snake_case', porTomaDe({id:'x', por_toma:2}), 2);
t('envaseDe camelCase', envaseDe({id:'x', envaseDe:'calcio'}), 'calcio');
t('la cadena vacia no pisa al camelCase', porTomaDe({id:'x', por_toma:'', porToma:3}), 3);

seccion('Tu protocolo, en pequeño');

r = costos([
  {id:'levotiroxina',  precio:200,  unidades:30,  por_toma:1, frecuencia:'diario'},
  {id:'zinc',          precio:1560, unidades:60,  por_toma:1, frecuencia:'diario'},
  {id:'ferrotemp',     precio:464,  unidades:30,  por_toma:1, frecuencia:'alterno'},
  {id:'calcio',        precio:400,  unidades:120, por_toma:1, frecuencia:'diario'},
  {id:'calcio_noche',  precio:'',   envase_de:'calcio', por_toma:1, frecuencia:'diario'},
  {id:'vitc',          precio:156,  unidades:100, por_toma:1, frecuencia:'diario'},
]);
t('cinco envases, no seis', r.gruposConPrecio, 5);
t('reponer todo', r.totalEnvases, 200+1560+464+400+156);
const esperado = Math.round(
  200/30*1*30 + 1560/60*1*30 + 464/30*0.5*30 + 400/120*2*30 + 156/100*1*30);
t('gasto mensual', r.mensual, esperado);

/* ══════════════════════════════════════════════════════════ */
console.log('\n' + '─'.repeat(52));
console.log(ok + ' pruebas ok, ' + fail + ' fallando');
process.exit(fail ? 1 : 0);
