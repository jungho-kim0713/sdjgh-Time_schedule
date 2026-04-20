import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ScheduleEditor from '../components/ScheduleEditor';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = ['1', '2', '3', '4', '5', '6', '7'];

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>(() => {
    return (sessionStorage.getItem('dashboard_activeTab') as 'view' | 'edit') || 'view';
  });

  useEffect(() => {
    sessionStorage.setItem('dashboard_activeTab', activeTab);
  }, [activeTab]);

  const [scheduleData, setScheduleData] = useState<any[]>([]); // 기준_시간표
  const [dailySchedules, setDailySchedules] = useState<any[]>([]); // 일별_시간표
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 조회용 상태
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  
  // 타겟 날짜 (주 단위 필터링 용도)
  const [targetDate, setTargetDate] = useState<string>(() => {
     return new Date().toISOString().split('T')[0];
  });
  
  // 모달 제어용
  const [selectedCell, setSelectedCell] = useState<any>(null);

  const fetchData = () => {
    axios.get('/api/data')
      .then(res => {
        if(res.data.success) {
          setScheduleData(res.data.data.baseSchedules || []);
          setDailySchedules(res.data.data.dailySchedules || []);
          setCourses(res.data.data.courses || []);
          setTeachers(res.data.data.teachers || []);
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

  // 타겟 날짜가 속한 주의 월~금 날짜 뽑기
  const weekDates = useMemo(() => {
     const d = new Date(targetDate);
     const day = d.getDay() || 7; 
     d.setDate(d.getDate() - day + 1); // 월요일로
     return DAYS.map((_, idx) => {
        const nd = new Date(d);
        nd.setDate(d.getDate() + idx);
        return nd.toISOString().split('T')[0];
     });
  }, [targetDate]);

  // 특정 기준일 & 교시에 대한 최종 시간표(Override 포함) 계산
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
     
     return baseList;
  };

  const getCourseForCell = (dateStr: string, day: string, period: string) => {
    let matched = getSchedulesForCell(dateStr, day, period);

    // 특정 교사 선택 시
    if (selectedTeacherId !== 'all') {
      const teacherCourses = courses
          .filter(c => c['담당교사'] === selectedTeacherId || c['교사ID'] === selectedTeacherId)
          .map(c => c['강좌코드']);
          
      matched = matched.filter(m => {
          if (m.isOverride) return m['담당교사'] === selectedTeacherId;
          return teacherCourses.includes(m['강좌코드']);
      });
      
      if(matched.length === 0) return { elements: null, raw: [] };
      
      const components = matched.map((m, idx) => {
         const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
         const subjectName = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
         const match = m['강좌코드'].match(/(\(.*?\))/);
         const classGroup = match ? match[1] : '';
         
         return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <span style={{ fontWeight: 600, color: m.isOverride ? '#a8ffb2' : 'white' }}>{subjectName}</span>
               {classGroup && <span style={{ fontSize: '0.8rem', color: m.isOverride ? '#a8ffb2' : '#ffb86c', marginTop: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{classGroup}</span>}
               {m.isOverride && <span style={{ fontSize: '0.7rem', color: '#ff5555', background: 'rgba(255,85,85,0.2)', padding:'2px 4px', borderRadius:'4px', marginTop:'4px' }}>{m.status}</span>}
            </div>
         );
      });
      return { elements: <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{components}</div>, raw: matched };
    }

    // 전체 교사 선택 시 (Summary View)
    if(matched.length === 0) return { elements: null, raw: [] };
    
    const gradeCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    matched.forEach(m => {
        const match = m['강좌코드'].match(/(\((.*?)-(.*?)\))/);
        if (match) {
            const grade = match[2];
            if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;
        }
    });

    const hasOverride = matched.some((m: any) => m.isOverride);
    
    return {
       elements: (
          <div onClick={() => setSelectedCell({ dateStr, day, period, matched })} 
               style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', width: '100%', height: '100%', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
            {hasOverride && <div style={{ position:'absolute', top:'-10px', right:'-10px', width:'10px', height:'10px', borderRadius:'50%', background:'#ff5555', boxShadow:'0 0 10px #ff5555' }} />}
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
        const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
        const subject = courseInfo ? courseInfo['과목명'] : m['강좌코드'].split('(')[0];
        let teacher = courseInfo ? courseInfo['담당교사'] : '';
        if (m.isOverride) teacher = m['담당교사'];
        
        const match = m['강좌코드'].match(/(\((.*?)-(.*?)\))/);
        if (match) {
           const grade = match[2];
           const cls = Number(match[3]);
           if (cls > maxClass) maxClass = cls;
           if (!matrix[grade]) matrix[grade] = {};
           matrix[grade][cls] = { subject, teacher, isOverride: m.isOverride, status: m.status };
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
                      return (
                         <td key={`${g}-${cls}`} style={{ padding: '16px', background: cell?.isOverride ? 'rgba(255,85,85,0.15)' : 'transparent', transition: 'var(--transition-spring)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                            {cell ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, fontSize: '1.2rem', color: cell.isOverride ? '#a8ffb2' : 'white' }}>{cell.subject}</span>
                                  <span style={{ fontSize: '0.95rem', color: cell.isOverride ? '#ffb86c' : 'var(--text-secondary)' }}>
                                    {cell.teacher} {cell.isOverride ? <span style={{color:'#ff5555'}}>[{cell.status}]</span> : ''}
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

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      
      <nav style={{
        position: 'sticky', top: '20px', margin: '0 auto', width: 'max-content', display: 'flex', gap: '8px', padding: '8px',
        background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '9999px', zIndex: 50, boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.8s'
      }}>
        <button onClick={() => setActiveTab('view')} style={{ background: activeTab === 'view' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'view' ? 'white' : 'var(--text-secondary)', padding: '10px 24px', borderRadius: '9999px', transition: 'var(--transition-spring)', minWidth: '120px' }}>시간표 조회</button>
        <button onClick={() => setActiveTab('edit')} style={{ background: activeTab === 'edit' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'edit' ? 'white' : 'var(--text-secondary)', padding: '10px 24px', borderRadius: '9999px', transition: 'var(--transition-spring)', minWidth: '120px' }}>시간표 수정</button>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '60px 40px' }} className="animate-fade-in">
        
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, background: 'var(--glass-outer)', color: 'var(--text-secondary)' }}>
              {activeTab === 'view' ? 'My Schedule' : 'Schedule Management'}
            </span>
            <h1 style={{ fontSize: '3.5rem', fontWeight: 600, marginTop: '20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {activeTab === 'view' ? '주간 시간표 조회' : '시간표 교체 및 통합'}
            </h1>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {activeTab === 'view' && (
               <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
                 <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '12px' }}>기준일(주간)</label>
                 <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                        style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '1rem', fontFamily: 'Pretendard', cursor: 'pointer' }} />
               </div>
            )}
            
            {activeTab === 'view' && !loading && teachers.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '12px' }}>교사 선택 필터</label>
                <select 
                  value={selectedTeacherId} 
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '1rem', fontFamily: 'Pretendard', cursor: 'pointer' }}
                >
                  <option style={{color:'black'}} value="all">전체 (모든 강좌)</option>
                  {teachers.map(t => (
                    <option style={{color:'black'}} key={t['교사ID'] || t['교사명']} value={t['교사명']}>
                      {t['교사명']} 선생님
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="double-bezel-outer">
          <div className="double-bezel-inner" style={{ minHeight: '600px', overflowX: 'auto', padding: '40px' }}>
            
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>데이터를 불러오는 중입니다...</div>
            ) : activeTab === 'view' ? (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px' }}>
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
                        const { elements, raw } = getCourseForCell(dateStr, day, period);
                        const hasOverride = raw.some((m: any) => m.isOverride);
                        const isHoverable = selectedTeacherId === 'all' && elements;

                        return (
                          <td key={`${dateStr}-${period}`} style={{ 
                            padding: isHoverable ? '0' : '20px 16px', 
                            background: elements ? (hasOverride ? 'rgba(74, 226, 144, 0.15)' : 'rgba(74, 144, 226, 0.1)') : 'rgba(255,255,255,0.02)', 
                            borderRadius: '12px', 
                            textAlign: 'center',
                            border: elements ? (hasOverride ? '1px solid rgba(74, 226, 144, 0.4)' : '1px solid rgba(74, 144, 226, 0.3)') : '1px solid rgba(255,255,255,0.05)',
                            transition: 'var(--transition-spring)',
                            boxShadow: elements ? '0 4px 15px rgba(0,0,0,0.1)' : 'none'
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
                <ScheduleEditor courses={courses} baseSchedules={scheduleData} dailySchedules={dailySchedules} teachers={teachers} onUpdate={fetchData} />
            )}
            
          </div>
        </div>

      </main>

      {/* 모달 팝업 */}
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
