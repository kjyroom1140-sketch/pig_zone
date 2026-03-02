BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS farm_initialized_at TIMESTAMPTZ NULL;

ALTER TABLE pig_groups
  ADD COLUMN IF NOT EXISTS birth_date DATE NULL;

CREATE TABLE IF NOT EXISTS sows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  sow_no VARCHAR(40) NOT NULL,
  current_section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'culled', 'sold')),
  parity INTEGER NULL CHECK (parity >= 0),
  birth_date DATE NULL,
  memo TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (farm_id, sow_no)
);

CREATE INDEX IF NOT EXISTS idx_sows_farm_status
  ON sows (farm_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_sows_farm_section
  ON sows (farm_id, current_section_id);

DO $$
DECLARE
  _con_name TEXT;
BEGIN
  -- section_inventory_ledger.ref_type 체크 제약에 opening 추가
  IF to_regclass('public.section_inventory_ledger') IS NOT NULL THEN
    FOR
      _con_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'section_inventory_ledger'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%ref_type%'
    LOOP
      EXECUTE 'ALTER TABLE section_inventory_ledger DROP CONSTRAINT IF EXISTS ' || quote_ident(_con_name);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_section_inventory_ledger_ref_type'
    ) THEN
      ALTER TABLE section_inventory_ledger
        ADD CONSTRAINT chk_section_inventory_ledger_ref_type
        CHECK (ref_type IN ('birth', 'movement', 'adjust', 'shipment', 'opening', 'manual'));
    END IF;
  END IF;

  IF to_regclass('public.farrowing_events') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'farrowing_events'
        AND column_name = 'origin_sow_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_farrowing_events_origin_sow'
      ) THEN
        ALTER TABLE farrowing_events
          ADD CONSTRAINT fk_farrowing_events_origin_sow
          FOREIGN KEY (origin_sow_id)
          REFERENCES sows(id)
          ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

COMMIT;
