import { Link } from 'react-router-dom';

export default function Trade () {
    return (
        <div className="trade-hub">
            <header className="trade-hub-header">
                <h1>Trade Center</h1>
                <p>Open Binary Options or AI Arbitrage from here. The only tab-style navigation in the app stays in the bottom app bar.</p>
            </header>

            <section className="trade-hub-grid">
                <article className="trade-hub-card">
                    <h2>Binary Options</h2>
                    <p>Admin-controlled trade levels using live market prices and live settlement checks.</p>
                    <div className="trade-hub-links">
                        <Link to="/trade/binary-options/new">Open Binary Options</Link>
                        <Link to="/trade/binary-options/active">View Active Binary Trades</Link>
                        <Link to="/trade/binary-options/history">View Binary History</Link>
                    </div>
                </article>

                <article className="trade-hub-card">
                    <h2>AI Arbitrage</h2>
                    <p>Admin-controlled investment levels gated by real-time market momentum and live cycle tracking.</p>
                    <div className="trade-hub-links">
                        <Link to="/trade/ai-arbitrage/invest">Open AI Arbitrage</Link>
                        <Link to="/trade/ai-arbitrage/active">View Active AI Cycles</Link>
                        <Link to="/trade/ai-arbitrage/history">View AI History</Link>
                    </div>
                </article>
            </section>

            <style>{`
        .trade-hub {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px;
          color: #e8edf7;
        }
        .trade-hub-header h1 {
          margin: 0 0 8px 0;
        }
        .trade-hub-header p {
          margin: 0;
          color: #9fb0c8;
        }
        .trade-hub-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 20px;
        }
        .trade-hub-card {
          background: #0f1828;
          border: 1px solid #2a3c5b;
          border-radius: 12px;
          padding: 16px;
        }
        .trade-hub-card h2 {
          margin: 0 0 8px 0;
        }
        .trade-hub-card p {
          margin: 0 0 12px 0;
          color: #9fb0c8;
        }
        .trade-hub-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .trade-hub-links a {
          text-decoration: none;
          color: #cce7ff;
          border: 1px solid #35517b;
          background: #14233c;
          border-radius: 8px;
          padding: 10px;
          font-weight: 600;
        }
        .trade-hub-links a:hover {
          border-color: #3b82f6;
          background: #193257;
        }
        @media (max-width: 900px) {
          .trade-hub-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
}
