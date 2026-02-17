/**
 * 일정관리 준비 자료(돼지/시설 8개 구역) 기준 schedule_task_types + structure_templates + schedule_items 시드
 *
 * - 구분: pig(돼지), facility(시설)
 * - 대상장소: 분만사, 자돈사, 육성사, 비육사, 후보돈사, 교배사, 임신사, 웅돈사
 * - 기준: 전입일, 출산일, 출생일, 이유일, 교배일, 매일, 주 1회, 전입, 종료, 출하후 등
 *
 * 실행: node scripts/seed_schedule_from_image.js
 */
const { ScheduleTaskType, ScheduleBasisType, ScheduleItem, StructureTemplate } = require('../models');
const { sequelize } = require('../config/database');

// 날짜 문자열 파싱: "0", "1-12", "1~3", "90 이상", "이벤트", "-" → { dayMin, dayMax }
function parseDayRange(startStr, endStr) {
    const parse = (str) => {
        if (str == null || str === '' || str === '-' || str === '－') return null;
        const s = String(str).trim();
        if (/^이벤트|전입|종료|출하|분만$/i.test(s)) return null;
        const above = s.match(/^(\d+)\s*이상$/);
        if (above) return { dayMin: parseInt(above[1], 10), dayMax: null };
        if (s.includes('~')) {
            const [a, b] = s.split('~').map(x => parseInt(String(x).trim(), 10));
            return { dayMin: isNaN(a) ? null : a, dayMax: isNaN(b) ? null : b };
        }
        if (s.includes('-') && !s.startsWith('-')) {
            const [a, b] = s.split('-').map(x => parseInt(String(x).trim(), 10));
            return { dayMin: isNaN(a) ? null : a, dayMax: isNaN(b) ? null : b };
        }
        const n = parseInt(s, 10);
        return isNaN(n) ? null : { dayMin: n, dayMax: n };
    };
    const start = parse(startStr);
    const end = parse(endStr);
    if (start && end) {
        return { dayMin: start.dayMin, dayMax: end.dayMax !== undefined && end.dayMax !== null ? end.dayMax : start.dayMax };
    }
    if (start) return { dayMin: start.dayMin, dayMax: start.dayMax };
    return { dayMin: null, dayMax: null };
}

// 시드 재실행 시 기존 일정 항목이 있으면 중복 생성됨. 필요 시 DB에서 schedule_items 비운 뒤 실행.

const TASK_TYPES = [
    { code: 'ENV', name: '환경', sortOrder: 1 },
    { code: 'FARROW', name: '분만', sortOrder: 2 },
    { code: 'HYGIENE', name: '위생', sortOrder: 3 },
    { code: 'MGMT', name: '관리', sortOrder: 4 },
    { code: 'FEED', name: '사양', sortOrder: 5 },
    { code: 'DISEASE', name: '질병', sortOrder: 6 },
    { code: 'OBSERVE', name: '관찰', sortOrder: 7 },
    { code: 'VACCINE', name: '예방접종', sortOrder: 8 },
    { code: 'MOVE', name: '이동', sortOrder: 9 }
];

// 기준 유형 (schedule_basis_types)
const BASIS_TYPES = [
    { code: 'ENTRY_DAY', name: '전입일', sortOrder: 1 },
    { code: 'FARROWING_DAY', name: '출산일', sortOrder: 2 },
    { code: 'BIRTH_DAY', name: '출생일', sortOrder: 3 },
    { code: 'WEANING_DAY', name: '이유일', sortOrder: 4 },
    { code: 'MATING_DAY', name: '교배일', sortOrder: 5 },
    { code: 'DAILY', name: '매일', sortOrder: 6 },
    { code: 'WEEKLY', name: '주 1회', sortOrder: 7 },
    { code: 'EVENT_ENTRY', name: '전입', sortOrder: 8 },
    { code: 'EVENT_END', name: '종료', sortOrder: 9 },
    { code: 'EVENT_SHIP', name: '출하후', sortOrder: 10 }
];

