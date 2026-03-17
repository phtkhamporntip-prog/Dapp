import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Toast from './Toast.jsx';
import { useMarketData } from '../hooks/useMarketData';
import {
    closeBinaryTrade,
    getTradingAdminSettings,
    saveBinaryTrade,
    saveUser,
    subscribeToBinaryHistory,
    subscribeToBinaryTrades,
    subscribeToTradingAdminSettings
} from '../lib/firebase.js';

function getPageFromPath ( pathname ) {
    if ( pathname.endsWith( '/active' ) ) return 'active';
    if ( pathname.endsWith( '/history' ) ) return 'history';
    return 'new';
}

function getAssetSymbol ( pair ) {
    return pair.split( '/' )[ 0 ].toLowerCase();
}

export default function BinaryOptions ( { isOpen = true, onClose } ) {
    const location = useLocation();
    const navigate = useNavigate();
    const { cryptoData, isLiveData } = useMarketData( { refreshInterval: 10000 } );

    const [ toast, setToast ] = useState( { message: '', type: '' } );
    const [ settings, setSettings ] = useState( null );
    const [ userId ] = useState( () => localStorage.getItem( 'walletAddress' ) || localStorage.getItem( 'wallet_address' ) || 'guest' );
    const [ balance, setBalance ] = useState( () => parseFloat( localStorage.getItem( 'userBalance' ) || '0' ) );
    const [ pair, setPair ] = useState( 'BTC/USDT' );
    const [ selectedLevelId, setSelectedLevelId ] = useState( '' );
    const [ amount, setAmount ] = useState( '' );
    const [ direction, setDirection ] = useState( 'up' );
    const [ activeTrades, setActiveTrades ] = useState( [] );
    const [ tradeHistory, setTradeHistory ] = useState( [] );
    const settlingTradesRef = useRef( new Set() );

    const currentPage = getPageFromPath( location.pathname );

    const marketBySymbol = useMemo( () => {
        return Object.fromEntries( cryptoData.map( ( coin ) => [ coin.symbol.toUpperCase(), coin ] ) );
    }, [ cryptoData ] );

    const selectedMarket = marketBySymbol[ getAssetSymbol( pair ).toUpperCase() ];
    const currentPrice = selectedMarket?.current_price || 0;
    const currentMove = selectedMarket?.price_change_percentage_24h || 0;

    const binaryPairs = settings?.binaryPairs || [ 'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT' ];
    const binaryLevels = settings?.binaryLevels || [];

    const eligibleLevels = useMemo( () => {
        return binaryLevels.filter( ( level ) => Math.abs( currentMove ) >= Number( level.min24hMove || 0 ) );
    }, [ binaryLevels, currentMove ] );

    const selectedLevel = eligibleLevels.find( ( level ) => level.id === selectedLevelId ) || eligibleLevels[ 0 ] || null;

    useEffect( () => {
        let mounted = true;
        getTradingAdminSettings().then( ( value ) => {
            if ( mounted ) setSettings( value );
        } );
        const unsubscribe = subscribeToTradingAdminSettings( setSettings );
        return () => {
            mounted = false;
            unsubscribe?.();
        };
    }, [] );

    useEffect( () => {
        if ( !settings?.binaryPairs?.includes( pair ) && ( settings?.binaryPairs?.length || 0 ) > 0 ) {
            setPair( settings.binaryPairs[ 0 ] );
        }
    }, [ pair, settings ] );

    useEffect( () => {
        if ( selectedLevel && selectedLevel.id !== selectedLevelId ) {
            setSelectedLevelId( selectedLevel.id );
        }
    }, [ selectedLevel, selectedLevelId ] );

    useEffect( () => {
        if ( !userId ) return undefined;
        const unsubscribeActive = subscribeToBinaryTrades( userId, setActiveTrades );
        const unsubscribeHistory = subscribeToBinaryHistory( userId, setTradeHistory );
        return () => {
            unsubscribeActive?.();
            unsubscribeHistory?.();
        };
    }, [ userId ] );

    useEffect( () => {
        localStorage.setItem( 'userBalance', String( balance ) );
    }, [ balance ] );

    const displayTrades = useMemo( () => {
        return activeTrades.map( ( trade ) => ( {
            ...trade,
            timeLeft: Math.max( 0, ( trade.expiryTime || 0 ) - Date.now() ),
            currentPrice: marketBySymbol[ getAssetSymbol( trade.pair ).toUpperCase() ]?.current_price || trade.entryPrice
        } ) );
    }, [ activeTrades, marketBySymbol ] );

    useEffect( () => {
        if ( displayTrades.length === 0 ) return undefined;

        const intervalId = setInterval( () => {
            displayTrades.forEach( ( trade ) => {
                const shouldSettle = trade.timeLeft <= 0 || Boolean( trade.forcedOutcome );
                if ( !shouldSettle || settlingTradesRef.current.has( trade.id ) ) return;

                settlingTradesRef.current.add( trade.id );
                const livePrice = marketBySymbol[ getAssetSymbol( trade.pair ).toUpperCase() ]?.current_price || trade.entryPrice;
                let won;
                if ( trade.forcedOutcome === 'WIN' ) {
                    won = true;
                } else if ( trade.forcedOutcome === 'LOSS' ) {
                    won = false;
                } else {
                    won = trade.direction === 'up' ? livePrice > trade.entryPrice : livePrice < trade.entryPrice;
                }
                const payout = won ? Number( ( trade.amount * ( 1 + trade.payoutRate ) ).toFixed( 2 ) ) : 0;

                closeBinaryTrade( userId, trade, won ? 'WIN' : 'LOSS', payout )
                    .then( () => {
                        setBalance( ( prev ) => prev + payout );
                        setToast( {
                            message: `${trade.pair} ${won ? 'won' : 'lost'}${trade.forcedOutcome ? ' (admin override)' : ` at ${livePrice.toFixed( 2 )}`}`,
                            type: won ? 'success' : 'error'
                        } );
                    } )
                    .finally( () => {
                        settlingTradesRef.current.delete( trade.id );
                    } );
            } );
        }, 500 );

        return () => clearInterval( intervalId );
    }, [ displayTrades, marketBySymbol, userId ] );

    const showToast = ( message, type = 'info' ) => {
        setToast( { message, type } );
    };

    const placeTrade = async () => {
        const parsedAmount = parseFloat( amount );
        if ( !settings?.binaryEnabled ) {
            showToast( 'Binary Options is disabled by admin.', 'error' );
            return;
        }
        if ( !selectedMarket ) {
            showToast( 'Live market data is not ready yet.', 'error' );
            return;
        }
        if ( !selectedLevel ) {
            showToast( 'No trading level is available for the current market conditions.', 'error' );
            return;
        }
        if ( !parsedAmount || parsedAmount < Number( selectedLevel.minAmount ) || parsedAmount > Number( selectedLevel.maxAmount ) ) {
            showToast( `Amount must be between $${selectedLevel.minAmount} and $${selectedLevel.maxAmount}.`, 'error' );
            return;
        }
        if ( parsedAmount > balance ) {
            showToast( 'Insufficient balance.', 'error' );
            return;
        }

        const nextBalance = balance - parsedAmount;
        const trade = {
            id: String( Date.now() ),
            pair,
            userId,
            type: 'binary',
            direction,
            entryPrice: currentPrice,
            amount: parsedAmount,
            duration: Number( selectedLevel.duration ),
            levelId: selectedLevel.id,
            levelName: selectedLevel.name,
            payoutRate: Number( selectedLevel.payoutRate ),
            marketMove24h: currentMove,
            status: 'active',
            createdAt: Date.now(),
            expiryTime: Date.now() + Number( selectedLevel.duration ) * 1000
        };

        await saveBinaryTrade( userId, trade );
        await saveUser( userId, { balance: nextBalance } );
        setBalance( nextBalance );
        setAmount( '' );
        showToast( `${selectedLevel.name} trade placed on ${pair}.`, 'success' );
    };

    const goToPage = ( page ) => navigate( `/trade/binary-options/${page}` );
    const goBack = () => {
        if ( typeof onClose === 'function' ) {
            onClose();
            return;
        }
        navigate( '/trade' );
    };

    if ( !isOpen ) return null;

    return (
        <div className="trade-product-page">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />

            <header className="product-header">
                <div>
                    <p className="product-kicker">Binary Options</p>
                    <h1>Real-time, admin-controlled binary levels</h1>
                    <p className="product-copy">Only admin-approved levels unlock when live 24h price movement matches the configured thresholds.</p>
                </div>
                <button className="product-back-btn" onClick={goBack}>Back</button>
            </header>

            <div className="product-page-links">
                <button className={currentPage === 'new' ? 'active' : ''} onClick={() => goToPage( 'new' )}>New Trade</button>
                <button className={currentPage === 'active' ? 'active' : ''} onClick={() => goToPage( 'active' )}>Active</button>
                <button className={currentPage === 'history' ? 'active' : ''} onClick={() => goToPage( 'history' )}>History</button>
            </div>

            <section className="product-summary-grid">
                <div className="product-summary-card"><span>Feed</span><strong>{isLiveData ? 'Live' : 'Fallback'}</strong></div>
                <div className="product-summary-card"><span>Pair</span><strong>{pair}</strong></div>
                <div className="product-summary-card"><span>Price</span><strong>${currentPrice ? currentPrice.toLocaleString() : '--'}</strong></div>
                <div className="product-summary-card"><span>24h Move</span><strong className={currentMove >= 0 ? 'green' : 'red'}>{currentMove.toFixed( 2 )}%</strong></div>
                <div className="product-summary-card"><span>Balance</span><strong>${balance.toFixed( 2 )}</strong></div>
            </section>

            {!settings?.binaryEnabled && <div className="product-disabled-banner">Binary Options is disabled by admin settings.</div>}

            {currentPage === 'new' && (
                <section className="product-panel">
                    <div className="product-two-col">
                        <article className="product-card">
                            <h2>Live market board</h2>
                            <p className="product-muted">Select the pair you want to trade. Levels only unlock when live movement meets admin rules.</p>
                            <div className="product-chip-grid">
                                {binaryPairs.map( ( item ) => (
                                    <button key={item} className={item === pair ? 'active' : ''} onClick={() => setPair( item )}>{item}</button>
                                ) )}
                            </div>
                        </article>

                        <article className="product-card">
                            <h2>Available levels</h2>
                            <p className="product-muted">Live move: {currentMove.toFixed( 2 )}%</p>
                            {eligibleLevels.length === 0 ? (
                                <div className="product-empty-state">No binary level matches the current live market movement.</div>
                            ) : (
                                <div className="product-level-list">
                                    {eligibleLevels.map( ( level ) => (
                                        <button
                                            key={level.id}
                                            className={`product-level-card ${selectedLevel?.id === level.id ? 'active' : ''}`}
                                            onClick={() => setSelectedLevelId( level.id )}
                                        >
                                            <strong>{level.name}</strong>
                                            <span>Stake ${level.minAmount} - ${level.maxAmount}</span>
                                            <span>{level.duration}s • {( Number( level.payoutRate ) * 100 ).toFixed( 0 )}% profit</span>
                                            <span>Needs {level.min24hMove}% movement</span>
                                        </button>
                                    ) )}
                                </div>
                            )}
                        </article>
                    </div>

                    <article className="product-card">
                        <h2>Place trade</h2>
                        <div className="product-direction-toggle">
                            <button
                                className={`direction-btn up ${direction === 'up' ? 'active' : ''}`}
                                onClick={() => setDirection( 'up' )}
                            >▲ UP</button>
                            <button
                                className={`direction-btn down ${direction === 'down' ? 'active' : ''}`}
                                onClick={() => setDirection( 'down' )}
                            >▼ DOWN</button>
                        </div>
                        <div className="product-form-row">
                            <div>
                                <label htmlFor="binary-amount">Amount</label>
                                <input id="binary-amount" type="number" value={amount} onChange={( event ) => setAmount( event.target.value )} placeholder="Enter trade amount" />
                            </div>
                            <button className="product-primary-btn" onClick={placeTrade} disabled={!settings?.binaryEnabled || !selectedLevel}>Submit Trade</button>
                        </div>
                    </article>
                </section>
            )}

            {currentPage === 'active' && (
                <section className="product-panel">
                    <article className="product-card">
                        <h2>Active trades</h2>
                        {displayTrades.length === 0 ? (
                            <div className="product-empty-state">No active binary trades.</div>
                        ) : (
                            <div className="product-list">
                                {displayTrades.map( ( trade ) => {
                                    const progress = 100 - ( trade.timeLeft / ( trade.duration * 1000 ) ) * 100;
                                    return (
                                        <div key={trade.id} className="product-list-row">
                                            <div>
                                                <strong>{trade.pair}</strong>
                                                <p>{trade.levelName} • {trade.direction.toUpperCase()}</p>
                                            </div>
                                            <div>
                                                <strong>${trade.amount.toFixed( 2 )}</strong>
                                                <p>Entry ${trade.entryPrice.toFixed( 2 )}</p>
                                            </div>
                                            <div>
                                                <strong>{Math.ceil( trade.timeLeft / 1000 )}s</strong>
                                                <p>Live ${Number( trade.currentPrice ).toFixed( 2 )}</p>
                                            </div>
                                            <div className="product-progress"><span style={{ width: `${Math.max( 0, Math.min( 100, progress ) )}%` }} /></div>
                                        </div>
                                    );
                                } )}
                            </div>
                        )}
                    </article>
                </section>
            )}

            {currentPage === 'history' && (
                <section className="product-panel">
                    <article className="product-card">
                        <h2>Trade history</h2>
                        {tradeHistory.length === 0 ? (
                            <div className="product-empty-state">No closed binary trades yet.</div>
                        ) : (
                            <div className="product-table-wrap">
                                <table className="product-table">
                                    <thead>
                                        <tr>
                                            <th>Pair</th>
                                            <th>Level</th>
                                            <th>Amount</th>
                                            <th>Result</th>
                                            <th>Payout</th>
                                            <th>Closed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tradeHistory.map( ( trade ) => (
                                            <tr key={trade.id}>
                                                <td>{trade.pair}</td>
                                                <td>{trade.levelName || trade.levelId}</td>
                                                <td>${Number( trade.amount || 0 ).toFixed( 2 )}</td>
                                                <td className={trade.result === 'WIN' ? 'green' : 'red'}>{trade.result}</td>
                                                <td className={Number( trade.payout || 0 ) > 0 ? 'green' : 'red'}>${Number( trade.payout || 0 ).toFixed( 2 )}</td>
                                                <td>{new Date( trade.expiryTime || trade.endTime || Date.now() ).toLocaleString()}</td>
                                            </tr>
                                        ) )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </article>
                </section>
            )}
        </div>
    );
}
