import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app, db, auth;
let isFirebaseAvailable = false;

try {
  if ( firebaseConfig.apiKey && firebaseConfig.projectId ) {
    app = initializeApp( firebaseConfig );
    db = getFirestore( app );
    auth = getAuth( app );
    isFirebaseAvailable = true;
  }
} catch ( error ) {
  console.error( "Firebase initialization error:", error );
}

const getLocalStorageFallback = ( key, defaultValue = [] ) => {
  try {
    const saved = localStorage.getItem( key );
    return saved ? JSON.parse( saved ) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const DEFAULT_TRADING_ADMIN_SETTINGS = {
  vipUnlockFee: 500,
  withdrawalEnabled: false,
  minDeposit: 50,
  withdrawalRequiresVIP: true,
  binaryEnabled: true,
  aiArbitrageEnabled: true,
  binaryPairs: [ 'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT' ],
  binaryLevels: [
    { id: 'starter', name: 'Starter', minAmount: 25, maxAmount: 250, duration: 60, payoutRate: 0.7, min24hMove: 0.2 },
    { id: 'advanced', name: 'Advanced', minAmount: 100, maxAmount: 1000, duration: 120, payoutRate: 0.82, min24hMove: 0.8 },
    { id: 'pro', name: 'Pro', minAmount: 250, maxAmount: 5000, duration: 180, payoutRate: 0.92, min24hMove: 1.5 }
  ],
  aiArbitrageLevels: [
    { id: 'steady', name: 'Steady', minInvest: 100, maxInvest: 999, duration: 120, roi: 0.06, minMomentum: -3, maxMomentum: 2 },
    { id: 'momentum', name: 'Momentum', minInvest: 500, maxInvest: 2999, duration: 180, roi: 0.12, minMomentum: 1, maxMomentum: 6 },
    { id: 'surge', name: 'Surge', minInvest: 1500, maxInvest: 10000, duration: 300, roi: 0.2, minMomentum: 4, maxMomentum: 12 }
  ]
};

const normalizeTradingAdminSettings = ( settings = {} ) => ( {
  ...DEFAULT_TRADING_ADMIN_SETTINGS,
  ...settings,
  binaryPairs: Array.isArray( settings.binaryPairs ) && settings.binaryPairs.length > 0
    ? settings.binaryPairs
    : DEFAULT_TRADING_ADMIN_SETTINGS.binaryPairs,
  binaryLevels: Array.isArray( settings.binaryLevels ) && settings.binaryLevels.length > 0
    ? settings.binaryLevels
    : DEFAULT_TRADING_ADMIN_SETTINGS.binaryLevels,
  aiArbitrageLevels: Array.isArray( settings.aiArbitrageLevels ) && settings.aiArbitrageLevels.length > 0
    ? settings.aiArbitrageLevels
    : DEFAULT_TRADING_ADMIN_SETTINGS.aiArbitrageLevels
} );

const convertTimestamp = ( ts ) => ts?.toMillis?.() || ts;

export const subscribeToTradeUpdates = ( tradeId, callback ) => {
  const fallback = () => {
    const activeTrades = getLocalStorageFallback( 'activeTrades', [] );
    const myTrade = activeTrades.find( t => t.id === tradeId );
    if ( myTrade ) {
      callback( myTrade );
    }
  };

  if ( !isFirebaseAvailable ) {
    const interval = setInterval( fallback, 1000 );
    return () => clearInterval( interval );
  }

  const tradeRef = doc( db, 'activeTrades', tradeId );
  return onSnapshot( tradeRef, ( doc ) => {
    if ( doc.exists() ) {
      callback( { id: doc.id, ...doc.data() } );
    }
  }, ( error ) => {
    console.error( "Trade update subscription error:", error );
    fallback(); // Fallback to localStorage on error
  } );
};

export const saveUser = async ( userId, data ) => {
  if ( isFirebaseAvailable ) {
    await setDoc( doc( db, 'users', userId ), data, { merge: true } );
  } else {
    const users = getLocalStorageFallback( 'users', {} );
    users[ userId ] = { ...( users[ userId ] || {} ), ...data };
    localStorage.setItem( 'users', JSON.stringify( users ) );
  }
};

export const getUser = async ( userId ) => {
  if ( !isFirebaseAvailable ) {
    const users = getLocalStorageFallback( 'users', {} );
    return users[ userId ] || null;
  }
  const userDoc = await getDoc( doc( db, 'users', userId ) );
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

export const saveAiArbitrageInvestment = async ( investment ) => {
  const investmentsKey = 'aiArbitrageInvestments';
  if ( !isFirebaseAvailable ) {
    let investments = getLocalStorageFallback( investmentsKey, [] );
    if ( investment.id ) {
      const index = investments.findIndex( inv => inv.id === investment.id );
      if ( index > -1 ) investments[ index ] = { ...investments[ index ], ...investment };
      else investments.push( investment );
    } else {
      investments.push( { ...investment, id: Date.now().toString() } );
    }
    localStorage.setItem( investmentsKey, JSON.stringify( investments ) );
    return;
  }
  try {
    if ( investment.id ) {
      await setDoc( doc( db, 'aiArbitrageInvestments', investment.id ), investment, { merge: true } );
    } else {
      await addDoc( collection( db, 'aiArbitrageInvestments' ), investment );
    }
  } catch ( error ) {
    console.error( "Error saving AI Arbitrage investment:", error );
  }
};

export const getTradingAdminSettings = async () => {
  if ( !isFirebaseAvailable ) {
    return normalizeTradingAdminSettings( getLocalStorageFallback( 'globalAdminSettings', {} ) );
  }

  try {
    const settingsDoc = await getDoc( doc( db, 'appSettings', 'globalAdminSettings' ) );
    const remoteSettings = settingsDoc.exists() ? settingsDoc.data() : {};
    const merged = normalizeTradingAdminSettings( {
      ...getLocalStorageFallback( 'globalAdminSettings', {} ),
      ...remoteSettings
    } );
    localStorage.setItem( 'globalAdminSettings', JSON.stringify( merged ) );
    return merged;
  } catch {
    return normalizeTradingAdminSettings( getLocalStorageFallback( 'globalAdminSettings', {} ) );
  }
};

export const saveTradingAdminSettings = async ( settings ) => {
  const normalized = normalizeTradingAdminSettings( settings );
  localStorage.setItem( 'globalAdminSettings', JSON.stringify( normalized ) );
  window.dispatchEvent( new CustomEvent( 'global-admin-settings-updated', { detail: normalized } ) );

  if ( !isFirebaseAvailable ) {
    return normalized;
  }

  await setDoc( doc( db, 'appSettings', 'globalAdminSettings' ), normalized, { merge: true } );
  return normalized;
};

export const subscribeToTradingAdminSettings = ( callback ) => {
  const emitLocal = () => callback( normalizeTradingAdminSettings( getLocalStorageFallback( 'globalAdminSettings', {} ) ) );

  if ( !isFirebaseAvailable ) {
    emitLocal();
    const handleStorage = ( event ) => {
      if ( event.key === 'globalAdminSettings' ) emitLocal();
    };
    const handleCustomUpdate = () => emitLocal();
    window.addEventListener( 'storage', handleStorage );
    window.addEventListener( 'global-admin-settings-updated', handleCustomUpdate );
    return () => {
      window.removeEventListener( 'storage', handleStorage );
      window.removeEventListener( 'global-admin-settings-updated', handleCustomUpdate );
    };
  }

  const settingsRef = doc( db, 'appSettings', 'globalAdminSettings' );
  return onSnapshot( settingsRef, ( snapshot ) => {
    const merged = normalizeTradingAdminSettings( {
      ...getLocalStorageFallback( 'globalAdminSettings', {} ),
      ...( snapshot.exists() ? snapshot.data() : {} )
    } );
    localStorage.setItem( 'globalAdminSettings', JSON.stringify( merged ) );
    callback( merged );
  }, emitLocal );
};

export const subscribeToAiArbitrageInvestments = ( callback ) => {
  const investmentsKey = 'aiArbitrageInvestments';
  const userId = localStorage.getItem( 'wallet_address' );
  const fallback = () => {
    const investments = getLocalStorageFallback( investmentsKey, [] );
    const userInvestments = investments.filter( inv => inv.userId === userId && !inv.completed );
    callback( userInvestments );
  };

  if ( !isFirebaseAvailable || !userId ) {
    fallback();
    return () => { };
  }

  const q = query(
    collection( db, 'aiArbitrageInvestments' ),
    where( 'userId', '==', userId ),
    where( 'completed', '==', false )
  );

  return onSnapshot( q, ( snapshot ) => {
    const investments = snapshot.docs.map( d => ( {
      id: d.id,
      ...d.data(),
      startTime: convertTimestamp( d.data().startTime ),
      endTime: convertTimestamp( d.data().endTime ),
    } ) );
    callback( investments );
  }, ( error ) => {
    console.error( "AI Arbitrage subscription error:", error );
    fallback();
  } );
};

export const subscribeToBinaryTrades = ( userId, callback ) => {
  const key = `binaryTrades_${userId}`;
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'users', userId, 'binaryTrades' ), where( 'status', '==', 'active' ) );
  return onSnapshot( q, snapshot => {
    const trades = snapshot.docs.map( d => ( { id: d.id, ...d.data(), expiryTime: convertTimestamp( d.data().expiryTime ) } ) );
    callback( trades );
  }, fallback );
};

export const saveBinaryTrade = async ( userId, trade ) => {
  if ( !isFirebaseAvailable ) {
    const key = `binaryTrades_${userId}`;
    const trades = getLocalStorageFallback( key );
    trades.push( trade );
    localStorage.setItem( key, JSON.stringify( trades ) );

    const adminTrades = getLocalStorageFallback( 'trades', [] );
    adminTrades.unshift( { ...trade, id: trade.id, userId, type: 'binary', status: trade.status || 'active' } );
    localStorage.setItem( 'trades', JSON.stringify( adminTrades ) );
  } else {
    await setDoc( doc( db, 'users', userId, 'binaryTrades', trade.id ), trade );
    await setDoc( doc( db, 'trades', trade.id ), { ...trade, userId, type: 'binary', status: trade.status || 'active' }, { merge: true } );
  }
};

export const closeBinaryTrade = async ( userId, trade, result, payout ) => {
  const user = await getUser( userId );
  const newBalance = ( user?.balance || 0 ) + payout;

  if ( !isFirebaseAvailable ) {
    const tradesKey = `binaryTrades_${userId}`;
    let trades = getLocalStorageFallback( tradesKey ).filter( t => t.id !== trade.id );
    localStorage.setItem( tradesKey, JSON.stringify( trades ) );

    const historyKey = `binaryHistory_${userId}`;
    let history = getLocalStorageFallback( historyKey );
    history.unshift( { ...trade, result, payout, status: 'closed' } );
    localStorage.setItem( historyKey, JSON.stringify( history ) );

    const adminTrades = getLocalStorageFallback( 'trades', [] );
    const adminIndex = adminTrades.findIndex( ( item ) => item.id === trade.id );
    if ( adminIndex > -1 ) {
      adminTrades[ adminIndex ] = { ...adminTrades[ adminIndex ], result, payout, status: 'closed' };
      localStorage.setItem( 'trades', JSON.stringify( adminTrades ) );
    }

    await saveUser( userId, { balance: newBalance } );
  } else {
    const batch = writeBatch( db );
    const tradeRef = doc( db, 'users', userId, 'binaryTrades', trade.id );
    batch.update( tradeRef, { result, payout, status: 'closed' } );
    batch.set( doc( db, 'trades', trade.id ), { result, payout, status: 'closed' }, { merge: true } );
    batch.update( doc( db, 'users', userId ), { balance: newBalance } );
    await batch.commit();
  }
};

export const setForcedBinaryOutcome = async ( tradeId, userId, outcome ) => {
  if ( !isFirebaseAvailable ) {
    // Update global admin trades feed
    const adminTrades = getLocalStorageFallback( 'trades', [] );
    const adminIdx = adminTrades.findIndex( ( t ) => t.id === tradeId );
    if ( adminIdx > -1 ) {
      adminTrades[ adminIdx ] = { ...adminTrades[ adminIdx ], forcedOutcome: outcome };
      localStorage.setItem( 'trades', JSON.stringify( adminTrades ) );
    }
    // Update per-user binaryTrades so settlement loop picks it up
    if ( userId ) {
      const userTrades = getLocalStorageFallback( `binaryTrades_${userId}`, [] );
      const userIdx = userTrades.findIndex( ( t ) => t.id === tradeId );
      if ( userIdx > -1 ) {
        userTrades[ userIdx ] = { ...userTrades[ userIdx ], forcedOutcome: outcome };
        localStorage.setItem( `binaryTrades_${userId}`, JSON.stringify( userTrades ) );
      }
    }
    window.dispatchEvent( new CustomEvent( 'forced-outcome-updated', { detail: { tradeId, outcome } } ) );
  } else {
    const batch = writeBatch( db );
    batch.set( doc( db, 'trades', tradeId ), { forcedOutcome: outcome }, { merge: true } );
    if ( userId ) {
      batch.set( doc( db, 'users', userId, 'binaryTrades', tradeId ), { forcedOutcome: outcome }, { merge: true } );
    }
    await batch.commit();
  }
};

export const subscribeToBinaryHistory = ( userId, callback ) => {
  const key = `binaryHistory_${userId}`;
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'users', userId, 'binaryTrades' ), where( 'status', '==', 'closed' ), orderBy( 'expiryTime', 'desc' ), limit( 20 ) );
  return onSnapshot( q, snapshot => {
    const history = snapshot.docs.map( d => ( { id: d.id, ...d.data(), expiryTime: convertTimestamp( d.data().expiryTime ) } ) );
    callback( history );
  }, fallback );
};

