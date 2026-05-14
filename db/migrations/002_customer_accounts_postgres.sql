CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  phone_normalized TEXT NULL,
  address TEXT NOT NULL DEFAULT '',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_at TIMESTAMPTZ NULL,
  accepted_terms_at TIMESTAMPTZ NULL,
  accepted_terms_version TEXT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_normalized_unique
  ON users (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_desc
  ON users (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NULL,
  address_line TEXT NOT NULL,
  city TEXT NULL,
  country TEXT NOT NULL DEFAULT 'Suriname',
  reference TEXT NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id
  ON addresses (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_default_per_user
  ON addresses (user_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_lookup
  ON auth_codes (user_id, email, purpose, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_codes_expires_at
  ON auth_codes (expires_at);
