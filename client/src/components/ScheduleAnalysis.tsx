import React, { useState, useMemo } from 'react';

interface Props {
  courses: any[];
  baseSchedules: any[];
  dailySchedules: any[];
}

const extractClassInfo = (code: string): string => {
  const m = code.match(/\((\d-\d+)\)/);
  return m ? m[1] : '';
};

const getDayString = (dateStr: string): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
};

const isWeekday = (dateStr: string): boolean => {
  const day = new Date(dateStr).getDay();
  return day >= 1 && day <= 5;
};

const formatDate = (date: Date): string =>
  date.toISOString().split('T')[0];

const isSpecialCourse = (code: string) =>
  code === '자율(전체)' || code === '클럽(전체)' ||
  code === '자습(전체)' || code.startsWith('부장(회의)');

// 취소된 txID 집합을 반환
const getCancelledTxIDs = (dailyForDate: any[]): Set<string> => {
  return new Set(
    dailyForDate
      .filter(d => d['상태'] === '취소')
      .map(d => d['사유'])
  );
};

const ScheduleAnalysis: React.FC<Props> = ({ courses, baseSchedules, dailySchedules }) => {
  const [startDate, setStartDate] = useState<string>('2026-03-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [results, setResults] = useState<{ classInfo: string; count: number }[] | null>(null);
  const [analyzedSubject, setAnalyzedSubject] = useState<string>('');
  const [analyzedRange, setAnalyzedRange] = useState<{ start: string; end: string } | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    courses.forEach(c => {
      if (!isSpecialCourse(c['강좌코드'])) set.add(c['과목명']);
    });
    return Array.from(set).sort();
  }, [courses]);

  const analyze = () => {
    if (!startDate || !endDate || !selectedSubject) return;

    const classCounts: Record<string, number> = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = formatDate(current);

      if (isWeekday(dateStr)) {
        const dayOfWeek = getDayString(dateStr);
        const baseForDay = baseSchedules.filter(s => s['요일'] === dayOfWeek);
        const dailyForDate = dailySchedules.filter(s => s['날짜'] === dateStr);

        const cancelledTxIDs = getCancelledTxIDs(dailyForDate);
        const activeDaily = dailyForDate.filter(
          d => d['상태'] !== '취소' && !cancelledTxIDs.has(d['사유'])
        );

        const PERIODS = ['1', '2', '3', '4', '5', '6', '7'];
        PERIODS.forEach(p => {
          const baseCourses = baseForDay.filter(s => String(s['교시']) === p);

          // 이동(OUT), 자습, 통합은 원래 수업 미실시
          const removedCodes = new Set(
            activeDaily
              .filter(d => String(d['교시']) === p &&
                ['이동(OUT)', '자습', '통합'].includes(d['상태']))
              .map(d => d['강좌코드'])
          );

          const activeCourses: string[] = [];

          // 기준 시간표에서 제거되지 않은 강좌 추가
          baseCourses.forEach(s => {
            if (!removedCodes.has(s['강좌코드'])) {
              activeCourses.push(s['강좌코드']);
            }
          });

          // 이동(IN), 보강으로 추가된 강좌
          activeDaily
            .filter(d => String(d['교시']) === p &&
              (d['상태'] === '이동(IN)' || d['상태'] === '보강'))
            .forEach(d => activeCourses.push(d['강좌코드']));

          // 과목 집계
          activeCourses.forEach(code => {
            if (isSpecialCourse(code)) return;
            const courseInfo = courses.find(c => c['강좌코드'] === code);
            if (courseInfo && courseInfo['과목명'] === selectedSubject) {
              const classInfo = extractClassInfo(code);
              if (classInfo) {
                classCounts[classInfo] = (classCounts[classInfo] || 0) + 1;
              }
            }
          });
        });
      }

      current.setDate(current.getDate() + 1);
    }

    const sorted = Object.entries(classCounts)
      .map(([classInfo, count]) => ({ classInfo, count }))
      .sort((a, b) => {
        const [aY, aC] = a.classInfo.split('-').map(Number);
        const [bY, bC] = b.classInfo.split('-').map(Number);
        return aY !== bY ? aY - bY : aC - bC;
      });

    setResults(sorted);
    setAnalyzedSubject(selectedSubject);
    setAnalyzedRange({ start: startDate, end: endDate });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '10px 14px',
    borderRadius: '10px',
    outline: 'none',
    fontSize: '0.9rem',
    colorScheme: 'dark' as any,
    fontFamily: 'Pretendard, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  const isReady = startDate && endDate && selectedSubject;

  // 학년별 그룹핑
  const groupedResults = useMemo(() => {
    if (!results) return null;
    const groups: Record<number, { classInfo: string; count: number }[]> = {};
    results.forEach(r => {
      const year = Number(r.classInfo.split('-')[0]);
      if (!groups[year]) groups[year] = [];
      groups[year].push(r);
    });
    return groups;
  }, [results]);

  return (
    <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* 입력 패널 */}
      <div className="double-bezel-outer" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
            Schedule Analysis
          </span>
          <h2 style={{ color: 'white', marginTop: '8px', fontSize: '1.3rem', fontWeight: 600 }}>
            과목별 학급 수업 시간 분석
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px', alignItems: 'end', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>시작일</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setResults(null); }} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>종료일</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setResults(null); }} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>과목</label>
            <select
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setResults(null); }}
              style={{ ...inputStyle, color: selectedSubject ? 'white' : 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
            >
              <option value="" style={{ color: 'black' }}>과목을 선택하세요</option>
              {subjects.map(s => <option key={s} value={s} style={{ color: 'black' }}>{s}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={!isReady}
          className="btn-primary"
          style={{ width: '100%', padding: '13px', opacity: isReady ? 1 : 0.35, cursor: isReady ? 'pointer' : 'not-allowed', fontSize: '1rem', fontWeight: 600 }}
        >
          분석 시작
        </button>
      </div>

      {/* 결과 패널 */}
      {results !== null && groupedResults && (
        <div className="double-bezel-outer" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                {analyzedSubject}
                <span style={{ marginLeft: '10px', fontSize: '0.8rem', fontWeight: 400, color: 'var(--accent)', background: 'rgba(98,114,164,0.15)', padding: '3px 10px', borderRadius: '9999px' }}>
                  {results.length}개 학급
                </span>
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '6px 0 0' }}>
                {analyzedRange?.start} ~ {analyzedRange?.end}
              </p>
            </div>
            {results.length > 0 && (
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>최소 <strong style={{ color: 'white' }}>{Math.min(...results.map(r => r.count))}시간</strong></span>
                <span>최대 <strong style={{ color: 'white' }}>{Math.max(...results.map(r => r.count))}시간</strong></span>
              </div>
            )}
          </div>

          {results.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>
              해당 기간에 분석 결과가 없습니다.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(groupedResults)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([year, classResults]) => (
                  <div key={year}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {year}학년
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                      {classResults.map(({ classInfo, count }) => {
                        const maxCount = Math.max(...results.map(r => r.count));
                        const minCount = Math.min(...results.map(r => r.count));
                        const isMax = count === maxCount && maxCount !== minCount;
                        const isMin = count === minCount && maxCount !== minCount;
                        return (
                          <div key={classInfo} style={{
                            background: isMax ? 'rgba(80,250,123,0.08)' : isMin ? 'rgba(255,85,85,0.08)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isMax ? 'rgba(80,250,123,0.25)' : isMin ? 'rgba(255,85,85,0.2)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '12px',
                            padding: '14px 12px',
                            textAlign: 'center',
                          }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '6px' }}>{classInfo}반</div>
                            <div style={{ color: isMax ? '#50fa7b' : isMin ? '#ff5555' : 'white', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{count}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '4px' }}>시간</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleAnalysis;
