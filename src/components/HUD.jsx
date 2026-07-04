import React from 'react';

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
  restartLevel
}) {
  const collected = Math.min(collectedCount['blocks'] || 0, blockCount);
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
          <div className="stat-value small-val">
            {aiMode ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Main Title Banner */}
        <div className="title-wrap">
          <h1>JEWEL CASCADE</h1>
          <div className="level-label">
            {levelIndex < maxLevels ? `Level ${levelIndex + 1} of ${maxLevels}` : `Level ${levelIndex + 1} (Infinite Mode)`}
          </div>
          <div className="action-row">
            <button className="mini-btn restart-btn" onClick={restartLevel}>
              Restart level ⟳
            </button>
            <button className="mini-btn mute-btn" onClick={toggleMute}>
              {muted ? 'Unmute 🔇' : 'Mute 🔊'}
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
      </div> {/* Close .hud container */}

      {/* Objectives Display Footer (Centered single blocker chip) */}
      <div className="objectives-panel">
        <div className={`obj-chip block-chip ${isDone ? 'done' : ''}`} style={{ minWidth: '220px', padding: '10px 16px' }}>
          <div 
            className="obj-swatch" 
            style={{ 
              backgroundColor: '#a24fd1',
              borderRadius: '4px',
              boxShadow: '0 0 10px 2px #a24fd1'
            }} 
          />
          <div className="obj-info">
            <div className="obj-count" style={{ fontSize: '14px' }}>
              Clear Blocks: {collected} / {blockCount}
            </div>
            <div className="obj-track" style={{ height: '7px', marginTop: '5px' }}>
              <div 
                className="obj-fill" 
                style={{ 
                  backgroundColor: '#a24fd1', 
                  width: `${percent}%` 
                }} 
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
