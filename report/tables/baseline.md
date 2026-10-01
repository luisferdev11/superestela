# El baseline v0 y lo que sí se aprende

> Generado por `report/build.py` desde `evidence.json → stuff_plus_v0, target_learnability`. No se edita a mano.

| Modelo | Validación | RMSE | RMSE nulo | R² |
| :--- | ---: | ---: | ---: | ---: |
| Stuff+ v0 (run value directo) | GroupKFold(4) by pitcher_anon_id | 0.2189 | 0.2192 | 0.0028 |

| Componente | n | Tasa base | AUC fuera de pliegue |
| :--- | ---: | ---: | ---: |
| P(whiff | swing) | 290,817 | 0.240 | 0.637 |
| P(chase | out of zone) | 401,607 | 0.342 | 0.544 |
| P(groundball | batted) | 220,611 | 0.282 | 0.606 |
| P(hard hit 95+ | batted) | 178,760 | 0.166 | 0.568 |
