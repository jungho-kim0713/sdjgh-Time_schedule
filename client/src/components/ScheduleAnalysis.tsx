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

const isSpecialCourse = (code: string) => {
  return code === '자율(전체)' || code === '클럽(전체)' || code === '자습(전체)' || code.startsWith('부장(회의)') || code.startsWith('행사(');
};

// 취소된 txID 집합을 반환
const getCancelledTxIDs = (dailyForDate: any[]): Set<string> => {
  return new Set(
    dailyForDate
      .filter(d => d['상태'] === '취소')
      .map(d => d['사유'])
  );
};

const ALL_SUBJECTS = '__ALL__';

const ScheduleAnalysis: React.FC<Props> = ({ courses, baseSchedules, dailySchedules }) => {
  const [startDate, setStartDate] = useState<string>('2026-03-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  // 단일 과목 결과
  const [results, setResults] = useState<{ classInfo: string; count: number }[] | null>(null);
  // 전체 과목 결과: { [subjectName]: { classInfo, count }[] }
  const [allResults, setAllResults] = useState<Record<string, { classInfo: string; count: number }[]> | null>(null);
  const [analyzedSubject, setAnalyzedSubject] = useState<string>('');
  const [analyzedRange, setAnalyzedRange] = useState<{ start: string; end: string } | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    courses.forEach(c => {
      if (!isSpecialCourse(c['강좌코드'])) set.add(c['과목명']);
    });
    return Array.from(set).sort();
  }, [courses]);

  // 과목명 → 담당교사 목록 맵 (중복 제거)
  const subjectTeacherMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    courses.forEach(c => {
      if (!isSpecialCourse(c['강좌코드']) && c['과목명'] && c['담당교사']) {
        if (!map[c['과목명']]) map[c['과목명']] = new Set();
        map[c['과목명']].add(c['담당교사']);
      }
    });
    return map;
  }, [courses]);

  const getTeacherLabel = (subjectName: string): string => {
    const teachers = subjectTeacherMap[subjectName];
    if (!teachers || teachers.size === 0) return '';
    return Array.from(teachers).join('/');
  };

  // 날짜 루프의 공통 로직: activeCourses[] 반환
  const getActiveCoursesForPeriod = (
    baseForDay: any[],
    activeDaily: any[],
    period: string
  ): string[] => {
    const removedCodes = new Set(
      activeDaily
        .filter(d => String(d['교시']) === period &&
          ['이동(OUT)', '자습', '통합'].includes(d['상태']))
        .map(d => d['강좌코드'])
    );

    const activeCourses: string[] = [];
    const baseCourses = baseForDay.filter(s => String(s['교시']) === period);

    const events = activeDaily.filter(d => String(d['교시']) === period && d['상태'] === '행사');
    const isAllEvent = events.some(e => e['강좌코드'] === '행사(전체)');
    const gradeEvents = events.map(e => e['강좌코드'].match(/\d/)?.[0]).filter(Boolean);

    baseCourses.forEach(s => {
      if (isAllEvent) return;
      const m = s['강좌코드'].match(/\((\d)-/);
      if (m && gradeEvents.includes(m[1])) return;
      if (!removedCodes.has(s['강좌코드'])) {
        activeCourses.push(s['강좌코드']);
      }
    });

    activeDaily
      .filter(d => String(d['교시']) === period &&
        (d['상태'] === '이동(IN)' || d['상태'] === '보강'))
      .forEach(d => activeCourses.push(d['강좌코드']));

    return activeCourses;
  };

  const analyze = () => {
    if (!startDate || !endDate || !selectedSubject) return;

    const isAll = selectedSubject === ALL_SUBJECTS;

    // 과목명 → 강좌코드 맵 (빠른 조회)
    const codeToSubject: Record<string, string> = {};
    courses.forEach(c => {
      if (!isSpecialCourse(c['강좌코드'])) {
        codeToSubject[c['강좌코드']] = c['과목명'];
      }
    });

    // 집계 구조
    const classCounts: Record<string, number> = {}; // 단일 과목용
    const allClassCounts: Record<string, Record<string, number>> = {}; // 전체용: subject → classInfo → count

    const current = new Date(startDate);
    const end = new Date(endDate);
    const PERIODS = ['1', '2', '3', '4', '5', '6', '7'];

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

        PERIODS.forEach(p => {
          const activeCourses = getActiveCoursesForPeriod(baseForDay, activeDaily, p);

          activeCourses.forEach(code => {
            if (isSpecialCourse(code)) return;
            const classInfo = extractClassInfo(code);
            if (!classInfo) return;

            if (isAll) {
              const subjectName = codeToSubject[code];
              if (!subjectName) return;
              if (!allClassCounts[subjectName]) allClassCounts[subjectName] = {};
              allClassCounts[subjectName][classInfo] = (allClassCounts[subjectName][classInfo] || 0) + 1;
            } else {
              const courseInfo = courses.find(c => c['강좌코드'] === code);
              if (courseInfo && courseInfo['과목명'] === selectedSubject) {
                classCounts[classInfo] = (classCounts[classInfo] || 0) + 1;
              }
            }
          });
        });
      }

      current.setDate(current.getDate() + 1);
    }

    const sortEntries = (entries: [string, number][]) =>
      entries
        .map(([classInfo, count]) => ({ classInfo, count }))
        .sort((a, b) => {
          const [aY, aC] = a.classInfo.split('-').map(Number);
          const [bY, bC] = b.classInfo.split('-').map(Number);
          return aY !== bY ? aY - bY : aC - bC;
        });

    if (isAll) {
      const formatted: Record<string, { classInfo: string; count: number }[]> = {};
      Object.entries(allClassCounts).forEach(([subj, counts]) => {
        formatted[subj] = sortEntries(Object.entries(counts));
      });
      setAllResults(formatted);
      setResults(null);
    } else {
      const sorted = sortEntries(Object.entries(classCounts));
      setResults(sorted);
      setAllResults(null);
    }

    setAnalyzedSubject(selectedSubject === ALL_SUBJECTS ? '전체 과목' : selectedSubject);
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

  // 단일 과목: 학년별 그룹핑
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

  // 단일 과목 결과 카드 렌더
  const renderSingleResult = (
    subjectLabel: string,
    sortedResults: { classInfo: string; count: number }[],
    grouped: Record<number, { classInfo: string; count: number }[]>
  ) => {
    const maxCount = Math.max(...sortedResults.map(r => r.count));
    const minCount = Math.min(...sortedResults.map(r => r.count));

    return (
      <div className="double-bezel-outer" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              {subjectLabel}
              {analyzedSubject !== '전체 과목' && getTeacherLabel(analyzedSubject) && (
                <span style={{ marginLeft: '8px', fontSize: '0.82rem', fontWeight: 400, color: '#ffb86c' }}>
                  ({getTeacherLabel(analyzedSubject)})
                </span>
              )}
              <span style={{ marginLeft: '10px', fontSize: '0.8rem', fontWeight: 400, color: 'var(--accent)', background: 'rgba(98,114,164,0.15)', padding: '3px 10px', borderRadius: '9999px' }}>
                {sortedResults.length}개 학급
              </span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '6px 0 0' }}>
              {analyzedRange?.start} ({getDayString(analyzedRange?.start || '')}) ~ {analyzedRange?.end} ({getDayString(analyzedRange?.end || '')})
            </p>
          </div>
          {sortedResults.length > 0 && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>최소 <strong style={{ color: 'white' }}>{minCount}시간</strong></span>
              <span>최대 <strong style={{ color: 'white' }}>{maxCount}시간</strong></span>
            </div>
          )}
        </div>

        {sortedResults.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>
            해당 기간에 분석 결과가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(grouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([year, classResults]) => (
                <div key={year}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {year}학년
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                    {classResults.map(({ classInfo, count }) => {
                      const isMax = count === maxCount && maxCount !== minCount;
                      const isMin = count === minCount && maxCount !== minCount;
                      return (
                        <div key={classInfo} style={{
                          background: isMax ? 'rgba(80,250,123,0.08)' : isMin ? 'rgba(255,85,85,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isMax ? 'rgba(80,250,123,0.25)' : isMin ? 'rgba(255,85,85,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: '10px',
                          padding: '10px 8px',
                          textAlign: 'center',
                        }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>{classInfo}반</div>
                          <div style={{ color: isMax ? '#50fa7b' : isMin ? '#ff5555' : 'white', fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>{count}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '4px' }}>시간</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px', alignItems: 'start', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>시작일</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setResults(null); setAllResults(null); }} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>종료일</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setResults(null); setAllResults(null); }} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>과목</label>
            <select
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setResults(null); setAllResults(null); }}
              style={{ ...inputStyle, color: selectedSubject ? 'white' : 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
            >
              <option value="" style={{ color: 'black' }}>과목을 선택하세요</option>
              <option value={ALL_SUBJECTS} style={{ color: 'black', fontWeight: 600 }}>★ 전체 과목</option>
              {subjects.map(s => {
                const teacherLabel = getTeacherLabel(s);
                return (
                  <option key={s} value={s} style={{ color: 'black' }}>
                    {s}{teacherLabel ? `(${teacherLabel})` : ''}
                  </option>
                );
              })}
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

      {/* 단일 과목 결과 */}
      {results !== null && groupedResults && (
        renderSingleResult(analyzedSubject, results, groupedResults)
      )}

      {/* 전체 과목 결과 */}
      {allResults !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                전체 과목 분석
                <span style={{ marginLeft: '10px', fontSize: '0.8rem', fontWeight: 400, color: 'var(--accent)', background: 'rgba(98,114,164,0.15)', padding: '3px 10px', borderRadius: '9999px' }}>
                  {Object.keys(allResults).length}개 과목
                </span>
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '6px 0 0' }}>
                {analyzedRange?.start} ({getDayString(analyzedRange?.start || '')}) ~ {analyzedRange?.end} ({getDayString(analyzedRange?.end || '')})
              </p>
            </div>
          </div>

          {/* 과목별 카드 */}
          {Object.entries(allResults)
            .sort(([a], [b]) => a.localeCompare(b, 'ko'))
            .map(([subjectName, subjectResults]) => {
              if (subjectResults.length === 0) return null;

              const maxCount = Math.max(...subjectResults.map(r => r.count));
              const minCount = Math.min(...subjectResults.map(r => r.count));
              const grouped: Record<number, { classInfo: string; count: number }[]> = {};
              subjectResults.forEach(r => {
                const year = Number(r.classInfo.split('-')[0]);
                if (!grouped[year]) grouped[year] = [];
                grouped[year].push(r);
              });

              return (
                <div key={subjectName} className="double-bezel-outer" style={{ padding: '20px 24px' }}>
                  {/* 과목 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'white', fontSize: '1rem', fontWeight: 600 }}>{subjectName}</span>
                      {getTeacherLabel(subjectName) && (
                        <span style={{ fontSize: '0.8rem', color: '#ffb86c', fontWeight: 400 }}>
                          ({getTeacherLabel(subjectName)})
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '9999px' }}>
                        {subjectResults.length}개 학급
                      </span>
                    </div>
                    {subjectResults.length > 0 && maxCount !== minCount && (
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>최소 <strong style={{ color: '#ff5555' }}>{minCount}</strong></span>
                        <span>최대 <strong style={{ color: '#50fa7b' }}>{maxCount}</strong></span>
                        <span>차이 <strong style={{ color: 'white' }}>{maxCount - minCount}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* 학년별 학급 카드 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(grouped)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([year, classResults]) => (
                        <div key={year}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {year}학년
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                            {classResults.map(({ classInfo, count }) => {
                              const isMax = count === maxCount && maxCount !== minCount;
                              const isMin = count === minCount && maxCount !== minCount;
                              return (
                                <div key={classInfo} style={{
                                  background: isMax ? 'rgba(80,250,123,0.08)' : isMin ? 'rgba(255,85,85,0.08)' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${isMax ? 'rgba(80,250,123,0.2)' : isMin ? 'rgba(255,85,85,0.15)' : 'rgba(255,255,255,0.07)'}`,
                                  borderRadius: '8px',
                                  padding: '8px 6px',
                                  textAlign: 'center',
                                }}>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '3px' }}>{classInfo}반</div>
                                  <div style={{ color: isMax ? '#50fa7b' : isMin ? '#ff5555' : 'white', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1 }}>{count}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginTop: '3px' }}>시간</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default ScheduleAnalysis;
