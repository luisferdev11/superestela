# Datos y auditoría

> Generado por `report/build.py` desde `evidence.json → audit`. No se edita a mano.

| Qué | Cuántos |
| :--- | ---: |
| Lanzamientos | 635,002 |
| Juegos | 2,127 |
| Lanzadores | 1,134 |
| Bateadores | 864 |
| Temporadas | 2024, 2025, 2026 |

| Campo | Problema | Evidencia | Severidad | Qué se hizo |
| :--- | :--- | :--- | :--- | :--- |
| `is_hit_by_pitch` | flag is all-zero while PitchCall records HBP events | 0 flagged vs 2280 HitByPitch in PitchCall | high | rebuild flag from PitchCall |
| `EffectiveVelo` | stored as string while every other velocity is float64 | dtype=str | medium | cast to float in ingestion |
| `y0` | constant, carries zero information | 634988/635002 rows equal 50.0 ft | low | drop from feature space |
| `Outs` | impossible value 3 before a pitch | 8 rows | medium | range assertion, quarantine rows |
| `altitude_category` | null environment label | 3020 rows | high | impute from measured density index |
| `PitcherThrows / BatterSide` | None / Undefined handedness | 1421 pitcher rows | medium | impute from pitcher mode, else drop |
| `AutoPitchType` | rare / junk labels beyond the 8 documented classes | Sweeper=588, Other=61, OneSeamFastBall=1, TwoSeamFastBall=1, Knuckleball=1 | medium | collapse into documented taxonomy |
| `stadium identity` | no stadium id; only a 3-level altitude bucket | altitude_category in {No, Medium, Extreme} | high | derive a continuous density index from ball physics |

Los defectos se citan como los registra `evidence.py`, en inglés.
