import React, { useState } from 'react';
import { walletModules, connectWallet, getBalance } from '../utils/stellarKit';

const Header = ({ onConnect }) => {
    const [connected, setConnected] = useState(false);
    const [publicKey, setPublicKey] = useState("");
    const [balance, setBalance] = useState("0");
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const handleSelectWallet = async (wallet) => {
        setShowModal(false);
        setIsLoading(true);
        try {
            if (wallet.productId === 'freighter') {
                const key = await connectWallet();
                const bal = await getBalance(key);
                setPublicKey(key);
                setBalance(Number(bal).toFixed(2));
                setConnected(true);
                if (onConnect) onConnect(key);
            } else {
                throw new Error(`${wallet.productName} is not installed. Please install it from ${wallet.productUrl}`);
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            alert(error.message || 'Failed to connect wallet.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--grid-interval)' }}>
            {!connected ? (
                <>
                    <button type="button" onClick={() => setShowModal(!showModal)} disabled={isLoading}>
                        {isLoading ? 'CONNECTING...' : 'CONNECT WALLET'}
                    </button>

                    {showModal && (
                        <div style={{
                            border: '3px solid var(--color-black)',
                            padding: 'var(--grid-interval)',
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}>
                            <p style={{ fontWeight: 'bold', fontSize: '0.9em' }}>SELECT WALLET:</p>
                            {walletModules.map((w) => (
                                <button
                                    key={w.productId}
                                    type="button"
                                    onClick={() => handleSelectWallet(w)}
                                    style={{
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <img
                                        src={w.productIcon}
                                        alt={w.productName}
                                        style={{ width: '20px', height: '20px' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {w.productName.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <ul>
                    <li>PUBLIC KEY: {publicKey}</li>
                    <li>BALANCE: {balance} XLM</li>
                </ul>
            )}
        </div>
    );
};

export default Header;
