'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { BaseError, useAccount } from 'wagmi';
import { Chain } from '@rainbow-me/rainbowkit';
import { 
  http, 
  type Hex,
  encodeFunctionData,
  decodeEventLog
} from '@flashbots/suave-viem';
import {
  getSuaveProvider,
  getSuaveWallet,
  type TransactionRequestSuave,
  SuaveTxRequestTypes
} from '@flashbots/suave-viem/chains/utils';
import { useState } from 'react';

const LOCAL_CONTRACT_ADDRESS = '0xB62Bb968f4601f2B16dbD0305A4D14a9B8c2b1A9';
const DEFAULT_MESSAGE = 'Jonas Gebele';

const local_suave_toliman = {
  id: 16813125,
  name: 'Local SUAVE Toliman',
  iconUrl: 'https://docs.flashbots.net/img/brand-assets/flashbots_icon.png',
  nativeCurrency: {
    name: 'SUAVE Devnet Eth',
    symbol: 'sETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
    public: {
      http: ['http://localhost:8545'],
    },
  },
  testnet: true,
} as const satisfies Chain;

const ABI = [
  {
    name: "offchain",
    type: "function",
    inputs: [
      { type: "string", name: "publicKey" },
      { type: "string", name: "message" }
    ],
    outputs: [{ type: "bytes", name: "" }],
    stateMutability: "nonpayable"
  },
  {
    name: "EncryptedMessageEvent",
    type: "event",
    inputs: [{ type: "bytes", name: "encryptedMessage", indexed: false }]
  },
  {
    name: "PassedValues",
    type: "event",
    inputs: [
      { type: "string", name: "publicKey", indexed: false },
      { type: "string", name: "message", indexed: false }
    ]
  }
] as const;

