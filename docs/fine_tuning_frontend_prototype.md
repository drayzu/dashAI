# Prototipo de frontend de fine-tuning

Fecha: 2026-10-04. Rama local: `codex/prototipo-finetuning-frontend`.
Base personal: `1b25f7b1ec17ea53c395b0e8e0d06dd1fb1be66a`.

## Abrir y volver a la versión experimental

```powershell
cd E:\DashAI
git switch codex/prototipo-finetuning-frontend
cd DashAI\front
yarn start:prototype
```

Abrir `http://localhost:3000/app/generative/fine-tuning`. Si 3000 está ocupado,
definir `$env:PORT='3002'` antes del comando y utilizar ese puerto.
El servidor solo sirve el frontend. No iniciar Python, Huey ni el backend.

Para volver al funcionamiento experimental, detener el servidor con Ctrl+C
y ejecutar `yarn start` sin `REACT_APP_FINETUNING_DEMO`. También se puede volver
a `memoria/glm-weekend-productization` después de detener el servidor.
La rama no se publicó. No se hicieron cambios en `E:\DashAI-oficial`.

## Guion para la reunión

1. Abrir Generative y su entrada Fine-tuning, o entrar directamente a la URL.
2. Seleccionar Asistente de soporte o crear una sesión con el botón +.
3. Mostrar el checkpoint Transformers, su revisión **ilustrativa** y LoRA/QLoRA.
4. En Datos, revisar el reconocimiento del formato y corregir el mapeo.
   Mostrar Datos originales y Ejemplos SFT. Importar un ejemplo desde Data
   y comprobar que se conserva el borrador al regresar.
5. Ajustar pasos o épocas, batch y acumulación; abrir opciones avanzadas.
6. Validar el resumen e iniciar. El recorrido exitoso tarda unos 40 segundos.
7. Mostrar fases, pérdidas y recursos **simulados**. Abrir el resultado en chat.
8. Enviar un mensaje y cambiar de adaptador: el mensaje pendiente conserva
   su selección y parámetros originales.
9. Mostrar el historial y la procedencia de cada resultado.
10. En el menú de tres puntos, elegir un fallo y repetir el recorrido. La
    cancelación está en el detalle de ejecución. En Resultados, abrir un
    adaptador y simular su ausencia; una ejecución completada no cambia de
    estado histórico, pero ya no habilita el chat.

Reiniciar demostración en el menú de tres puntos restaura los ejemplos.
No borra bases, datasets, preferencias ni conversaciones reales.
El idioma sigue el selector de DashAI; se incluyeron textos ES y EN. Los
datasets de ejemplo son contenido de muestra en español.

## Correspondencia con el diseño v2

La referencia arquitectónica es `diagramas-finetuning/v2/` de la memoria,
basada en el repositorio oficial `develop@52c84fdab971417e49cf1040ecf08b4fb7fdb5c0`.
La implementación experimental de la copia personal es otra base: sus
entidades y endpoints no se presentan como si ya implementaran ese diseño.

| Pantalla | Diagramas v2 | Decisión representada |
| --- | --- | --- |
| Generative y sesiones | 2, 3, 10 | Fine-tuning es una entrada explícita, no una tarea de inferencia. |
| Modelo y preparación | 1, 9 | Checkpoint Transformers, revisión y disponibilidad separadas. |
| Datos y vista previa | 5, 6 | Alpaca, pares o mensajes JSON; mapeo y particiones reproducibles. |
| Configuración y revisión | 2, 4 | Un único límite de duración, validación y resumen. |
| Ejecución y cancelación | 4, 8 | Cola, estado, fase, motivo y publicación son conceptos distintos. |
| Historial y resultados | 6, 8 | Configuración y datos congelados; disponibilidad independiente del éxito. |
| Chat | 7, 10 | Selección por adaptador; configuración congelada por mensaje. |

## Organización y límites

- Páginas y componentes específicos, usando React Router, paneles, MUI,
  iconos y campos por esquema existentes. No se modificó `FineTuning.jsx`.
- Servicio `fineTuningDemoStore`, fixtures y modelos de presentación propios.
  No son contratos HTTP ni tablas del backend.
