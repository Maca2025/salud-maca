# Salud Maca

Seguimiento personal de salud: composición corporal, análisis de laboratorio,
nutrición, fotos de progreso y tracker de suplementos.

Es una sola página estática. **No contiene información médica.** Todos los datos
viven en Google Sheets privadas y se cargan al abrir la página, así que este
repositorio puede ser público sin exponer nada.

```
┌─────────────────┐   fetch    ┌──────────────┐   lee/escribe   ┌──────────────┐
│  index.html     │ ─────────► │ Apps Script  │ ──────────────► │ Sheets+Drive │
│ (GitHub Pages)  │ ◄───────── │  (privado)   │ ◄────────────── │  (privados)  │
└─────────────────┘    JSON    └──────────────┘                 └──────────────┘
      código                    lógica + textos                      datos
```

---

## Qué archivo va dónde

| Archivo | Destino | Nota |
|---|---|---|
| `index.html` | **Repositorio**, en la raíz | GitHub Pages sirve la raíz. |
| `registro.html` | **Repositorio** | Acceso directo al tracker. |
| `manifest.webmanifest` | **Repositorio** | Para instalarla en el celular. |
| `manifest-registro.webmanifest` | **Repositorio** | Manifest del segundo icono. |
| `icon-app.png`, `icon-registro.png` | **Repositorio** | Iconos de las dos PWA. |
| `README.md` | **Repositorio** | Este archivo. |
| `Codigo.gs` | **script.google.com** — NUNCA al repositorio | Contiene diagnósticos y valores de laboratorio. |

> ### `Codigo.gs` no se sube nunca
>
> Ahí viven las explicaciones clínicas, las interacciones, el panel de estado con
> valores reales, los IDs de las hojas y el token. Va pegado en el editor de Apps
> Script, que es privado de la cuenta de Google.
>
> **No hay ningún mecanismo automático que lo impida.** Un `.gitignore` solo
> actuaría usando `git` desde la terminal; subiendo archivos por la interfaz web
> de GitHub se ignora por completo. La única protección real es que ese archivo
> no salga de Apps Script, y revisar con los ojos la lista de archivos antes de
> confirmar cada subida.
>
> Ya ocurrió una vez: estuvo publicado en el repositorio durante meses, y además
> en una versión desfasada respecto a la que estaba corriendo.

---

## Puesta en marcha

### 1. Crear el Apps Script

1. Entra a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra lo que haya y pega el contenido de `Codigo.gs`.
3. Ponle nombre al proyecto (ej. *Salud Maca Api*).
4. Cambia la constante `TOKEN`. Ver más abajo cómo debe ser.
5. Guarda (Ctrl+S).

Los IDs de las hojas ya vienen configurados en `SHEETS`.

> #### Cómo debe ser el token
>
> **Largo y aleatorio: mínimo 24 caracteres, letras y números sin significado.**
> No una palabra, no un nombre, no una fecha.
>
> No es una formalidad. La implementación es accesible para *cualquier persona*
> —tiene que serlo para que la página pueda llamarla sin pedir login— así que el
> token es lo único que separa tus datos y tus fotos de quien tenga la URL. Una
> clave corta o adivinable equivale a no tener ninguna.
>
> No lo escribas en ningún chat, correo, documento ni enlace guardado.

### 2. Probar que lee bien

En el editor, selecciona la función `probar` y dale **Ejecutar**. La primera vez
Google pedirá permisos: acéptalos (es tu propio script sobre tus propios
archivos).

El registro de ejecución lista cuántas filas leyó de cada hoja. Si alguna sale
en 0, esa hoja está vacía o su ID no es el correcto.

Hay más funciones de diagnóstico en el mismo archivo: `probarGemini`,
`probarComida`, `probarFotos`, `listarModelos` y `pedirPermisos`.

### 3. Activar la lectura de documentos (opcional)

Permite subir el PDF de un análisis, la foto de un reporte de bioimpedancia o el
PDF de un plan, y que los valores se llenen solos.

