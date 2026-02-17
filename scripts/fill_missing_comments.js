/**
 * 주석(설명)이 없는 테이블·컬럼에만 기본 설명을 채웁니다.
 * 실행: node scripts/fill_missing_comments.js
 */
const { sequelize } = require('../config/database');

const TABLE_COMMENTS = {
    users: '시스템 사용자 정보',
    farms: '농장 정보',
    user_farms: '사용자-농장 관계 및 농장 내 역할/직책',
    roles: '직책·권한 정의 (시스템/농장 공통)',
    structure_templates: '농장 시설 구조 템플릿 (사육시설/일반시설)',
    farm_structure: '농장별 운영 시설 설정 (템플릿 적용)',
    farm_buildings: '농장 건물 (동)',
    farm_barns: '돈사 (건물 내 사육 시설)',
    farm_rooms: '방 (돈사 내 구역)',
    farm_sections: '칸/구역 (방 내 사육 단위)',
    pig_breeds: '돼지 품종 마스터',
    feed_types: '사료 종류 마스터',
    vaccine_types: '백신 종류 마스터',
    disease_codes: '질병 코드 마스터',
    schedule_items: '일정 항목 (구분·대상장소·기준·날짜·작업유형·작업내용, 시설 반복 설정)',
    schedule_task_types: '작업 유형 마스터',
    schedule_basis_types: '기준 유형 마스터'
};

