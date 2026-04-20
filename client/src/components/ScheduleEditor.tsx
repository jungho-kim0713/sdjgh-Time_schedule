import React, { useState, useEffect } from 'react';

interface Props {
  courses: any[];
  baseSchedules: any[];
  dailySchedules?: any[];
  teachers: any[];
  onUpdate?: () => void; // 부모 데이터 리프레시 함수
}

const ScheduleEditor: React.FC<Props> = ({ courses, baseSchedules, dailySchedules, teachers, onUpdate }) => {
  // 좌측 폼 State (세션 스토리지 연동하여 새로고침 시 유지)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return sessionStorage.getItem('editor_selectedDate') || '';
  });
  const [sourceTeacher, setSourceTeacher] = useState<string>(() => {
    return sessionStorage.getItem('editor_sourceTeacher') || 'all';
  });
  const [selectedPeriod, setSelectedPeriod] = useState<string>(''); // 클릭한 교시

  useEffect(() => {
    sessionStorage.setItem('editor_selectedDate', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    sessionStorage.setItem('editor_sourceTeacher', sourceTeacher);
  }, [sourceTeacher]);

  // 중앙 액션 State
  const [actionType, setActionType] = useState<string>('exchange'); // exchange, makeup, selfStudy, merge
  const [makeupType, setMakeupType] = useState<string>('same'); // same(동교과), diff(타교과)
  
  // 우측 필터 범위 State
  const [searchRange, setSearchRange] = useState<number>(7); // 탐색 허용 일수 (기본 7일)

  // 선택된 날짜의 요일 구하기('월', '화' 등)
  const getDayString = (dateStr: string) => {
    if (!dateStr) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date(dateStr).getDay()];
  };

  // 좌측 선생님의 해당 날짜 스케줄 뽑아오기
  const getSourceSchedules = () => {
     if (!selectedDate || sourceTeacher === 'all') return [];
     const dayOfWeek = getDayString(selectedDate);
     const teacherCourses = courses.filter(c => c['담당교사'] === sourceTeacher).map(c => c['강좌코드']);
     
     // 기준_시간표 베이스 추출
     let daySchedules = baseSchedules.filter(s => s['요일'] === dayOfWeek && teacherCourses.includes(s['강좌코드']));
     
     // 일별_시간표(dailySchedules) 이벤트 소싱 (보상 트랜잭션) 모델
     const todayChanges = dailySchedules?.filter(d => d['날짜'] === selectedDate) || [];
     
     // 키(교시_강좌코드) 기반 최신 Action Snapshot 생성
     const periodStatus: Record<string, any> = {};
     todayChanges.forEach(change => {
         const key = `${change['교시']}_${change['강좌코드']}`;
         // 취소나 정상이 발생하면 해당 변경 상태 리셋(원복)
         if (change['상태'] === '취소' || change['상태'] === '정상') {
             delete periodStatus[key];
         } else {
             // 교체/보강 등은 계속 덮어씀 (가장 하단의 최신 로직 유지)
             periodStatus[key] = change;
         }
     });

     // 최신 상태 기반으로 Base 스케줄 Override
     Object.values(periodStatus).forEach(change => {
         if (change['상태'] === '이동(OUT)') {
             // 이 수업은 해당 시간에 빠집니다
             daySchedules = daySchedules.filter(s => !(String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']));
         }
         else if (change['상태'] === '이동(IN)') {
             // 이 수업이 새로 추가됩니다
             if (change['변경교사'] === sourceTeacher) {
                 const isDuplicate = daySchedules.some(s => String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드'] && s.isOverride);
                 if (!isDuplicate) {
                     // 원래 내가 위치했던 시간대를 추적
                     const myOutTx = dailySchedules?.find(d => d['사유'] === change['사유'] && d['상태'] === '이동(OUT)' && d['원래교사'] === sourceTeacher);
                     let originalTimeSpan = '(시간표 변경)';
                     if (myOutTx) {
                         originalTimeSpan = `${myOutTx['날짜']} ${myOutTx['교시']}교시`;
                     }

                     daySchedules.push({
                         '요일': dayOfWeek,
                         '교시': change['교시'],
                         '강좌코드': change['강좌코드'],
                         'isOverride': true,
                         'originalTeacher': originalTimeSpan,
                         'status': '시간표 스왑',
                         'reason': change['사유']
                     });
                 }
             }
         }
         // 기존 보강/대강 호환성
         else if (change['원래교사'] === sourceTeacher && change['변경교사'] !== sourceTeacher) {
             daySchedules = daySchedules.filter(s => !(String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드']));
         }
         else if (change['변경교사'] === sourceTeacher && change['원래교사'] !== sourceTeacher) {
             const isDuplicate = daySchedules.some(s => String(s['교시']) === String(change['교시']) && s['강좌코드'] === change['강좌코드'] && s.isOverride);
             if (!isDuplicate) {
                 daySchedules.push({
                     '요일': dayOfWeek,
                     '교시': change['교시'],
                     '강좌코드': change['강좌코드'],
                     'isOverride': true,
                     'originalTeacher': change['원래교사'],
                     'status': change['상태'],
                     'reason': change['사유']
                 });
             }
         }
     });

     daySchedules.sort((a, b) => parseInt(a['교시']) - parseInt(b['교시']));
     return daySchedules;
  };
  
  const sourceSchedules = getSourceSchedules();

  // 기능 헬퍼: 강좌코드에서 괄호 안의 타겟 클래스 문자열 추출 (예: '영1(2-3)' -> '2-3')
  const extractClassInfo = (code: string) => {
     if(!code) return null;
     const match = code.match(/\((.*?)\)/);
     return match ? match[1] : null;
  };

  // 중앙 필터옵션에 따른 우측 자동 추천 타겟 계산
  const getTargetList = () => {
    if (!selectedPeriod || !selectedDate) return [];
    const sourceSchedule = sourceSchedules.find(s => s['교시'] === selectedPeriod);
    if (!sourceSchedule) return [];

    const sourceCourseInfo = courses.find(c => c['강좌코드'] === sourceSchedule['강좌코드']);
    const sourceTeacherObj = teachers.find(t => t['교사명'] === sourceTeacher);
    const sourceDept = sourceTeacherObj?.['교과'] || '';
    const sourceClassInfo = extractClassInfo(sourceSchedule['강좌코드']);
    
    let targets: any[] = [];
    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const baseDate = new Date(selectedDate);
    const searchDateStrings: string[] = [];
    
    // 교체와 통합은 지정된 탐색 범위를 사용
    const actualRange = (actionType === 'exchange' || actionType === 'merge') ? searchRange : 0;
    
    if (actualRange === 0) {
        searchDateStrings.push(selectedDate);
    } else {
        for (let i = -actualRange; i <= actualRange; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            const dStr = d.toISOString().split('T')[0];
            const dayOfWeek = getDayString(dStr);
            // 오늘 이후(과거 차단) & 주말은 제외
            if (dStr >= todayStr && dayOfWeek !== '토' && dayOfWeek !== '일') {
                searchDateStrings.push(dStr);
            }
        }
    }

    // 조건 B 검증용 헬퍼: "나(Source교사)"가 특정 날짜 특정 교시에 수업이 있나?
    const amIBusyAt = (testDate: string, period: string) => {
        const dayOfWeek = getDayString(testDate);
        const myCourses = courses.filter(c => c['담당교사'] === sourceTeacher).map(c => c['강좌코드']);
        const mySchedulesOnDay = baseSchedules.filter(s => s['요일'] === dayOfWeek && myCourses.includes(s['강좌코드']));
        return mySchedulesOnDay.some(s => String(s['교시']) === String(period));
    };

    // 타겟 검색 메인 루프 (복수 날짜 탐색)
    searchDateStrings.forEach(sDate => {
        const sDayOfWeek = getDayString(sDate);
        const baseSchedulesForTargetDay = baseSchedules.filter(s => s['요일'] === sDayOfWeek);

        teachers.forEach(target => {
           if (target['교사명'] === sourceTeacher) return;
           const targetCourses = courses.filter(c => c['담당교사'] === target['교사명']).map(c => c['강좌코드']);
           const targetSchedulesOnDate = baseSchedulesForTargetDay.filter(s => targetCourses.includes(s['강좌코드']));

           if (actionType === 'exchange') {
               // 조건 A: 타겟이 "내 원래 스케줄 날짜/시간(selectedDate, selectedPeriod)"에 공강인가?
               const srcDayOfWeek = getDayString(selectedDate);
               const targetSchedulesOnSrcDate = baseSchedules.filter(s => s['요일'] === srcDayOfWeek && targetCourses.includes(s['강좌코드']));
               const isTargetBusyAtSource = targetSchedulesOnSrcDate.some(s => String(s['교시']) === String(selectedPeriod));
               if (isTargetBusyAtSource) return;

               // 타겟의 "sDate" (탐색일) 스케줄을 돌면서 교환 가능한 대상 수업을 찾는다.
               targetSchedulesOnDate.forEach(tSch => {
                   // 클레스 매칭 검사
                   const tSchClassInfo = extractClassInfo(tSch['강좌코드']);
                   if (sourceClassInfo && tSchClassInfo !== sourceClassInfo) return; 

                   // 조건 B: 내가 "타겟의 대상 수업(sDate, tSch['교시'])" 시간에 공강인가?
                   if (!amIBusyAt(sDate, tSch['교시'])) {
                       const tCourseInfo = courses.find(c => c['강좌코드'] === tSch['강좌코드']);
                       targets.push({
                           date: sDate, // 타겟 수업의 실제 날짜
                           period: tSch['교시'], 
                           courseCode: tSch['강좌코드'],
                           courseName: tCourseInfo?.['과목명'] || '',
                           teacherName: target['교사명'],
                           status: '교체 가능 (양방향)'
                       });
                   }
               });
           } 
           else if (actionType === 'makeup') {
               // 당일(selectedDate) 탐색 전용
               const isTargetBusyAtSourcePeriod = targetSchedulesOnDate.some(s => String(s['교시']) === String(selectedPeriod));
               if (isTargetBusyAtSourcePeriod) return; 
               if (makeupType === 'same' && target['교과'] === sourceDept) {
                   targets.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], courseName: sourceCourseInfo?.['과목명']||'', teacherName: target['교사명'], status: '동교과 보강 가능' });
               } else if (makeupType === 'diff' && target['교과'] !== sourceDept) {
                   targets.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], courseName: sourceCourseInfo?.['과목명']||'', teacherName: target['교사명'], status: '타교과 보강 가능' });
               }
           }
           else if (actionType === 'selfStudy') {
               const isTargetBusyAtSourcePeriod = targetSchedulesOnDate.some(s => String(s['교시']) === String(selectedPeriod));
               if (!isTargetBusyAtSourcePeriod) {
                   targets.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], courseName: '자습', teacherName: target['교사명'], status: '자습 감독 가능' });
               }
           }
           else if (actionType === 'merge') {
               if (!sourceClassInfo) return;
               
               // 1. "해당 시간(selectedPeriod)에 수업을 하고 있는 선생님"
               const targetCourseAtSourcePeriod = targetSchedulesOnDate.find(s => String(s['교시']) === String(selectedPeriod));
               
               if (targetCourseAtSourcePeriod) {
                   // 2. "해당 학급(sourceClassInfo)에 수업이 예정된 선생님" (이번 학기 전체 담당 강좌 중 확인)
                   const teachesSourceClassInfo = targetCourses.some(code => extractClassInfo(code) === sourceClassInfo);
                   
                   if (teachesSourceClassInfo) {
                       const targetCourseInfo = courses.find(c => c['강좌코드'] === targetCourseAtSourcePeriod['강좌코드']);
                       const cName = targetCourseInfo ? targetCourseInfo['과목명'] : targetCourseAtSourcePeriod['강좌코드'].split(' ')[0];
                       
                       if (makeupType === 'same' && target['교과'] === sourceDept) {
                           targets.push({ date: sDate, period: selectedPeriod, courseCode: targetCourseAtSourcePeriod['강좌코드'], courseName: cName, teacherName: target['교사명'], status: '동교과 통합 합반' });
                       } else if (makeupType === 'diff' && target['교과'] !== sourceDept) {
                           targets.push({ date: sDate, period: selectedPeriod, courseCode: targetCourseAtSourcePeriod['강좌코드'], courseName: cName, teacherName: target['교사명'], status: '타교과 통합 합반' });
                       }
                   }
               }
           }
        });
    });

    return targets;
  };

  const targetList = getTargetList();

  const handleApply = async (target: any) => {
     const reason = window.prompt(`선택하신 알고리즘(${target.status})으로 시간표를 수정합니다.\n\n적용 사유를 간단히 적어주세요 (예: 연가, 결보강 등):`);
     if (reason === null) return; // 취소
     
     const payloads = [];
     const sourceSchedule = sourceSchedules.find(s => s['교시'] === selectedPeriod);

     if (actionType === 'exchange') {
         // 스왑(시간표 이동) 모드 작동: 1Tx 안에 4개의 행이 들어감. 사유 란에 고유키 생성.
         const txID = `[교체-${new Date().getTime().toString().slice(-6)}] ${reason}`;
         
         // 1. 내 현재 수업 자리 비우기
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: '', status: '이동(OUT)', reason: txID });
         // 2. 타겟 교사의 시간에 내 수업을 개설
         payloads.push({ date: target.date, period: target.period, courseCode: sourceSchedule['강좌코드'], sourceTeacher: '', targetTeacher: sourceTeacher, status: '이동(IN)', reason: txID });
         
         // 3. 타겟의 원래 수업 지우기
         payloads.push({ date: target.date, period: target.period, courseCode: target.courseCode, sourceTeacher: target.teacherName, targetTeacher: '', status: '이동(OUT)', reason: txID });
         // 4. 내 원래 수업시간에 타겟의 수업을 개설
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: target.courseCode, sourceTeacher: '', targetTeacher: target.teacherName, status: '이동(IN)', reason: txID });

     } else if (actionType === 'makeup') {
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: target.teacherName, status: '보강', reason });
     } else if (actionType === 'selfStudy') {
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: target.teacherName, status: '자습', reason });
     } else if (actionType === 'merge') {
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: target.teacherName, status: '통합', reason });
     }

     try {
         const response = await fetch('/api/schedule/update', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ payloads })
         });
         const data = await response.json();
         if (data.success) {
            alert('구글 스프레드시트에 성공적으로 저장되었습니다!');
            if (onUpdate) onUpdate(); // 새로고침 없이 최신 데이터 패치
         } else {
            alert('저장에 실패했습니다: ' + (data.message || '알 수 없는 오류'));
         }
     } catch (err) {
         alert('서버 오류가 발생했습니다. 데몬이 실행 중인지 확인하세요.');
     }
  };

  const handleCancelAction = async (schedule: any) => {
     if (!window.confirm(`[${schedule['교시']}교시 ${schedule['강좌코드']}] 변경 내역을 취소(정상 복구) 하시겠습니까?`)) return;
     const payloads = [];
     
     if (schedule.status === '시간표 스왑' || schedule.status === '이동(IN)' || schedule.status === '이동(OUT)') {
         const txChanges = dailySchedules?.filter(d => d['사유'] === schedule.reason) || [];
         if (txChanges.length > 0) {
             txChanges.forEach(tx => {
                 payloads.push({ 
                     date: tx['날짜'], 
                     period: tx['교시'], 
                     courseCode: tx['강좌코드'], 
                     sourceTeacher: tx['변경교사'] || tx['원래교사'], 
                     targetTeacher: tx['원래교사'] || tx['변경교사'], 
                     status: '취소', 
                     reason: '시간표 스왑 취소 복구' 
                 });
             });
         } else {
             // Fallback
             payloads.push({ date: selectedDate, period: schedule['교시'], courseCode: schedule['강좌코드'], sourceTeacher: schedule.originalTeacher, targetTeacher: sourceTeacher, status: '취소', reason: '시간표 스왑 부분 복구' });
         }
     } else if (schedule.status === '교체') {
         // 변경된 내역 등록 (취소)
         payloads.push({ date: selectedDate, period: schedule['교시'], courseCode: schedule['강좌코드'], sourceTeacher: schedule.originalTeacher, targetTeacher: sourceTeacher, status: '취소', reason: '사용자 요청 취소' });
         
         // 맞교체 된 반대쪽 쌍을 찾아 같이 '취소' 상계 처리
         const pairChange = dailySchedules?.find(d => d['날짜'] === selectedDate && d['상태'] === '교체' && d['원래교사'] === sourceTeacher && d['변경교사'] === schedule.originalTeacher);
         if (pairChange) {
             payloads.push({ date: selectedDate, period: pairChange['교시'], courseCode: pairChange['강좌코드'], sourceTeacher: sourceTeacher, targetTeacher: schedule.originalTeacher, status: '취소', reason: '교체 양방향 쌍 취소' });
         }
     } else {
         payloads.push({ date: selectedDate, period: schedule['교시'], courseCode: schedule['강좌코드'], sourceTeacher: schedule.originalTeacher, targetTeacher: sourceTeacher, status: '취소', reason: '사용자 요청 취소' });
     }

     try {
         const response = await fetch('/api/schedule/update', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ payloads })
         });
         const data = await response.json();
         if (data.success) {
            alert('변경 내역이 성공적으로 취소(복구) 되었습니다!');
            if (onUpdate) onUpdate(); // 새로고침 없이 최신 데이터 패치
         } else {
            alert('취소 처리에 실패했습니다.');
         }
     } catch (err) {}
  };

  return (
    <div style={{ display: 'flex', gap: '30px', animation: 'fadeInUp 0.8s' }}>
      
      {/* 좌측 패널: Source (내 변경할 시간 선택) */}
      <div className="double-bezel-outer" style={{ width: '400px', flexShrink: 0 }}>
        <div className="double-bezel-inner" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', padding: '24px' }}>
          
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>원본 교시 선택 (Source)</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom:'6px', display:'block' }}>날짜 (Date)</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', outline: 'none', marginBottom: 0 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom:'6px', display:'block' }}>교사 (Teacher)</label>
                <select value={sourceTeacher} onChange={(e) => setSourceTeacher(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', outline: 'none' }}>
                  <option value="all" style={{color: 'black'}}>내 이름(교사)을 선택하세요</option>
                  {teachers.map(t => <option key={`src-${t['교사ID']}`} value={t['교사명']} style={{color: 'black'}}>{t['교사명']}</option>)}
                </select>
              </div>
            </div>
            
          </div>

          {/* 좌측 임시 미니맵 또는 선택 리스트 뷰 */}
          <div style={{ flex: 1, marginTop: '20px' }}>
             {selectedDate && sourceTeacher !== 'all' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>이 날짜의 실제 수업 리스트 (클릭해서 선택)</p>
                   {sourceSchedules.length > 0 ? (
                     sourceSchedules.map((schedule, idx) => {
                       const courseInfo = courses.find(c => c['강좌코드'] === schedule['강좌코드']);
                       const isSelected = selectedPeriod === schedule['교시'];
                       return (
                         <div key={`src-sch-${idx}`} 
                              onClick={() => setSelectedPeriod(schedule['교시'])}
                              style={{ padding: '20px', background: isSelected ? 'rgba(74, 144, 226, 0.2)' : 'rgba(255,255,255,0.03)', border: isSelected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', cursor: 'pointer', transition: 'var(--transition-spring)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                               <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
                                 <span>{schedule['교시']}교시 - {courseInfo ? courseInfo['과목명'] : schedule['강좌코드'].split(' ')[0]}</span>
                               </div>
                               <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  <span style={{color: '#ffb86c'}}>{schedule['강좌코드'].split(' ')[0]}</span> 
                                  {courseInfo?.['대상학년'] ? ` · ${courseInfo['대상학년']}학년` : ''}
                               </div>

                               {schedule.isOverride && (
                                  <div style={{ marginTop: '2px' }}>
                                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 85, 85, 0.2)', color: '#ff5555', padding: '4px 8px', borderRadius: '4px', fontWeight: 400 }}>
                                      {schedule.status === '시간표 스왑' ? `교체 투입 (원래: ${schedule.originalTeacher})` : `${schedule.status} 투입 (원래: ${schedule.originalTeacher})`}
                                    </span>
                                  </div>
                               )}
                            </div>

                            {schedule.isOverride && (
                               <button onClick={(e) => { e.stopPropagation(); handleCancelAction(schedule); }} 
                                       style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255, 85, 85, 0.1)', color: '#ff5555', border: '1px solid rgba(255,85,85,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.9rem', transition: 'var(--transition-spring)' }}>
                                 취소
                               </button>
                            )}
                         </div>
                       )
                     })
                   ) : (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                         해당 날짜({getDayString(selectedDate)}요일)에 배정된 수업이 없습니다.
                      </p>
                   )}
                </div>
             ) : (
                <div style={{ height:'100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>날짜와 교사를 선택하세요.</p>
                </div>
             )}
          </div>

        </div>
      </div>

      {/* 중앙 액션 영역 (스크롤에 밀리지 않게 고정 속성 부여) */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px', flexShrink: 0, width: '160px', position: 'sticky', top: '100px', height: 'fit-content', alignSelf: 'center' }}>
        
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--glass-outer)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>수정 상태 선택</label>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.2)', padding:'10px 12px', borderRadius:'12px', fontSize:'0.9rem', outline:'none', textAlign:'center', cursor:'pointer' }}>
            <option value="exchange" style={{color:'black'}}>수업 교체</option>
            <option value="makeup" style={{color:'black'}}>수업 보강</option>
            <option value="selfStudy" style={{color:'black'}}>수업 자습</option>
            <option value="merge" style={{color:'black'}}>클래스 통합</option>
          </select>
        </div>

        {/* 보강 및 통합일 경우 하위 필터 토글 */}
        {(actionType === 'makeup' || actionType === 'merge') && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', display: 'flex', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div onClick={() => setMakeupType('same')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: makeupType === 'same' ? 'var(--accent)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>동교과</div>
             <div onClick={() => setMakeupType('diff')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: makeupType === 'diff' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>타교과</div>
          </div>
        )}

      </div>

      {/* 우측 패널: Target (다이나믹 추천 리스트 뷰) */}
      <div className="double-bezel-outer" style={{ flex: 1, flexShrink: 1, maxHeight: '800px' }}>
        <div className="double-bezel-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '32px' }}>
          
          <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>추천 가능 목록 (TARGET)</span>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
               <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>탐색 범위:</span>
               <select value={(actionType === 'exchange' || actionType === 'merge') ? searchRange : 0} onChange={(e) => setSearchRange(Number(e.target.value))} 
                       disabled={!(actionType === 'exchange' || actionType === 'merge')}
                       style={{ 
                         background: !(actionType === 'exchange' || actionType === 'merge') ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)', 
                         color: !(actionType === 'exchange' || actionType === 'merge') ? 'rgba(255,255,255,0.3)' : 'white', 
                         border:'1px solid rgba(255,255,255,0.1)', 
                         padding:'4px 8px', borderRadius:'6px', outline:'none', fontSize:'0.8rem', 
                         cursor: !(actionType === 'exchange' || actionType === 'merge') ? 'not-allowed' : 'pointer' 
                       }}>
                 <option value={0} style={{color:'black'}}>당일만</option>
                 <option value={7} style={{color:'black'}}>±1주일 (14일)</option>
                 <option value={14} style={{color:'black'}}>±2주일 (28일)</option>
               </select>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
            {!selectedPeriod ? (
                <div style={{ height:'100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>좌측에서 타겟 교시를 누르면<br/>알고리즘 조건에 맞는 대상 목록이 나타납니다.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                   {targetList.length > 0 ? targetList.map((target, idx) => (
                      <div key={`tgt-${idx}`} style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                           <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '6px' }}>
                             {target.teacherName} <span style={{fontSize:'0.9rem', color:'var(--text-secondary)', fontWeight: 400}}>님</span>
                           </div>
                           {/* 중요: 사용자가 명시한 날짜, 교시, 강좌코드, 상태 필수 표출 */}
                           <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                             <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px'}}>{target.date}</span>
                             <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px'}}>{target.period}교시</span>
                             <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px', color: '#ffb86c'}}>{target.courseCode.split(' ')[0]}</span>
                             <span style={{background:'rgba(74, 144, 226, 0.1)', color:'#8be9fd', padding:'2px 8px', borderRadius:'4px'}}>{target.status}</span>
                           </div>
                        </div>
                        <button onClick={() => handleApply(target)} 
                                style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'white', color: 'black', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.2s', lineHeight: '1.2' }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                           <span>선택</span><span>적용</span>
                        </button>
                      </div>
                   )) : (
                      <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                         <p style={{ color: 'var(--text-secondary)' }}>이 조건에 맞는 선생님이 없습니다.</p>
                      </div>
                   )}
                </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

export default ScheduleEditor;
