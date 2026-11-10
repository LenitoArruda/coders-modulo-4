# ADR 0014 — Hash de senha com scrypt nativo

> **Status:** aceito · **Data:** 2026-11-09
> **Decisores:** Engenharia
> **Substitui:** — · **Substituído por:** —

## Contexto

A fatia 004 é a primeira a persistir senha (`users.password_hash`) e a decisão de algoritmo estava
em aberto na §7 do ARCHITECTURE. A spec exige hash forte, senha nunca devolvida/logada e uma
dependência nova só se justificada. O ambiente roda Node ≥ 24 e Bun, e o deploy da API ainda não
foi decidido; qualquer dependência nativa (bcrypt/argon2) adiciona custo de build e risco de
binário por plataforma.

## Decisão

1. **`scrypt` de `node:crypto`**, sem dependência nova. Parâmetros: `N = 2^15` (32768),
   `r = 8`, `p = 1`, salt aleatório de 16 bytes, chave derivada de 32 bytes.
2. **Formato PHC-like versionado** persistido em `users.password_hash`:
   `$scrypt$ln=15,r=8,p=1$<salt-base64url>$<hash-base64url>` (N = 2^15 = 32768). O adaptador
   valida o formato ao verificar e usa comparação em tempo constante (`timingSafeEqual`).
3. **Porta `PasswordHasherPort`** (`hash`/`verify`) em `application/ports`, com o adaptador
   `ScryptPasswordHasher` em `infrastructure`. O caso de uso não conhece o algoritmo.
4. **Token de confirmação** usa o mesmo princípio de não guardar segredo em claro: 32 bytes
   aleatórios em base64url no link e apenas `sha256` em hex na coluna `auth_tokens.token_hash`.
5. **Sem rehash automático nesta fatia.** O prefixo com parâmetros permite migrar custo/algoritmo
   depois; quando isso acontecer, o `verify` pode sinalizar rehash ao caso de uso.

## Consequências

### Positivas

- Nenhuma dependência nativa/binária nova; funciona no Node e no Bun do monorepo.
- Parâmetros de custo explícitos e versionados no próprio hash.
- Comparação em tempo constante e salt por senha; senha em claro só existe no request.
- Adaptador isolado: trocar para argon2/bcrypt no futuro não muda o caso de uso.

### Negativas / trade-offs

- scrypt consome CPU e memória por design (~50–100 ms por hash no ambiente local); o p95 de 1 s
  do sign-up depende desse custo e do SMTP local.
- Não há benchmark formal por hardware nem política de rehash automático.
- `node:crypto` limita portabilidade para runtimes não-Node (ex.: edge), o que conflita com um
  eventual deploy serverless sem Node — risco já registrado para o deploy da API.

## Alternativas consideradas

| Alternativa                           | Por que foi descartada                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| bcrypt (`bcrypt`/`bcryptjs`)          | Dependência nativa ou versão JS mais lenta; scrypt nativo cobre o requisito   |
| argon2                                | Melhor custo/segurança, mas exige dependência nativa e build por plataforma   |
| PBKDF2 (`node:crypto`)                | Menos resistente a GPU com custo equivalente; scrypt é superior para senha    |
| SHA-256 + salt manual                 | Rápido demais para senha, sem fator de custo; inadequado                      |
| Guardar token de confirmação em claro | Vazamento do banco permitiria confirmar contas; hash em repouso é obrigatório |

## Follow-ups

- Reavaliar argon2 (ou custo de scrypt) quando o deploy da API for definido e houver benchmark.
- Implementar rehash transparente no `verify` se os parâmetros padrão mudarem.
- As fatias 006–008 reutilizam o mesmo adaptador para sign-in e reset de senha.

## Referências

- [ARCHITECTURE.md](../.docs/ARCHITECTURE.md)
- [DEVELOPMENT.md](../.docs/DEVELOPMENT.md)
- [QA.md](../.docs/QA.md)
- [Spec 004 — Auth sign-up](../.specs/004-auth-sign-up.md)
- [ADR 0012 — Auth própria na API](./0012-auth-propria-na-api.md)
