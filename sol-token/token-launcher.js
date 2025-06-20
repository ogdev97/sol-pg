// Pure JavaScript Solana Token Launcher - No CLI Required!
// Just run: npm install @solana/web3.js @solana/spl-token

const {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    clusterApiUrl,
    LAMPORTS_PER_SOL,
  } = require('@solana/web3.js');
  
  const {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getMint,
    getAccount,
    transfer,
    createSetAuthorityInstruction,
    AuthorityType,
  } = require('@solana/spl-token');
  
  const fs = require('fs');
  const path = require('path');
  
  // Token Configuration - CUSTOMIZE THESE!
  const TOKEN_CONFIG = {
    name: "My Awesome Token",
    symbol: "MAT",
    description: "A sample token created on Solana testnet",
    decimals: 6,
    initialSupply: 1000000, // 1 million tokens
    network: 'testnet' // 'testnet' or 'mainnet-beta'
  };
  
  class SolanaTokenLauncher {
    constructor() {
      this.connection = new Connection(clusterApiUrl(TOKEN_CONFIG.network), 'confirmed');
      this.walletPath = 'solana-wallet.json';
      this.tokenInfoPath = 'token-info.json';
    }
  
    // Create or load wallet
    async setupWallet() {
      let wallet;
      
      if (fs.existsSync(this.walletPath)) {
        console.log('📁 Loading existing wallet...');
        const secretKey = JSON.parse(fs.readFileSync(this.walletPath, 'utf8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
      } else {
        console.log('🔑 Creating new wallet...');
        wallet = Keypair.generate();
        fs.writeFileSync(this.walletPath, JSON.stringify(Array.from(wallet.secretKey)));
        console.log('✅ New wallet created and saved to', this.walletPath);
      }
  
      console.log('Wallet Address:', wallet.publicKey.toString());
      return wallet;
    }
  
    // Check and request SOL if needed
    async checkBalance(wallet) {
      const balance = await this.connection.getBalance(wallet.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`💰 Current balance: ${solBalance.toFixed(4)} SOL`);
  
      if (TOKEN_CONFIG.network === 'testnet' && balance < 0.01 * LAMPORTS_PER_SOL) {
        console.log('🚰 Requesting testnet SOL airdrop...');
        try {
          // Request airdrop
          const airdropSignature = await this.connection.requestAirdrop(
            wallet.publicKey,
            2 * LAMPORTS_PER_SOL
          );
          
          await this.connection.confirmTransaction(airdropSignature);
          
          const newBalance = await this.connection.getBalance(wallet.publicKey);
          console.log(`✅ Airdrop successful! New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        } catch (error) {
          console.log('❌ Airdrop failed. Please get testnet SOL from: https://faucet.solana.com/');
          console.log(`Send SOL to: ${wallet.publicKey.toString()}`);
          return false;
        }
      }
  
      return balance >= 0.01 * LAMPORTS_PER_SOL;
    }
  
    // Create the SPL token
    async createToken(wallet) {
      console.log('\n🚀 Creating SPL Token...');
      console.log(`Name: ${TOKEN_CONFIG.name}`);
      console.log(`Symbol: ${TOKEN_CONFIG.symbol}`);
      console.log(`Decimals: ${TOKEN_CONFIG.decimals}`);
      console.log(`Initial Supply: ${TOKEN_CONFIG.initialSupply.toLocaleString()}`);
  
      try {
        // Create mint
        const mint = await createMint(
          this.connection,
          wallet,              // Payer
          wallet.publicKey,    // Mint authority
          wallet.publicKey,    // Freeze authority (optional)
          TOKEN_CONFIG.decimals // Decimals
        );
  
        console.log('✅ Token mint created!');
        console.log('🏷️  Mint Address:', mint.toString());
  
        return mint;
      } catch (error) {
        console.error('❌ Failed to create token:', error.message);
        throw error;
      }
    }
  
    // Create token account and mint initial supply
    async mintInitialSupply(wallet, mint) {
      console.log('\n💰 Creating token account and minting initial supply...');
  
      try {
        // Create associated token account
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          wallet,
          mint,
          wallet.publicKey
        );
  
        console.log('✅ Token account created:', tokenAccount.address.toString());
  
        // Mint initial supply
        const mintAmount = TOKEN_CONFIG.initialSupply * Math.pow(10, TOKEN_CONFIG.decimals);
        
        const signature = await mintTo(
          this.connection,
          wallet,
          mint,
          tokenAccount.address,
          wallet.publicKey,
          mintAmount
        );
  
        console.log('✅ Initial supply minted!');
        console.log('📋 Transaction signature:', signature);
  
        return tokenAccount;
      } catch (error) {
        console.error('❌ Failed to mint tokens:', error.message);
        throw error;
      }
    }
  
    // Get token information
    async getTokenInfo(mint, tokenAccount) {
      const mintInfo = await getMint(this.connection, mint);
      const accountInfo = await getAccount(this.connection, tokenAccount.address);
  
      return {
        mintAddress: mint.toString(),
        tokenAccountAddress: tokenAccount.address.toString(),
        decimals: mintInfo.decimals,
        totalSupply: mintInfo.supply.toString(),
        balance: accountInfo.amount.toString(),
        mintAuthority: mintInfo.mintAuthority?.toString(),
        freezeAuthority: mintInfo.freezeAuthority?.toString()
      };
    }
  
    // Save token information
    saveTokenInfo(wallet, tokenInfo) {
      const fullTokenInfo = {
        ...TOKEN_CONFIG,
        ...tokenInfo,
        walletAddress: wallet.publicKey.toString(),
        createdAt: new Date().toISOString(),
        network: TOKEN_CONFIG.network
      };
  
      fs.writeFileSync(this.tokenInfoPath, JSON.stringify(fullTokenInfo, null, 2));
      console.log('💾 Token information saved to', this.tokenInfoPath);
      
      return fullTokenInfo;
    }
  
    // Main launch function
    async launch() {
      console.log('🎯 Solana Token Launcher Starting...');
      console.log('==================================\n');
  
      try {
        // Setup wallet
        const wallet = await this.setupWallet();
  
        // Check balance
        const hasBalance = await this.checkBalance(wallet);
        if (!hasBalance) {
          console.log('\n❌ Insufficient balance. Please add SOL to your wallet and try again.');
          return;
        }
  
        // Create token
        const mint = await this.createToken(wallet);
  
        // Mint initial supply
        const tokenAccount = await this.mintInitialSupply(wallet, mint);
  
        // Get token info
        const tokenInfo = await this.getTokenInfo(mint, tokenAccount);
  
        // Save information
        const fullTokenInfo = this.saveTokenInfo(wallet, tokenInfo);
  
        // Success summary
        console.log('\n🎉 TOKEN LAUNCH SUCCESSFUL! 🎉');
        console.log('=====================================');
        console.log('📊 Token Details:');
        console.log(`   Name: ${TOKEN_CONFIG.name} (${TOKEN_CONFIG.symbol})`);
        console.log(`   Mint Address: ${tokenInfo.mintAddress}`);
        console.log(`   Your Token Account: ${tokenInfo.tokenAccountAddress}`);
        console.log(`   Total Supply: ${(tokenInfo.totalSupply / Math.pow(10, TOKEN_CONFIG.decimals)).toLocaleString()}`);
        console.log(`   Your Balance: ${(tokenInfo.balance / Math.pow(10, TOKEN_CONFIG.decimals)).toLocaleString()}`);
        console.log(`   Network: ${TOKEN_CONFIG.network}`);
  
        console.log('\n📝 Next Steps:');
        console.log('1. Add token metadata with Metaplex');
        console.log('2. Test token transfers');
        console.log('3. Consider removing mint authority for fixed supply');
        console.log('4. Add token to wallets using the mint address');
  
        if (TOKEN_CONFIG.network === 'testnet') {
          console.log('\n🧪 Testnet URLs:');
          console.log(`   Solana Explorer: https://explorer.solana.com/address/${tokenInfo.mintAddress}?cluster=testnet`);
          console.log(`   Solscan: https://solscan.io/token/${tokenInfo.mintAddress}?cluster=testnet`);
        }
  
        return fullTokenInfo;
  
      } catch (error) {
        console.error('\n❌ Token launch failed:', error.message);
        console.error('Full error:', error);
      }
    }
  
    // Transfer tokens to another address
    async transferTokens(recipientAddress, amount) {
      console.log(`\n💸 Transferring ${amount} tokens to ${recipientAddress}...`);
  
      try {
        const wallet = await this.setupWallet();
        const tokenInfo = JSON.parse(fs.readFileSync(this.tokenInfoPath, 'utf8'));
        const mint = new PublicKey(tokenInfo.mintAddress);
        const recipient = new PublicKey(recipientAddress);
  
        // Get sender's token account
        const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          wallet,
          mint,
          wallet.publicKey
        );
  
        // Get or create recipient's token account
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          wallet, // Payer for account creation
          mint,
          recipient
        );
  
        // Transfer tokens
        const transferAmount = amount * Math.pow(10, tokenInfo.decimals);
        
        const signature = await transfer(
          this.connection,
          wallet,
          senderTokenAccount.address,
          recipientTokenAccount.address,
          wallet.publicKey,
          transferAmount
        );
  
        console.log(`✅ Transfer successful!`);
        console.log(`📋 Transaction signature: ${signature}`);
  
      } catch (error) {
        console.error('❌ Transfer failed:', error.message);
      }
    }
  
    // Disable minting (make supply fixed)
    async disableMinting() {
      console.log('\n🔒 Disabling minting (making supply fixed)...');
  
      try {
        const wallet = await this.setupWallet();
        const tokenInfo = JSON.parse(fs.readFileSync(this.tokenInfoPath, 'utf8'));
        const mint = new PublicKey(tokenInfo.mintAddress);
  
        const transaction = new Transaction().add(
          createSetAuthorityInstruction(
            mint,                    // mint
            wallet.publicKey,        // current authority
            AuthorityType.MintTokens, // authority type
            null                     // new authority (null = disable)
          )
        );
  
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [wallet]
        );
  
        console.log('✅ Minting disabled! Supply is now fixed.');
        console.log(`📋 Transaction signature: ${signature}`);
  
      } catch (error) {
        console.error('❌ Failed to disable minting:', error.message);
      }
    }
  }
  
  // CLI Interface
  async function main() {
    const launcher = new SolanaTokenLauncher();
    
    const args = process.argv.slice(2);
    const command = args[0];
  
    switch (command) {
      case 'launch':
        await launcher.launch();
        break;
      
      case 'transfer':
        const recipient = args[1];
        const amount = parseFloat(args[2]);
        if (!recipient || !amount) {
          console.log('Usage: node script.js transfer <recipient_address> <amount>');
          return;
        }
        await launcher.transferTokens(recipient, amount);
        break;
      
      case 'disable-mint':
        await launcher.disableMinting();
        break;
      
      case 'info':
        if (fs.existsSync('token-info.json')) {
          const info = JSON.parse(fs.readFileSync('token-info.json', 'utf8'));
          console.log('\n📊 Token Information:');
          console.log(JSON.stringify(info, null, 2));
        } else {
          console.log('❌ No token info found. Run "launch" first.');
        }
        break;
      
      default:
        console.log('\n🚀 Solana Token Launcher');
        console.log('========================');
        console.log('Commands:');
        console.log('  launch              - Create and launch new token');
        console.log('  transfer <addr> <amount> - Transfer tokens');
        console.log('  disable-mint        - Disable minting (fix supply)'); 
        console.log('  info                - Show token information');
        console.log('\nExample:');
        console.log('  node script.js launch');
        console.log('  node script.js transfer 4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T 100');
        break;
    }
  }
  
  // Run if called directly
  if (require.main === module) {
    main().catch(console.error);
  }
  
  module.exports = SolanaTokenLauncher;