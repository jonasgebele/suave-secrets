'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  BaseError,
  useSendTransaction, 
  useWaitForTransactionReceipt 
} from 'wagmi';
import { parseEther } from 'viem';

export default function Home() {
  const { 
    data: hash,
    error,
    isPending, 
    sendTransaction 
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash, 
    });

  async function submit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const to = formData.get('address');
    const value = formData.get('value');
    
    try {
      sendTransaction({ 
        to: to, 
        value: parseEther(value) 
      });
    } catch (err) {
      console.error('Failed to send transaction:', err);
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex justify-end">
        <ConnectButton />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <input
            name="address"
            type="text"
            placeholder="0xA0Cf…251e"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          <input
            name="value"
            type="text"
            placeholder="0.05"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          <button
            type="submit"
            disabled={isPending || isConfirming}
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Confirming in wallet...' : isConfirming ? 'Confirming transaction...' : 'Send'}
          </button>
        </div>
      </form>

      {hash && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="font-medium">Transaction Hash:</p>
          <a 
            href={`https://explorer.toliman.suave.flashbots.net/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {hash}
          </a>
        </div>
      )}

      {isConfirming && (
        <div className="mt-4 p-4 bg-yellow-50 text-yellow-700 rounded">
          Waiting for transaction confirmation...
        </div>
      )}

      {isConfirmed && (
        <div className="mt-4 p-4 bg-green-50 text-green-700 rounded">
          Transaction confirmed successfully!
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
          Error: {(error as BaseError).shortMessage || error.message}
        </div>
      )}
    </div>
  );
}