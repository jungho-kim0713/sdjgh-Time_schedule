import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../index.css';

const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');

    // 1. URL에 SSO 토큰이 있는 경우 처리
    if (ssoToken) {
      // URL에서 token 파라미터 즉시 제거
      window.history.replaceState({}, '', window.location.pathname);
      
      axios.post('/api/auth/sso', { token: ssoToken })
        .then(res => {
          if (res.data.success) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/dashboard');
          } else {
            setError(res.data.message || '인증에 실패했습니다.');
          }
        })
        .catch(err => {
          setError(err.response?.data?.message || '인증 처리 중 오류가 발생했습니다.');
        });
      return;
    }

    // 2. 기존 세션이 있는지 확인
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      navigate('/dashboard');
      return;
    }

    // 3. 아무것도 없으면 플랫폼 통합 로그인 페이지로 리다이렉트
    // (약 1초 대기 후 이동하여 사용자에게 상황 알림)
    const timer = setTimeout(() => {
      window.location.href = 'https://platform.sdjgh-ai.kr/';
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', background: 'var(--bg-gradient-start)' }}>
      <div className="double-bezel-outer animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="double-bezel-inner" style={{ textAlign: 'center', padding: '60px 40px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <div style={{ 
              width: '48px', height: '48px', 
              border: '3px solid rgba(255,255,255,0.05)', 
              borderTopColor: error ? '#ff5555' : 'var(--accent)', 
              borderRadius: '50%', 
              animation: error ? 'none' : 'spin 1s linear infinite' 
            }} />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px', letterSpacing: '-0.02em' }}>
            {error ? '인증 오류' : '인증 확인 중'}
          </h1>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {error 
              ? error 
              : '서대전여고 통합 플랫폼을 통해 인증을 진행하고 있습니다. 잠시만 기다려 주세요.'}
          </p>

          {error && (
            <button 
              onClick={() => window.location.href = 'https://platform.sdjgh-ai.kr/'}
              className="btn-primary" 
              style={{ marginTop: '32px' }}
            >
              플랫폼으로 이동하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
