import { useEffect, useMemo, useRef, useState } from 'react';
import { sendChatMessage, subscribeToChatMessages, isCloudflareApiAvailable } from '../lib/cloudflareApi.js';
import { formatApiError } from '../lib/errorHandling';
import { notifyCustomerServiceOpened, sendUserMessage } from '../services/telegram.service.js';
import Toast from './Toast.jsx';

const SESSION_STORAGE_KEY = 'supportSessionId';

function createSessionId () {
    return `support_${Date.now()}_${Math.random().toString( 36 ).slice( 2, 8 )}`;
}

function normalizeIncomingMessage ( message ) {
    return {
        id: message.id || message.messageId || `${Date.now()}_${Math.random().toString( 36 ).slice( 2, 6 )}`,
        sender: message.sender || message.senderType || ( message.isAdmin ? 'admin' : 'user' ),
        text: message.message || message.text || '',
        createdAt: message.createdAt || message.time || new Date().toISOString(),
        senderName: message.senderName || message.username || ( message.isAdmin ? 'Support' : 'You' )
    };
}

export default function CustomerService () {
    const [ inputMessage, setInputMessage ] = useState( '' );
    const [ messages, setMessages ] = useState( [] );
    const [ isSending, setIsSending ] = useState( false );
    const [ isSupportOnline, setIsSupportOnline ] = useState( false );
    const [ toast, setToast ] = useState( { message: '', type: '' } );

    const messageEndRef = useRef( null );
    const sessionId = useMemo( () => {
        const existing = localStorage.getItem( SESSION_STORAGE_KEY );
        if ( existing ) return existing;
        const created = createSessionId();
        localStorage.setItem( SESSION_STORAGE_KEY, created );
        return created;
    }, [] );

    const walletAddress = localStorage.getItem( 'walletAddress' ) || localStorage.getItem( 'wallet_address' ) || '';
    const userProfile = JSON.parse( localStorage.getItem( 'userProfile' ) || '{}' );
    const displayName = userProfile.username || userProfile.email || 'Guest';

    const showToast = ( message, type = 'info' ) => {
        setToast( { message, type } );
    };

    useEffect( () => {
        setMessages( [ {
            id: 'welcome',
            sender: 'admin',
            senderName: 'Support',
            text: 'Welcome to live support. Send your message and a support agent can reply in real time.',
            createdAt: new Date().toISOString()
        } ] );

        isCloudflareApiAvailable().then( ( available ) => {
            setIsSupportOnline( available );
        } ).catch( () => setIsSupportOnline( false ) );

        notifyCustomerServiceOpened( {
            sessionId,
            username: displayName,
            wallet: walletAddress || 'Not connected',
            timestamp: new Date().toISOString()
        } ).catch( () => {
            console.log( '[Telegram] open notification skipped' );
        } );

        const unsubscribe = subscribeToChatMessages( sessionId, ( incoming ) => {
            const normalized = ( incoming || [] ).map( normalizeIncomingMessage );
            setMessages( ( prev ) => {
                const merged = [ ...prev ];
                normalized.forEach( ( msg ) => {
                    if ( !merged.some( ( item ) => item.id === msg.id ) ) {
                        merged.push( msg );
                    }
                } );
                return merged.sort( ( a, b ) => new Date( a.createdAt ) - new Date( b.createdAt ) );
            } );
        } );

        return () => unsubscribe?.();
    }, [ displayName, sessionId, walletAddress ] );

    useEffect( () => {
        messageEndRef.current?.scrollIntoView( { behavior: 'smooth' } );
    }, [ messages ] );

    const handleSendMessage = async ( event ) => {
        event.preventDefault();
        const text = inputMessage.trim();
        if ( !text || isSending ) return;

        const localMessage = {
            id: `local_${Date.now()}`,
            sender: 'user',
            senderName: displayName,
            text,
            createdAt: new Date().toISOString()
        };

        setMessages( ( prev ) => [ ...prev, localMessage ] );
        setInputMessage( '' );
        setIsSending( true );

        try {
            await sendChatMessage( {
                sessionId,
                message: text,
                senderName: displayName,
                senderWallet: walletAddress,
                sender: 'user'
            } );

            sendUserMessage( text, {
                sessionId,
                username: displayName,
                wallet: walletAddress || 'Not connected',
                timestamp: new Date().toISOString()
            } ).catch( () => {
                console.log( '[Telegram] message forwarding skipped' );
            } );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        } finally {
            setIsSending( false );
        }
    };

    const requestLiveAgent = async () => {
        try {
            await sendChatMessage( {
                sessionId,
                message: 'Customer requested live agent connection',
                senderName: displayName,
                senderWallet: walletAddress,
                sender: 'system'
            } );
            showToast( 'Live agent request sent.', 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        }
    };

    return (
        <div className="trade-product-page">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />

            <header className="product-header">
                <div>
                    <p className="product-kicker">Support</p>
                    <h1>Live Chat Support</h1>
                    <p className="product-copy">Real-time support chat via Cloudflare stream with optional Telegram escalation.</p>
                </div>
                <button className="product-back-btn" onClick={requestLiveAgent}>Request Live Agent</button>
            </header>

            <section className="product-summary-grid">
                <div className="product-summary-card"><span>Status</span><strong>{isSupportOnline ? 'Online' : 'Fallback mode'}</strong></div>
                <div className="product-summary-card"><span>Session</span><strong>{sessionId.slice( 0, 12 )}...</strong></div>
                <div className="product-summary-card"><span>User</span><strong>{displayName}</strong></div>
                <div className="product-summary-card"><span>Wallet</span><strong>{walletAddress ? `${walletAddress.slice( 0, 6 )}...${walletAddress.slice( -4 )}` : 'Not connected'}</strong></div>
            </section>

            <section className="product-panel">
                <article className="product-card" style={{ minHeight: 380 }}>
                    <h2>Conversation</h2>
                    <div className="product-list" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {messages.map( ( msg ) => (
                            <div key={msg.id} className="product-list-row" style={{ gridTemplateColumns: '1fr', gap: 6 }}>
                                <div>
                                    <strong>{msg.sender === 'admin' ? 'Support' : msg.senderName}</strong>
                                    <p>{msg.text}</p>
                                </div>
                                <div>
                                    <p>{new Date( msg.createdAt ).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ) )}
                        <div ref={messageEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="product-form-row" style={{ marginTop: 14 }}>
                        <div>
                            <label htmlFor="support-message">Message</label>
                            <input
                                id="support-message"
                                type="text"
                                value={inputMessage}
                                onChange={( event ) => setInputMessage( event.target.value )}
                                placeholder="Type your message"
                            />
                        </div>
                        <button className="product-primary-btn" type="submit" disabled={isSending || !inputMessage.trim()}>
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                </article>
            </section>
        </div>
    );
}
