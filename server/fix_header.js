require('dotenv').config({ path: __dirname + '/.env', override: true });
const { sheets } = require('./services/googleAuth');

async function fixHeader() {
  try {
    // 1. Update the header
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "'기준_시간표'!D1",
      valueInputOption: "USER_ENTERED",
      resource: { values: [['담당교사']] }
    });
    console.log("Header fixed to '담당교사'");

    // 2. Clear cache via HTTP request
    const axios = require('axios');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ email: 'admin@test.com', name: 'Admin', role: '관리자', identifier: 'admin' }, process.env.JWT_SECRET || 'super_secret_schedule_key_2026', { expiresIn: '1h' });
    
    await axios.post('http://localhost:3000/api/admin/clear-cache', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Cache cleared successfully.");

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
fixHeader();
