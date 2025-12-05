import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Camera, Settings } from 'lucide-react';
import { Ball, GameState, HandPosition } from '../types';

interface JugglingGameProps {
  onScoreUpdate: (score: number) => void;
  onGameStateChange: (state: GameState) => void;
}

interface Results {
  multiHandLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
  multiHandedness: Array<{ label: string; score: number }>;
  image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;
}

// Physics Constants - Tuned for realism
const GRAVITY = 0.00015; // Lowered gravity for floatier feel
const BALL_RADIUS = 0.04;
const HAND_RADIUS = 0.1; // Slightly larger catch radius
// Increased threshold (more negative) means you must move hand UP faster to trigger throw
const THROW_THRESHOLD = -0.08; 
const THROW_COOLDOWN = 400; // Increased cooldown to prevent double-throws
const MAX_STACK_HEIGHT = 4;

const JugglingGame: React.FC<JugglingGameProps> = ({ onScoreUpdate, onGameStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetBallCount, setTargetBallCount] = useState(3);

  // Refs for animation loop
  const ballsRef = useRef<Ball[]>([]);
  const handsRef = useRef<{ left: HandPosition; right: HandPosition }>({
    left: { x: 0, y: 0, vx: 0, vy: 0, isPresent: false },
    right: { x: 0, y: 0, vx: 0, vy: 0, isPresent: false },
  });
  const gameStateRef = useRef<GameState>(GameState.IDLE);
  const scoreRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const throwCooldowns = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  
  const propsRef = useRef({ onScoreUpdate, onGameStateChange });
  useEffect(() => {
    propsRef.current = { onScoreUpdate, onGameStateChange };
  }, [onScoreUpdate, onGameStateChange]);

  // Handle MediaPipe Results
  const onResults = useCallback((results: Results) => {
    const nextLeft = { ...handsRef.current.left, isPresent: false };
    const nextRight = { ...handsRef.current.right, isPresent: false };

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const classification = results.multiHandedness[i];
        const label = classification.label; // 'Left' or 'Right'

        // Landmark 9 (Middle Finger MCP) for Palm Center
        const palmPoint = landmarks[9]; 
        
        const prevHand = label === 'Left' ? handsRef.current.left : handsRef.current.right;
        
        // Smoothing velocity
        const vx = (palmPoint.x - prevHand.x);
        const vy = (palmPoint.y - prevHand.y);

        const pos = { 
            x: palmPoint.x, 
            y: palmPoint.y, 
            vx: vx, 
            vy: vy,
            isPresent: true 
        };

        if (label === 'Left') {
            Object.assign(nextLeft, pos);
        } else {
            Object.assign(nextRight, pos);
        }
      }
    }
    
    handsRef.current.left = nextLeft;
    handsRef.current.right = nextRight;

    draw(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Camera & Hands
  useEffect(() => {
    const Hands = (window as any).Hands;
    
    if (!Hands) {
      console.error("MediaPipe Hands not loaded");
      setLoading(false);
      return;
    }

    const hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: 'user' 
            },
            audio: false
          });

          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setLoading(false);

          const cameraLoop = async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                await hands.send({ image: videoRef.current });
            }
            animationFrameId = requestAnimationFrame(cameraLoop);
          };
          
          cameraLoop();

        } catch (err) {
          console.error("Camera error", err);
          alert("Could not start camera. Please ensure you have allowed camera permissions.");
          setLoading(false);
        }
      }
    };

    startCamera();

    return () => {
        cancelAnimationFrame(animationFrameId);
        hands.close();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [onResults]);

  const updateGame = () => {
    if (gameStateRef.current !== GameState.PLAYING) return;

    const now = Date.now();
    
    // Spawn balls until we reach target count
    if (ballsRef.current.length < targetBallCount && now - lastSpawnTimeRef.current > 500) {
      spawnBall();
      lastSpawnTimeRef.current = now;
    }

    // Process Hand Holdings (Stacking logic)
    ['left', 'right'].forEach((handName) => {
        const hName = handName as 'left' | 'right';
        const hand = handsRef.current[hName];
        
        // Find all balls held by this hand
        const heldBalls = ballsRef.current.filter(b => b.heldBy === hName);

        if (hand.isPresent && heldBalls.length > 0) {
            // Check for Throw Intent
            // Logic: Hand moving up fast (vy is negative), and cooldown passed
            if (hand.vy < THROW_THRESHOLD && now - throwCooldowns.current[hName] > THROW_COOLDOWN) {
                // Throw ONE ball (the one at the top of stack)
                const ballToThrow = heldBalls[heldBalls.length - 1];
                
                ballToThrow.heldBy = null;
                
                // Physics: Transfer hand velocity to ball
                // We use a lower multiplier (0.25) because the hand speed required to trigger (THRESHOLD) is higher.
                ballToThrow.vy = hand.vy * 0.25 - 0.005; // -0.005 adds a little extra "pop"
                ballToThrow.vx = hand.vx * 0.25; 
                
                // Add slight randomness to prevent robotic arcs
                ballToThrow.vx += (Math.random() - 0.5) * 0.005;

                // Update cooldown
                throwCooldowns.current[hName] = now;
                
                scoreRef.current += 10;
                setScore(scoreRef.current);
                propsRef.current.onScoreUpdate(scoreRef.current);
            }

            // Position remaining held balls
            const currentHeld = ballsRef.current.filter(b => b.heldBy === hName);
            currentHeld.forEach((ball, index) => {
                const stackIndex = Math.min(index, MAX_STACK_HEIGHT);
                const offset = stackIndex * (ball.radius * 1.2); 
                
                ball.x = hand.x;
                ball.y = hand.y - 0.05 - offset; // Base offset + stack
                ball.vx = hand.vx;
                ball.vy = hand.vy;
            });
        } else if (!hand.isPresent && heldBalls.length > 0) {
            // Hand lost tracking, drop all balls
            heldBalls.forEach(b => b.heldBy = null);
        }
    });

    // Update Physics for all balls
    ballsRef.current.forEach(ball => {
      // If free falling
      if (!ball.heldBy) {
        ball.vy += GRAVITY;
        ball.y += ball.vy;
        ball.x += ball.vx;

        // Wall bounces
        if (ball.x < ball.radius || ball.x > 1 - ball.radius) {
            ball.vx *= -0.8;
            ball.x = Math.max(ball.radius, Math.min(1 - ball.radius, ball.x));
        }

        // Catch Checks
        checkHandCatch(ball, handsRef.current.left, 'left');
        checkHandCatch(ball, handsRef.current.right, 'right');

        // Floor check (Respawn logic)
        if (ball.y > 1.2) {
             respawnBall(ball);
        }
      }
    });
  };

  const checkHandCatch = (ball: Ball, hand: HandPosition, handName: 'left' | 'right') => {
    if (!hand.isPresent || ball.heldBy) return;

    // Calculate distance
    const dx = ball.x - hand.x;
    const dy = (ball.y - hand.y) * 0.75; 
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Catch Radius
    if (dist < (ball.radius + HAND_RADIUS / 2)) {
        // Only catch if ball is moving down or relatively still
        if (ball.vy > -0.01) { 
             ball.heldBy = handName;
             ball.vx = 0;
             ball.vy = 0;
        }
    }
  };

  const spawnBall = () => {
    ballsRef.current.push({
      id: Date.now() + Math.random(),
      x: 0.2 + Math.random() * 0.6,
      y: -0.1,
      vx: (Math.random() - 0.5) * 0.005,
      vy: 0,
      radius: BALL_RADIUS,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      isActive: true,
      heldBy: null
    });
  };

  const respawnBall = (ball: Ball) => {
      ball.x = 0.2 + Math.random() * 0.6;
      ball.y = -0.2; // Start higher up
      ball.vx = (Math.random() - 0.5) * 0.005;
      ball.vy = 0;
      ball.heldBy = null;
  };

  const draw = (results: Results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw video frame
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    updateGame();

    // Draw Hands (Visual Markers)
    const drawHandMarker = (hand: HandPosition, color: string) => {
      if (!hand.isPresent) return;
      
      ctx.beginPath();
      ctx.arc(hand.x * canvas.width, hand.y * canvas.height, HAND_RADIUS * canvas.width, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawHandMarker(handsRef.current.left, '#3b82f6'); // Blue
    drawHandMarker(handsRef.current.right, '#ef4444'); // Red

    // Draw Balls
    ballsRef.current.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.x * canvas.width, ball.y * canvas.height, ball.radius * canvas.width, 0, 2 * Math.PI);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Highlight held balls
      if (ball.heldBy) {
         ctx.beginPath();
         ctx.arc(ball.x * canvas.width, ball.y * canvas.height, ball.radius * canvas.width, 0, 2 * Math.PI);
         ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
         ctx.fill();
      }
    });
  };

  const startGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setGameState(GameState.PLAYING);
    gameStateRef.current = GameState.PLAYING;
    propsRef.current.onGameStateChange(GameState.PLAYING);
    
    // Reset any balls off screen
    ballsRef.current.forEach(b => {
        if (b.y > 1 || b.y < -0.2) respawnBall(b);
    });
  };

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-2xl">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900 z-50">
           <div className="flex flex-col items-center">
             <Camera className="w-12 h-12 animate-pulse mb-4" />
             <p>Starting Camera...</p>
             <p className="text-sm text-gray-400 mt-2">Please allow camera access</p>
           </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
        playsInline
        muted
      />
      
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full h-full object-cover"
      />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="bg-black/60 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
            <span className="text-gray-400 text-xs uppercase tracking-wider block">Score</span>
            <span className="text-2xl font-bold font-mono">{score}</span>
        </div>
      </div>

      {gameState !== GameState.PLAYING && !loading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-40 p-6">
            
            <div className="mb-8 w-full max-w-xs">
                <div className="flex items-center justify-center gap-2 mb-4 text-purple-400">
                    <Settings className="w-5 h-5" />
                    <span className="font-bold tracking-wider uppercase">Game Setup</span>
                </div>
                
                <label className="text-gray-300 text-sm block mb-2 text-center">
                    Number of Balls: <span className="text-white font-bold text-lg ml-2">{targetBallCount}</span>
                </label>
                <input 
                    type="range" 
                    min="1" 
                    max="15" 
                    value={targetBallCount} 
                    onChange={(e) => setTargetBallCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>1 (Easy)</span>
                    <span>15 (Chaos)</span>
                </div>
            </div>
            
            <button
                onClick={startGame}
                className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-indigo-600 font-lg rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-700 hover:scale-105"
            >
                {gameState === GameState.IDLE ? <Play className="mr-2" /> : <RotateCcw className="mr-2" />}
                {gameState === GameState.IDLE ? "Start Juggling" : "Resume"}
                <div className="absolute -inset-3 rounded-full bg-indigo-400 opacity-20 group-hover:opacity-40 blur-lg transition-opacity" />
            </button>
            <p className="text-gray-400 mt-6 text-sm max-w-xs text-center leading-relaxed">
                Catch balls with your <strong>palms</strong>.<br/>
                Flick your hand <strong>UP firmly</strong> to throw!
            </p>
        </div>
      )}
    </div>
  );
};

export default JugglingGame;
