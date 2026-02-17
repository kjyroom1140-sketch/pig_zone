const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { testConnection, syncDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const farmsRoutes = require('./routes/farms');
const farmStaffRoutes = require('./routes/farmStaff');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24시간
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/farms', require('./routes/farmScheduleItems')); // :farmId/schedule-items
app.use('/api/farms', require('./routes/farmScheduleTaskTypes')); // :farmId/schedule-task-types
app.use('/api/farms', require('./routes/farmScheduleBasisTypes')); // :farmId/schedule-basis-types
app.use('/api/farms', farmsRoutes);
app.use('/api/farms', farmStaffRoutes); // /:farmId/staff 관련 직원 관리 API
app.use('/api/breeds', require('./routes/breeds'));
app.use('/api/feedTypes', require('./routes/feedTypes'));
app.use('/api/vaccineTypes', require('./routes/vaccineTypes'));
app.use('/api/diseaseCodes', require('./routes/diseaseCodes'));
const structureTemplatesRouter = require('./routes/structureTemplates');
app.post('/api/structureTemplates/reorder', structureTemplatesRouter.handleReorder);
app.use('/api/structureTemplates', structureTemplatesRouter);
app.use('/api/scheduleTaskTypes', require('./routes/scheduleTaskTypes'));
app.use('/api/scheduleBasisTypes', require('./routes/scheduleBasisTypes'));
app.use('/api/scheduleItems', require('./routes/scheduleItems'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/farm-structure', require('./routes/farmStructure'));
app.use('/api/farm-facilities', require('./routes/farmFacilities')); // 새로운 농장 시설 관리 API


// 루트 경로 - 역할에 따라 리다이렉트
app.get('/', (req, res) => {
    if (req.session.userId) {
        // system_admin은 시스템 관리자 페이지로, 그 외에는 농장 선택 페이지로
        if (req.session.systemRole === 'system_admin') {
            res.redirect('/admin.html');
        } else {
            res.redirect('/select-farm.html');
        }
    } else {
        res.redirect('/login.html');
    }
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

// 에러 처리
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
async function startServer() {
    try {
        // 데이터베이스 연결 테스트
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ 데이터베이스 연결 실패. 서버를 시작할 수 없습니다.');
            process.exit(1);
        }

        // 데이터베이스 동기화
        await syncDatabase();

        // 서버 시작
        app.listen(PORT, () => {
            console.log('');
            console.log('🐷 ========================================');
            console.log('   양돈농장 관리 시스템 서버 시작');
            console.log('========================================');
            console.log(`📡 서버 주소: http://localhost:${PORT}`);
            console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📦 데이터베이스: ${process.env.POSTGRES_DB}`);
            console.log('========================================');
            console.log('');
        });

    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

startServer();
