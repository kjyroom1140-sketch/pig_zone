const { StructureTemplate } = require('../models');
const { sequelize } = require('../config/database');

async function checkAndSeedTemplates() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const count = await StructureTemplate.count();
        console.log(`Current template count: ${count}`);

        if (count === 0) {
            console.log('Seeding initial templates...');
            const templates = [
                { category: 'production', name: '임신사', description: '임신한 모돈을 사육하는 시설' },
                { category: 'production', name: '분만사', description: '분만 및 포유 기간의 모돈과 자돈을 사육하는 시설' },
                { category: 'production', name: '자돈사', description: '이유한 자돈을 사육하는 시설' },
                { category: 'production', name: '육성사', description: '육성돈을 사육하는 시설' },
                { category: 'production', name: '비육사', description: '출하 전 비육돈을 사육하는 시설' },
                { category: 'production', name: '후보사', description: '후보돈을 사육하는 시설' },
                { category: 'production', name: '웅돈사', description: '웅돈(수퇘지)을 사육하는 시설' },
                { category: 'general', name: '관리사', description: '관리자가 머무는 시설' },
                { category: 'general', name: '창고', description: '물품 보관소' },
                { category: 'general', name: '분뇨처리장', description: '가축 분뇨 처리 시설' }
            ];

            await StructureTemplate.bulkCreate(templates);
            console.log('✅ Initial templates seeded.');
        } else {
            console.log('Templates already exist. Skipping seed.');
        }

    } catch (error) {
        console.error('Error checking templates:', error);
    } finally {
        await sequelize.close();
    }
}

checkAndSeedTemplates();
