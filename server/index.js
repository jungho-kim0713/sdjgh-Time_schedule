const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // 프론트엔드와의 통신 허용
app.use(express.json()); // JSON 요청 본문 파싱

// 상태 확인용 간단한 API 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '서대전여고 시간표 백엔드 서버가 정상 작동중입니다!' });
});

// ─── 인증 미들웨어 ────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_schedule_key_2026';

// 1. 로그인 여부 확인용 미들웨어
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, message: '인증 토큰이 제공되지 않았습니다.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
        req.user = user;
        next();
    });
}

// 2. 최고 관리자 권한 확인용 미들웨어
function isAdmin(req, res, next) {
    if (req.user && req.user.role.trim() === '관리자') {
        next();
    } else {
        res.status(403).json({ success: false, message: '최고 관리자 권한이 필요합니다.' });
    }
}

// 3. 시간표 수정 권한 확인용 미들웨어 (학생 제외)
function canEditSchedule(req, res, next) {
    const role = req.user && req.user.role.trim();
    if (role && role !== '학생') {
        next();
    } else {
        res.status(403).json({ success: false, message: '시간표 수정 권한이 없습니다.' });
    }
}
// ─────────────────────────────────────────────────────────────────────────

const { sheets } = require('./services/googleAuth');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const MASTER_SPREADSHEET_ID = process.env.SPREADSHEET_MASTER_ID;

const NodeCache = require('node-cache');
// stdTTL: 300초(5분) 동안 메모리에 데이터 유지 (API 호출량 획기적 감소)
const appCache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

// 유틸리티 함수: 2차원 배열 데이터를 배열 오브젝트로 파싱 (첫 줄을 key로 사용)
function parseSheetData(values) {
    if (!values || values.length < 2) return [];
    const headers = values[0];
    const rows = values.slice(1);
    return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

// 종합 메인 데이터(프론트엔드 테이블 및 필터 렌더용) fetching API (인증 필요)
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const cacheKey = 'allSheetData';
        const cachedData = appCache.get(cacheKey);
        
        if (cachedData) {
            return res.json({
                success: true,
                data: cachedData
            });
        }
        
        console.log('📡 구글 스프레드시트 API를 호출합니다 (캐시 없음)...');
        // 학기별 시트 (배치 조회)
        const ranges = ["'강좌_마스터'!A:G", "'교사_명렬표'!A:H", "'기준_시간표'!A:D", "'일별_시간표'!A:G", "'학생_명렬표'!A:N"];
        const [response, masterResponse] = await Promise.all([
            sheets.spreadsheets.values.batchGet({
                spreadsheetId: SPREADSHEET_ID,
                ranges: ranges
            }),
            // 사용자_관리는 마스터 시트에서 별도 조회
            sheets.spreadsheets.values.get({
                spreadsheetId: MASTER_SPREADSHEET_ID,
                range: "'사용자_관리'!A:F"
            })
        ]);

        const valueRanges = response.data.valueRanges;
        
        const courses = parseSheetData(valueRanges[0].values); // 강좌_마스터
        const teachers = parseSheetData(valueRanges[1].values); // 교사_명렬표
        const baseSchedules = parseSheetData(valueRanges[2].values); // 기준_시간표
        const dailySchedules = parseSheetData(valueRanges[3].values); // 일별_시간표
        const students = parseSheetData(valueRanges[4].values); // 학생_명렬표
        const users = parseSheetData(masterResponse.data.values || []); // 사용자_관리 (마스터 시트)

        const dataToCache = { courses, teachers, baseSchedules, dailySchedules, students, users };
        appCache.set(cacheKey, dataToCache);

        res.json({
            success: true,
            data: dataToCache
        });

    } catch (error) {
        console.error("데이터 조회 에러:", error);
        res.status(500).json({ success: false, message: '구글 스프레드시트 조회에 실패했습니다.' });
    }
});

