require('dotenv').config();
const { sheets } = require('./services/googleAuth');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function inspectDB() {
    try {
        console.log("=== 스프레드시트 메타데이터 조회 중... ===");
        const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetList = response.data.sheets.map(s => s.properties.title);
        
        console.log("=== 현재 탭 목록 ===");
        console.log(sheetList.map((t, idx) => `${idx + 1}. ${t}`).join('\n'));
        console.log("\n=== 각 탭의 헤더 (첫 줄 컬럼명) 구조 ===");
        
        for (const title of sheetList) {
            const data = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${title}'!A1:Z1`
            });
            const headers = data.data.values ? data.data.values[0] : ['(데이터/헤더 없음)'];
            console.log(`[${title}]:  ${headers.join('  |  ')}`);
        }
        console.log("\n조회 완료!");
    } catch (e) {
        console.error("오류 발생:", e.message);
    }
}

inspectDB();
