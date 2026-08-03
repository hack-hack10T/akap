ALTER TABLE orders ADD COLUMN return_key_hash TEXT;
ALTER TABLE orders ADD COLUMN client_nonce TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_nonce ON orders(client_nonce);
CREATE INDEX IF NOT EXISTS idx_orders_public_return ON orders(public_id,return_key_hash);
CREATE TABLE IF NOT EXISTS login_attempts(ip_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started INTEGER NOT NULL, blocked_until INTEGER);
