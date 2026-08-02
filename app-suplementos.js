/* ================================================================
   LOGIC MODULE: SUPLEMENTOS & MEDICAMENTOS
   HOW TO UPDATE: Este módulo lee SUPS, BLOQUES y LAYOUT.
   Añadir una entrada a SUPS basta: normalizeLayout() la coloca sola
   en su bloque por defecto (campo .slot).
================================================================ */

/* ════════════════════════════════════════════════════════════
   DATOS DE NUTRICIÓN (recetas y planes semanales)
   Sí viven en este archivo: son recetas y gramajes, no información
   médica identificable. Si prefieres sacarlos del repositorio,
   se pueden mover a una hoja igual que el resto.
   ════════════════════════════════════════════════════════════ */
let RECETAS = {

  /* ── DESAYUNOS ─────────────────────────────────────────── */
  omelette_jamon:{
    nombre:'Omelette jamón con queso', tipo:'desayuno', prot_shake:false,
    kcal:259, prot:25, carbs:5, grasas:15,
    ingredientes:[
      {nombre:'Huevo entero',         cantidad:'2 piezas (100g)',    g:100, cat:'proteínas'},
      {nombre:'Jamón de pavo',        cantidad:'2 rebanadas (42g)',  g:42,  cat:'proteínas'},
      {nombre:'Champiñón fresco',     cantidad:'½ taza (27g)',       g:27,  cat:'verduras'},
      {nombre:'Queso panela',         cantidad:'1 rebanada (40g)',   g:40,  cat:'lácteos'},
    ],
    pasos:['Batir los huevos con sal y pimienta.',
           'Calentar sartén antiadherente con aerosol; saltear champiñones y jamón 2 min.',
           'Verter los huevos y cuajar a fuego medio; agregar el queso panela y doblar.'],
  },
  huevo_pan_platano:{
    nombre:'Huevo cocido + Pan con plátano', tipo:'desayuno', prot_shake:false,
    kcal:280, prot:15, carbs:29, grasas:12,
    ingredientes:[
      {nombre:'Huevo cocido',         cantidad:'2 piezas (88g)',     g:88,  cat:'proteínas'},
      {nombre:'Plátano',              cantidad:'½ pieza (60g)',       g:60,  cat:'frutas'},
      {nombre:'Crema de cacahuate',   cantidad:'1 cda (5g)',          g:5,   cat:'grasas y semillas'},
      {nombre:'Pan de centeno',       cantidad:'1 pieza (30g)',       g:30,  cat:'granos y cereales'},
    ],
    pasos:['Hervir los huevos 10–12 min; enfriar y pelar.',
           'Tostar el pan de centeno; untar la crema de cacahuate.',
           'Servir con los huevos y el plátano en rodajas.'],
  },
  licuado_fresa:{
    nombre:'Licuado de fresa con proteína', tipo:'desayuno', prot_shake:true,
    kcal:275, prot:33, carbs:19, grasas:8,
    ingredientes:[
      {nombre:'Leche semidescremada', cantidad:'240 ml',             g:240, cat:'lácteos'},
      {nombre:'Fresas',               cantidad:'4 piezas (50g)',     g:50,  cat:'frutas'},
      {nombre:'Nuez',                 cantidad:'2 piezas (6g)',      g:6,   cat:'grasas y semillas'},
      {nombre:'WP100 proteína sin sabor', cantidad:'1 medida (30.5g)', g:30.5,cat:'suplementos'},
    ],
    pasos:['Lavar y desinfectar las fresas.',
           'Licuar leche, fresas, nuez y proteína hasta que quede homogéneo.',
           'Servir frío inmediatamente.'],
  },
  licuado_mora:{
    nombre:'Licuado de mora azul con proteína', tipo:'desayuno', prot_shake:true,
    kcal:300, prot:33, carbs:20, grasas:10,
    ingredientes:[
      {nombre:'Leche semidescremada', cantidad:'240 ml',             g:240, cat:'lácteos'},
      {nombre:'Mora azul (blueberries)',cantidad:'½ taza (36g)',     g:36,  cat:'frutas'},
      {nombre:'Nuez',                 cantidad:'3 piezas (9g)',      g:9,   cat:'grasas y semillas'},
      {nombre:'WP100 proteína sin sabor', cantidad:'1 medida (30.5g)', g:30.5,cat:'suplementos'},
    ],
    pasos:['Licuar leche, moras, nuez y proteína hasta que quede homogéneo.',
           'Servir frío inmediatamente.'],
  },
  licuado_platano:{
    nombre:'Licuado de plátano con proteína', tipo:'desayuno', prot_shake:true,
    kcal:269, prot:33, carbs:27, grasas:4,
    ingredientes:[
      {nombre:'Leche semidescremada', cantidad:'240 ml',             g:240, cat:'lácteos'},
      {nombre:'Plátano',              cantidad:'½ pieza (54g)',       g:54,  cat:'frutas'},
      {nombre:'WP100 proteína sin sabor', cantidad:'1 medida (30.5g)', g:30.5,cat:'suplementos'},
    ],
    pasos:['Licuar leche, plátano y proteína hasta que quede homogéneo.',
           'Servir frío inmediatamente.'],
  },
  sandwich:{
    nombre:'Sándwich de huevo y jamón', tipo:'desayuno', prot_shake:false,
    kcal:340, prot:22, carbs:28, grasas:15,
    ingredientes:[
      {nombre:'Huevo entero',         cantidad:'2 piezas (60g)',     g:60,  cat:'proteínas'},
      {nombre:'Jamón de pavo',        cantidad:'2 rebanadas (42g)',  g:42,  cat:'proteínas'},
      {nombre:'Queso manchego',       cantidad:'30g',                g:30,  cat:'lácteos'},
      {nombre:'Pan de centeno',       cantidad:'2 piezas (60g)',     g:60,  cat:'granos y cereales'},
      {nombre:'Jitomate',             cantidad:'10g',                g:10,  cat:'verduras'},
      {nombre:'Lechuga',              cantidad:'5g',                 g:5,   cat:'verduras'},
      {nombre:'Cebolla blanca',       cantidad:'5g',                 g:5,   cat:'verduras'},
    ],
    pasos:['Cocinar los huevos revueltos o estrellados en sartén con aerosol.',
           'Tostar el pan de centeno.',
           'Armar el sándwich con jamón, huevo, queso manchego, jitomate, lechuga y cebolla.'],
  },
  panela_calabacita:{
    nombre:'Panela asada con calabacita', tipo:'desayuno', prot_shake:false,
    kcal:190, prot:13, carbs:6, grasas:13,
    ingredientes:[
      {nombre:'Queso panela',         cantidad:'2 rebanadas (80g)',  g:80,  cat:'lácteos'},
      {nombre:'Calabacita italiana',  cantidad:'½ pieza (55g)',      g:55,  cat:'verduras'},
      {nombre:'Aceite de canola',     cantidad:'1 cdita (5ml)',      g:5,   cat:'grasas y semillas'},
      {nombre:'Limón',                cantidad:'1 pieza (20g)',      g:20,  cat:'frutas'},
      {nombre:'Albahaca fresca',      cantidad:'10g',                g:10,  cat:'verduras'},
    ],
    pasos:['Cortar la calabacita en rodajas y el queso panela en tiras.',
           'Calentar aceite en sartén; dorar la calabacita a fuego medio-alto 3–4 min.',
           'Añadir el queso; dorar 2 min por cada lado.',
           'Sazonar con jugo de limón y albahaca fresca.'],
  },
  omelette_mexicana:{
    nombre:'Omelette a la mexicana', tipo:'desayuno', prot_shake:false,
    kcal:200, prot:13, carbs:5, grasas:14,
    ingredientes:[
      {nombre:'Huevo entero',         cantidad:'2 piezas (100g)',    g:100, cat:'proteínas'},
      {nombre:'Aguacate',             cantidad:'31g',                g:31,  cat:'grasas y semillas'},
      {nombre:'Tomate cherry',        cantidad:'20g',                g:20,  cat:'verduras'},
      {nombre:'Cebolla picada',       cantidad:'2 cdas (10g)',       g:10,  cat:'verduras'},
      {nombre:'Cilantro fresco',      cantidad:'½ taza (10g)',       g:10,  cat:'verduras'},
    ],
    pasos:['Batir los huevos con sal.',
           'Saltear cebolla y tomate cherry en sartén con aerosol 2 min.',
           'Verter los huevos; cuajar a fuego medio y doblar.',
           'Servir con aguacate en rebanadas y cilantro fresco.'],
  },
  sandwich_aguacate:{
    nombre:'Sándwich de aguacate con queso', tipo:'desayuno', prot_shake:false,
    kcal:403, prot:17, carbs:39, grasas:21,
    ingredientes:[
      {nombre:'Pan de centeno',       cantidad:'2 piezas (60g)',     g:60,  cat:'granos y cereales'},
      {nombre:'Aguacate',             cantidad:'2 rebanadas (62g)',  g:62,  cat:'grasas y semillas'},
      {nombre:'Queso gouda',          cantidad:'30g',                g:30,  cat:'lácteos'},
      {nombre:'Germen de trigo',      cantidad:'10g',                g:10,  cat:'granos y cereales'},
      {nombre:'Jitomate',             cantidad:'10g',                g:10,  cat:'verduras'},
      {nombre:'Cebolla morada',       cantidad:'10g',                g:10,  cat:'verduras'},
    ],
    pasos:['Tostar el pan de centeno.',
           'Machacar el aguacate con jugo de limón y sal; untar sobre el pan.',
           'Armar con queso gouda, jitomate, cebolla morada y germen de trigo.'],
  },
  omelette_espinacas:{
    nombre:'Omelette con espinacas y aguacate', tipo:'desayuno', prot_shake:false,
    kcal:280, prot:17, carbs:18, grasas:15,
    ingredientes:[
      {nombre:'Huevo entero',         cantidad:'2 piezas (100g)',    g:100, cat:'proteínas'},
      {nombre:'Espinaca cocida',      cantidad:'30g',                g:30,  cat:'verduras'},
      {nombre:'Aguacate',             cantidad:'30g',                g:30,  cat:'grasas y semillas'},
      {nombre:'Pan de centeno',       cantidad:'1 pieza (30g)',      g:30,  cat:'granos y cereales'},
      {nombre:'Aceite en aerosol',    cantidad:'5ml',                g:5,   cat:'grasas y semillas'},
    ],
    pasos:['Saltear espinacas en sartén con aerosol hasta que reduzcan.',
           'Batir los huevos; verter en sartén y cuajar a fuego medio.',
           'Agregar espinacas y aguacate; doblar.',
           'Servir con una rebanada de pan de centeno.'],
  },

  /* ── COMIDAS ────────────────────────────────────────────── */
  bistec_salsa_verde:{
    nombre:'Bistec en salsa verde con tortillas', tipo:'comida', prot_shake:false,
    kcal:414, prot:36, carbs:33, grasas:16,
    ingredientes:[
      {nombre:'Bistec de res',        cantidad:'160g',               g:160, cat:'proteínas'},
      {nombre:'Tortilla de maíz',     cantidad:'2 piezas (44g)',     g:44,  cat:'granos y cereales'},
      {nombre:'Nopales cocidos',      cantidad:'½ taza (45g)',       g:45,  cat:'verduras'},
      {nombre:'Papa cocida',          cantidad:'½ pieza (43g)',      g:43,  cat:'verduras'},
      {nombre:'Salsa verde (casera)', cantidad:'2 cdas (30g)',       g:30,  cat:'salsas y condimentos'},
      {nombre:'Cebolla blanca',       cantidad:'10g',                g:10,  cat:'verduras'},
      {nombre:'Aceite en aerosol',    cantidad:'5ml',                g:5,   cat:'grasas y semillas'},
    ],
    pasos:['Asar el bistec en sartén caliente con aerosol 4–5 min por lado; sazonar.',
           'Hervir papas y nopales hasta suavizar; escurrir.',
           'Calentar las tortillas en comal seco.',
           'Servir el bistec con salsa verde, nopales, papa y cebolla.'],
  },
  fajitas_pollo:{
    nombre:'Fajitas de pollo con morrón, arroz y frijoles', tipo:'comida', prot_shake:false,
    kcal:416, prot:42, carbs:47, grasas:6,
    ingredientes:[
      {nombre:'Pechuga de pollo asada',cantidad:'145g',             g:145, cat:'proteínas'},
      {nombre:'Pimiento rojo o verde', cantidad:'½ taza (45g)',     g:45,  cat:'verduras'},
      {nombre:'Cebolla picada',        cantidad:'2 cdas (10g)',     g:10,  cat:'verduras'},
      {nombre:'Arroz blanco cocido',   cantidad:'½ taza (100g)',    g:100, cat:'granos y cereales'},
      {nombre:'Frijoles refritos sin grasa',cantidad:'½ taza (100g)',g:100,cat:'leguminosas'},
      {nombre:'Aceite en aerosol',     cantidad:'5ml',              g:5,   cat:'grasas y semillas'},
    ],
    pasos:['Marinar la pechuga con limón, ajo y especias; asar y cortar en tiras.',
           'Saltear pimiento y cebolla con aerosol 4 min hasta suavizar.',
           'Cocer el arroz y calentar los frijoles.',
           'Servir las tiras de pollo con verduras, arroz y frijoles.'],
  },
  tinga_pollo:{
    nombre:'Tinga de pollo en tostadas', tipo:'comida', prot_shake:false,
    kcal:326, prot:27, carbs:37, grasas:7,
    ingredientes:[
      {nombre:'Pechuga de pollo asada',cantidad:'100g',             g:100, cat:'proteínas'},
      {nombre:'Tostadas horneadas',    cantidad:'4 piezas (48g)',   g:48,  cat:'granos y cereales'},
      {nombre:'Lechuga',               cantidad:'12.5g',            g:12.5,cat:'verduras'},
      {nombre:'Cebolla blanca rebanada',cantidad:'10g',             g:10,  cat:'verduras'},
    ],
    pasos:['Cocer y deshebrar la pechuga de pollo.',
           'Mezclar el pollo con salsa de chipotle al gusto; calentar 3 min.',
           'Servir la tinga sobre las tostadas con lechuga y cebolla.'],
  },
  pollo_ensalada:{
    nombre:'Pollo con ensalada y aguacate', tipo:'comida', prot_shake:false,
    kcal:337, prot:38, carbs:6, grasas:16,
    ingredientes:[
      {nombre:'Pechuga de pollo asada',cantidad:'165g',             g:165, cat:'proteínas'},
      {nombre:'Aguacate',              cantidad:'½ pieza (51.7g)',  g:51.7,cat:'grasas y semillas'},
      {nombre:'Lechuga',               cantidad:'12.5g',            g:12.5,cat:'verduras'},
      {nombre:'Jitomate bola',         cantidad:'10g',              g:10,  cat:'verduras'},
      {nombre:'Jícama',                cantidad:'10g',              g:10,  cat:'verduras'},
      {nombre:'Cebolla morada',        cantidad:'10g',              g:10,  cat:'verduras'},
      {nombre:'Aceite de oliva',       cantidad:'1 cdita (5ml)',    g:5,   cat:'grasas y semillas'},
      {nombre:'Pimienta negra',        cantidad:'al gusto',         g:1,   cat:'salsas y condimentos'},
    ],
    pasos:['Asar la pechuga con aceite de oliva, sal y pimienta; reposar 3 min y rebanar.',
           'Mezclar lechuga, jitomate, jícama y cebolla morada.',
           'Añadir el aguacate en trozos; sazonar con aceite de oliva y pimienta.',
           'Servir el pollo sobre la ensalada.'],
  },
  fajita_arroz:{
    nombre:'Fajita de pollo y arroz con chayote', tipo:'comida', prot_shake:false,
    kcal:356, prot:40, carbs:35, grasas:4,
    ingredientes:[
      {nombre:'Pechuga de pollo (fajita)',cantidad:'160g',          g:160, cat:'proteínas'},
      {nombre:'Arroz blanco cocido',      cantidad:'½ taza (100g)',g:100, cat:'granos y cereales'},
      {nombre:'Chayote',                  cantidad:'½ taza (80g)', g:80,  cat:'verduras'},
      {nombre:'Pepino pelado',            cantidad:'½ taza (80g)', g:80,  cat:'verduras'},
    ],
    pasos:['Asar la pechuga y cortar en tiras de fajita.',
           'Cocer el arroz; cocer el chayote al vapor hasta suavizar.',
           'Cortar el pepino en bastones o rodajas.',
           'Servir las fajitas con arroz, chayote y pepino fresco.'],
  },
  bistec_plancha:{
    nombre:'Bistec a la plancha con arroz', tipo:'comida', prot_shake:false,
    kcal:299, prot:31, carbs:12, grasas:13,
    ingredientes:[
      {nombre:'Bistec de res',          cantidad:'150g',            g:150, cat:'proteínas'},
      {nombre:'Arroz blanco cocido',    cantidad:'¼ taza (37.5g)', g:37.5,cat:'granos y cereales'},
      {nombre:'Pepino pelado',          cantidad:'½ taza (45g)',   g:45,  cat:'verduras'},
      {nombre:'Jitomate',               cantidad:'10g',            g:10,  cat:'verduras'},
      {nombre:'Cebolla morada',         cantidad:'5g',             g:5,   cat:'verduras'},
    ],
    pasos:['Sazonar el bistec con sal y pimienta; asar a fuego alto 4 min por lado.',
           'Cocer el arroz.',
           'Preparar la ensalada de pepino, jitomate y cebolla.',
           'Servir el bistec con arroz y ensalada.'],
  },
  bistec_jitomate:{
    nombre:'Bistec en salsa de jitomate', tipo:'comida', prot_shake:false,
    kcal:336, prot:32, carbs:12, grasas:18,
    ingredientes:[
      {nombre:'Filete / bistec de res',  cantidad:'150g',           g:150, cat:'proteínas'},
      {nombre:'Salsa de jitomate (sin sal)',cantidad:'½ taza (50g)',g:50,  cat:'salsas y condimentos'},
      {nombre:'Papa cocida',             cantidad:'½ pieza (43g)', g:43,  cat:'verduras'},
      {nombre:'Cebolla blanca',          cantidad:'5g',            g:5,   cat:'verduras'},
      {nombre:'Aceite de canola',        cantidad:'1 cdita (5ml)', g:5,   cat:'grasas y semillas'},
    ],
    pasos:['Sellar el bistec en sartén con aceite de canola 3 min por lado.',
           'Licuar jitomate con cebolla; cocinar la salsa 5 min.',
           'Cocer la papa aparte; añadir a la salsa.',
           'Servir el bistec bañado con la salsa y la papa.'],
  },

  /* ── COLACIONES ─────────────────────────────────────────── */
  queso_manchego_80:{
    nombre:'Queso manchego (80g)', tipo:'colacion', prot_shake:false,
    kcal:296, prot:18, carbs:1, grasas:24,
    ingredientes:[{nombre:'Queso manchego',cantidad:'80g',g:80,cat:'lácteos'}],
    pasos:['Porcionar 80 g y servir al natural o con verduras crudas.'],
  },
  queso_manchego_60:{
    nombre:'Queso manchego (60g)', tipo:'colacion', prot_shake:false,
    kcal:222, prot:14, carbs:0, grasas:18,
    ingredientes:[{nombre:'Queso manchego',cantidad:'60g',g:60,cat:'lácteos'}],
    pasos:['Porcionar 60 g y servir al natural o con verduras crudas.'],
  },
  salchicha_pavo:{
    nombre:'Salchicha de pavo (1 pieza)', tipo:'colacion', prot_shake:false,
    kcal:70, prot:7, carbs:2, grasas:4,
    ingredientes:[{nombre:'Salchicha de pavo',cantidad:'1 pieza (60g)',g:60,cat:'proteínas'}],
    pasos:['Calentar la salchicha en sartén seco 2 min por lado hasta dorar levemente.'],
  },
  salchicha_pavo_15:{
    nombre:'Salchicha de pavo (1½ piezas)', tipo:'colacion', prot_shake:false,
    kcal:105, prot:10, carbs:3, grasas:6,
    ingredientes:[{nombre:'Salchicha de pavo',cantidad:'1½ piezas (90g)',g:90,cat:'proteínas'}],
    pasos:['Calentar las salchichas en sartén seco 2–3 min por lado hasta dorar.'],
  },
  cacahuates_20:{
    nombre:'Cacahuates (20 piezas)', tipo:'colacion', prot_shake:false,
    kcal:117, prot:5, carbs:3, grasas:10,
    ingredientes:[{nombre:'Cacahuates naturales',cantidad:'20 piezas (20g)',g:20,cat:'grasas y semillas'}],
    pasos:['Medir la porción y servir al natural o ligeramente tostados sin sal.'],
  },
  agua_pepino:{
    nombre:'Agua de pepino con limón', tipo:'colacion', prot_shake:false,
    kcal:15, prot:0, carbs:3, grasas:0,
    ingredientes:[
      {nombre:'Pepino pelado',  cantidad:'½ taza (30g)',g:30, cat:'verduras'},
      {nombre:'Limón (jugo)',   cantidad:'10ml',        g:10, cat:'frutas'},
      {nombre:'Stevia',         cantidad:'1 sobre',     g:0,  cat:'salsas y condimentos'},
    ],
    pasos:['Licuar el pepino con agua, jugo de limón y stevia.',
           'Colar y servir bien frío.'],
  },
  frijoles_enteros:{
    nombre:'Frijoles enteros cocidos', tipo:'colacion', prot_shake:false,
    kcal:65, prot:4, carbs:12, grasas:0,
    ingredientes:[{nombre:'Frijoles enteros cocidos',cantidad:'½ taza (64g)',g:64,cat:'leguminosas'}],
    pasos:['Calentar los frijoles cocidos sin agregar grasa adicional.'],
  },
  cacahuates_12:{
    nombre:'Cacahuates (12 piezas)', tipo:'colacion', prot_shake:false,
    kcal:70, prot:3, carbs:2, grasas:6,
    ingredientes:[{nombre:'Cacahuates naturales',cantidad:'12 piezas (12g)',g:12,cat:'grasas y semillas'}],
    pasos:['Medir la porción y servir al natural o ligeramente tostados sin sal.'],
  },

  /* ── CENAS ──────────────────────────────────────────────── */
  verduras_vapor:{
    nombre:'Verduras al vapor', tipo:'cena', prot_shake:false,
    kcal:62, prot:4, carbs:13, grasas:0,
    ingredientes:[
      {nombre:'Brócoli cocido',  cantidad:'½ taza (92g)',   g:92,  cat:'verduras'},
      {nombre:'Nopales cocidos', cantidad:'½ taza (74.5g)', g:74.5,cat:'verduras'},
      {nombre:'Zanahoria',       cantidad:'½ taza (40g)',   g:40,  cat:'verduras'},
    ],
    pasos:['Lavar y trozar brócoli, nopales y zanahoria.',
           'Cocer al vapor 8–10 min hasta suavizar sin perder el color.',
           'Sazonar con limón y sal al gusto.'],
  },
  rollitos_jamon:{
    nombre:'Rollitos de jamón con queso', tipo:'cena', prot_shake:false,
    kcal:301, prot:24, carbs:2, grasas:22,
    ingredientes:[
      {nombre:'Jamón de pavo',  cantidad:'2 rebanadas (42g)', g:42, cat:'proteínas'},
      {nombre:'Queso gouda',    cantidad:'70g',               g:70, cat:'lácteos'},
    ],
    pasos:['Extender las rebanadas de jamón de pavo.',
           'Colocar una tira de queso gouda en cada rebanada y enrollar.',
           'Servir fríos o calentar 1 min en sartén.'],
  },
  calabacitas_carne:{
    nombre:'Calabacitas con carne molida', tipo:'cena', prot_shake:false,
    kcal:344, prot:25, carbs:4, grasas:24,
    ingredientes:[
      {nombre:'Calabacita cocida',    cantidad:'1 pieza (90g)',g:90, cat:'verduras'},
      {nombre:'Carne molida de res',  cantidad:'75g',          g:75, cat:'proteínas'},
      {nombre:'Queso manchego',       cantidad:'40g',          g:40, cat:'lácteos'},
      {nombre:'Cebolla blanca',       cantidad:'15g',          g:15, cat:'verduras'},
      {nombre:'Jitomate',             cantidad:'10g',          g:10, cat:'verduras'},
      {nombre:'Aceite en aerosol',    cantidad:'5ml',          g:5,  cat:'grasas y semillas'},
    ],
    pasos:['Dorar la carne molida en sartén con aerosol; sazonar con sal, pimienta y ajo.',
           'Añadir calabacita en cubos, jitomate y cebolla; cocinar 5–7 min.',
           'Bajar el fuego; agregar queso manchego encima y fundir 2 min.'],
  },
  chayote_queso:{
    nombre:'Chayote con queso gouda', tipo:'cena', prot_shake:false,
    kcal:333, prot:19, carbs:12, grasas:23,
    ingredientes:[
      {nombre:'Chayote',      cantidad:'1 taza (120g)',    g:120, cat:'verduras'},
      {nombre:'Queso gouda',  cantidad:'70g',              g:70,  cat:'lácteos'},
      {nombre:'Aguacate',     cantidad:'¼ pieza (23g)',    g:23,  cat:'grasas y semillas'},
    ],
    pasos:['Cocer el chayote en agua con sal 10–12 min hasta suavizar; escurrir y cubicar.',
           'Servir tibio con el queso gouda en trozos y el aguacate.'],
  },
  verduras_salteadas:{
    nombre:'Verduras salteadas con queso manchego', tipo:'cena', prot_shake:false,
    kcal:373, prot:18, carbs:8, grasas:29,
    ingredientes:[
      {nombre:'Queso manchego',       cantidad:'80g',              g:80, cat:'lácteos'},
      {nombre:'Pimiento rojo o verde',cantidad:'½ taza (45g)',     g:45, cat:'verduras'},
      {nombre:'Zanahoria',            cantidad:'½ taza (40g)',     g:40, cat:'verduras'},
      {nombre:'Acelga',               cantidad:'10g',              g:10, cat:'verduras'},
      {nombre:'Cebolla picada',       cantidad:'2 cdas (10g)',     g:10, cat:'verduras'},
      {nombre:'Aceite de canola',     cantidad:'1 cdita (5ml)',    g:5,  cat:'grasas y semillas'},
    ],
    pasos:['Calentar aceite de canola en sartén a fuego medio-alto.',
           'Saltear pimiento, zanahoria, acelga y cebolla 4–5 min; sazonar.',
           'Servir con el queso manchego encima (se funde levemente con el calor).'],
  },
  verduras_queso:{
    nombre:'Verduras con queso manchego', tipo:'cena', prot_shake:false,
    kcal:249, prot:15, carbs:6, grasas:18,
    ingredientes:[
      {nombre:'Queso manchego',       cantidad:'60g',              g:60, cat:'lácteos'},
      {nombre:'Brócoli cocido',       cantidad:'40g',              g:40, cat:'verduras'},
      {nombre:'Zanahoria',            cantidad:'30g',              g:30, cat:'verduras'},
      {nombre:'Pimiento rojo o verde',cantidad:'10g',              g:10, cat:'verduras'},
    ],
    pasos:['Cocer brócoli y zanahoria al vapor 8 min.',
           'Cortar el pimiento crudo en tiras.',
           'Servir las verduras con el queso manchego en trozos.'],
  },
};

