const { sequelize } = require('./config/database');

async function updateComments() {
    try {
        console.log('🔄 데이터베이스 코멘트 업데이트 시작...');

        // 1. Users 테이블
        await sequelize.query(`COMMENT ON TABLE "users" IS '시스템 사용자 정보';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."username" IS '사용자 아이디';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."email" IS '이메일 주소';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."password" IS '암호화된 비밀번호';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."fullName" IS '사용자 실명';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."phone" IS '전화번호';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."profileImage" IS '프로필 이미지 경로';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."systemRole" IS '시스템 권한 (super_admin: 최고 관리자, user: 일반 사용자)';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."isActive" IS '계정 활성 상태 (true: 활성, false: 비활성)';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."lastLogin" IS '마지막 로그인 일시';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."createdAt" IS '생성 일시';`);
        await sequelize.query(`COMMENT ON COLUMN "users"."updatedAt" IS '수정 일시';`);

        // 2. Farms 테이블
        await sequelize.query(`COMMENT ON TABLE "farms" IS '농장 정보 (돈사, 기자재 등)';`);
        // Farms 테이블의 컬럼들은 모델 정의에 이미 코멘트가 포함되어 있을 수 있으나, 확실하게 업데이트
        await sequelize.query(`COMMENT ON COLUMN "farms"."farmName" IS '농장명';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."farmCode" IS '농장 식별 코드';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."ownerName" IS '대표자명';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."businessNumber" IS '사업자등록번호';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."phone" IS '전화번호';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."email" IS '이메일';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."address" IS '기본 주소';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."addressDetail" IS '상세 주소';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."postalCode" IS '우편번호';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."latitude" IS '위도 (GPS)';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."longitude" IS '경도 (GPS)';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."timezone" IS '타임존 (기본: Asia/Seoul)';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."totalArea" IS '총 면적 (m²)';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."capacity" IS '최대 사육 두수';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."status" IS '운영 상태 (ACTIVE, INACTIVE, DELETED)';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."note" IS '비고/메모';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."ownerId" IS '소유자(등록자) ID';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."createdAt" IS '생성 일시';`);
        await sequelize.query(`COMMENT ON COLUMN "farms"."updatedAt" IS '수정 일시';`);

        // 3. UserFarms 테이블
        await sequelize.query(`COMMENT ON TABLE "user_farms" IS '사용자-농장 관계 및 권한';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."userId" IS '사용자 ID';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."farmId" IS '농장 ID';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."role" IS '농장 내 역할 (owner, manager, veterinarian, breeder, staff, consultant)';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."department" IS '담당 부서/구역';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."position" IS '직책';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."employmentType" IS '고용 형태 (full_time, part_time, contract, temporary)';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."hireDate" IS '입사일';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."resignDate" IS '퇴사일';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."salary" IS '급여';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."permissions" IS '세부 권한 설정 (JSON)';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."assignedBy" IS '등록자 ID';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."assignedAt" IS '등록 일시';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."isActive" IS '관계 활성 상태';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."createdAt" IS '생성 일시';`);
        await sequelize.query(`COMMENT ON COLUMN "user_farms"."updatedAt" IS '수정 일시';`);

        console.log('✅ 데이터베이스 코멘트 업데이트 완료');
        process.exit(0);
    } catch (error) {
        console.error('❌ 코멘트 업데이트 중 오류 발생:', error);
        process.exit(1);
    }
}

updateComments();
