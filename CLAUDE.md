# Instrucciones para asistentes de IA en este repositorio

- No agregar `Co-Authored-By`, `Generated-By` ni ninguna atribucion de Claude, Anthropic u otra IA en commits, pull requests ni descripciones, salvo orden expresa del responsable del repositorio.
- No cambiar `user.name` ni `user.email` de Git.
- Los hooks de `.githooks/` (activar con `git config core.hooksPath .githooks`) y el trabajo `atribucion` de CI rechazan esas atribuciones.
- No hacer push, force push ni merge sin autorizacion; no modificar requisitos (`docs/01`), ADR ni diagramas C4.