const PLAN_MARZO = [
  {dia:'Lunes',     desayuno:'omelette_jamon',     comida:'bistec_salsa_verde', colacion:'queso_manchego_80',  cena:'verduras_vapor'},
  {dia:'Martes',    desayuno:'huevo_pan_platano',   comida:'fajitas_pollo',      colacion:'salchicha_pavo',     cena:'rollitos_jamon'},
  {dia:'Miércoles', desayuno:'sandwich',            comida:'tinga_pollo',        colacion:'queso_manchego_60',  cena:'calabacitas_carne'},
  {dia:'Jueves',    desayuno:'panela_calabacita',   comida:'pollo_ensalada',     colacion:'salchicha_pavo_15',  cena:'chayote_queso'},
  {dia:'Viernes',   desayuno:'omelette_mexicana',   comida:'fajita_arroz',       colacion:'cacahuates_20',      cena:'verduras_salteadas'},
  {dia:'Sábado',    desayuno:'sandwich_aguacate',   comida:'bistec_plancha',     colacion:'agua_pepino',        cena:'rollitos_jamon'},
  {dia:'Domingo',   desayuno:'omelette_espinacas',  comida:'bistec_jitomate',    colacion:'frijoles_enteros',   cena:'verduras_queso'},
];
const PLAN_ABRIL = [
  {dia:'Lunes',     desayuno:'omelette_jamon',     comida:'bistec_salsa_verde', colacion:'queso_manchego_80',  cena:'verduras_vapor'},
  {dia:'Martes',    desayuno:'licuado_fresa',       comida:'fajitas_pollo',      colacion:'salchicha_pavo',     cena:'rollitos_jamon'},
  {dia:'Miércoles', desayuno:'licuado_mora',        comida:'tinga_pollo',        colacion:'queso_manchego_60',  cena:'calabacitas_carne'},
  {dia:'Jueves',    desayuno:'panela_calabacita',   comida:'pollo_ensalada',     colacion:'salchicha_pavo_15',  cena:'chayote_queso'},
  {dia:'Viernes',   desayuno:'licuado_platano',     comida:'fajita_arroz',       colacion:'cacahuates_20',      cena:'verduras_salteadas'},
  {dia:'Sábado',    desayuno:'sandwich_aguacate',   comida:'bistec_plancha',     colacion:'agua_pepino',        cena:'rollitos_jamon'},
  {dia:'Domingo',   desayuno:'omelette_espinacas',  comida:'bistec_jitomate',    colacion:'cacahuates_12',      cena:'verduras_queso'},
];
let PLANES = {marzo: PLAN_MARZO, abril: PLAN_ABRIL};

