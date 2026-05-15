require('dotenv').config({ path: __dirname + '/.env', override: true });
const jwt = require('jsonwebtoken');

async function checkApi() {
  try {
    const token = jwt.sign(
      { email: 'admin@test.com', name: 'Admin', role: '관리자', identifier: 'admin' }, 
      process.env.JWT_SECRET || 'super_secret_schedule_key_2026', 
      { expiresIn: '1h' }
    );
    
    // Using native fetch in node 18+
    const response = await fetch('http://localhost:3000/api/data', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const resData = await response.json();
    if(resData.success) {
      const thurs3 = resData.data.baseSchedules.filter(s => s['요일'] === '목' && String(s['교시']) === '3' && s['강좌코드'] === '생명(2-7)');
      console.log("목요일 3교시 생명(2-7) baseSchedule:", thurs3);
    } else {
      console.log("API returned false:", resData);
    }
  } catch(err) {
    console.error("API error:", err.message);
  }
}
checkApi();
