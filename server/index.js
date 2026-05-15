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

// 3. 시간표 확정 적용 권한 확인용 미들웨어 (관리자 · 업무담당자만 가능)
function canEditSchedule(req, res, next) {
    const role = req.user && req.user.role.trim();
    if (role === '관리자' || role === '업무담당자') {
        next();
    } else {
        res.status(403).json({ success: false, message: '시간표 확정 적용은 업무담당자 이상 권한이 필요합니다.' });
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

async function getAllData(force = false) {
    const cacheKey = 'allSheetData';
    if (!force) {
        const cachedData = appCache.get(cacheKey);
        if (cachedData) return cachedData;
    }

    console.log('📡 구글 스프레드시트 API를 호출합니다 (캐시 없음)...');
    const ranges = ["'강좌_마스터'!A:G", "'교사_명렬표'!A:H", "'기준_시간표'!A:D", "'일별_시간표'!A:G", "'학생_명렬표'!A:N"];
    const [response, masterResponse] = await Promise.all([
        sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges
        }),
        sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: "'사용자_관리'!A:I"
        })
    ]);

    const valueRanges = response.data.valueRanges;
    const courses = parseSheetData(valueRanges[0].values);
    const teachers = parseSheetData(valueRanges[1].values);
    const baseSchedules = parseSheetData(valueRanges[2].values);
    const dailySchedules = parseSheetData(valueRanges[3].values).map(d => {
        let cellDate = d['날짜'] || '';
        if (cellDate.includes('.')) {
            const parts = cellDate.split('.');
            if (parts.length >= 3) {
                const y = parts[0].length === 2 ? '20' + parts[0] : parts[0];
                const m = parts[1].trim().padStart(2, '0');
                const d_part = parts[2].trim().padStart(2, '0');
                d['날짜'] = `${y}-${m}-${d_part}`;
            }
        }
        return d;
    });
    const students = parseSheetData(valueRanges[4].values);
    const users = parseSheetData(masterResponse.data.values || []);

    const dataToCache = { courses, teachers, baseSchedules, dailySchedules, students, users };
    appCache.set(cacheKey, dataToCache);
    return dataToCache;
}

// 🚀 백그라운드 캐시 자동 갱신 (사용자가 로딩 지연을 겪지 않도록 4분 30초마다 자동 최신화)
setInterval(() => {
    console.log('🔄 백그라운드 캐시 자동 갱신 중...');
    getAllData(true).catch(err => console.error('백그라운드 갱신 에러:', err));
}, 4.5 * 60 * 1000);

// 서버 시작 시 최초 1회 데이터를 미리 당겨와서 첫 접속자도 빠르게!
setTimeout(() => {
    getAllData().catch(err => console.error('초기 데이터 로드 에러:', err));
}, 1000);

app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const data = await getAllData();
        res.json({ success: true, data });
    } catch (error) {
        console.error("데이터 조회 에러:", error);
        res.status(500).json({ success: false, message: '구글 스프레드시트 조회에 실패했습니다.' });
    }
});

