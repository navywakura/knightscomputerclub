# Seguridad

Gracias por mirar el código con mala leche (la buena).

## Reportes

Preferimos **transparencia**:

1. Abrí un [issue](https://github.com/navywakura/knightscomputerclub/issues) con prefijo `[security]`.
2. O un PR con el arreglo y una descripción del impacto.
3. Si el bug es **crítico y explotable en producción** (RCE, session dump, auth bypass total), contactá al owner del repo **antes** de publicar un write-up completo. Coordinamos el parche y después lo documentamos.

## Qué no hacer

- No atacar **https://www.knightscomputer.club** para “demostrar” un bug sin aviso (DoS, spam, robo de cuentas).
- No pegar secretos, dumps de DB ni datos personales de terceros.
- No uses scanners agresivos contra prod; corré el stack en local (ver README).

## Alcance

En scope (ejemplos):

- Auth / sesión / cookies / OAuth
- IDOR en foros, nexo, media, admin
- XSS almacenado, CSRF en mutaciones
- Subida de archivos / path traversal
- Rate-limit y captcha bypass
- Errores de config que filtren datos

Fuera de scope (por ahora):

- Phishing al dominio
- Social engineering a usuarios
- Reportes genéricos de “falta HTTPS” (ya está en prod)
- Versiones de dependencias sin PoC ni impacto

## Recompensas

No hay bug bounty formal. Hay **crédito en el changelog / issue**, respeto del club, y la chance de dejar el nodo más duro.

## Baseline actual

Ver sección *seguridad* del [README](./README.md) y `docs/security-hardening.md`.
