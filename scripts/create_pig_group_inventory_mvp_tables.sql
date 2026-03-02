BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) 농장 운영 초기화 상태
ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS farm_initialized_at TIMESTAMPTZ NULL;

-- 1) 돈군 현재 상태 테이블
CREATE TABLE IF NOT EXISTS pig_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  group_no VARCHAR(40) NOT NULL,
  root_group_id UUID NULL REFERENCES pig_groups(id) ON DELETE SET NULL,
  current_section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  head_count INTEGER NOT NULL DEFAULT 0 CHECK (head_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'merged')),
  created_reason VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (created_reason IN ('birth', 'split', 'manual', 'merge')),
  parent_group_id UUID NULL REFERENCES pig_groups(id) ON DELETE SET NULL,
  birth_date DATE NULL,
  memo TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (farm_id, group_no)
);

-- 2) 이동 이벤트 헤더
CREATE TABLE IF NOT EXISTS pig_movement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('full', 'partial', 'split', 'merge', 'entry', 'shipment')),
  scheduled_work_plan_id INTEGER NULL,
  moved_at TIMESTAMP NOT NULL DEFAULT now(),
  moved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  memo TEXT NULL,
  idempotency_key VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pig_movement_events_idempotency
  ON pig_movement_events (farm_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) 이동 이벤트 상세 라인
CREATE TABLE IF NOT EXISTS pig_movement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES pig_movement_events(id) ON DELETE CASCADE,
  source_group_id UUID NULL REFERENCES pig_groups(id) ON DELETE SET NULL,
  target_group_id UUID NULL REFERENCES pig_groups(id) ON DELETE SET NULL,
  from_section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  to_section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  head_count INTEGER NOT NULL CHECK (head_count > 0),
  line_type VARCHAR(20) NOT NULL CHECK (line_type IN ('move', 'split_out', 'split_in', 'merge_in', 'merge_out', 'entry', 'shipment')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (source_group_id IS NOT NULL OR target_group_id IS NOT NULL)
);

-- 4) 칸별 두수 원장
CREATE TABLE IF NOT EXISTS section_inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES farm_sections(id) ON DELETE CASCADE,
  pig_group_id UUID NULL REFERENCES pig_groups(id) ON DELETE SET NULL,
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('IN', 'OUT', 'ADJ')),
  head_count INTEGER NOT NULL CHECK (head_count > 0),
  event_id UUID NULL REFERENCES pig_movement_events(id) ON DELETE SET NULL,
  ref_type VARCHAR(20) NOT NULL CHECK (ref_type IN ('birth', 'movement', 'adjust', 'shipment', 'opening', 'manual')),
  ref_id UUID NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 5) 칸별 현재고 스냅샷(성능용)
CREATE TABLE IF NOT EXISTS section_inventory_balance (
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES farm_sections(id) ON DELETE CASCADE,
  head_count INTEGER NOT NULL DEFAULT 0 CHECK (head_count >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (farm_id, section_id)
);

-- 6) 모돈 개체 마스터
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

-- 7) 분만 원천 이벤트(모돈 기원 추적)
CREATE TABLE IF NOT EXISTS farrowing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES farm_sections(id) ON DELETE RESTRICT,
  created_group_id UUID NOT NULL REFERENCES pig_groups(id) ON DELETE RESTRICT,
  origin_sow_id UUID NULL REFERENCES sows(id) ON DELETE SET NULL,
  born_count INTEGER NOT NULL CHECK (born_count > 0),
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  memo TEXT NULL,
  idempotency_key VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_farrowing_events_idempotency
  ON farrowing_events (farm_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 7) 돈군 계보 엣지(부모 -> 자식)
CREATE TABLE IF NOT EXISTS pig_group_lineage_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  parent_group_id UUID NOT NULL REFERENCES pig_groups(id) ON DELETE CASCADE,
  child_group_id UUID NOT NULL REFERENCES pig_groups(id) ON DELETE CASCADE,
  edge_type VARCHAR(20) NOT NULL CHECK (edge_type IN ('split', 'merge', 'birth_link')),
  event_id UUID NULL REFERENCES pig_movement_events(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (parent_group_id <> child_group_id)
);

-- 8) 출하 이벤트 헤더
CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  shipped_at TIMESTAMP NOT NULL DEFAULT now(),
  shipped_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  memo TEXT NULL,
  idempotency_key VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_events_idempotency
  ON shipment_events (farm_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 9) 출하 이벤트 라인
CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES shipment_events(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  source_group_id UUID NOT NULL REFERENCES pig_groups(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES farm_sections(id) ON DELETE RESTRICT,
  head_count INTEGER NOT NULL CHECK (head_count > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 10) 일정 실행 단위(예정/완료)
CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  work_plan_id INTEGER NOT NULL REFERENCES schedule_work_plans(id) ON DELETE RESTRICT,
  section_id UUID NULL REFERENCES farm_sections(id) ON DELETE SET NULL,
  execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('birth', 'move', 'inspection')),
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
  completed_at TIMESTAMPTZ NULL,
  completed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  result_ref_type VARCHAR(30) NULL,
  result_ref_id UUID NULL,
  idempotency_key VARCHAR(80) NULL,
  memo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (result_ref_type IS NULL AND result_ref_id IS NULL)
    OR (result_ref_type IS NOT NULL AND result_ref_id IS NOT NULL)
  ),
  CHECK (
    status <> 'completed'
    OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_executions_idempotency
  ON schedule_executions (farm_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 권장 인덱스
CREATE INDEX IF NOT EXISTS idx_pig_groups_farm_status
  ON pig_groups (farm_id, status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_pig_groups_root
  ON pig_groups (farm_id, root_group_id);

CREATE INDEX IF NOT EXISTS idx_lineage_child
  ON pig_group_lineage_edges (farm_id, child_group_id);

CREATE INDEX IF NOT EXISTS idx_lineage_parent
  ON pig_group_lineage_edges (farm_id, parent_group_id);

CREATE INDEX IF NOT EXISTS idx_farrowing_created_group
  ON farrowing_events (farm_id, created_group_id);

CREATE INDEX IF NOT EXISTS idx_shipment_lines_event_group
  ON shipment_lines (event_id, source_group_id);

CREATE INDEX IF NOT EXISTS idx_movement_lines_source
  ON pig_movement_lines (farm_id, source_group_id);

CREATE INDEX IF NOT EXISTS idx_movement_lines_target
  ON pig_movement_lines (farm_id, target_group_id);

CREATE INDEX IF NOT EXISTS idx_ledger_farm_section_occurred
  ON section_inventory_ledger (farm_id, section_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_movement_events_farm_moved_at
  ON pig_movement_events (farm_id, moved_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_events_farm_shipped_at
  ON shipment_events (farm_id, shipped_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_executions_farm_date_status
  ON schedule_executions (farm_id, scheduled_date, status);

CREATE INDEX IF NOT EXISTS idx_schedule_executions_farm_section_date
  ON schedule_executions (farm_id, section_id, scheduled_date);

-- 테이블 주석
COMMENT ON TABLE pig_groups IS '돈군 마스터. 분만/분할/합군으로 생성된 돈군의 현재 상태와 위치를 관리';
COMMENT ON TABLE pig_movement_events IS '이동 작업 헤더. 한 번의 이동 업무(완료 이벤트) 단위를 저장';
COMMENT ON TABLE pig_movement_lines IS '이동 상세 라인. 분할/합군/부분이동을 라인 단위로 표현';
COMMENT ON TABLE section_inventory_ledger IS '칸별 두수 재고 원장. IN/OUT/ADJ 트랜잭션을 누적 저장';
COMMENT ON TABLE section_inventory_balance IS '칸별 현재 두수 스냅샷. 원장 집계 성능 최적화용';
COMMENT ON TABLE sows IS '모돈 개체 마스터. 모돈 번호/현재 위치/상태를 관리';
COMMENT ON TABLE farrowing_events IS '분만 원천 이벤트. 돈군 시작점과 모돈 기원을 연결';
COMMENT ON TABLE pig_group_lineage_edges IS '돈군 계보 엣지. 분할/합군으로 생성된 부모-자식 관계 추적';
COMMENT ON TABLE shipment_events IS '출하 이벤트 헤더. 한 번의 출하 업무 단위';
COMMENT ON TABLE shipment_lines IS '출하 이벤트 라인. 다중 칸/돈군 출하 수량 상세';
COMMENT ON TABLE schedule_executions IS '일정 실행 단위 테이블. 계획에서 생성된 예정/완료 상태와 결과 참조를 관리';

COMMIT;
