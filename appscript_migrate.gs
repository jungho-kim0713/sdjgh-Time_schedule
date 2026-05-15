/**
 * Apps Script — 원본 시트(2026(1)) → 강좌_마스터 / 기준_시간표 / 교사_명렬표 변환
 * 실행 순서: 1단계
 */
function migrateExistingData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName('2026(1)');
  const masterCourseSheet = ss.getSheetByName('강좌_마스터');
  const masterTimeSheet = ss.getSheetByName('기준_시간표');
  const teacherSheet = ss.getSheetByName('교사_명렬표');
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 4) {
    SpreadsheetApp.getUi().alert("원본 데이터가 충분하지 않습니다.");
    return;
  }
  const data = sourceSheet.getRange(1, 1, lastRow, sourceSheet.getLastColumn()).getValues();

  let courses = new Set();
  let teacherMap = {};
  let teacherCounter = 1;
  let timetableEntries = [];
  let courseMasterEntries = [];
  let teacherEntries = [];
  const days = ['월', '화', '수', '목', '금'];

  let emptyRowCount = 0;
  let currentDept = "";
  for (let i = 4; i < data.length; i++) {
    let dept = String(data[i][1] || "").trim();
    const name = String(data[i][2] || "").trim();

    if (!name) {
      emptyRowCount++;
      if (emptyRowCount > 10) break;
      continue;
    }

    emptyRowCount = 0;
    if (dept) {
      currentDept = dept;
    } else {
      dept = currentDept;
    }
    
    let teacherId;
    const teacherKey = name + "|" + dept;
    if (!teacherMap[teacherKey]) {
      teacherId = "T-" + String(teacherCounter).padStart(3, '0');
      teacherMap[teacherKey] = {
        id: teacherId,
        name: name,
        dept: dept,
        subjects: new Set()
      };
      teacherCounter++;
    } else {
      teacherId = teacherMap[teacherKey].id;
    }
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const dayName = days[dayIdx];
      for (let period = 1; period <= 7; period++) {
        const colIdx = 3 + (dayIdx * 7) + (period - 1);
        let cellValue = data[i][colIdx];
        if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
          let strValue = String(cellValue).trim();

          if (strValue !== "자율" && strValue !== "클럽") {
            if (strValue === "X" || strValue === "Ｘ") {
              const courseCode = "개인사정(X)";
              if (!courses.has(courseCode)) {
                courses.add(courseCode);
                courseMasterEntries.push([courseCode, "개인사정", "(전체공통)", "SPEC-X", "전체", "N"]);
              }
              timetableEntries.push([dayName, period, courseCode, name]);
            } else {
              const parts = strValue.split('\n');
              let rawSubject = parts[0].trim();

              let isSplit = "N";
              let subject = rawSubject;

              if (rawSubject.startsWith('*')) {
                isSplit = "Y";
                subject = rawSubject.substring(1).trim();
              }

              teacherMap[teacherKey].subjects.add(subject);
              if (parts.length === 1) {
                const className = "공통";
                let courseCode = subject + "(" + className + ")";

                if (courseCode === "부장(회의)") {
                  courseCode = "부장(회의)-" + name;
                }

                if (!courses.has(courseCode)) {
                  courses.add(courseCode);
                  courseMasterEntries.push([courseCode, subject, name, teacherId, "", isSplit]);
                }
                timetableEntries.push([dayName, period, courseCode, name]);
              } else {
                for (let p = 1; p < parts.length; p++) {
                  const className = parts[p].trim();

                  if (!className) continue;

                  let courseCode = subject + "(" + className + ")";

                  if (courseCode === "부장(회의)") {
                    courseCode = "부장(회의)-" + name;
                  }
                  if (!courses.has(courseCode)) {
                    courses.add(courseCode);
                    const grade = className.includes('-') ? className.split('-')[0] : "";
                    courseMasterEntries.push([courseCode, subject, name, teacherId, grade, isSplit]);
                  }
                  timetableEntries.push([dayName, period, courseCode, name]);
                }
              }
            }
          }
        }
      }
    }
  }
  const courseLastRow = masterCourseSheet.getLastRow();
  if(courseLastRow > 1) masterCourseSheet.getRange(2, 1, courseLastRow - 1, 6).clearContent();
  const timeLastRow = masterTimeSheet.getLastRow();
  if(timeLastRow > 1) masterTimeSheet.getRange(2, 1, timeLastRow - 1, 4).clearContent();
  const teacherLastRow = teacherSheet.getLastRow();
  if(teacherLastRow > 1) teacherSheet.getRange(2, 1, teacherLastRow - 1, 8).clearContent();
  if (courseMasterEntries.length > 0) {
    masterCourseSheet.getRange(2, 1, courseMasterEntries.length, 6).setValues(courseMasterEntries);
  }
  if (timetableEntries.length > 0) {
    masterTimeSheet.getRange(2, 1, timetableEntries.length, 4).setValues(timetableEntries);
  }

  for (const key in teacherMap) {
    const t = teacherMap[key];
    const subArr = Array.from(t.subjects);
    teacherEntries.push([t.id, t.name, "", t.dept, subArr[0] || "", subArr[1] || "", subArr[2] || "", subArr[3] || ""]);
  }
  if (teacherEntries.length > 0) {
    teacherSheet.getRange(2, 1, teacherEntries.length, 8).setValues(teacherEntries);
  }
  SpreadsheetApp.getUi().alert("✅ 데이터 변환 완료 (부장회의 개별 소유자 분리 적용)");
}

