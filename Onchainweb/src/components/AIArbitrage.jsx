import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Toast from './Toast.jsx';
import { useMarketData } from '../hooks/useMarketData';
import {
    getTradingAdminSettings,
    saveAiArbitrageInvestment,
    saveUser,
    subscribeToAiArbitrageInvestments,
    subscribeToTradingAdminSettings
} from '../lib/firebase.js';
import { formatApiError } from '../lib/errorHandling';

function getPageFromPath ( pathname ) {
    if ( pathname.endsWith( '/active' ) ) return 'active';
    if ( pathname.endsWith( '/history' ) ) return 'history';
    return 'invest';
}

function getMomentumScore ( cryptoData ) {
    const topCoins = cryptoData.slice( 0, 5 );
    if ( topCoins.length === 0 ) return 0;
    const total = topCoins.reduce( ( sum, coin ) => sum + Number( coin.price_change_percentage_24h || 0 ), 0 );
    return total / topCoins.length;
}

export default function AIArbitrage ( { isOpen = true, onClose } ) {
    const location = useLocation();
    const navigate = useNavigate();
    const { cryptoData, isLiveData } = useMarketData( { refreshInterval: 10000 } );

    const [ toast, setToast ] = useState( { message: '', type: '' } );
    const [ settings, setSettings ] = useState( null );
    const [ userId ] = useState( () => localStorage.getItem( 'wallet_address' ) || 'guest' );
    const [ balance, setBalance ] = useState( () => parseFloat( localStorage.getItem( 'userBalance' ) || '0' ) );
    const [ selectedLevelId, setSelectedLevelId ] = useState( '' );
    const [ amount, setAmount ] = useState( '' );
    const [ activeInvestments, setActiveInvestments ] = useState( [] );
    const [ history, setHistory ] = useState( () => JSON.parse( localStorage.getItem( `aiArbitrageHistory_${userId}` ) || '[]' ) );
    const settlingInvestmentsRef = useRef( new Set() );

    const currentPage = getPageFromPath( location.pathname );
    const momentumScore = useMemo( () => getMomentumScore( cryptoData ), [ cryptoData ] );
    const aiLevels = settings?.aiArbitrageLevels || [];

    const eligibleLevels = useMemo( () => {
        return aiLevels.filter( ( level ) => momentumScore >= Number( level.minMomentum ) && momentumScore <= Number( level.maxMomentum ) );
    }, [ aiLevels, momentumScore ] );

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
        if ( selectedLevel && selectedLevel.id !== selectedLevelId ) {
            setSelectedLevelId( selectedLevel.id );
        }
    }, [ selectedLevel, selectedLevelId ] );

    useEffect( () => {
        if ( !userId ) return undefined;
        return subscribeToAiArbitrageInvestments( setActiveInvestments );
    }, [ userId ] );

    useEffect( () => {
        localStorage.setItem( `aiArbitrageHistory_${userId}`, JSON.stringify( history ) );
    }, [ history, userId ] );

    useEffect( () => {
        localStorage.setItem( 'userBalance', String( balance ) );
    }, [ balance ] );

    const displayInvestments = useMemo( () => {
        return activeInvestments.map( ( investment ) => ( {
            ...investment,
            timeLeft: Math.max( 0, ( investment.endTime || 0 ) - Date.now() )
        } ) );
    }, [ activeInvestments ] );

    useEffect( () => {
        if ( displayInvestments.length === 0 ) return undefined;

        const intervalId = setInterval( () => {
            displayInvestments.forEach( ( investment ) => {
                if ( investment.timeLeft > 0 || settlingInvestmentsRef.current.has( investment.id ) ) return;

                settlingInvestmentsRef.current.add( investment.id );
                const marketFactor = Math.max( 0.75, Math.min( 1.35, 1 + momentumScore / 100 ) );
                const profit = Number( ( investment.amount * investment.roi * marketFactor ).toFixed( 2 ) );
                const payout = Number( ( investment.amount + profit ).toFixed( 2 ) );
                const completedInvestment = {
                    ...investment,
                    completed: true,
                    currentValue: payout,
                    profit,
                    payout,
                    marketMomentumAtClose: momentumScore,
                    completedAt: Date.now()
                };

                saveAiArbitrageInvestment( completedInvestment )
                    .then( () => {
                        setBalance( ( prev ) => {
                            const nextBalance = prev + payout;
                            saveUser( userId, { balance: nextBalance } );
                            return nextBalance;
                        } );
                        setHistory( ( prev ) => [ completedInvestment, ...prev ] );
                        setToast( { message: `${investment.levelName} cycle completed with +$${profit.toFixed( 2 )}.`, type: 'success' } );
                    } )
                    .finally( () => {
                        settlingInvestmentsRef.current.delete( investment.id );
                    } );
            } );
        }, 500 );

        return () => clearInterval( intervalId );
    }, [ displayInvestments, momentumScore ] );

    const showToast = ( message, type = 'info' ) => {
        setToast( { message, type } );
    };

    const startInvestment = async () => {
        try {
            const parsedAmount = parseFloat( amount );
            if ( !settings?.aiArbitrageEnabled ) {
                showToast( 'AI Arbitrage is disabled by admin.', 'error' );
                return;
            }
            if ( !selectedLevel ) {
                showToast( 'No AI level is available for the current real-time momentum.', 'error' );
                return;
            }
            if ( !parsedAmount || parsedAmount < Number( selectedLevel.minInvest ) || parsedAmount > Number( selectedLevel.maxInvest ) ) {
                showToast( `Amount must be between $${selectedLevel.minInvest} and $${selectedLevel.maxInvest}.`, 'error' );
                return;
            }
            if ( parsedAmount > balance ) {
                showToast( 'Insufficient balance.', 'error' );
                return;
            }

            const nextBalance = balance - parsedAmount;
            const investment = {
                id: String( Date.now() ),
                userId,
                type: 'ai-arbitrage',
                amount: parsedAmount,
                levelId: selectedLevel.id,
                levelName: selectedLevel.name,
                roi: Number( selectedLevel.roi ),
                duration: Number( selectedLevel.duration ),
                status: 'active',
                completed: false,
                marketMomentumAtStart: momentumScore,
                startTime: Date.now(),
                endTime: Date.now() + Number( selectedLevel.duration ) * 1000
            };

            await saveAiArbitrageInvestment( investment );
            await saveUser( userId, { balance: nextBalance } );
            setBalance( nextBalance );
            setAmount( '' );
            showToast( `${selectedLevel.name} cycle started.`, 'success' );
        } catch ( error ) {
            showToast( formatApiError( error ), 'error' );
        }
    };

    const goToPage = ( page ) => navigate( `/trade/ai-arbitrage/${page}` );
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
                    <p className="product-kicker">AI Arbitrage</p>
                    <h1>Real-time, admin-controlled arbitrage levels</h1>
                    <p className="product-copy">Levels unlock only when live market momentum matches the admin-defined range for each strategy.</p>
                </div>
                <button className="product-back-btn" onClick={goBack}>Back</button>
            </header>

            <div className="product-page-links">
                <button className={currentPage === 'invest' ? 'active' : ''} onClick={() => goToPage( 'invest' )}>Invest</button>
                <button className={currentPage === 'active' ? 'active' : ''} onClick={() => goToPage( 'active' )}>Active</button>
                <button className={currentPage === 'history' ? 'active' : ''} onClick={() => goToPage( 'history' )}>History</button>
            </div>

            <section className="product-summary-grid">
                <div className="product-summary-card"><span>Feed</span><strong>{isLiveData ? 'Live' : 'Fallback'}</strong></div>
                <div className="product-summary-card"><span>Momentum</span><strong className={momentumScore >= 0 ? 'green' : 'red'}>{momentumScore.toFixed( 2 )}%</strong></div>
                <div className="product-summary-card"><span>Eligible Levels</span><strong>{eligibleLevels.length}</strong></div>
                <div className="product-summary-card"><span>Balance</span><strong>${balance.toFixed( 2 )}</strong></div>
            </section>

            {!settings?.aiArbitrageEnabled && <div className="product-disabled-banner">AI Arbitrage is disabled by admin settings.</div>}

            {currentPage === 'invest' && (
                <section className="product-panel">
                    <article className="product-card">
                        <h2>Live market gate</h2>
                        <p className="product-muted">Top-5 market momentum currently sits at {momentumScore.toFixed( 2 )}%. Only matching strategy levels are available.</p>
                        {eligibleLevels.length === 0 ? (
                            <div className="product-empty-state">No AI level is eligible at this live momentum.</div>
                        ) : (
                            <div className="product-level-list">
                                {eligibleLevels.map( ( level ) => (
                                    <button
                                        key={level.id}
                                        className={`product-level-card ${selectedLevel?.id === level.id ? 'active' : ''}`}
                                        onClick={() => setSelectedLevelId( level.id )}
                                    >
                                        <strong>{level.name}</strong>
                                        <span>Invest ${level.minInvest} - ${level.maxInvest}</span>
                                        <span>{level.duration}s • {( Number( level.roi ) * 100 ).toFixed( 0 )}% base ROI</span>
                                        <span>Momentum {level.minMomentum}% to {level.maxMomentum}%</span>
                                    </button>
                                ) )}
                            </div>
                        )}
                    </article>

                    <article className="product-card">
                        <h2>Start cycle</h2>
                        <div className="product-form-row">
                            <div>
                                <label htmlFor="ai-amount">Amount</label>
                                <input id="ai-amount" type="number" value={amount} onChange={( event ) => setAmount( event.target.value )} placeholder="Enter investment amount" />
                            </div>
                            <button className="product-primary-btn" onClick={startInvestment} disabled={!settings?.aiArbitrageEnabled || !selectedLevel}>Start Cycle</button>
                        </div>
                    </article>
                </section>
            )}

            {currentPage === 'active' && (
                <section className="product-panel">
                    <article className="product-card">
                        <h2>Active AI cycles</h2>
                        {displayInvestments.length === 0 ? (
                            <div className="product-empty-state">No active AI cycles.</div>
                        ) : (
                            <div className="product-list">
                                {displayInvestments.map( ( investment ) => {
                                    const progress = 100 - ( investment.timeLeft / ( investment.duration * 1000 ) ) * 100;
                                    return (
                                        <div key={investment.id} className="product-list-row">
                                            <div>
                                                <strong>{investment.levelName}</strong>
                                                <p>Momentum start {Number( investment.marketMomentumAtStart || 0 ).toFixed( 2 )}%</p>
                                            </div>
                                            <div>
                                                <strong>${Number( investment.amount || 0 ).toFixed( 2 )}</strong>
                                                <p>ROI {( Number( investment.roi || 0 ) * 100 ).toFixed( 0 )}%</p>
                                            </div>
                                            <div>
                                                <strong>{Math.ceil( investment.timeLeft / 1000 )}s</strong>
                                                <p>Live momentum {momentumScore.toFixed( 2 )}%</p>
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
                        <h2>AI history</h2>
                        {history.length === 0 ? (
                            <div className="product-empty-state">No completed AI cycles yet.</div>
                        ) : (
                            <div className="product-table-wrap">
                                <table className="product-table">
                                    <thead>
                                        <tr>
                                            <th>Level</th>
                                            <th>Amount</th>
                                            <th>ROI</th>
                                            <th>Profit</th>
                                            <th>Payout</th>
                                            <th>Completed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map( ( investment ) => (
                                            <tr key={investment.id}>
                                                <td>{investment.levelName || investment.levelId}</td>
                                                <td>${Number( investment.amount || 0 ).toFixed( 2 )}</td>
                                                <td>{( Number( investment.roi || 0 ) * 100 ).toFixed( 0 )}%</td>
                                                <td className="green">+${Number( investment.profit || 0 ).toFixed( 2 )}</td>
                                                <td>${Number( investment.payout || 0 ).toFixed( 2 )}</td>
                                                <td>{new Date( investment.completedAt || investment.endTime || Date.now() ).toLocaleString()}</td>
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
