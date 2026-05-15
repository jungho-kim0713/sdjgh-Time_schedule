require('dotenv').config({ path: __dirname + '/.env', override: true });
const { sheets } = require('./services/googleAuth');

async function test() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "'일별_시간표'!A:G"
    });
    const d = res.data.values.filter(r => r[0] && r[0].includes('15') && r[1] === '6');
    console.log("May 15 6th period entries:", d);
  } catch (err) {
    console.error(err);
  }
}
test();
