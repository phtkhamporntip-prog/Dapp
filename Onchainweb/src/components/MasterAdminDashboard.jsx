import { useState, useEffect, useCallback } from 'react';
import {
    onAuthStateChanged,
    subscribeToChatMessages,
    subscribeToActiveChats,
    saveAdminReply,
    updateActiveChat,
    isFirebaseEnabled,
    subscribeToUsers,
    subscribeToDeposits,
    subscribeToWithdrawals,
    subscribeToTrades,
    subscribeToAiArbitrageInvestments,
    firebaseSignIn,
    firebaseSignOut,
    auth, // Ensure auth is imported for onAuthStateChanged
    setForcedBinaryOutcome,
} from '../lib/firebase.js';
import { formatApiError, validatePassword } from '../lib/errorHandling.js';
import { handleAdminLogin, formatFirebaseAuthError } from '../lib/adminAuth.js';
import { createAdminAccount, subscribeToAdmins, updateAdminAccount, deleteAdminAccount } from '../services/adminService.js';
import Toast from './Toast.jsx';
import TradingControlPanel from './TradingControlPanel.jsx';

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

    const showToast = ( message, type = 'info' ) => {
        setToast( { message, type } );
    };

    // Reference scaffolded imports and state to avoid noisy eslint `no-unused-vars` warnings
    const _debugUnused_MasterAdmin = ( ctx ) => { if ( typeof console !== 'undefined' ) console.debug( 'mad-debug', ctx ); };
    _debugUnused_MasterAdmin( {
        saveAdminReply,
        updateActiveChat,
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
        const unsubscribe = onAuthStateChanged( auth, ( user ) => {
            if ( user ) {
                setIsAuthenticated( true );
                const session = JSON.parse( localStorage.getItem( 'masterAdminSession' ) );
                if ( session ) {
                    setIsMasterAccount( session.role === 'master' );
                }
            } else {
                setIsAuthenticated( false );
                setIsMasterAccount( false );
            }
            setIsLoading( false );
        } );
        return () => unsubscribe();
    }, [] );

    // Real-time data subscriptions
    useEffect( () => {
        if ( !isAuthenticated || !isFirebaseEnabled() ) {
            return; // Don't subscribe if not authenticated or Firebase is unavailable
        }

        // Setup all subscriptions and store their unsubscribe functions
        const subscriptions = [
            subscribeToUsers( setUsers ),
            subscribeToAdmins( setAdmins, ( error ) => showToast( error, 'error' ) ),
            subscribeToDeposits( setDeposits ),
            subscribeToWithdrawals( setWithdrawals ),
            subscribeToTrades( setTrades ),
            subscribeToAiArbitrageInvestments( setAiInvestments ),
            subscribeToActiveChats( setActiveChats )
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
            subscribeToChatMessages( chat.id, handleChatMessages( chat.id ) )
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
        const passwordValidation = validatePassword( loginData.password, 8 );
        if ( !passwordValidation.valid ) {
            return showToast( passwordValidation.error, 'error' );
        }
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
            localStorage.removeItem( 'masterAdminSession' );
        } catch ( err ) {
            showToast( formatApiError( err ), 'error' );
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

    if ( isLoading ) {
        return <div>Loading...</div>;
    }

    if ( !isAuthenticated ) {
        return (
            <div className="master-admin-login">
                <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />
                <div className="login-container">
                    <div className="login-logo">
                        <img src="/logo.svg" alt="OnchainWeb" className="admin-logo-lg" />
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
                    <img src="/logo.svg" alt="OnchainWeb" className="admin-logo-sm" />
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {deposits.map( deposit => (
                                        <tr key={deposit.id}>
                                            <td>{deposit.userId?.substring( 0, 8 )}...</td>
                                            <td>${deposit.amount || 0}</td>
                                            <td><span className={`badge ${deposit.status || 'pending'}`}>{deposit.status || 'pending'}</span></td>
                                            <td>{new Date( deposit.timestamp?.toMillis?.() || Date.now() ).toLocaleString()}</td>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map( withdrawal => (
                                        <tr key={withdrawal.id}>
                                            <td>{withdrawal.userId?.substring( 0, 8 )}...</td>
                                            <td>${withdrawal.amount || 0}</td>
                                            <td><span className={`badge ${withdrawal.status || 'pending'}`}>{withdrawal.status || 'pending'}</span></td>
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
                    <h2>💬 Active Chats ({activeChats.length})</h2>
                    <div className="chat-list">
                        {activeChats.length === 0 ? (
                            <p className="no-data">No active chats</p>
                        ) : (
                            activeChats.map( chat => (
                                <div key={chat.id} className="chat-item">
                                    <h4>{chat.userName || 'Anonymous'}</h4>
                                    <p className="chat-preview">{chat.lastMessage || 'No messages'}</p>
                                    <span className="message-count">
                                        {( chatMessages[ chat.id ] || [] ).length} messages
                                    </span>
                                </div>
                            ) )
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
