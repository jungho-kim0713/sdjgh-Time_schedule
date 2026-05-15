require('dotenv').config({ path: __dirname + '/.env', override: true });
const jwt = require('jsonwebtoken');

async function clearCache() {
  try {
    const token = jwt.sign(
      { email: 'admin@test.com', name: 'Admin', role: '관리자', identifier: 'admin' }, 
      process.env.JWT_SECRET || 'super_secret_schedule_key_2026', 
      { expiresIn: '1h' }
    );
    
    const response = await fetch('http://localhost:3000/api/admin/clear-cache', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log("Cache clear response:", data);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
clearCache();
