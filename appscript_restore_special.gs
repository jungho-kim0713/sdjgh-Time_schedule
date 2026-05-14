/**
 * Apps Script — 특수 과목 복구 (자율/클럽/자습)
 * 실행 순서: 2단계 (migrateExistingData 실행 후, generateDailyTimetable 실행 전)
 *
 * migrateExistingData는 원본 시트에서 "자율", "클럽" 셀을 의도적으로 건너뜀.
 * 이 스크립트가 해당 특수 과목을 강좌_마스터와 기준_시간표에 다시 추가함.
 * 부장(회의)는 migrateExistingData가 "부장(회의)-교사명" 형식으로 이미 처리함 → 여기선 제외.
 */
function restoreSpecialCourses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. 강좌_마스터에 특수 강좌코드 추가 ─────────────────────────────────
  const masterSheet = ss.getSheetByName('강좌_마스터');

  // 헤더: 강좌코드, 과목명, 담당교사, 담당교사ID, 대상학년, 분리여부
  const specialCourses = [
    ['자율(전체)', '자율', '(전체공통)', 'SPEC-001', '전체', 'N'],
    ['클럽(전체)', '클럽', '(전체공통)', 'SPEC-002', '전체', 'N'],
    ['자습(전체)', '자습', '(전체공통)', 'SPEC-003', '전체', 'N'],
  ];

  const masterData = masterSheet.getDataRange().getValues();
  const existingCodes = new Set(masterData.slice(1).map(r => r[0]));

  const coursesToAdd = specialCourses.filter(r => !existingCodes.has(r[0]));
  if (coursesToAdd.length > 0) {
    masterSheet.getRange(masterSheet.getLastRow() + 1, 1, coursesToAdd.length, 6)
      .setValues(coursesToAdd);
  }

  // ── 2. 기준_시간표에 자율/클럽 항목 추가 ────────────────────────────────
  // 헤더: 요일, 교시, 강좌코드, 담당교사
  const baseSheet = ss.getSheetByName('기준_시간표');

  const specialSchedules = [
    ['월', '7', '자율(전체)', '(전체공통)'],
    ['금', '7', '클럽(전체)', '(전체공통)'],
  ];

  const baseData = baseSheet.getDataRange().getValues();
  const existingKeys = new Set(
    baseData.slice(1).map(r => `${r[0]}_${r[1]}_${r[2]}`)
  );

  const schedulesToAdd = specialSchedules.filter(
    r => !existingKeys.has(`${r[0]}_${r[1]}_${r[2]}`)
  );

  if (schedulesToAdd.length > 0) {
    baseSheet.getRange(baseSheet.getLastRow() + 1, 1, schedulesToAdd.length, 4)
      .setValues(schedulesToAdd);
  }

  SpreadsheetApp.getUi().alert(
    `특수 과목 복구 완료!\n` +
    `- 강좌_마스터: ${coursesToAdd.length}개 추가 (자율/클럽/자습)\n` +
    `- 기준_시간표: ${schedulesToAdd.length}개 추가 (월7 자율, 금7 클럽)\n\n` +
    `다음 단계: generateDailyTimetable() 실행`
  );
}

// ─── 디버그용 함수 ────────────────────────────────────────────────────────────
// 실행 후 Apps Script 에디터 하단 "실행 로그" 탭에서 결과 확인
function debugRestoreSpecialCourses() {
  const t0 = Date.now();
  Logger.log('=== 디버그 시작 ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('[1] 스프레드시트 접근 완료: %s ms', Date.now() - t0);

  // 강좌_마스터 확인
  const masterSheet = ss.getSheetByName('강좌_마스터');
  Logger.log('[2] 강좌_마스터 시트 찾기 완료: %s ms', Date.now() - t0);

  const masterLastRow = masterSheet.getLastRow();
  Logger.log('[3] 강좌_마스터 행 수: %s (소요: %s ms)', masterLastRow, Date.now() - t0);

  const masterData = masterSheet.getDataRange().getValues();
  Logger.log('[4] 강좌_마스터 데이터 읽기 완료: %s ms', Date.now() - t0);

  const existingCodes = new Set(masterData.slice(1).map(r => r[0]));
  Logger.log('[5] 기존 강좌코드 Set 생성: %s개 (소요: %s ms)', existingCodes.size, Date.now() - t0);
  Logger.log('    자율(전체) 존재: %s', existingCodes.has('자율(전체)'));
  Logger.log('    클럽(전체) 존재: %s', existingCodes.has('클럽(전체)'));
  Logger.log('    자습(전체) 존재: %s', existingCodes.has('자습(전체)'));

  // 기준_시간표 확인
  const baseSheet = ss.getSheetByName('기준_시간표');
  Logger.log('[6] 기준_시간표 시트 찾기 완료: %s ms', Date.now() - t0);

  const baseLastRow = baseSheet.getLastRow();
  Logger.log('[7] 기준_시간표 행 수: %s (소요: %s ms)', baseLastRow, Date.now() - t0);

  const baseData = baseSheet.getDataRange().getValues();
  Logger.log('[8] 기준_시간표 데이터 읽기 완료: %s ms', Date.now() - t0);

  const existingKeys = new Set(baseData.slice(1).map(r => `${r[0]}_${r[1]}_${r[2]}`));
  Logger.log('[9] 기존 기준_시간표 Key Set: %s개 (소요: %s ms)', existingKeys.size, Date.now() - t0);
  Logger.log('    월_7_자율(전체) 존재: %s', existingKeys.has('월_7_자율(전체)'));
  Logger.log('    금_7_클럽(전체) 존재: %s', existingKeys.has('금_7_클럽(전체)'));

  Logger.log('=== 디버그 완료: 총 %s ms ===', Date.now() - t0);
}
