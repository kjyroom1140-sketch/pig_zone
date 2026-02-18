/**
 * 전역 일정 마스터 초기 데이터 (docs: schedule_structure_design.md)
 * - schedule_divisions (구분 5종)
 * - schedule_bases (기준: 전입일, 교배일 등)
 * - schedule_work_types (대분류 W01~W10)
 * - schedule_work_detail_types (세부 작업유형 예시)
 * - schedule_division_structures (구분별 적용 장소 매핑, structure_templates 존재 시)
 */
require('dotenv').config();
const { sequelize } = require('../config/database');
const {
    ScheduleDivision,
    ScheduleBase,
    ScheduleWorkType,
    ScheduleWorkDetailType,
    ScheduleDivisionStructure,
    StructureTemplate
} = require('../models');

const DIVISIONS = [
    { code: 'sow', name: '모돈', sortOrder: 0 },
    { code: 'boar', name: '옹돈', sortOrder: 1 },
    { code: 'piglet', name: '자돈', sortOrder: 2 },
    { code: 'non_breeding', name: '비번식돈', sortOrder: 3 },
    { code: 'facility', name: '시설', sortOrder: 4 }
];

const BASES = [
    { code: 'entry_date', name: '전입일', divisionId: null, sortOrder: 0 },
    { code: 'placement_date', name: '입식일', divisionId: null, sortOrder: 1 },
    { code: 'breeding_date', name: '교배일', divisionId: null, sortOrder: 2 },
    { code: 'abortion_date', name: '유산일', divisionId: null, sortOrder: 3 },
    { code: 'pregnancy_confirmed', name: '임신확정', divisionId: null, sortOrder: 4 },
    { code: 'estrus_date', name: '발정일', divisionId: null, sortOrder: 5 },
    { code: 'farrowing_date', name: '분만일', divisionId: null, sortOrder: 6 },
    { code: 'weaning_date', name: '이유일', divisionId: null, sortOrder: 7 }
];

const WORK_TYPES = [
    { code: 'W01', name: '이동', appliesToScope: 'pig', sortOrder: 0 },
    { code: 'W02', name: '사양', appliesToScope: 'pig', sortOrder: 1 },
    { code: 'W03', name: '번식', appliesToScope: 'pig', sortOrder: 2 },
    { code: 'W04', name: '질병', appliesToScope: 'pig', sortOrder: 3 },
    { code: 'W05', name: '환경', appliesToScope: 'facility', sortOrder: 4 },
    { code: 'W06', name: '위생', appliesToScope: 'facility', sortOrder: 5 },
    { code: 'W07', name: '점검', appliesToScope: 'both', sortOrder: 6 },
    { code: 'W08', name: '기록', appliesToScope: 'both', sortOrder: 7 },
    { code: 'W09', name: '도태', appliesToScope: 'both', sortOrder: 8 },
    { code: 'W10', name: '시설', appliesToScope: 'facility', sortOrder: 9 }
];

// 대분류 code → 세부 유형 예시 (name만, code는 생략 가능)
const DETAILS_BY_WORK_TYPE = {
    W01: ['교배사 이동', '임신사 이동', '분만사 이동', '격리사 이동', '출하 이동', '후보돈 편입'],
    W02: ['임신사료 전환', '포유사료 급여', '제한급이', '자유급이', '급수 점검', '체중 측정'],
    W03: ['교배 실시', '발정 확인', '임신확인', '재교배', '분만 준비', '분만 관리', '이유'],
    W04: ['예방접종', '항생제 투여', '구충', '개체 치료', '격리 조치', '건강검사'],
    W05: ['온도 조정', '환기 점검', '습도 관리', '조명 조절', '환풍기 점검', '히터 점검'],
    W06: ['돈방 세척', '고압세척', '소독', '분만사 준비 소독', '격리사 소독'],
    W07: ['임신확정 체크', '체형 점검', '발정 확인', '분만 예정 체크', '산차 기록 확인'],
    W08: ['교배일 등록', '분만일 등록', '폐사 등록', '유산 등록', '치료 기록 입력'],
    W09: ['계획 도태', '질병 도태', '산차 초과 도태', '출하'],
    W10: ['환기팬 수리', '급이기 점검', '음수기 점검', 'CCTV 점검', '조명 교체']
};

async function seedDivisions() {
    for (const row of DIVISIONS) {
        const [rec, created] = await ScheduleDivision.findOrCreate({
            where: { code: row.code },
            defaults: { name: row.name, sortOrder: row.sortOrder }
        });
        if (!created) await rec.update({ name: row.name, sortOrder: row.sortOrder });
        console.log(`  division: ${row.code} (${row.name})`);
    }
}

