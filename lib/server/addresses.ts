import "server-only";

import { randomUUID } from "node:crypto";

import { getCustomerPool } from "@/lib/server/customer-db";

export interface StoredAddress {
  id: string;
  userId: string;
  label: string;
  addressLine: string;
  city: string;
  country: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  address_line: string;
  city: string;
  country: string;
  reference: string | null;
  latitude: string | null;
  longitude: string | null;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

function rowToAddress(row: AddressRow): StoredAddress {
  const toIso = (v: Date | string) =>
    v instanceof Date ? v.toISOString() : new Date(v).toISOString();
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    addressLine: row.address_line,
    city: row.city,
    country: row.country,
    reference: row.reference ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function getAddressesByUserId(userId: string): Promise<StoredAddress[]> {
  const pool = await getCustomerPool();
  const result = await pool.query<AddressRow>(
    `SELECT id, user_id, label, address_line, city, country, reference,
            latitude, longitude, is_default, created_at, updated_at
     FROM addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at ASC`,
    [userId]
  );
  return result.rows.map(rowToAddress);
}

export async function createAddress(
  userId: string,
  input: {
    label: string;
    addressLine: string;
    city?: string;
    country?: string;
    reference?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  }
): Promise<StoredAddress> {
  const pool = await getCustomerPool();
  const now = new Date().toISOString();
  const id = randomUUID();
  const city = input.city?.trim() || "Paramaribo";
  const country = input.country?.trim() || "Suriname";

  // If new address is default, unset existing default
  if (input.isDefault) {
    await pool.query(
      `UPDATE addresses SET is_default = FALSE, updated_at = $1 WHERE user_id = $2 AND is_default = TRUE`,
      [now, userId]
    );
  }

  // If user has no addresses yet, force this one as default
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM addresses WHERE user_id = $1`,
    [userId]
  );
  const isFirstAddress = Number(countResult.rows[0]?.count ?? 0) === 0;
  const makeDefault = input.isDefault || isFirstAddress;

  const result = await pool.query<AddressRow>(
    `INSERT INTO addresses (id, user_id, label, address_line, city, country, reference,
       latitude, longitude, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
     RETURNING *`,
    [
      id, userId,
      input.label.trim() || "Mi dirección",
      input.addressLine.trim(),
      city, country,
      input.reference?.trim() ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      makeDefault,
      now, now,
    ]
  );

  return rowToAddress(result.rows[0]!);
}

export async function updateAddress(
  id: string,
  userId: string,
  input: {
    label?: string;
    addressLine?: string;
    city?: string;
    country?: string;
    reference?: string;
    setDefault?: boolean;
  }
): Promise<StoredAddress | null> {
  const pool = await getCustomerPool();
  const now = new Date().toISOString();

  const existing = await pool.query<AddressRow>(
    `SELECT * FROM addresses WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId]
  );
  if (!existing.rows[0]) return null;

  if (input.setDefault) {
    await pool.query(
      `UPDATE addresses SET is_default = FALSE, updated_at = $1 WHERE user_id = $2 AND is_default = TRUE`,
      [now, userId]
    );
  }

  const row = existing.rows[0];
  const result = await pool.query<AddressRow>(
    `UPDATE addresses
     SET label        = $3,
         address_line = $4,
         city         = $5,
         country      = $6,
         reference    = $7,
         is_default   = $8,
         updated_at   = $9::timestamptz
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      id, userId,
      input.label?.trim() ?? row.label,
      input.addressLine?.trim() ?? row.address_line,
      input.city?.trim() ?? row.city,
      input.country?.trim() ?? row.country,
      input.reference !== undefined ? (input.reference.trim() || null) : row.reference,
      input.setDefault ?? row.is_default,
      now,
    ]
  );

  return result.rows[0] ? rowToAddress(result.rows[0]) : null;
}

export async function deleteAddress(id: string, userId: string): Promise<boolean> {
  const pool = await getCustomerPool();
  // Prevent deleting the default address if there are others
  const existing = await pool.query<AddressRow>(
    `SELECT * FROM addresses WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId]
  );
  if (!existing.rows[0]) return false;

  await pool.query(
    `DELETE FROM addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  // If we deleted the default, promote the most recent remaining address
  if (existing.rows[0].is_default) {
    await pool.query(
      `UPDATE addresses SET is_default = TRUE, updated_at = NOW()
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );
  }

  return true;
}
