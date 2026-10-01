# Matriz de trazabilidad

> Generado por `report/build.py` desde `report/claims.toml`. No se edita a mano.

3 de 4 afirmaciones tienen corrida. Las marcadas en rojo no se pueden escribir en el documento hasta que exista la corrida que esperan.

| Afirmación | § | De dónde sale | Valor | Estado |
| :--- | :--- | :--- | :--- | :--- |
| A nivel del mar la liga anota 4.84 carreras por 9 entradas | §1 | `evidence.json` → `run_environment → No Altitude → ra9` | 4.84 | ✅ |
| En altitud extrema anota 7.55 | §1 | `evidence.json` → `run_environment → Extreme Altitude → ra9` | 7.55 | ✅ |
| La altitud extrema suma 56% de carreras | §1 | `evidence.json` → `run_environment → altitude_effect → ra9_pct` | 56.0 | ✅ |
| Un cambio de Stuff+ vale carreras | §7 | sin corrida todavía | espera A3 (equipo de datos) | 🔴 no va en el documento |
