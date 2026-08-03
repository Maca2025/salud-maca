
/* ================================================================
   DATA MODULE: SUPLEMENTOS & MEDICAMENTOS
   HOW TO UPDATE: Añadir objeto al array SUPS.
   Campos: id, sustancia, nombre, marca, dosis, formato, sitio,
           precio (número o null), link (string o null),
           slot ("ayunas"|"desayuno"|"comida"|"tarde"|"noche"),
           beneficio, absorcion, alerta (texto o null), nivel (0=verde,1=amarillo,2=rojo)
================================================================ */
/* Bloques por defecto. El usuario puede crear/editar/borrar bloques y
   reordenar suplementos; esos cambios se guardan en localStorage y
   sobrescriben estos valores. Ver BLOQUES / LAYOUT abajo.

   POR QUÉ SON CINCO Y NO CUATRO
   Hay tres minerales que compiten por la absorción y no pueden coincidir:
   el hierro y el zinc comparten el transportador DMT1, y el calcio
   interfiere con el hierro por otra vía. Con un tramo intestinal
   absortivo reducido el margen es estrecho, así que el hierro necesita
   una franja propia, separada ≥4 h del zinc y del calcio, y ≥4 h de la
   levotiroxina. De ahí el bloque "tarde".

   Si cambias las horas aquí, sólo afectan a una configuración nueva:
   la guardada en localStorage manda. Usa "Restaurar bloques por defecto"
   para adoptarlas, o edita la franja desde la propia tarjeta del bloque. */
const BLOQUES_DEFAULT = [
  {id:"ayunas",   label:"Al despertar", desc:"En ayunas, 30–60 min antes de desayunar. La levotiroxina va sola: cualquier mineral reduce su absorción.", icon:"🌅", desde:"06:00", hasta:"07:00", color:"#7B5EA7"},
  {id:"desayuno", label:"Desayuno",     desc:"Con comida que contenga grasa (liposolubles). Sin hierro, zinc ni calcio, para no competir con la levotiroxina.", icon:"☀️", desde:"07:30", hasta:"08:30", color:"#E67E22"},
  {id:"comida",   label:"Comida",       desc:"Con la comida principal. Multivitamínico y zinc: ≥4 h antes del hierro. El calcio ya no va aquí — compite con el zinc.", icon:"🌞", desde:"13:30", hasta:"14:30", color:"#2D6A4F"},
  {id:"tarde",    label:"Media tarde",  desc:"Lejos de comidas: hierro + vitamina C + probiótico. ≥4 h del zinc, del calcio y de la levotiroxina.", icon:"🍵", desde:"18:00", hasta:"19:00", color:"#B9770E"},
  {id:"noche",    label:"Noche",        desc:"30–60 min antes de dormir. Aquí va el calcio, en toma única: el bloque empieza a las 22:00 y no a las 21:00 para dejar ≥4 h desde el hierro de la tarde.", icon:"🌙", desde:"22:00", hasta:"23:00", color:"#2471A3"},
];

/* Estado vivo, hidratado desde localStorage por loadSupsConfig() */
let BLOQUES = [];
let LAYOUT  = {};   // { bloqueId: [supId, supId, ...] }

/* Interacciones documentadas */


/* ════════════════════════════════════════════════════════════
   DATOS — NO viven en este archivo.
   Se cargan desde tu Google Sheets vía Apps Script al abrir la
   página. Por eso este repositorio puede ser público sin exponer
   ninguna información médica.
   ════════════════════════════════════════════════════════════ */
let DATA = [], DAYS = [], SFECHAS = [];
let OBJ = {ecf:0, icf:0, prot:0, min:0, grasa:0, peso:65};
/* Suelo de masa magra: la linea que no se cruza. Vive en la fila SUELO de la
   hoja de composicion; hasta que exista, este valor por defecto es el acordado. */
let SUELO = {mlg:47};
let SD = {}, SR = {}, SSECTIONS = [], SUPS = [];
let EXP = {}, INTERACCIONES = [], STATUS_PANEL = {controlados:[], vigilancia:[], pendientes:[]};
let OPTIMOS = {}, INGESTA = [];
let EQUIPO = '';
const START_DATE = new Date(2026, 2, 16);

/* ================================================================
   DATA MODULE: COMPOSICIÓN CORPORAL

   HOW TO UPDATE:
   ► Añadir medición: agregar un objeto al FINAL del array DATA.
     Campos requeridos (todos numéricos salvo fecha):
       fecha   → string corto, ej. "20-jul"
       peso    → kg totales
       ecf     → agua extracelular (kg)
       icf     → agua intracelular (kg)
       prot    → proteínas (kg)
       min     → minerales (kg)
       grasa   → grasa corporal (kg)
       smm     → músculo esquelético (kg)
       pbf     → % grasa corporal
       bmi     → índice de masa corporal
       score   → puntuación de salud
       tmb     → tasa metabólica basal (kcal)
       grasaVisc → nivel de grasa visceral (escala /20)
   ► Añadir el número de días desde 16-mar-2026 al final de DAYS.
   ► Cambiar objetivo de peso: editar OBJ.peso (actualmente 65 kg).
================================================================ */
// START_DATE se declara arriba, junto al resto de los datos.


/* ================================================================
   DATA MODULE: LABORATORIO

   HOW TO UPDATE:
   ► Nuevo análisis: añadir la fecha al final de SFECHAS (ej. 'sep-26')
     y en CADA array de SD añadir el nuevo valor al final
     (usar null si ese marcador no se midió en esa fecha).
   ► Nuevo marcador: añadir su key a SD con array del mismo largo que SFECHAS,
     añadir rango [min,max] a SR (null = sin límite en ese extremo),
     y añadir la row a la sección correspondiente de SSECTIONS.
================================================================ */
/* ── Panel de estado del laboratorio (clasificación manual) ──
   HOW TO UPDATE: Al añadir un nuevo análisis, revisar si algún marcador
   que estaba en "pendientes" o "vigilancia" pasó a "controlados", y moverlo.
   Formato: {label, val, note} ────────────────────────────────────────── */