async function seedBases() {
    const divisions = await ScheduleDivision.findAll({ where: {}, order: [['sortOrder', 'ASC']] });
    const divByCode = {};
    divisions.forEach(d => { divByCode[d.code] = d.id; });
    for (const row of BASES) {
        const [rec, created] = await ScheduleBase.findOrCreate({
            where: { name: row.name },
            defaults: {
                divisionId: row.divisionId,
                sortOrder: row.sortOrder
            }
        });
        if (!created) await rec.update({ name: row.name, divisionId: row.divisionId, sortOrder: row.sortOrder });
        console.log(`  basis: ${row.name}`);
    }
}

async function seedWorkTypes() {
    for (const row of WORK_TYPES) {
        const [rec, created] = await ScheduleWorkType.findOrCreate({
            where: { code: row.code },
            defaults: {
                name: row.name,
                appliesToScope: row.appliesToScope,
                sortOrder: row.sortOrder
            }
        });
        if (!created) await rec.update({ name: row.name, appliesToScope: row.appliesToScope, sortOrder: row.sortOrder });
        console.log(`  workType: ${row.code} (${row.name}) ${row.appliesToScope}`);
    }
}

async function seedWorkDetailTypes() {
    const workTypes = await ScheduleWorkType.findAll({ order: [['sortOrder', 'ASC']] });
    const wtByCode = {};
    workTypes.forEach(w => { wtByCode[w.code] = w.id; });
    for (const w of workTypes) {
        const names = DETAILS_BY_WORK_TYPE[w.code] || [];
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const [rec, created] = await ScheduleWorkDetailType.findOrCreate({
                where: { workTypeId: w.id, name },
                defaults: { sortOrder: i }
            });
            if (!created) await rec.update({ sortOrder: i });
        }
        console.log(`  workDetailTypes for ${w.code}: ${names.length} items`);
    }
}

async function seedDivisionStructures() {
    const divisions = await ScheduleDivision.findAll({ order: [['sortOrder', 'ASC']] });
    const templates = await StructureTemplate.findAll({ where: { category: 'production' }, order: [['id', 'ASC']] });
    if (templates.length === 0) {
        console.log('  schedule_division_structures: structure_templates 없음, 스킵');
        return;
    }
    const byName = {};
    templates.forEach(t => { byName[t.name] = t.id; });
    // 설계 문서: 모돈→교배사,임신사,분만사,격리사,후보사 / 옹돈→웅돈사 / 자돈→분만사 / 비번식돈→자돈사,육성사,비육사 / 시설→전체
    const mapping = {
        sow: ['교배사', '임신돈사', '분만사(모돈)', '후보돈사'],
        boar: ['웅돈사'],
        piglet: ['분만사(모돈)'],
        non_breeding: ['자돈사(포유자돈)', '자돈사', '육성돈사', '비육돈사', '비육돈사(대형)'],
        facility: ['자돈사(포유자돈)', '자돈사', '육성돈사', '비육돈사', '비육돈사(대형)', '후보돈사', '교배사', '임신돈사', '분만사(모돈)', '웅돈사']
    };
    for (const div of divisions) {
        const names = mapping[div.code] || [];
        for (let i = 0; i < names.length; i++) {
            const tid = byName[names[i]];
            if (tid == null) continue;
            const [rec, created] = await ScheduleDivisionStructure.findOrCreate({
                where: { divisionId: div.id, structureTemplateId: tid },
                defaults: { sortOrder: i }
            });
            if (created) console.log(`    ${div.name} ↔ ${names[i]}`);
        }
    }
    console.log('  schedule_division_structures 완료');
}

async function main() {
    try {
        await sequelize.authenticate();
        console.log('DB connected');
        // 전역 일정 테이블이 없으면 생성 (sync는 누락된 테이블만 생성, 기존 테이블 변경 안 함)
        await sequelize.sync({ alter: false });
        console.log('Tables synced\n');

        console.log('1. schedule_divisions');
        await seedDivisions();
        console.log('2. schedule_bases');
        await seedBases();
        console.log('3. schedule_work_types');
        await seedWorkTypes();
        console.log('4. schedule_work_detail_types');
        await seedWorkDetailTypes();
        console.log('5. schedule_division_structures');
        await seedDivisionStructures();

        console.log('\n✅ 전역 일정 마스터 시드 완료');
    } catch (e) {
        console.error('Error:', e);
        throw e;
    } finally {
        await sequelize.close();
    }
}

main();
