'use client';

import { useEffect, useState } from 'react';
import { ConnectWallet } from '@/components/ConnectWallet';
import { TransactionBuilder } from '@/components/TransactionBuilder';
import { useWallet } from '@/hooks/useWallet';
import { getStats } from '@/lib/stats';

export default function Home() {
  const { isConnected } = useWallet();
  const [stats, setStats] = useState({ prevented: 0, successful: 0 });

  // Poll stats just for display niceness
  useEffect(() => {
    setStats(getStats());
    const interval = setInterval(() => {
      setStats(getStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">Base Tx Guard</h1>
          <p className="text-gray-500">We simulate your transaction before you sign — so you don’t waste gas or lose funds.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <span className="block text-2xl font-bold text-red-500">{stats.prevented}</span>
            <span className="text-xs text-gray-500 uppercase font-medium">Bad Txs Prevented</span>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <span className="block text-2xl font-bold text-green-500">{stats.successful}</span>
            <span className="text-xs text-gray-500 uppercase font-medium">Successful Txs</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="space-y-6">
          <ConnectWallet />

          {isConnected && (
            <div className="animate-fade-in-up">
              <TransactionBuilder />
            </div>
          )}
        </div>

        {/* Trust Builders */}
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400 font-medium">
            No fees • No backend • Runs entirely in your browser
          </p>

          <details className="group cursor-pointer">
            <summary className="text-xs text-blue-600 hover:text-blue-700 font-medium list-none flex items-center justify-center gap-1">
              <span>What is this?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-2 text-xs text-gray-500 max-w-xs mx-auto bg-white p-3 rounded-lg shadow-sm border">
              Most wallets only tell you after a transaction fails. Tx Guard simulates it first to save you money and frustration.
            </div>
          </details>
        </div>

      </div>
    </main>
  );
}