- Axios usa un adaptador sin fallback de red solo cuando la variable vale
  `true`. Atiende los providers y la cola compartidos; bloquea otras llamadas.
  El monitor de hardware no abre WebSockets y las credenciales no aparecen.
  El recorrido inicial de Generative no abre el tour automático en modo demo,
  sin modificar las preferencias ni el comportamiento de los tours normales.
- Estado versionado en `dashai:fine-tuning-demo:v1`. Si el almacenamiento
  falla, se puede usar la demostración en memoria y se muestra una advertencia.
- Al recargar, el simulador continúa según el tiempo guardado. El cierre del
  trabajador real y la recuperación de archivos se representan mediante el
  escenario Interrupción; no se implementan como procesos reales del navegador.
- Las importaciones usan fixtures, no leen ni convierten archivos arbitrarios.
  La vista SFT es ilustrativa: no ejecuta tokenización ni verifica máscaras de
  un tokenizer real. No hay entrenamiento, descarga, autenticación o LLM.
- Solo se cubre fine-tuning, el regreso desde Data y el chat del prototipo.
  Las otras secciones muestran un estado fuera del alcance de la demostración.
- GGUF, RAG, Unsloth como backend, entrenamiento completo, multimodalidad,
  preferencias, exportación y entrenamiento distribuido quedan fuera.

## Validación reproducible

```powershell
cd E:\DashAI\DashAI\front
yarn test --watchAll=false --runInBand --silent --testPathPattern='fineTuningDemo|FineTuningPrototype|api/fineTuning.test|generative/FineTuning.test'
yarn build
```

La prueba de navegador está en `scripts/check-fine-tuning-prototype.cjs`.
Requiere Playwright o playwright-core instalado y Chromium disponible; no se
añadió una dependencia de producción para QA. Se puede indicar su ruta:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/diego/AppData/Local/hermes/hermes-agent/node_modules/playwright-core'
$env:PROTOTYPE_QA_DIR='C:/Users/diego/Documents/ChatGPT/Memoria/prototipo-finetuning-frontend/capturas'
node scripts/check-fine-tuning-prototype.cjs
```

`PROTOTYPE_URL` permite usar otro puerto. Las capturas y `browser-report.json`
se generan en la carpeta indicada, fuera del repositorio.

El lint general existente no es una comprobación válida de TypeScript:
su configuración falla al analizar numerosos `.ts` previos y también recorre
el build generado. No se modificó esa configuración ni se corrigieron archivos
ajenos al prototipo. Ejecutar el lint focalizado de los archivos JS/JSX y
consultar el resumen de validación en la carpeta de entrega.

```powershell
yarn eslint src/api/fineTuningDemo/*.js src/components/generative/fineTuning/*.jsx src/components/generative/fineTuning/demoStrings.js src/hooks/generative/useFineTuningDemo.js src/pages/generative/FineTuningPrototype.jsx src/pages/generative/FineTuningPrototype.test.jsx src/pages/generative/FineTuningDataDemo.jsx src/App.jsx src/components/ResponsiveAppBar.jsx src/components/hardware/HardwareMonitorButton.jsx src/hooks/useHardwareMonitor.js src/pages/generative/Generative.jsx
```

Se verificaron 44 pruebas en cinco suites y la compilación con el modo activado
y desactivado. Playwright completó el recorrido, los fallos principales y las
vistas de escritorio/móvil en ambos temas, sin errores de página ni peticiones
al backend o servicios externos. Las 21 capturas se revisaron visualmente.
Las suites originales de fine-tuning siguen pasando con la variable desactivada;
esto no sustituye una prueba integral de todos los módulos con un backend real.

## Próximo paso técnico

Tras revisar el recorrido con el equipo, conectar una ejecución vertical real:
preparación SFT, entrenamiento y resolución del adaptador en Generative. Antes
de ello hay que reconciliar los contratos experimentales con las entidades y
estados propuestos por el diseño v2. El prototipo no demuestra compatibilidad
de equipos, mejoras de rendimiento ni calidad de las respuestas.
