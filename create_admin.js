const { User } = require('./models');
require('dotenv').config();

async function createSuperAdmin() {
    try {
        // 기존 사용자 확인
        const existingUser = await User.findOne({ where: { username: 'admin' } });

        if (existingUser) {
            console.log('⚠️  "admin" 사용자가 이미 존재합니다.');
            console.log('사용자 정보:', existingUser.toJSON());
            return;
        }

        // 최고 관리자 생성
        const admin = await User.create({
            username: 'admin',
            email: 'admin@pigfarm.com',
            password: 'admin12345', // 자동으로 해싱됨
            fullName: '시스템 관리자',
            phone: '010-0000-0000',
            systemRole: 'super_admin'
        });

        console.log('✅ 최고 관리자 계정이 생성되었습니다!');
        console.log('');
        console.log('📋 로그인 정보:');
        console.log('   사용자명: admin');
        console.log('   비밀번호: admin12345');
        console.log('   권한: super_admin');
        console.log('');
        console.log('🔗 로그인 URL: http://localhost:3000');
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

createSuperAdmin();