// Orden de categorías en la lista de compras
const CAT_ORDER = ['proteínas','lácteos','verduras','frutas','granos y cereales','leguminosas','grasas y semillas','suplementos','salsas y condimentos'];
let currentPlan = 'marzo';
let currentRecipeFilter = 'todos';


/* ════════════════════════════════════════════════════════════
   API — Google Apps Script
   La URL y el token se guardan en el navegador (localStorage),
   nunca en el repositorio. Se configuran desde el engranaje ⚙.
   ════════════════════════════════════════════════════════════ */
const API_KEY_URL   = 'maca-api-url';
const API_KEY_TOKEN = 'maca-api-token';

function apiUrl()   { try { return localStorage.getItem(API_KEY_URL)   || ''; } catch(e){ return ''; } }
function apiToken() { try { return localStorage.getItem(API_KEY_TOKEN) || ''; } catch(e){ return ''; } }
function apiConfigurada(){ return !!apiUrl(); }

/* POST para lo que no cabe en una URL (documentos, fotos).
   Se manda como text/plain a propósito: así el navegador no dispara
   preflight CORS, que Apps Script no sabe responder. */
async function apiPost(body){
  const base = apiUrl();
  if(!base) throw new Error('Falta configurar la URL de la API (⚙).');
  const r = await fetch(base, {
    method:'POST', redirect:'follow',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(Object.assign({token: apiToken()}, body))
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  const d = await r.json();
  if(d.ok === false) throw new Error(d.error || 'Error de la API');
  return d;
}

/* Lee un archivo como base64 sin el prefijo data: */
function fileABase64(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload  = () => res(String(fr.result).split(',')[1]);
    fr.onerror = () => rej(new Error('No se pudo leer el archivo.'));
    fr.readAsDataURL(file);
  });
}

