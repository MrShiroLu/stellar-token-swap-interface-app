import {
    StellarWalletsKit,
    Networks,
} from '@creit.tech/stellar-wallets-kit';
import {
    isConnected,
    requestAccess,
    getAddress,
    signTransaction,
} from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

// Wallet modules for StellarWalletsKit
const FreighterModule = {
    moduleType: 'HOT_WALLET',
    productId: 'freighter',
    productName: 'Freighter',
    productUrl: 'https://freighter.app',
    productIcon: 'https://stellar.creit.tech/wallet-icons/freighter.png',
    isAvailable: async () => {
        try { const r = await isConnected(); return !r.error && r.isConnected; } catch { return false; }
    },
    getAddress: async () => {
        const r = await requestAccess();
        if (r.error) throw new Error("Access rejected");
        const { address } = await getAddress();
        return { address };
    },
    signTransaction: async (xdr, opts) => {
        const r = await signTransaction(xdr, opts);
        if (r.error) throw new Error("Signing rejected");
        return { signedTxXdr: r.signedTxXdr };
    },
    getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: Networks.TESTNET }),
};

const xBullModule = {
    moduleType: 'HOT_WALLET',
    productId: 'xbull',
    productName: 'xBull',
    productUrl: 'https://xbull.app',
    productIcon: 'https://stellar.creit.tech/wallet-icons/xbull.png',
    isAvailable: async () => false,
    getAddress: async () => { throw new Error("xBull is not installed"); },
    signTransaction: async () => { throw new Error("xBull is not installed"); },
    getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: Networks.TESTNET }),
};

const AlbedoModule = {
    moduleType: 'HOT_WALLET',
    productId: 'albedo',
    productName: 'Albedo',
    productUrl: 'https://albedo.link',
    productIcon: 'https://stellar.creit.tech/wallet-icons/albedo.png',
    isAvailable: async () => false,
    getAddress: async () => { throw new Error("Albedo is not installed"); },
    signTransaction: async () => { throw new Error("Albedo is not installed"); },
    getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: Networks.TESTNET }),
};

const LobstrModule = {
    moduleType: 'HOT_WALLET',
    productId: 'lobstr',
    productName: 'LOBSTR',
    productUrl: 'https://lobstr.co',
    productIcon: 'https://stellar.creit.tech/wallet-icons/lobstr.png',
    isAvailable: async () => false,
    getAddress: async () => { throw new Error("LOBSTR is not installed"); },
    signTransaction: async () => { throw new Error("LOBSTR is not installed"); },
    getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: Networks.TESTNET }),
};

const RabetModule = {
    moduleType: 'HOT_WALLET',
    productId: 'rabet',
    productName: 'Rabet',
    productUrl: 'https://rabet.io',
    productIcon: 'https://stellar.creit.tech/wallet-icons/rabet.png',
    isAvailable: async () => false,
    getAddress: async () => { throw new Error("Rabet is not installed"); },
    signTransaction: async () => { throw new Error("Rabet is not installed"); },
    getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: Networks.TESTNET }),
};

const walletModules = [FreighterModule, xBullModule, AlbedoModule, LobstrModule, RabetModule];

// Initialize StellarWalletsKit with multiple wallet modules
export const kit = new StellarWalletsKit({
    network: Networks.TESTNET,
    selectedWalletId: 'freighter',
    modules: walletModules,
});

export { walletModules };

export const horizonServer = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
export const rpcServer = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");



export const connectWallet = async () => {
    // Check if Freighter is available
    const connectionResult = await isConnected();
    if (connectionResult.error || !connectionResult.isConnected) {
        throw new Error("Freighter wallet is not installed or not available. Please install Freighter from freighter.app");
    }

    // Request access
    const accessResult = await requestAccess();
    if (accessResult.error) {
        throw new Error("Connection rejected by user. Please approve the connection request in Freighter.");
    }

    const { address, error } = await getAddress();
    if (error || !address) {
        throw new Error("Could not retrieve wallet address. Please try again.");
    }

    return address;
};

export const getBalance = async (address) => {
    try {
        const account = await horizonServer.loadAccount(address);
        const xlm = account.balances.find((b) => b.asset_type === "native");
        return xlm?.balance || "0";
    } catch (error) {
        // Account not funded
        if (error.response?.status === 404) {
            throw new Error("Account not found on Testnet. Fund it at friendbot.stellar.org");
        }
        throw new Error("Failed to fetch balance. Network error.");
    }
};

export const signTx = async (xdr, publicKey) => {
    const result = await signTransaction(xdr, {
        networkPassphrase: StellarSdk.Networks.TESTNET,
        address: publicKey,
    });
    if (result.error) {
        throw new Error("Transaction signing was rejected.");
    }
    return result.signedTxXdr;
};
