import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, fantom } from 'wagmi/chains';
import { WALLET_CONNECTORS, SUPPORTED_CHAINS } from '../config/constants';
import { formatApiError } from './errorHandling';
import { saveWalletState, loadWalletState, clearWalletState } from '../services/walletStateService';
import Toast from '../components/Toast';

// Browser environment check for SSR/test compatibility
const isBrowser = typeof window !== 'undefined';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const metadata = {
    name: 'OnchainWeb',
    description: 'Web3 Trading Platform',
    url: 'https://onchainweb.app',
    icons: [ 'https://onchainweb.app/logo.png' ]
};

const chains = [ mainnet, bsc, polygon, arbitrum, optimism, avalanche, fantom ];

// Guard wagmiConfig creation with browser check and projectId validation
let wagmiConfig;
if ( isBrowser && projectId ) {
    wagmiConfig = defaultWagmiConfig( { chains, projectId, metadata } );
    createWeb3Modal( { wagmiConfig, projectId, chains } );
}

// Disabled context fallback for non-browser or missing config
const DISABLED_WALLET_CONTEXT = {
    isConnected: false,
    address: null,
    chainId: null,
    connectorType: null,
    error: null,
    loading: false,
    connectWallet: () => Promise.reject( new Error( 'WalletConnect not configured' ) ),
    disconnectWallet: () => Promise.reject( new Error( 'WalletConnect not configured' ) ),
    supportedChains: SUPPORTED_CHAINS,
    availableWallets: []
};

const UniversalWalletContext = createContext( DISABLED_WALLET_CONTEXT );

const WalletProvider = ( { children } ) => {
    // Get chain directly from useAccount
    const { address, isConnected, connector, isReconnecting, chain } = useAccount();
    const [ toast, setToast ] = useState( { message: '', type: '' } );
    const [ error, setError ] = useState( null );

    const showToast = ( message, type = 'info' ) => setToast( { message, type } );

    const { connect, connectors, isLoading: isConnecting } = useConnect( {
        onSuccess: () => {
            setError( null );
            showToast( 'Wallet connected!', 'success' );
        },
        onError: ( error ) => {
            const message = formatApiError( error );
            setError( message );
            showToast( message, 'error' );
        },
    } );

    const { disconnect, isLoading: isDisconnecting } = useDisconnect( {
        onSuccess: () => {
            setError( null );
            showToast( 'Wallet disconnected.', 'info' );
        },
        onError: ( error ) => {
            const message = formatApiError( error );
            setError( message );
            showToast( message, 'error' );
        },
    } );

    const connectWallet = useCallback( async ( walletOrId ) => {
        let resolvedConnector;

        if ( typeof walletOrId === 'string' ) {
            resolvedConnector = connectors.find( ( c ) => c.id === walletOrId );
        } else if ( walletOrId?.connector ) {
            resolvedConnector = walletOrId.connector;
        } else if ( walletOrId?.id ) {
            resolvedConnector = connectors.find( ( c ) => c.id === walletOrId.id );
        } else if ( walletOrId?.name ) {
            resolvedConnector = connectors.find( ( c ) => c.name === walletOrId.name );
        }

        if ( resolvedConnector ) {
            return connect( { connector: resolvedConnector } );
        }

        // Fall back to default behavior if no connector can be resolved.
        return connect();
    }, [ connect, connectors ] );

    const disconnectWallet = useCallback( async () => {
        setError( null );
        return disconnect();
    }, [ disconnect ] );

    // Auto-reconnect on initial load
    useEffect( () => {
        const autoConnect = async () => {
            const savedState = loadWalletState();
            if ( savedState?.connectorId && !isConnected ) {
                const connector = connectors.find( c => c.id === savedState.connectorId );
                if ( connector ) {
                    try {
                        await connect( { connector } );
                    } catch ( e ) {
                        // If auto-connect fails, clear state to prevent loops
                        clearWalletState();
                    }
                }
            }
        };
        autoConnect();
        // We only want this to run once on mount, connectors might change but initial check is enough.
    }, [ connectors, isConnected ] );

    // Persist or clear connection state
    useEffect( () => {
        if ( isConnected && address && chain && connector ) {
            saveWalletState( { address, chainId: chain.id, connectorId: connector.id } );
        } else {
            clearWalletState();
        }
    }, [ isConnected, address, chain, connector ] );

    const contextValue = useMemo( () => ( {
        isConnected,
        address,
        chainId: chain?.id,
        connectorType: connector?.id,
        error,
        loading: isConnecting || isDisconnecting || isReconnecting,
        connectWallet,
        disconnectWallet,
        supportedChains: SUPPORTED_CHAINS,
        availableWallets: connectors.map( c => ( {
            id: c.id,
            name: c.name,
            connector: c,
            icon: WALLET_CONNECTORS[ c.id.toUpperCase() ]?.icon || '/default-wallet.svg',
            type: c.id === 'walletConnect' ? 'walletconnect' : 'injected'
        } ) )
    } ), [ isConnected, address, chain, connector, error, isConnecting, isDisconnecting, isReconnecting, connectWallet, disconnectWallet, connectors ] );

    return (
        <UniversalWalletContext.Provider value={contextValue}>
            {children}
            <Toast message={toast.message} type={toast.type} onClose={() => setToast( { message: '', type: '' } )} />
        </UniversalWalletContext.Provider>
    );
}

