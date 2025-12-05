import React, { useState } from 'react';
import JugglingGame from './components/JugglingGame';
import { GameState } from './types';

function App() {
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🤹</span>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Juggling Master AR
            </h1>
          </div>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-sm text-gray-400 hover:text-white transition-colors">
            Git Pages Ready
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-6">
        
        {/* Game Area */}
        <section className="flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl p-1 border border-gray-700 shadow-2xl overflow-hidden">
            <JugglingGame 
              onScoreUpdate={setScore} 
              onGameStateChange={setGameState}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-2">How to Play</h3>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                    <li>Allow camera access.</li>
                    <li>Use your <strong>palm</strong> to catch falling balls.</li>
                    <li>Move your hand <strong>up quickly</strong> to throw them!</li>
                    <li>Select number of balls to increase difficulty.</li>
                </ul>
             </div>
             <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-2">Tech Specs</h3>
                <p className="text-xs text-gray-500">
                    Powered by MediaPipe (Hand Tracking). 
                    Runs entirely in the browser using WebGL and Canvas.
                </p>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;