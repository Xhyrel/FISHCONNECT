import React, { useState } from 'react';

function AuthModal({ onClose, onAuthSuccess, apiUrl }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    mobile: '',
    address: '',
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    role: 'buyer'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isLogin) {
      if (!formData.first_name.trim()) {
        setError('First name is required');
        setLoading(false);
        return;
      }
      if (!formData.last_name.trim()) {
        setError('Last name is required');
        setLoading(false);
        return;
      }
      if (!formData.mobile.trim()) {
        setError('Mobile number is required');
        setLoading(false);
        return;
      }
      if (!formData.address.trim()) {
        setError('Address is required');
        setLoading(false);
        return;
      }
      if (!formData.email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }
      if (!formData.username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      if (!formData.password) {
        setError('Password is required');
        setLoading(false);
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
    } else {
      if (!formData.username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      if (!formData.password) {
        setError('Password is required');
        setLoading(false);
        return;
      }
    }

    const endpoint = isLogin ? `${apiUrl}/auth/login` : `${apiUrl}/auth/register`;
    
    let payload;
    if (isLogin) {
      payload = {
        username: formData.username.trim(),
        password: formData.password
      };
    } else {
      payload = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() === '' ? null : formData.middle_name.trim(),
        last_name: formData.last_name.trim(),
        mobile: formData.mobile.trim(),
        address: formData.address.trim(),
        email: formData.email.trim().toLowerCase(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        role: formData.role
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>✕</button>
        
        <div className="auth-modal-header">
          <div className="auth-logo">🐟 FishConnect</div>
          <h2>{isLogin ? 'Welcome Back!' : 'Join FishConnect'}</h2>
          <p>{isLogin ? 'Login to continue shopping' : 'Create an account to start buying fresh seafood'}</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { 
              setIsLogin(true); 
              setError('');
              setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
            }}
          >
            Login
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { 
              setIsLogin(false); 
              setError('');
              setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input 
                    type="text" 
                    name="first_name" 
                    placeholder="Enter first name" 
                    value={formData.first_name}
                    onChange={handleChange} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Middle Name</label>
                  <input 
                    type="text" 
                    name="middle_name" 
                    placeholder="Optional" 
                    value={formData.middle_name}
                    onChange={handleChange} 
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  name="last_name" 
                  placeholder="Enter last name" 
                  value={formData.last_name}
                  onChange={handleChange} 
                  required 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input 
                    type="tel" 
                    name="mobile" 
                    placeholder="09XXXXXXXXX" 
                    value={formData.mobile}
                    onChange={handleChange} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input 
                    type="email" 
                    name="email" 
                    placeholder="you@example.com" 
                    value={formData.email}
                    onChange={handleChange} 
                    required 
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Complete Address *</label>
                <textarea 
                  name="address" 
                  placeholder="House #, Street, Barangay, City, Province" 
                  value={formData.address}
                  onChange={handleChange} 
                  rows="2"
                  required 
                />
              </div>
            </>
          )}
          
          <div className="form-group">
            <label>Username *</label>
            <input 
              type="text" 
              name="username" 
              placeholder="Choose a username" 
              value={formData.username}
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Password *</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleChange} 
                required 
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          
          {!isLogin && (
            <>
              <div className="form-group">
                <label>Confirm Password *</label>
                <div className="password-input-wrapper">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirm_password" 
                    placeholder="••••••••" 
                    value={formData.confirm_password}
                    onChange={handleChange} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label>I want to</label>
                <div className="role-buttons">
                  <button 
                    type="button"
                    className={`role-btn ${formData.role === 'buyer' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'buyer' }))}
                  >
                    🛒 Buy Seafood
                  </button>
                  <button 
                    type="button"
                    className={`role-btn ${formData.role === 'seller' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'seller' }))}
                  >
                    📦 Sell Seafood
                  </button>
                </div>
                <small className="role-note">
                  {formData.role === 'seller' 
                    ? 'Sellers can list and sell seafood products.' 
                    : 'Buyers can purchase fresh seafood.'}
                </small>
              </div>
            </>
          )}
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              className="auth-switch-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
              }}
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;