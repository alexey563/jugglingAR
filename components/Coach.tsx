import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot } from 'lucide-react';
import { sendCoachMessage, initializeCoachChat } from '../services/geminiService';
import { ChatMessage } from '../types';

interface CoachProps {
  score: number;
  gameState: string;
}

const Coach: React.FC<CoachProps> = ({ score, gameState }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Hi! I'm Coach Joe. Ready to juggle? Ask me for tips!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeCoachChat();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reactive coaching based on game events
  useEffect(() => {
    if (gameState === 'GAME_OVER' && score > 0) {
      const fetchEncouragement = async () => {
        setIsLoading(true);
        const text = await sendCoachMessage(`I just finished a game with a score of ${score}. How did I do?`);
        setMessages(prev => [...prev, { role: 'model', text }]);
        setIsLoading(false);
      };
      fetchEncouragement();
    }
  }, [gameState, score]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    const reply = await sendCoachMessage(userText);
    setMessages(prev => [...prev, { role: 'model', text: reply }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-300" />
        <h2 className="font-bold text-white">AI Coach</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px] md:max-h-full">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`p-2 rounded-full ${msg.role === 'user' ? 'bg-blue-500' : 'bg-purple-500'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-gray-700 text-gray-100 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-gray-900 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask for a tip..."
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-md disabled:opacity-50 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default Coach;
