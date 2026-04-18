const { google } = require('googleapis');
const path = require('path');

// 선생님께서 복사해주신 서비스 계정 키 파일의 경로입니다.
const KEYFILEPATH = path.join(__dirname, '..', 'google-key.json');

// 시스템이 요구하는 권한(스코프) 설정: 스프레드시트 접근 및 캘린더 관리 권한
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar'
];

// 인증 객체 초기화
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

// 구글 시트와 캘린더를 제어할 수 있는 클라이언트 인스턴스 생성
const sheets = google.sheets({ version: 'v4', auth });
const calendar = google.calendar({ version: 'v3', auth });

module.exports = {
    auth,
    sheets,
    calendar
};