1. Entra a [aistudio.google.com/apikey](https://aistudio.google.com/apikey) y
   crea una API key de Gemini. La capa gratuita alcanza de sobra.
2. En el editor: **Configuración del proyecto** (engranaje del menú lateral) →
   hasta abajo, **Propiedades del script** → *Agregar propiedad*.
3. Nombre: `GEMINI_API_KEY`. Valor: la clave. Guardar.

**La clave se queda ahí.** Nunca llega al navegador ni al repositorio: el
navegador manda el archivo al Apps Script, y es el Apps Script quien llama a
Gemini.

Si no configuras esto, todo lo demás funciona igual; los datos se capturan a
mano en los formularios.

> Lo que la IA extrae **siempre se revisa antes de guardarse**. Los valores
> llegan al formulario resaltados en verde para compararlos con el documento.
> Son datos médicos: nada se escribe a ciegas.

### 4. Publicar la API

1. **Implementar** → **Nueva implementación**.
2. Tipo: **Aplicación web**. Ejecutar como: **Yo**. Acceso: **Cualquier persona**.
3. Copia la **URL de la aplicación web** (termina en `/exec`).

> Cuando cambies `Codigo.gs`, hay que publicar una **versión nueva** de la
> implementación existente — no una implementación nueva, que cambiaría la URL.
> **Implementar → Administrar implementaciones → ✎ → Versión: Nueva versión.**

### 5. Publicar la página

1. Sube `index.html` y los demás archivos a este repositorio.
2. **Settings** → **Pages** → Source: `main` / carpeta raíz.
3. En un par de minutos queda en `https://<usuario>.github.io/<repo>/`.

### 6. Conectar

Abre la página y toca el engranaje **⚙**. Pega la URL del Apps Script y el
token. Se guardan solo en ese dispositivo (`localStorage`), nunca en el
repositorio.

> **No uses un enlace con la URL y el token dentro** para configurar el
> teléfono. Ese enlace queda en el historial del navegador, en la lista de
> sugerencias y en cualquier sincronización de pestañas. Escríbelos a mano en ⚙.

> **Cada icono de la pantalla de inicio tiene su propio `localStorage`,
> separado del navegador.** Con dos iconos instalados (la app y el registro),
> cambiar el token obliga a reconfigurar **cada icono por separado**, más el
> navegador si la abres también ahí. Son tres sitios, no uno.

---

## Las hojas de datos

Están en la carpeta **Salud Maca — Datos** de Drive. Se pueden editar
directamente; la página toma los cambios al recargar (botón **↻**).

| Hoja | Para qué | Cómo agregar datos |
|---|---|---|
| **Composicion Corporal** | Mediciones de bioimpedancia | Copia la última fila y edita los valores. La columna `dias` son los días transcurridos desde la primera medición. |
| **Laboratorio** | Marcadores de sangre | Agrega una **columna** al final con la fecha (`sep-26`) y llena los valores. Celda vacía = no se midió. |
| **Protocolo Suplementos** | Qué se toma y por qué | Agrega una fila. El `id` debe ser único y sin espacios. |
| **Historial Suplementos** | Registro diario | Lo escribe la app sola. |
| **Planes Nutricionales** | Los planes semanales | Sube el PDF desde la app, o edita las filas a mano. |
| **Alimentos** | Valores nutricionales por 100 g | Se completa sola con IA cuando aparece un ingrediente nuevo. |
| **Optimos Laboratorio** | A dónde se quiere llegar en cada marcador | Edita `opt_min` / `opt_max`. Pon `1` en `destacado` para que salga como tarjeta. |
| **Registro Ingesta** | Proteína, agua, batidos y creatina por día | Lo escribe la app desde Nutrición → Mi ingesta. |

### Rango de laboratorio vs objetivo óptimo

Son cosas distintas y la app las muestra por separado:

- El **rango del laboratorio** dice *no estás enferma*. Es amplio a propósito,
  calculado sobre población general.
- El **objetivo óptimo** dice *aquí quieres estar*. Depende de la situación
  concreta de cada persona.

Un marcador puede salir "normal" según el laboratorio y estar lejos del objetivo
que tiene sentido en un caso particular. La tarjeta muestra las dos cosas.

Cada objetivo lleva su **nivel de evidencia**, visible en la tarjeta:

| Etiqueta | Qué significa |
|---|---|
| `guia` | Recomendación de guías clínicas o sociedades médicas |
| `practica` | Criterio clínico habitual, sin guía formal detrás |
| `funcional` | Objetivo de medicina funcional, **sin respaldo en guías de consenso** |

Esa distinción importa: un objetivo marcado como `funcional` es una referencia
para conversar con el médico, no un umbral establecido.

Tocando **ver detalle** se abre lo que hay detrás del número: qué pasa estando
por debajo, qué esperar al llegar al objetivo, cuánto tarda ese marcador en
moverse, y **qué suplementos lo influyen, contrastado con la adherencia real**.

Ese último cruce es la parte interesante. La columna `suplementos` de la hoja de
óptimos lista los ids que afectan a cada marcador, y la app los contrasta con
los últimos 30 días de registro:

- Marcador bajo **y** adherencia bajo 60% → *sube la constancia antes de
  concluir que no funciona*.
- Marcador bajo **pese a** buena adherencia → *esto es lo que hay que
  comentarle al médico*.

### Todo se edita desde la app

No hace falta abrir Sheets. Las hojas siguen ahí como respaldo, pero la edición
del día a día vive dentro de la app:

| Qué editar | Dónde |
|---|---|
| Alimentos, porciones, botones rápidos | Nutrición → **🥫 Alimentos** |
| Objetivos óptimos de laboratorio | Laboratorio → **🎯 Objetivos** |
| Protocolo de suplementos | Suplementos → Protocolo → **Editar** |
| Mediciones y análisis | Botón **＋** de cada sección |

### Cómo se calculan los macros

No están guardados en cada platillo: se **calculan** a partir de la hoja
*Alimentos*, que tiene los valores por cada 100 g.

```
Huevo entero 2 piezas 100 g  →  busca "Huevo entero" en la tabla
                             →  143 kcal por 100 g × 1.00  =  143 kcal
Queso manchego 40 g          →  380 kcal por 100 g × 0.40  =  152 kcal
                                              Omelette  =  295 kcal
```

La ventaja: corregir un alimento en la tabla lo corrige en **todos** los
platillos donde aparece.

La columna `alias` permite que un mismo alimento se reconozca escrito de varias
formas: `Huevo entero` con alias `huevo cocido|huevo` hace que las tres
versiones apunten al mismo dato.

Cuando un plan trae un ingrediente que no está en la tabla, la app lo avisa y
ofrece **✨ Completar con IA**. Los valores estimados se muestran en una tabla
editable para revisarlos antes de guardar, y quedan marcados con `fuente = ia`.

> Los valores son aproximados y varían por marca y preparación. Sirven para
> comparar planes y seguir tendencias, no para precisión clínica.

### Las fotos de progreso

No van en una hoja: viven en la carpeta **Salud Maca — Fotos**, que el Apps
Script crea sola la primera vez.

**El nombre del archivo es el dato:** fecha, doble guion bajo y el id de la
postura. Una sesión es simplemente el conjunto de archivos que comparten fecha,
y por eso una sesión incompleta no rompe nada y añadir una postura nueva no
obliga a migrar el histórico.

La lista de posturas vive en `Codigo.gs`, no aquí.

> **Las fotos son lo más sensible del proyecto.** No están en el repositorio ni
> se comparten con nadie: la app las pide una por una al Apps Script, que exige
> el token. **El token también protege las fotos.**
>
> No marques esa carpeta de Drive como "cualquiera con el enlace".

Borrar o reclasificar manda los archivos a la papelera, no los elimina: Drive
los conserva 30 días.

### La regla importante del historial

El historial se guarda **por ID de suplemento, nunca por posición de columna.**

Al guardar un día, la app manda la lista de ids tomados y el Apps Script busca
esas columnas por nombre. Esto significa que:

- Se pueden reordenar los suplementos en el tracker sin romper nada.
- Se pueden mover entre bloques horarios.
- Al agregar uno nuevo, el Apps Script crea su columna automáticamente.
- Se pueden reordenar las columnas de la hoja a mano.

En todos los casos cada ✅ sigue perteneciendo al suplemento correcto.

Si se guarda dos veces el mismo día, se **actualiza** la fila en vez de
duplicarla.

---

## Qué sí vive en este repositorio

Solo código, más las recetas y planes semanales (`RECETAS`, `PLAN_MARZO`,
`PLAN_ABRIL`): gramajes y modos de preparación, sin información médica
identificable.

Todo lo demás — mediciones, análisis, medicamentos, explicaciones clínicas,
interacciones — se sirve desde el Apps Script.

---

## Uso diario

**Suplementos → Horario & Tracker**

- Al abrir, el tracker **consulta lo que ya se registró ese día** y lo muestra
  con un ✓. Se puede marcar por la mañana, cerrar, y volver por la noche sin
  borrar lo anterior.
- Lo marcado se guarda en el navegador: recargar no lo pierde.
- **☐ todo** marca o desmarca un bloque entero.
- El selector **Día** permite completar una fecha pasada.
- Si al guardar se fuera a dejar como *no tomada* alguna toma ya registrada, la
  app avisa antes.
- El handle **⣿** arrastra un suplemento a otro bloque *(solo con ratón; en
  móvil todavía no funciona)*.
- **＋ Nuevo bloque** crea una franja con nombre, horario, descripción y color.

**Suplementos → Registro**

- **🗓️ Calendario**: vista mensual con la intensidad de cada día. Tocar un día
  lleva al tracker con esa fecha cargada.
- **📊 Adherencia**: racha actual, mejor racha y el porcentaje de cada
  suplemento **sobre los días registrados** — mide si se tomó, no si se abrió la
  app.
- **📋 Tabla**: el detalle día por día.

**Suplementos → Protocolo** muestra el costo de reponer todo. Con las columnas
`unidades` (piezas por envase) y `porDia` (tomas diarias) también calcula el
gasto mensual.

**Composición Corporal** está centrada en la **grasa**, no en el peso.

El peso es una métrica engañosa: puede quedarse quieto o subir mientras la
composición mejora. Por eso la sección mide el progreso hacia el objetivo de
grasa, calcula el ritmo en kg de grasa por semana, y muestra qué proporción de
lo perdido fue grasa y no músculo.

La pestaña **Grasa vs Músculo** marca los periodos de *recomposición*: aquellos
en los que la báscula se movió poco o hacia arriba, pero se perdió grasa o se
ganó músculo. Son avances reales que el peso no refleja.

**＋ Nueva medición** y **＋ Nuevo análisis** capturan datos directo en las
hojas. Solo el peso es obligatorio; los demás campos muestran en gris el valor
de la última medición como referencia.

**📄 Leer PDF / Leer reporte / Leer plan** hacen lo mismo a partir del
documento: se sube el archivo, la IA extrae los valores y llegan al formulario
resaltados en verde para revisarlos antes de guardar.

**Nutrición → Mi ingesta** está pensada para el celular, sin teclado:

- **Botones de alimentos frecuentes**: un toque suma su porción típica. Se
  configuran poniendo `1` en la columna `frecuente` de la hoja *Alimentos*.
- **🎤 Dictar**: se dice lo que se comió y la IA lo convierte en gramos.
- **📷 Foto**: se le toma foto al plato. Cada alimento llega con su nivel de
  confianza, y los gramos se ajustan con − y +.
- **🍽️ Del plan**: un toque suma los ingredientes del platillo que tocaba.
- **Agua**: diez vasos que se llenan tocando. **Creatina**: un botón.

La proteína se separa sola en animal y vegetal usando la columna `origen`.

Con eso se arma una vista semanal que cruza la ingesta promedio con el cambio de
grasa y músculo de esa misma semana.

> La correlación es orientativa. Con pocas semanas de datos cualquier patrón
> puede ser casualidad, y hay muchas otras variables influyendo. La app lo
> advierte en pantalla.

**Fotos de Progreso** compara dos fechas de la misma postura, lado a lado o con
un deslizador, y muestra cuánto cambiaron el peso, la grasa y el músculo entre
esas dos fechas. Hay línea de tiempo por postura y vista de sesiones con sus
huecos.

Para que la comparación sirva: misma luz, misma ropa, misma distancia. Una
sesión cada dos a cuatro semanas es suficiente.

**Laboratorio**: los valores fuera de rango son clicables y explican qué
significan, cómo afectan y qué se suele hacer.

---

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| "Falta configurar la URL de la API" | No se ha puesto la URL en ⚙. |
| "Token invalido" | El token de ⚙ no coincide con el `TOKEN` del Apps Script. En el celular, recuerda que **cada icono guarda el suyo**. |
| "HTTP 401" o "HTTP 403" | La implementación no quedó como *Cualquier persona*. |
| Se conecta pero no llegan datos | Alguna hoja está vacía, o los IDs de `SHEETS` no son los correctos. |
| Una sección sale vacía sin dar error | El `Codigo.gs` desplegado puede ser más viejo que la página. Ejecuta `probar`. |
| Cambié la hoja y no se ve | Botón **↻**. |
| Cambié `Codigo.gs` y no aplica | Falta publicar una **nueva versión** de la implementación. |
| Un suplemento nuevo no aparece en su bloque | **↺ Restaurar bloques por defecto** en el tracker. |

---

⚕️ Este proyecto organiza información de salud, no la interpreta.
Nada de lo que muestra sustituye a una consulta médica.
