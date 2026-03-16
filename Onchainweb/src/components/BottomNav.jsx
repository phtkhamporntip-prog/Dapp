import { useLocation, useNavigate } from 'react-router-dom';

function getActiveTab ( pathname ) {
  if ( pathname.startsWith( '/trade/ai-arbitrage' ) ) return 'ai';
  if ( pathname.startsWith( '/wallet' ) ) return 'wallet';
  if ( pathname.startsWith( '/trade' ) ) return 'trade';
  return 'home';
}

export default function BottomNav () {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab( location.pathname );

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      action: () => navigate( '/' ),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
    {
      id: 'trade',
      label: 'Trade',
      action: () => navigate( '/trade' ),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
          <path d="M8 3L4 6M20 6l-4-3" />
        </svg>
      )
    },
    {
      id: 'ai',
      label: 'AI',
      action: () => navigate( '/trade/ai-arbitrage/invest' ),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v4a4 4 0 0 1-8 0v-4H7a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <path d="M9 15h6" />
        </svg>
      )
    },
    {
      id: 'wallet',
      label: 'Wallet',
      action: () => navigate( '/wallet' ),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
        </svg>
      )
    }
  ];

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map( ( item ) => (
        <button
          key={item.id}
          className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={item.action}
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ) )}
    </nav>
  );
}
