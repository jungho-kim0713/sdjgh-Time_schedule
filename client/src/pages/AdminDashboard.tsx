import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const res = await axios.post('/api/users/update', {
        email,
        role,
        status
      });
      if (res.data.success) {
        alert('업데이트 성공');
        fetchData();
      } else {
        alert('오류: ' + res.data.message);
      }
    } catch (error) {
      console.error(error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <span style={{ borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, background: 'var(--glass-outer)', color: 'var(--text-secondary)' }}>
            Admin Panel
          </span>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 600, marginTop: '20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            관리자 대시보드
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
            가입한 교사 계정의 승인 상태 및 권한을 관리합니다.
          </p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'var(--transition-spring)', fontWeight: 600 }}
        >
          뒤로 가기
        </button>
      </div>

      <div className="double-bezel-outer">
         <div className="double-bezel-inner" style={{ padding: '40px', minHeight: '500px' }}>
            {loading ? (
               <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>사용자 데이터를 불러오는 중...</div>
            ) : users.length === 0 ? (
               <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '100px' }}>등록된 사용자가 없습니다.</div>
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
                     {users.map((u, idx) => {
                        const email = u['구글 계정'] || '-';
                        const name = u['이름'] || '-';
                        const tId = u['교사ID'] || '-';
                        const role = u['권한'] || 'User';
                        const status = u['상태'] || 'Pending';
                        
                        return (
                           <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '16px' }}>{email}</td>
                              <td style={{ padding: '16px' }}>{name}</td>
                              <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{tId}</td>
                              <td style={{ padding: '16px' }}>
                                 <span style={{ padding: '6px 12px', background: role === 'Admin' ? 'rgba(74, 144, 226, 0.2)' : 'rgba(255,255,255,0.1)', color: role === 'Admin' ? '#4a90e2' : 'white', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    {role}
                                 </span>
                              </td>
                              <td style={{ padding: '16px' }}>
                                 <span style={{ padding: '6px 12px', background: status === 'Active' ? 'rgba(74, 226, 144, 0.2)' : 'rgba(255, 184, 108, 0.2)', color: status === 'Active' ? '#4ae290' : '#ffb86c', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    {status}
                                 </span>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center' }}>
                                 {status === 'Pending' ? (
                                    <button onClick={() => handleUpdateUser(email, 'User', 'Active')} style={{ padding: '8px 16px', background: '#4ae290', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                                       승인하기
                                    </button>
                                 ) : (
                                    <button disabled style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'not-allowed' }}>
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