// 플랫폼(메인페이지) 대시보드용 오늘의 변동사항 API
app.get('/api/changes/today', authenticateToken, async (req, res) => {
    try {
        const data = await getAllData();
        const user = req.user;
        const identifier = user.identifier || user.uid || '';
        
        // 오늘 날짜 (KST)
        const today = new Date();
        const kstDate = new Date(today.getTime() + (9 * 60 * 60 * 1000));
        const yyyy = kstDate.getUTCFullYear();
        const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(kstDate.getUTCDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        
        // 오늘의 일별 시간표 가져오기
        const todaysChanges = data.dailySchedules.filter(d => d['날짜'] === todayStr);
        console.log(`[API /changes/today] User:`, user);
        console.log(`[API /changes/today] todayStr: ${todayStr}, todaysChanges count: ${todaysChanges.length}`);

        // 강좌 코드 -> 과목명 맵핑 헬퍼
        const getSubjectName = (courseCode) => {
            const course = data.courses.find(c => c['강좌코드'] === courseCode);
            return course ? course['과목명'] : courseCode;
        };
        const extractClassInfo = (code) => {
            const match = code.match(/\((.*?)\)/);
            return match ? match[1] : '';
        };

        const changes = [];
        // 실제로는 상태(이동, 취소 등)에 따라 원본과 변경 내용을 매핑해야 하지만,
        // 현재는 플랫폼에서 보여주기 좋게 임의로 변환합니다.
        for (const ch of todaysChanges) {
            // 학생은 본인 학급인지, 교사는 본인 이름이 있는지 필터
            let isRelevant = false;
            if (user.role === '교사' || user.role === '업무담당자' || user.role === '관리자') {
                if (ch['원래교사'] === user.name || ch['변경교사'] === user.name) isRelevant = true;
            } else if (user.role === '학생') {
                // 임시: 학생은 identifier나 name에서 학급 정보를 추출한다고 가정
                const classInfo = extractClassInfo(ch['강좌코드']);
                if (identifier) {
                    let userClassInfo = '';
                    // 마지막이 5자리 숫자로 끝나는 경우 (예: 10101 또는 26-10120)
                    const studentIdMatch = identifier.match(/(\d{5})$/);
                    if (studentIdMatch) {
                        const studentId = studentIdMatch[1];
                        const userGrade = studentId.substring(0, 1);
                        const userClass = studentId.substring(1, 3).replace(/^0+/, '');
                        userClassInfo = `${userGrade}-${userClass}`;
                    } 
                    // 1-1 형태
                    else if (/^\d-\d+$/.test(identifier)) {
                        userClassInfo = identifier;
                    }
                    // 그 외 (예: 1학년 1반)
                    else {
                        const gradeMatch = identifier.match(/(\d)학년/);
                        const classMatch = identifier.match(/(\d+)반/);
                        if (gradeMatch && classMatch) {
                            userClassInfo = `${gradeMatch[1]}-${classMatch[1]}`;
                        } else {
                            // 최후의 수단: 그냥 통째로 비교하거나 uid 그대로 사용
                            userClassInfo = identifier;
                        }
                    }
                    
                    if (classInfo === userClassInfo) isRelevant = true;
                }
            }
            
            if (isRelevant) {
                let type = 'moved';
                if (ch['상태'] === '이동(OUT)') type = 'cancelled';
                if (ch['상태'] === '대강') type = 'substituted';
                if (ch['상태'] === '이동(IN)') type = 'added';
                if (ch['상태'] === '보강') type = 'added';
                if (ch['상태'] === '자습') type = 'substituted'; // 자습 처리
                if (ch['상태'] === '취소') continue; // 취소된 건은 스킵
                if (ch['상태'] === '정상') continue; // 정상(변경 없음)은 스킵
                
                changes.push({
                    period: ch['교시'],
                    type: type,
                    original: { subject: getSubjectName(ch['강좌코드']), teacher: ch['원래교사'] },
                    changed: { subject: ch['상태'] === '자습' ? '자습' : getSubjectName(ch['강좌코드']), teacher: ch['변경교사'] || ch['상태'] },
                    note: ch['사유'] || ch['상태']
                });
            }
        }
        // 행사 데이터 파싱 (교시 범위 형태로)
        const eventsRaw = [];
        for (const ch of todaysChanges) {
            if (ch['상태'] === '행사') {
                const targetMatch = ch['강좌코드'].match(/\((.*?)\)/);
                const target = targetMatch ? targetMatch[1] : '';
                
                let isEventRelevant = false;
                if (user.role === '관리자' || user.role === '업무담당자' || user.role === '교사') {
                    isEventRelevant = true;
                } else if (user.role === '학생') {
                    if (target === '전체') isEventRelevant = true;
                    else if (identifier) {
                        const studentIdMatch = identifier.match(/(\d{5})$/);
                        if (studentIdMatch) {
                            const userGrade = studentIdMatch[1].substring(0, 1);
                            if (target === `${userGrade}학년`) isEventRelevant = true;
                            // 1-1반 구체 대상 행사
                            const userClass = studentIdMatch[1].substring(1, 3).replace(/^0+/, '');
                            if (target === `${userGrade}-${userClass}`) isEventRelevant = true;
                        }
                    }
                }
                
                if (isEventRelevant) {
                    eventsRaw.push({
                        name: ch['사유'],
                        period: parseInt(ch['교시'], 10) || 0,
                    });
                }
            }
        }

        // 이름별 연속 교시를 묶어 "1~7 체육대회" 형태로 요약
        const eventGroups = {};
        eventsRaw.forEach(ev => {
            if (!eventGroups[ev.name]) eventGroups[ev.name] = [];
            eventGroups[ev.name].push(ev.period);
        });
        const events = Object.entries(eventGroups).map(([name, periods]) => {
            periods.sort((a, b) => a - b);
            const min = periods[0], max = periods[periods.length - 1];
            const label = min === max ? `${min}교시` : `${min}~${max}교시`;
            return { name, periodLabel: label };
        });

        res.json({
            changes,
            events
        });

    } catch (error) {
        console.error("변동사항 API 에러:", error);
        res.status(500).json({ success: false, message: '변동사항을 가져오는 데 실패했습니다.' });
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

// 캐시 강제 초기화 (관리자 및 업무담당자/교사 사용 가능)
app.post('/api/admin/clear-cache', authenticateToken, canEditSchedule, (req, res) => {
    appCache.del('allSheetData');
    console.log('🗑️ 사용자/관리자 요청으로 캐시가 초기화되었습니다.');
    res.json({ success: true, message: '캐시가 초기화되었습니다. 다음 조회 시 구글 시트에서 최신 데이터를 불러옵니다.' });
});

// 사용자 판별 및 상태/권한 업데이트 로직 (관리자만 가능)
app.post('/api/users/update', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { email, role, status } = req.body;
        
        // 1. 마스터 시트에서 사용자_관리 데이터 가져오기
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: "'사용자_관리'!A:I"
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: '사용자 데이터를 찾을 수 없습니다.' });
        }

        // 2. 이메일(A열) 또는 일반ID(B열) 기반으로 해당 사용자의 행(Row) 번호 찾기 (헤더가 1행이므로 +1)
        let targetRowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === email || rows[i][1] === email) {
                targetRowIndex = i + 1; 
                break;
            }
        }

        if (targetRowIndex === -1) {
             return res.status(404).json({ success: false, message: '해당 이메일의 사용자가 시트에 존재하지 않습니다.' });
        }

        // 3. 업데이트할 행 데이터 복사 및 수정 (최대 9열)
        const currentRowData = [...rows[targetRowIndex - 1]]; 
        while(currentRowData.length < 9) currentRowData.push('');
        
        currentRowData[5] = role;   // F열: 권한
        currentRowData[6] = status; // G열: 상태

        // 4. 마스터 시트 해당 행 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: `'사용자_관리'!A${targetRowIndex}:I${targetRowIndex}`,
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
            range: "'사용자_관리'!A:I"
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
            const role = (userRow[5] || '학생').trim(); // F열
            const status = (userRow[6] || 'Pending').trim(); // G열
            const identifier = userRow[4] || ''; // E열
            
            if (status === 'Pending') {
                return res.json({ success: false, status: 'Pending', message: '가입 승인 대기 중입니다. 관리자에게 문의하세요.' });
            }
            if (status === 'Inactive') {
                return res.status(403).json({ success: false, message: '정지된 계정입니다. 관리자에게 문의하세요.' });
            }
            
            // Active 유저라면 JWT 발급 (이름은 DB의 이름 우선)
            const userName = userRow[3] || name;
            const token = jwt.sign({ email, name: userName, role, identifier }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ success: true, token, user: { email, name: userName, role, status, identifier } });
            
        } else {
            // 미가입 유저 -> 마스터 시트에 Pending으로 추가 (A~I열)
            // A:구글계정, B:일반ID, C:비밀번호, D:이름, E:고유식별자, F:권한, G:상태, H:가입일시, I:비번변경필요
            const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            await sheets.spreadsheets.values.append({
                spreadsheetId: MASTER_SPREADSHEET_ID,
                range: "'사용자_관리'!A:I",
                valueInputOption: "USER_ENTERED",
                resource: { values: [[email, '', '', name, '', '학생', 'Pending', now, 'FALSE']] }
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

// SSO 토큰 검증 (플랫폼에서 발급한 JWT를 받아 시간표용 JWT로 교환)
app.post('/api/auth/sso', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'SSO 토큰이 없습니다.' });

        const payload = jwt.verify(token, JWT_SECRET);
        const { name, uid, role, managedApp } = payload;

        const identifier = uid || '';
        // managedApp에 'timetable'이 포함되면 업무담당자 역할 부여, 아니면 플랫폼 role 그대로 사용
        const apps = (managedApp || '').split(',').map(s => s.trim());
        const timetableRole = apps.includes('timetable') ? '업무담당자' : role;

        const timetableToken = jwt.sign(
            { name, role: timetableRole, identifier },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            success: true,
            token: timetableToken,
            user: { name, role: timetableRole, identifier, status: 'Active' }
        });
    } catch (e) {
        console.error('SSO 토큰 검증 실패:', e.message);
        return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 SSO 토큰입니다.' });
    }
});

