require('dotenv').config();
const { sheets } = require('./services/googleAuth');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SCHEMA = [
    { title: '강좌_마스터', headers: ['강좌코드', '과목명', '담당교사', '대상 학년'] },
    { title: '기준_시간표', headers: ['요일', '교시', '강좌코드', '장소(교실)'] },
    { title: '일별_시간표', headers: ['날짜', '교시', '강좌코드', '원래 교사', '변경 교사', '교체상태'] },
    { title: '학생_명렬표', headers: ['학생ID', '학번', '이름', '수강강좌1', '수강강좌2', '수강강좌3', '수강강좌4', '수강강좌5', '수강강좌6', '수강강좌7', '수강강좌8', '수강강좌9', '수강강좌10'] },
    { title: '교사_명렬표', headers: ['교사ID', '이름', '계정 정보', '구글 이메일'] }
];

async function setupDatabase() {
    try {
        console.log('현재 스프레드시트 상태를 조회 중입니다...');
        const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const existingSheets = response.data.sheets.map(s => s.properties.title);
        
        const requests = [];
        const sheetsToAdd = SCHEMA.filter(s => !existingSheets.includes(s.title));

        if (sheetsToAdd.length > 0) {
            sheetsToAdd.forEach(s => {
                requests.push({
                    addSheet: {
                        properties: { title: s.title }
                    }
                });
            });

            console.log(`${sheetsToAdd.length}개의 새로운 탭을 추가합니다...`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { requests }
            });
            console.log('탭 추가 완료!');
        } else {
            console.log('필요한 탭이 이미 모두 존재합니다.');
        }

        console.log('각 탭의 첫 줄(헤더)을 작성 및 굵게 구성합니다...');
        for (const sheet of SCHEMA) {
            // 헤더 텍스트 입력
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheet.title}'!A1:Z1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [sheet.headers]
                }
            });
        }
        
        console.log('데이터베이스(스프레드시트) 1차 셋업이 성공적으로 완료되었습니다!');
    } catch (error) {
        console.error('셋업 중 오류 발생:', error);
    }
}

setupDatabase();
