-- Fundação: extensões necessárias para geração de UUIDs e hashing.
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
