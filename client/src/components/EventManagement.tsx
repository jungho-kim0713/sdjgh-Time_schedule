import React, { useState, useMemo } from 'react';
import axios from 'axios';

interface Props {
  dailySchedules: any[];
  onUpdate: () => void;
}

const getDayString = (dateStr: string): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
};

const EventManagement: React.FC<Props> = ({ dailySchedules, onUpdate }) => {
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [startPeriod, setStartPeriod] = useState('1');
  const [endPeriod, setEndPeriod] = useState('7');
  const [targetScope, setTargetScope] = useState('행사(전체)');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const activeEvents = useMemo(() => {
    const map = new Map();
    dailySchedules.forEach(d => {
       if (d['상태'] === '행사') {
           map.set(`${d['날짜']}_${d['교시']}_${d['강좌코드']}`, d);
       } else if (d['상태'] === '취소' && d['강좌코드'].startsWith('행사')) {
           map.delete(`${d['날짜']}_${d['교시']}_${d['강좌코드']}`);
       }
    });
    return Array.from(map.values()).sort((a, b) => {
        const d = a['날짜'].localeCompare(b['날짜']);
        if (d !== 0) return d;
        return parseInt(a['교시']) - parseInt(b['교시']);
    });
  }, [dailySchedules]);

  const handleRegister = async () => {
    if (!reason.trim()) {
      alert('행사명(사유)을 입력해주세요.');
      return;
    }
    const s = parseInt(startPeriod);
    const e = parseInt(endPeriod);
    if (s > e) {
      alert('종료 교시가 시작 교시보다 빠를 수 없습니다.');
      return;
    }

    if (!window.confirm(`${targetDate} (${getDayString(targetDate)}) ${s}교시~${e}교시에 [${reason}] 행사를 등록하시겠습니까?`)) return;

    setLoading(true);
    const payloads = [];
    for (let p = s; p <= e; p++) {
      payloads.push({
        date: targetDate,
        period: String(p),
        courseCode: targetScope,
        sourceTeacher: '',
        targetTeacher: '',
        status: '행사',
        reason: reason
      });
    }

    try {
      const res = await axios.post('/api/schedule/update', { payloads });
      if (res.data.success) {
        alert('등록되었습니다.');
        setReason('');
        onUpdate();
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const handleCancel = async (event: any) => {
    if (!window.confirm(`${event['날짜']} (${getDayString(event['날짜'])}) ${event['교시']}교시 [${event['사유']}] 행사를 취소하시겠습니까?`)) return;
    
    setLoading(true);
    try {
      const payloads = [{
        date: event['날짜'],
        period: event['교시'],
        courseCode: event['강좌코드'],
        sourceTeacher: '',
        targetTeacher: '',
        status: '취소',
        reason: '행사 취소'
      }];
      const res = await axios.post('/api/schedule/update', { payloads });
      if (res.data.success) {
        alert('취소되었습니다.');
        onUpdate();
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.15)',
    padding: '10px 14px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', fontFamily: 'Pretendard',
    colorScheme: 'dark', boxSizing: 'border-box', height: '42px', margin: 0, width: '100%'
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s' }}>
      
      <div className="double-bezel-outer" style={{ padding: '32px' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>행사 및 학사일정 등록</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>지정된 날짜와 교시의 모든 수업을 행사로 대체합니다.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '16px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>날짜</label>
            <div style={{ ...inputStyle, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.95rem', color: 'white' }}>
                {targetDate ? `${targetDate} (${getDayString(targetDate)})` : '날짜 선택'}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} onClick={(e) => { try { (e.target as any).showPicker(); } catch(err){} }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
               <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>시작 교시</label>
               <select value={startPeriod} onChange={e => setStartPeriod(e.target.value)} style={inputStyle}>
                 {[1,2,3,4,5,6,7].map(p => <option key={p} style={{color:'black'}} value={p}>{p}교시</option>)}
               </select>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
               <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>종료 교시</label>
               <select value={endPeriod} onChange={e => setEndPeriod(e.target.value)} style={inputStyle}>
                 {[1,2,3,4,5,6,7].map(p => <option key={p} style={{color:'black'}} value={p}>{p}교시</option>)}
               </select>
             </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>대상</label>
            <select value={targetScope} onChange={e => setTargetScope(e.target.value)} style={inputStyle}>
              <option style={{color:'black'}} value="행사(전체)">전체 학년</option>
              <option style={{color:'black'}} value="행사(1학년)">1학년</option>
              <option style={{color:'black'}} value="행사(2학년)">2학년</option>
              <option style={{color:'black'}} value="행사(3학년)">3학년</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>행사명 (사유)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 어린이날, 체육대회" style={inputStyle} />
          </div>
        </div>
        
        <button onClick={handleRegister} disabled={loading} className="btn-primary" style={{ marginTop: '24px', width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}>
          {loading ? '등록 중...' : '해당 일정으로 행사 등록하기'}
        </button>
      </div>

      <div className="double-bezel-outer" style={{ padding: '32px' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.2rem', color: 'white' }}>등록된 행사 목록</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>취소 버튼을 누르면 원래 시간표로 복구됩니다.</p>
        
        {activeEvents.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>등록된 행사가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>날짜</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>교시</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>대상</th>
                <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>행사명</th>
                <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {activeEvents.map(e => (
                <tr key={`${e['날짜']}_${e['교시']}_${e['강좌코드']}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px' }}>{e['날짜']} ({getDayString(e['날짜'])})</td>
                  <td style={{ padding: '12px' }}>{e['교시']}교시</td>
                  <td style={{ padding: '12px' }}>{e['강좌코드'].replace('행사(', '').replace(')', '')}</td>
                  <td style={{ padding: '12px', color: '#ffb86c' }}>{e['사유']}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button onClick={() => handleCancel(e)} disabled={loading} style={{ background: 'rgba(255,85,85,0.15)', color: '#ff5555', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                      취소
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default EventManagement;
