import { useCallback, useEffect, useState } from 'react';
import { getTradingAdminSettings, saveTradingAdminSettings, subscribeToTradingAdminSettings } from '../lib/firebase.js';
import { formatApiError } from '../lib/errorHandling.js';

const BINARY_LEVEL_DEFAULTS = { name: 'New Level', minAmount: 25, maxAmount: 500, duration: 60, payoutRate: 0.75, min24hMove: 0.5 };
const AI_LEVEL_DEFAULTS = { name: 'New Level', minInvest: 100, maxInvest: 1000, duration: 180, roi: 0.08, minMomentum: 0, maxMomentum: 5 };

function makeId () {
    return Math.random().toString( 36 ).slice( 2, 9 );
}

function LevelRow ( { level, fields, onChange, onDelete } ) {
    return (
        <tr className="level-editor-row">
            {fields.map( ( field ) => (
                <td key={field.key}>
                    <input
                        type={field.type || 'text'}
                        value={level[ field.key ] ?? ''}
                        step={field.step}
                        min={field.min}
                        onChange={( e ) => onChange( level.id, field.key, field.type === 'number' ? Number( e.target.value ) : e.target.value )}
                        className="level-cell-input"
                    />
                </td>
            ) )}
            <td>
                <button className="level-delete-btn" onClick={() => onDelete( level.id )} title="Remove level">✕</button>
            </td>
        </tr>
    );
}

const BINARY_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'minAmount', label: 'Min $', type: 'number', min: 0 },
    { key: 'maxAmount', label: 'Max $', type: 'number', min: 0 },
    { key: 'duration', label: 'Duration (s)', type: 'number', min: 1 },
    { key: 'payoutRate', label: 'Payout Rate', type: 'number', step: '0.01', min: 0 },
    { key: 'min24hMove', label: 'Min 24h Move %', type: 'number', step: '0.1', min: 0 },
];

const AI_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'minInvest', label: 'Min $', type: 'number', min: 0 },
    { key: 'maxInvest', label: 'Max $', type: 'number', min: 0 },
    { key: 'duration', label: 'Duration (s)', type: 'number', min: 1 },
    { key: 'roi', label: 'ROI (0-1)', type: 'number', step: '0.01', min: 0 },
    { key: 'minMomentum', label: 'Min Momentum', type: 'number', step: '0.1' },
    { key: 'maxMomentum', label: 'Max Momentum', type: 'number', step: '0.1' },
];

