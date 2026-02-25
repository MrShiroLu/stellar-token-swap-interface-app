#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
pub enum DataKey {
    SwapCount(Address),
}

#[contract]
pub struct SwapContract;

#[contractimpl]
impl SwapContract {
    /// Swap tokens using a dynamic rate.
    /// rate_num / rate_den = exchange rate (e.g. 12/100 = 0.12 for XLM→USDC)
    pub fn swap(env: Env, user: Address, amount_in: i128, rate_num: i128, rate_den: i128) -> i128 {
        user.require_auth();

        // 1. Reading Data: Get previous swap counts
        let mut count: u32 = env.storage().persistent().get(&DataKey::SwapCount(user.clone())).unwrap_or(0);
        
        // Dynamic swap rate based on token pair (rate passed from frontend)
        let amount_out = amount_in * rate_num / rate_den;
        count += 1;

        // 2. Writing Data: Save new swap count
        env.storage().persistent().set(&DataKey::SwapCount(user.clone()), &count);

        // 3. Event: Publish 'swap' event
        env.events().publish((symbol_short!("swap"), user.clone()), amount_out);

        amount_out
    }

    pub fn get_count(env: Env, user: Address) -> u32 {
        env.storage().persistent().get(&DataKey::SwapCount(user)).unwrap_or(0)
    }
}