/* Reduce una imagen antes de subirla: menos espera y menos datos.
   Los PDF pasan tal cual. */
async function prepararArchivo(file, maxLado = 1600, calidad = 0.82){
  if(file.type === 'application/pdf' || !file.type.startsWith('image/')){
    return {mimeType: file.type || 'application/pdf', datos: await fileABase64(file)};
  }
  const bitmap = await createImageBitmap(file).catch(()=>null);
  if(!bitmap) return {mimeType: file.type, datos: await fileABase64(file)};

  let {width:w, height:h} = bitmap;
  const escala = Math.min(1, maxLado/Math.max(w,h));
  w = Math.round(w*escala); h = Math.round(h*escala);

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const dataUrl = cv.toDataURL('image/jpeg', calidad);
  return {mimeType:'image/jpeg', datos: dataUrl.split(',')[1]};
}

async function api(params){
  const base = apiUrl();
  if(!base) throw new Error('Falta configurar la URL de la API (icono ⚙ arriba a la derecha).');
  const qs = new URLSearchParams(Object.assign({token: apiToken()}, params));
  const r  = await fetch(base + (base.includes('?') ? '&' : '?') + qs.toString(),
                         {method:'GET', redirect:'follow'});
  if(!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if(d.ok === false) throw new Error(d.error || 'Error de la API');
  return d;
}

/* ── Estado del tracker: SIEMPRE indexado por ID estable ───────── */
const trackerState = {};      // { supId: boolean } — lo marcado ahora mismo
let   fechaActiva  = hoyISO();  // día que se está registrando
let   yaRegistrado = null;      // lo que la hoja ya tiene para fechaActiva
const TRK_KEY = 'maca-tracker-borrador';

function p2(n){ return String(n).padStart(2,'0'); }
function hoyISO(){
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
}
function horaAhora(){
  const d = new Date();
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function fechaBonita(iso){
  const [y,m,dd] = iso.split('-').map(Number);
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const hoy = hoyISO();
  if(iso === hoy) return 'hoy';
  const ayer = new Date(); ayer.setDate(ayer.getDate()-1);
  if(iso === `${ayer.getFullYear()}-${p2(ayer.getMonth()+1)}-${p2(ayer.getDate())}`) return 'ayer';
  return `${dd} ${MESES[m-1]}`;
}

/* Guarda lo marcado en el navegador para que recargar no lo pierda. */
function guardarBorrador(){
  try {
    localStorage.setItem(TRK_KEY, JSON.stringify({fecha: fechaActiva, estado: trackerState}));
  } catch(e){}
}
function leerBorrador(fecha){
  try {
    const b = JSON.parse(localStorage.getItem(TRK_KEY) || 'null');
    return (b && b.fecha === fecha) ? b.estado : null;
  } catch(e){ return null; }
}
function limpiarBorrador(){
  try { localStorage.removeItem(TRK_KEY); } catch(e){}
}

/* Carga lo que la hoja ya tiene para `fecha` y lo fusiona con el borrador local.
   Esto es lo que evita que marcar por la noche borre lo de la mañana. */
async function cargarDia(fecha){
  fechaActiva = fecha;
  const aviso = document.getElementById('dia-aviso');
  if(aviso) aviso.innerHTML = '<span style="color:#888">⏳ Consultando lo ya registrado…</span>';

  yaRegistrado = null;
  try {
    const d = await api({action:'historial'});
    const dia = (d.historial || []).find(e => e.fecha === fecha);
    yaRegistrado = dia ? dia.tomas : {};
    _notaOriginal = (dia && dia.nota) ? dia.nota : '';
    const elNota = document.getElementById('nota-input');
    if(elNota) elNota.value = _notaOriginal;
  } catch(e){
    yaRegistrado = null;   // sin conexión: no podemos saberlo
  }

  // Base: lo que ya está en la hoja. Encima, el borrador local.
  SUPS.forEach(s => { trackerState[s.id] = !!(yaRegistrado && yaRegistrado[s.id]); });
  const borrador = leerBorrador(fecha);
  if(borrador) SUPS.forEach(s => { if(borrador[s.id]) trackerState[s.id] = true; });

  renderHorario();
  renderAvisoDia();
}

function renderAvisoDia(){
  const aviso = document.getElementById('dia-aviso');
  if(!aviso) return;
  const nYa = yaRegistrado ? Object.values(yaRegistrado).filter(Boolean).length : 0;
  const esHoy = fechaActiva === hoyISO();

  let html = '';
  if(yaRegistrado === null){
    html = `<span style="color:#b45309">⚠️ No se pudo consultar lo ya registrado. Guarda con cuidado: podrías sobrescribir.</span>`;
  } else if(nYa > 0){
    html = `<span style="color:#15803d">✓ ${fechaBonita(fechaActiva)} ya tiene ${nYa} toma${nYa>1?'s':''} registrada${nYa>1?'s':''}.</span>
            <span style="color:#888">Se conservan; solo agrega lo que falte.</span>`;
  } else {
    html = `<span style="color:#888">Sin registro para ${fechaBonita(fechaActiva)} todavía.</span>`;
  }
  if(!esHoy){
    html = `<span class="dia-chip">📅 Registrando ${fechaBonita(fechaActiva)}</span> ` + html;
  }
  aviso.innerHTML = html;
}

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function supById(id){ return SUPS.find(s=>s.id===id); }

/* ================================================================
   CONFIG DE BLOQUES (localStorage)
   BLOQUES = definición de cada bloque (nombre, franja, descripción)
   LAYOUT  = { bloqueId: [supId,...] } → posición y orden
   Los IDs de suplemento son estables: mover un suplemento de bloque
   NO afecta cómo se guarda ni cómo se lee el historial.
================================================================ */
const SUPS_CFG_KEY = 'maca-sups-config-v1';

function loadSupsConfig(){
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SUPS_CFG_KEY) || 'null'); } catch(e){}
  if (saved && Array.isArray(saved.bloques) && saved.bloques.length) {
    BLOQUES = saved.bloques;
    LAYOUT  = saved.layout || {};
    migrarBloquesNuevos();
  } else {
    BLOQUES = JSON.parse(JSON.stringify(BLOQUES_DEFAULT));
    LAYOUT  = {};
  }
  normalizeLayout();
  saveSupsConfig();   // deja la distribución fijada desde el primer arranque
}

