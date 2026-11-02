// Sample datasets bundled with the prototype (SPEC §3.6). Content stays in
// Spanish in every UI language (it is data, not interface text). Names and
// descriptions shown in the UI come from fineTuning:datasets.samples.<i18nKey>.
//
// `fichas-soporte` is the thesis reference case ("caso de referencia"): turn a
// DashAI support request into a JSON ticket with exactly three fields
// (categoria ∈ datos|entrenamiento|inferencia, resumen, siguiente_paso).
// HELD_OUT_CASES are 12 reserved cases (4 per category) that never appear in
// the training dataset; they drive the base-vs-adapted comparison (R81–R85).

export const FICHA_INSTRUCTION =
  "Convierte la solicitud de soporte en una ficha JSON con categoria, resumen y siguiente_paso.";

export const FICHA_CATEGORIES = Object.freeze([
  "datos",
  "entrenamiento",
  "inferencia",
]);

export function fichaJson(categoria, resumen, siguientePaso) {
  return JSON.stringify({ categoria, resumen, siguiente_paso: siguientePaso });
}

const FICHAS = [
  // ---- datos ----
  [
    "Al importar mi dataset de instrucciones, algunas filas no tienen respuesta.",
    "datos",
    "El dataset contiene ejemplos sin respuesta.",
    "Identificar y completar o retirar explícitamente las filas sin respuesta antes de entrenar.",
  ],
  [
    "Subí un CSV con columnas pregunta y respuesta, pero DashAI no detecta el formato automáticamente.",
    "datos",
    "El formato del CSV con columnas pregunta y respuesta no se detecta automáticamente.",
    "Confirmar manualmente el mapeo de las columnas pregunta y respuesta y revisar la vista previa SFT.",
  ],
  [
    "La carga del archivo JSON falla con un error de sintaxis en la línea 212.",
    "datos",
    "El archivo JSON no se puede cargar por un error de sintaxis.",
    "Revisar la línea indicada del archivo y validar el JSON antes de volver a importarlo.",
  ],
  [
    "En la columna messages hay conversaciones con un rol 'tool' y la validación las marca como inválidas.",
    "datos",
    "Algunas conversaciones usan un rol no admitido.",
    "Convertir esas conversaciones a los roles system, user y assistant o retirarlas explícitamente del dataset.",
  ],
  [
    "Mi dataset tiene 3.000 filas pero la vista previa solo muestra 10, ¿se perdieron las demás?",
    "datos",
    "La vista previa muestra una muestra de 10 filas de un dataset de 3.000.",
    "Considerar la vista previa como muestra y revisar la validación completa que se ejecuta al iniciar la ejecución.",
  ],
  [
    "Después de importar el Excel, los acentos aparecen como símbolos raros (Ã©).",
    "datos",
    "Los caracteres acentuados se importaron con una codificación incorrecta.",
    "Exportar el archivo en UTF-8, volver a importarlo y comprobar la vista previa.",
  ],
  [
    "La huella de datos de la ejecución no coincide con la del dataset que tengo ahora.",
    "datos",
    "La huella registrada en la ejecución difiere de la del dataset actual.",
    "Verificar si el dataset cambió después de la ejecución y usar la versión registrada para reproducirla.",
  ],
  [
    "Al dividir en entrenamiento y evaluación me quedan solo 2 ejemplos de evaluación.",
    "datos",
    "La partición de evaluación resultante tiene muy pocos ejemplos.",
    "Aumentar la fracción de evaluación o agregar ejemplos revisados antes de comparar resultados.",
  ],
  [
    "Hay filas duplicadas en mi dataset de soporte, ¿eso afecta al entrenamiento?",
    "datos",
    "El dataset contiene filas duplicadas.",
    "Identificar los duplicados y decidir explícitamente si se retiran antes de fijar las particiones.",
  ],
  [
    "El validador dice que la columna 'output' no existe, pero en mi archivo se llama 'respuesta'.",
    "datos",
    "El mapeo apunta a una columna que no existe en el dataset.",
    "Asignar la columna 'respuesta' como salida en el mapeo de columnas y confirmar el formato.",
  ],
  [
    "Algunas respuestas del dataset son muy largas y aparece una advertencia de longitud.",
    "datos",
    "Algunas respuestas superan la longitud máxima configurada.",
    "Revisar esos ejemplos y aumentar la longitud máxima o acortar las respuestas sin perder la parte supervisada.",
  ],
  [
    "Quiero entrenar con un dataset que solo tiene una columna 'text' con documentos.",
    "datos",
    "El dataset solo contiene texto plano sin separar instrucción y respuesta.",
    "Convertir los documentos a pares instrucción-respuesta, porque el ajuste supervisado requiere respuestas identificables.",
  ],
  [
    "La columna messages viene como texto y DashAI dice JSON inválido en la fila 8.",
    "datos",
    "La fila 8 contiene un JSON de mensajes inválido.",
    "Corregir el JSON de la fila 8 y volver a validar el dataset.",
  ],
  [
    "Subí el dataset hace una hora y sigue apareciendo como procesando.",
    "datos",
    "La importación del dataset permanece en procesamiento por un tiempo prolongado.",
    "Revisar la cola de trabajos y el registro de la importación para saber si el trabajo sigue activo o falló.",
  ],
  [
    "Varias conversaciones terminan con un mensaje del usuario y no tienen respuesta del asistente.",
    "datos",
    "Algunas conversaciones no incluyen una respuesta del asistente.",
    "Completar esas conversaciones con la respuesta esperada o retirarlas explícitamente antes de entrenar.",
  ],
  [
    "Renombré una columna después de configurar la sesión y ahora el mapeo aparece incompleto.",
    "datos",
    "El mapeo de columnas quedó incompleto tras renombrar una columna.",
    "Volver al paso de datos, reasignar la columna renombrada y confirmar nuevamente el formato.",
  ],
  // ---- entrenamiento ----
  [
    "El entrenamiento termina, pero las normas de gradiente registradas aparecen como NaN.",
    "entrenamiento",
    "La ejecución registra normas de gradiente no finitas.",
    "Repetir una ejecución controlada y revisar los valores numéricos y su registro para identificar el origen de la anomalía.",
  ],
  [
    "La ejecución falla con CUDA out of memory a los pocos pasos usando LoRA con el modelo de 1,5B.",
    "entrenamiento",
    "La ejecución con LoRA sobre el modelo de 1,5B se detiene por falta de memoria de GPU.",
    "Reducir el batch o la longitud máxima, o probar QLoRA, y comparar la estimación de VRAM antes de reintentar.",
  ],
  [
    "La pérdida de entrenamiento baja casi a cero, pero la de evaluación empieza a subir.",
    "entrenamiento",
    "La pérdida de evaluación aumenta mientras la de entrenamiento disminuye.",
    "Revisar la cantidad de pasos y comparar respuestas sobre ejemplos reservados antes de elegir el adaptador.",
  ],
  [
    "La descarga del modelo base se cortó al 60 % y la ejecución quedó en error.",
    "entrenamiento",
    "La descarga del modelo base quedó incompleta y la ejecución terminó con error.",
    "Comprobar la conexión y el espacio en disco e iniciar una nueva ejecución con la misma revisión del modelo.",
  ],
  [
    "Cerré DashAI mientras entrenaba y ahora la ejecución aparece como interrumpida.",
    "entrenamiento",
    "La ejecución quedó interrumpida al cerrarse DashAI durante el entrenamiento.",
    "Iniciar una nueva ejecución desde la misma configuración; la ejecución interrumpida conserva su historial.",
  ],
  [
    "El entrenamiento lleva veinte minutos en la fase de carga del modelo.",
    "entrenamiento",
    "La ejecución permanece mucho tiempo en la fase de carga del modelo.",
    "Revisar el registro de la ejecución y el uso de memoria para saber si la carga avanza o está detenida.",
  ],
  [
    "La pérdida aparece como NaN desde el paso 30 y la ejecución se detuvo.",
    "entrenamiento",
    "La ejecución se detuvo por una pérdida no finita desde el paso 30.",
    "Reducir la tasa de aprendizaje y repetir una ejecución controlada revisando los valores registrados.",
  ],
  [
    "No me deja elegir QLoRA para SmolLM2, solo aparece LoRA.",
    "entrenamiento",
    "QLoRA no está disponible para el checkpoint SmolLM2 seleccionado.",
    "Usar LoRA con ese checkpoint o elegir un modelo base que admita QLoRA.",
  ],
  [
    "Mi ejecución se queda en cola y nunca empieza.",
    "entrenamiento",
    "La ejecución permanece en cola sin comenzar.",
    "Comprobar en la cola de trabajos si otra ejecución o proceso está usando la GPU.",
  ],
  [
    "Con 120 pasos la ejecución tarda mucho más de lo que esperaba en mi GTX 1080.",
    "entrenamiento",
    "La ejecución de 120 pasos tarda más de lo esperado en la GTX 1080.",
    "Revisar el tiempo por paso en el registro y considerar menos pasos o una longitud máxima menor para la prueba.",
  ],
  [
    "Quiero reanudar un entrenamiento que cancelé, pero solo veo la opción de nueva ejecución.",
    "entrenamiento",
    "La ejecución cancelada no puede reanudarse.",
    "Crear una nueva ejecución desde la configuración fijada de la ejecución cancelada.",
  ],
  [
    "La tasa de aprendizaje que escribí (0.5) aparece marcada como inválida.",
    "entrenamiento",
    "La tasa de aprendizaje indicada está fuera del rango permitido.",
    "Ingresar un valor entre 1e-6 y 1e-2, por ejemplo 2e-4, y revisar el resumen antes de iniciar.",
  ],
  [
    "El modelo Llama 3.2 aparece con un candado y no puedo iniciar la ejecución.",
    "entrenamiento",
    "El checkpoint Llama 3.2 requiere una credencial que no está configurada.",
    "Configurar la credencial de Hugging Face en Credenciales y volver a intentar la ejecución.",
  ],
  [
    "Tengo tres ejecuciones terminadas y no sé cuál tiene mejor pérdida de evaluación.",
    "entrenamiento",
    "Se necesita comparar la pérdida de evaluación entre varias ejecuciones.",
    "Revisar la tabla del historial de ejecuciones y comparar además respuestas sobre ejemplos reservados.",
  ],
  [
    "La VRAM máxima registrada en la última ejecución fue casi 8 GB y temo que la próxima falle.",
    "entrenamiento",
    "La ejecución usó casi toda la VRAM disponible.",
    "Reducir el batch o la longitud máxima en la próxima ejecución y comparar la estimación con el pico registrado.",
  ],
  [
    "La barra de progreso se quedó en la fase de guardado y no aparece el adaptador.",
    "entrenamiento",
    "La ejecución no completa la fase de guardado del adaptador.",
    "Revisar el registro de la fase de guardado y verificar el espacio disponible en disco antes de reintentar.",
  ],
  // ---- inferencia ----
  [
    "Cuando abro el chat con mi modelo adaptado, DashAI indica que falta el archivo del adaptador.",
    "inferencia",
    "El adaptador seleccionado no está disponible para el chat.",
    "Comprobar la ubicación de los artefactos de esa ejecución y restaurar el adaptador correcto o seleccionar otro disponible.",
  ],
  [
    "El chat con el adaptador responde en inglés aunque le escribo en español.",
    "inferencia",
    "El modelo adaptado responde en inglés a mensajes en español.",
    "Revisar si los ejemplos de entrenamiento están en español y comparar con el modelo base usando las mismas instrucciones.",
  ],
  [
    "Al generar con el adaptador aparece un aviso de que la GPU está ocupada.",
    "inferencia",
    "La generación con el adaptador se rechaza porque la GPU está ocupada.",
    "Esperar a que termine el entrenamiento en curso o cancelarlo antes de volver a generar.",
  ],
  [
    "Las respuestas del modelo adaptado se cortan a la mitad.",
    "inferencia",
    "Las respuestas del modelo adaptado quedan truncadas.",
    "Aumentar el máximo de tokens nuevos en los parámetros de generación y repetir la consulta.",
  ],
  [
    "No aparece mi adaptador en el selector de modelos del chat.",
    "inferencia",
    "El adaptador no aparece entre los modelos disponibles del chat.",
    "Verificar en la lista de adaptadores que la ejecución terminó y que su disponibilidad es Disponible.",
  ],
  [
    "Cambié de adaptador mientras se generaba una respuesta y no sé con cuál se respondió.",
    "inferencia",
    "No queda claro qué adaptador generó una respuesta después de cambiar de modelo.",
    "Revisar el modelo y los parámetros registrados junto a cada respuesta del chat.",
  ],
  [
    "El modelo base no está descargado y el chat con mi adaptador no funciona.",
    "inferencia",
    "El chat con el adaptador falla porque el modelo base no está disponible.",
    "Descargar la revisión exacta del modelo base asociado al adaptador antes de abrir el chat.",
  ],
  [
    "Con temperatura 1.8 el adaptador devuelve fichas con campos inventados.",
    "inferencia",
    "Con temperatura alta el adaptador genera fichas con campos no definidos.",
    "Reducir la temperatura y comparar el formato de salida con los casos reservados.",
  ],
  [
    "La comparación con el modelo base tarda mucho en generar las doce respuestas.",
    "inferencia",
    "La comparación entre base y adaptado demora en generar los doce casos.",
    "Esperar a que terminen las generaciones pendientes y revisar la latencia media registrada.",
  ],
  [
    "El adaptador devuelve JSON, pero a veces falta el campo siguiente_paso.",
    "inferencia",
    "Algunas respuestas del adaptador omiten el campo siguiente_paso.",
    "Registrar los casos afectados en la comparación y revisar si los ejemplos de entrenamiento incluyen siempre ese campo.",
  ],
  [
    "Borré la carpeta de modelos para liberar espacio y ahora el adaptador figura como ausente.",
    "inferencia",
    "El adaptador figura como ausente tras borrar archivos locales.",
    "Restaurar los archivos del adaptador en su ubicación o entrenar una nueva ejecución con la misma configuración.",
  ],
  [
    "El chat se queda generando y nunca muestra la respuesta.",
    "inferencia",
    "La generación del chat no termina de mostrar una respuesta.",
    "Revisar la cola de trabajos y el estado del modelo seleccionado antes de reenviar el mensaje.",
  ],
  [
    "Quiero usar mi adaptador con un modelo base distinto al que usé para entrenarlo.",
    "inferencia",
    "Se intenta usar el adaptador con un modelo base diferente al de su entrenamiento.",
    "Usar el adaptador solo con su checkpoint y revisión de origen, indicados en la procedencia.",
  ],
  [
    "La respuesta del modelo adaptado repite la misma frase varias veces.",
    "inferencia",
    "El modelo adaptado genera respuestas con repeticiones.",
    "Ajustar top_p y temperatura y comparar el comportamiento con el modelo base en los mismos casos.",
  ],
  [
    "El adaptador aparece como inválido después de copiar los archivos desde otro computador.",
    "inferencia",
    "El adaptador copiado figura como inválido.",
    "Verificar que los archivos coincidan con el manifiesto registrado o volver a copiar el adaptador completo.",
  ],
  [
    "Al abrir un chat antiguo, las respuestas muestran un modelo que ya eliminé.",
    "inferencia",
    "Un chat antiguo hace referencia a un adaptador eliminado.",
    "Seleccionar otro modelo disponible para los mensajes nuevos; las respuestas anteriores conservan su registro.",
  ],
];

