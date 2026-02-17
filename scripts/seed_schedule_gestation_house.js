/**
 * 임신사 돼지 관리 일정 보완 (기존 시드 + 전입 후 관찰·분만사 이동 등)
 * 실행: node scripts/seed_schedule_gestation_house.js
 */
const { sequelize } = require('../config/database');
const { ScheduleItem, StructureTemplate, ScheduleBasisType, ScheduleTaskType } = require('../models');

// [ 기준명, dayMin, dayMax, 작업유형명, 작업내용 ] — 기존과 겹치지 않는 보완 항목
const ROWS = [
    ['전입일', '0', '7', '관찰', '전입 후 스트레스·적응 관찰'],
    ['전입일', '0', '14', '관찰', '건강 상태·사료 섭취 관찰'],
    ['전입일', '80', '90', '관리', '분만사 전입 준비·체중 점검'],
    ['전입일', '85', '90', '이동', '분만사 이동']
];

async function run() {
    try {
        await sequelize.authenticate();

        const structure = await StructureTemplate.findOne({ where: { name: '임신사' } });
        if (!structure) {
            console.error('임신사(structure_templates)가 없습니다.');
            process.exit(1);
        }
        const structureTemplateId = structure.id;

        const basis = await ScheduleBasisType.findOne({ where: { name: '전입일' } });
        if (!basis) {
            console.error('전입일(schedule_basis_types)이 없습니다.');
            process.exit(1);
        }
        const basisTypeId = basis.id;

        const taskTypes = await ScheduleTaskType.findAll({ where: { name: ['관찰', '관리', '이동'] } });
        const taskById = {};
        taskTypes.forEach(t => { taskById[t.name] = t.id; });
        if (!taskById['관찰'] || !taskById['관리'] || !taskById['이동']) {
            console.error('작업 유형(관찰/관리/이동) 중 누락이 있습니다.');
            process.exit(1);
        }

        let maxSort = (await ScheduleItem.max('sortOrder')) || 0;
        let created = 0;

        for (const [basisName, dayStart, dayEnd, taskName, description] of ROWS) {
            const dayMin = dayStart != null && dayStart !== '' ? parseInt(dayStart, 10) : null;
            const dayMax = dayEnd != null && dayEnd !== '' ? parseInt(dayEnd, 10) : (dayMin != null ? dayMin : null);
            const taskTypeId = taskById[taskName];
            if (!taskTypeId) continue;

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
                dayMin,
                dayMax,
                taskTypeId,
                description,
                sortOrder: ++maxSort,
                isActive: true
            });
            created++;
        }

        console.log(`\n✅ 임신사 일정 보완 완료. 신규 ${created}건 추가.\n`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