/* Cuando una versión nueva de la app añade un bloque por defecto —como
   "tarde"— la configuración guardada en localStorage no lo conoce y el
   bloque no aparecería nunca sin pulsar "Restaurar bloques por defecto",
   que borra los bloques propios. Esta migración inserta sólo los que
   faltan y no toca ni los bloques creados por la usuaria ni el orden de
   los suplementos dentro de cada uno. Es idempotente: en el segundo
   arranque ya no hay nada que añadir. */
function migrarBloquesNuevos(){
  const existentes = new Set(BLOQUES.map(b => b.id));
  const faltantes  = BLOQUES_DEFAULT.filter(b => !existentes.has(b.id));
  if (!faltantes.length) return;
  faltantes.forEach(b => BLOQUES.push(JSON.parse(JSON.stringify(b))));
  BLOQUES.sort((x, y) => (x.desde || '99:99').localeCompare(y.desde || '99:99'));
}

function saveSupsConfig(){
  try { localStorage.setItem(SUPS_CFG_KEY, JSON.stringify({bloques:BLOQUES, layout:LAYOUT})); } catch(e){}
}

/* Garantiza que cada suplemento existente aparezca exactamente una vez
   y descarta IDs de suplementos que ya no existen. Los suplementos
   nuevos caen en su bloque por defecto (campo .slot). */
