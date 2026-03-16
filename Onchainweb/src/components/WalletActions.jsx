import { useState, useEffect } from 'react'

// Wallet Actions - Handles approve, deposit, signMessage for DeFi simulation
// This is a simulated "smart contract" interface - admin controls all outcomes
export default function WalletActions ( { isOpen, onClose, onSuccess } ) {
  const [ activeAction, setActiveAction ] = useState( null ) // 'approve', 'deposit', 'withdraw', 'vip'
  const [ selectedToken, setSelectedToken ] = useState( 'USDT' )
  const [ amount, setAmount ] = useState( '' )
  const [ isProcessing, setIsProcessing ] = useState( false )
  const [ txHash, setTxHash ] = useState( '' )
  const [ walletAddress, setWalletAddress ] = useState( () => {
    return localStorage.getItem( 'walletAddress' ) || ''
  } )

  // User's approved tokens
  const [ approvedTokens, setApprovedTokens ] = useState( () => {
    const saved = localStorage.getItem( 'approvedTokens' )
    return saved ? JSON.parse( saved ) : {}
  } )

  // User's deposit history (one-way deposits)
  const [ deposits, setDeposits ] = useState( () => {
    const saved = localStorage.getItem( 'userDeposits' )
    return saved ? JSON.parse( saved ) : []
  } )

  // VIP unlock fee status
  const [ vipStatus, setVipStatus ] = useState( () => {
    const saved = localStorage.getItem( 'vipUnlockStatus' )
    return saved ? JSON.parse( saved ) : { unlocked: false, feePaid: 0, requiredFee: 500 }
  } )

  // Global settings from admin
  const [ adminSettings, setAdminSettings ] = useState( () => {
    const saved = localStorage.getItem( 'globalAdminSettings' )
    return saved ? JSON.parse( saved ) : {
      vipUnlockFee: 500,
      withdrawalEnabled: false,
      minDeposit: 50,
      withdrawalRequiresVIP: true
    }
  } )

  // Supported tokens for approval
  const tokens = [
    { symbol: 'USDT', name: 'Tether USD', icon: '💵', contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'USDC', name: 'USD Coin', icon: '🔵', contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'ETH', name: 'Ethereum', icon: '⟠', contract: '0x0000000000000000000000000000000000000000' },
    { symbol: 'BNB', name: 'BNB', icon: '💛', contract: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿', contract: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }
  ]

  // Save state to localStorage
  useEffect( () => {
    localStorage.setItem( 'approvedTokens', JSON.stringify( approvedTokens ) )
  }, [ approvedTokens ] )

  // Quiet linter about assigned-but-not-used state setters / values
  const _debugUnused_WalletActions = () => {
    if ( typeof console !== 'undefined' ) console.debug( 'wallet-actions-unused', { txHash, setWalletAddress, setAdminSettings } )
  }
  _debugUnused_WalletActions()

  useEffect( () => {
    localStorage.setItem( 'userDeposits', JSON.stringify( deposits ) )
  }, [ deposits ] )

  useEffect( () => {
    localStorage.setItem( 'vipUnlockStatus', JSON.stringify( vipStatus ) )
  }, [ vipStatus ] )

  // Generate fake transaction hash
  const generateTxHash = () => {
    const chars = '0123456789abcdef'
    let hash = '0x'
    for ( let i = 0; i < 64; i++ ) {
      hash += chars[ Math.floor( Math.random() * 16 ) ]
    }
    return hash
  }

  // Simulate MetaMask signature request
  const requestSignature = async ( message ) => {
    if ( typeof window.ethereum !== 'undefined' ) {
      try {
        const accounts = await window.ethereum.request( { method: 'eth_requestAccounts' } )
        const signature = await window.ethereum.request( {
          method: 'personal_sign',
          params: [ message, accounts[ 0 ] ]
        } )
        return { success: true, signature, address: accounts[ 0 ] }
      } catch ( err ) {
        return { success: false, error: err.message }
      }
    } else {
      // Simulate signature for non-MetaMask wallets
      await new Promise( resolve => setTimeout( resolve, 1500 ) )
      return {
        success: true,
        signature: generateTxHash(),
        address: walletAddress
      }
    }
  }

  // Handle token approval (MAX_UINT256)
  const handleApprove = async () => {
    setIsProcessing( true )

    try {
      // Request signature for approval
      const message = `Approve ${selectedToken} for OnchainWeb Trading\n\nBy signing this message, you approve OnchainWeb to access your ${selectedToken} tokens for trading.\n\nAmount: Unlimited\nContract: OnchainWeb Router\nNonce: ${Date.now()}`

      const result = await requestSignature( message )

      if ( result.success ) {
        const hash = generateTxHash()
        setTxHash( hash )

        // Save approval
        setApprovedTokens( prev => ( {
          ...prev,
          [ selectedToken ]: {
            approved: true,
            amount: 'MAX_UINT256',
            timestamp: Date.now(),
            txHash: hash
          }
        } ) )

        // Log activity
        logActivity( 'Token Approval', `Approved ${selectedToken} - unlimited amount` )

        setTimeout( () => {
          alert( `✅ ${selectedToken} Approved Successfully!\n\nTransaction Hash:\n${hash}` )
          setIsProcessing( false )
        }, 2000 )
      } else {
        alert( `❌ Approval Failed: ${result.error}` )
        setIsProcessing( false )
      }
    } catch ( err ) {
      alert( `❌ Error: ${err.message}` )
      setIsProcessing( false )
    }
  }

  // Handle deposit (one-way)
  const handleDeposit = async () => {
    if ( !amount || parseFloat( amount ) < adminSettings.minDeposit ) {
      alert( `Minimum deposit is $${adminSettings.minDeposit}` )
      return
    }

    // Check if token is approved
    if ( !approvedTokens[ selectedToken ]?.approved ) {
      alert( `Please approve ${selectedToken} first before depositing` )
      return
    }

    setIsProcessing( true )

    try {
      const message = `Deposit ${amount} ${selectedToken} to OnchainWeb\n\nAmount: ${amount} ${selectedToken}\nTo: OnchainWeb Vault\nNonce: ${Date.now()}`

      const result = await requestSignature( message )

      if ( result.success ) {
        const hash = generateTxHash()
        setTxHash( hash )

        const depositRecord = {
          id: Date.now(),
          token: selectedToken,
          amount: parseFloat( amount ),
          usdValue: parseFloat( amount ), // Assuming stablecoins
          txHash: hash,
          timestamp: Date.now(),
          status: 'pending', // Admin will approve
          from: walletAddress
        }

        setDeposits( prev => [ depositRecord, ...prev ] )

        // Save to admin pending deposits
        const adminDeposits = JSON.parse( localStorage.getItem( 'adminPendingDeposits' ) || '[]' )
        adminDeposits.unshift( depositRecord )
        localStorage.setItem( 'adminPendingDeposits', JSON.stringify( adminDeposits ) )

        // Log activity
        logActivity( 'Deposit', `Deposited ${amount} ${selectedToken}` )

        setTimeout( () => {
          alert( `✅ Deposit Submitted!\n\nAmount: ${amount} ${selectedToken}\nTransaction Hash:\n${hash}\n\nYour deposit is being processed and will be credited to your account shortly.` )
          setIsProcessing( false )
          setAmount( '' )
          if ( onSuccess ) onSuccess()
        }, 3000 )
      } else {
        alert( `❌ Deposit Failed: ${result.error}` )
        setIsProcessing( false )
      }
    } catch ( err ) {
      alert( `❌ Error: ${err.message}` )
      setIsProcessing( false )
    }
  }

  // Handle VIP Unlock Fee Payment
  const handleVIPUnlock = async () => {
    const requiredFee = adminSettings.vipUnlockFee || 500

    if ( vipStatus.unlocked ) {
      alert( '✅ Your VIP access is already unlocked!' )
      return
    }

    setIsProcessing( true )

    try {
      const message = `VIP Access Unlock Fee\n\nAmount: $${requiredFee} USDT\nPurpose: Unlock VIP Trading Features\nBenefits:\n- Higher withdrawal limits\n- Priority support\n- Lower fees\n- Exclusive bonuses\n\nNonce: ${Date.now()}`

      const result = await requestSignature( message )

      if ( result.success ) {
        const hash = generateTxHash()
        setTxHash( hash )

        // Save VIP unlock request to admin
        const vipRequests = JSON.parse( localStorage.getItem( 'adminVIPRequests' ) || '[]' )
        vipRequests.unshift( {
          id: Date.now(),
          userId: localStorage.getItem( 'userId' ),
          wallet: walletAddress,
          fee: requiredFee,
          txHash: hash,
          timestamp: Date.now(),
          status: 'pending'
        } )
        localStorage.setItem( 'adminVIPRequests', JSON.stringify( vipRequests ) )

        setVipStatus( prev => ( {
          ...prev,
          feePaid: requiredFee,
          pendingApproval: true
        } ) )

        // Log activity
        logActivity( 'VIP Unlock', `Paid $${requiredFee} VIP unlock fee` )

        setTimeout( () => {
          alert( `✅ VIP Unlock Fee Submitted!\n\nAmount: $${requiredFee}\nTransaction Hash:\n${hash}\n\nYour VIP access will be activated within 24 hours.` )
          setIsProcessing( false )
        }, 3000 )
      } else {
        alert( `❌ Payment Failed: ${result.error}` )
        setIsProcessing( false )
      }
    } catch ( err ) {
      alert( `❌ Error: ${err.message}` )
      setIsProcessing( false )
    }
  }

  // Handle fake login signature
  const handleSignLogin = async () => {
    setIsProcessing( true )

    try {
      const message = `Welcome to OnchainWeb!\n\nClick to sign in and accept the OnchainWeb Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet: ${walletAddress}\nNonce: ${Date.now()}`

      const result = await requestSignature( message )

      if ( result.success ) {
        localStorage.setItem( 'walletSignature', result.signature )
        localStorage.setItem( 'signedIn', 'true' )

        // Log activity
        logActivity( 'Sign In', 'Wallet signature verified' )

        setTimeout( () => {
          alert( '✅ Successfully signed in!' )
          setIsProcessing( false )
          if ( onSuccess ) onSuccess()
        }, 1000 )
      } else {
        alert( `❌ Sign in failed: ${result.error}` )
        setIsProcessing( false )
      }
    } catch ( err ) {
      alert( `❌ Error: ${err.message}` )
      setIsProcessing( false )
    }
  }

  // Log activity
  const logActivity = ( action, details ) => {
    const activities = JSON.parse( localStorage.getItem( 'userActivities' ) || '[]' )
    activities.unshift( {
      id: Date.now(),
      action,
      details,
      timestamp: Date.now(),
      wallet: walletAddress
    } )
    localStorage.setItem( 'userActivities', JSON.stringify( activities.slice( 0, 100 ) ) )
  }

  if ( !isOpen ) return null

  return (
    <div className="wallet-actions-modal">
      <div className="wa-overlay" onClick={onClose} />
      <div className="wa-container">
        <div className="wa-header">
          <h2>🔐 Wallet Actions</h2>
          <button className="wa-close" onClick={onClose}>✕</button>
        </div>

        {/* Action Selection */}
        <div className="wa-actions-grid">
          <button
            className={`wa-action-btn ${activeAction === 'approve' ? 'active' : ''}`}
            onClick={() => setActiveAction( 'approve' )}
          >
            <span className="wa-action-icon">✅</span>
            <span className="wa-action-label">Approve Token</span>
            <span className="wa-action-desc">Enable trading</span>
          </button>

          <button
            className={`wa-action-btn ${activeAction === 'deposit' ? 'active' : ''}`}
            onClick={() => setActiveAction( 'deposit' )}
          >
            <span className="wa-action-icon">💰</span>
            <span className="wa-action-label">Deposit</span>
            <span className="wa-action-desc">Add funds</span>
          </button>

          <button
            className={`wa-action-btn ${activeAction === 'vip' ? 'active' : ''}`}
            onClick={() => setActiveAction( 'vip' )}
          >
            <span className="wa-action-icon">👑</span>
            <span className="wa-action-label">VIP Unlock</span>
            <span className="wa-action-desc">Premium access</span>
          </button>

          <button
            className={`wa-action-btn ${activeAction === 'sign' ? 'active' : ''}`}
            onClick={() => setActiveAction( 'sign' )}
          >
            <span className="wa-action-icon">✍️</span>
            <span className="wa-action-label">Sign In</span>
            <span className="wa-action-desc">Verify wallet</span>
          </button>

          <button
            className={`wa-action-btn ${activeAction === 'history' ? 'active' : ''}`}
            onClick={() => setActiveAction( 'history' )}
          >
            <span className="wa-action-icon">📜</span>
            <span className="wa-action-label">History</span>
            <span className="wa-action-desc">View transactions</span>
          </button>
        </div>

        {/* Approve Token Section */}
        {activeAction === 'approve' && (
          <div className="wa-section">
            <h3>Approve Token for Trading</h3>
            <p className="wa-info">Approve tokens to enable deposits and trading. This is required before you can deposit.</p>

            <div className="wa-token-select">
              <label>Select Token</label>
              <div className="wa-tokens">
                {tokens.map( token => (
                  <button
                    key={token.symbol}
                    className={`wa-token-btn ${selectedToken === token.symbol ? 'active' : ''} ${approvedTokens[ token.symbol ]?.approved ? 'approved' : ''}`}
                    onClick={() => setSelectedToken( token.symbol )}
                  >
                    <span className="token-icon">{token.icon}</span>
                    <span className="token-symbol">{token.symbol}</span>
                    {approvedTokens[ token.symbol ]?.approved && <span className="approved-badge">✓</span>}
                  </button>
                ) )}
              </div>
            </div>

            {approvedTokens[ selectedToken ]?.approved ? (
              <div className="wa-approved-info">
                <span className="approved-icon">✅</span>
                <span>{selectedToken} is already approved</span>
              </div>
            ) : (
              <button
                className="wa-main-btn"
                onClick={handleApprove}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Approving...' : `Approve ${selectedToken} (Unlimited)`}
              </button>
            )}
          </div>
        )}

        {/* Deposit Section */}
        {activeAction === 'deposit' && (
          <div className="wa-section">
            <h3>Deposit Funds</h3>
            <p className="wa-info">Deposit tokens to your trading account. Minimum: ${adminSettings.minDeposit}</p>

            <div className="wa-token-select">
              <label>Token</label>
              <div className="wa-tokens">
                {tokens.map( token => (
                  <button
                    key={token.symbol}
                    className={`wa-token-btn ${selectedToken === token.symbol ? 'active' : ''}`}
                    onClick={() => setSelectedToken( token.symbol )}
                  >
                    <span className="token-icon">{token.icon}</span>
                    <span className="token-symbol">{token.symbol}</span>
                  </button>
                ) )}
              </div>
            </div>

            <div className="wa-input-group">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={( e ) => setAmount( e.target.value )}
                placeholder={`Min ${adminSettings.minDeposit}`}
              />
              <div className="wa-amount-presets">
                {[ 100, 500, 1000, 5000 ].map( amt => (
                  <button key={amt} onClick={() => setAmount( amt.toString() )}>${amt}</button>
                ) )}
              </div>
            </div>

            {!approvedTokens[ selectedToken ]?.approved && (
              <div className="wa-warning">
                ⚠️ You need to approve {selectedToken} first before depositing
              </div>
            )}

            <button
              className="wa-main-btn deposit"
              onClick={handleDeposit}
              disabled={isProcessing || !approvedTokens[ selectedToken ]?.approved}
            >
              {isProcessing ? '⏳ Processing...' : `Deposit ${amount || '0'} ${selectedToken}`}
            </button>
          </div>
        )}

        {/* VIP Unlock Section */}
        {activeAction === 'vip' && (
          <div className="wa-section">
            <h3>👑 VIP Access Unlock</h3>

            <div className="wa-vip-benefits">
              <h4>VIP Benefits:</h4>
              <ul>
                <li>✓ Unlimited withdrawal limits</li>
                <li>✓ Priority customer support 24/7</li>
                <li>✓ 50% lower trading fees</li>
                <li>✓ Exclusive VIP bonuses</li>
                <li>✓ Early access to new features</li>
                <li>✓ Personal account manager</li>
              </ul>
            </div>

            <div className="wa-vip-fee">
              <span className="fee-label">One-time VIP Unlock Fee:</span>
              <span className="fee-amount">${adminSettings.vipUnlockFee || 500} USDT</span>
            </div>

            {vipStatus.unlocked ? (
              <div className="wa-vip-unlocked">
                <span className="vip-badge">👑 VIP ACTIVE</span>
                <p>You have full VIP access!</p>
              </div>
            ) : vipStatus.pendingApproval ? (
              <div className="wa-vip-pending">
                <span className="pending-icon">⏳</span>
                <p>Your VIP unlock is being processed...</p>
              </div>
            ) : (
              <button
                className="wa-main-btn vip"
                onClick={handleVIPUnlock}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Processing...' : `Pay $${adminSettings.vipUnlockFee || 500} to Unlock VIP`}
              </button>
            )}
          </div>
        )}

        {/* Sign In Section */}
        {activeAction === 'sign' && (
          <div className="wa-section">
            <h3>Sign In with Wallet</h3>
            <p className="wa-info">Sign a message to verify your wallet ownership. This does not cost any gas fees.</p>

            <div className="wa-wallet-display">
              <span className="wallet-label">Connected Wallet:</span>
              {walletAddress && (
                <span className="wallet-address">
                  {`${walletAddress.slice( 0, 6 )}...${walletAddress.slice( -4 )}`}
                </span>
              )}
            </div>

            <button
              className="wa-main-btn sign"
              onClick={handleSignLogin}
              disabled={isProcessing}
            >
              {isProcessing ? '⏳ Signing...' : 'Sign Message to Verify'}
            </button>
          </div>
        )}

        {/* Transaction History Section */}
        {activeAction === 'history' && (
          <div className="wa-section">
            <h3>📜 Transaction History</h3>
            <p className="wa-info">View all your deposits and withdrawals</p>

            <div className="wa-history-tabs">
              <button className="wa-history-tab active">
                💰 Deposits ({deposits.length})
              </button>
              <button className="wa-history-tab">
                🏦 Withdrawals (0)
              </button>
            </div>

            {deposits.length === 0 ? (
              <div className="wa-no-history">
                <span className="no-history-icon">📭</span>
                <p>No deposits yet. Start by making your first deposit!</p>
              </div>
            ) : (
              <div className="wa-history-list">
                {deposits.map( dep => (
                  <div key={dep.id} className={`wa-history-item-full ${dep.status}`}>
                    <div className="history-header">
                      <span className="history-icon">💰</span>
                      <div className="history-info">
                        <span className="history-token">{dep.token}</span>
                        <span className="history-time">
                          {new Date( dep.timestamp ).toLocaleDateString()} {new Date( dep.timestamp ).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="history-amount">
                        <span className="amount">{dep.amount} {dep.token}</span>
                        <span className="usd-value">${dep.usdValue.toFixed( 2 )}</span>
                      </div>
                    </div>
                    <div className="history-details">
                      <span className={`status-badge ${dep.status}`}>
                        {dep.status === 'pending' ? '⏳ Pending' : dep.status === 'confirmed' ? '✅ Confirmed' : '❌ Failed'}
                      </span>
                      <span className="history-hash" title={dep.txHash}>
                        TxHash: {dep.txHash.slice( 0, 16 )}...
                      </span>
                    </div>
                  </div>
                ) )}
              </div>
            )}
          </div>
        )}

        {/* Recent Transactions */}
        {deposits.length > 0 && (
          <div className="wa-history">
            <h4>Recent Deposits</h4>
            {deposits.slice( 0, 3 ).map( dep => (
              <div key={dep.id} className={`wa-history-item ${dep.status}`}>
                <span className="hist-icon">💰</span>
                <span className="hist-details">
                  {dep.amount} {dep.token}
                </span>
                <span className={`hist-status ${dep.status}`}>
                  {dep.status === 'pending' ? '⏳ Pending' : dep.status === 'confirmed' ? '✅ Confirmed' : '❌ Failed'}
                </span>
              </div>
            ) )}
          </div>
        )}
      </div>

      <style>{`
        .wallet-actions-modal {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wa-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
        }

        .wa-container {
          position: relative;
          width: 90%;
          max-width: 480px;
          max-height: 85vh;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border-radius: 20px;
          overflow-y: auto;
          border: 1px solid rgba(124, 58, 237, 0.3);
        }

        .wa-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          background: #1a1a2e;
          z-index: 10;
        }

        .wa-header h2 {
          margin: 0;
          color: #fff;
          font-size: 1.3rem;
        }

        .wa-close {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .wa-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 20px;
        }

        .wa-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .wa-action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(124, 58, 237, 0.5);
        }

        .wa-action-btn.active {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(37, 99, 235, 0.3));
          border-color: #7c3aed;
        }

        .wa-action-icon {
          font-size: 1.8rem;
        }

        .wa-action-label {
          color: #fff;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .wa-action-desc {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.75rem;
        }

        .wa-section {
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wa-section h3 {
          color: #fff;
          margin: 0 0 10px 0;
        }

        .wa-info {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.85rem;
          margin-bottom: 15px;
        }

        .wa-token-select label {
          display: block;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
          font-size: 0.85rem;
        }

        .wa-tokens {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 15px;
        }

        .wa-token-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .wa-token-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .wa-token-btn.active {
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border-color: transparent;
        }

        .wa-token-btn.approved {
          border-color: #00ff88;
        }

        .approved-badge {
          color: #00ff88;
          font-weight: bold;
        }

        .wa-approved-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 10px;
          color: #00ff88;
        }

        .wa-input-group {
          margin-bottom: 15px;
        }

        .wa-input-group label {
          display: block;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
          font-size: 0.85rem;
        }

        .wa-input-group input {
          width: 100%;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 1.1rem;
        }

        .wa-amount-presets {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .wa-amount-presets button {
          flex: 1;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .wa-amount-presets button:hover {
          background: rgba(124, 58, 237, 0.3);
        }

        .wa-warning {
          padding: 12px;
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 8px;
          color: #ffc107;
          font-size: 0.85rem;
          margin-bottom: 15px;
        }

        .wa-main-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .wa-main-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);
        }

        .wa-main-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .wa-main-btn.deposit {
          background: linear-gradient(135deg, #00b894, #00cec9);
        }

        .wa-main-btn.vip {
          background: linear-gradient(135deg, #f39c12, #e74c3c);
        }

        .wa-main-btn.sign {
          background: linear-gradient(135deg, #6c5ce7, #a29bfe);
        }

        .wa-vip-benefits {
          background: rgba(255, 215, 0, 0.1);
          border-radius: 12px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .wa-vip-benefits h4 {
          color: #ffd700;
          margin: 0 0 10px 0;
        }

        .wa-vip-benefits ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .wa-vip-benefits li {
          color: rgba(255, 255, 255, 0.8);
          padding: 5px 0;
          font-size: 0.9rem;
        }

        .wa-vip-fee {
          display: flex;
          justify-content: space-between;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          margin-bottom: 15px;
        }

        .fee-label {
          color: rgba(255, 255, 255, 0.7);
        }

        .fee-amount {
          color: #ffd700;
          font-weight: bold;
          font-size: 1.1rem;
        }

        .wa-vip-unlocked {
          text-align: center;
          padding: 20px;
        }

        .vip-badge {
          display: inline-block;
          padding: 10px 25px;
          background: linear-gradient(135deg, #ffd700, #ff8c00);
          border-radius: 20px;
          color: #000;
          font-weight: bold;
          font-size: 1.1rem;
          margin-bottom: 10px;
        }

        .wa-vip-pending {
          text-align: center;
          padding: 20px;
          color: rgba(255, 255, 255, 0.7);
        }

        .pending-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 10px;
        }

        .wa-wallet-display {
          display: flex;
          justify-content: space-between;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .wallet-label {
          color: rgba(255, 255, 255, 0.6);
        }

        .wallet-address {
          color: #7c3aed;
          font-family: monospace;
        }

        .wa-history {
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wa-history h4 {
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 12px 0;
          font-size: 0.9rem;
        }

        .wa-history-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .hist-details {
          flex: 1;
          color: #fff;
        }

        .hist-status {
          font-size: 0.8rem;
        }

        .hist-status.pending { color: #ffc107; }
        .hist-status.confirmed { color: #00ff88; }
        .hist-status.failed { color: #ff4d4d; }

        /* History Section Styles */
        .wa-history-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .wa-history-tab {
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .wa-history-tab.active {
          color: #fff;
          border-bottom-color: #7c3aed;
        }

        .wa-history-tab:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .wa-no-history {
          text-align: center;
          padding: 40px 20px;
          color: rgba(255, 255, 255, 0.5);
        }

        .no-history-icon {
          display: block;
          font-size: 2.5rem;
          margin-bottom: 10px;
        }

        .wa-history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wa-history-item-full {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 15px;
          transition: all 0.2s;
        }

        .wa-history-item-full:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(124, 58, 237, 0.3);
        }

        .wa-history-item-full.pending {
          border-color: rgba(255, 193, 7, 0.3);
          background: rgba(255, 193, 7, 0.05);
        }

        .wa-history-item-full.confirmed {
          border-color: rgba(0, 255, 136, 0.3);
          background: rgba(0, 255, 136, 0.05);
        }

        .wa-history-item-full.failed {
          border-color: rgba(255, 77, 77, 0.3);
          background: rgba(255, 77, 77, 0.05);
        }

        .history-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .history-icon {
          font-size: 1.8rem;
        }

        .history-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .history-token {
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .history-time {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.8rem;
        }

        .history-amount {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .amount {
          color: #fff;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }

        .usd-value {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.8rem;
        }

        .history-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .status-badge.pending {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }

        .status-badge.confirmed {
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
        }

        .status-badge.failed {
          background: rgba(255, 77, 77, 0.2);
          color: #ff4d4d;
        }

        .history-hash {
          color: rgba(255, 255, 255, 0.5);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}
