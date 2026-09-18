# SuperEstela — Arquitectura, Ingeniería y Gobernanza

> El objetivo de este documento es que el jurado técnico concluya: **"esto no es un notebook, es un sistema que el club podría operar el lunes."**

---

## 1. Por qué este pilar importa

El reto se juzga en cuatro ejes de 25%. Tres son técnicos y uno es aplicabilidad real, evaluada en entrevista. Pero hay un factor transversal que ningún criterio nombra y todos los jurados aplican: **¿esto sobrevive fuera de la laptop de quien lo presentó?**

Casi todos los equipos entregarán un notebook y un Streamlit. Nosotros entregamos eso **más** el diseño del sistema que lo sostiene, con una franja delgada efectivamente implementada.

---

## 2. Arquitectura de referencia

```
                    ┌─────────────────────────────────────────┐
  TrackMan feed ───▶│  Ingestion  (batch + incremental)        │
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Raw zone                               │
                    │  Parquet / Iceberg · immutable          │
                    │  partitioned by season / game           │
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Schema & data contracts                │
                    │  Pandera · fails loud, blocks promotion │◀── 8 defectos reales
                    └───────────────────┬─────────────────────┘    ya detectados
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Curated zone + Feature Store           │
                    │  POINT-IN-TIME CORRECT · as-of joins    │◀── anti-leakage
                    │  physics layer: density index           │
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Training pipeline                      │
                    │  MLflow tracking · model registry       │
                    │  pinned seeds + lockfile · GroupKFold   │
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  Scoring                                │
                    │  nightly batch (liga completa)          │
                    │  FastAPI on-demand (simulador/traductor)│
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  SuperEstela app                               │
                    └───────────────────┬─────────────────────┘
                                        ▼
        ┌───────────────────────────────┴───────────────────────────┐
        ▼                                                           ▼
┌───────────────────────────┐                     ┌────────────────────────────┐
│  Observability            │                     │  Decision Log              │
│  feature drift            │                     │  qué recomendó el modelo   │
│  calibration monitoring   │                     │  qué decidió el humano     │
│  prediction logging       │                     │  qué pasó después          │
└───────────────────────────┘                     └────────────────────────────┘
```

---

## 3. Data contracts — motivados por defectos reales

La capa de validación no es teórica. La auditoría encontró **8 defectos concretos** en el dataset entregado (detalle en `01-EVIDENCIA.md` §10). Tres son severos:

- `is_hit_by_pitch` en cero en las 635,002 filas, pese a 2,280 HBP registrados en `PitchCall`
- `altitude_category` nula en 3,020 filas
- Ninguna identidad de estadio; solo un bucket de 3 niveles

**Un modelo entrenado sin detectar el primero simplemente no aprende el hit-by-pitch.** Por eso los contratos se ejecutan antes de promover datos, fallan ruidosamente y ponen en cuarentena las filas ofensoras en lugar de dejarlas pasar en silencio.

```python
# schemas/pitch.py  (Pandera)
class PitchSchema(pa.DataFrameModel):
    PitchUID: Series[str] = pa.Field(unique=True)
    RelSpeed: Series[float] = pa.Field(in_range={"min_value": 50, "max_value": 110})
    SpinRate: Series[float] = pa.Field(in_range={"min_value": 0, "max_value": 4000})
    Outs: Series[int] = pa.Field(isin=[0, 1, 2])  # catches Outs == 3
    altitude_category: Series[str] = pa.Field(nullable=False)  # catches 3,020 nulls
    AutoPitchType: Series[str] = pa.Field(isin=PITCH_TAXONOMY)

    @pa.dataframe_check
    def hbp_flag_matches_call(cls, df):
        """is_hit_by_pitch must agree with PitchCall - the defect we found."""
        return (df.is_hit_by_pitch == (df.PitchCall == "HitByPitch")).all()
```

---

## 4. Feature store con point-in-time correctness

**El riesgo técnico más grande del reto, y el que casi todos los equipos van a pasar por alto.**

Las features de arsenal que pide la convocatoria —`velo_diff_vs_fb`, `ivb_diff_vs_fb`, `tunnel_similarity`, `pitch_usage_pct`— se definen **contra la recta primaria del pitcher**. Si esa línea base se calcula sobre la temporada completa:

- cada pitch queda descrito con información de pitches **que aún no habían ocurrido**;
- las métricas fuera de muestra se inflan;
- y el sistema falla precisamente contra un pitcher nuevo — **que es el caso de uso de fichajes**.

La línea base debe calcularse con ventana expandible: solo pitches previos del mismo pitcher.

```python
# features/arsenal.py
def fastball_baseline(pitches: pd.DataFrame) -> pd.DataFrame:
    """Expanding, strictly-prior baseline. No pitch may see its own future."""
    fb = pitches[pitches.pitch_group == "fastball"].sort_values(["pitcher_id", "ts"])
    for col in ("RelSpeed", "InducedVertBreak", "HorzBreak"):
        fb[f"{col}_base"] = fb.groupby("pitcher_id")[col].transform(
            lambda s: s.shift(1).expanding(min_periods=20).mean()
        )
    return fb  # as-of joined back onto every pitch
```

Resolverlo explica por qué nuestras métricas fuera de muestra son honestas, y ataca directamente el 25% de "Robustez fuera de muestra".

