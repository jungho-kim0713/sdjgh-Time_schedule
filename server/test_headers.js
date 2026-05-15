require('dotenv').config({ path: __dirname + '/.env', override: true });
const { sheets } = require('./services/googleAuth');

async function test() {
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.SPREADSHEET_ID,
      ranges: ["'기준_시간표'!A1:F1", "'일별_시간표'!A1:G1", "'강좌_마스터'!A1:H1", "'교사_명렬표'!A1:H1"]
    });
    console.log("기준_시간표:", res.data.valueRanges[0].values[0]);
    console.log("일별_시간표:", res.data.valueRanges[1].values[0]);
    console.log("강좌_마스터:", res.data.valueRanges[2].values[0]);
    console.log("교사_명렬표:", res.data.valueRanges[3].values[0]);
  } catch (err) {
    console.error(err);
  }
}
test();
