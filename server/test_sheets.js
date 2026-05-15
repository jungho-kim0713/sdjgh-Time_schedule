require('dotenv').config({ path: __dirname + '/.env', override: true });
const { sheets } = require('./services/googleAuth');

async function test() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "'일별_시간표'!A2:G5"
    });
    console.log("Sample rows:", res.data.values);
  } catch (err) {
    console.error(err);
  }
}
test();