---

## 5. Capa de física

El **Índice de Densidad** es la única feature ambiental del sistema que no depende de una etiqueta. Se deriva de la aceleración medida de cada pitch (detalle en `01-EVIDENCIA.md` §6) y cumple tres funciones distintas:

| Función | Uso |
|---|---|
| **Feature** | Covariable ambiental continua del modelo |
| **Traductor** | El factor Magnus que proyecta forma entre estadios |
| **Monitor de drift** | Señal de deriva ambiental en producción |

> La misma física que alimenta el modelo lo vigila. Si el Índice de Densidad de un juego se sale de su distribución histórica, el sistema lo señala antes de que las predicciones se degraden.

---

## 6. Validación

| Eje | Diseño | Qué prueba |
|---|---|---|
| **Pitcher holdout** | `GroupKFold` por `pitcher_anon_id` | Generaliza a brazos nunca vistos — el caso de fichajes |
| **Season holdout** | Train 2024–25 / test 2026 | Estabilidad temporal |
| **Park holdout** | Calibración separada por entorno | Aísla el efecto altitud del efecto pitcher |

Ningún identificador de jugador entra como feature. El diccionario de datos lo advierte explícitamente ("to prevent player memorization") y lo respetamos.

---

## 7. Gobernanza: el Decision Log

**El componente que ningún otro equipo va a presentar, y el argumento de *moat* del producto.**

Cada recomendación que el sistema emite se registra con:

```
decision_id · timestamp · model_version · module
inputs_hash · prediction · uncertainty_band
recommendation          ← qué dijo el modelo
human_decision          ← qué hizo el club
decided_by · rationale
realized_outcome        ← qué pasó después (se llena con el tiempo)
```

Tres consecuencias:

1. **Auditabilidad.** El club puede preguntar después *"¿el modelo realmente ayudó?"* y tener respuesta.
2. **Cierre de loop.** Comparamos outcome realizado vs predicho por cada fichaje y cada decisión de alineación. El sistema mejora con el uso.
3. **Responsabilidad.** Queda explícito que el modelo **recomienda** y el humano **decide**. Es la postura correcta para una herramienta que afecta la carrera de personas.

---

## 8. Observabilidad

| Señal | Qué vigila | Acción |
|---|---|---|
| Drift del Índice de Densidad | Cambio ambiental | Alerta de recalibración |
| Drift de features | Distribución de velocidad, movimiento, spin | Revisión de calibración de TrackMan |
| Calibración de predicciones | Predicho vs observado por bucket | Reentrenamiento |
| Cobertura de bandas | ¿El 95% cae dentro del 95%? | Recalibración de incertidumbre |
| Latencia y errores | Salud del servicio | Operación |

---

## 9. Cumplimiento y ética

El reglamento del reto impone condiciones explícitas. Se cumplen y se declaran visiblemente en el producto:

- **Sin datos personales.** El dataset es de rendimiento deportivo con IDs anonimizados. No hay PII, y el producto no la introduce.
- **LFPDPPP.** Si en despliegue real se incorporaran datos personales, aplican finalidades claras, minimización y aviso de privacidad.
- **Prohibición de apuestas.** La participación implica aceptar que el output no se usa para betting. Declarado en el producto, no escondido en un pie de página.
- **Confidencialidad.** Los datos son propiedad de ISAC y el patrocinador; se usan solo para la competencia. Se pueden presentar resultados, **no** los datos.
- **El humano decide.** El sistema recomienda; el Decision Log deja constancia de quién decidió.

---

## 10. Frontera de alcance — declarada al jurado

Los jueces respetan una frontera honesta mucho más que una demo que insinúa capacidades inexistentes. Esta tabla va en el deck.

| ✅ Construido y funcionando | 📐 Diseñado y documentado |
|---|---|
| Modelos Stuff+ / Location+ / Pitching+ | Ingesta incremental desde TrackMan |
| Índice de Densidad (capa de física) | Iceberg / zonas raw-curated a escala |
| Traductor de Altitud, validado en holdout | Orquestación y scheduling productivo |
| Pipeline de evidencia reproducible | Alta disponibilidad, SLAs |
| App prototipo | Autenticación y roles |
| Documento técnico, deck, ficha ejecutiva | |

### Franja delgada de plataforma — alto retorno, 2–3 días

Convierte "diagrama de arquitectura" en "esto corre":

1. **Validación de esquema en CI** — los contratos de Pandera corriendo en cada push.
2. **MLflow efectivamente usado** — experimentos versionados, no capturas de pantalla.
3. **Un endpoint FastAPI real** — el simulador consumiendo un servicio, no una función local.
4. **Decision Log al que la app escribe de verdad** — aunque sea SQLite.

Frente a un jurado técnico, la diferencia entre estas cuatro cosas implementadas y un diagrama bonito es enorme, y no cuesta construir una plataforma completa.

---

## 11. Convenciones

- **Código, esquemas, endpoints y nombres de variables: inglés.**
- **Narrativa de producto, deck y documento técnico: español**, con vocabulario sabermétrico en inglés.
- Reproducibilidad: seeds fijos, dependencias con lockfile, `analysis/evidence.py` regenera cada cifra publicada.
- Ningún número llega a un entregable sin una celda que lo genere.
