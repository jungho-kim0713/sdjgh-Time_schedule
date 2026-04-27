import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ROLES = ['관리자', '업무담당자', '교사', '학생'];

const getRoleBadgeStyle = (role: string): React.CSSProperties => {
  if (role === '관리자') return { background: 'rgba(74,144,226,0.2)', color: '#4a90e2' };
  if (role === '업무담당자') return { background: 'rgba(255,184,108,0.2)', color: '#ffb86c' };
  if (role === '교사') return { background: 'rgba(74,226,144,0.2)', color: '#4ae290' };
  if (role === '학생') return { background: 'rgba(189,147,249,0.2)', color: '#bd93f9' };
  return { background: 'rgba(255,255,255,0.1)', color: 'white' };
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState('');

  const fetchData = () => {
    setLoading(true);
    axios.get('/api/data')
      .then(res => {
        if(res.data.success) {
          setUsers(res.data.data.users || []);
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

  const handleUpdateUser = async (email: string, role: string, status: string) => {
    if (!window.confirm(`${email} 사용자의 상태를 업데이트 하시겠습니까?`)) return;
    try {
      const res = await axios.post('/api/users/update', { email, role, status });
      if (res.data.success) {
        alert('업데이트 성공');
        fetchData();
      } else {
        alert('오류: ' + res.data.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '알 수 없는 오류';
      const status = error?.response?.status || '';
      alert(`오류 ${status}: ${msg}`);
    }
  };

  const handleRoleChange = async (email: string, newRole: string, currentStatus: string) => {
    if (!window.confirm(`${email} 의 권한을 '${newRole}'(으)로 변경하시겠습니까?`)) return;
    try {
      const res = await axios.post('/api/users/update', { email, role: newRole, status: currentStatus });
      if (res.data.success) {
        fetchData();
      } else {
        alert('오류: ' + res.data.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '알 수 없는 오류';
      const status = error?.response?.status || '';
      alert(`오류 ${status}: ${msg}`);
    }
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    setCacheMsg('');
    try {
      const res = await axios.post('/api/admin/clear-cache');
      if (res.data.success) {
        setCacheMsg('✅ 캐시 초기화 완료! 최신 데이터를 불러옵니다...');
        await fetchData();
        setTimeout(() => setCacheMsg(''), 4000);
      }
    } catch (error: any) {
      setCacheMsg('❌ 초기화 실패: ' + (error?.response?.data?.message || '오류'));
      setTimeout(() => setCacheMsg(''), 4000);
    } finally {
      setCacheClearing(false);
    }
  };

  // 검색 필터
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(u =>
      (u['구글 계정'] || '').toLowerCase().includes(q) ||
      (u['이름'] || '').toLowerCase().includes(q) ||
      (u['교사ID'] || '').toLowerCase().includes(q) ||
      (u['권한'] || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const pendingCount = users.filter(u => (u['상태'] || 'Pending') === 'Pending').length;

  return (
    <div style={{ minHeight: '100vh', padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, background: 'var(--glass-outer)', color: 'var(--text-secondary)' }}>
            Admin Panel
          </span>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 600, marginTop: '16px', letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            사용자 관리
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
            가입한 계정의 승인 상태 및 권한을 관리합니다.
            {pendingCount > 0 && (
              <span style={{ marginLeft: '12px', background: 'rgba(255,184,108,0.2)', color: '#ffb86c', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600 }}>
                승인 대기 {pendingCount}명
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'var(--transition-spring)', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'Pretendard', width: 'auto' }}
          >
            ← 뒤로 가기
          </button>
          <button
            id="admin-clear-cache-btn"
            onClick={handleClearCache}
            disabled={cacheClearing}
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
        </div>
      </div>

      {/* 툴바: 검색 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* 검색창 */}
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '1rem', pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            id="admin-user-search"
            type="text"
            placeholder="이름, 이메일, 교사ID, 권한으로 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '40px',
              paddingRight: '14px',
              paddingTop: '12px',
              paddingBottom: '12px',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              outline: 'none',
              fontSize: '0.9rem',
              fontFamily: 'Pretendard, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px' }}
            >✕</button>
          )}
        </div>

        {/* 결과 카운트 */}
        {searchQuery && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {filteredUsers.length} / {users.length}명
          </span>
        )}
      </div>

      {/* 캐시 메시지 */}
      {cacheMsg && (
        <div style={{ marginBottom: '16px', padding: '12px 18px', background: 'rgba(74,226,144,0.1)', border: '1px solid rgba(74,226,144,0.25)', borderRadius: '10px', fontSize: '0.9rem', color: '#4ae290' }}>
          {cacheMsg}
        </div>
      )}

      {/* 사용자 테이블 */}
      <div className="double-bezel-outer">
        <div className="double-bezel-inner" style={{ padding: '40px', minHeight: '500px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>사용자 데이터를 불러오는 중...</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>
              {searchQuery ? `"${searchQuery}" 에 해당하는 사용자가 없습니다.` : '등록된 사용자가 없습니다.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>구글 계정</th>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>이름</th>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>교사ID</th>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>권한</th>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)' }}>상태</th>
                  <th style={{ padding: '16px', borderBottom: '2px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)', textAlign: 'center' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, idx) => {
                  const email = u['구글 계정'] || '-';
                  const name = u['이름'] || '-';
                  const tId = u['교사ID'] || '-';
                  const role = u['권한'] || '학생';
                  const status = u['상태'] || 'Pending';
                  const isPending = status === 'Pending';

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isPending ? 'rgba(255,184,108,0.04)' : 'transparent', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px', fontSize: '0.9rem' }}>{email}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{name}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{tId}</td>
                      <td style={{ padding: '16px' }}>
                        {status === 'Active' ? (
                          <select
                            value={role}
                            onChange={(e) => handleRoleChange(email, e.target.value, status)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              border: '1px solid rgba(255,255,255,0.15)',
                              cursor: 'pointer',
                              fontFamily: 'Pretendard',
                              ...getRoleBadgeStyle(role),
                              background: getRoleBadgeStyle(role).background,
                            }}
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r} style={{ color: 'black', background: 'white' }}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                            {role}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '6px 12px', background: status === 'Active' ? 'rgba(74, 226, 144, 0.2)' : 'rgba(255, 184, 108, 0.2)', color: status === 'Active' ? '#4ae290' : '#ffb86c', borderRadius: '8px', fontSize: '0.85rem' }}>
                          {status === 'Active' ? '활성' : '대기'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        {status === 'Pending' ? (
                          <button onClick={() => handleUpdateUser(email, '학생', 'Active')} style={{ padding: '8px 16px', background: '#4ae290', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'Pretendard' }}>
                            승인
                          </button>
                        ) : (
                          <button disabled style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'not-allowed', fontFamily: 'Pretendard' }}>
                            완료됨
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