const COLUMN_COMMENTS = {
    users: {
        id: '사용자 고유 ID (UUID)',
        username: '로그인 아이디',
        email: '이메일',
        password: '암호화된 비밀번호',
        fullName: '실명',
        phone: '전화번호',
        birthDate: '생년월일',
        gender: '성별 (male/female/other)',
        nationalityType: '내국인/외국인 구분',
        nationality: '국적 (외국인 시)',
        visaType: '비자 종류',
        visaExpiry: '체류기간 만료일',
        postalCode: '우편번호',
        address: '기본 주소',
        addressDetail: '상세 주소',
        profileImage: '프로필 이미지 경로',
        systemRole: '시스템 권한 (super_admin 등)',
        isActive: '계정 활성 여부',
        lastLogin: '마지막 로그인 일시',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farms: {
        id: '농장 고유 ID (UUID)',
        farmName: '농장명',
        farmCode: '농장 코드',
        ownerName: '대표자명',
        businessNumber: '사업자등록번호',
        phone: '전화번호',
        email: '이메일',
        address: '기본 주소',
        addressDetail: '상세 주소',
        postalCode: '우편번호',
        latitude: '위도',
        longitude: '경도',
        timezone: '타임존',
        totalArea: '총 면적 (m²)',
        capacity: '최대 사육 두수',
        status: '운영 상태 (ACTIVE, INACTIVE, DELETED)',
        note: '비고',
        ownerId: '소유자(등록자) 사용자 ID',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    user_farms: {
        id: '관계 고유 ID',
        userId: '사용자 ID',
        farmId: '농장 ID',
        role: '농장 내 역할 (farm_admin, staff 등)',
        department: '부서',
        position: '직책',
        employmentType: '고용형태 (정규직, 계약직 등)',
        hireDate: '입사일',
        resignDate: '퇴사일',
        salary: '급여',
        permissions: '세부 권한 (JSON)',
        assignedBy: '등록자 ID',
        assignedAt: '등록 일시',
        isActive: '관계 활성 여부',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    roles: {
        id: '직책 고유 ID',
        code: '직책 코드 (예: FARM_ADMIN)',
        name: '직책명 (표시용)',
        description: '설명',
        level: '권한 레벨 (숫자)',
        permissionRole: '매핑 권한 (farm_admin 등)',
        scope: '적용 범위 (system/farm)',
        isDefault: '기본 선택 여부',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    structure_templates: {
        id: '템플릿 ID',
        category: '분류 (production: 사육, general: 일반)',
        name: '시설명',
        weight: '체중/상태 구분',
        optimalDensity: '두수당 적정 면적 (m²/두)',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farm_structure: {
        id: '레코드 ID',
        farmId: '농장 ID',
        templateId: '구조 템플릿 ID',
        category: '시설 분류',
        name: '시설명',
        weight: '체중/상태',
        optimalDensity: '두수당 적정 면적',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farm_buildings: {
        id: '건물 ID (UUID)',
        farmId: '농장 ID',
        name: '건물명',
        totalFloors: '총 층수 (표시용)',
        code: '건물 코드',
        orderIndex: '정렬 순서',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farm_barns: {
        id: '돈사 ID (UUID)',
        buildingId: '소속 건물 ID',
        farmId: '농장 ID',
        name: '돈사명',
        floorNumber: '층 번호',
        barnType: '돈사 종류',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farm_rooms: {
        id: '방 ID (UUID)',
        barnId: '소속 돈사 ID',
        buildingId: '건물 ID',
        farmId: '농장 ID',
        name: '방 이름',
        roomNumber: '방 번호',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    farm_sections: {
        id: '칸 ID (UUID)',
        roomId: '소속 방 ID',
        barnId: '돈사 ID',
        buildingId: '건물 ID',
        farmId: '농장 ID',
        name: '칸 이름',
        sectionNumber: '칸 번호',
        capacity: '수용 두수',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    pig_breeds: {
        id: '품종 ID',
        code: '품종 코드',
        nameKo: '품종명 (한글)',
        nameEn: '품종명 (영문)',
        description: '설명',
        characteristics: '주요 특성',
        usage: '용도',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    feed_types: {
        id: '사료 ID',
        name: '사료명',
        manufacturer: '제조사',
        description: '설명',
        targetStage: '급여 단계',
        nutrients: '영양 성분',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    vaccine_types: {
        id: '백신 ID',
        name: '백신명',
        targetDisease: '대상 질병',
        manufacturer: '제조사',
        method: '접종 방법',
        dosage: '용량',
        timing: '접종 시기',
        description: '설명',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    disease_codes: {
        id: '질병 ID',
        code: '질병 코드',
        name: '질병명 (한글)',
        englishName: '질병명 (영문)',
        symptoms: '주요 증상',
        prevention: '예방·관리',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    schedule_items: {
        id: '일정 항목 고유 ID',
        targetType: '구분: pig(돼지), facility(시설)',
        structureTemplateId: '대상장소 (structure_templates FK)',
        basisTypeId: '기준 (schedule_basis_types FK)',
        ageLabel: '일령 표시 (예: 0~21일령, 포유자돈). 돼지 일정용',
        dayMin: '날짜(시작) - 기준일로부터 일수',
        dayMax: '날짜(끝) - 기준일로부터 일수',
        taskTypeId: '작업유형 (schedule_task_types FK)',
        description: '작업내용',
        sortOrder: '정렬 순서',
        isActive: '사용 여부',
        recurrenceType: '반복 유형: none|daily|weekly|monthly|yearly. null이면 1회성',
        recurrenceInterval: '반복 간격 (기본 1, 2주마다=2 등)',
        recurrenceWeekdays: '주간 반복 시 요일 0=일..6=토 예: 1,4=월목',
        recurrenceMonthDay: '월간 반복 시 일(1-31)',
        recurrenceStartDate: '반복 시작일 (DB 유지)',
        recurrenceEndDate: '반복 종료일(null=무기한, DB 유지)',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    schedule_task_types: {
        id: '작업 유형 ID',
        code: '작업 유형 코드 (예: VACCINE, MOVE)',
        name: '작업 유형명 (예: 백신 접종, 이동)',
        category: '대분류 (vaccine, feed, move 등)',
        description: '설명',
        sortOrder: '목록 정렬 순서',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    },
    schedule_basis_types: {
        id: '기준 유형 ID',
        code: '기준 코드 (예: ENTRY_DAY, DAILY)',
        name: '기준명 (예: 전입일, 매일)',
        targetType: '구분: pig(돼지), facility(시설)',
        description: '설명',
        sortOrder: '목록 정렬 순서',
        createdAt: '생성 일시',
        updatedAt: '수정 일시'
    }
};

function escapeComment(s) {
    if (s == null || s === '') return null;
    return String(s).replace(/'/g, "''");
}

async function main() {
    try {
        console.log('🔄 주석이 없는 테이블·컬럼에 기본 설명 채우기...\n');

        const [tables] = await sequelize.query(`
            SELECT t.table_name,
                   obj_description(pgc.oid, 'pg_class') AS table_comment
            FROM information_schema.tables t
            JOIN pg_class pgc ON t.table_name = pgc.relname
            WHERE t.table_schema = 'public' AND pgc.relkind = 'r'
            ORDER BY t.table_name
        `);

        let tableFilled = 0;
        let columnFilled = 0;

        for (const row of tables) {
            const tableName = row.table_name;
            const currentComment = row.table_comment;
            const defaultComment = TABLE_COMMENTS[tableName];

            if (defaultComment && !currentComment) {
                const esc = escapeComment(defaultComment);
                await sequelize.query(`COMMENT ON TABLE "${tableName}" IS '${esc}';`);
                console.log(`  ✅ 테이블 "${tableName}" 설명 추가`);
                tableFilled++;
            }

            const [cols] = await sequelize.query(`
                SELECT c.column_name, c.ordinal_position,
                       col_description(pgc.oid, c.ordinal_position) AS column_comment
                FROM information_schema.columns c
                JOIN pg_class pgc ON c.table_name = pgc.relname
                WHERE c.table_schema = 'public' AND c.table_name = $1
                ORDER BY c.ordinal_position
            `, { bind: [tableName] });

            const colMap = COLUMN_COMMENTS[tableName] || {};
            for (const col of cols) {
                const colName = col.column_name;
                const currentColComment = col.column_comment;
                const defaultColComment = colMap[colName] || null;
                if (defaultColComment && !currentColComment) {
                    const esc = escapeComment(defaultColComment);
                    await sequelize.query(`COMMENT ON COLUMN "${tableName}"."${colName}" IS '${esc}';`);
                    console.log(`     컬럼 "${colName}" 설명 추가`);
                    columnFilled++;
                }
            }
        }

        console.log(`\n✅ 완료: 테이블 ${tableFilled}건, 컬럼 ${columnFilled}건 설명 추가`);
        process.exit(0);
    } catch (e) {
        console.error('❌ 오류:', e);
        process.exit(1);
    }
}

main();