/**
 * Apps Script — 기준_시간표 → 일별_시간표 전체 생성 (1학기 전체)
 * 실행 순서: 3단계 (restoreSpecialCourses 실행 후)
 */
function generateDailyTimetable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterTimeSheet = ss.getSheetByName('기준_시간표');
  const dailySheet = ss.getSheetByName('일별_시간표');

  const dailyLastRow = dailySheet.getLastRow();
  if (dailyLastRow > 1) {
    dailySheet.getRange(2, 1, dailyLastRow - 1, 7).clearContent();
  }

  const timeData = masterTimeSheet.getDataRange().getValues();
  const scheduleByDay = { '월': [], '화': [], '수': [], '목': [], '금': [] };

  for (let i = 1; i < timeData.length; i++) {
    const day = timeData[i][0];
    const period = timeData[i][1];
    const courseCode = timeData[i][2];

    const teacherName = timeData[i][3] || '미정'; // 기준_시간표의 담당교사 직접 사용
    if (scheduleByDay[day] && courseCode) {
      scheduleByDay[day].push({ period: period, courseCode: courseCode, teacherName: teacherName });
    }
  }

  const startDate = new Date('2026-03-02');
  const endDate = new Date('2026-07-20');

  const newRows = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeekIndex = d.getDay();
    const dayName = dayNames[dayOfWeekIndex];

    if (dayOfWeekIndex === 0 || dayOfWeekIndex === 6) continue;

    const todaySchedule = scheduleByDay[dayName];
    if (!todaySchedule || todaySchedule.length === 0) continue;

    const dateString = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    for (let j = 0; j < todaySchedule.length; j++) {
      const item = todaySchedule[j];

      const teacherName = item.teacherName; // 강좌_마스터 조회 대신 기준_시간표의 교사명 직접 사용

      newRows.push([
        dateString,
        item.period,
        item.courseCode,
        teacherName,
        teacherName,
        item.courseCode === '개인사정(X)' ? '수업불가' : '정상',
        ''
      ]);
    }
  }

  if (newRows.length > 0) {
    dailySheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
    SpreadsheetApp.getUi().alert(`✅ 시간표 생성 완료!\n\n${Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')} 부터 ${Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')} 까지\n총 ${newRows.length}개의 수업이 새롭게 세팅되었습니다.`);
  } else {
    SpreadsheetApp.getUi().alert('⚠️ 지정한 기간에 생성할 데이터가 없습니다.');
  }
}
