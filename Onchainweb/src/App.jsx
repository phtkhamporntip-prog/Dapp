
// React automatic JSX runtime in use — default React import not required
// BrowserRouter, UniversalWalletProvider, and SpeedInsights are provided by main.jsx
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import Trade from './components/Trade';
import Wallet from './components/Wallet';
import BinaryOptions from './components/BinaryOptions';
import AIArbitrage from './components/AIArbitrage';
import CustomerService from './components/CustomerService';
import BottomNav from './components/BottomNav';
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import WalletGateUniversal from './components/WalletGateUniversal';

function App () {
  return (
    <ErrorBoundary>
      <div className="app-container">
        <Header />
        <main className="main-content" id="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {/* Trading routes require wallet connection */}
            <Route path="/trade" element={
              <WalletGateUniversal>
                <Trade />
              </WalletGateUniversal>
            } />
            <Route path="/trade/binary-options/*" element={
              <WalletGateUniversal>
                <BinaryOptions />
              </WalletGateUniversal>
            } />
            <Route path="/trade/ai-arbitrage/*" element={
              <WalletGateUniversal>
                <AIArbitrage />
              </WalletGateUniversal>
            } />
            {/* Wallet page requires wallet connection */}
            <Route path="/wallet" element={
              <WalletGateUniversal>
                <Wallet isOpen />
              </WalletGateUniversal>
            } />
            <Route path="/customer-service" element={<CustomerService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <BottomNav />
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
