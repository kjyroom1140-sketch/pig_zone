/**
 * 자돈사 돼지 관리 일정 15건 추가 (전입일/출생일 기준, 일령 숫자)
 * 실행: node scripts/seed_schedule_nursery_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 대상장소, 기준, dayStart, dayEnd, ageLabel, 작업유형, 작업내용 ]
const ROWS = [
    ['자돈사', '전입일', '0', '0', '21~28', '이동', '자돈사 전입'],
    ['자돈사', '전입일', '0', '0', '', '환경', '온·습도 초기 설정'],
    ['자돈사', '전입일', '0', '0', '', '이동', '군 편성'],
    ['자돈사', '전입일', '0', '1', '', '관리', '약자돈 선별'],
    ['자돈사', '전입일', '1', '3', '', '관찰', '이유 스트레스·설사 관찰'],
    ['자돈사', '전입일', '1', '3', '', '사양', '급수·급이 적응 확인'],
    ['자돈사', '출생일', '21', '21', '21', '예방접종', 'PCV2 2차'],
    ['자돈사', '출생일', '21', '21', '21', '예방접종', '마이코플라즈마 2차'],
    ['자돈사', '출생일', '28', '28', '28', '예방접종', '흉막폐렴(APP)'],
    ['자돈사', '출생일', '35', '35', '35', '예방접종', '위축성 비염(AR)'],
    ['자돈사', '전입일', '7', '7', '28~35', '측정', '체중(표본) 측정'],
    ['자돈사', '전입일', '10', '14', '31~42', '이동', '분군(체중 기준)'],
    ['자돈사', '전입일', '14', '14', '35~42', '관리', '성장 균일도 재평가'],
    ['자돈사', '전입일', '21', '21', '42~49', '준비', '육성사 전입 준비'],
    ['자돈사', '전입일', '종료', '종료', '50~60', '이동', '육성사 전입']
];

function parseDayRange(startStr, endStr) {
    let dayMin = null, dayMax = null;
    const s = String(startStr || '').trim();
    const e = String(endStr || '').trim();
    if (s === '종료' || s === '') {
        if (s === '종료') return { dayMin: null, dayMax: null };
        if (s === '' && e === '') return { dayMin: null, dayMax: null };
    }
    const nMin = parseInt(s, 10);
    if (!Number.isNaN(nMin)) dayMin = nMin;
    if (e !== '' && e !== '종료') {
        const nMax = parseInt(e, 10);
        if (!Number.isNaN(nMax)) dayMax = nMax;
    }
    if (dayMin != null && dayMax == null && e === '') dayMax = dayMin;
    return { dayMin, dayMax };
}

async function ensureTaskType(name, code) {
    const [row] = await ScheduleTaskType.findOrCreate({
        where: { name },
        defaults: { code: code || name.replace(/\s/g, '_').toUpperCase(), name, sortOrder: 99 }
    });
    return row.id;
}

async function run() {
    try {
        await sequelize.authenticate();

        const structure = await StructureTemplate.findOne({ where: { name: '자돈사' } });
        if (!structure) {
            console.error('자돈사(structure_templates)가 없습니다.');
            process.exit(1);
        }
        const structureTemplateId = structure.id;

        const basisEntry = await ScheduleBasisType.findOne({ where: { name: '전입일' } });
        const basisBirth = await ScheduleBasisType.findOne({ where: { name: '출생일' } });
        if (!basisEntry || !basisBirth) {
            console.error('전입일 또는 출생일(schedule_basis_types)이 없습니다.');
            process.exit(1);
        }
        const basisIds = { '전입일': basisEntry.id, '출생일': basisBirth.id };

        const taskNames = ['이동', '환경', '관리', '관찰', '사양', '예방접종', '측정', '준비'];
        const taskCodes = { 이동: 'MOVE', 환경: 'ENV', 관리: 'MANAGE', 관찰: 'OBSERVE', 사양: 'FEED', 예방접종: 'VACCINE', 측정: 'MEASURE', 준비: 'PREP' };
        const taskIds = {};
        for (const name of taskNames) {
            taskIds[name] = await ensureTaskType(name, taskCodes[name]);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [structName, basisName, dayStart, dayEnd, ageLabelRaw, taskName, description] of ROWS) {
            const { dayMin, dayMax } = parseDayRange(dayStart, dayEnd);
            const basisTypeId = basisIds[basisName];
            const taskTypeId = taskIds[taskName];
            const ageLabel = (ageLabelRaw || '').trim() || null;
            if (!basisTypeId || !taskTypeId) {
                console.warn(`   건너뜀: ${basisName}, ${taskName}`);
                continue;
            }

            const exists = await ScheduleItem.findOne({
                where: {
                    targetType: 'pig',
                    structureTemplateId,
                    basisTypeId,
                    taskTypeId,
                    dayMin: dayMin ?? null,
                    dayMax: dayMax ?? null,
                    description
                }
            });
            if (exists) {
                console.log(`   이미 존재: ${description}`);
                continue;
            }

            await ScheduleItem.create({
                targetType: 'pig',
                structureTemplateId,
basisTypeId,
                ageLabel,
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: ++maxSort,
                isActive: true
            });
            created++;
        }

        console.log(`\n✅ 자돈사 일정 15건 반영 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
