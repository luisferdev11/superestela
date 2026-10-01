# Veredicto de hipótesis

> Generado por `report/build.py` desde `evidence.json → hypotheses`. No se edita a mano.

| Hipótesis | Veredicto | Evidencia |
| :--- | :--- | :--- |
| H1 · Menos densidad reduce el break | Confirmada | Within-pitcher four-seam IVB -3.77" (16.95" -> 13.19"), 100.0% of 268 pitchers lose ride. |
| H2 · Los pitches de diferencial de velocidad ganan | Refutada | Changeup loses the largest absolute horizontal break (-3.99"), whiff/swing -1.28 pp, chase -2.27 pp, HR/BIP +1.18 pp. The altitude-proof pitch is the curveball: whiff/swing -0.23 pp, chase +1.95 pp. |
| H3 · La rola vale más en la altura | Confirmada con matiz | GB% rises at altitude for every pitch type: {'Changeup': 2.79, 'Curveball': 1.27, 'Cutter': 4.04, 'Four-Seam': 6.22, 'Sinker': 4.86, 'Slider': 2.45}. Mechanism: the flattened fastball induces more ground balls, but run scoring still rises sharply. |
| H4 · El spin rate no basta | Confirmada | Spin rate is essentially unchanged across environments ({'Changeup': 32.31, 'Curveball': 23.83, 'Cutter': -72.37, 'Four-Seam': 0.0, 'Sinker': 20.61, 'Slider': 34.41}) while break collapses 20-30%. Spin does not survive as a proxy for movement at altitude. |

La evidencia se cita como la registra `evidence.py`, en inglés; el documento la redacta.
