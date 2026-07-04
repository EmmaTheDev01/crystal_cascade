import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import HUD from './components/HUD';
import Overlay from './components/Overlay';
import { gameAudio } from './utils/audio';
import './App.css';

const LEVELS = [
  { moves: 22, colorsUsed: 4, blockCount: 8, blockMaxDurability: 1 },
  { moves: 18, colorsUsed: 5, blockCount: 16, blockMaxDurability: 1 },
  { moves: 15, colorsUsed: 5, blockCount: 24, blockMaxDurability: 2 },
  { moves: 14, colorsUsed: 6, blockCount: 30, blockMaxDurability: 2 },
  { moves: 12, colorsUsed: 6, blockCount: 36, blockMaxDurability: 3 }
];

function getLevelConfig(idx) {
  if (idx < LEVELS.length) {
    return LEVELS[idx];
  }
  // Infinite level generation logic (gets progressively harder)
  const colorsUsed = Math.min(6, 4 + (idx % 3)); // Cycles 4, 5, 6 colors
  const moves = Math.max(10, 16 - Math.floor((idx - 5) / 3)); // Tight moves down to min 10
  const blockCount = Math.min(48, 12 + (idx - 5) * 4); // Increases blocks
  const blockMaxDurability = Math.min(3, 1 + Math.floor((idx - 5) / 4)); // Increases durability

  return { moves, colorsUsed, blockCount, blockMaxDurability };
}

export default function App() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState('start'); // 'start' | 'playing' | 'win' | 'lose'
  const [movesLeft, setMovesLeft] = useState(22);
  const [collectedCount, setCollectedCount] = useState({ blocks: 0 });
  const [aiMode, setAiMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [playEvent, setPlayEvent] = useState(0); // Trigger level reshuffles

  const currentLevel = getLevelConfig(levelIndex);

  // Set up initial state on level change
  useEffect(() => {
    setMovesLeft(currentLevel.moves);
    setCollectedCount({ blocks: 0 });
  }, [levelIndex, playEvent]);

  // Handle mute toggling
  const handleToggleMute = () => {
    const isMuted = gameAudio.toggleMute();
    setMuted(isMuted);
    showToast(isMuted ? 'Muted' : 'Unmuted');
  };

  // Toast notifier
  const showToast = (text) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 850);
  };

  const handleStartLevel = () => {
    // Resume browser audio context on user action
    gameAudio.resume();
    setGameState('playing');
  };

  const handleNextLevel = () => {
    setLevelIndex(prev => prev + 1);
    setGameState('start');
    setPlayEvent(prev => prev + 1);
  };

  const handleRetryLevel = () => {
    setGameState('playing');
    setPlayEvent(prev => prev + 1);
  };

  const handleLevelWin = () => {
    setGameState('win');
    setAiMode(false);
  };

  const handleLevelLose = () => {
    setGameState('lose');
    setAiMode(false);
  };

  return (
    <div id="root">
      {/* 3D Scene View Vignette */}
      <div className="vignette" />

      {/* Dynamic Alerts Layer */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast-alert">
            {t.text}
          </div>
        ))}
      </div>

      {/* Main interactive Three.js component */}
      <GameEngine
        levelConfig={currentLevel}
        gameState={gameState}
        aiMode={aiMode}
        muted={muted}
        movesLeft={movesLeft}
        setMovesLeft={setMovesLeft}
        collectedCount={collectedCount}
        setCollectedCount={setCollectedCount}
        onLevelWin={handleLevelWin}
        onLevelLose={handleLevelLose}
        playEvent={playEvent}
        showToast={showToast}
      />

      {/* HUD Board HUD Panels */}
      <HUD
        levelIndex={levelIndex}
        maxLevels={LEVELS.length}
        movesLeft={movesLeft}
        blockCount={currentLevel.blockCount}
        collectedCount={collectedCount}
        aiMode={aiMode}
        setAiMode={setAiMode}
        muted={muted}
        toggleMute={handleToggleMute}
        restartLevel={handleRetryLevel}
      />

      {/* Overlay Modal sheets */}
      <Overlay
        gameState={gameState}
        levelIndex={levelIndex}
        movesLeft={movesLeft}
        blockCount={currentLevel.blockCount}
        onStart={handleStartLevel}
        onNext={handleNextLevel}
        onRetry={handleRetryLevel}
      />
    </div>
  );
}