export default function Home() {
  const { address } = useAccount();
  const account = useAccount()
  
  // State declarations
  const [hash, setHash] = useState(null);
  const [decodedLogs, setDecodedLogs] = useState(null);
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [contractAddress, setContractAddress] = useState(LOCAL_CONTRACT_ADDRESS);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [status, setStatus] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [encryptedMessage, setEncryptedMessage] = useState(null);
  const [decryptedMessage, setDecryptedMessage] = useState(null);

  // Get encryption public key from MetaMask
  async function getEncryptionPublicKey() {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    try {
      const key = await window.ethereum.request({
        method: 'eth_getEncryptionPublicKey',
        params: [address],
      });
      
      console.log('Encryption public key:', key);
      setEncryptionKey(key);
      return key;
    } catch (error) {
      console.error('Error getting encryption public key:', error);
      throw error;
    }
  }

  // Decrypt message function
  async function decryptMessage(encryptedMsg) {
    if (!window.ethereum || !address) {
      throw new Error("MetaMask is not connected");
    }

    try {
      console.log('Attempting to decrypt:', encryptedMsg);
      
      const decrypted = await window.ethereum.request({
        method: 'eth_decrypt',
        params: [encryptedMsg, address]
      });
      
      console.log('Decrypted message:', decrypted);
      setDecryptedMessage(decrypted);
      return decrypted;
    } catch (error) {
      console.error('Error decrypting message:', error);
      setError(new Error(`Decryption failed: ${error.message || 'Unknown error'}`));
      throw error;
    }
  }

  // Helper function to decode hex format for display
  const getDecodedFormat = (hexString: string) => {
    try {
      const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      const jsonString = Buffer.from(cleanHex, 'hex').toString('utf8');
      const data = JSON.parse(jsonString);
      return JSON.stringify(data); // Compact format for display
    } catch (e) {
      return 'Invalid encrypted data format';
    }
  };

  // Main submit function
  async function submit(e) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setDecodedLogs(null);
    setStatus(null);
    setEncryptedMessage(null);
    setDecryptedMessage(null);

    try {
      // First get the encryption public key
      setStatus('Getting encryption key');
      const key = await getEncryptionPublicKey();
      
      setStatus('Preparing transaction');
      const transport = http(local_suave_toliman.rpcUrls.default.http[0]);
      const suaveProvider = getSuaveProvider(transport, {
        ...local_suave_toliman,
        networkName: local_suave_toliman.name,
        chainId: local_suave_toliman.id,
        currencySymbol: local_suave_toliman.nativeCurrency.symbol
      });
      
      const PRIVATE_KEY: Hex = '0x91ab9a7e53c220e6210460b65a7a3bb2ca181412a8a7b43ff336b3df1737ce12';
      const wallet = getSuaveWallet({
        transport,
        privateKey: PRIVATE_KEY,
        chain: {
          ...local_suave_toliman,
          networkName: local_suave_toliman.name,
          chainId: local_suave_toliman.id,
          currencySymbol: local_suave_toliman.nativeCurrency.symbol
        }
      });

      const data = encodeFunctionData({
        abi: ABI,
        functionName: 'offchain',
        args: [key, message]
      });

      const ccr: TransactionRequestSuave = {
        to: contractAddress,
        gasPrice: 10000000000n,
        gas: 420000n,
        type: SuaveTxRequestTypes.ConfidentialRequest,
        data,
        confidentialInputs: '0x',
        kettleAddress: '0xB5fEAfbDD752ad52Afb7e1bD2E40432A485bBB7F',
      };

      setStatus('Sending transaction');
      const txHash = await wallet.sendTransaction(ccr);
      console.log(`sent ccr! tx hash: ${txHash}`);
      setHash(txHash);
      setStatus('Mining');

       // Monitor for transaction receipt and encrypted message
       const checkReceipt = async () => {
        try {
          const receipt = await suaveProvider.getTransactionReceipt({ hash: txHash });
          if (receipt && receipt.status === 'success') {
            setStatus('Success');
            
            if (receipt.logs.length > 0) {
              const decoded = receipt.logs.map(log => {
                try {
                  const decodedLog = decodeEventLog({
                    abi: ABI,
                    ...log,
                  });
                  
                  // Store encrypted message if found
                  if (decodedLog.eventName === 'EncryptedMessageEvent') {
                    setEncryptedMessage(decodedLog.args.encryptedMessage);
                  }
                  
                  return decodedLog;
                } catch (e) {
                  console.error('Failed to decode log:', e);
                  return null;
                }
              }).filter(Boolean);

              setDecodedLogs(decoded);
              setIsPending(false);
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Error checking receipt:', error);
          return false;
        }
      };

      // Poll for receipt
      const interval = setInterval(async () => {
        const found = await checkReceipt();
        if (found) {
          clearInterval(interval);
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(interval);
        if (status === 'Mining') {
          setError(new Error('Transaction confirmation timeout'));
          setStatus('Error');
          setIsPending(false);
        }
      }, 30000);

    } catch (err) {
      setError(err);
      setIsPending(false);
      setStatus('Error');
      console.error('Failed to process:', err);
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <div className="flex justify-end">
        <ConnectButton />
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Address
            </label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder={LOCAL_CONTRACT_ADDRESS}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to Encrypt
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={DEFAULT_MESSAGE}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !address}
            className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {!address ? 'Connect Wallet First' : 
             isPending ? status : 'Encrypt Message'}
          </button>
        </div>
      </form>

      {encryptionKey && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="font-medium text-gray-700">Encryption Public Key:</p>
          <p className="break-all font-mono text-xs mt-1">
            {encryptionKey}
          </p>
        </div>
      )}

      {hash && (
        <div className="mt-4 p-4 bg-gray-100 rounded space-y-2">
          <div>
            <p className="font-medium text-gray-700">Transaction Hash:</p>
            <p className="break-all font-mono text-xs mt-1">
              {hash}
            </p>
          </div>

          {status && (
            <div className="mt-2">
              <p className="font-medium text-gray-700">Status:</p>
              <p className={`mt-1 ${
                status === 'Success' ? 'text-green-600' : 
                status === 'Mining' ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {status}
              </p>
            </div>
          )}
          
          {decodedLogs && (
            <div className="mt-4">
              <p className="font-medium text-gray-700">Decoded Events:</p>
              {decodedLogs.map((log, index) => (
                <div key={index} className="mt-2 p-2 bg-white rounded shadow-sm">
                  <p className="font-medium text-sm text-gray-600">{log.eventName}</p>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(log.args, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {encryptedMessage && (
            <div className="mt-4">
              <p className="font-medium text-gray-700">Encrypted Message Data:</p>
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">Hex Format (used for decryption):</p>
                <p className="break-all font-mono text-xs">
                  {encryptedMessage.startsWith('0x') ? 
                    encryptedMessage : 
                    `0x${encryptedMessage}`}
                </p>
                
                <p className="text-xs text-gray-500 mt-3 mb-1">Decoded Format (for display only):</p>
                <pre className="break-all font-mono text-xs bg-white p-2 rounded">
                  {getDecodedFormat(encryptedMessage)}
                </pre>
              </div>
              
              <button
                onClick={() => decryptMessage(encryptedMessage)}
                className="mt-4 w-full p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Decrypt Message
              </button>
            </div>
          )}

          {decryptedMessage && (
            <div className="mt-4 p-4 bg-green-50 rounded">
              <p className="font-medium text-gray-700">Decrypted Message:</p>
              <p className="mt-1 text-lg font-medium text-green-800">
                {decryptedMessage}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
          <p className="font-medium">Error:</p>
          <p className="mt-1">{(error as BaseError).shortMessage || error.message}</p>
        </div>
      )}
    </div>
  );
}