// 시간표 변경 승인 및 DB 저장(Append) 로직 (인증 필요, 학생 제외)
app.post('/api/schedule/update', authenticateToken, canEditSchedule, async (req, res) => {
    try {
        const { payloads } = req.body;
        if (!payloads || payloads.length === 0) {
           return res.status(400).json({ success: false, message: '전달된 payload가 없습니다' });
        }

        const values = payloads.map(p => [
            p.date, String(p.period), p.courseCode, p.sourceTeacher, p.targetTeacher, p.status, p.reason || '사유 없음'
        ]);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "'일별_시간표'!A:G",
            valueInputOption: "USER_ENTERED",
            resource: { values: values }
        });

        // 🌟 수정이 발생했으므로 캐시를 강제 초기화 (다음 조회 시 구글 시트에서 새로 읽어옴)
        appCache.del('allSheetData');

        res.json({ success: true, message: '일별_시간표 DB 누적 처리가 완료되었습니다.' });
    } catch (error) {
        console.error('업데이트 저장 에러:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 관리자 전용: 캐시 강제 초기화 (구글 시트 직접 수정 후 사용)
app.post('/api/admin/clear-cache', authenticateToken, isAdmin, (req, res) => {
    appCache.del('allSheetData');
    console.log('🗑️ 관리자 요청으로 캐시가 초기화되었습니다.');
    res.json({ success: true, message: '캐시가 초기화되었습니다. 다음 조회 시 구글 시트에서 최신 데이터를 불러옵니다.' });
});

// 사용자 판별 및 상태/권한 업데이트 로직 (관리자만 가능)
app.post('/api/users/update', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { email, role, status } = req.body;
        
        // 1. 마스터 시트에서 사용자_관리 데이터 가져오기
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: "'사용자_관리'!A:F"
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: '사용자 데이터를 찾을 수 없습니다.' });
        }

        // 2. 이메일(A열) 기반으로 해당 사용자의 행(Row) 번호 찾기 (헤더가 1행이므로 +1)
        let targetRowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === email) {
                targetRowIndex = i + 1; 
                break;
            }
        }

        if (targetRowIndex === -1) {
             return res.status(404).json({ success: false, message: '해당 이메일의 사용자가 시트에 존재하지 않습니다.' });
        }

        // 3. 업데이트할 행 데이터 복사 및 수정 (최대 6열)
        const currentRowData = [...rows[targetRowIndex - 1]]; 
        while(currentRowData.length < 6) currentRowData.push('');
        
        currentRowData[3] = role;   // D열: 권한
        currentRowData[4] = status; // E열: 상태

        // 4. 마스터 시트 해당 행 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: `'사용자_관리'!A${targetRowIndex}:F${targetRowIndex}`,
            valueInputOption: "USER_ENTERED",
            resource: { values: [currentRowData] }
        });

        // 🌟 수정이 발생했으므로 캐시를 강제 초기화
        appCache.del('allSheetData');

        res.json({ success: true, message: '사용자 상태가 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('사용자 업데이트 에러:', error);
        res.status(500).json({ success: false, message: '업데이트 중 서버 오류가 발생했습니다.' });
    }
});

// 구글 로그인 및 JWT 발급 라우트
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            console.log('구글에서 빈 자격증명을 리턴했습니다. (origin 또는 브라우저 캐시 문제)');
            return res.status(400).json({ success: false, message: '유효한 구글 토큰을 받지 못했습니다. 크롬 시크릿 창에서 테스트해주세요.' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name } = payload;
        
        // 마스터 시트에서 사용자 확인
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: "'사용자_관리'!A:F"
        });
        const rows = response.data.values || [];
        
        let userRow = null;
        for(let i = 1; i < rows.length; i++) {
            if(rows[i][0] === email) {
                userRow = rows[i];
                break;
            }
        }
        
        if (userRow) {
            const role = (userRow[3] || 'User').trim();
            const status = (userRow[4] || 'Pending').trim();
            
            if (status === 'Pending') {
                return res.json({ success: false, status: 'Pending', message: '가입 승인 대기 중입니다. 관리자에게 문의하세요.' });
            }
            
            // Active 유저라면 JWT 발급
            const token = jwt.sign({ email, name, role }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ success: true, token, user: { email, name, role, status } });
            
        } else {
            // 미가입 유저 -> 마스터 시트에 Pending으로 추가
            const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            await sheets.spreadsheets.values.append({
                spreadsheetId: MASTER_SPREADSHEET_ID,
                range: "'사용자_관리'!A:F",
                valueInputOption: "USER_ENTERED",
                resource: { values: [[email, name, '', '학생', 'Pending', now]] }
            });
            
            // 🌟 사용자가 새로 등록되었으므로 캐시 초기화
            appCache.del('allSheetData');

            return res.json({ success: false, status: 'Pending', message: '사이트에 첫 접근하여 가입 신청이 되었습니다. 관리자 승인 후 재로그인 해주세요.' });
        }
        
    } catch (err) {
        console.error('인증 에러 상세 내용:', err.message, err.stack);
        res.status(401).json({ success: false, message: `구글 토큰 검증 실패: ${err.message}` });
    }
});

// 임시: 일반 로그인 (시범용, 누구나 업무담당자로 접속)
app.post('/api/auth/local', (req, res) => {
    const email = 'demo@test.com';
    const name = '시범 교사';
    const role = '업무담당자';
    const status = 'Active';

    const token = jwt.sign({ email, name, role }, process.env.JWT_SECRET || 'super_secret_schedule_key_2026', { expiresIn: '7d' });
    return res.json({ success: true, token, user: { email, name, role, status } });
});


// ─── 프로덕션: React 빌드 파일 서빙 ──────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');

if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    // React Router를 위해: /api/* 이외 모든 경로는 index.html 반환
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
    console.log('\u2705 React 빌드 파일 감지됨 - 정적 파일 서빙 활성화');
} else {
    console.log('\u2139\ufe0f  React 빌드 없음 - API 전용 모드 (로컬 개발)');
}
// ─────────────────────────────────────────────────────────────────────────────

// 서버 실행
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