// 대상장소 8개 구역 (돼지/시설 공통)
const STRUCTURE_NAMES = [
    '분만사', '자돈사', '육성사', '비육사', '후보돈사', '교배사', '임신사', '웅돈사'
];

// [ targetType, structureName, basisType, dayStartStr, dayEndStr, taskTypeName, description ]
const SCHEDULE_ROWS = [
    // ----- 돼지 · 분만사(포유사) -----
    ['pig', '분만사', '전입일', '0', '0', '환경', '분만사 전입 시 환경 점검'],
    ['pig', '분만사', '전입일', '0', '7', '사양', '사료 급여 및 급수 확인'],
    ['pig', '분만사', '전입일', '0', '12', '위생', '분만사 내 위생 관리'],
    ['pig', '분만사', '출산일', '105', '105', '환경', '분만틀 세팅'],
    ['pig', '분만사', '출산일', '107', '107', '분만', '출산 예정일'],
    ['pig', '분만사', '출산일', '110', '110', '위생', '분만 전 세척'],
    ['pig', '분만사', '출산일', '110', '110', '관찰', '유방 발달 상태 확인'],
    ['pig', '분만사', '출산일', '110', '110', '사양', '사료량 감량 시작'],
    ['pig', '분만사', '출산일', '110', '110', '관리', '변비 예방 관리'],
    ['pig', '분만사', '출산일', '111', '112', '관찰', '분만 징후·진행 상태 관찰'],
    ['pig', '분만사', '출산일', '112', '112', '위생', '외음부·분만틀 정리'],
    ['pig', '분만사', '출산일', '112', '112', '분만', '분만 확인 및 기록'],
    ['pig', '분만사', '출산일', '112', '112', '환경', '체온 유지(보온등/매트)'],
    ['pig', '분만사', '출산일', '112', '112', '관찰', '초유 섭취 확인'],
    ['pig', '분만사', '출산일', '112', '112', '질병', '철분 주사'],
    ['pig', '분만사', '출산일', '112', '116', '질병', '유방염·자궁염 점검'],
    ['pig', '분만사', '출산일', '112', '116', '사양', '사료 점진적 증량'],
    ['pig', '분만사', '출산일', '112', '116', '관찰', '식욕·체온·체형 회복·발정 회복 관찰'],
    ['pig', '분만사', '출생일', '0', '0', '예방접종', 'PCV2 1차·마이코플라즈마 폐렴 1차'],
    ['pig', '분만사', '출생일', '1', '7', '사양', '음수대 접근 유도·크립피드'],
    ['pig', '분만사', '출생일', '21', '21', '이동', '이유(자돈 분리)'],
    // ----- 돼지 · 자돈사 -----
    ['pig', '자돈사', '이유일', '0', '0', '관리', '이유일 기록 및 전입 배치'],
    ['pig', '자돈사', '이유일', '0', '7', '환경', '온도·습도 관리'],
    ['pig', '자돈사', '이유일', '0', '14', '사양', '사료 전환·급이 관리'],
    ['pig', '자돈사', '이유일', '0', '21', '위생', '돈사 내 위생·소독'],
    ['pig', '자돈사', '이유일', '7', '7', '예방접종', '필요 시 2차 접종'],
    ['pig', '자돈사', '이유일', '14', '14', '관찰', '발육·건강 상태 점검'],
    // ----- 돼지 · 육성사 -----
    ['pig', '육성사', '전입일', '0', '0', '관리', '전입일 기록 및 검역 구역 배치'],
    ['pig', '육성사', '전입일', '0', '14', '관찰', '건강 상태·사료 섭취 관찰'],
    ['pig', '육성사', '전입일', '0', '30', '환경', '환경·환기 관리'],
    ['pig', '육성사', '전입일', '0', '60', '사양', '사료 단계별 전환'],
    ['pig', '육성사', '전입일', '14', '14', '예방접종', '육성 구간 접종'],
    // ----- 돼지 · 비육사 -----
    ['pig', '비육사', '전입일', '0', '0', '관리', '전입일 기록'],
    ['pig', '비육사', '전입일', '0', '90', '사양', '비육 사료 급여 관리'],
    ['pig', '비육사', '전입일', '0', '90', '질병', '질병·건강 관리'],
    ['pig', '비육사', '전입일', '90 이상', '', '관찰', '출하 적기 판단·체중 확인'],
    // ----- 돼지 · 후보돈사 -----
    ['pig', '후보돈사', '전입일', '0', '0', '관리', '전입일 기록 및 검역'],
    ['pig', '후보돈사', '전입일', '0', '30', '환경', '환경·사양 관리'],
    ['pig', '후보돈사', '전입일', '14', '14', '예방접종', '후보돈 전용 접종'],
    // ----- 돼지 · 교배사 -----
    ['pig', '교배사', '전입일', '0', '0', '관리', '전입일 기록'],
    ['pig', '교배사', '전입일', '0', '7', '환경', '환경·위생 관리'],
    ['pig', '교배사', '교배일', '0', '0', '관찰', '교배일 기록'],
    ['pig', '교배사', '교배일', '0', '21', '관찰', '발정·재귀발정 관찰'],
    // ----- 돼지 · 임신사 -----
    ['pig', '임신사', '전입일', '0', '0', '관리', '전입일 기록'],
    ['pig', '임신사', '전입일', '0', '90', '환경', '환경·위생 관리'],
    ['pig', '임신사', '전입일', '0', '90', '사양', '임신 단계별 사료 급여'],
    ['pig', '임신사', '전입일', '30', '30', '예방접종', '임신 중 접종'],
    ['pig', '임신사', '전입일', '60', '60', '예방접종', '임신 중 2차 접종'],
    // ----- 돼지 · 웅돈사 -----
    ['pig', '웅돈사', '전입일', '0', '0', '관리', '전입일 기록'],
    ['pig', '웅돈사', '전입일', '0', '0', '환경', '환경·사양 관리'],
    ['pig', '웅돈사', '전입일', '0', '0', '예방접종', '웅돈 접종 관리'],
    // ----- 시설 · 분만사 -----
    ['facility', '분만사', '매일', '0', '0', '환경', '온도·습도·환기 점검'],
    ['facility', '분만사', '매일', '0', '0', '위생', '분만사 일일 소독·청소'],
    ['facility', '분만사', '매일', '0', '0', '사양', '사료·급수 시설 점검'],
    ['facility', '분만사', '주 1회', '0', '0', '위생', '주간 소독·정리'],
    ['facility', '분만사', '전입', null, null, '관리', '전입 시 시설 점검·준비'],
    ['facility', '분만사', '종료', null, null, '위생', '종료 후 세척·소독'],
    // ----- 시설 · 자돈사 -----
    ['facility', '자돈사', '매일', '0', '0', '환경', '온도·습도 관리'],
    ['facility', '자돈사', '매일', '0', '0', '사양', '사료·급수 시설 점검'],
    ['facility', '자돈사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '자돈사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '자돈사', '종료', null, null, '위생', '종료 후 세척·소독'],
    // ----- 시설 · 육성사 -----
    ['facility', '육성사', '매일', '0', '0', '환경', '환기·온도 점검'],
    ['facility', '육성사', '매일', '0', '0', '사양', '사료·급수 시설 점검'],
    ['facility', '육성사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '육성사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '육성사', '종료', null, null, '위생', '종료 후 세척·소독'],
    // ----- 시설 · 비육사 -----
    ['facility', '비육사', '매일', '0', '0', '환경', '환기·온도 점검'],
    ['facility', '비육사', '매일', '0', '0', '사양', '사료·급수 시설 점검'],
    ['facility', '비육사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '비육사', '출하후', null, null, '위생', '출하 후 전면 세척·소독'],
    ['facility', '비육사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '비육사', '종료', null, null, '위생', '종료 후 세척·소독'],
    // ----- 시설 · 후보돈사·교배사·임신사·웅돈사 -----
    ['facility', '후보돈사', '매일', '0', '0', '환경', '환경 점검'],
    ['facility', '후보돈사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '후보돈사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '후보돈사', '종료', null, null, '위생', '종료 후 세척·소독'],
    ['facility', '교배사', '매일', '0', '0', '환경', '환경 점검'],
    ['facility', '교배사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '교배사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '교배사', '종료', null, null, '위생', '종료 후 세척·소독'],
    ['facility', '임신사', '매일', '0', '0', '환경', '환경 점검'],
    ['facility', '임신사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '임신사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '임신사', '종료', null, null, '위생', '종료 후 세척·소독'],
    ['facility', '웅돈사', '매일', '0', '0', '환경', '환경 점검'],
    ['facility', '웅돈사', '주 1회', '0', '0', '위생', '주간 소독'],
    ['facility', '웅돈사', '전입', null, null, '관리', '전입 시 시설 준비'],
    ['facility', '웅돈사', '종료', null, null, '위생', '종료 후 세척·소독']
];

async function ensureBasisTypes() {
    const map = {};
    for (const b of BASIS_TYPES) {
        const [row] = await ScheduleBasisType.findOrCreate({
            where: { code: b.code },
            defaults: { name: b.name, sortOrder: b.sortOrder }
        });
        map[b.name] = row.id;
    }
    return map;
}

async function ensureStructureTemplates() {
    const map = {};
    for (const name of STRUCTURE_NAMES) {
        const [row] = await StructureTemplate.findOrCreate({
            where: { name },
            defaults: { name, category: 'production', description: `일정 대상장소: ${name}` }
        });
        map[name] = row.id;
    }
    return map;
}

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB 연결 확인\n');

        console.log('📋 schedule_task_types 시드...');
        const taskTypeByName = {};
        for (const t of TASK_TYPES) {
            const [row] = await ScheduleTaskType.findOrCreate({
                where: { code: t.code },
                defaults: { name: t.name, sortOrder: t.sortOrder }
            });
            taskTypeByName[t.name] = row.id;
        }
        console.log(`   ${TASK_TYPES.length}개 작업 유형 반영\n`);

        console.log('📌 schedule_basis_types 시드...');
        const basisTypeIdByName = await ensureBasisTypes();
        console.log(`   ${BASIS_TYPES.length}개 기준 유형 반영\n`);

        console.log('🏗️ structure_templates 시드(8개 구역)...');
        const structIdByName = await ensureStructureTemplates();
        console.log('   완료\n');

        console.log('📅 schedule_items 시드...');
        let created = 0;
        for (let i = 0; i < SCHEDULE_ROWS.length; i++) {
            const [targetType, structName, basisTypeName, dayStartStr, dayEndStr, taskTypeName, description] = SCHEDULE_ROWS[i];
            const taskTypeId = taskTypeByName[taskTypeName];
            const structureTemplateId = structIdByName[structName] || null;
            const basisTypeId = basisTypeIdByName[basisTypeName] || null;
            const { dayMin, dayMax } = parseDayRange(dayStartStr, dayEndStr);

            if (!taskTypeId) {
                console.warn(`   [${i + 1}] 작업유형 없음: ${taskTypeName}`);
                continue;
            }

            await ScheduleItem.create({
                targetType,
                structureTemplateId,
                basisTypeId,
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: i + 1,
                isActive: true
            });
            created++;
        }
        console.log(`   ${SCHEDULE_ROWS.length}건 처리, 신규 ${created}건\n`);

        console.log('✅ 시드 완료.');
    } catch (err) {
        console.error('❌ 시드 실패:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

seed();
