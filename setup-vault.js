const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } = require('@solana/spl-token');
const fs = require('fs');

// Configuration
const PROGRAM_ID = new PublicKey('RoQZsTPSQyMVeMfWR2NxCaJD1ui781GE77JJtoz2dw8');
const TOKEN_MINT = new PublicKey('GhwmuvByp2WMDypvxBE8ZBVNiUiT43Zb6FvMABC3Lwgh');
const VAULT_AMOUNT = 1000000000000; // 1,000,000 tokens (with 6 decimals)
const NETWORK = 'testnet';

async function setupVault() {
    // Load wallet from file
    const walletData = JSON.parse(fs.readFileSync('./sol-token/solana-wallet.json', 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
    
    // Connect to testnet
    const connection = new Connection(
        NETWORK === 'testnet' 
            ? 'https://api.testnet.solana.com' 
            : 'https://api.devnet.solana.com',
        'confirmed'
    );

    console.log('Setting up vault for airdrop program...');
    console.log('Program ID:', PROGRAM_ID.toString());
    console.log('Token Mint:', TOKEN_MINT.toString());
    console.log('Wallet:', wallet.publicKey.toString());

    try {
        // Get the vault PDA
        const [vaultPDA, vaultBump] = await PublicKey.findProgramAddress(
            [Buffer.from('vault')],
            PROGRAM_ID
        );

        // Get the vault authority PDA
        const [vaultAuthorityPDA, vaultAuthorityBump] = await PublicKey.findProgramAddress(
            [Buffer.from('vault')],
            PROGRAM_ID
        );

        console.log('Vault PDA:', vaultPDA.toString());
        console.log('Vault Authority PDA:', vaultAuthorityPDA.toString());

        // Get the wallet's token account
        const walletTokenAccount = await getAssociatedTokenAddress(
            TOKEN_MINT,
            wallet.publicKey
        );

        // Get vault token account
        const vaultTokenAccount = await getAssociatedTokenAddress(
            TOKEN_MINT,
            vaultPDA,
            true // allowOwnerOffCurve
        );

        console.log('Wallet Token Account:', walletTokenAccount.toString());
        console.log('Vault Token Account:', vaultTokenAccount.toString());

        const { Transaction } = require('@solana/web3.js');
        const transaction = new Transaction();

        // Check if vault token account exists
        const vaultAccountInfo = await connection.getAccountInfo(vaultTokenAccount);
        
        if (!vaultAccountInfo) {
            console.log('Creating vault token account...');
            const createVaultAccountIx = createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                vaultTokenAccount,
                vaultPDA,
                TOKEN_MINT
            );
            transaction.add(createVaultAccountIx);
        } else {
            console.log('Vault token account already exists');
        }

        // Transfer tokens to vault
        console.log('Adding transfer instruction...');
        const transferIx = createTransferInstruction(
            walletTokenAccount,
            vaultTokenAccount,
            wallet.publicKey,
            VAULT_AMOUNT
        );
        transaction.add(transferIx);

        // Send transaction
        console.log('Sending transaction...');
        const signature = await connection.sendTransaction(transaction, [wallet]);
        console.log('Transaction sent:', signature);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('Transaction confirmed!');

        // Save vault info
        const vaultInfo = {
            programId: PROGRAM_ID.toString(),
            tokenMint: TOKEN_MINT.toString(),
            vaultPDA: vaultPDA.toString(),
            vaultAuthorityPDA: vaultAuthorityPDA.toString(),
            vaultTokenAccount: vaultTokenAccount.toString(),
            vaultBump: vaultBump,
            vaultAuthorityBump: vaultAuthorityBump,
            amount: VAULT_AMOUNT,
            network: NETWORK,
            setupAt: new Date().toISOString()
        };

        fs.writeFileSync('./vault-info.json', JSON.stringify(vaultInfo, null, 2));
        console.log('Vault info saved to vault-info.json');

        console.log('\n✅ Vault setup complete!');
        console.log('Vault Token Account:', vaultTokenAccount.toString());
        console.log('Amount transferred:', VAULT_AMOUNT / 1000000, 'tokens');

    } catch (error) {
        console.error('Error setting up vault:', error);
    }
}

setupVault().catch(console.error); 