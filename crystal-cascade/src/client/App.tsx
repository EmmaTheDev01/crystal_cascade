import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import HUD from './components/HUD';
import Overlay from './components/Overlay';
import { gameAudio } from './utils/audio';
import type { LevelConfig, GameState } from './types';
import Icon from './components/Icon';

interface ToastItem {
  id: number;
  text: string;
  icon?: 'star' | 'sparkle' | 'zap' | 'flame' | 'volume-x' | 'volume-2' | 'refresh' | 'shield';
}

const LEVELS: LevelConfig[] = [
  { moves: 22, colorsUsed: 4, blockCount: 8,  blockMaxDurability: 1 },
  { moves: 18, colorsUsed: 5, blockCount: 16, blockMaxDurability: 1 },
  { moves: 15, colorsUsed: 5, blockCount: 24, blockMaxDurability: 2 },
  { moves: 16, colorsUsed: 6, blockCount: 28, blockMaxDurability: 2 },  // was 14/30 — adjusted
  { moves: 15, colorsUsed: 6, blockCount: 30, blockMaxDurability: 2 },
];

function getLevelConfig(idx: number): LevelConfig {
  if (idx < LEVELS.length) return LEVELS[idx];
  // Infinite level generation (gets progressively harder)
  const colorsUsed = Math.min(6, 4 + (idx % 3));
  const moves      = Math.max(12, 18 - Math.floor((idx - 5) / 3));
  const blockCount = Math.min(32, 12 + (idx - 5) * 4);
  const blockMaxDurability = Math.min(2, 1 + Math.floor((idx - 5) / 4));
  return { moves, colorsUsed, blockCount, blockMaxDurability };
}

export default function App(): React.ReactElement {
  const [levelIndex, setLevelIndex]       = useState<number>(0);
  const [gameState, setGameState]         = useState<GameState>('start');
  const [movesLeft, setMovesLeft]         = useState<number>(22);
  const [collectedCount, setCollectedCount] = useState<Record<string, number>>({ blocks: 0 });
  const [aiMode, setAiMode]               = useState<boolean>(false);
  const [muted, setMuted]                 = useState<boolean>(false);
  const [toasts, setToasts]               = useState<ToastItem[]>([]);
  const [playEvent, setPlayEvent]         = useState<number>(0);

  const currentLevel = getLevelConfig(levelIndex);

  useEffect(() => {
    setMovesLeft(currentLevel.moves);
    setCollectedCount({ blocks: 0 });
  }, [levelIndex, playEvent]);

  const showToast = (text: string, icon?: ToastItem['icon']): void => {
    const id   = Date.now() + Math.random();
    const item: ToastItem = icon !== undefined
      ? { id, text, icon }
      : { id, text };
    setToasts(prev => [...prev, item]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 850);
  };

  const handleToggleMute = (): void => {
    const isMuted = gameAudio.toggleMute();
    setMuted(isMuted);
    showToast(isMuted ? 'Muted' : 'Unmuted');
  };

  const handleStartLevel = (): void => {
    gameAudio.resume();
    setGameState('playing');
  };

  const handleNextLevel = (): void => {
    setLevelIndex(prev => prev + 1);
    setGameState('start');
    setPlayEvent(prev => prev + 1);
  };

  const handleRetryLevel = (): void => {
    setGameState('playing');
    setPlayEvent(prev => prev + 1);
  };

  const handleLevelWin = (): void => {
    setGameState('win');
    setAiMode(false);
  };

  const handleLevelLose = (): void => {
    setGameState('lose');
    setAiMode(false);
  };

  return (
    <div id="root">
      {/* Vignette */}
      <div className="vignette" />

      {/* Toast alerts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast-alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t.icon && <Icon name={t.icon} size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* 3D Scene */}
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

      {/* HUD */}
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

      {/* Overlay */}
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