function normalizeLayout(){
  const validBlk = new Set(BLOQUES.map(b=>b.id));
  Object.keys(LAYOUT).forEach(k=>{ if(!validBlk.has(k)) delete LAYOUT[k]; });
  BLOQUES.forEach(b=>{ if(!Array.isArray(LAYOUT[b.id])) LAYOUT[b.id] = []; });

  const seen = new Set();
  BLOQUES.forEach(b=>{
    LAYOUT[b.id] = LAYOUT[b.id].filter(id=>{
      if (seen.has(id) || !supById(id)) return false;
      seen.add(id); return true;
    });
  });
  SUPS.forEach(s=>{
    if (seen.has(s.id)) return;
    const destino = validBlk.has(s.slot) ? s.slot : (BLOQUES[0] && BLOQUES[0].id);
    if (destino){ LAYOUT[destino].push(s.id); seen.add(s.id); }
  });
}

function bloqueDeSup(supId){
  return BLOQUES.find(b => (LAYOUT[b.id]||[]).includes(supId)) || null;
}

function resetBloques(){
  if(!confirm(`¿Restaurar los ${BLOQUES_DEFAULT.length} bloques por defecto? Se perderán los bloques que hayas creado y las horas que hayas ajustado (los suplementos no se pierden).`)) return;
  BLOQUES = JSON.parse(JSON.stringify(BLOQUES_DEFAULT));
  LAYOUT  = {};
  normalizeLayout();
  saveSupsConfig();
  renderHorario();
  renderProtocolo();
}

