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
            <h1 style={{ margin: 0 }}>CRYSTAL CASCADE</h1>
          </div>
          <div className="level-label" style={{ marginTop: '4px' }}>
            {levelIndex < maxLevels
              ? `Level ${levelIndex + 1} of ${maxLevels}`
              : `Level ${levelIndex + 1} (Infinite Mode)`}
          </div>
          <div className="action-row">
            <button className="icon-btn" onClick={restartLevel} aria-label="Restart level">
              <Icon name="refresh" size={15} />
            </button>
            <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={15} />
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
          <Icon
            name="box"
            size={22}
            style={{
              color: '#a24fd1',
              filter: 'drop-shadow(0 0 6px #a24fd1)',
              flexShrink: 0,
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