// Interleave categories so the first preview rows show all three.
function interleave(items) {
  const byCat = FICHA_CATEGORIES.map((c) => items.filter((it) => it[1] === c));
  const out = [];
  const max = Math.max(...byCat.map((l) => l.length));
  for (let i = 0; i < max; i += 1) {
    byCat.forEach((l) => {
      if (l[i]) out.push(l[i]);
    });
  }
  return out;
}

const FICHAS_ROWS = interleave(FICHAS).map(
  ([input, categoria, resumen, siguiente]) => ({
    instruction: FICHA_INSTRUCTION,
    input,
    output: fichaJson(categoria, resumen, siguiente),
  }),
);

const QA_PAIRS = [
  [
    "¿Cómo subo un dataset a DashAI?",
    "En el módulo Datos, usa «Nuevo dataset», elige el archivo (CSV, JSON o Excel) y revisa la vista previa antes de confirmar la importación.",
  ],
  [
    "¿Qué formatos de archivo acepta DashAI para datasets?",
    "Acepta archivos CSV, JSON y Excel; para ajuste fino conviene que cada fila tenga una instrucción y su respuesta en columnas separadas.",
  ],
  [
    "¿Qué es una sesión de fine-tuning?",
    "Es un borrador editable con el modelo base, los datos y los parámetros; cada ejecución fija una copia de esa configuración.",
  ],
  [
    "¿Qué diferencia hay entre LoRA y QLoRA?",
    "Ambos entrenan un adaptador pequeño; QLoRA carga el modelo base cuantizado en 4 bits y necesita menos memoria de GPU.",
  ],
  [
    "¿Por qué no puedo usar QLoRA con algunos modelos?",
    "QLoRA solo se ofrece en checkpoints donde fue validado; si no aparece, DashAI explica la causa y propone LoRA sin cambiarlo automáticamente.",
  ],
  [
    "¿Qué es la huella de datos?",
    "Es un identificador calculado sobre la copia normalizada de los datos; permite saber si el dataset cambió entre ejecuciones.",
  ],
  [
    "¿Puedo cambiar la configuración de una ejecución que ya empezó?",
    "No; la configuración de una ejecución queda fijada. Para probar otros valores, edita el borrador y crea una nueva ejecución.",
  ],
  [
    "¿Qué significa que una ejecución esté en cola?",
    "Que fue aceptada pero espera a que la GPU quede libre; DashAI entrena una ejecución a la vez.",
  ],
  [
    "¿Cómo cancelo una ejecución?",
    "Desde el detalle de la ejecución o desde la cola de trabajos; la ejecución queda como cancelada y conserva su historial.",
  ],
  [
    "¿Qué pasa si cierro DashAI durante un entrenamiento?",
    "La ejecución queda marcada como interrumpida; puedes crear una nueva ejecución con la misma configuración.",
  ],
  [
    "¿Dónde veo la pérdida de entrenamiento?",
    "En la pestaña de la ejecución actual, junto al progreso, aparece el gráfico de pérdida de entrenamiento y de evaluación.",
  ],
  [
    "¿Una pérdida baja garantiza un buen modelo?",
    "No; la pérdida es una medida de diagnóstico. Hay que comparar respuestas sobre ejemplos reservados.",
  ],
  [
    "¿Qué es un adaptador?",
    "Es el resultado del entrenamiento LoRA: un conjunto pequeño de pesos que se aplica sobre su modelo base exacto.",
  ],
  [
    "¿Puedo usar un adaptador con otro modelo base?",
    "No; un adaptador depende del checkpoint y la revisión con que fue entrenado.",
  ],
  [
    "¿Cómo pruebo mi adaptador?",
    "Abre el chat con adaptadores, elige el adaptador disponible y envía un mensaje; cada respuesta registra el modelo y los parámetros usados.",
  ],
  [
    "¿Qué hago si el adaptador aparece como ausente?",
    "Revisa que sus archivos sigan en la carpeta de modelos o entrena una nueva ejecución; el chat no usa el modelo base en su lugar.",
  ],
  [
    "¿Qué es el batch efectivo?",
    "Es el batch por dispositivo multiplicado por la acumulación de gradientes, por ejemplo 2 × 4 = 8.",
  ],
  [
    "¿Qué longitud máxima debo usar?",
    "Una que cubra tus ejemplos completos; si es muy corta, la truncación puede eliminar la respuesta supervisada.",
  ],
  [
    "¿Qué tasa de aprendizaje recomienda DashAI?",
    "Para LoRA y QLoRA un valor habitual es 2e-4; valores muy altos pueden producir pérdidas no finitas.",
  ],
  [
    "¿Para qué sirve la semilla?",
    "Hace reproducibles la partición de datos y la inicialización del entrenamiento.",
  ],
  [
    "¿Por qué DashAI pide confirmar el formato del dataset?",
    "Porque la detección automática es solo una sugerencia; confirmarla evita entrenar con columnas mal asignadas.",
  ],
  [
    "¿Qué partes del ejemplo aportan a la pérdida?",
    "Solo las respuestas del asistente; la instrucción y el contexto se muestran como «sin pérdida».",
  ],
  [
    "¿Cuánta memoria de GPU necesito?",
    "Depende del modelo, el método, el batch y la longitud; DashAI muestra una estimación orientativa antes de iniciar.",
  ],
  [
    "¿Necesito internet para entrenar?",
    "Solo si el modelo base no está descargado; una vez descargada la revisión exacta, el entrenamiento es local.",
  ],
  [
    "¿Qué es la revisión exacta de un modelo?",
    "Es el identificador del commit del checkpoint; fijarla asegura que la ejecución pueda reproducirse.",
  ],
  [
    "¿Cómo comparo el modelo base con el adaptado?",
    "Usa la comparación con modelo base: genera respuestas para los mismos casos reservados con los mismos parámetros.",
  ],
  [
    "¿Qué es la revisión ciega en la comparación?",
    "Oculta qué respuesta corresponde al base o al adaptado y mezcla su orden para puntuar sin sesgo.",
  ],
  [
    "¿Dónde configuro la credencial de Hugging Face?",
    "En Credenciales, desde la barra superior; algunos modelos, como Llama 3.2, la requieren para descargarse.",
  ],
  [
    "¿Puedo borrar una ejecución?",
    "Sí, si no está activa; al borrarla también se elimina su adaptador.",
  ],
  [
    "¿Qué significa el aviso de norma de gradiente NaN?",
    "Que se registraron valores no finitos en algunos pasos; conviene revisar la ejecución antes de confiar en el adaptador.",
  ],
];

