import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import '../index.css';

const Login: React.FC = () => {
  const [loginMethod, setLoginMethod] = useState<'google' | 'local'>('google');
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const res = await axios.post('/api/auth/google', {
        credential: credentialResponse.credential
      });

      if (res.data.success) {
        // Active 사용자 - 로그인 성공
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        alert(`${res.data.user.name}님 환영합니다!`);
        navigate('/dashboard');
      } else {
        // Pending 상태이거나 가입 거절/에러
        alert(res.data.message);
      }
    } catch (err) {
      console.error(err);
      alert('로그인 처리 중 서버 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', padding: '20px' }}>
      
      {/* Vantablack Luxe Double-Bezel Card */}
      <div className="double-bezel-outer animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
        <div className="double-bezel-inner" style={{ textAlign: 'center' }}>
          
          {/* Eyebrow Tag */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <span style={{ 
              borderRadius: '9999px', padding: '6px 12px', fontSize: '11px', 
              textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600,
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)'
            }}>
              Seodaejeon High School System
            </span>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '12px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              스마트 시간표
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>교무 및 학사 관리를 위한 시스템에 로그인하세요.</p>
          </div>

          {/* Premium Custom Tabs */}
          <div style={{ display: 'flex', marginBottom: '40px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', padding: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
              onClick={() => setLoginMethod('google')}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', transition: 'var(--transition-spring)', background: loginMethod === 'google' ? 'rgba(255,255,255,0.1)' : 'transparent', color: loginMethod === 'google' ? 'white' : 'var(--text-secondary)' }}
            >
              구글 로그인
            </div>
            <div 
              onClick={() => setLoginMethod('local')}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', transition: 'var(--transition-spring)', background: loginMethod === 'local' ? 'rgba(255,255,255,0.1)' : 'transparent', color: loginMethod === 'local' ? 'white' : 'var(--text-secondary)' }}
            >
              일반 로그인
            </div>
          </div>

          <div style={{ minHeight: '220px' }}>
            {loginMethod === 'google' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards', alignItems: 'center' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    console.log('Login Failed');
                    alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
                  }}
                  useOneTap={false}
                  theme="filled_blue"
                  shape="rectangular"
                  size="large"
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '24px', lineHeight: 1.6 }}>
                  학교 방화벽으로 인해 구글 접속이 불가능한 선생님께서는 상단의 [일반 로그인] 탭을 이용해 주세요.
                </p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); navigate('/dashboard'); }} style={{ display: 'flex', flexDirection: 'column', animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <input type="text" placeholder="아이디 (또는 교직원 번호)" required />
                <input type="password" placeholder="비밀번호" required />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 'auto', marginBottom: 0, accentColor: 'white' }} /> 로그인 유지
                  </label>
                  <span style={{ cursor: 'pointer', transition: 'var(--transition-spring)' }} onMouseOver={(e) => e.currentTarget.style.color = 'white'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>비밀번호 찾기</span>
                </div>
                <button type="submit" className="btn-primary">
                  시스템 접속하기
                  <div className="btn-icon-wrapper">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                   </div>
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
