
import { useState, useEffect, useCallback } from 'react';
import { getDepositAddresses } from '../services/depositService';
import { getUser } from '../lib/firebase.js';
import { useUniversalWallet } from '../lib/walletConnect.jsx';
import { formatApiError } from '../lib/errorHandling';
import Toast from './Toast.jsx';

const COINS = [
    { id: 'BTC', name: 'Bitcoin', icon: '₿', color: '#f7931a', network: 'Bitcoin' },
    { id: 'USDT-TRC20', name: 'USDT', icon: '₮', color: '#26a17b', network: 'TRC20 (Tron)' },
    { id: 'USDT-ERC20', name: 'USDT', icon: '₮', color: '#26a17b', network: 'ERC20 (Ethereum)' },
];

const TABS = ['assets', 'deposit', 'kyc'];

export default function Wallet({ isOpen, onClose }) {
    const { address, isConnected, disconnectWallet } = useUniversalWallet();
    const [activeTab, setActiveTab] = useState('assets');
    const [balance, setBalance] = useState(0);
    const [depositAddresses, setDepositAddresses] = useState({});
    const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
    const [toast, setToast] = useState({ message: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const showToast = (message, type = 'info') => setToast({ message, type });

    const loadWalletData = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            const [userData, addresses] = await Promise.all([
                getUser(address),
                getDepositAddresses(),
            ]);
            if (userData) setBalance(Number(userData.balance) || 0);
            setDepositAddresses(addresses || {});
        } catch (error) {
            showToast(formatApiError(error), 'error');
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (isOpen && isConnected) loadWalletData();
    }, [isOpen, isConnected, loadWalletData]);

    const copyAddress = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast('Failed to copy', 'error');
        }
    };

    if (!isOpen) return null;

    const shortAddress = address
        ? `${address.slice(0, 8)}...${address.slice(-6)}`
        : '—';

    const depositAddr = depositAddresses[selectedCoin.id] || '';

    return (
        <div className="w-overlay" onClick={onClose}>
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
            <div className="w-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="w-header">
                    <div>
                        <p className="w-label">Connected wallet</p>
                        <p className="w-addr" title={address || ''}>{shortAddress}</p>
                    </div>
                    <div className="w-header-actions">
                        {onClose && <button className="w-close-btn" onClick={onClose}>✕</button>}
                        <button className="w-disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
                    </div>
                </div>

                {/* Balance hero */}
                <div className="w-balance-hero">
                    {loading ? (
                        <span className="w-loading">Loading…</span>
                    ) : (
                        <>
                            <span className="w-balance-amount">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="w-balance-label">Total Balance (USD)</span>
                        </>
                    )}
                </div>

                {/* Tabs */}
                <div className="w-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            className={`w-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Assets tab */}
                {activeTab === 'assets' && (
                    <div className="w-section">
                        <h3 className="w-section-title">Your assets</h3>
                        <div className="w-asset-row">
                            <span className="w-asset-icon">💲</span>
                            <div>
                                <p className="w-asset-name">Trading Balance</p>
                                <p className="w-asset-sub">Available for trades</p>
                            </div>
                            <span className="w-asset-value">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <p className="w-note">Deposit cryptocurrency to fund your trading balance.</p>
                    </div>
                )}

                {/* Deposit tab */}
                {activeTab === 'deposit' && (
                    <div className="w-section">
                        <h3 className="w-section-title">Deposit</h3>
                        <div className="w-coin-list">
                            {COINS.map((coin) => (
                                <button
                                    key={coin.id}
                                    className={`w-coin-btn ${selectedCoin.id === coin.id ? 'active' : ''}`}
                                    onClick={() => setSelectedCoin(coin)}
                                    style={{ '--coin-color': coin.color }}
                                >
                                    <span className="w-coin-icon">{coin.icon}</span>
                                    <span>{coin.name}</span>
                                    <span className="w-coin-network">{coin.network}</span>
                                </button>
                            ))}
                        </div>
                        {depositAddr ? (
                            <div className="w-deposit-box">
                                <p className="w-deposit-label">Send {selectedCoin.name} to this address ({selectedCoin.network}):</p>
                                <div className="w-deposit-addr">
                                    <code>{depositAddr}</code>
                                    <button className="w-copy-btn" onClick={() => copyAddress(depositAddr)}>
                                        {copied ? '✓ Copied' : 'Copy'}
                                    </button>
                                </div>
                                <p className="w-deposit-warn">⚠️ Only send {selectedCoin.name} on the {selectedCoin.network} network. Wrong network deposits may be lost.</p>
                            </div>
                        ) : (
                            <p className="w-note">Deposit address not available. Please contact support.</p>
                        )}
                    </div>
                )}

                {/* KYC tab */}
                {activeTab === 'kyc' && (
                    <div className="w-section">
                        <h3 className="w-section-title">Identity Verification (KYC)</h3>
                        <p className="w-note">KYC verification is required to enable withdrawals. Please contact customer support to begin the verification process.</p>
                    </div>
                )}
            </div>

            <style>{`
                .w-overlay {
                    position: fixed; inset: 0; z-index: 9000;
                    background: rgba(0,0,0,0.65);
                    display: flex; align-items: center; justify-content: center;
                    padding: 16px;
                }
                .w-modal {
                    background: #0d1829;
                    border: 1px solid #1e3050;
                    border-radius: 20px;
                    width: 100%; max-width: 520px;
                    max-height: 90vh; overflow-y: auto;
                    padding: 24px;
                    color: #e8edf7;
                }
                .w-header {
                    display: flex; align-items: flex-start; justify-content: space-between;
                    margin-bottom: 20px;
                }
                .w-label { font-size: 12px; color: #7a92b4; margin: 0 0 4px; }
                .w-addr { font-family: monospace; font-size: 14px; color: #cce7ff; margin: 0; }
                .w-header-actions { display: flex; gap: 8px; align-items: center; }
                .w-close-btn {
                    background: transparent; border: none; color: #7a92b4;
                    font-size: 18px; cursor: pointer; line-height: 1;
                }
                .w-close-btn:hover { color: #fff; }
                .w-disconnect-btn {
                    background: #1e2f47; border: 1px solid #2a3c5b;
                    color: #cce7ff; border-radius: 8px;
                    padding: 6px 12px; font-size: 13px; cursor: pointer;
                }
                .w-disconnect-btn:hover { border-color: #ef4444; color: #ef4444; }
                .w-balance-hero {
                    background: linear-gradient(135deg, #0f2340 0%, #132d52 100%);
                    border-radius: 14px; padding: 24px;
                    text-align: center; margin-bottom: 20px;
                    display: flex; flex-direction: column; gap: 6px;
                }
                .w-balance-amount { font-size: 2rem; font-weight: 700; color: #fff; }
                .w-balance-label { font-size: 13px; color: #7a92b4; }
                .w-loading { color: #7a92b4; font-size: 14px; }
                .w-tabs {
                    display: flex; gap: 4px; margin-bottom: 20px;
                    background: #0a1220; border-radius: 10px; padding: 4px;
                }
                .w-tab {
                    flex: 1; padding: 8px; background: transparent;
                    border: none; border-radius: 8px;
                    color: #7a92b4; font-size: 14px; cursor: pointer;
                    transition: all 0.15s;
                }
                .w-tab.active { background: #132d52; color: #cce7ff; font-weight: 600; }
                .w-section-title { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
                .w-section { }
                .w-asset-row {
                    display: flex; align-items: center; gap: 12px;
                    background: #0f1e32; border-radius: 12px; padding: 14px;
                    margin-bottom: 12px;
                }
                .w-asset-icon { font-size: 28px; }
                .w-asset-name { margin: 0 0 2px; font-weight: 600; }
                .w-asset-sub { margin: 0; font-size: 12px; color: #7a92b4; }
                .w-asset-value { margin-left: auto; font-weight: 700; color: #cce7ff; }
                .w-note { font-size: 13px; color: #7a92b4; margin: 8px 0 0; }
                .w-coin-list {
                    display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
                }
                .w-coin-btn {
                    display: flex; align-items: center; gap: 10px;
                    background: #0f1e32; border: 1px solid #1e3050;
                    border-radius: 10px; padding: 12px 14px;
                    color: #cce7ff; cursor: pointer; text-align: left;
                    transition: border-color 0.15s;
                }
                .w-coin-btn.active { border-color: var(--coin-color, #3b82f6); }
                .w-coin-btn:hover { border-color: var(--coin-color, #3b82f6); }
                .w-coin-icon { font-size: 20px; }
                .w-coin-network { margin-left: auto; font-size: 12px; color: #7a92b4; }
                .w-deposit-box {
                    background: #0f1e32; border-radius: 12px; padding: 16px;
                }
                .w-deposit-label { font-size: 13px; color: #7a92b4; margin: 0 0 10px; }
                .w-deposit-addr {
                    display: flex; align-items: center; gap: 8px;
                    background: #0a1220; border-radius: 8px; padding: 10px 12px;
                    margin-bottom: 12px; word-break: break-all;
                }
                .w-deposit-addr code { flex: 1; font-size: 12px; color: #cce7ff; }
                .w-copy-btn {
                    background: #1e3050; border: 1px solid #2a3c5b;
                    color: #cce7ff; border-radius: 6px;
                    padding: 4px 10px; font-size: 12px; cursor: pointer;
                    white-space: nowrap;
                }
                .w-copy-btn:hover { background: #233d62; }
                .w-deposit-warn {
                    font-size: 12px; color: #f59e0b; margin: 0;
                }
            `}</style>
        </div>
    );
}
