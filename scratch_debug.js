/**
 * 진단 스크립트 — '2026(1)' 원본 시트에서 특정 교사의 raw 데이터 확인
 * Apps Script 에디터에 붙여넣고 diagnoseParsing() 실행
 * 실행 로그 탭에서 결과 확인
 */
function diagnoseParsing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName('2026(1)');
  const lastRow = sourceSheet.getLastRow();
  const lastCol = sourceSheet.getLastColumn();
  const data = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();

  Logger.log('=== 원본 시트 기본 정보 ===');
  Logger.log('전체 행 수: %s, 전체 열 수: %s', lastRow, lastCol);

  // 1행~4행 헤더 구조 파악
  Logger.log('\n=== 헤더 행 (1~4행) ===');
  for (let r = 0; r < Math.min(4, data.length); r++) {
    Logger.log('행 %s: %s', r + 1, JSON.stringify(data[r].slice(0, 40)));
  }

  // 김선아, 김태엽 행 번호 찾기
  const targets = ['김선아', '김태엽'];
  const found = {};
  for (let i = 0; i < data.length; i++) {
    const name = String(data[i][2] || '').trim();
    if (targets.includes(name)) {
      found[name] = i;
      Logger.log('\n=== %s 발견: %s행 (0-index) ===', name, i);
      Logger.log('전체 행 raw: %s', JSON.stringify(data[i].slice(0, 40)));

      // 목요일(dayIdx=3) 컬럼 상세
      Logger.log('-- 목요일 교시별 값 (colIdx = 3 + 3*7 + period-1) --');
      for (let p = 1; p <= 7; p++) {
        const colIdx = 3 + (3 * 7) + (p - 1); // 목요일 dayIdx=3
        const val = data[i][colIdx];
        Logger.log('  목 %s교시 (colIdx %s): [%s]', p, colIdx, val);
      }
    }
  }

  if (Object.keys(found).length < 2) {
    Logger.log('\n⚠️ 두 교사 중 일부를 찾지 못했습니다. 이름이 다를 수 있습니다.');
    Logger.log('발견된 교사 이름 전체 목록:');
    for (let i = 4; i < data.length; i++) {
      const name = String(data[i][2] || '').trim();
      if (name) Logger.log('  행%s: [%s]', i, name);
    }
  }

  // 두 행이 모두 발견된 경우 인접 행 비교
  if (found['김선아'] !== undefined && found['김태엽'] !== undefined) {
    Logger.log('\n=== 두 교사 행 번호 비교 ===');
    Logger.log('김선아: %s행, 김태엽: %s행, 차이: %s행', found['김선아'], found['김태엽'], found['김태엽'] - found['김선아']);

    // 두 행 사이 모든 행 확인
    const start = Math.min(found['김선아'], found['김태엽']);
    const end = Math.max(found['김선아'], found['김태엽']);
    for (let r = start; r <= end; r++) {
      const rowName = String(data[r][2] || '').trim();
      const thuPeriod3 = data[r][3 + 3 * 7 + 2]; // 목 3교시
      const thuPeriod6 = data[r][3 + 3 * 7 + 5]; // 목 6교시
      Logger.log('행%s [교사:%s] 목3교시:[%s], 목6교시:[%s]', r, rowName, thuPeriod3, thuPeriod6);
    }
  }
}