export const subscribeToFuturesPositions = ( userId, callback ) => {
  const key = `futuresPositions_${userId}`;
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable || !userId ) return fallback(), () => { };

  const q = query( collection( db, 'users', userId, 'futuresPositions' ), where( 'status', '==', 'open' ) );
  return onSnapshot( q, snapshot => {
    const positions = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( positions );
  }, fallback );
};

export const saveFuturesPosition = async ( userId, position ) => {
  if ( !isFirebaseAvailable ) {
    const key = `futuresPositions_${userId}`;
    const positions = getLocalStorageFallback( key );
    positions.push( position );
    localStorage.setItem( key, JSON.stringify( positions ) );
  } else {
    await setDoc( doc( db, 'users', userId, 'futuresPositions', position.id ), position );
  }
};

export const closeFuturesPosition = async ( userId, position, pnl ) => {
  const user = await getUser( userId );
  const newBalance = ( user?.balance || 0 ) + position.margin + pnl;

  if ( !isFirebaseAvailable ) {
    const positionsKey = `futuresPositions_${userId}`;
    let positions = getLocalStorageFallback( positionsKey ).filter( p => p.id !== position.id );
    localStorage.setItem( positionsKey, JSON.stringify( positions ) );

    const historyKey = `futuresHistory_${userId}`;
    let history = getLocalStorageFallback( historyKey );
    history.unshift( { ...position, pnl, status: 'closed', closeTime: Date.now() } );
    localStorage.setItem( historyKey, JSON.stringify( history ) );

    await saveUser( userId, { balance: newBalance } );
  } else {
    const batch = writeBatch( db );
    const posRef = doc( db, 'users', userId, 'futuresPositions', position.id );
    batch.update( posRef, { pnl, status: 'closed', closeTime: serverTimestamp() } );

    const userRef = doc( db, 'users', userId );
    batch.update( userRef, { balance: newBalance } );

    await batch.commit();
  }
};

