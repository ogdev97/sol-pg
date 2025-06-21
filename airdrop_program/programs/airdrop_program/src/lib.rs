use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("RoQZsTPSQyMVeMfWR2NxCaJD1ui781GE77JJtoz2dw8");

#[program]
pub mod airdrop_program {
    use super::*;

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        // Only allow claim if not already claimed
        if ctx.accounts.claim_status.claimed {
            return err!(AirdropError::AlreadyClaimed);
        }

        // Transfer tokens from vault to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let seeds: &[&[u8]] = &[b"vault", &[ctx.bumps.vault_authority]];
        let signer = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 10_000_000)?; // 10 tokens if mint has 6 decimals

        // Mark as claimed
        ctx.accounts.claim_status.claimed = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + 1, // 8 bytes for anchor discriminator, 1 byte for bool
        seeds = [b"claim", user.key().as_ref()],
        bump
    )]
    pub claim_status: Account<'info, ClaimStatus>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA authority for the vault
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub mint: Account<'info, Mint>,
}

#[account]
pub struct ClaimStatus {
    pub claimed: bool,
}

#[error_code]
pub enum AirdropError {
    #[msg("You have already claimed the airdrop")]
    AlreadyClaimed,
}