const QA_ROWS = QA_PAIRS.map(([pregunta, respuesta]) => ({
  pregunta,
  respuesta,
}));

const SYSTEM_SOPORTE =
  "Eres el asistente de soporte de DashAI. Responde en español, de forma breve y concreta.";

const CONVERSATIONS = [
  [
    ["user", "Hola, no encuentro dónde se suben los datasets."],
    [
      "assistant",
      "Hola. Entra al módulo Datos y usa «Nuevo dataset»; ahí eliges el archivo y revisas la vista previa antes de importarlo.",
    ],
  ],
  [
    ["user", "Mi ejecución está en cola hace rato, ¿es normal?"],
    [
      "assistant",
      "Puede serlo si otra ejecución usa la GPU. Revisa la cola de trabajos: DashAI entrena una ejecución a la vez.",
    ],
    ["user", "Sí, hay otra entrenando. ¿La mía empezará sola?"],
    [
      "assistant",
      "Sí. Cuando termine la ejecución activa, la tuya pasará automáticamente a preparación.",
    ],
  ],
  [
    ["user", "¿Qué método me conviene si tengo una GPU de 8 GB?"],
    [
      "assistant",
      "Para modelos de más de 1B parámetros, QLoRA suele ser la opción más segura en 8 GB. Revisa la estimación de VRAM en el resumen antes de iniciar.",
    ],
  ],
  [
    ["user", "Me salió CUDA out of memory."],
    [
      "assistant",
      "La ejecución se detuvo por falta de memoria de GPU. Prueba reducir el batch o la longitud máxima, o cambia a QLoRA, y vuelve a iniciar una nueva ejecución.",
    ],
    ["user", "¿Pierdo la ejecución fallida?"],
    [
      "assistant",
      "No. La ejecución fallida conserva su configuración, su registro y la fase en que falló.",
    ],
  ],
  [
    ["user", "¿Cómo sé qué columnas usa el entrenamiento?"],
    [
      "assistant",
      "En el paso Datos verás el formato detectado y el mapeo de columnas. Confírmalo y revisa la pestaña «Ejemplos SFT».",
    ],
  ],
  [
    ["user", "El chat con mi adaptador dice que falta el archivo."],
    [
      "assistant",
      "Ese adaptador figura como ausente, por eso el chat no genera con él. Restaura sus archivos o elige otro adaptador disponible; DashAI no usa el modelo base en su lugar.",
    ],
  ],
  [
    ["user", "¿Qué significa «Sin pérdida (contexto)» en la vista previa?"],
    [
      "assistant",
      "Indica las partes del ejemplo que el modelo lee pero no aprende a generar, como la instrucción. Solo la respuesta del asistente aporta a la pérdida.",
    ],
  ],
  [
    ["user", "Quiero entrenar con Llama 3.2 pero tiene un candado."],
    [
      "assistant",
      "Ese modelo requiere una credencial de Hugging Face. Configúrala en Credenciales y vuelve al paso Modelo.",
    ],
    ["user", "Listo, ya la configuré."],
    [
      "assistant",
      "Perfecto. Ahora el modelo aparecerá disponible para descargarse al iniciar la ejecución.",
    ],
  ],
  [
    ["user", "¿Cuántos pasos debería usar para una prueba?"],
    [
      "assistant",
      "Para comprobar que todo funciona, el preset «Prueba rápida» usa 10 pasos. Para un primer adaptador útil, prueba «Equilibrado» con 60 pasos.",
    ],
  ],
  [
    ["user", "La pérdida de evaluación sube al final del entrenamiento."],
    [
      "assistant",
      "Puede indicar sobreajuste. Compara las respuestas del adaptador en ejemplos reservados y considera menos pasos en la próxima ejecución.",
    ],
  ],
  [
    ["user", "¿Puedo seguir usando el chat mientras entreno?"],
    [
      "assistant",
      "Con una sola GPU no se garantiza entrenar y generar a la vez. Si la GPU está ocupada, el chat te lo indicará; espera a que termine la ejecución.",
    ],
  ],
  [
    ["user", "¿Dónde veo con qué datos se entrenó un adaptador?"],
    [
      "assistant",
      "En la procedencia del adaptador: dataset, huella de datos, particiones, modelo base con su revisión exacta y la configuración fijada.",
    ],
  ],
  [
    ["user", "Me aparece JSON inválido en la columna messages."],
    [
      "assistant",
      "Alguna fila no tiene una lista JSON válida de mensajes. Revisa las filas indicadas en el reporte de validación y corrígelas antes de entrenar.",
    ],
  ],
  [
    ["user", "¿Qué es el batch efectivo?"],
    [
      "assistant",
      "Es el batch por dispositivo multiplicado por la acumulación de gradientes. Por ejemplo, 2 × 4 = 8 ejemplos por actualización.",
    ],
  ],
  [
    ["user", "Cancelé una ejecución por error."],
    [
      "assistant",
      "Una ejecución cancelada no se reanuda, pero puedes crear una nueva desde su misma configuración con «Nueva ejecución desde esta configuración».",
    ],
    ["user", "¿Y se descarga otra vez el modelo?"],
    [
      "assistant",
      "No, si el modelo base ya quedó descargado y verificado, la nueva ejecución lo usa directamente.",
    ],
  ],
  [
    ["user", "¿Qué hace la revisión ciega?"],
    [
      "assistant",
      "Oculta qué respuesta viene del modelo base y cuál del adaptado, y mezcla su orden, para que puntúes el contenido sin sesgo.",
    ],
  ],
  [
    ["user", "Mi dataset tiene una sola columna de texto."],
    [
      "assistant",
      "Ese formato no permite separar instrucción y respuesta, así que no se puede limitar la pérdida a las respuestas. Conviértelo a pares instrucción-respuesta.",
    ],
  ],
  [
    ["user", "¿Por qué la vista previa solo muestra 10 filas?"],
    [
      "assistant",
      "Es una muestra para revisar el formato. La validación completa de todas las filas ocurre al iniciar la ejecución.",
    ],
  ],
  [
    ["user", "Terminó el entrenamiento, ¿cómo lo pruebo?"],
    [
      "assistant",
      "En el resultado de la ejecución usa «Probar en chat». También puedes comparar con el modelo base en los casos reservados.",
    ],
  ],
  [
    ["user", "¿Se guarda mi token de Hugging Face en la ejecución?"],
    [
      "assistant",
      "No. Las credenciales se gestionan en DashAI y nunca se copian a la configuración, los registros ni el manifiesto del adaptador.",
    ],
  ],
];

