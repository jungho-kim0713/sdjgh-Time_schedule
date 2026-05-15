/**
 * Apps Script — 특정일 이후 미래 시간표 동기화
 * 실행 순서: 
 * 1. 2026(1) 원본 시트 수정
 * 2. 1단계(migrateExistingData), 2단계(restoreSpecialCourses) 실행
 * 3. 이 함수(syncFutureSchedules) 실행
 */
function syncFutureSchedules() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '미래 시간표 동기화',
    '동기화를 시작할 기준 날짜를 입력하세요 (예: 2026-05-15)\n\n⚠️ 주의: 반드시 사전에 1단계(마이그레이션) 및 2단계(특수과목 복구)를 먼저 실행한 후 이 기능을 사용하세요.\n입력한 날짜 이후의 일별 시간표는 현재 기준_시간표를 바탕으로 모두 덮어씌워집니다.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const dateStr = response.getResponseText().trim();
  const targetDate = new Date(dateStr);
  
  if (isNaN(targetDate.getTime())) {
    ui.alert('오류', '올바른 날짜 형식이 아닙니다. (예: 2026-05-15)', ui.ButtonSet.OK);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterTimeSheet = ss.getSheetByName('기준_시간표');
  const dailySheet = ss.getSheetByName('일별_시간표');

  if (!masterTimeSheet || !dailySheet) {
    ui.alert('오류', '기준_시간표 또는 일별_시간표 시트를 찾을 수 없습니다.', ui.ButtonSet.OK);
    return;
  }

  // 1. 일별_시간표에서 targetDate 이후의 행 삭제
  const dailyData = dailySheet.getDataRange().getValues();
  let firstRowToDelete = -1;
  let rowsToDeleteCount = 0;
  
  targetDate.setHours(0,0,0,0);

  for (let i = 1; i < dailyData.length; i++) {
    const rowDateRaw = dailyData[i][0];
    if (rowDateRaw) {
      const rowDate = new Date(rowDateRaw);
      rowDate.setHours(0,0,0,0);
      if (rowDate >= targetDate) {
        if (firstRowToDelete === -1) {
          firstRowToDelete = i + 1; // 1-based index
        }
        rowsToDeleteCount++;
      }
    }
  }

  if (firstRowToDelete !== -1 && rowsToDeleteCount > 0) {
    dailySheet.getRange(firstRowToDelete, 1, dailySheet.getLastRow() - firstRowToDelete + 1, dailySheet.getLastColumn()).clearContent();
  } else {
    firstRowToDelete = dailySheet.getLastRow() + 1;
  }

  // 2. 기준_시간표 기반으로 scheduleByDay 구성
  const timeData = masterTimeSheet.getDataRange().getValues();
  const scheduleByDay = { '월': [], '화': [], '수': [], '목': [], '금': [] };

  for (let i = 1; i < timeData.length; i++) {
    const day = timeData[i][0];
    const period = timeData[i][1];
    const courseCode = timeData[i][2];
    const teacherName = timeData[i][3] || '미정';

    if (scheduleByDay[day] && courseCode) {
      scheduleByDay[day].push({ period: period, courseCode: courseCode, teacherName: teacherName });
    }
  }

  // 3. 타겟 일자부터 한 학기 종료일(2026-07-20)까지 새로운 일별 데이터 생성
  const endDate = new Date('2026-07-20');
  endDate.setHours(0,0,0,0);
  
  const newRows = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let d = new Date(targetDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeekIndex = d.getDay();
    const dayName = dayNames[dayOfWeekIndex];

    if (dayOfWeekIndex === 0 || dayOfWeekIndex === 6) continue;

    const todaySchedule = scheduleByDay[dayName];
    if (!todaySchedule || todaySchedule.length === 0) continue;

    const dateString = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    for (let j = 0; j < todaySchedule.length; j++) {
      const item = todaySchedule[j];
      newRows.push([
        dateString,
        item.period,
        item.courseCode,
        item.teacherName,
        item.teacherName,
        item.courseCode === '개인사정(X)' ? '수업불가' : '정상',
        ''
      ]);
    }
  }

  // 4. 생성된 데이터를 일별_시간표 시트에 추가
  if (newRows.length > 0) {
    dailySheet.getRange(firstRowToDelete, 1, newRows.length, newRows[0].length).setValues(newRows);
    ui.alert('✅ 미래 시간표 동기화 완료!', `기준일(${dateStr})부터 ${Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')}까지 총 ${newRows.length}개의 시간표가 갱신되었습니다.\n\n(X 표시는 '개인사정(X)' 강좌로, 상태는 '수업불가'로 세팅되었습니다.)`, ui.ButtonSet.OK);
  } else {
    ui.alert('⚠️ 지정한 기간에 생성할 데이터가 없습니다.');
  }
}