export const subscribeToFuturesHistory = ( userId, callback ) => {
  const key = `futuresHistory_${userId}`;
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable || !userId ) return fallback(), () => { };

  const q = query( collection( db, 'users', userId, 'futuresPositions' ), where( 'status', '==', 'closed' ), orderBy( 'closeTime', 'desc' ), limit( 50 ) );
  return onSnapshot( q, snapshot => {
    const history = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( history );
  }, fallback );
};

export const saveTradeHistory = async ( tradeRecord ) => {
  if ( !isFirebaseAvailable ) {
    const key = `tradeHistory_${tradeRecord.userId}`;
    const history = getLocalStorageFallback( key, [] );
    history.unshift( tradeRecord );
    localStorage.setItem( key, JSON.stringify( history ) );
  } else {
    const tradeHistoryRef = doc( db, 'users', tradeRecord.userId, 'tradeHistory', tradeRecord.tradeId );
    await setDoc( tradeHistoryRef, tradeRecord );
  }
};

export const firebaseSignIn = async ( email, password ) => {
  if ( !isFirebaseAvailable ) {
    // This is a placeholder for local storage-based authentication
    if ( email === 'admin' && password === 'password' ) {
      return { user: { email } };
    }
    throw new Error( 'Invalid credentials' );
  }
  return await signInWithEmailAndPassword( auth, email, password );
};