const CONVERSATION_ROWS = CONVERSATIONS.map((turns) => ({
  messages: JSON.stringify([
    { role: "system", content: SYSTEM_SOPORTE },
    ...turns.map(([role, content]) => ({ role, content })),
  ]),
}));

const LONG_OUTPUT = [
  "Informe detallado del incidente de importación.",
  "Durante la importación del archivo de ventas trimestrales se detectaron múltiples inconsistencias que afectan la calidad del dataset.",
  "En primer lugar, la columna de fechas mezcla los formatos día-mes-año y año-mes-día, lo que impide ordenar los registros de manera confiable.",
  "En segundo lugar, la columna de montos contiene separadores de miles con punto en algunas filas y con coma en otras, por lo que ciertos valores se interpretan como decimales.",
  "En tercer lugar, existen 214 filas duplicadas que provienen de una exportación repetida del sistema de origen.",
  "Además, la columna de región incluye variantes ortográficas de una misma zona, como «Valparaíso», «Valparaiso» y «V Región», que deberían normalizarse.",
  "También se observaron celdas con espacios en blanco al final del texto, lo que genera categorías aparentemente distintas.",
  "Se recomienda definir un formato de fecha único, normalizar los separadores numéricos, eliminar explícitamente los duplicados después de revisarlos y crear una tabla de equivalencias para las regiones.",
  "Antes de volver a importar el archivo, conviene validar una muestra de cien filas y registrar cada transformación aplicada para mantener la trazabilidad del proceso.",
  "Finalmente, se sugiere documentar el origen de cada columna, el responsable de la exportación y la fecha de corte, de modo que futuras importaciones puedan compararse con esta versión.",
]
  .join(" ")
  .repeat(3);

