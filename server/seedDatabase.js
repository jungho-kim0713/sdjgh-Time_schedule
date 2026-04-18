require('dotenv').config();
const { sheets } = require('./services/googleAuth');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const mockupData = {
    '강좌_마스터': [
        ['KOR101', '공통 국어', '홍길동', '1학년'],
        ['MATH201', '심화 미적분', '김철수', '2학년'],
        ['ENG301', '시사 영어독해', '이영희', '3학년'],
    ],
    '기준_시간표': [
        ['월', '1', 'KOR101', '본관 1학년 1반'],
        ['월', '1', 'MATH201', '신관 3층 수학교과실'],
        ['월', '2', 'MATH201', '본관 2학년 3반'],
        ['화', '3', 'ENG301', '본관 3학년 2반'],
        ['수', '4', 'KOR101', '본관 1학년 1반'],
    ],
    '일별_시간표': [
        // 예시를 위해 날짜 하나를 지정하여 보강이 한 건 발생했다고 가정합니다.
        ['2026-04-16', '1', 'KOR101', '홍길동', '김철수', '수업 시간 보강'],
    ],
    '학생_명렬표': [
        ['S001', '10101', '김학생', 'KOR101', '', '', '', '', '', '', '', '', ''],
        ['S002', '20101', '이학생', 'MATH201', '', '', '', '', '', '', '', '', ''],
        ['S003', '30201', '박학생', 'ENG301', '', '', '', '', '', '', '', '', ''],
    ],
    '교사_명렬표': [
        ['T001', '홍길동', 'local_hong', 'hong@test.com'],
        ['T002', '김철수', 'local_kim', 'kim@test.com'],
        ['T003', '이영희', 'local_lee', 'lee@test.com'],
    ]
};

async function seedData() {
    try {
        console.log('구글 스프레드시트에 개발용 가상 데이터를 입력합니다...');
        const requests = Object.keys(mockupData).map(async sheetName => {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!A2`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: mockupData[sheetName] }
            });
            console.log(`- '${sheetName}' 탭에 초기 데이터 입력 완료.`);
        });
        
        await Promise.all(requests);
        console.log('✅ 모든 가상 데이터 생성 완료!');
    } catch(err) {
        console.error('❌ 데이터 생성 중 오류 발생:', err.message);
    }
}

seedData();
