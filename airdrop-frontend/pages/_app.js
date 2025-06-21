import '../styles/globals.css';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';

// Import wallet adapter styles
require('@solana/wallet-adapter-react-ui/styles.css');

// Dynamically import the main component to prevent hydration issues
const Home = dynamic(() => import('./index'), {
  ssr: false,
  loading: () => <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '18px'
  }}>Loading...</div>
});

function MyApp({ Component, pageProps }) {
  const network = WalletAdapterNetwork.Testnet;
  const endpoint = useMemo(() => 'https://api.testnet.solana.com', []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Home {...pageProps} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default MyApp; 