const ERROR_ROWS_DEF = [
  [
    "Resume el siguiente texto en una oración.",
    "DashAI permite entrenar modelos de aprendizaje automático sin escribir código, desde la carga de datos hasta la evaluación de resultados.",
    "DashAI permite entrenar y evaluar modelos sin programar.",
  ],
  [
    "Clasifica el sentimiento del comentario como positivo, negativo o neutro.",
    "La interfaz es clara, pero la importación tardó demasiado.",
    "neutro",
  ],
  [
    "Traduce al inglés.",
    "El entrenamiento terminó correctamente.",
    "The training finished successfully.",
  ],
  [
    "Extrae la fecha mencionada en el texto.",
    "La reunión de revisión quedó fijada para el 14 de octubre de 2026.",
    "14 de octubre de 2026",
  ],
  [
    "Indica qué módulo de DashAI corresponde a la tarea.",
    "Quiero comparar dos modelos de clasificación entrenados con el mismo dataset.",
    "",
  ],
  [
    "Corrige la ortografía de la frase.",
    "La ejecucion termino con exito despues de 60 pasos.",
    "La ejecución terminó con éxito después de 60 pasos.",
  ],
  ["Responde con sí o no: ¿QLoRA reduce el uso de memoria de GPU?", "", "Sí."],
  ["Convierte la cantidad a gigabytes.", "8192 megabytes", "8 GB"],
  [
    "Resume el siguiente texto en una oración.",
    "La ejecución se detuvo en la fase de validación porque varias filas tenían la respuesta vacía.",
    "La ejecución falló en validación por filas con respuestas vacías.",
  ],
  [
    "Clasifica el sentimiento del comentario como positivo, negativo o neutro.",
    "Excelente herramienta, el chat con el adaptador funcionó a la primera.",
    "positivo",
  ],
  [
    "Traduce al inglés.",
    "La descarga del modelo base está pendiente.",
    "The base model download is pending.",
  ],
  [
    "Escribe un título breve para el informe.",
    "Comparación entre el modelo base y el modelo adaptado en doce casos reservados.",
    "",
  ],
  [
    "Extrae la cantidad de pasos configurada.",
    "La ejecución usa 120 pasos, batch 1 y acumulación 8.",
    "120",
  ],
  [
    "Clasifica el sentimiento del comentario como positivo, negativo o neutro.",
    "El entrenamiento falló dos veces por falta de memoria.",
    "negativo",
  ],
  [
    "Resume el siguiente texto en una oración.",
    "El adaptador quedó publicado con un tamaño de 35 MB y puede usarse desde el chat de Generative.",
    "El adaptador de 35 MB ya está disponible en el chat.",
  ],
  [
    "Corrige la ortografía de la frase.",
    "El dataset tiene tres colunnas y cuarenta filas.",
    "El dataset tiene tres columnas y cuarenta filas.",
  ],
  [
    "Traduce al inglés.",
    "La pérdida de evaluación aumentó al final.",
    "The evaluation loss increased at the end.",
  ],
  [
    "Responde con sí o no: ¿el adaptador incluye una copia completa del modelo base?",
    "",
    "No.",
  ],
  [
    "Indica qué módulo de DashAI corresponde a la tarea.",
    "Necesito subir un archivo CSV con mis datos de clientes.",
    "   ",
  ],
  [
    "Extrae la fecha mencionada en el texto.",
    "El adaptador se entrenó el 9 de octubre de 2026 a las 18:40.",
    "9 de octubre de 2026",
  ],
  [
    "Clasifica el sentimiento del comentario como positivo, negativo o neutro.",
    "La vista previa de ejemplos SFT ayuda bastante.",
    "positivo",
  ],
  [
    "Redacta un informe completo del incidente descrito.",
    "Importación de ventas trimestrales con fechas, montos y regiones inconsistentes.",
    LONG_OUTPUT,
  ],
  ["Convierte la cantidad a gigabytes.", "16384 megabytes", "16 GB"],
  [
    "Escribe un título breve para el informe.",
    "Resultados del primer piloto de fine-tuning con fichas de soporte.",
    "Primer piloto de fichas de soporte",
  ],
];

