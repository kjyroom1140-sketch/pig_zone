const { Sequelize } = require('sequelize');
require('dotenv').config();

// PostgreSQL 연결 설정
const sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'pig_farm_db',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || 'postgres',
    {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// 연결 테스트
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL 연결 성공');
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL 연결 실패:', error.message);
        return false;
    }
}

// 데이터베이스 동기화
// 데이터베이스 동기화
async function syncDatabase() {
    try {
        await sequelize.sync({ alter: false });
        console.log('✅ 데이터베이스 동기화 완료');
    } catch (error) {
        console.error('❌ 데이터베이스 동기화 실패:', error);
    }
}

module.exports = {
    sequelize,
    testConnection,
    syncDatabase
};
