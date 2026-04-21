const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // 프론트엔드와의 통신 허용
app.use(express.json()); // JSON 요청 본문 파싱

// 상태 확인용 간단한 API 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '서대전여고 시간표 백엔드 서버가 정상 작동중입니다!' });
});

const { sheets } = require('./services/googleAuth');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

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

// 종합 메인 데이터(프론트엔드 테이블 및 필터 렌더용) fetching API
app.get('/api/data', async (req, res) => {
    try {
        const ranges = ["'강좌_마스터'!A:G", "'교사_명렬표'!A:H", "'기준_시간표'!A:D", "'일별_시간표'!A:G", "'학생_명렬표'!A:N"];
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges
        });

        const valueRanges = response.data.valueRanges;
        
        const courses = parseSheetData(valueRanges[0].values); // 강좌_마스터
        const teachers = parseSheetData(valueRanges[1].values); // 교사_명렬표
        const baseSchedules = parseSheetData(valueRanges[2].values); // 기준_시간표
        const dailySchedules = parseSheetData(valueRanges[3].values); // 일별_시간표
        const students = parseSheetData(valueRanges[4].values); // 학생_명렬표

        res.json({
            success: true,
            data: { courses, teachers, baseSchedules, dailySchedules, students }
        });

    } catch (error) {
        console.error("데이터 조회 에러:", error);
        res.status(500).json({ success: false, message: '구글 스프레드시트 조회에 실패했습니다.' });
    }
});

// 시간표 변경 승인 및 DB 저장(Append) 로직
app.post('/api/schedule/update', async (req, res) => {
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

        res.json({ success: true, message: '일별_시간표 DB 누적 처리가 완료되었습니다.' });
    } catch (error) {
        console.error('업데이트 저장 에러:', error);
        res.status(500).json({ success: false, message: error.message });
    }
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