const ERROR_ROWS = ERROR_ROWS_DEF.map(([instruction, input, output]) => ({
  instruction,
  input,
  output,
}));

const PLAIN_TEXT_ROWS = [
  "DashAI es una plataforma para entrenar, evaluar y comparar modelos de aprendizaje automático mediante una interfaz gráfica.",
  "El módulo de datos permite importar archivos CSV, JSON y Excel, revisar sus columnas y preparar conjuntos para distintas tareas.",
  "Los modelos de lenguaje pequeños pueden adaptarse a una tarea concreta mediante ajuste supervisado con adaptadores LoRA.",
  "Un adaptador LoRA agrega matrices de bajo rango a ciertas capas del modelo y solo esas matrices se entrenan.",
  "QLoRA carga el modelo base cuantizado en cuatro bits para reducir el uso de memoria durante el entrenamiento.",
  "La pérdida de entrenamiento mide el error sobre los ejemplos usados para ajustar el modelo; no sustituye una evaluación sobre ejemplos reservados.",
  "Una ejecución reproducible registra el modelo base con su revisión exacta, la huella de los datos y la configuración utilizada.",
  "Las respuestas del modelo adaptado deben compararse con las del modelo base usando las mismas instrucciones y parámetros.",
  "El monitor de hardware de DashAI muestra el uso de CPU, memoria RAM, GPU y memoria de video.",
  "La cola de trabajos concentra las tareas en segundo plano, como importaciones de datasets y entrenamientos.",
  "Un corpus de texto plano no indica qué parte es instrucción y qué parte es respuesta, por lo que no sirve para limitar la pérdida a las respuestas.",
  "Para convertir documentos en ejemplos supervisados se pueden redactar preguntas y respuestas revisadas a partir de cada sección.",
].map((text) => ({ text }));

