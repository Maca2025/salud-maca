# Salud Maca — notas para retomar el trabajo

Este repositorio es **público** y GitHub Pages lo sirve tal cual: aquí no van
datos médicos, dosis, valores de laboratorio, tokens ni URLs del Apps Script.

## Cómo trabajar con Maca

- Responder en español y en lenguaje sencillo. Dar **un solo paso de
  instrucciones a la vez**, con el razonamiento completo pero breve.
- No escribir código sin su autorización explícita. Primero explicar el plan.
- No usar la herramienta automática de preguntas: preguntar en el texto.

## Arquitectura

- La página vive en GitHub Pages (`Maca2025/salud-maca`, rama `main`) y está
  instalada como app en el iPhone.
- Los datos viven en Google Sheets privadas de su cuenta personal, en la
  carpeta «Salud Maca — Datos», y las fotos en «Salud Maca — Fotos».
- `Codigo.gs` (el Apps Script) es privado y **nunca** se sube aquí. La
  lectura con IA usa Gemini desde el Apps Script.
- La cuenta de GitHub que usa Claude es `macapersonal09-alt`: ya es
  colaboradora de este repositorio y la app de Claude ya está instalada.
- Desde la sesión no se puede publicar directo a `main` (la regla de
  seguridad lo bloquea). Maca publica con **Create pull request → Merge**.
- El conector de GitHub (MCP) dio el error «invalid session» al crear PRs.

## Pruebas

No hay acceso a los datos reales. Se prueba con un arnés de Playwright y datos
de ejemplo:
- Se sirve la carpeta y se interceptan las llamadas a una URL falsa de API.
- Chart.js se toma de npm, porque jsDelivr está bloqueado.

El arnés vivía en el scratchpad de la sesión: hay que rehacerlo si se necesita.

## Hecho — Fase 1 (rama `claude/charming-pasteur-tl1swz`)

1. Frecuencia «Cuando lo necesite» (`frecuencia = necesidad`, `supPRN()`).
2. Desmarcar desde Hoy, con confirmación; reescribe el día completo.
3. Mover suplementos con toques (⣿ abre `abrirMover`).
4. Pestaña «Registro en lote» (`app-lote.js`).
5. Laboratorio con N fechas y escalas automáticas (`rangoAuto`).
6. Fechas de medición con año (`fechaMedicion`, a partir de `dias`) y escalas
   automáticas en Composición.

## Pendiente

1. **Maca debe publicar la Fase 1**: abrir
   https://github.com/Maca2025/salud-maca/compare/main...claude/charming-pasteur-tl1swz
   → Create pull request → Merge. Después, probar en el celular: marcar y
   desmarcar un suplemento, y revisar un día en Registro en lote.
2. En la app: poner la frecuencia «Cuando lo necesite» al medicamento que
   corresponde y corregir las dosis que Maca confirmó en el chat. Los detalles
   están en la conversación, no aquí.
3. **Fase 2** (requiere ver `Codigo.gs` **sin el token**):
   - perfil para su hijo, con los mismos módulos que ella;
   - migrar el historial viejo del Sheet de `tracker-suplementos`
     (jun–jul 2026, guardado por posición de columna);
   - terminar el inventario (`abrirInventario` llama funciones que no existen).
   - Confirmar también qué hace el servidor con `pendientes` en modo `reemplazo`.
4. **Fase 3**: recordatorios con Pushover desde el Apps Script y un widget de
   iPhone con Scriptable.
