import React from 'react';
import type { HUDProps } from '../types';
import Icon from './Icon';

export default function HUD({
  levelIndex,
  maxLevels,
  movesLeft,
  blockCount,
  collectedCount,
  aiMode,
  setAiMode,
  muted,
  toggleMute,
  restartLevel,
}: HUDProps): React.ReactElement {
  const collected = Math.min(collectedCount['blocks'] ?? 0, blockCount);
  const percent = Math.min(100, Math.floor((collected / blockCount) * 100));
  const isDone = collected >= blockCount;

  return (
    <>
      <div className="hud">
        {/* AI Auto-Play Card */}
        <div
          className={`stat-card toggle-card clickable-card ${aiMode ? 'active' : ''}`}
          onClick={() => setAiMode(prev => !prev)}
        >
          <div className="stat-label">AI Auto-Play</div>
          <div className="stat-value small-val">{aiMode ? 'ON' : 'OFF'}</div>
        </div>

        {/* Main Title Banner */}
        <div className="title-wrap">
          <div className="title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <img src="/snoo.png" alt="Snoo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <h1 style={{ margin: 0 }}>CRYSTAL CASCADE</h1>
          </div>
          <div className="level-label" style={{ marginTop: '4px' }}>
            {levelIndex < maxLevels
              ? `Level ${levelIndex + 1} of ${maxLevels}`
              : `Level ${levelIndex + 1} (Infinite Mode)`}
          </div>
          <div className="action-row">
            <button className="mini-btn restart-btn" onClick={restartLevel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="refresh" size={11} />
              <span>Restart level</span>
            </button>
            <button className="mini-btn mute-btn" onClick={toggleMute} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={11} />
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>
        </div>

        {/* Moves display */}
        <div className="stats-group">
          <div className="stat-card">
            <div className="stat-label">Moves</div>
            <div className={`stat-value moves-val ${movesLeft <= 5 ? 'low' : ''}`}>
              {movesLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Objectives Display Footer */}
      <div className="objectives-panel">
        <div
          className={`obj-chip block-chip ${isDone ? 'done' : ''}`}
          style={{ minWidth: '220px', padding: '10px 16px' }}
        >
          <img
            src="/snoo.png"
            alt="Snoo Block Objective"
            style={{
              width: '24px',
              height: '24px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 6px #a24fd1)',
            }}
          />
          <div className="obj-info">
            <div className="obj-count" style={{ fontSize: '14px' }}>
              Clear Blocks: {collected} / {blockCount}
            </div>
            <div className="obj-track" style={{ height: '7px', marginTop: '5px' }}>
              <div
                className="obj-fill"
                style={{ backgroundColor: '#a24fd1', width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
