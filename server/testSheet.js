require('dotenv').config();
const { sheets } = require('./services/googleAuth');

async function testConnection() {
    try {
        console.log('구글 스프레드시트 연결을 시도 중입니다...');
        const response = await sheets.spreadsheets.get({
            spreadsheetId: process.env.SPREADSHEET_ID
        });
        console.log('✅ 성공! 연결된 스프레드시트 이름:', response.data.properties.title);
        console.log('\n[포함된 시트 목록]');
        response.data.sheets.forEach(sheet => {
            console.log(`- ${sheet.properties.title}`);
        });
    } catch (error) {
        console.error('❌ 연결 실패!');
        console.error('에러 내용:', error.message);
        console.error('\n[원인 파악]');
        console.error('선생님께서 서비스 계정(가짜 이메일 주소)을 해당 스프레드시트에 "공유(편집자)" 하시는 것을 잊으셨을 확률이 높습니다.');
    }
}

testConnection();