function sampleDataset(id, i18nKey, name, description, columns, rows) {
  return Object.freeze({
    id,
    i18nKey,
    source: "sample",
    name,
    description,
    columns: Object.freeze([...columns]),
    rows: Object.freeze(rows.map((r) => Object.freeze(r))),
    totalRows: rows.length,
  });
}

export const SAMPLE_DATASETS = Object.freeze([
  sampleDataset(
    "fichas-soporte",
    "fichasSoporte",
    "Fichas de soporte DashAI",
    "Caso de referencia: solicitudes de soporte convertidas en fichas JSON (categoria, resumen, siguiente_paso).",
    ["instruction", "input", "output"],
    FICHAS_ROWS,
  ),
  sampleDataset(
    "qa-pares",
    "qaPares",
    "Preguntas frecuentes (pares)",
    "Pares pregunta/respuesta sobre el uso de DashAI; requiere confirmar el mapeo.",
    ["pregunta", "respuesta"],
    QA_ROWS,
  ),
  sampleDataset(
    "conversaciones-soporte",
    "conversacionesSoporte",
    "Conversaciones de soporte",
    "Conversaciones en formato messages con roles system, user y assistant; algunas de varios turnos.",
    ["messages"],
    CONVERSATION_ROWS,
  ),
  sampleDataset(
    "instrucciones-con-errores",
    "instruccionesConErrores",
    "Instrucciones con errores",
    "Formato Alpaca con respuestas vacías y una respuesta demasiado larga para mostrar el diagnóstico.",
    ["instruction", "input", "output"],
    ERROR_ROWS,
  ),
  sampleDataset(
    "solo-texto",
    "soloTexto",
    "Corpus de texto plano",
    "Una sola columna de texto: fuera del alcance del ajuste supervisado sobre respuestas.",
    ["text"],
    PLAIN_TEXT_ROWS,
  ),
]);

export function getSampleDataset(id) {
  return SAMPLE_DATASETS.find((d) => d.id === id) || null;
}