export const firebaseSignOut = async () => {
  if ( !isFirebaseAvailable ) {
    return;
  }
  await signOut( auth );
};

export const subscribeToUsers = ( callback ) => {
  const key = 'users';
  const fallback = () => callback( Object.values( getLocalStorageFallback( key, {} ) ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'users' ) );
  return onSnapshot( q, snapshot => {
    const users = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( users );
  }, fallback );
};

export const subscribeToDeposits = ( callback ) => {
  const key = 'deposits';
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'deposits' ), where( 'status', '==', 'pending' ) );
  return onSnapshot( q, snapshot => {
    const deposits = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( deposits );
  }, fallback );
};

export const subscribeToWithdrawals = ( callback ) => {
  const key = 'withdrawals';
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'withdrawals' ), where( 'status', '==', 'pending' ) );
  return onSnapshot( q, snapshot => {
    const withdrawals = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( withdrawals );
  }, fallback );
};

export const subscribeToTrades = ( callback ) => {
  const key = 'trades';
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'trades' ) );
  return onSnapshot( q, snapshot => {
    const trades = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( trades );
  }, fallback );
};

export const subscribeToChatMessages = ( chatId, callback ) => {
  const key = `chat_${chatId}`;
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'chats', chatId, 'messages' ), orderBy( 'timestamp', 'asc' ) );
  return onSnapshot( q, snapshot => {
    const messages = snapshot.docs.map( d => ( { id: d.id, ...d.data(), timestamp: convertTimestamp( d.data().timestamp ) } ) );
    callback( messages );
  }, fallback );
};

