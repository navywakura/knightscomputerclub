# Hardening: defensa en profundidad

Backend: **Node.js / Next.js 15** · DB: **Postgres (Neon)** con queries
parametrizadas (`neon` tagged templates = prepared statements).

## Ya implementado en la app

| Amenaza | Mitigación en código |
|---------|----------------------|
| SQLi | Solo `db\`SELECT … ${var}\`` — sin concatenar SQL |
| XSS | React escape + `rehype-sanitize` en markdown foro |
| Cookies | `HttpOnly` + `Secure` (prod) + `SameSite=Lax` (OAuth) |
| Tampering roles | `role`/`is_vip` solo desde sesión server-side |
| Schema abuse | Zod en login (+ expandible a más rutas) |
| Rate limit | Middleware edge + buckets en memoria |
| Stack traces | `publicError()` en prod |
| Headers | CSP, HSTS, X-Frame-Options DENY, nosniff |

### Cookies

```
HttpOnly; Secure (prod); SameSite=Lax
```

`COOKIE_SAMESITE=strict` opcional (rompe OAuth cross-site; útil en mirror
solo-password).

### Headers (next.config + middleware)

- `Content-Security-Policy` (self + fonts + giphy + img https)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `poweredByHeader: false`

### Rate limits (middleware)

| Ruta | Límite |
|------|--------|
| login | 8 / min / IP |
| register | 5 / min / IP |
| media | 30 / min |
| nexo messages | 90 / min |
| API global | 300 / min / IP |

## OpenBSD — capa de red (pf)

En `/etc/pf.conf` (tras migrar a VPS):

```pf
table <bad_guys> persist
block drop quick from <bad_guys>

pass in on egress proto tcp to port { 80 443 } flags S/SA keep state \
    (max-src-conn 30, max-src-conn-rate 15/5, overload <bad_guys> flush global)
```

## Postgres — mínimo privilegio

```sql
-- en Neon/local: rol de app sin superuser
CREATE ROLE kcc_app LOGIN PASSWORD '…';
GRANT CONNECT ON DATABASE neondb TO kcc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kcc_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kcc_app;
-- NO: SUPERUSER, CREATEDB, DROP
```

## Tor (.onion) — futuro mirror OpenBSD

1. `pkg_add tor`
2. HiddenServiceDir + HiddenServicePort 80 127.0.0.1:3000
3. Footer con dirección `.onion`
4. Mismo `JWT_SECRET` / `DATABASE_URL` que prod

## Checklist de revisión

- [x] Prepared statements
- [x] XSS sanitizado en markdown
- [x] HttpOnly cookies
- [x] Headers de seguridad
- [x] Rate limiting
- [x] Roles solo server-side
- [ ] CSP sin unsafe-eval (requiere audit de Next chunks)
- [ ] SameSite=Strict con OAuth propio
- [ ] WAF / pf en VPS
- [ ] Tor mirror

## Sprints de producto relacionados

| Sprint | Features | Estado |
|--------|----------|--------|
| 1 | Security headers, rate limit, Zod login, safe errors | done |
| 2 | RSS `/api/rss/[slug]`, comandos `/me` `/theme`, UI SFX | done |
| 3 | Docs OpenBSD, health, esta guía | done |
| 4 | Pastebin ZK, SSH TUI, onion | backlog |
