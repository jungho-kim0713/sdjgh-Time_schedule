import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ScheduleEditor from '../components/ScheduleEditor';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = ['1', '2', '3', '4', '5', '6', '7'];

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [scheduleData, setScheduleData] = useState<any[]>([]); // 기준_시간표
  const [dailySchedules, setDailySchedules] = useState<any[]>([]); // 일별_시간표
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 조회용 상태
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');

  useEffect(() => {
    axios.get('http://localhost:5000/api/data')
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
  }, []);

  const getCourseForCell = (day: string, period: string) => {
    let matched = scheduleData.filter(s => s['요일'] === day && s['교시'] === String(period));

    // 특정 교사를 선택했을 경우, 해당 교사가 담당하는 강좌만 필터링
    if (selectedTeacherId !== 'all') {
      const teacherCourses = courses
          .filter(c => c['담당교사'] === selectedTeacherId || c['교사ID'] === selectedTeacherId)
          .map(c => c['강좌코드']);
      matched = matched.filter(m => teacherCourses.includes(m['강좌코드']));
    }

    if(matched.length === 0) return null;
    
    const displayNames = matched.map(m => {
        const courseInfo = courses.find(c => c['강좌코드'] === m['강좌코드']);
        return courseInfo ? courseInfo['과목명'] : m['강좌코드'];
    });
    return displayNames.join(' / ');
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      
      {/* Floating Glass Navigation */}
      <nav style={{
        position: 'sticky', top: '20px', margin: '0 auto', width: 'max-content', display: 'flex', gap: '8px', padding: '8px',
        background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '9999px', zIndex: 50, boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.8s'
      }}>
        <button onClick={() => setActiveTab('view')} style={{ background: activeTab === 'view' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'view' ? 'white' : 'var(--text-secondary)', padding: '10px 24px', borderRadius: '9999px', transition: 'var(--transition-spring)', minWidth: '120px' }}>시간표 조회</button>
        <button onClick={() => setActiveTab('edit')} style={{ background: activeTab === 'edit' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'edit' ? 'white' : 'var(--text-secondary)', padding: '10px 24px', borderRadius: '9999px', transition: 'var(--transition-spring)', minWidth: '120px' }}>시간표 수정</button>
      </nav>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '60px 40px' }} className="animate-fade-in">
        
        {/* Header Section */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, background: 'var(--glass-outer)', color: 'var(--text-secondary)' }}>
              {activeTab === 'view' ? 'My Schedule' : 'Schedule Management'}
            </span>
            <h1 style={{ fontSize: '3.5rem', fontWeight: 600, marginTop: '20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {activeTab === 'view' ? '주간 시간표 조회' : '시간표 교체 및 통합'}
            </h1>
          </div>
          
          {/* Controls Area */}
          {activeTab === 'view' && !loading && teachers.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
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

        {/* Schedule Table Area */}
        <div className="double-bezel-outer">
          <div className="double-bezel-inner" style={{ minHeight: '600px', overflowX: 'auto', padding: '40px' }}>
            
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>데이터를 불러오는 중입니다...</div>
            ) : activeTab === 'view' ? (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', width: '80px' }}>교시</th>
                    {DAYS.map(day => (
                      <th key={day} style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px', width: '18%' }}>
                        {day}요일
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
                      {DAYS.map(day => {
                        const content = getCourseForCell(day, period);
                        return (
                          <td key={`${day}-${period}`} style={{ 
                            padding: '20px 16px', 
                            background: content ? 'rgba(74, 144, 226, 0.15)' : 'rgba(255,255,255,0.02)', 
                            borderRadius: '12px', 
                            textAlign: 'center',
                            border: content ? '1px solid rgba(74, 144, 226, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                            transition: 'var(--transition-spring)',
                            cursor: content ? 'pointer' : 'default',
                            boxShadow: content ? '0 4px 15px rgba(0,0,0,0.1)' : 'none'
                          }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: content ? 600 : 400, color: content ? 'white' : 'var(--text-secondary)' }}>
                                {content || '-'}
                              </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
                <ScheduleEditor courses={courses} baseSchedules={scheduleData} dailySchedules={dailySchedules} teachers={teachers} />
            )}
            
          </div>
        </div>

      </main>
    </div>
  );
};

export default Dashboard;
