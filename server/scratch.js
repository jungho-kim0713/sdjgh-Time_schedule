const { sheets } = require('./services/googleAuth');
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

async function check() {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "'학생_명렬표'!A1:F5"
    });
    console.log(response.data.values);
}

check();
