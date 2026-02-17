const { Role } = require('../models');
const { sequelize } = require('../config/database');

/**
 * 기본 직책(Role) 데이터를 roles 테이블에 저장하는 스크립트
 *
 *  - FARM_ADMIN   / 농장장
 *  - OPERATOR     / 생산관리자
 *  - STAFF        / 사육사
 *  - MAINTENANCE  / 시설담당
 *  - ACCOUNTING   / 사무/회계
 */
async function seedDefaultRoles() {
    try {
        console.log('🔄 기본 직책(Role) 데이터 저장 중...\n');

        const defaultRoles = [
            {
                code: 'FARM_ADMIN',
                name: '농장장',
                description: '농장의 최고 책임자 (농장 관리자)',
                level: 10,
                isDefault: false
            },
            {
                code: 'OPERATOR',
                name: '생산관리자',
                description: '생산 전반을 관리하는 관리자',
                level: 20,
                isDefault: false
            },
            {
                code: 'STAFF',
                name: '사육사',
                description: '일반 사육 담당 직원',
                level: 30,
                isDefault: true
            },
            {
                code: 'MAINTENANCE',
                name: '시설담당',
                description: '시설 유지보수 담당',
                level: 40,
                isDefault: false
            },
            {
                code: 'ACCOUNTING',
                name: '사무/회계',
                description: '사무 및 회계 담당',
                level: 50,
                isDefault: false
            }
        ];

        for (const item of defaultRoles) {
            const [role, created] = await Role.findOrCreate({
                where: { code: item.code },
                defaults: {
                    name: item.name,
                    description: item.description,
                    level: item.level,
                    isDefault: item.isDefault,
                    isActive: true
                }
            });

            if (!created) {
                await role.update({
                    name: item.name,
                    description: item.description,
                    level: item.level,
                    isDefault: item.isDefault,
                    isActive: true
                });
                console.log(`♻️  기존 직책 업데이트: ${item.code} (${item.name})`);
            } else {
                console.log(`✅ 새 직책 추가: ${item.code} (${item.name})`);
            }
        }

        await sequelize.close();
        console.log('\n🎉 기본 직책 데이터 저장 완료');
        process.exit(0);
    } catch (error) {
        console.error('❌ 기본 직책 데이터 저장 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

seedDefaultRoles();