/** DatasetRef for a sample dataset (SPEC §3.1). */
export function sampleDatasetRef(datasetOrId) {
  const ds =
    typeof datasetOrId === "string"
      ? getSampleDataset(datasetOrId)
      : datasetOrId;
  if (!ds) return null;
  return {
    source: "sample",
    id: ds.id,
    name: ds.name,
    totalRows: ds.rows.length,
    columns: [...ds.columns],
    i18nKey: ds.i18nKey,
  };
}

// Reserved evaluation cases (never in fichas-soporte). `reference` is the
// reviewed target ficha.
export const HELD_OUT_CASES = Object.freeze(
  [
    {
      id: "ho-01",
      input:
        "Al previsualizar el dataset veo que la columna instruction está vacía en varias filas.",
      reference: {
        categoria: "datos",
        resumen:
          "Varias filas del dataset tienen la columna instruction vacía.",
        siguiente_paso:
          "Identificar esas filas y completarlas o retirarlas explícitamente antes de entrenar.",
      },
    },
    {
      id: "ho-02",
      input:
        "Importé un JSONL y cada línea aparece como una sola columna de texto.",
      reference: {
        categoria: "datos",
        resumen: "El JSONL se importó como una única columna de texto.",
        siguiente_paso:
          "Revisar la estructura del archivo y volver a importarlo para que cada campo quede en su propia columna.",
      },
    },
    {
      id: "ho-03",
      input:
        "DashAI no reconoce mis columnas 'consulta' y 'solucion' como un formato válido.",
      reference: {
        categoria: "datos",
        resumen:
          "Las columnas consulta y solucion no se reconocen como un formato conocido.",
        siguiente_paso:
          "Mapear manualmente consulta como entrada y solucion como respuesta y confirmar el formato.",
      },
    },
    {
      id: "ho-04",
      input:
        "Algunas conversaciones del dataset tienen el rol 'bot' en vez de 'assistant'.",
      reference: {
        categoria: "datos",
        resumen: "Algunas conversaciones usan el rol no admitido 'bot'.",
        siguiente_paso:
          "Normalizar el rol 'bot' a 'assistant' en el dataset y volver a validarlo.",
      },
    },
    {
      id: "ho-05",
      input:
        "La ejecución se detiene en el paso 12 con un error de memoria de la GPU.",
      reference: {
        categoria: "entrenamiento",
        resumen:
          "La ejecución se detiene en el paso 12 por falta de memoria de GPU.",
        siguiente_paso:
          "Reducir el batch o la longitud máxima, o usar QLoRA, y revisar la estimación de VRAM antes de reintentar.",
      },
    },
    {
      id: "ho-06",
      input:
        "La pérdida de evaluación no aparece en el gráfico de mi ejecución.",
      reference: {
        categoria: "entrenamiento",
        resumen: "La ejecución no muestra pérdida de evaluación.",
        siguiente_paso:
          "Verificar si la evaluación estaba desactivada en las particiones y habilitarla en una nueva ejecución.",
      },
    },
    {
      id: "ho-07",
      input:
        "Después de cancelar la ejecución, la GPU sigue mostrando memoria ocupada.",
      reference: {
        categoria: "entrenamiento",
        resumen:
          "La memoria de GPU parece seguir ocupada después de cancelar la ejecución.",
        siguiente_paso:
          "Revisar el monitor de hardware y la cola de trabajos para confirmar si quedó algún proceso activo.",
      },
    },
    {
      id: "ho-08",
      input: "El entrenamiento terminó en 3 pasos aunque configuré 2 épocas.",
      reference: {
        categoria: "entrenamiento",
        resumen:
          "La ejecución terminó con menos pasos de los esperados para 2 épocas.",
        siguiente_paso:
          "Revisar el modo de duración y el máximo de pasos en la configuración fijada de la ejecución.",
      },
    },
    {
      id: "ho-09",
      input:
        "Al enviar un mensaje con el adaptador, el chat indica que el modelo base no está descargado.",
      reference: {
        categoria: "inferencia",
        resumen:
          "El chat no puede generar porque el modelo base del adaptador no está descargado.",
        siguiente_paso:
          "Descargar la revisión exacta del modelo base indicada en la procedencia del adaptador.",
      },
    },
    {
      id: "ho-10",
      input:
        "Las respuestas del adaptador salen como una lista y no como ficha JSON.",
      reference: {
        categoria: "inferencia",
        resumen:
          "El adaptador responde con una lista en vez de una ficha JSON.",
        siguiente_paso:
          "Comparar con los casos reservados y revisar las instrucciones y parámetros de generación usados.",
      },
    },
    {
      id: "ho-11",
      input:
        "El chat parece responder con el modelo base aunque seleccioné mi adaptador.",
      reference: {
        categoria: "inferencia",
        resumen:
          "El chat parece responder con el modelo base pese a tener un adaptador seleccionado.",
        siguiente_paso:
          "Revisar el modelo registrado en cada respuesta y confirmar que el adaptador seleccionado está disponible.",
      },
    },
    {
      id: "ho-12",
      input: "Generar una respuesta con el adaptador tarda más de un minuto.",
      reference: {
        categoria: "inferencia",
        resumen: "La generación con el adaptador tarda más de un minuto.",
        siguiente_paso:
          "Revisar si la GPU está ocupada por otro proceso y medir la latencia con parámetros de generación fijos.",
      },
    },
  ].map((c) => Object.freeze({ ...c, reference: Object.freeze(c.reference) })),
);

// Three suggestion tickets for an empty chat (taken from the held-out set).
export const CHAT_SUGGESTIONS = Object.freeze([
  HELD_OUT_CASES[0].input,
  HELD_OUT_CASES[4].input,
  HELD_OUT_CASES[8].input,
]);
