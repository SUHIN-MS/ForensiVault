import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, signup } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [loginData, setLoginData] = useState({ username: '', password: '' });

  const [signupData, setSignupData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    email: '',
    role: 'officer',
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(loginData.username, loginData.password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (signupData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signup({
      username: signupData.username,
      password: signupData.password,
      fullName: signupData.fullName,
      email: signupData.email,
      role: signupData.role,
    });

    if (result.success) {
      setSuccess('Account created successfully! Please login.');
      setIsLogin(true);
      setSignupData({
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        email: '',
        role: 'officer',
      });
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-shape auth-bg-shape-1"></div>
        <div className="auth-bg-shape auth-bg-shape-2"></div>
        <div className="auth-bg-shape auth-bg-shape-3"></div>
      </div>

      <button className="theme-toggle-auth" onClick={toggleTheme}>
        <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'}`}></i>
      </button>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <i className="fas fa-shield-halved"></i>
            </div>
            <h1>ForensiVault</h1>
            <p>Digital Evidence Management System</p>
          </div>

          <div className="auth-tabs">
            <button 
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
            >
              Login
            </button>
            <button 
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="auth-message auth-error">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}
          {success && (
            <div className="auth-message auth-success">
              <i className="fas fa-check-circle"></i>
              {success}
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="input-with-icon">
                  <i className="fas fa-user"></i>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter your username"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-with-icon">
                  <i className="fas fa-lock"></i>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Logging in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt"></i>
                    Login
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="auth-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-with-icon">
                    <i className="fas fa-id-card"></i>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="John Doe"
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <div className="input-with-icon">
                    <i className="fas fa-user"></i>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="johndoe"
                      value={signupData.username}
                      onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <div className="input-with-icon">
                  <i className="fas fa-envelope"></i>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="john@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <div className="input-with-icon">
                  <i className="fas fa-user-tag"></i>
                  <select
                    className="form-select"
                    value={signupData.role}
                    onChange={(e) => setSignupData({ ...signupData, role: e.target.value })}
                  >
                    <option value="officer">Officer</option>
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-with-icon">
                    <i className="fas fa-lock"></i>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Min 6 characters"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-with-icon">
                    <i className="fas fa-lock"></i>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Confirm password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Creating account...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus"></i>
                    Create Account
                  </>
                )}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                className="auth-link"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>

        <div className="auth-features">
          <h2>Secure Evidence Management</h2>
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-lock"></i>
              </div>
              <div>
                <h3>AES-256 Encryption</h3>
                <p>Military-grade encryption for all files</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-link"></i>
              </div>
              <div>
                <h3>Blockchain Logging</h3>
                <p>Tamper-proof audit trail</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-fingerprint"></i>
              </div>
              <div>
                <h3>Hash Verification</h3>
                <p>SHA-256 integrity checks</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-file-pdf"></i>
              </div>
              <div>
                <h3>Chain of Custody</h3>
                <p>Court-ready PDF reports</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;