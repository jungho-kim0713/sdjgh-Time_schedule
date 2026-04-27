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
  const [actionType, setActionType] = useState<string>('exchange'); // exchange, makeup, realMakeup, selfStudy, merge
  const [makeupType, setMakeupType] = useState<string>('same'); // same(동교과), diff(타교과)
  const [realMakeupType, setRealMakeupType] = useState<string>('selfStudyTime'); // selfStudyTime(자습 시간), classTime(수업 시간)
  
  // 우측 필터 범위 State
  const [searchRange, setSearchRange] = useState<number>(7); // 탐색 허용 일수 (기본 7일)

  // 모달 State 추가
  const [previewTarget, setPreviewTarget] = useState<any>(null);
  const [previewReason, setPreviewReason] = useState<string>('');

  // 주간 날짜 배열 생성 헬퍼
  const getWeekDates = (dateStr: string) => {
     if(!dateStr) return [];
     const d = new Date(dateStr);
     const day = d.getDay() || 7;
     d.setDate(d.getDate() - day + 1);
     return ['월', '화', '수', '목', '금'].map((_, idx) => {
        const nd = new Date(d);
        nd.setDate(d.getDate() + idx);
        return nd.toISOString().split('T')[0];
     });
  };

  // 선택된 날짜의 요일 구하기('월', '화' 등)
  const getDayString = (dateStr: string) => {
    if (!dateStr) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date(dateStr).getDay()];
  };

  // 특정 교사의 해당 셀의 시뮬레이션 된 시간표 조회
  const getTeacherCell = (teacherName: string, dateStr: string, dayStr: string, period: string, isPreview: boolean = false, previewTgt: any = null) => {
     const myCourses = courses.filter(c => c['담당교사'] === teacherName).map(c => c['강좌코드']);
     let baseList = baseSchedules.filter(s => s['요일'] === dayStr && String(s['교시']) === String(period) && myCourses.includes(s['강좌코드']));
     
     // 1. 기존 변경사항(dailySchedules) 적용
     const changes = dailySchedules?.filter(d => d['날짜'] === dateStr && String(d['교시']) === String(period)) || [];
     const overrideMap: Record<string, any> = {};
     changes.forEach(change => {
         const key = change['강좌코드'];
         if (change['상태'] === '취소' || change['상태'] === '정상') {
             delete overrideMap[key];
         } else {
             overrideMap[key] = change;
         }
     });

     Object.values(overrideMap).forEach(change => {
         const involvesTeacher = (change['원래교사'] === teacherName) || (change['변경교사'] === teacherName);
         if (!involvesTeacher && !myCourses.includes(change['강좌코드'])) return;

         if (change['상태'] === '이동(OUT)' || (change['원래교사'] === teacherName && change['변경교사'] !== teacherName)) {
             baseList = baseList.filter(b => b['강좌코드'] !== change['강좌코드']);
         } else if (change['상태'] === '이동(IN)' || (change['변경교사'] === teacherName && change['원래교사'] !== teacherName)) {
             const existingIdx = baseList.findIndex(b => b['강좌코드'] === change['강좌코드']);
             const overrideItem = { ...change, isOverride: true, status: change['상태'] };
             if (existingIdx >= 0) baseList[existingIdx] = overrideItem;
             else baseList.push(overrideItem);
         }
     });

     // 2. 가상 적용 (Preview)
     if (isPreview && previewTgt) {
         if (teacherName === sourceTeacher) {
             if (dateStr === selectedDate && String(period) === String(selectedPeriod)) {
                 baseList = baseList.map(b => ({ ...b, _previewRemoved: true }));
             }
             if (actionType === 'exchange' && dateStr === previewTgt.date && String(period) === String(previewTgt.period)) {
                 baseList.push({ 강좌코드: previewTgt.courseCode, isOverride: true, status: '이동(IN)', _previewAdded: true });
             } else if (actionType === 'realMakeup') {
                 if (dateStr === selectedDate && String(period) === String(selectedPeriod)) {
                     baseList = baseList.map(b => ({ ...b, _previewRemoved: true }));
                 }
                 if (dateStr === previewTgt.date && String(period) === String(previewTgt.period)) {
                     const sInfo = sourceSchedules.find(s => s['교시'] === selectedPeriod);
                     if (sInfo) {
                         baseList.push({ 강좌코드: sInfo['강좌코드'], isOverride: true, status: '보강', _previewAdded: true });
                     }
                 }
             }
         }
         if (teacherName === previewTgt.teacherName && previewTgt.teacherName !== '비어있음') {
             if (actionType === 'exchange') {
                 if (dateStr === previewTgt.date && String(period) === String(previewTgt.period)) {
                     baseList = baseList.map(b => ({ ...b, _previewRemoved: true }));
                 }
                 if (dateStr === selectedDate && String(period) === String(selectedPeriod)) {
                     const sInfo = sourceSchedules.find(s => s['교시'] === selectedPeriod);
                     if (sInfo) {
                         baseList.push({ 강좌코드: sInfo['강좌코드'], isOverride: true, status: '이동(IN)', _previewAdded: true });
                     }
                 }
             } else if (actionType === 'realMakeup') {
                 if (dateStr === previewTgt.date && String(period) === String(previewTgt.period)) {
                     baseList = baseList.map(b => ({ ...b, _previewRemoved: true }));
                 }
             } else {
                 if (dateStr === selectedDate && String(period) === String(selectedPeriod)) {
                     if (actionType === 'merge') {
                         // 통합: 대상 교사의 기존 수업에 원본 학급 학생이 합류 → 기존 수업을 통합 표시로 변경
                         baseList = baseList.map(b => ({ ...b, isOverride: true, status: '통합', _previewAdded: true }));
                     } else {
                         const sInfo = sourceSchedules.find(s => s['교시'] === selectedPeriod);
                         if (sInfo) {
                             const statusText = actionType === 'makeup' ? '대강' : '자습';
                             baseList.push({ 강좌코드: sInfo['강좌코드'], isOverride: true, status: statusText, _previewAdded: true });
                         }
                     }
                 }
             }
         }
     }

     return { list: baseList };
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


    // uc218uc5c5 uc790uc2b5: ub300uc0c1 uc120uc0ddub2d8 uc5c6uc774 ud574ub2f9 uc218uc5c5uc744 uc790uc2b5uc73cub85c uc804ud658
    if (actionType === 'selfStudy') {
      const sourceSchedule2 = sourceSchedules.find(s => s['\uad50\uc2dc'] === selectedPeriod);
      if (!sourceSchedule2) return [];
      const sCourseName = courses.find(c => c['\uac15\uc88c\ucf54\ub4dc'] === sourceSchedule2['\uac15\uc88c\ucf54\ub4dc'])?.['\uacfc\ubaa9\uba85'] || sourceSchedule2['\uac15\uc88c\ucf54\ub4dc'];
      return [{ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule2['\uac15\uc88c\ucf54\ub4dc'], courseName: sCourseName, teacherName: '(\uc5c6\uc74c)', status: '\uc790\uc2b5 \uc804\ud658' }];
    }
    const sourceCourseInfo = courses.find(c => c['강좌코드'] === sourceSchedule['강좌코드']);
    const sourceTeacherObj = teachers.find(t => t['교사명'] === sourceTeacher);
    const sourceDept = sourceTeacherObj?.['교과'] || '';
    const sourceClassInfo = extractClassInfo(sourceSchedule['강좌코드']);
    
    let targets: any[] = [];
    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const baseDate = new Date(selectedDate);
    const searchDateStrings: string[] = [];
    
    // 교체, 보강은 지정된 탐색 범위를 사용 (통합은 항상 당일만)
    const actualRange = (actionType === 'exchange' || actionType === 'realMakeup') ? searchRange : 0;
    
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

        if (actionType === 'realMakeup') {
            if (!sourceClassInfo) return;
            const periods = ['1', '2', '3', '4', '5', '6', '7'];
            periods.forEach(p => {
                if (amIBusyAt(sDate, p)) return;

                // 월7(자율) / 금7(클럽) — 전교생 특수 과목이 배정된 시간은 보강 불가
                const hasSpecialCourse = baseSchedulesForTargetDay.some(
                    s => String(s['교시']) === String(p) &&
                         (s['강좌코드'] === '자율(전체)' || s['강좌코드'] === '클럽(전체)')
                );
                if (hasSpecialCourse) return;

                const classSchs = baseSchedulesForTargetDay.filter(s => String(s['교시']) === String(p) && extractClassInfo(s['강좌코드']) === sourceClassInfo);
                const hasClass = classSchs.length > 0;
                let targetTeacherName = '';
                let targetCourseCode = '';
                let isSelfStudy = false;

                if (hasClass) {
                    targetCourseCode = classSchs[0]['강좌코드'];
                    const tCourseInfo = courses.find(c => c['강좌코드'] === targetCourseCode);
                    targetTeacherName = tCourseInfo ? tCourseInfo['담당교사'] : '';

                    const daily = dailySchedules?.find(d => d['날짜'] === sDate && String(d['교시']) === String(p) && d['강좌코드'] === targetCourseCode);
                    if (daily && daily['상태'] === '자습') {
                        isSelfStudy = true;
                    }
                }

                if (realMakeupType === 'selfStudyTime') {
                    if (!hasClass || isSelfStudy) {
                        targets.push({
                            date: sDate,
                            period: p,
                            courseCode: targetCourseCode || sourceSchedule['강좌코드'],
                            courseName: !hasClass ? '해당 학급 공강' : '자습 설정됨',
                            teacherName: targetTeacherName || '비어있음',
                            status: '보강 가능 (자습/공강)'
                        });
                    }
                } else if (realMakeupType === 'classTime') {
                    if (hasClass && !isSelfStudy && targetTeacherName !== sourceTeacher) {
                        targets.push({
                            date: sDate,
                            period: p,
                            courseCode: targetCourseCode,
                            courseName: courses.find(c => c['강좌코드'] === targetCourseCode)?.['과목명'] || targetCourseCode.split(' ')[0],
                            teacherName: targetTeacherName,
                            status: '보강 가능 (타교사 수업)'
                        });
                    }
                }
            });
        }

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
                   targets.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], courseName: sourceCourseInfo?.['과목명']||'', teacherName: target['교사명'], status: '동교과 대강 가능' });
               } else if (makeupType === 'diff' && target['교과'] !== sourceDept) {
                   targets.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], courseName: sourceCourseInfo?.['과목명']||'', teacherName: target['교사명'], status: '타교과 대강 가능' });
               }
           }
            else if (actionType === 'selfStudy') {

                // uc218uc5c5 uc790uc2b5: ub300uc0c1 uc120uc0ddub2d8 uc5c6uc774 ud574ub2f9 uc218uc5c5uc744 uc790uc2b5uc73cub85c uc804ud658 (ub300uc0c1 uc120uc0ddub2d8 = uc5c6uc74c)

                // uc774 ub85cuc9c1uc740 teachers.forEach ub8e8ud504 c14uae65 ucc98ub9acud558ubbc0ub85c uc5ecuae30uc11c ubc14ub85c return

                return;

            }
           else if (actionType === 'merge') {
               if (!sourceClassInfo) return;

               // 해당 날짜/교시에 대상 교사가 수업 중인지 확인
               const targetCourseAtSourcePeriod = targetSchedulesOnDate.find(s => String(s['교시']) === String(selectedPeriod));
               if (!targetCourseAtSourcePeriod) return;

               // 해당 교시에 가르치는 학급이 원본 학급(sourceClassInfo)이면 제외
               const targetCourseClassInfo = extractClassInfo(targetCourseAtSourcePeriod['강좌코드']);
               if (targetCourseClassInfo === sourceClassInfo) return;

               // 대상 교사가 sourceClassInfo 학급을 담당하는 과목이 있어야 함 → 과목명 추출
               const sourceClassCourse = courses.find(
                   c => c['담당교사'] === target['교사명'] && extractClassInfo(c['강좌코드']) === sourceClassInfo
               );
               if (!sourceClassCourse) return;

               // 해당 교시의 과목명이 sourceClassInfo에서 가르치는 과목명과 일치해야 합반 가능
               const targetPeriodCourseInfo = courses.find(c => c['강좌코드'] === targetCourseAtSourcePeriod['강좌코드']);
               if (!targetPeriodCourseInfo) return;

               if (sourceClassCourse['과목명'] === targetPeriodCourseInfo['과목명']) {
                   targets.push({
                       date: sDate,
                       period: selectedPeriod,
                       courseCode: targetCourseAtSourcePeriod['강좌코드'],
                       courseName: `${targetPeriodCourseInfo['과목명']} (${targetCourseClassInfo}반)`,
                       teacherName: target['교사명'],
                       status: '합반 통합 가능'
                   });
               }
           }
        });
    });

    return targets;
  };

  const targetList = getTargetList();

  const handleApplyClick = (target: any) => {
      setPreviewTarget(target);
      setPreviewReason('');
  };

  const handleConfirmApply = async () => {
     if (!previewReason.trim()) {
         alert('적용 사유를 입력해주세요.');
         return;
     }
     
     const target = previewTarget;
     const reason = previewReason;
     
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
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: target.teacherName, status: '대강', reason });
     } else if (actionType === 'selfStudy') {
          payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['\uac15\uc88c\ucf54\ub4dc'], sourceTeacher, targetTeacher: '', status: '\uc790\uc2b5', reason });
     } else if (actionType === 'merge') {
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: target.teacherName, status: '통합', reason });
     } else if (actionType === 'realMakeup') {
         const txID = `[보강-${new Date().getTime().toString().slice(-6)}] ${reason}`;
         // 1. 원래 내 수업 시간 비우기 (결손 처리)
         payloads.push({ date: selectedDate, period: selectedPeriod, courseCode: sourceSchedule['강좌코드'], sourceTeacher, targetTeacher: '', status: '이동(OUT)', reason: txID });
         // 2. 타겟 시간에 내 수업 추가
         payloads.push({ date: target.date, period: target.period, courseCode: sourceSchedule['강좌코드'], sourceTeacher: '', targetTeacher: sourceTeacher, status: '이동(IN)', reason: txID });
         
         // 3. 타겟 선생님이 있으면 타겟 선생님의 수업을 타겟 시간에서 뺀다
         if (target.teacherName && target.teacherName !== '비어있음') {
             payloads.push({ date: target.date, period: target.period, courseCode: target.courseCode, sourceTeacher: target.teacherName, targetTeacher: '', status: '이동(OUT)', reason: txID });
         }
     }

     try {
         const response = await fetch('/api/schedule/update', {
             method: 'POST',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${localStorage.getItem('token')}`
             },
             body: JSON.stringify({ payloads })
         });
         const data = await response.json();
         if (data.success) {
            alert('구글 스프레드시트에 성공적으로 저장되었습니다!');
            setPreviewTarget(null);
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
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${localStorage.getItem('token')}`
             },
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
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', outline: 'none', marginBottom: 0, colorScheme: 'dark' }}
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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px', flexShrink: 0, width: '180px', position: 'sticky', top: '100px', height: 'fit-content', alignSelf: 'center' }}>
        
        {/* 안내문 툴팁 영역 */}
        <div style={{ 
          background: 'rgba(74, 144, 226, 0.1)', 
          border: '1px solid rgba(74, 144, 226, 0.3)', 
          borderRadius: '12px', 
          padding: '14px 12px', 
          fontSize: '0.8rem', 
          color: 'var(--text-secondary)', 
          textAlign: 'center', 
          lineHeight: '1.5', 
          width: '100%', 
          wordBreak: 'keep-all',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {actionType === 'exchange' && <span style={{color: '#fff'}}>수업 교체는 수업 시간을 서로 바꾸는 작업입니다.</span>}
          {actionType === 'makeup' && <span style={{color: '#fff'}}>수업 대강은 다른 선생님이 대신 수업을 진행하는 작업입니다.</span>}
          {actionType === 'realMakeup' && <span style={{color: '#fff'}}>수업 보강은 결손된 수업을 빈 시간에 채워 넣는 작업입니다.</span>}
          {actionType === 'selfStudy' && <span style={{color: '#fff'}}>수업 자습은 선생님 없이 학생들이 자습을 진행하는 작업입니다.</span>}
          {actionType === 'merge' && <span style={{color: '#fff'}}>클래스 통합은 다른 반의 동일 과목 수업에 합류시키는 작업입니다.</span>}
        </div>

        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--glass-outer)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>수정 상태 선택</label>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.2)', padding:'10px 12px', borderRadius:'12px', fontSize:'0.9rem', outline:'none', textAlign:'center', cursor:'pointer' }}>
            <option value="exchange" style={{color:'black'}}>수업 교체</option>
            <option value="makeup" style={{color:'black'}}>수업 대강</option>
            <option value="realMakeup" style={{color:'black'}}>수업 보강</option>
            <option value="selfStudy" style={{color:'black'}}>수업 자습</option>
            <option value="merge" style={{color:'black'}}>클래스 통합</option>
          </select>
        </div>

        {/* 대강일 경우 하위 필터 토글 */}
        {actionType === 'makeup' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', display: 'flex', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div onClick={() => setMakeupType('same')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: makeupType === 'same' ? 'var(--accent)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>동교과</div>
             <div onClick={() => setMakeupType('diff')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: makeupType === 'diff' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>타교과</div>
          </div>
        )}

        {/* 보강일 경우 하위 필터 토글 */}
        {actionType === 'realMakeup' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', display: 'flex', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
             <div onClick={() => setRealMakeupType('selfStudyTime')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: realMakeupType === 'selfStudyTime' ? 'var(--accent)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>자습 시간</div>
             <div onClick={() => setRealMakeupType('classTime')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: '0.8rem', background: realMakeupType === 'classTime' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition-spring)' }}>수업 시간</div>
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
               <select value={(actionType === 'exchange' || actionType === 'realMakeup') ? searchRange : 0} onChange={(e) => setSearchRange(Number(e.target.value))}
                       disabled={!(actionType === 'exchange' || actionType === 'realMakeup')}
                       style={{
                         background: !(actionType === 'exchange' || actionType === 'realMakeup') ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                         color: !(actionType === 'exchange' || actionType === 'realMakeup') ? 'rgba(255,255,255,0.3)' : 'white',
                         border:'1px solid rgba(255,255,255,0.1)',
                         padding:'4px 8px', borderRadius:'6px', outline:'none', fontSize:'0.8rem',
                         cursor: !(actionType === 'exchange' || actionType === 'realMakeup') ? 'not-allowed' : 'pointer'
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
                       <div key={`tgt-${idx}`} style={{ padding: '20px', background: target.status === '자습 전환' ? 'rgba(139,233,253,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '16px', border: target.status === '자습 전환' ? '1px solid rgba(139,233,253,0.3)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '6px' }}>
                              {target.status === '자습 전환' ? (
                                <span style={{ color: '#8be9fd' }}>📖 수업 자습 전환</span>
                              ) : (
                                <>{target.teacherName} <span style={{fontSize:'0.9rem', color:'var(--text-secondary)', fontWeight: 400}}>님</span></>
                              )}
                            </div>
                            {/* 중요: 사용자가 명시한 날짜, 교시, 강좌코드, 상태 필수 표출 */}
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px'}}>{target.date}</span>
                              <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px'}}>{target.period}교시</span>
                              <span style={{background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'4px', color: '#ffb86c'}}>{target.courseName}</span>
                              <span style={{background: target.status === '자습 전환' ? 'rgba(139,233,253,0.15)' : 'rgba(74, 144, 226, 0.1)', color: target.status === '자습 전환' ? '#8be9fd' : '#8be9fd', padding:'2px 8px', borderRadius:'4px'}}>{target.status}</span>
                            </div>
                            {target.status === '자습 전환' && (
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                원본 선생님의 수업 없이 해당 학급이 자습을 진행합니다.
                              </div>
                            )}
                         </div>
                         <button onClick={() => handleApplyClick(target)} 
                                 style={{ width: '60px', height: '60px', borderRadius: '50%', background: target.status === '자습 전환' ? '#8be9fd' : 'white', color: 'black', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.2s', lineHeight: '1.2' }}
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

      {/* 미리보기 및 사유 입력 모달 */}
      {previewTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px', animation: 'fadeIn 0.2s' }}
             onClick={() => setPreviewTarget(null)}>
           <div style={{ background: 'var(--glass-outer)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '1200px', height: 'calc(100vh - 80px)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}>

              {/* 고정 헤더 */}
              <div style={{ flexShrink: 0, padding: '24px 32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                   <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>주간 시간표 변경 시뮬레이션</h2>
                   <button onClick={() => setPreviewTarget(null)} style={{ width: 'auto', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'var(--transition-spring)' }}>취소</button>
                </div>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: '0.9rem' }}>선택하신 알고리즘(<b>{previewTarget.status}</b>) 적용 시 변경되는 두 선생님의 주간 시간표입니다. (블록으로 표시된 부분이 변경 사항입니다.)</p>
              </div>

              {/* 스크롤 가능한 시간표 영역 */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 40px 20px' }}>
              <div style={{ display: 'flex', gap: '20px', minWidth: 'fit-content' }}>
                  {/* 원본 교사 시간표 렌더링 */}
                  {(() => {
                      const dates = getWeekDates(selectedDate);
                      const days = ['월', '화', '수', '목', '금'];
                      const periods = ['1', '2', '3', '4', '5', '6', '7'];

                      return (
                         <div style={{ flex: 1, minWidth: '400px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px' }}>
                            <h3 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '1.2rem', color: '#ffb86c' }}>
                              [원본] {sourceTeacher} 선생님
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '40px' }}></th>
                                  {dates.map((d, idx) => (
                                    <th key={d} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>{days[idx]}요일</div>
                                      {d.slice(5)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {periods.map(period => (
                                  <tr key={period}>
                                    <td style={{ padding: '8px', background: 'transparent', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      {period}교시
                                    </td>
                                    {dates.map((d, idx) => {
                                       const cellData = getTeacherCell(sourceTeacher, d, days[idx], period, true, previewTarget);
                                       const { list } = cellData;
                                       const hasItems = list.length > 0;

                                       return (
                                         <td key={d} style={{ 
                                            padding: '8px 4px', 
                                            background: hasItems ? 'rgba(74, 144, 226, 0.05)' : 'rgba(255,255,255,0.02)',
                                            border: hasItems ? '1px solid rgba(74, 144, 226, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            verticalAlign: 'middle'
                                         }}>
                                            {list.map((m: any, i: number) => {
                                               const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
                                               const subjectName = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
                                               const classGroup = m['강좌코드'].match(/\((.*?)\)/)?.[1] || '';
                                               const isRmv = m._previewRemoved;
                                               const isAdd = m._previewAdded;
                                               return (
                                                  <div key={i} style={{ 
                                                      display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                                      textDecoration: isRmv ? 'line-through' : 'none',
                                                      opacity: isRmv ? 0.6 : 1,
                                                      background: isRmv ? 'rgba(255, 85, 85, 0.15)' : isAdd ? 'rgba(74, 226, 144, 0.15)' : 'transparent',
                                                      border: isRmv ? '1px dashed rgba(255, 85, 85, 0.4)' : isAdd ? '1px solid rgba(74, 226, 144, 0.4)' : 'none',
                                                      padding: '4px', borderRadius: '6px', marginBottom: i < list.length - 1 ? '4px' : '0'
                                                  }}>
                                                    <span style={{ fontWeight: 600, color: isRmv ? '#ffb8b8' : isAdd ? '#a8ffb2' : 'white', fontSize: '0.9rem' }}>{subjectName}</span>
                                                    {classGroup && <span style={{ fontSize: '0.75rem', color: isRmv ? '#ffb8b8' : isAdd ? '#a8ffb2' : '#ffb86c', marginTop: '2px' }}>{classGroup}</span>}
                                                  </div>
                                               )
                                            })}
                                            {!hasItems && <span style={{ color: 'rgba(255,255,255,0.1)' }}>-</span>}
                                         </td>
                                       )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                         </div>
                      );
                  })()}

                  {/* 타겟 교사 시간표 렌더링 */}
                  {(() => {
                      const dates = getWeekDates(previewTarget.date);
                      const days = ['월', '화', '수', '목', '금'];
                      const periods = ['1', '2', '3', '4', '5', '6', '7'];

                      return (
                         <div style={{ flex: 1, minWidth: '400px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px' }}>
                            <h3 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '1.2rem', color: '#a8ffb2' }}>
                              [대상] {previewTarget.teacherName} 선생님
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '40px' }}></th>
                                  {dates.map((d, idx) => (
                                    <th key={d} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>{days[idx]}요일</div>
                                      {d.slice(5)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {periods.map(period => (
                                  <tr key={period}>
                                    <td style={{ padding: '8px', background: 'transparent', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      {period}교시
                                    </td>
                                    {dates.map((d, idx) => {
                                       const cellData = getTeacherCell(previewTarget.teacherName, d, days[idx], period, true, previewTarget);
                                       const { list } = cellData;
                                       const hasItems = list.length > 0;

                                       return (
                                         <td key={d} style={{ 
                                            padding: '8px 4px', 
                                            background: hasItems ? 'rgba(74, 144, 226, 0.05)' : 'rgba(255,255,255,0.02)',
                                            border: hasItems ? '1px solid rgba(74, 144, 226, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            verticalAlign: 'middle'
                                         }}>
                                            {list.map((m: any, i: number) => {
                                               const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
                                               const subjectName = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
                                               const classGroup = m['강좌코드'].match(/\((.*?)\)/)?.[1] || '';
                                               const isRmv = m._previewRemoved;
                                               const isAdd = m._previewAdded;
                                               return (
                                                  <div key={i} style={{ 
                                                      display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                                      textDecoration: isRmv ? 'line-through' : 'none',
                                                      opacity: isRmv ? 0.6 : 1,
                                                      background: isRmv ? 'rgba(255, 85, 85, 0.15)' : isAdd ? 'rgba(74, 226, 144, 0.15)' : 'transparent',
                                                      border: isRmv ? '1px dashed rgba(255, 85, 85, 0.4)' : isAdd ? '1px solid rgba(74, 226, 144, 0.4)' : 'none',
                                                      padding: '4px', borderRadius: '6px', marginBottom: i < list.length - 1 ? '4px' : '0'
                                                  }}>
                                                    <span style={{ fontWeight: 600, color: isRmv ? '#ffb8b8' : isAdd ? '#a8ffb2' : 'white', fontSize: '0.9rem' }}>{subjectName}</span>
                                                    {classGroup && <span style={{ fontSize: '0.75rem', color: isRmv ? '#ffb8b8' : isAdd ? '#a8ffb2' : '#ffb86c', marginTop: '2px' }}>{classGroup}</span>}
                                                  </div>
                                               )
                                            })}
                                            {!hasItems && <span style={{ color: 'rgba(255,255,255,0.1)' }}>-</span>}
                                         </td>
                                       )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                         </div>
                      );
                  })()}
              </div>
              </div>{/* 스크롤 영역 끝 */}

              {/* 고정 푸터: 사유 입력 및 확인 버튼 */}
              <div style={{ flexShrink: 0, padding: '0 32px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', background: 'rgba(255,255,255,0.05)', padding: '16px 24px', borderRadius: '12px' }}>
                   <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>적용 사유 (예: 연가, 결보강 등)</label>
                      <input type="text" value={previewReason} onChange={(e) => setPreviewReason(e.target.value)}
                             style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 16px', borderRadius: '8px', fontSize: '1rem', outline: 'none', margin: 0 }}
                             placeholder="사유를 입력하세요" autoFocus />
                   </div>
                   <button onClick={handleConfirmApply}
                           style={{ width: 'auto', whiteSpace: 'nowrap', background: 'white', color: 'black', border: 'none', padding: '0 32px', height: '46px', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', transition: 'transform 0.2s' }}
                           onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                           onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                      변경 시간표 확정 적용하기
                   </button>
                </div>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};

export default ScheduleEditor;
