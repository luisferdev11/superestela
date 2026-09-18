# ADR 0002 · Los fixtures de contrato se generan, no se versionan

**Fecha:** 18 de septiembre de 2026 · **Estado:** aceptada

## Contexto

`docs/07` §4.2 pide un fixture parquet "chico y anonimizado, versionado en el
repo" para que `contracts.yml` valide contra algo real. Pero `CONVENTIONS.md` §8
regla 4 prohíbe `.parquet` en cualquier ruta, y el hook lo aplica sin mirar el
tamaño ni la intención.

## Decisión

`packages/contracts/fixtures.py` construye las entregas en memoria desde una
semilla fija. Los tests las usan directamente; CI las materializa a un archivo
temporal y valida ese archivo, que es exactamente el camino que recorre una
entrega real.

## Por qué así

Un fixture generado no puede contener datos del reto —no hay de dónde— y la
regla se queda sin excepciones. La alternativa, permitir una ruta de parquet en
el hook, habría abierto la primera grieta en la regla que más caro cuesta
romper, a cambio de nada que el generador no dé.

La única excepción declarada del hook sigue siendo
`docs/reference/stuff_plus_data_dictionary.csv`, por nombre completo y nunca por
patrón (`CONVENTIONS.md` §8.4).
