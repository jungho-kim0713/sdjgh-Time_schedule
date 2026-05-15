import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ScheduleEditor from '../components/ScheduleEditor';
import ScheduleAnalysis from '../components/ScheduleAnalysis';
import EventManagement from '../components/EventManagement';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = ['1', '2', '3', '4', '5', '6', '7'];

const CLASS_OPTIONS: string[] = [];
for (let g = 1; g <= 3; g++) {
  for (let c = 1; c <= 8; c++) {
    CLASS_OPTIONS.push(`${g}-${c}`);
  }
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'analyze' | 'calendar'>('view');

  useEffect(() => {
    sessionStorage.setItem('dashboard_activeTab', activeTab);
  }, [activeTab]);

  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [dailySchedules, setDailySchedules] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('none');
  const [selectedStudent, setSelectedStudent] = useState<string>('none');
  const [userRole, setUserRole] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userIdentifier, setUserIdentifier] = useState<string>('');

  const [targetDate, setTargetDate] = useState<string>(() => {
     return new Date().toISOString().split('T')[0];
  });

  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [cacheClearing, setCacheClearing] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role);
        setUserEmail(user.email);
        setUserName(user.name || '');
        setUserIdentifier(user.identifier || '');
        const saved = sessionStorage.getItem('dashboard_activeTab') as 'view' | 'edit' | 'analyze' | 'calendar';
        if ((saved === 'edit' || saved === 'calendar') && user.role === '학생') {
          setActiveTab('view');
        } else if (saved) {
          setActiveTab(saved);
        }
      } catch (e) {}
    } else {
      const saved = sessionStorage.getItem('dashboard_activeTab') as 'view' | 'edit' | 'analyze' | 'calendar';
      if (saved) setActiveTab(saved);
    }
  }, []);

  const fetchData = () => {
    axios.get(`/api/data?t=${new Date().getTime()}`)
      .then(res => {
        if(res.data.success) {
          setScheduleData(res.data.data.baseSchedules || []);
          setDailySchedules(res.data.data.dailySchedules || []);
          setCourses(res.data.data.courses || []);
          setTeachers(res.data.data.teachers || []);
          setStudents(res.data.data.students || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 학생 로그인 시 고유식별자(학번)로 학급 자동 선택
  useEffect(() => {
    if (userRole === '학생' && selectedClass === 'none') {
      let hakbun = '';
      
      // 1. 고유식별자(identifier) 분석
      if (userIdentifier) {
        // '26-10120' 같은 형식 대응 (하이픈 뒤의 5자리 추출)
        const parts = userIdentifier.split('-');
        const idPart = parts.length > 1 ? parts[1] : parts[0];
        if (idPart.length === 5) {
          hakbun = idPart;
        }
      }

      // 2. 고유식별자가 없으면 이메일로 학생 목록에서 검색 (Fallback)
      if (!hakbun && students.length > 0 && userEmail) {
        const me = students.find(s => s['구글 계정'] === userEmail);
        if (me && me['학번']) {
          hakbun = String(me['학번']);
        }
      }

      // 3. 추출된 학번으로 학급 및 학생 자동 선택
      if (hakbun && hakbun.length === 5) {
        const grade = parseInt(hakbun[0], 10);
        const cls = parseInt(hakbun.substring(1, 3), 10);
        setSelectedClass(`${grade}-${cls}`);
        setSelectedStudent(hakbun);
      }
    }
  }, [students, userIdentifier, userEmail, userRole, selectedClass]);

  // 교사/업무담당자/관리자 로그인 시 본인 시간표 자동 선택
  useEffect(() => {
    if (
      (userRole === '교사' || userRole === '업무담당자' || userRole === '관리자') &&
      teachers.length > 0 &&
      userName &&
      selectedTeacherId === 'all'
    ) {
      const me = teachers.find(t => t['교사명'] === userName);
      if (me) setSelectedTeacherId(userName);
    }
  }, [teachers, userName, userRole, selectedTeacherId]);

  const weekDates = useMemo(() => {
     const d = new Date(targetDate);
     const day = d.getDay() || 7;
     d.setDate(d.getDate() - day + 1);
     return DAYS.map((_, idx) => {
        const nd = new Date(d);
        nd.setDate(d.getDate() + idx);
        return nd.toISOString().split('T')[0];
     });
  }, [targetDate]);

  const subjects = useMemo(() => {
    const subs = new Set<string>();
    teachers.forEach(t => {
      if (t['교과']) subs.add(t['교과']);
    });
    return Array.from(subs).sort();
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    let list = teachers;
    if (selectedSubject !== 'all') {
      list = teachers.filter(t => t['교과'] === selectedSubject);
    }
    return [...list].sort((a, b) => (a['교사명'] || '').localeCompare(b['교사명'] || ''));
  }, [teachers, selectedSubject]);

  useEffect(() => {
    if (selectedTeacherId !== 'all') {
      const isTeacherInList = filteredTeachers.some(t => t['교사명'] === selectedTeacherId);
      if (!isTeacherInList) {
        setSelectedTeacherId('all');
      }
    }
  }, [selectedSubject, filteredTeachers, selectedTeacherId]);

  // 교사 선택 시 학급 선택 초기화, 학급 선택 시 교사 선택 초기화
  const handleTeacherChange = (val: string) => {
    setSelectedTeacherId(val);
    if (val !== 'all') {
       setSelectedClass('none');
       setSelectedStudent('none');
    }
  };

  const handleClassChange = (val: string) => {
    setSelectedClass(val);
    setSelectedStudent('none');
    if (val !== 'none') {
      setSelectedTeacherId('all');
      setSelectedSubject('all');
    }
  };

  const viewMode = useMemo(() => {
    if (selectedClass !== 'none') return 'class';
    if (selectedTeacherId !== 'all') return 'teacher';
    return 'all';
  }, [selectedClass, selectedTeacherId]);

  const isSpecialCourse = (code: string) => {
    return code === '자율(전체)' || code === '클럽(전체)' || code === '자습(전체)' || code.startsWith('부장(회의)') || code.startsWith('행사(');
  };

  const getSpecialStyle = (code: string): { color: string; bg: string; emoji: string } => {
    if (code === '자율(전체)') return { color: '#bd93f9', bg: 'rgba(189,147,249,0.15)', emoji: '🌿' };
    if (code === '클럽(전체)') return { color: '#ffb86c', bg: 'rgba(255,184,108,0.15)', emoji: '🎯' };
    if (code === '자습(전체)') return { color: '#8be9fd', bg: 'rgba(139,233,253,0.15)', emoji: '📖' };
    if (code.startsWith('부장(회의)')) return { color: '#ff79c6', bg: 'rgba(255,121,198,0.15)', emoji: '📋' };
    if (code.startsWith('행사(')) return { color: '#f1fa8c', bg: 'rgba(241,250,140,0.15)', emoji: '🎉' };
    return { color: 'white', bg: 'transparent', emoji: '' };
  };

  const getSchedulesForCell = (dateStr: string, dayStr: string, period: string) => {
     let baseList = scheduleData.filter(s => s['요일'] === dayStr && String(s['교시']) === String(period));
     const changes = dailySchedules.filter(d => d['날짜'] === dateStr && String(d['교시']) === String(period));

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
         if (change['상태'] === '이동(OUT)') {
             baseList = baseList.filter(b => b['강좌코드'] !== change['강좌코드']);
         } else if (change['상태'] === '행사') {
             baseList.push({
                 강좌코드: change['강좌코드'],
                 교시: change['교시'],
                 요일: dayStr,
                 담당교사: '',
                 isOverride: true,
                 status: '행사',
                 reason: change['사유']
             });
         } else {
             const existingIdx = baseList.findIndex(b => b['강좌코드'] === change['강좌코드']);
             const overrideItem = {
                강좌코드: change['강좌코드'],
                교시: change['교시'],
                요일: dayStr,
                담당교사: change['변경교사'] || change['원래교사'],
                isOverride: true,
                status: change['상태']
             };
             if (existingIdx >= 0) {
                 baseList[existingIdx] = overrideItem;
             } else {
                 baseList.push(overrideItem);
             }
         }
     });

     const activeEvents = baseList.filter(b => b.status === '행사');
     if (activeEvents.length > 0) {
        const isAll = activeEvents.some(e => e['강좌코드'] === '행사(전체)');
        if (isAll) {
            baseList = baseList.filter(b => b.status === '행사' && b['강좌코드'] === '행사(전체)');
        } else {
            const gradeEvents = activeEvents.map(e => e['강좌코드'].match(/\d/)?.[0]).filter(Boolean);
            baseList = baseList.filter(b => {
                if (b.status === '행사') return true;
                const m = b['강좌코드'].match(/\((\d)-/);
                if (m && gradeEvents.includes(m[1])) return false;
                return true;
            });
        }
     }

     return baseList;
  };

  // 학급 시간표 뷰용
  const getCourseForClass = (dateStr: string, day: string, period: string) => {
    const allSchedules = getSchedulesForCell(dateStr, day, period);

    const classSchedules = allSchedules.filter(s => {
      if (s['강좌코드'] === '자율(전체)') return true;
      if (s['강좌코드'] === '클럽(전체)') return true;
      
      // 학사일정(행사) 처리 추가: 전체 또는 해당 학년 행사인 경우 포함
      if (s.status === '행사') {
        if (s['강좌코드'] === '행사(전체)') return true;
        const gradeMatch = s['강좌코드'].match(/\d/);
        const eventGrade = gradeMatch ? gradeMatch[0] : null;
        const selectedGrade = selectedClass.split('-')[0];
        if (eventGrade === selectedGrade) return true;
      }

      if (s['강좌코드'].includes(`(${selectedClass})`)) return true;
      
      if (selectedStudent !== 'none') {
        const student = students.find(st => String(st['학번']) === selectedStudent);
        if (student) {
          if (s['강좌코드'] === student['수강강좌1'] || s['강좌코드'] === student['수강강좌2']) {
             return true;
          }
        }
      }
      return false;
    });

    const isSelfStudy = dailySchedules.some(d =>
      d['날짜'] === dateStr && String(d['교시']) === period &&
      d['강좌코드'].includes(`(${selectedClass})`) && d['상태'] === '자습'
    );

    const eventSchedule = classSchedules.find(s => s.status === '행사');
    if (eventSchedule) {
      const s = getSpecialStyle(eventSchedule['강좌코드']);
      return {
        elements: (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: s.color }}>{s.emoji} 행사</span>
            <span style={{ fontSize: '0.85rem', color: s.color }}>{eventSchedule.reason}</span>
          </div>
        ),
        isSpecial: '행사',
        raw: [eventSchedule]
      };
    }

    if (classSchedules.length === 0 || isSelfStudy) {
      const s = getSpecialStyle('자습(전체)');
      return {
        elements: <div style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>{s.emoji} 자습</div>,
        isSpecial: '자습',
        raw: []
      };
    }

    if (classSchedules.some(s => s['강좌코드'] === '자율(전체)')) {
      const s = getSpecialStyle('자율(전체)');
      return {
        elements: <div style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>{s.emoji} 자율</div>,
        isSpecial: '자율',
        raw: classSchedules
      };
    }

    if (classSchedules.some(s => s['강좌코드'] === '클럽(전체)')) {
      const s = getSpecialStyle('클럽(전체)');
      return {
        elements: <div style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>{s.emoji} 클럽</div>,
        isSpecial: '클럽',
        raw: classSchedules
      };
    }

    const item = classSchedules[0];
    const courseInfo = courses.find(c => c['강좌코드'] === item['강좌코드']);
    const subjectName = courseInfo ? courseInfo['과목명'] : item['강좌코드'].split('(')[0];
    const teacherName = item.isOverride
      ? item['담당교사']
      : (item['담당교사'] || (courseInfo ? courseInfo['담당교사'] : ''));

    return {
      elements: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontWeight: 600, color: item.isOverride ? '#a8ffb2' : 'white' }}>{subjectName}</span>
          <span style={{ fontSize: '0.85rem', color: item.isOverride ? '#a8ffb2' : 'var(--text-secondary)' }}>{teacherName}</span>
          {item.isOverride && (
            <span style={{ fontSize: '0.7rem', color: '#ff5555', background: 'rgba(255,85,85,0.2)', padding: '2px 4px', borderRadius: '4px' }}>{item.status}</span>
          )}
        </div>
      ),
      raw: classSchedules,
      isSpecial: undefined as string | undefined
    };
  };

  const getCourseForCell = (dateStr: string, day: string, period: string) => {
    let matched = getSchedulesForCell(dateStr, day, period);

    if (selectedTeacherId !== 'all') {
      const teacherCourses = courses
          .filter(c => c['담당교사'] === selectedTeacherId)
          .map(c => c['강좌코드']);

      const myScheduled = matched.filter(m => {
          if (m.status === '행사') return true;
          if (m.isOverride) return m['담당교사'] === selectedTeacherId;
          return m['담당교사'] === selectedTeacherId || teacherCourses.includes(m['강좌코드']);
      });

      if (myScheduled.length === 0) {
        const hasClub = matched.some(m => m['강좌코드'] === '클럽(전체)');
        const myBujan = matched.find(m => m['강좌코드'].startsWith('부장(회의)') && teacherCourses.includes(m['강좌코드']));

        if (hasClub) {
          const s = getSpecialStyle('클럽(전체)');
          return { elements: <div style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>{s.emoji} 클럽</div>, raw: [], isSpecial: '클럽' };
        }
        if (myBujan) {
          const s = getSpecialStyle('부장(회의)');
          return { elements: <div style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>{s.emoji} 부장회의</div>, raw: [myBujan], isSpecial: '부장회의' };
        }
        return { elements: null, raw: [] };
      }

      const components = myScheduled.map((m, idx) => {
         const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
         const subjectName = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
         const matchCode = m['강좌코드'].match(/(\([^\[]*?\))/);
         const classGroup = matchCode ? matchCode[1] : '';

         if (isSpecialCourse(m['강좌코드'])) {
           const s = getSpecialStyle(m['강좌코드']);
           const label = m.status === '행사' ? m.reason : subjectName;
           return (
             <div key={idx} style={{ color: s.color, fontWeight: 600, fontSize: '0.95rem' }}>
               {s.emoji} {label}
             </div>
           );
         }

         return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <span style={{ fontWeight: 600, color: m.isOverride ? '#a8ffb2' : 'white' }}>{subjectName}</span>
               {classGroup && <span style={{ fontSize: '0.8rem', color: m.isOverride ? '#a8ffb2' : '#ffb86c', marginTop: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{classGroup}</span>}
               {m.isOverride && <span style={{ fontSize: '0.7rem', color: '#ff5555', background: 'rgba(255,85,85,0.2)', padding:'2px 4px', borderRadius:'4px', marginTop:'4px' }}>{m.status}</span>}
            </div>
         );
      });
      return { elements: <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{components}</div>, raw: myScheduled };
    }

    // 전체 요약 뷰
    const specialItems = matched.filter(m => isSpecialCourse(m['강좌코드']));
    const normalItems = matched.filter(m => !isSpecialCourse(m['강좌코드']));

    if(normalItems.length === 0 && specialItems.length === 0) return { elements: null, raw: [] };

    if (specialItems.some(m => m['강좌코드'] === '자율(전체)')) {
      const s = getSpecialStyle('자율(전체)');
      return { elements: <div style={{ color: s.color, fontWeight: 700, fontSize: '1.1rem', padding: '4px' }}>{s.emoji} 자율 시간</div>, raw: specialItems, isSpecial: '자율' };
    }
    if (specialItems.some(m => m['강좌코드'] === '클럽(전체)')) {
      const s = getSpecialStyle('클럽(전체)');
      return { elements: <div style={{ color: s.color, fontWeight: 700, fontSize: '1.1rem', padding: '4px' }}>{s.emoji} 클럽 시간</div>, raw: specialItems, isSpecial: '클럽' };
    }
    // 행사 처리 로직 개선: 학년별로 행사가 다를 수 있으므로 분리해서 표시
    const activeEvents = specialItems.filter(m => m.status === '행사');
    if (activeEvents.length > 0) {
      const allGradeEvent = activeEvents.find(e => e['강좌코드'] === '행사(전체)');
      
      // 1. 전체 학년 공통 행사인 경우 (기존과 동일하게 크게 표시)
      if (allGradeEvent) {
        const s = getSpecialStyle(allGradeEvent['강좌코드']);
        return { 
          elements: (
            <div style={{ color: s.color, fontWeight: 700, fontSize: '1.1rem', padding: '4px', textAlign: 'center' }}>
              {s.emoji} {allGradeEvent.reason}
              <div style={{fontSize:'0.75rem', marginTop:'4px'}}>전체</div>
            </div>
          ), 
          raw: specialItems, 
          isSpecial: '행사' 
        };
      }

      // 2. 학년별로 행사가 다르거나 일부 학년만 행사인 경우
      // 학사일정 관리에서 등록된 학년별 행사 맵핑
      const gradeEvents: Record<string, any> = {};
      activeEvents.forEach(e => {
        const g = e['강좌코드'].match(/\d/)?.[0];
        if (g) gradeEvents[g] = e;
      });

      // 일반 강좌 수 집계
      const gradeCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
      normalItems.forEach(m => {
          const match = m['강좌코드'].match(/(\((.*?)-(.*?)\))/);
          if (match) {
              const grade = match[2];
              if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;
          }
      });

      const hasOverride = normalItems.some((m: any) => m.isOverride);
      const bujanCount = specialItems.filter(m => m['강좌코드'].startsWith('부장(회의)')).length;

      return {
        elements: (
          <div onClick={() => setSelectedCell({ dateStr, day, period, matched: [...normalItems, ...activeEvents] })}
               style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', width: '100%', height: '100%', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
            {hasOverride && <div style={{ position:'absolute', top:'-10px', right:'-10px', width:'10px', height:'10px', borderRadius:'50%', background:'#ff5555', boxShadow:'0 0 10px #ff5555' }} />}
            {bujanCount > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#ff79c6', background: 'rgba(255,121,198,0.1)', padding: '2px 6px', borderRadius: '4px' }}>📋 부장회의 {bujanCount}명</div>
            )}
            {[1, 2, 3].map(g => {
              const gradeStr = String(g);
              const event = gradeEvents[gradeStr];
              const count = gradeCounts[gradeStr];

              if (event) {
                const s = getSpecialStyle(event['강좌코드']);
                return (
                  <div key={g} style={{ fontSize: '0.9rem', width: '100%', background: s.bg, padding: '4px 0', borderRadius: '4px', border: `1px solid ${s.color}40` }}>
                    <span style={{color: s.color, fontWeight: 700}}>{s.emoji} {event.reason}</span>
                  </div>
                );
              } else if (count > 0) {
                return (
                  <div key={g} style={{ fontSize: '0.9rem', width: '100%', background: 'rgba(255,255,255,0.05)', padding: '4px 0', borderRadius: '4px' }}>
                    <span style={{color: '#ffb86c'}}>{g}학년</span> {count}강좌
                  </div>
                );
              }
              return null;
            })}
            <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-secondary)' }}>클릭해서 학급 표 보기</div>
          </div>
        ),
        raw: matched,
        isSpecial: undefined
      };
    }

    if(normalItems.length === 0) return { elements: null, raw: [] };

    const gradeCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    normalItems.forEach(m => {
        const match = m['강좌코드'].match(/(\((.*?)-(.*?)\))/);
        if (match) {
            const grade = match[2];
            if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;
        }
    });

    const hasOverride = normalItems.some((m: any) => m.isOverride);
    const bujanCount = specialItems.filter(m => m['강좌코드'].startsWith('부장(회의)')).length;

    return {
       elements: (
          <div onClick={() => setSelectedCell({ dateStr, day, period, matched: normalItems })}
               style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', width: '100%', height: '100%', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
            {hasOverride && <div style={{ position:'absolute', top:'-10px', right:'-10px', width:'10px', height:'10px', borderRadius:'50%', background:'#ff5555', boxShadow:'0 0 10px #ff5555' }} />}
            {bujanCount > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#ff79c6', background: 'rgba(255,121,198,0.1)', padding: '2px 6px', borderRadius: '4px' }}>📋 부장회의 {bujanCount}명</div>
            )}
            {[1,2,3].map(g => gradeCounts[g] > 0 ? (
               <div key={g} style={{ fontSize: '0.9rem', width: '100%', background: 'rgba(255,255,255,0.05)', padding: '4px 0', borderRadius: '4px' }}>
                 <span style={{color: '#ffb86c'}}>{g}학년</span> {gradeCounts[g]}강좌
               </div>
            ) : null)}
            <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-secondary)' }}>클릭해서 학급 표 보기</div>
          </div>
       ),
       raw: matched
    };
  };

  const renderModalGrid = () => {
     if (!selectedCell) return null;
     const matrix: any = { '1': {}, '2': {}, '3': {} };
     let maxClass = 1;

     selectedCell.matched.forEach((m: any) => {
        // 일반 강좌 처리
        if (m.status !== '행사') {
          const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
          const subject = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
          let teacher = m['담당교사'] || (courseInfo ? courseInfo['담당교사'] : '');
          if (m.isOverride) teacher = m['담당교사'];

          const match = m['강좌코드'].match(/(\((.*?)-(.*?)\))/);
          if (match) {
             const grade = match[2];
             const cls = Number(match[3]);
             if (cls > maxClass) maxClass = cls;
             if (!matrix[grade]) matrix[grade] = {};
             matrix[grade][cls] = { subject, teacher, isOverride: m.isOverride, status: m.status, isEvent: false };
          }
        } else {
          // 행사 처리 (학년별 또는 전체)
          const s = getSpecialStyle(m['강좌코드']);
          const gradeMatch = m['강좌코드'].match(/\d/);
          const targetGrade = gradeMatch ? gradeMatch[0] : null;

          if (targetGrade) {
            // 특정 학년 행사: 해당 학년의 모든 반(1~8반)에 채움
            for (let c = 1; c <= 8; c++) {
              if (c > maxClass) maxClass = c;
              if (!matrix[targetGrade]) matrix[targetGrade] = {};
              matrix[targetGrade][c] = { subject: m.reason, teacher: '행사', isOverride: true, status: '행사', isEvent: true, color: s.color };
            }
          } else if (m['강좌코드'] === '행사(전체)') {
            // 전체 학년 행사: 모든 학년 모든 반에 채움
            for (let g = 1; g <= 3; g++) {
              for (let c = 1; c <= 8; c++) {
                if (c > maxClass) maxClass = c;
                if (!matrix[String(g)]) matrix[String(g)] = {};
                matrix[String(g)][c] = { subject: m.reason, teacher: '행사', isOverride: true, status: '행사', isEvent: true, color: s.color };
              }
            }
          }
        }
     });

     const classRows = Array.from({ length: maxClass }, (_, i) => i + 1);

     return (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', color: 'white' }}>
           <thead>
             <tr>
               <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>명렬표</th>
               {[1, 2, 3].map(g => <th key={g} style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)', fontSize:'1.2rem' }}>{g}학년</th>)}
             </tr>
           </thead>
           <tbody>
             {classRows.map(cls => (
                <tr key={cls} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                   <td style={{ padding: '16px', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', fontSize:'1.1rem' }}>{cls}반</td>
                   {[1, 2, 3].map(g => {
                      const cell = matrix[g]?.[cls];
                      const isEvent = cell?.isEvent;
                      return (
                         <td key={`${g}-${cls}`} style={{ 
                           padding: '16px', 
                           background: isEvent ? 'rgba(241,250,140,0.1)' : (cell?.isOverride ? 'rgba(255,85,85,0.15)' : 'transparent'), 
                           transition: 'var(--transition-spring)', 
                           borderLeft: '1px solid rgba(255,255,255,0.05)' 
                         }}>
                            {cell ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ 
                                    fontWeight: 600, 
                                    fontSize: isEvent ? '1.1rem' : '1.2rem', 
                                    color: isEvent ? (cell.color || '#f1fa8c') : (cell.isOverride ? '#a8ffb2' : 'white') 
                                  }}>
                                    {isEvent && '🎉 '}{cell.subject}
                                  </span>
                                  <span style={{ fontSize: '0.95rem', color: isEvent ? (cell.color || '#f1fa8c') : (cell.isOverride ? '#ffb86c' : 'var(--text-secondary)') }}>
                                    {isEvent ? '학사일정' : cell.teacher} {(!isEvent && cell.isOverride) ? <span style={{color:'#ff5555'}}>[{cell.status}]</span> : ''}
                                  </span>
                               </div>
                            ) : <span style={{ opacity: 0.1 }}>-</span>}
                         </td>
                      )
                   })}
                </tr>
             ))}
           </tbody>
        </table>
     );
  }

  const dropdownStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    padding: '6px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
  };

  const selectStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'white',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    fontFamily: 'Pretendard',
    cursor: 'pointer',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginRight: '8px',
    minWidth: '40px',
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>

      <nav style={{
        position: 'sticky', top: '12px', margin: '0 auto', maxWidth: 'calc(100vw - 24px)', width: 'max-content',
        display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px', alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px', zIndex: 50, boxShadow: '0 12px 40px -10px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.8s'
      }}>
        <div 
          onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.href = 'https://platform.sdjgh-ai.kr/'; }}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px',
            background: 'transparent', borderRadius: '16px', transition: 'var(--transition-spring)',
            border: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <img src="/서대전여고 로고(투명).png" alt="Logo" style={{ width: '22px', height: '22px', borderRadius: '5px' }} />
        </div>

        <button onClick={() => setActiveTab('view')} style={{ background: activeTab === 'view' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'view' ? 'white' : 'var(--text-secondary)', padding: '8px 18px', borderRadius: '9999px', transition: 'var(--transition-spring)', fontSize: '0.9rem', width: 'auto' }}>시간표 조회</button>
        {(userRole === '업무담당자' || userRole === '관리자') && (
          <button onClick={() => setActiveTab('calendar')} style={{ background: activeTab === 'calendar' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'calendar' ? 'white' : 'var(--text-secondary)', padding: '8px 18px', borderRadius: '9999px', transition: 'var(--transition-spring)', fontSize: '0.9rem', width: 'auto' }}>학사일정 관리</button>
        )}
        {(userRole === '관리자' || userRole === '업무담당자' || userRole === '교사') && (
          <button onClick={() => setActiveTab('edit')} style={{ background: activeTab === 'edit' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'edit' ? 'white' : 'var(--text-secondary)', padding: '8px 18px', borderRadius: '9999px', transition: 'var(--transition-spring)', fontSize: '0.9rem', width: 'auto' }}>시간표 수정</button>
        )}
        {userRole !== '학생' && (
          <button onClick={() => setActiveTab('analyze')} style={{ background: activeTab === 'analyze' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'analyze' ? 'white' : 'var(--text-secondary)', padding: '8px 18px', borderRadius: '9999px', transition: 'var(--transition-spring)', fontSize: '0.9rem', width: 'auto' }}>시간표 분석</button>
        )}
        {userRole === '관리자' && (
          <button onClick={() => navigate('/admin')} style={{ background: 'transparent', color: '#ffb86c', padding: '8px 18px', borderRadius: '9999px', transition: 'var(--transition-spring)', fontSize: '0.9rem', width: 'auto' }}>사용자 관리</button>
        )}
      </nav>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(24px, 5vw, 60px) clamp(12px, 4vw, 40px)', width: '100%' }} className="animate-fade-in mobile-main">

          <div className="mobile-header-padding" style={{ marginBottom: '40px', display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, background: 'var(--glass-outer)', color: 'var(--text-secondary)' }}>
              {activeTab === 'view' ? 'My Schedule' : activeTab === 'edit' ? 'Schedule Management' : activeTab === 'analyze' ? 'Schedule Analysis' : 'Academic Calendar'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
               <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                 {activeTab === 'view' ? '시간표 조회' : activeTab === 'edit' ? '시간표 수정' : activeTab === 'analyze' ? '시간표 분석' : '학사일정 관리'}
               </h1>
               {activeTab === 'edit' && (
                 <button 
                   disabled={cacheClearing}
                   onClick={async () => {
                     setCacheClearing(true);
                     try {
                       await axios.post('/api/admin/clear-cache');
                       await fetchData();
                     } catch(err) {
                       alert('캐시 초기화에 실패했습니다.');
                     } finally {
                       setCacheClearing(false);
                     }
                   }}
                   style={{
                     padding: '8px 16px',
                     background: cacheClearing ? 'rgba(255,255,255,0.05)' : 'rgba(255,184,108,0.15)',
                     color: cacheClearing ? 'var(--text-secondary)' : '#ffb86c',
                     border: '1px solid rgba(255,184,108,0.3)',
                     borderRadius: '10px',
                     cursor: cacheClearing ? 'not-allowed' : 'pointer',
                     fontWeight: 600,
                     fontSize: '0.85rem',
                     whiteSpace: 'nowrap',
                     transition: 'var(--transition-spring)',
                     fontFamily: 'Pretendard',
                     width: 'auto',
                   }}
                 >
                   {cacheClearing ? '⏳ 초기화 중...' : '🔄 캐시 초기화'}
                 </button>
               )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {activeTab === 'view' && (
               <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
                 <label className="desktop-only" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '12px', pointerEvents: 'none' }}>기준일(주간)</label>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
                   <span style={{ fontSize: '1rem', color: 'white', fontFamily: 'Pretendard' }}>
                     {targetDate ? (
                       <>
                         <span className="desktop-only">{targetDate} ({['일', '월', '화', '수', '목', '금', '토'][new Date(targetDate).getDay()]})</span>
                         <span className="mobile-only">{targetDate.substring(5)} ({['일', '월', '화', '수', '목', '금', '토'][new Date(targetDate).getDay()]})</span>
                       </>
                     ) : '날짜 선택'}
                   </span>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                     <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                   </svg>
                 </div>
                 <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                        onClick={(e) => { try { (e.target as any).showPicker(); } catch(err){} }}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
               </div>
            )}

            {activeTab === 'view' && !loading && teachers.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* 교과/강사 선택 — 학생 권한 숨김 */}
                {userRole !== '학생' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={dropdownStyle}>
                      <label style={labelStyle}>교과</label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        style={selectStyle}
                      >
                        <option style={{color:'black'}} value="all">전체</option>
                        {subjects.map(s => (
                          <option style={{color:'black'}} key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div style={dropdownStyle}>
                      <label style={labelStyle}>강사</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => handleTeacherChange(e.target.value)}
                        style={selectStyle}
                      >
                        <option style={{color:'black'}} value="all">전체 (모든 강좌)</option>
                        {filteredTeachers.map(t => (
                          <option style={{color:'black'}} key={t['교사ID'] || t['교사명']} value={t['교사명']}>
                            {t['교사명']} 선생님
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 학급/학생 선택 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    ...dropdownStyle,
                    border: selectedClass !== 'none'
                      ? '1px solid rgba(139,233,253,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: selectedClass !== 'none'
                      ? 'rgba(139,233,253,0.08)'
                      : 'rgba(255,255,255,0.05)',
                  }}>
                    <label style={labelStyle}>학급</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      style={{ ...selectStyle, color: selectedClass !== 'none' ? '#8be9fd' : 'white' }}
                    >
                      <option style={{color:'black'}} value="none">선택 안 함</option>
                      {[1, 2, 3].map(g => (
                        <optgroup key={g} label={`${g}학년`}>
                          {Array.from({ length: 8 }, (_, i) => `${g}-${i + 1}`).map(cls => (
                            <option style={{color:'black'}} key={cls} value={cls}>{cls}반</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div style={{
                    ...dropdownStyle,
                    border: selectedStudent !== 'none'
                      ? '1px solid rgba(139,233,253,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: selectedStudent !== 'none'
                      ? 'rgba(139,233,253,0.08)'
                      : 'rgba(255,255,255,0.05)',
                  }}>
                    <label style={labelStyle}>학생</label>
                    <select
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      disabled={selectedClass === 'none'}
                      style={{ ...selectStyle, color: selectedStudent !== 'none' ? '#8be9fd' : 'white', cursor: selectedClass === 'none' ? 'not-allowed' : 'pointer' }}
                    >
                      <option style={{color:'black'}} value="none">전체</option>
                      {students
                        .filter(s => {
                           if (!s['학번'] || String(s['학번']).length !== 5) return false;
                           const hakbun = String(s['학번']);
                           const grade = parseInt(hakbun[0], 10);
                           const cls = parseInt(hakbun.substring(1, 3), 10);
                           return `${grade}-${cls}` === selectedClass;
                        })
                        .sort((a, b) => parseInt(a['학번']) - parseInt(b['학번']))
                        .map(s => (
                          <option style={{color:'black'}} key={s['학번']} value={s['학번']}>{s['이름']} ({String(s['학번']).substring(3)}번)</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 학급 선택 시 헤더 배지 */}
        {activeTab === 'view' && selectedClass !== 'none' && (
          <div className="mobile-header-padding" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <span style={{ whiteSpace: 'nowrap', flexShrink: 0, background: 'rgba(139,233,253,0.15)', border: '1px solid rgba(139,233,253,0.4)', color: '#8be9fd', borderRadius: '9999px', padding: '6px 16px', fontSize: '0.9rem', fontWeight: 600 }}>
              📚 {selectedClass}반 {selectedStudent !== 'none' ? `${students.find(s => String(s['학번']) === selectedStudent)?.['이름']} ` : ''}주간 시간표
            </span>
            <button
              onClick={() => { setSelectedClass('none'); setSelectedStudent('none'); }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', borderRadius: '9999px', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', transition: 'var(--transition-spring)' }}
            >
              ✕ 초기화
            </button>
          </div>
        )}

        <div className={`double-bezel-outer ${activeTab === 'view' ? 'mobile-edge' : ''}`}>
          <div className={`double-bezel-inner ${activeTab === 'view' ? 'mobile-edge-inner' : ''}`} style={{ minHeight: '600px', overflowX: 'auto', padding: '40px' }}>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>데이터를 불러오는 중입니다...</div>
            ) : activeTab === 'view' ? (
              <table className="schedule-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', width: '80px' }}>날짜</th>
                    {weekDates.map((dateStr, idx) => (
                      <th key={dateStr} style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px', width: '18%' }}>
                        <div>{DAYS[idx]}요일</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 400 }}>{dateStr}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(period => (
                    <tr key={period}>
                      <td style={{ padding: '20px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                        {period}교시
                      </td>
                      {weekDates.map((dateStr, idx) => {
                         const day = DAYS[idx];
                         const result = viewMode === 'class'
                           ? getCourseForClass(dateStr, day, period)
                           : getCourseForCell(dateStr, day, period);
                         const { elements, raw } = result;
                         const isSpecial = (result as any).isSpecial;
                         const hasOverride = raw.some((m: any) => m.isOverride);
                         const isHoverable = viewMode === 'all' && elements && !isSpecial;

                         let cellBg = 'rgba(255,255,255,0.02)';
                         let cellBorder = '1px solid rgba(255,255,255,0.05)';
                         if (isSpecial === '자율') { cellBg = 'rgba(189,147,249,0.1)'; cellBorder = '1px solid rgba(189,147,249,0.3)'; }
                         else if (isSpecial === '클럽') { cellBg = 'rgba(255,184,108,0.1)'; cellBorder = '1px solid rgba(255,184,108,0.3)'; }
                         else if (isSpecial === '자습') { cellBg = 'rgba(139,233,253,0.05)'; cellBorder = '1px dashed rgba(139,233,253,0.2)'; }
                         else if (isSpecial === '부장회의') { cellBg = 'rgba(255,121,198,0.1)'; cellBorder = '1px solid rgba(255,121,198,0.3)'; }
                         else if (elements) { cellBg = hasOverride ? 'rgba(74, 226, 144, 0.15)' : 'rgba(74, 144, 226, 0.1)'; cellBorder = hasOverride ? '1px solid rgba(74, 226, 144, 0.4)' : '1px solid rgba(74, 144, 226, 0.3)'; }

                         return (
                           <td key={`${dateStr}-${period}`} style={{
                             padding: isHoverable ? '0' : '20px 16px',
                             background: cellBg,
                             borderRadius: '12px',
                             textAlign: 'center',
                             border: cellBorder,
                             transition: 'var(--transition-spring)',
                             boxShadow: elements && !isSpecial ? '0 4px 15px rgba(0,0,0,0.1)' : 'none'
                           }}>
                               <div style={{ padding: isHoverable ? '20px 16px' : '0', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '0.95rem', fontWeight: elements ? 600 : 400, color: elements ? 'white' : 'var(--text-secondary)' }}>
                                 {elements || '-'}
                               </div>
                           </td>
                         )
                       })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="double-bezel-inner" style={{ padding: '32px', minHeight: '500px' }}>
                {activeTab === 'analyze' ? (
                  <ScheduleAnalysis courses={courses} baseSchedules={scheduleData} dailySchedules={dailySchedules} />
                ) : activeTab === 'calendar' ? (
                  <EventManagement dailySchedules={dailySchedules} onUpdate={fetchData} />
                ) : userRole === '학생' ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>시간표 수정 권한이 없습니다.</div>
                ) : (
                    <ScheduleEditor courses={courses} baseSchedules={scheduleData} dailySchedules={dailySchedules} teachers={teachers} onUpdate={fetchData} userRole={userRole} />
                )}
              </div>
            )}

          </div>
        </div>

      </main>

      {selectedCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', animation: 'fadeIn 0.2s' }}
             onClick={() => setSelectedCell(null)}>
           <div style={{ background: 'var(--glass-outer)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s' }}
                onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                 <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 600 }}>{selectedCell.dateStr} ({selectedCell.day}) {selectedCell.period}교시 - 전체 학급 배치도</h2>
                 <button onClick={() => setSelectedCell(null)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'var(--transition-spring)' }}>닫기</button>
              </div>
              {renderModalGrid()}
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