export const UniversalWalletProvider = ( { children } ) => {
    // Return disabled context when not in browser or projectId is missing
    if ( !isBrowser ) {
        console.warn( '[WalletConnect] Wallet functionality disabled: not in browser environment' );
        return (
            <UniversalWalletContext.Provider value={DISABLED_WALLET_CONTEXT}>
                {children}
            </UniversalWalletContext.Provider>
        );
    }

    if ( !projectId || !wagmiConfig ) {
        console.warn( '[WalletConnect] Wallet functionality disabled: VITE_WALLETCONNECT_PROJECT_ID not configured' );
        return (
            <UniversalWalletContext.Provider value={DISABLED_WALLET_CONTEXT}>
                {children}
            </UniversalWalletContext.Provider>
        );
    }

    return (
        <WagmiProvider config={wagmiConfig}>
            <WalletProvider>
                {children}
            </WalletProvider>
        </WagmiProvider>
    );
};

export const useUniversalWallet = () => useContext( UniversalWalletContext );

/**
 * Detects the current browser/device environment for wallet connection UX.
 * @returns {{ isMobile: boolean, hasInjectedProvider: boolean, isWalletBrowser: boolean }}
 */
export const detectEnvironment = () => {
    if ( typeof window === 'undefined' ) {
        return { isMobile: false, hasInjectedProvider: false, isWalletBrowser: false };
    }
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test( ua );
    const hasInjectedProvider = typeof window.ethereum !== 'undefined';
    const isWalletBrowser = hasInjectedProvider && (
        Boolean( window.ethereum?.isMetaMask ) ||
        Boolean( window.ethereum?.isTrust ) ||
        Boolean( window.ethereum?.isCoinbaseWallet ) ||
        Boolean( window.ethereum?.isTokenPocket )
    );
    return { isMobile, hasInjectedProvider, isWalletBrowser };
};

/**
 * Detects which wallets are available/installed in the current environment.
 * @returns {Array<{id: string, name: string, icon: string, color: string, popular: boolean, installed: boolean, type: string}>}
 */
export const detectAvailableWallets = () => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    const walletDefs = [
        { id: 'metaMask', name: 'MetaMask',        icon: '🦊', color: '#E2761B', popular: true,  detect: () => Boolean( eth?.isMetaMask && !eth?.isCoinbaseWallet ) },
        { id: 'trust',    name: 'Trust Wallet',    icon: '🛡️', color: '#3375BB', popular: true,  detect: () => Boolean( eth?.isTrust ) },
        { id: 'coinbase', name: 'Coinbase Wallet',  icon: '🔵', color: '#0052FF', popular: true,  detect: () => Boolean( eth?.isCoinbaseWallet ) },
        { id: 'walletConnect', name: 'WalletConnect', icon: '🔗', color: '#3B99FC', popular: true, detect: () => false },
        { id: 'okx',      name: 'OKX Wallet',      icon: '⬛', color: '#121212', popular: false, detect: () => Boolean( window?.okxwallet ) },
        { id: 'phantom',  name: 'Phantom',          icon: '👻', color: '#AB9FF2', popular: false, detect: () => Boolean( window?.phantom?.ethereum ) },
        { id: 'token',    name: 'TokenPocket',      icon: '💎', color: '#2980FE', popular: false, detect: () => Boolean( eth?.isTokenPocket ) },
        { id: 'safepal',  name: 'SafePal',          icon: '🔐', color: '#4A6BFF', popular: false, detect: () => Boolean( eth?.isSafePal ) },
    ];
    return walletDefs.map( ( w ) => ( {
        id: w.id,
        name: w.name,
        icon: w.icon,
        color: w.color,
        popular: w.popular,
        installed: w.detect(),
        type: w.id === 'walletConnect' ? 'walletconnect' : 'injected',
    } ) );
};
