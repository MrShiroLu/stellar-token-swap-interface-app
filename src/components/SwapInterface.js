import React, { useState, useEffect } from 'react';
import { horizonServer, rpcServer, signTx } from '../utils/stellarKit';
import * as StellarSdk from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CC4RA3KPXMFNXJFR4KWIBBYYIUDMLZDMKULGCJGZ4CS4U7YNQXINLOZ3';
const SOROBAN_RPC = "https://soroban-testnet.stellar.org";

const TOKENS = [
    { symbol: 'XLM', name: 'Stellar Lumens' },
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'EURC', name: 'Euro Coin' },
    { symbol: 'BTC', name: 'Bitcoin (wrapped)' },
];

// Exchange rates (rateNum/rateDen)
const MOCK_RATES = {
    'XLM-USDC': { rateNum: 12, rateDen: 100, display: 0.12 },
    'XLM-EURC': { rateNum: 11, rateDen: 100, display: 0.11 },
    'XLM-BTC': { rateNum: 18, rateDen: 10000000, display: 0.0000018 },
    'USDC-XLM': { rateNum: 833, rateDen: 100, display: 8.33 },
    'USDC-EURC': { rateNum: 92, rateDen: 100, display: 0.92 },
    'USDC-BTC': { rateNum: 15, rateDen: 1000000, display: 0.000015 },
    'EURC-XLM': { rateNum: 909, rateDen: 100, display: 9.09 },
    'EURC-USDC': { rateNum: 109, rateDen: 100, display: 1.09 },
    'EURC-BTC': { rateNum: 16, rateDen: 1000000, display: 0.000016 },
    'BTC-XLM': { rateNum: 555555, rateDen: 1, display: 555555 },
    'BTC-USDC': { rateNum: 66666, rateDen: 1, display: 66666 },
    'BTC-EURC': { rateNum: 61111, rateDen: 1, display: 61111 },
};

