const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'server/.env' });

const token = jwt.sign({ name: '테스트학생', role: '학생', uid: '26-10120' }, process.env.JWT_SECRET || 'X7r$9Tp#fLw!B2gVzM6@NyQeC%kHaUJ3XsRWmFD4oGlq');

fetch('http://localhost:5001/api/data', { headers: { Authorization: 'Bearer ' + token } })
.then(r=>r.json())
.then(d => {
    const data = d.data;
    const todayStr = '2026-05-13';
    const todaysChanges = data.dailySchedules.filter(d => d['날짜'] === todayStr);
    
    console.log('Todays changes:', todaysChanges.length);

    const extractClassInfo = (code) => {
        const match = code.match(/\((.*?)\)/);
        return match ? match[1] : '';
    };

    const user = { name: '테스트학생', role: '학생', uid: '26-10120' };
    const identifier = user.uid;
    
    todaysChanges.forEach(ch => {
        let isRelevant = false;
        let userClassInfo = '';
        const classInfo = extractClassInfo(ch['강좌코드']);
        
        const studentIdMatch = identifier.match(/(\d{5})$/);
        if (studentIdMatch) {
            const studentId = studentIdMatch[1];
            const userGrade = studentId.substring(0, 1);
            const userClass = studentId.substring(1, 3).replace(/^0+/, '');
            userClassInfo = `${userGrade}-${userClass}`;
        }
        if (classInfo === userClassInfo) isRelevant = true;
        
        console.log(`강좌코드: ${ch['강좌코드']}, classInfo: ${classInfo}, userClassInfo: ${userClassInfo}, isRelevant: ${isRelevant}, 상태: ${ch['상태']}`);
    });
}).catch(console.error);
