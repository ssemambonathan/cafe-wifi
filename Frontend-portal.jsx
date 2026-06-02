// CaptivePortal.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const CaptivePortal = () => {
    const [voucherCode, setVoucherCode] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [showPayment, setShowPayment] = useState(false);
    const [mobileNumber, setMobileNumber] = useState('');
    const [amount, setAmount] = useState(1000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const socket = io(process.env.REACT_APP_API_URL);
    
    // Get MAC address and IP from captive portal query params
    const urlParams = new URLSearchParams(window.location.search);
    const macAddress = urlParams.get('mac') || '00:00:00:00:00:00';
    const ipAddress = urlParams.get('ip') || '0.0.0.0';
    
    useEffect(() => {
        // Check if already authenticated
        checkSession();
        
        // WebSocket listener for session updates
        socket.on(`session:${macAddress}`, (data) => {
            if (data.action === 'expired') {
                setIsAuthenticated(false);
                setTimeLeft(null);
                setError('Your session has expired. Please purchase new voucher.');
            } else if (data.action === 'started') {
                setIsAuthenticated(true);
                startTimer(data.expires_at);
            }
        });
        
        return () => socket.disconnect();
    }, []);
    
    const checkSession = async () => {
        try {
            const response = await axios.get(`/api/session/check/${macAddress}`);
            if (response.data.active) {
                setIsAuthenticated(true);
                startTimer(response.data.expires_at);
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    };
    
    const startTimer = (expiresAt) => {
        const updateTimer = () => {
            const now = new Date();
            const expiry = new Date(expiresAt);
            const diff = Math.floor((expiry - now) / 1000);
            
            if (diff <= 0) {
                setIsAuthenticated(false);
                setTimeLeft(null);
                return;
            }
            
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            
            setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        
        return () => clearInterval(interval);
    };
    
    const handleVoucherSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.post('/api/validate-voucher', {
                code: voucherCode,
                mac_address: macAddress,
                ip_address: ipAddress
            });
            
            if (response.data.success) {
                setIsAuthenticated(true);
                setVoucherCode('');
                startTimer(response.data.expires_at);
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Invalid voucher code');
        } finally {
            setLoading(false);
        }
    };
    
    const handlePayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.post('/api/payment/initiate', {
                amount: amount,
                mobile_number: mobileNumber,
                provider: 'MTN'
            });
            
            if (response.data.success) {
                // Show payment instructions (usually USSD popup)
                alert(`Please complete payment on your phone. Reference: ${response.data.transaction_ref}`);
                
                // Poll for payment confirmation
                const checkPayment = setInterval(async () => {
                    const status = await axios.get(`/api/payment/status/${response.data.transaction_ref}`);
                    if (status.data.status === 'completed') {
                        clearInterval(checkPayment);
                        alert('Payment successful! Voucher code sent via SMS');
                        setShowPayment(false);
                        setMobileNumber('');
                    }
                }, 5000);
            }
        } catch (error) {
            setError('Payment initiation failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    if (isAuthenticated) {
        return (
            <div className="portal-container">
                <div className="session-card">
                    <h2>Connected to Cafe WiFi</h2>
                    <div className="timer-display">
                        <span className="timer-label">Time Remaining:</span>
                        <span className="timer-value">{timeLeft}</span>
                    </div>
                    <button 
                        onClick={() => window.location.href = 'http://google.com'}
                        className="continue-button"
                    >
                        Continue Browsing
                    </button>
                    <button 
                        onClick={() => setShowPayment(true)}
                        className="extend-button"
                    >
                        Extend Session
                    </button>
                </div>
                
                {showPayment && (
                    <div className="payment-modal">
                        <h3>Extend Your Session</h3>
                        <form onSubmit={handlePayment}>
                            <input
                                type="tel"
                                placeholder="Mobile Money Number"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                required
                            />
                            <select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
                                <option value={1000}>1 Hour - 1,000 UGX</option>
                                <option value={2000}>3 Hours - 2,000 UGX</option>
                                <option value={5000}>Day Pass - 5,000 UGX</option>
                            </select>
                            <button type="submit" disabled={loading}>
                                {loading ? 'Processing...' : 'Pay with Mobile Money'}
                            </button>
                            <button type="button" onClick={() => setShowPayment(false)}>Cancel</button>
                        </form>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className="portal-container">
            <div className="welcome-card">
                <h1>Welcome to Cafe Connect</h1>
                <p>Please enter your voucher code or purchase WiFi access</p>
                
                <div className="tabs">
                    <button className="tab active">Enter Voucher</button>
                    <button 
                        className="tab"
                        onClick={() => setShowPayment(true)}
                    >
                        Buy WiFi
                    </button>
                </div>
                
                <form onSubmit={handleVoucherSubmit} className="voucher-form">
                    <input
                        type="text"
                        placeholder="Enter Voucher Code"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        maxLength="12"
                        required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Validating...' : 'Connect to WiFi'}
                    </button>
                </form>
                
                {error && <div className="error-message">{error}</div>}
            </div>
            
            {showPayment && (
                <div className="payment-modal">
                    <h2>Purchase WiFi Access</h2>
                    <form onSubmit={handlePayment}>
                        <div className="form-group">
                            <label>Mobile Money Number</label>
                            <input
                                type="tel"
                                placeholder="07XX XXX XXX"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Select Package</label>
                            <select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
                                <option value={1000}>1 Hour - 1,000 UGX</option>
                                <option value={2000}>3 Hours - 2,000 UGX</option>
                                <option value={5000}>Day Pass (24h) - 5,000 UGX</option>
                                <option value={15000}>Week Pass - 15,000 UGX</option>
                            </select>
                        </div>
                        
                        <div className="payment-info">
                            <p>Payment will be processed via Mobile Money</p>
                            <p className="small">Check your phone for payment prompt</p>
                        </div>
                        
                        <button type="submit" disabled={loading}>
                            {loading ? 'Processing...' : 'Pay Now'}
                        </button>
                        <button type="button" className="cancel" onClick={() => setShowPayment(false)}>
                            Cancel
                        </button>
                    </form>
                 </div>
            )}
        </div>
    );
};

export default CaptivePortal;