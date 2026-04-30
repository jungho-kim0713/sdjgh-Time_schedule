const { sheets } = require('./services/googleAuth');
require('dotenv').config({path: './.env'});

sheets.spreadsheets.values.get({spreadsheetId: process.env.SPREADSHEET_ID, range: "'2026(1)'!A1:Z500"}).then(r => {
    const data = r.data.values || [];
    for (let i = 0; i < data.length; i++) {
        if (!data[i]) continue;
        for (let j = 0; j < data[i].length; j++) {
            if (String(data[i][j]).includes('부장')) {
                console.log(`Row ${i+1}, Col ${j} (${data[i][2]}): ${JSON.stringify(data[i][j])}`);
            }
        }
    }
}).catch(e => console.error(e));