export const subscribeToActiveChats = ( callback ) => {
  const key = 'activeChats';
  const fallback = () => callback( getLocalStorageFallback( key, [] ) );
  if ( !isFirebaseAvailable ) return fallback(), () => { };

  const q = query( collection( db, 'chats' ), where( 'isArchived', '==', false ) );
  return onSnapshot( q, snapshot => {
    const chats = snapshot.docs.map( d => ( { id: d.id, ...d.data() } ) );
    callback( chats );
  }, fallback );
};

export const saveAdminReply = async ( chatId, adminId, text ) => {
  const message = {
    senderId: adminId,
    text,
    timestamp: serverTimestamp(),
    isAdmin: true
  };
  if ( !isFirebaseAvailable ) {
    const key = `chat_${chatId}`;
    const messages = getLocalStorageFallback( key, [] );
    messages.push( { ...message, timestamp: Date.now() } );
    localStorage.setItem( key, JSON.stringify( messages ) );
  } else {
    await addDoc( collection( db, 'chats', chatId, 'messages' ), message );
    await setDoc( doc( db, 'chats', chatId ), { lastMessage: text, lastUpdated: serverTimestamp() }, { merge: true } );
  }
};

export const updateActiveChat = async ( chatId, data ) => {
  if ( !isFirebaseAvailable ) {
    const chats = getLocalStorageFallback( 'activeChats', [] );
    const index = chats.findIndex( c => c.id === chatId );
    if ( index > -1 ) {
      chats[ index ] = { ...chats[ index ], ...data };
      localStorage.setItem( 'activeChats', JSON.stringify( chats ) );
    }
  } else {
    await setDoc( doc( db, 'chats', chatId ), data, { merge: true } );
  }
};

export const saveChatMessage = async ( chatId, senderId, text ) => {
  const message = {
    senderId,
    text,
    timestamp: serverTimestamp(),
    isAdmin: false
  };
  if ( !isFirebaseAvailable ) {
    const key = `chat_${chatId}`;
    const messages = getLocalStorageFallback( key, [] );
    messages.push( { ...message, timestamp: Date.now() } );
    localStorage.setItem( key, JSON.stringify( messages ) );
  } else {
    await addDoc( collection( db, 'chats', chatId, 'messages' ), message );
    await setDoc( doc( db, 'chats', chatId ), { lastMessage: text, lastUpdated: serverTimestamp() }, { merge: true } );
  }
};

export const isFirebaseEnabled = () => isFirebaseAvailable;

export { isFirebaseAvailable, onAuthStateChanged, auth, db, app };
