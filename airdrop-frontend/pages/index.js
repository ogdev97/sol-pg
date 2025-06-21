import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Program, AnchorProvider, web3, utils, BN } from '@project-serum/anchor';

// Configuration
const AIRDROP_PROGRAM_ID = new PublicKey('RoQZsTPSQyMVeMfWR2NxCaJD1ui781GE77JJtoz2dw8');
const TOKEN_MINT = new PublicKey('GhwmuvByp2WMDypvxBE8ZBVNiUiT43Zb6FvMABC3Lwgh');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Mock IDL - you can generate this from your program
const IDL = {
  "version": "0.1.0",
  "name": "airdrop_program",
  "instructions": [
    {
      "name": "claim",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "claimStatus",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "ClaimStatus",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claimed",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "AlreadyClaimed",
      "msg": "You have already claimed the airdrop"
    }
  ]
};

export default function Home() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [vaultInfo, setVaultInfo] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('');
  const [vaultStatus, setVaultStatus] = useState('');

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check network connection
  useEffect(() => {
    if (mounted && connection) {
      checkNetworkConnection();
    }
  }, [mounted, connection]);

  // Check vault status
  useEffect(() => {
    if (mounted && connection) {
      checkVaultStatus();
    }
  }, [mounted, connection]);

  const checkNetworkConnection = async () => {
    try {
      const version = await connection.getVersion();
      setNetworkStatus(`Connected to Testnet (Version: ${version['solana-core']})`);
    } catch (error) {
      setNetworkStatus('Failed to connect to Testnet');
      console.error('Network connection error:', error);
    }
  };

  const checkVaultStatus = async () => {
    try {
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault')],
        AIRDROP_PROGRAM_ID
      );

      const vaultTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        vaultPDA,
        true
      );

      const vaultInfo = await connection.getAccountInfo(vaultTokenAccount);
      
      if (vaultInfo) {
        // Get token balance
        const { getAccount } = await import('@solana/spl-token');
        const vaultAccount = await getAccount(connection, vaultTokenAccount);
        const balance = Number(vaultAccount.amount) / 1000000; // Convert from lamports to tokens
        
        setVaultStatus(`✅ Vault Ready (${balance.toLocaleString()} MAT available)`);
        setVaultInfo({
          vaultPDA: vaultPDA.toString(),
          vaultTokenAccount: vaultTokenAccount.toString(),
          balance: balance
        });
      } else {
        setVaultStatus('❌ Vault not set up');
        setVaultInfo(null);
      }
    } catch (error) {
      console.error('Error checking vault status:', error);
      setVaultStatus('❌ Error checking vault');
      setVaultInfo(null);
    }
  };

  // Initialize program
  useEffect(() => {
    if (mounted && publicKey && connection && window.solana) {
      try {
        const provider = new AnchorProvider(connection, window.solana, {
          commitment: 'confirmed',
        });
        const program = new Program(IDL, AIRDROP_PROGRAM_ID, provider);
        setProgram(program);
      } catch (error) {
        console.error('Error initializing program:', error);
      }
    }
  }, [mounted, publicKey, connection]);

  // Check if user has already claimed
  useEffect(() => {
    if (mounted && program && publicKey) {
      checkClaimStatus();
    }
  }, [mounted, program, publicKey]);

  const checkClaimStatus = async () => {
    try {
      const [claimStatusPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('claim'), publicKey.toBuffer()],
        AIRDROP_PROGRAM_ID
      );

      const claimStatusAccount = await program.account.claimStatus.fetch(claimStatusPDA);
      setClaimed(claimStatusAccount.claimed);
      
      if (claimStatusAccount.claimed) {
        setStatus('You have already claimed the airdrop!');
      } else {
        setStatus('You are eligible to claim the airdrop!');
      }
    } catch (error) {
      // Account doesn't exist yet, user hasn't claimed
      setClaimed(false);
      setStatus('You are eligible to claim the airdrop!');
    }
  };

  const getVaultInfo = async () => {
    try {
      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault')],
        AIRDROP_PROGRAM_ID
      );

      const [vaultAuthorityPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault')],
        AIRDROP_PROGRAM_ID
      );

      const vaultTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        vaultPDA,
        true
      );

      setVaultInfo({
        vaultPDA: vaultPDA.toString(),
        vaultAuthorityPDA: vaultAuthorityPDA.toString(),
        vaultTokenAccount: vaultTokenAccount.toString()
      });
    } catch (error) {
      console.error('Error getting vault info:', error);
    }
  };

  const claimAirdrop = async () => {
    if (!mounted) return;
    
    if (!program || !publicKey) {
      setStatus('Please connect your wallet first.');
      return;
    }

    if (claimed) {
      setStatus('You have already claimed the airdrop!');
      return;
    }

    setLoading(true);
    setStatus('Preparing airdrop claim...');

    try {
      // Get PDAs
      const [claimStatusPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('claim'), publicKey.toBuffer()],
        AIRDROP_PROGRAM_ID
      );

      const [vaultPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault')],
        AIRDROP_PROGRAM_ID
      );

      const [vaultAuthorityPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault')],
        AIRDROP_PROGRAM_ID
      );

      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        publicKey
      );

      // Get vault token account
      const vaultTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        vaultPDA,
        true
      );

      // Verify vault exists and has tokens
      setStatus('Verifying vault...');
      const vaultInfo = await connection.getAccountInfo(vaultTokenAccount);
      if (!vaultInfo) {
        throw new Error('Vault is not set up. Please contact the administrator.');
      }

      // Check if user token account exists
      const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      
      if (!userTokenAccountInfo) {
        // Create user token account first using a separate transaction
        setStatus('Creating your token account...');
        
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
        const { Transaction } = await import('@solana/web3.js');
        
        const createAccountTx = new Transaction();
        const createUserAccountIx = createAssociatedTokenAccountInstruction(
          publicKey,
          userTokenAccount,
          publicKey,
          TOKEN_MINT
        );
        createAccountTx.add(createUserAccountIx);
        
        // Get recent blockhash and send
        const { blockhash } = await connection.getLatestBlockhash();
        createAccountTx.recentBlockhash = blockhash;
        createAccountTx.feePayer = publicKey;
        
        const createSignature = await window.solana.signAndSendTransaction(createAccountTx);
        await connection.confirmTransaction(createSignature.signature, 'confirmed');
        
        setStatus('Token account created! Now claiming airdrop...');
        
        // Wait a moment for the account to be fully created
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Now claim the airdrop
      setStatus('Claiming your airdrop...');
      
      const tx = await program.methods
        .claim()
        .accounts({
          user: publicKey,
          claimStatus: claimStatusPDA,
          userTokenAccount: userTokenAccount,
          vault: vaultTokenAccount,
          vaultAuthority: vaultAuthorityPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          mint: TOKEN_MINT,
        })
        .rpc({ commitment: 'confirmed' });

      setClaimed(true);
      setStatus(`🎉 Airdrop claimed successfully! You received 10 MAT tokens. Transaction: ${tx}`);
      
      // Refresh claim status
      setTimeout(() => {
        checkClaimStatus();
      }, 1000);

    } catch (error) {
      console.error('Error claiming airdrop:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to claim airdrop. ';
      
      if (error.message.includes('Vault is not set up')) {
        errorMessage += 'The airdrop vault is not properly configured.';
      } else if (error.message.includes('AlreadyClaimed')) {
        errorMessage += 'You have already claimed this airdrop.';
        setClaimed(true);
      } else if (error.message.includes('insufficient funds')) {
        errorMessage += 'Insufficient SOL for transaction fees. Please add some SOL to your wallet.';
      } else if (error.message.includes('blockhash')) {
        errorMessage += 'Network issue. Please try again.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ color: '#333', marginBottom: '30px' }}>🎁 Solana Token Airdrop</h1>
        
        {/* Network Status */}
        {networkStatus && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '8px 16px',
            backgroundColor: networkStatus.includes('Failed') ? '#f8d7da' : '#d4edda',
            color: networkStatus.includes('Failed') ? '#721c24' : '#155724',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            🌐 {networkStatus}
          </div>
        )}
        
        {/* Vault Status */}
        {vaultStatus && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '8px 16px',
            backgroundColor: vaultStatus.includes('❌') ? '#f8d7da' : '#d4edda',
            color: vaultStatus.includes('❌') ? '#721c24' : '#155724',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            🏦 {vaultStatus}
          </div>
        )}
        
        <div style={{ marginBottom: '20px' }}>
          <WalletMultiButton />
        </div>

        {connected && publicKey && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '10px', 
            backgroundColor: '#e9ecef', 
            borderRadius: '8px',
            fontSize: '14px',
            wordBreak: 'break-all'
          }}>
            <strong>Wallet:</strong> {publicKey.toBase58()}
          </div>
        )}

        {connected && publicKey && !claimed && vaultStatus && !vaultStatus.includes('❌') && (
          <button 
            onClick={claimAirdrop} 
            disabled={loading}
            style={{ 
              margin: '10px', 
              padding: '15px 30px',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Processing...' : '🎁 Claim 10 MAT Tokens'}
          </button>
        )}

        {connected && publicKey && vaultStatus && vaultStatus.includes('❌') && (
          <div style={{ 
            margin: '20px 0',
            padding: '15px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderRadius: '8px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            ⚠️ Airdrop vault is not set up yet. Please wait for the administrator to configure the vault.
          </div>
        )}

        {claimed && (
          <div style={{ 
            color: '#28a745', 
            fontSize: '18px',
            fontWeight: 'bold',
            margin: '20px 0',
            textAlign: 'center'
          }}>
            ✅ Airdrop Claimed Successfully!
          </div>
        )}

        {status && (
          <div style={{ 
            margin: '20px 0',
            padding: '15px',
            backgroundColor: status.includes('🎉') ? '#d4edda' : status.includes('Error') ? '#f8d7da' : '#d1ecf1',
            color: status.includes('🎉') ? '#155724' : status.includes('Error') ? '#721c24' : '#0c5460',
            borderRadius: '8px',
            fontSize: '14px',
            wordBreak: 'break-all'
          }}>
            {status}
          </div>
        )}

        <div style={{ 
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Program Information</h3>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            <p><strong>Program ID:</strong> {AIRDROP_PROGRAM_ID.toString()}</p>
            <p><strong>Token Mint:</strong> {TOKEN_MINT.toString()}</p>
            <p><strong>Network:</strong> Testnet</p>
            <p><strong>Airdrop Amount:</strong> 10 MAT tokens</p>
            <p><strong>Endpoint:</strong> https://api.testnet.solana.com</p>
          </div>
        </div>
      </div>
    </div>
  );
} 