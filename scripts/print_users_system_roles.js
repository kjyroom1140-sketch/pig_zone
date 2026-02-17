const { User } = require('../models');
const { sequelize } = require('../config/database');

/**
 * users 테이블의 username / systemRole 을 출력하는 간단한 스크립트입니다.
 *
 * 사용법:
 *   1) PowerShell에서 프로젝트 폴더로 이동
 *        cd D:\webviewer
 *   2) 스크립트 실행
 *        node scripts\print_users_system_roles.js
 */
async function main() {
    try {
        console.log('📋 users.systemRole 현황\n');

        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'systemRole'],
            order: [['createdAt', 'ASC']]
        });

        if (!users.length) {
            console.log('사용자가 없습니다.');
        } else {
            users.forEach(u => {
                console.log(
                    `- username: ${u.username}, systemRole: ${u.systemRole}, email: ${u.email}, id: ${u.id}`
                );
            });
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ users.systemRole 조회 오류:', error);
        await sequelize.close();
        process.exit(1);
    }
}

main();

