import { useState, useEffect, useCallback } from 'react';
import {
    onAuthStateChanged,
    subscribeToUsers,
    subscribeToDeposits,
    subscribeToWithdrawals,
    subscribeToTrades,
    subscribeToAllAiArbitrageInvestments,
    firebaseSignIn,
    firebaseSignOut,
    auth,
    setForcedBinaryOutcome,
} from '../lib/firebase.js';
import {
    subscribeToActiveChats as subscribeToSupportActiveChats,
    subscribeToChatMessages as subscribeToSupportChatMessages,
    sendAdminReply,
} from '../lib/cloudflareApi.js';
import { formatApiError } from '../lib/errorHandling.js';
import { handleAdminLogin, formatFirebaseAuthError } from '../lib/adminAuth.js';
import { createAdminAccount, subscribeToAdmins, updateAdminAccount, deleteAdminAccount, processDeposit, processWithdrawal } from '../services/adminService.js';
import Toast from './Toast.jsx';
import TradingControlPanel from './TradingControlPanel.jsx';
import BrandLogo from './BrandLogo.jsx';

export default function MasterAdminDashboard () {
    const [ isAuthenticated, setIsAuthenticated ] = useState( false );
    const [ isLoading, setIsLoading ] = useState( true );
    const [ isLoggingIn, setIsLoggingIn ] = useState( false );
    const [ loginData, setLoginData ] = useState( { username: '', password: '' } );
    const [ activeSection, _setActiveSection ] = useState( 'user-agents' );
    const [ isMasterAccount, setIsMasterAccount ] = useState( false );
    const [ toast, setToast ] = useState( { message: '', type: '' } );

    // State for real-time data
    const [ users, setUsers ] = useState( [] );
    const [ admins, setAdmins ] = useState( [] );
    const [ deposits, setDeposits ] = useState( [] );
    const [ withdrawals, setWithdrawals ] = useState( [] );
    const [ trades, setTrades ] = useState( [] );
    const [ aiInvestments, setAiInvestments ] = useState( [] );
    const [ activeChats, setActiveChats ] = useState( [] );
    const [ chatMessages, setChatMessages ] = useState( {} ); // Keyed by chatId
    const [ selectedChatId, setSelectedChatId ] = useState( '' );
    const [ adminReply, setAdminReply ] = useState( '' );
    const [ isSendingReply, setIsSendingReply ] = useState( false );

    const showToast = ( message, type = 'info' ) => {
        setToast( { message, type } );
    };

    // Reference scaffolded imports and state to avoid noisy eslint `no-unused-vars` warnings
    const _debugUnused_MasterAdmin = ( ctx ) => { if ( typeof console !== 'undefined' ) console.debug( 'mad-debug', ctx ); };
    _debugUnused_MasterAdmin( {
        createAdminAccount,
        subscribeToAdmins,
        updateAdminAccount,
        deleteAdminAccount,
        activeSection,
        isMasterAccount,
        users,
        admins,
        deposits,
        withdrawals,
        trades,
        aiInvestments,
        chatMessages,
        Toast,
        TradingControlPanel
    } );

    // Authentication state listener
    useEffect( () => {
        const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

        const restoreFromLocalSession = () => {
            const session = JSON.parse( localStorage.getItem( 'masterAdminSession' ) || 'null' );
            const sessionAge = session ? Date.now() - ( session.timestamp || 0 ) : Infinity;
            if ( session?.role === 'master' && sessionAge < SESSION_TTL ) {
                setIsAuthenticated( true );
                setIsMasterAccount( true );
            } else {
                if ( session && sessionAge >= SESSION_TTL ) {
                    localStorage.removeItem( 'masterAdminSession' );
                }
                setIsAuthenticated( false );
                setIsMasterAccount( false );
            }
            setIsLoading( false );
        };

        // If Firebase auth is not configured, fall back to localStorage session check only
        if ( !auth ) {
            restoreFromLocalSession();
            return;
        }

        const unsubscribe = onAuthStateChanged( auth, ( user ) => {
            if ( user ) {
                setIsAuthenticated( true );
                const session = JSON.parse( localStorage.getItem( 'masterAdminSession' ) || 'null' );
                if ( session ) {
                    setIsMasterAccount( session.role === 'master' );
                }
            } else {
                // No Firebase user — check for a valid master account session (env-var login)
                restoreFromLocalSession();
                return;
            }
            setIsLoading( false );
        } );
        return () => unsubscribe();
    }, [] );

    // Real-time data subscriptions (subscriptions handle Firebase/localStorage fallback internally)
    useEffect( () => {
        if ( !isAuthenticated ) {
            return;
        }

        // Setup all subscriptions and store their unsubscribe functions
        const subscriptions = [
            subscribeToUsers( setUsers ),
            subscribeToAdmins( setAdmins, ( error ) => showToast( error, 'error' ) ),
            subscribeToDeposits( setDeposits ),
            subscribeToWithdrawals( setWithdrawals ),
            subscribeToTrades( setTrades ),
            subscribeToAllAiArbitrageInvestments( setAiInvestments ),
            subscribeToSupportActiveChats( setActiveChats )
        ];

        // Return a cleanup function that unsubscribes from all listeners
        return () => {
            subscriptions.forEach( unsubscribe => {
                if ( typeof unsubscribe === 'function' ) {
                    unsubscribe();
                }
            } );
        };
    }, [ isAuthenticated ] ); // Rerun subscriptions if authentication state changes

    // Memoize callback to prevent unnecessary subscription recreation
    const handleChatMessages = useCallback( ( chatId ) => ( messages ) => {
        setChatMessages( prev => ( { ...prev, [ chatId ]: messages } ) );
    }, [] );

    // Subscription to chat messages, dependent on active chats
    useEffect( () => {
        if ( !activeChats.length ) return;

        const messageSubscriptions = activeChats.map( chat =>
            subscribeToSupportChatMessages( chat.id || chat.sessionId, handleChatMessages( chat.id || chat.sessionId ) )
        );

        return () => {
            messageSubscriptions.forEach( unsubscribe => {
                if ( typeof unsubscribe === 'function' ) {
                    unsubscribe();
                }
            } );
        };
    }, [ activeChats, handleChatMessages ] );

    const handleLogin = async ( e ) => {
        e.preventDefault();
        if ( !loginData.username || !loginData.password ) {
            return showToast( 'Please enter username and password', 'error' );
        }
        // Note: password complexity is not validated here — admin passwords are managed
        // server-side (Firebase Auth or VITE_MASTER_ADMIN_PASSWORD env var).
        setIsLoggingIn( true );
        try {
            const result = await handleAdminLogin( loginData.username, loginData.password, firebaseSignIn );
            localStorage.setItem( 'masterAdminSession', JSON.stringify( { ...result, timestamp: Date.now() } ) );
            setIsAuthenticated( true );
            setIsMasterAccount( result.role === 'master' );
            showToast( 'Login successful!', 'success' );
        } catch ( error ) {
            showToast( formatFirebaseAuthError( error ), 'error' );
        } finally {
            setIsLoggingIn( false );
        }
    };

    const handleLogout = async () => {
        try {
            await firebaseSignOut();
        } catch {
            // Ignore: master account may not have a Firebase auth session
        } finally {
            localStorage.removeItem( 'masterAdminSession' );
            setIsAuthenticated( false );
            setIsMasterAccount( false );
        }
    };

    const _handleCreateAdmin = async ( newAdminData ) => {
        try {
            const createdBy = JSON.parse( localStorage.getItem( 'masterAdminSession' ) || '{}' ).email || 'master';
            await createAdminAccount( { ...newAdminData, createdBy } );
            showToast( 'Admin account created successfully!', 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        }
    };

    const handleDepositAction = async ( deposit, status ) => {
        try {
            await processDeposit( deposit.id, deposit.userId, status, deposit.amount || 0 );
            showToast( `Deposit ${status}.`, 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        }
    };

    const handleWithdrawalAction = async ( withdrawal, status ) => {
        try {
            await processWithdrawal( withdrawal.id, withdrawal.userId, status, withdrawal.amount || 0 );
            showToast( `Withdrawal ${status}.`, 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        }
    };

    const handleSendSupportReply = async () => {
        const targetChatId = selectedChatId || activeChats[ 0 ]?.id || activeChats[ 0 ]?.sessionId;
        const text = adminReply.trim();

        if ( !targetChatId || !text ) {
            showToast( 'Select a chat and enter a message.', 'error' );
            return;
        }

        setIsSendingReply( true );
        try {
            await sendAdminReply( targetChatId, text, 'Support Admin' );
            setAdminReply( '' );
            showToast( 'Reply sent to customer.', 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        } finally {
            setIsSendingReply( false );
        }
    };

    if ( isLoading ) {
        return <div>Loading...</div>;
    }

    if ( !isAuthenticated ) {
        return (
            <div className="master-admin-login">
                <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />
                <div className="login-container">
                    <div className="login-logo">
                        <BrandLogo className="admin-logo-lg" alt="OnchainWeb" />
                    </div>
                    <h1>Master Admin</h1>
                    <p>Secure administrative access</p>
                    <form onSubmit={handleLogin}>
                        <div className="login-field">
                            <label htmlFor="username">Username or Email</label>
                            <input
                                id="username"
                                type="text"
                                placeholder="Enter username or email"
                                value={loginData.username}
                                onChange={( e ) => setLoginData( { ...loginData, username: e.target.value } )}
                                autoComplete="username"
                            />
                        </div>
                        <div className="login-field">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                placeholder="Enter password"
                                value={loginData.password}
                                onChange={( e ) => setLoginData( { ...loginData, password: e.target.value } )}
                                autoComplete="current-password"
                            />
                        </div>
                        <button type="submit" className="login-btn" disabled={isLoggingIn}>
                            {isLoggingIn ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="master-admin-dashboard">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />
            <nav className="admin-top-nav">
                <div className="nav-logo">
                    <BrandLogo className="admin-logo-sm" alt="OnchainWeb" />
                    <span className="nav-logo-brand">Master Admin</span>
                </div>
                <div className="nav-menu">
                    <span className="nav-section-label">Dashboard</span>
                </div>
                <button className="logout-link" onClick={handleLogout}>
                    Sign Out
                </button>
            </nav>

            <div className="dashboard-content">
                <TradingControlPanel onNotify={showToast} />

                {/* Users Section - Real-time */}
                <section className="dashboard-section">
                    <h2>👥 Users ({users.length})</h2>
                    <div className="data-list">
                        {users.length === 0 ? (
                            <p className="no-data">No users found</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User ID</th>
                                        <th>Wallet</th>
                                        <th>Balance</th>
                                        <th>KYC Status</th>
                                        <th>VIP Level</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map( user => (
                                        <tr key={user.id}>
                                            <td>{user.id?.substring( 0, 8 )}...</td>
                                            <td>{user.wallet?.substring( 0, 8 )}...</td>
                                            <td>${user.balance || 0}</td>
                                            <td><span className={`badge ${user.kycStatus || 'pending'}`}>{user.kycStatus || 'pending'}</span></td>
                                            <td>Level {user.vipLevel || 1}</td>
                                            <td>{user.status || 'active'}</td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Admins Section - Real-time */}
                <section className="dashboard-section">
                    <h2>🔐 Admins ({admins.length})</h2>
                    <div className="data-list">
                        {admins.length === 0 ? (
                            <p className="no-data">No admins found</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Created By</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map( admin => (
                                        <tr key={admin.id}>
                                            <td>{admin.email}</td>
                                            <td><span className={`badge ${admin.role || 'admin'}`}>{admin.role || 'admin'}</span></td>
                                            <td>{admin.createdBy || 'master'}</td>
                                            <td>{admin.status || 'active'}</td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Deposits Section - Real-time */}
                <section className="dashboard-section">
                    <h2>💰 Deposits ({deposits.length})</h2>
                    <div className="data-list">
                        {deposits.length === 0 ? (
                            <p className="no-data">No pending deposits</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deposits.map( deposit => (
                                        <tr key={deposit.id}>
                                            <td>{deposit.userId?.substring( 0, 8 )}...</td>
                                            <td>${deposit.amount || 0}</td>
                                            <td><span className={`badge ${deposit.status || 'pending'}`}>{deposit.status || 'pending'}</span></td>
                                            <td>{new Date( deposit.timestamp?.toMillis?.() || deposit.timestamp || Date.now() ).toLocaleString()}</td>
                                            <td>
                                                <span className="force-outcome-btns">
                                                    <button className="force-win-btn" onClick={() => handleDepositAction( deposit, 'approved' )}>Approve</button>
                                                    <button className="force-loss-btn" onClick={() => handleDepositAction( deposit, 'rejected' )}>Reject</button>
                                                </span>
                                            </td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Withdrawals Section - Real-time */}
                <section className="dashboard-section">
                    <h2>🏦 Withdrawals ({withdrawals.length})</h2>
                    <div className="data-list">
                        {withdrawals.length === 0 ? (
                            <p className="no-data">No pending withdrawals</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map( withdrawal => (
                                        <tr key={withdrawal.id}>
                                            <td>{withdrawal.userId?.substring( 0, 8 )}...</td>
                                            <td>${withdrawal.amount || 0}</td>
                                            <td><span className={`badge ${withdrawal.status || 'pending'}`}>{withdrawal.status || 'pending'}</span></td>
                                            <td>{new Date( withdrawal.timestamp?.toMillis?.() || withdrawal.timestamp || Date.now() ).toLocaleString()}</td>
                                            <td>
                                                <span className="force-outcome-btns">
                                                    <button className="force-win-btn" onClick={() => handleWithdrawalAction( withdrawal, 'approved' )}>Approve</button>
                                                    <button className="force-loss-btn" onClick={() => handleWithdrawalAction( withdrawal, 'rejected' )}>Reject</button>
                                                </span>
                                            </td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Trades Section - Real-time */}
                <section className="dashboard-section">
                    <h2>📈 Trades ({trades.length})</h2>
                    <div className="data-list">
                        {trades.length === 0 ? (
                            <p className="no-data">No trades found</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Pair</th>
                                        <th>Direction</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Override</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map( trade => (
                                        <tr key={trade.id}>
                                            <td>{trade.userId?.substring( 0, 8 )}...</td>
                                            <td>{trade.pair || 'N/A'}</td>
                                            <td><span className={`badge ${trade.direction || 'up'}`}>{trade.direction || 'up'}</span></td>
                                            <td>${trade.amount || 0}</td>
                                            <td>{trade.status || 'open'}</td>
                                            <td>
                                                {trade.status !== 'closed' ? (
                                                    <span className="force-outcome-btns">
                                                        <button
                                                            className="force-win-btn"
                                                            title="Force this trade to WIN"
                                                            onClick={() => setForcedBinaryOutcome( trade.id, trade.userId, 'WIN' ).catch( ( e ) => showToast( e.message, 'error' ) )}
                                                        >✅ Win</button>
                                                        <button
                                                            className="force-loss-btn"
                                                            title="Force this trade to LOSS"
                                                            onClick={() => setForcedBinaryOutcome( trade.id, trade.userId, 'LOSS' ).catch( ( e ) => showToast( e.message, 'error' ) )}
                                                        >❌ Loss</button>
                                                    </span>
                                                ) : (
                                                    <span className="force-settled-label">{trade.result || '—'}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* AI Investments Section - Real-time */}
                <section className="dashboard-section">
                    <h2>🤖 AI Investments ({aiInvestments.length})</h2>
                    <div className="data-list">
                        {aiInvestments.length === 0 ? (
                            <p className="no-data">No AI investments found</p>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Amount</th>
                                        <th>Current ROI</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aiInvestments.map( investment => (
                                        <tr key={investment.id}>
                                            <td>{investment.userId?.substring( 0, 8 )}...</td>
                                            <td>${investment.amount || 0}</td>
                                            <td>{( ( ( investment.currentValue || 0 ) / ( investment.amount || 1 ) - 1 ) * 100 ).toFixed( 2 )}%</td>
                                            <td><span className={`badge ${investment.completed ? 'completed' : 'active'}`}>{investment.completed ? 'Completed' : 'Active'}</span></td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* Active Chats Section - Real-time */}
                <section className="dashboard-section">
                    <h2>💬 Live Support Chats ({activeChats.length})</h2>
                    <div className="chat-list">
                        {activeChats.length === 0 ? (
                            <p className="no-data">No active support chats</p>
                        ) : (
                            activeChats.map( chat => (
                                <div
                                    key={chat.id || chat.sessionId}
                                    className={`chat-item ${( selectedChatId === ( chat.id || chat.sessionId ) ) ? 'selected-chat' : ''}`}
                                    onClick={() => setSelectedChatId( chat.id || chat.sessionId )}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={( event ) => {
                                        if ( event.key === 'Enter' || event.key === ' ' ) {
                                            setSelectedChatId( chat.id || chat.sessionId );
                                        }
                                    }}
                                >
                                    <h4>{chat.userName || chat.senderName || 'Anonymous'}</h4>
                                    <p className="chat-preview">{chat.lastMessage || 'No messages'}</p>
                                    <span className="message-count">
                                        {( chatMessages[ chat.id || chat.sessionId ] || [] ).length} messages
                                    </span>
                                </div>
                            ) )
                        )}
                    </div>

                    <div className="chat-admin-panel">
                        <h3>Reply as Support Admin</h3>
                        <p className="chat-admin-target">
                            Chat: {selectedChatId || activeChats[ 0 ]?.id || activeChats[ 0 ]?.sessionId || 'None selected'}
                        </p>
                        <textarea
                            className="chat-admin-input"
                            value={adminReply}
                            onChange={( event ) => setAdminReply( event.target.value )}
                            placeholder="Type your support reply..."
                            rows={3}
                        />
                        <button className="force-win-btn" onClick={handleSendSupportReply} disabled={isSendingReply}>
                            {isSendingReply ? 'Sending...' : 'Send Reply'}
                        </button>
                    </div>
                </section>
            </div>

            <style>{`
                .selected-chat {
                    border: 1px solid rgba(16, 185, 129, 0.45);
                    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.25);
                }

                .chat-admin-panel {
                    margin-top: 12px;
                    padding: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.15);
                }

                .chat-admin-target {
                    margin: 6px 0 10px;
                    opacity: 0.8;
                    font-size: 0.92rem;
                }

                .chat-admin-input {
                    width: 100%;
                    margin-bottom: 10px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    background: rgba(0, 0, 0, 0.2);
                    color: #fff;
                    padding: 10px;
                    resize: vertical;
                }
            `}</style>
        </div>
    );
}