// 일반 로그인 (B열 아이디, C열 비밀번호 검증)
app.post('/api/auth/local', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_SPREADSHEET_ID,
            range: "'사용자_관리'!A:I"
        });
        const rows = response.data.values || [];
        
        let userRow = null;
        for(let i = 1; i < rows.length; i++) {
            if(rows[i][1] === username) { // B열(일반ID) 검증
                userRow = rows[i];
                break;
            }
        }

        if (!userRow) return res.status(401).json({ success: false, message: '등록되지 않은 아이디입니다.' });

        const sheetPassword = userRow[2] || '';
        if (sheetPassword !== password) return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });

        const email = userRow[0] || '';
        const name = userRow[3] || username;
        const identifier = userRow[4] || '';
        const role = (userRow[5] || '학생').trim();
        const status = (userRow[6] || 'Pending').trim();
        const requirePasswordChange = (userRow[8] || '').trim().toUpperCase() === 'TRUE';

        if (status === 'Pending') return res.json({ success: false, status: 'Pending', message: '가입 승인 대기 중입니다. 관리자에게 문의하세요.' });
        if (status === 'Inactive') return res.status(403).json({ success: false, message: '정지된 계정입니다.' });

        const token = jwt.sign({ email, name, role, identifier, localId: username }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token, user: { email, name, role, status, identifier, requirePasswordChange } });
        
    } catch (err) {
        console.error('일반 로그인 에러:', err);
        res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
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