const SwapInterface = ({ publicKey }) => {
    const [amountIn, setAmountIn] = useState('');
    const [tokenFrom, setTokenFrom] = useState('XLM');
    const [tokenTo, setTokenTo] = useState('USDC');
    const [status, setStatus] = useState('idle');
    const [txHash, setTxHash] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [events, setEvents] = useState([]);
    const [swapCount, setSwapCount] = useState(null);
    const [estimatedOut, setEstimatedOut] = useState('0.00');

    // Reading data from contract: fetch swap count
    const fetchSwapCount = async () => {
        if (!publicKey) return;
        try {
            const contract = new StellarSdk.Contract(CONTRACT_ID);
            const userScVal = new StellarSdk.Address(publicKey).toScVal();
            const account = await horizonServer.loadAccount(publicKey);

            let tx = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET,
            })
                .addOperation(contract.call("get_count", userScVal))
                .setTimeout(30)
                .build();

            const simulated = await rpcServer.simulateTransaction(tx);
            if (simulated.result) {
                const count = StellarSdk.scValToNative(simulated.result.retval);
                setSwapCount(Number(count));
            }
        } catch (error) {
            console.error("Read contract error:", error);
        }
    };

    useEffect(() => {
        if (publicKey) fetchSwapCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicKey, status]);

    // Calculate estimated output based on selected token pair
    useEffect(() => {
        const val = parseFloat(amountIn);
        const rateKey = `${tokenFrom}-${tokenTo}`;
        const rateInfo = MOCK_RATES[rateKey];
        if (!isNaN(val) && val > 0 && rateInfo) {
            setEstimatedOut((val * rateInfo.display).toFixed(6));
        } else {
            setEstimatedOut('0.00');
        }
    }, [amountIn, tokenFrom, tokenTo]);

    const handleSwap = async () => {
        if (!publicKey) {
            setErrorMessage("Please connect wallet first.");
            setStatus('fail');
            return;
        }
        if (!amountIn || parseFloat(amountIn) <= 0) {
            setErrorMessage("Please enter a valid amount.");
            setStatus('fail');
            return;
        }

        setStatus('pending');
        setErrorMessage('');
        setTxHash('');

        try {
            const account = await horizonServer.loadAccount(publicKey);

            const contract = new StellarSdk.Contract(CONTRACT_ID);
            const userScVal = new StellarSdk.Address(publicKey).toScVal();
            const amountScVal = StellarSdk.nativeToScVal(Math.floor(Number(amountIn)), { type: 'i128' });

            // Get rate for selected token pair and pass to contract
            const rateKey = `${tokenFrom}-${tokenTo}`;
            const rateInfo = MOCK_RATES[rateKey] || { rateNum: 1, rateDen: 1 };
            const rateNumScVal = StellarSdk.nativeToScVal(rateInfo.rateNum, { type: 'i128' });
            const rateDenScVal = StellarSdk.nativeToScVal(rateInfo.rateDen, { type: 'i128' });

            const operation = contract.call("swap", userScVal, amountScVal, rateNumScVal, rateDenScVal);

            let tx = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET,
            })
                .addOperation(operation)
                .setTimeout(30)
                .build();

            const simulated = await rpcServer.simulateTransaction(tx);
            if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
                throw new Error("Simulation Failed: " + simulated.error);
            }

            tx = StellarSdk.rpc.assembleTransaction(tx, simulated).build();

            const signedXdr = await signTx(tx.toXDR(), publicKey);

            const sendRes = await fetch(SOROBAN_RPC, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0", id: 1,
                    method: "sendTransaction",
                    params: { transaction: signedXdr }
                })
            });
            const sendResponse = await sendRes.json();

            if (sendResponse.error) {
                throw new Error("Transaction rejected: " + sendResponse.error.message);
            }

            const hash = sendResponse.result.hash;

            let txStatus = "NOT_FOUND";
            while (txStatus === "NOT_FOUND" || txStatus === "PENDING") {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const statusRes = await fetch(SOROBAN_RPC, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0", id: 1,
                        method: "getTransaction",
                        params: { hash: hash }
                    })
                });
                const statusResponse = await statusRes.json();
                txStatus = statusResponse.result.status;
            }

            if (txStatus === "SUCCESS") {
                setStatus('success');
                setTxHash(hash);
            } else {
                throw new Error("Transaction failed on-chain. Status: " + txStatus);
            }

        } catch (error) {
            console.error("Swap Error:", error);
            setStatus('fail');
            setErrorMessage(error.message || 'Unknown error occurred.');
        }
    };

    // Event listener for Soroban Events
    useEffect(() => {
        let interval = setInterval(async () => {
            try {
                const latestLedger = await rpcServer.getLatestLedger();
                const response = await rpcServer.getEvents({
                    startLedger: latestLedger.sequence - 5,
                    filters: [
                        { type: "contract", contractIds: [CONTRACT_ID] }
                    ],
                    limit: 5
                });

                if (response && response.events && response.events.length > 0) {
                    setEvents(response.events);
                }
            } catch (error) {
                console.error("Event Sync Error:", error);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <section>
            <h2>TOKEN SWAP</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--grid-interval)' }}>

                {swapCount !== null && (
                    <p style={{ fontSize: '0.85em' }}>
                        &gt;&gt; YOUR TOTAL SWAPS: <strong>{swapCount}</strong> (read from contract)
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>FROM:</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                            value={tokenFrom}
                            onChange={(e) => setTokenFrom(e.target.value)}
                            style={{ fontFamily: 'var(--font-family-primary)', padding: '8px', border: '2px solid var(--color-black)', flex: '0 0 120px' }}
                        >
                            {TOKENS.map(t => (
                                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amountIn}
                            onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setAmountIn(e.target.value); }}
                            placeholder="Amount"
                            style={{ fontFamily: 'var(--font-family-primary)', padding: '8px', border: '2px solid var(--color-black)', flex: 1 }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>TO:</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                            value={tokenTo}
                            onChange={(e) => setTokenTo(e.target.value)}
                            style={{ fontFamily: 'var(--font-family-primary)', padding: '8px', border: '2px solid var(--color-black)', flex: '0 0 120px' }}
                        >
                            {TOKENS.filter(t => t.symbol !== tokenFrom).map(t => (
                                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={estimatedOut}
                            readOnly
                            style={{ fontFamily: 'var(--font-family-primary)', padding: '8px', border: '2px solid var(--color-dark-gray)', color: 'var(--color-dark-gray)', flex: 1 }}
                        />
                    </div>
                </div>

                <p style={{ fontSize: '0.75em', color: 'var(--color-dark-gray)' }}>
                    Contract: {CONTRACT_ID}
                </p>

                <div style={{ marginTop: 'calc(var(--grid-interval) / 2)' }}>
                    <button onClick={handleSwap} disabled={status === 'pending' || !publicKey || tokenFrom === tokenTo}>
                        {status === 'pending' ? 'SWAPPING...' : `SWAP ${tokenFrom} → ${tokenTo}`}
                    </button>
                </div>

                {status === 'success' && (
                    <div style={{ color: 'green', marginTop: 'calc(var(--grid-interval)/2)', fontWeight: 'bold' }}>
                        <p>✓ TX SUCCESSFUL</p>
                        <p style={{ fontSize: '0.8em', color: 'var(--color-dark-gray)', wordBreak: 'break-all' }}>Hash: {txHash}</p>
                        <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8em', color: 'var(--color-black)' }}>&gt;&gt; VIEW ON STELLAR EXPERT</a>
                    </div>
                )}

                {status === 'fail' && (
                    <div style={{ color: 'red', marginTop: 'calc(var(--grid-interval)/2)', fontWeight: 'bold' }}>
                        <p>✕ TX FAILED</p>
                        <p style={{ fontSize: '0.8em', color: 'var(--color-dark-gray)' }}>{errorMessage}</p>
                    </div>
                )}

                {events.length > 0 && (
                    <div style={{ marginTop: 'calc(var(--grid-interval)/2)' }}>
                        <h3>LIVE EVENTS</h3>
                        <ul>
                            {events.map((ev, idx) => (
                                <li key={idx} style={{ fontSize: '0.8em' }}>SwapExecuted — Ledger #{ev.ledger}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};

export default SwapInterface;