export default function TradingControlPanel ( { onNotify } ) {
    const [ settings, setSettings ] = useState( null );
    const [ binaryEnabled, setBinaryEnabled ] = useState( true );
    const [ aiEnabled, setAiEnabled ] = useState( true );
    const [ binaryPairsText, setBinaryPairsText ] = useState( 'BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT' );
    const [ binaryLevels, setBinaryLevels ] = useState( [] );
    const [ aiLevels, setAiLevels ] = useState( [] );
    const [ isSaving, setIsSaving ] = useState( false );

    useEffect( () => {
        const syncState = ( value ) => {
            setSettings( value );
            setBinaryEnabled( Boolean( value.binaryEnabled ) );
            setAiEnabled( Boolean( value.aiArbitrageEnabled ) );
            setBinaryPairsText( ( value.binaryPairs || [] ).join( ', ' ) );
            setBinaryLevels( ( value.binaryLevels || [] ).map( ( l ) => ( { ...l, id: l.id || makeId() } ) ) );
            setAiLevels( ( value.aiArbitrageLevels || [] ).map( ( l ) => ( { ...l, id: l.id || makeId() } ) ) );
        };

        getTradingAdminSettings().then( syncState );
        const unsubscribe = subscribeToTradingAdminSettings( syncState );
        return () => unsubscribe?.();
    }, [] );

    const updateBinaryLevel = useCallback( ( id, key, val ) => {
        setBinaryLevels( ( prev ) => prev.map( ( l ) => l.id === id ? { ...l, [ key ]: val } : l ) );
    }, [] );

    const deleteBinaryLevel = useCallback( ( id ) => {
        setBinaryLevels( ( prev ) => prev.filter( ( l ) => l.id !== id ) );
    }, [] );

    const addBinaryLevel = () => setBinaryLevels( ( prev ) => [ ...prev, { ...BINARY_LEVEL_DEFAULTS, id: makeId() } ] );

    const updateAiLevel = useCallback( ( id, key, val ) => {
        setAiLevels( ( prev ) => prev.map( ( l ) => l.id === id ? { ...l, [ key ]: val } : l ) );
    }, [] );

    const deleteAiLevel = useCallback( ( id ) => {
        setAiLevels( ( prev ) => prev.filter( ( l ) => l.id !== id ) );
    }, [] );

    const addAiLevel = () => setAiLevels( ( prev ) => [ ...prev, { ...AI_LEVEL_DEFAULTS, id: makeId() } ] );

    const saveSettings = async () => {
        setIsSaving( true );
        try {
            const nextSettings = {
                ...settings,
                binaryEnabled,
                aiArbitrageEnabled: aiEnabled,
                binaryPairs: binaryPairsText.split( ',' ).map( ( item ) => item.trim() ).filter( Boolean ),
                binaryLevels,
                aiArbitrageLevels: aiLevels
            };
            await saveTradingAdminSettings( nextSettings );
            onNotify?.( 'Trading controls saved.', 'success' );
        } catch ( error ) {
            onNotify?.( formatApiError( error ), 'error' );
        } finally {
            setIsSaving( false );
        }
    };

    return (
        <section className="dashboard-section trading-controls-section">
            <h2>🎛️ Trading Controls</h2>
            <div className="trading-controls-grid">
                <div className="trading-control-card">
                    <label className="control-toggle">
                        <input type="checkbox" checked={binaryEnabled} onChange={( event ) => setBinaryEnabled( event.target.checked )} />
                        <span>Enable Binary Options</span>
                    </label>
                    <label className="control-field">
                        <span>Allowed Binary Pairs</span>
                        <input value={binaryPairsText} onChange={( event ) => setBinaryPairsText( event.target.value )} />
                    </label>
                    <div className="control-level-editor">
                        <span className="level-editor-heading">Binary Levels</span>
                        <div className="level-table-scroll">
                            <table className="level-editor-table">
                                <thead>
                                    <tr>
                                        {BINARY_FIELDS.map( ( f ) => <th key={f.key}>{f.label}</th> )}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {binaryLevels.map( ( level ) => (
                                        <LevelRow key={level.id} level={level} fields={BINARY_FIELDS} onChange={updateBinaryLevel} onDelete={deleteBinaryLevel} />
                                    ) )}
                                </tbody>
                            </table>
                        </div>
                        <button className="level-add-btn" onClick={addBinaryLevel}>+ Add Level</button>
                    </div>
                </div>

                <div className="trading-control-card">
                    <label className="control-toggle">
                        <input type="checkbox" checked={aiEnabled} onChange={( event ) => setAiEnabled( event.target.checked )} />
                        <span>Enable AI Arbitrage</span>
                    </label>
                    <div className="control-level-editor">
                        <span className="level-editor-heading">AI Arbitrage Levels</span>
                        <div className="level-table-scroll">
                            <table className="level-editor-table">
                                <thead>
                                    <tr>
                                        {AI_FIELDS.map( ( f ) => <th key={f.key}>{f.label}</th> )}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aiLevels.map( ( level ) => (
                                        <LevelRow key={level.id} level={level} fields={AI_FIELDS} onChange={updateAiLevel} onDelete={deleteAiLevel} />
                                    ) )}
                                </tbody>
                            </table>
                        </div>
                        <button className="level-add-btn" onClick={addAiLevel}>+ Add AI Level</button>
                    </div>
                </div>
            </div>

            <button className="trading-controls-save" onClick={saveSettings} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Trading Controls'}
            </button>
        </section>
    );
}
