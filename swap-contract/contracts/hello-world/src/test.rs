#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_xlm_to_usdc() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SwapContract);
    let client = SwapContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // 100 XLM * 12/100 = 12 USDC
    let amount_out = client.swap(&user, &100, &12, &100);
    assert_eq!(amount_out, 12);
    assert_eq!(client.get_count(&user), 1);
}

#[test]
fn test_xlm_to_eurc() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SwapContract);
    let client = SwapContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // 100 XLM * 11/100 = 11 EURC
    let amount_out = client.swap(&user, &100, &11, &100);
    assert_eq!(amount_out, 11);
}
