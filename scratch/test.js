const courses = [
  { '강좌코드': '체육(1-1)', '담당교사': '김정희' },
  { '강좌코드': '체육(1-2)', '담당교사': '최철우' },
  { '강좌코드': '수학(1-1)', '담당교사': '김도희' }
];

const baseSchedules = [
  { '요일': '월', '교시': 4, '강좌코드': '체육(1-1)' }, // 김정희
  { '요일': '월', '교시': 5, '강좌코드': '체육(1-1)' }, // 김정희 (5교시 체육 수업)
  { '요일': '월', '교시': 3, '강좌코드': '체육(1-2)' }, // 최철우
  { '요일': '월', '교시': 4, '강좌코드': '수학(1-1)' }, // 김도희
];

const dailySchedules = [
  // 1st swap: A(김정희, 4_체육(1-1)) <-> B(최철우, 3_체육(1-2))
  { '날짜': '2026-05-04', '교시': 4, '강좌코드': '체육(1-1)', '원래교사': '김정희', '변경교사': '', '상태': '이동(OUT)' },
  { '날짜': '2026-05-04', '교시': 3, '강좌코드': '체육(1-1)', '원래교사': '', '변경교사': '김정희', '상태': '이동(IN)' },
  { '날짜': '2026-05-04', '교시': 3, '강좌코드': '체육(1-2)', '원래교사': '최철우', '변경교사': '', '상태': '이동(OUT)' },
  { '날짜': '2026-05-04', '교시': 4, '강좌코드': '체육(1-2)', '원래교사': '', '변경교사': '최철우', '상태': '이동(IN)' },
];

const getDayString = (t) => '월';

const getTeacherSchedulesOnDate = (tName, tDate) => {
    const dayOfWeek = getDayString(tDate);
    const tCourses = courses.filter(c => c['담당교사'] === tName).map(c => c['강좌코드']);
    let schedules = baseSchedules.filter(s => s['요일'] === dayOfWeek && tCourses.includes(s['강좌코드']));
    
    const dayChanges = dailySchedules.filter(d => d['날짜'] === tDate) || [];
    const statusMap = {};
    dayChanges.forEach(change => {
        const key = `${change['교시']}_${change['강좌코드']}`;
        if (change['상태'] === '취소' || change['상태'] === '정상') {
            delete statusMap[key];
        } else {
            statusMap[key] = change;
        }
    });

    Object.values(statusMap).forEach(change => {
        if (change['상태'] === '이동(OUT)') {
            schedules = schedules.filter(s => !(String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']));
        } else if (change['상태'] === '이동(IN)') {
            if (change['변경교사'] === tName) {
                const isDup = schedules.some(s => String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']);
                if (!isDup) schedules.push({ '요일': dayOfWeek, '교시': change['교시'], '강좌코드': change['강좌코드'] });
            }
        } else if (change['원래교사'] === tName && change['변경교사'] !== tName) {
            schedules = schedules.filter(s => !(String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']));
        } else if (change['변경교사'] === tName && change['원래교사'] !== tName) {
            const isDup = schedules.some(s => String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']);
            if (!isDup) schedules.push({ '요일': dayOfWeek, '교시': change['교시'], '강좌코드': change['강좌코드'] });
        }
    });
    return schedules;
};

// getTargetList logic
const sourceTeacher = '김정희';
const selectedDate = '2026-05-04';
const selectedPeriod = 5;

const amIBusyAt = (testDate, period) => {
    const mySchedulesOnDay = getTeacherSchedulesOnDate(sourceTeacher, testDate);
    return mySchedulesOnDay.some(s => String(s['교시']) === String(period));
};

const extractClassInfo = (code) => {
    if(!code) return null;
    const match = code.match(/\((.*?)\)/);
    return match ? match[1] : null;
};

const sourceSchedule = { '교시': 5, '강좌코드': '체육(1-1)' };
const sourceClassInfo = extractClassInfo(sourceSchedule['강좌코드']);

const targets = [];
const sDate = '2026-05-04';

courses.filter(c => c['담당교사'] !== sourceTeacher).map(c => c['담당교사']).forEach(targetName => {
    const targetSchedulesOnDate = getTeacherSchedulesOnDate(targetName, sDate);

    // 조건 A: isTargetBusyAtSource
    const targetSchedulesOnSrcDate = getTeacherSchedulesOnDate(targetName, selectedDate);
    const isTargetBusyAtSource = targetSchedulesOnSrcDate.some(s => String(s['교시']) === String(selectedPeriod));
    if (isTargetBusyAtSource) {
        console.log(`${targetName} is busy at source period ${selectedPeriod}, skipping.`);
        return;
    }

    targetSchedulesOnDate.forEach(tSch => {
        const tSchClassInfo = extractClassInfo(tSch['강좌코드']);
        if (sourceClassInfo && tSchClassInfo !== sourceClassInfo) {
            console.log(`${targetName} period ${tSch['교시']} class ${tSchClassInfo} != ${sourceClassInfo}, skipping.`);
            return;
        }

        if (!amIBusyAt(sDate, tSch['교시'])) {
            targets.push({ teacher: targetName, period: tSch['교시'], courseCode: tSch['강좌코드'] });
        } else {
            console.log(`Source is busy at target period ${tSch['교시']}, skipping ${targetName}.`);
        }
    });
});

console.log("Targets found:", targets);
