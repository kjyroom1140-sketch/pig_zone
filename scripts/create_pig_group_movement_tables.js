/**
 * 돼지 객체·돈군·이동 테이블 생성 스크립트
 * 문서: docs/pig_object_group_movement_tables.md
 *
 * 생성 순서: pig_groups → pigs → section_group_occupancy → pig_movements
 * 실행: node scripts/create_pig_group_movement_tables.js
 */

const { sequelize } = require('../config/database');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.\n');

        // 1) pig_groups
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS pig_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                farm_id UUID NOT NULL REFERENCES farms(id),
                group_no VARCHAR(30),
                current_section_id UUID REFERENCES farm_sections(id),
                entry_date DATE,
                birth_date DATE,
                breed_type VARCHAR(50),
                headcount INTEGER,
                status VARCHAR(30),
                parent_group_id UUID REFERENCES pig_groups(id),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            COMMENT ON TABLE pig_groups IS '돈군 — 한 무리 단위. 일정·이동·사육의 기본 단위';
            COMMENT ON COLUMN pig_groups.id IS 'PK (DB 내부 식별자)';
            COMMENT ON COLUMN pig_groups.farm_id IS 'FK → farms.id';
            COMMENT ON COLUMN pig_groups.group_no IS '돈군 번호(사람이 보는 식별자). 생성 일시 기반';
            COMMENT ON COLUMN pig_groups.current_section_id IS 'FK → farm_sections.id. 현재 있는 칸(주된 위치)';
            COMMENT ON COLUMN pig_groups.entry_date IS '입식/전입일';
            COMMENT ON COLUMN pig_groups.birth_date IS '출생일';
            COMMENT ON COLUMN pig_groups.breed_type IS '대표 품종';
            COMMENT ON COLUMN pig_groups.headcount IS '두수 (객체 테이블 사용 시 COUNT로 보정 가능)';
            COMMENT ON COLUMN pig_groups.status IS 'active, split, merged, closed 등';
            COMMENT ON COLUMN pig_groups.parent_group_id IS 'FK → pig_groups.id. 분할 시 원래 돈군 참조';
            COMMENT ON COLUMN pig_groups.created_at IS '돈군 번호(group_no) 생성에 사용';
            COMMENT ON COLUMN pig_groups.updated_at IS '수정 일시';
        `);
        console.log('✅ pig_groups 테이블 확인/생성 완료');

        // 2) pigs
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS pigs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                farm_id UUID NOT NULL REFERENCES farms(id),
                pig_group_id UUID REFERENCES pig_groups(id),
                individual_no VARCHAR(50),
                ear_tag_type VARCHAR(20),
                rfid_tag_id VARCHAR(100),
                breed_type VARCHAR(50),
                gender VARCHAR(20),
                birth_date DATE,
                entry_date DATE,
                status VARCHAR(30),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            COMMENT ON TABLE pigs IS '돼지 객체(개체) — RFID 등 개별 식별된 마리만 등록';
            COMMENT ON COLUMN pigs.id IS 'PK, 기본값 UUID';
            COMMENT ON COLUMN pigs.farm_id IS 'FK → farms.id';
            COMMENT ON COLUMN pigs.pig_group_id IS 'FK → pig_groups.id. 이 개체가 속한 돈군. NULL = 미편입/돈군 미사용';
            COMMENT ON COLUMN pigs.individual_no IS '개체 번호(귀표 등)';
            COMMENT ON COLUMN pigs.ear_tag_type IS '귀표 유형. rfid(전자이표), barcode, none 등';
            COMMENT ON COLUMN pigs.rfid_tag_id IS 'RFID 전자이표 ID. NULL이면 비RFID/미등록';
            COMMENT ON COLUMN pigs.breed_type IS '품종 (pig_breeds 참조 또는 코드)';
            COMMENT ON COLUMN pigs.gender IS '성별 (암컷/수컷 등)';
            COMMENT ON COLUMN pigs.birth_date IS '출생일';
            COMMENT ON COLUMN pigs.entry_date IS '전입/입식일';
            COMMENT ON COLUMN pigs.status IS '상태 (사육중, 출하, 폐사 등)';
            COMMENT ON COLUMN pigs.created_at IS '생성 일시';
            COMMENT ON COLUMN pigs.updated_at IS '수정 일시';
        `);
        console.log('✅ pigs 테이블 확인/생성 완료');

        // 3) section_group_occupancy
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS section_group_occupancy (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                section_id UUID NOT NULL REFERENCES farm_sections(id),
                pig_group_id UUID NOT NULL REFERENCES pig_groups(id),
                headcount INTEGER NOT NULL,
                started_at TIMESTAMP WITH TIME ZONE,
                ended_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            COMMENT ON TABLE section_group_occupancy IS '칸–돈군 배치(선택). 사육 두수·이력';
            COMMENT ON COLUMN section_group_occupancy.id IS 'PK';
            COMMENT ON COLUMN section_group_occupancy.section_id IS 'FK → farm_sections.id';
            COMMENT ON COLUMN section_group_occupancy.pig_group_id IS 'FK → pig_groups.id';
            COMMENT ON COLUMN section_group_occupancy.headcount IS '해당 칸에서 이 돈군의 두수';
            COMMENT ON COLUMN section_group_occupancy.started_at IS '해당 칸 입주 시점';
            COMMENT ON COLUMN section_group_occupancy.ended_at IS '해당 칸 퇴거 시점 (NULL이면 현재 재적)';
            COMMENT ON COLUMN section_group_occupancy.created_at IS '생성 일시';
            COMMENT ON COLUMN section_group_occupancy.updated_at IS '수정 일시';
        `);
        console.log('✅ section_group_occupancy 테이블 확인/생성 완료');

        // 4) pig_movements
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS pig_movements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                farm_id UUID NOT NULL REFERENCES farms(id),
                pig_group_id UUID REFERENCES pig_groups(id),
                from_section_id UUID REFERENCES farm_sections(id),
                to_section_id UUID REFERENCES farm_sections(id),
                moved_at TIMESTAMP WITH TIME ZONE NOT NULL,
                headcount INTEGER,
                split_percentage INTEGER,
                movement_type VARCHAR(30),
                source_group_id UUID REFERENCES pig_groups(id),
                schedule_item_id INTEGER REFERENCES farm_schedule_items(id),
                moved_by UUID REFERENCES users(id),
                memo TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            COMMENT ON TABLE pig_movements IS '이동 이벤트 1건 = 1행. 사별(칸/방/돈사) 조회 가능';
            COMMENT ON COLUMN pig_movements.id IS 'PK';
            COMMENT ON COLUMN pig_movements.farm_id IS 'FK → farms.id (사별/농장별 조회용)';
            COMMENT ON COLUMN pig_movements.pig_group_id IS 'FK → pig_groups.id. 이동한 돈군. NULL이면 돈군 미지정 두수 이동 등';
            COMMENT ON COLUMN pig_movements.from_section_id IS 'FK → farm_sections.id. 출발 칸 (전입은 NULL 가능)';
            COMMENT ON COLUMN pig_movements.to_section_id IS 'FK → farm_sections.id. 도착 칸 (출하·폐사는 NULL 가능)';
            COMMENT ON COLUMN pig_movements.moved_at IS '이동 일시';
            COMMENT ON COLUMN pig_movements.headcount IS '이동 두수';
            COMMENT ON COLUMN pig_movements.split_percentage IS '분할 시 원 돈군 대비 이 목적지(to)로 간 비율(0~100). 일반이동/전입/출하 시 NULL';
            COMMENT ON COLUMN pig_movements.movement_type IS 'transfer(일반이동), entry(전입), shipment(출하), merge, split 등';
            COMMENT ON COLUMN pig_movements.source_group_id IS '분할 시 원 돈군 id(FK → pig_groups). 같은 분할 이벤트 행 묶을 때 사용';
            COMMENT ON COLUMN pig_movements.schedule_item_id IS 'FK → farm_schedule_items.id. 일정 연계';
            COMMENT ON COLUMN pig_movements.moved_by IS 'FK → users.id (실행자)';
            COMMENT ON COLUMN pig_movements.memo IS '비고';
            COMMENT ON COLUMN pig_movements.created_at IS '생성 일시';
        `);
        console.log('✅ pig_movements 테이블 확인/생성 완료');

        console.log('\n✅ 모든 테이블 생성 완료.');
    } catch (error) {
        console.error('❌ 오류:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

run();