/* ================================================================
   GUARDAR DÍA EN DRIVE
   El payload se indexa por ID de suplemento, no por posición ni por
   columna. Así el registro sigue siendo correcto aunque muevas el
   suplemento de bloque, lo reordenes, o agregues/quites otros.

   TRES ESTADOS, no dos. Antes todo lo que no estuviera marcado se
   mandaba como 0, así que guardar a mediodía escribía la tarde y la
   noche enteras como olvido. Ahora:

     tomados     → 1   lo marcaste
     todos       → 0   lo viste y lo dejaste sin marcar
     pendientes  → ''  su bloque todavía no ha cerrado su ventana

   La celda vacía es la que faltaba: no es un cero, es "aún no tocaba".
   Solo existe registrando HOY; en un día pasado todo lo que no marcas
   es un cero de verdad, porque estás respondiendo por el día completo.
================================================================ */

/* true si el bloque del suplemento todavía no ha cerrado su ventana.
   Se apoya en estadoBloque(), que ya devuelve 'neutro' cuando la fecha
   activa no es hoy — por eso el registro retroactivo no genera vacías. */
function supEnEspera(s){
  if(supPorComprar(s)) return false;
  const b = bloqueDeSup(s.id);
  if(!b) return false;
  const est = estadoBloque(b);
  return est === 'proximo' || est === 'ahora';
}

