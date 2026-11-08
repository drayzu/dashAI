# Prototipos de fine-tuning (solo frontend, simulados)

Esta rama (`memoria/prototipos`) contiene los prototipos de interfaz para
fine-tuning de LLMs en DashAI. No hay backend de fine-tuning: el
entrenamiento, los adaptadores y las respuestas son simulados en el navegador.
Solo se usan APIs que ya existen en DashAI (datasets y hardware).

El código real se escribe en otra rama (`memoria/fine-tuning`). Cuando se
decida el diseño final, se borran los prototipos que no sirvan.

## Rutas

| Prototipo | Ruta |
|---|---|
| A: módulo propio en Generative | `/app/generative/fine-tuning` |
| B: dentro de Modelos | `/app/models/fine-tuning` |
| C: flujo lineal simple | `/app/generative/fine-tuning-simple` |
| D: solo entrenamiento | `/app/generative/fine-tuning-d` (sesiones: `/app/generative/sessions-d`) |
| E: módulo completo | `/app/generative/fine-tuning-e` (sesiones: `/app/generative/sessions-e`) |

`Ctrl+Shift+P` abre el selector para mostrar un solo prototipo a la vez.

## Ejecutar

Necesita el backend de DashAI corriendo en el puerto 8000.

```powershell
cd DashAI\front
corepack yarn start
```

## Historia

La versión anterior, construida sobre una base antigua de DashAI y mezclada
con un backend exploratorio, quedó en la etiqueta `prototipo-final`.
