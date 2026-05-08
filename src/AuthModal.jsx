// AuthModal.jsx - Fixed version with proper data handling
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
      // Validation for signup
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
      // Validation for login
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
      // Make sure all fields are properly formatted - convert empty strings to null for optional fields
      payload = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() === '' ? null : formData.middle_name.trim(),
        last_name: formData.last_name.trim(),
        mobile: formData.mobile.trim(),
        address: formData.address.trim(),
        email: formData.email.trim().toLowerCase(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        role: formData.role // This should be either 'buyer' or 'seller'
      };
    }

    console.log('Sending payload:', { ...payload, password: '[HIDDEN]' });

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

    // Make sure this matches your backend response
    onAuthSuccess({
      token: data.token,
      user: data.user
    });
  } catch (err) {
    console.error('Auth error:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose}>✕</button>
        
        <div className="auth-tabs">
          <button 
            className={isLogin ? 'active' : ''} 
            onClick={() => { 
              setIsLogin(true); 
              setError('');
              setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
            }}
          >
            Login
          </button>
          <button 
            className={!isLogin ? 'active' : ''} 
            onClick={() => { 
              setIsLogin(false); 
              setError('');
              setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="name-row">
                <input 
                  type="text" 
                  name="first_name" 
                  placeholder="First Name *" 
                  value={formData.first_name}
                  onChange={handleChange} 
                  required 
                />
                <input 
                  type="text" 
                  name="middle_name" 
                  placeholder="Middle Name (Optional)" 
                  value={formData.middle_name}
                  onChange={handleChange} 
                />
              </div>
              <input 
                type="text" 
                name="last_name" 
                placeholder="Last Name *" 
                value={formData.last_name}
                onChange={handleChange} 
                required 
              />
              <input 
                type="tel" 
                name="mobile" 
                placeholder="Mobile Number *" 
                value={formData.mobile}
                onChange={handleChange} 
                required 
              />
              <textarea 
                name="address" 
                placeholder="Complete Address *" 
                value={formData.address}
                onChange={handleChange} 
                required 
              />
              <input 
                type="email" 
                name="email" 
                placeholder="Email Address *" 
                value={formData.email}
                onChange={handleChange} 
                required 
              />
            </>
          )}
          
          <input 
            type="text" 
            name="username" 
            placeholder="Username *" 
            value={formData.username}
            onChange={handleChange} 
            required 
          />
          
          <input 
            type="password" 
            name="password" 
            placeholder="Password *" 
            value={formData.password}
            onChange={handleChange} 
            required 
          />
          
          {!isLogin && (
            <>
              <input 
                type="password" 
                name="confirm_password" 
                placeholder="Confirm Password *" 
                value={formData.confirm_password}
                onChange={handleChange} 
                required 
              />
              <select 
                name="role" 
                value={formData.role}
                onChange={handleChange} 
                className="auth-role-select"
              >
                <option value="buyer">Sign up as Buyer</option>
                <option value="seller">Sign up as Seller (Vendor)</option>
              </select>
              <p className="role-note">
                {formData.role === 'seller' 
                  ? 'Sellers can list and sell seafood products.' 
                  : 'Buyers can purchase fresh seafood.'}
              </p>
            </>
          )}
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;