async function guardarDia() {
  const btn = document.getElementById('btn-guardar-dia');
  const msg = document.getElementById('save-msg');
  const fecha = fechaActiva;
  const hora  = horaAhora();

  const enJuego    = supsEnJuego();
  const tomados    = enJuego.filter(s => trackerState[s.id]).map(s => s.id);
  const pendientes = enJuego.filter(s => !trackerState[s.id] && supEnEspera(s)).map(s => s.id);
  const espera     = new Set(pendientes);
  const todos      = enJuego.filter(s => !espera.has(s.id)).map(s => s.id);

  // ── Protección contra pérdida de datos ──
  // Si la hoja ya tenía tomas marcadas y ahora se mandarían menos,
  // se avisa antes de sobrescribir. Los que están en espera no cuentan:
  // no se van a degradar, se van a dejar como estaban.
  if(yaRegistrado){
    const perdidos = Object.keys(yaRegistrado)
      .filter(id => yaRegistrado[id] && !trackerState[id] && !espera.has(id));
    if(perdidos.length){
      const nombres = perdidos
        .map(id => { const s = SUPS.find(x=>x.id===id); return s ? s.sustancia : id; })
        .join(', ');
      const ok = confirm(
        `Ojo: ${perdidos.length} toma(s) que ya estaban registradas quedarían como NO tomadas:\n\n` +
        nombres + `\n\n¿Guardar de todas formas?`
      );
      if(!ok){ return; }
    }
  } else if(!tomados.length && todos.length){
    if(!confirm('No hay nada marcado. ¿Guardar el día como sin tomas?')) return;
  }

  // Todo lo del día sigue en espera: no hay nada que escribir todavía.
  if(!tomados.length && !todos.length){
    if(msg){
      msg.textContent = 'Todavía no toca ninguna toma. Vuelve más tarde.';
      msg.style.display = 'inline';
    }
    return;
  }

  if(btn){ btn.textContent='⏳ Guardando…'; btn.disabled=true; }

  try {
    // Si no se pudo verificar lo ya registrado (sin conexión al abrir),
    // se pide modo merge para que el servidor no degrade tomas existentes.
    const modo = (yaRegistrado === null) ? 'merge' : 'reemplazo';
    const r = await api({action:'save', fecha, hora, modo,
      tomados:tomados.join(','), todos:todos.join(','), pendientes:pendientes.join(',')});
    if(btn) btn.textContent = '✅ Guardado';
    if(msg){
      const cola = pendientes.length ? ` · ${pendientes.length} aún por tocar` : '';
      msg.textContent = `${r.actualizado?'Actualizado':'Guardado'} ${fechaBonita(fecha)} · ${tomados.length} tomas${cola}`;
      msg.style.display='inline';
    }
    // Lo guardado pasa a ser la nueva base y el borrador deja de hacer falta.
    // Los que quedaron en espera NO se anotan: siguen siendo "sin respuesta",
    // y así el aviso de sobrescritura no los tratará como ceros al volver.
    yaRegistrado = {};
    enJuego.forEach(s => { if(!espera.has(s.id)) yaRegistrado[s.id] = !!trackerState[s.id]; });
    limpiarBorrador();
    renderAvisoDia();
    _regEntries = null;
  } catch(e){
    if(btn){ btn.textContent='❌ Error — reintentar'; btn.disabled=false; }
    if(msg){ msg.textContent = e.message; msg.style.display='inline'; }
  }
  setTimeout(()=>{
    if(btn){ btn.textContent='💾 Guardar día'; btn.disabled=false; }
    if(msg) msg.style.display='none';
  }, 5000);
}

