# ADR 0006 · La revisión obligatoria empieza cuando hay quién revise

**Fecha:** 21 de septiembre de 2026 · **Estado:** aceptada

## Contexto

`main` se protegió el primer día con todo lo que se podía activar sin un equipo: CI verde obligatorio, sin force-push, sin borrar la rama, y `enforce_admins` para que las reglas aplicaran también a quien las escribió. Todo menos una cosa: **el número de revisiones requeridas se dejó en 0**, porque había una sola persona en el repositorio y una revisión que nadie puede dar bloquea el trabajo sin proteger nada.

Eso quedó escrito en el `README` como pendiente explícito, con el comando listo, para que no viviera en la cabeza de nadie.

El equipo entró: **`EMOA117`, `angelmvp` y `Kittyk-son`** son colaboradores, y el PR #6 (el EDA del dataset) ya se fusionó con autoría de datos. El pendiente venció.

## Decisión

**Las revisiones requeridas suben a 1.** Con `enforce_admins` activo, aplica a las cuatro personas sin excepción, incluida la que administra el repositorio.

**`CODEOWNERS` deja de asignarlo todo a una cuenta.** `packages/models/` y `packages/contracts/` los revisa datos —los tres juntos, sin repartir por área todavía, para que nadie espere a una sola persona—; `core/`, `web/` y `api/` los revisa producto. Es lo que `docs/07` §2.2 dice desde que se escribió.

**El job `web` entra a los checks requeridos**, pero solo después de que `packages/web/package.json` exista. Activarlo antes bloquearía todo PR esperando un check que no puede correr.

## Consecuencias

- **Nadie fusiona solo, y eso incluye al dueño del repositorio.** Es el costo buscado: `docs/07` §2.3 dice *"todo PR se revisa. No por control: es cómo se reparte el conocimiento en un equipo de cuatro"*, y hasta hoy era una frase sin mecanismo.
- Los PRs se vuelven bloqueantes entre personas. El límite de 400 líneas de `CONVENTIONS.md` §6.3 deja de ser higiene y pasa a ser lo que hace que una revisión llegue el mismo día.
- El bloque de pendiente del `README` se reemplaza por la descripción del estado real. Un pendiente cumplido que sigue escrito como pendiente engaña igual que uno incumplido.
