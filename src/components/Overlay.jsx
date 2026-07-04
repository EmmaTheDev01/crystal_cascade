import React from 'react';

export default function Overlay({
  gameState,
  levelIndex,
  movesLeft,
  blockCount,
  onStart,
  onNext,
  onRetry
}) {
  if (gameState === 'playing') return null;

  return (
    <div className="overlay show">
      {gameState === 'start' && (
        <div className="overlay-card start">
          <h2 className="glow-title">JEWEL CASCADE</h2>
          <p className="subtitle">Level {levelIndex + 1} Goal:</p>
          
          <div className="objectives-preview" style={{ justifyContent: 'center' }}>
            <div className="preview-chip" style={{ padding: '8px 16px' }}>
              <span 
                className="preview-swatch" 
                style={{ 
                  backgroundColor: '#a24fd1',
                  borderRadius: '4px',
                  boxShadow: '0 0 10px 2px #a24fd1'
                }} 
              />
              <span className="preview-qty" style={{ fontSize: '15px', marginLeft: '6px' }}>
                Clear all {blockCount} Blocks!
              </span>
            </div>
          </div>

          <div className="help-text">
            <h3>Rules:</h3>
            <ul>
              <li>Swap adjacent gems to align matches of 3 or more.</li>
              <li>Matches made on top of blocks damage/shatter them.</li>
              <li>Match 5 in a line to trigger a <strong>Row/Col Blast</strong>!</li>
              <li>Match 4 in a 2x2 square to trigger a <strong>Square Blast</strong>!</li>
              <li>Break all blocks before you run out of moves!</li>
            </ul>
          </div>

          <button className="big-btn" onClick={onStart}>
            Start Level
          </button>
        </div>
      )}

      {gameState === 'win' && (
        <div className="overlay-card win">
          <h2>Level Complete!</h2>
          <p className="congrats">Superb swapping! All blocks have been cleared.</p>
          
          <div className="score-summary">
            <div className="summary-row" style={{ border: 'none', justifyContent: 'center', gap: '8px' }}>
              <span>Remaining Moves:</span>
              <span className="summary-val highlight">{movesLeft}</span>
            </div>
          </div>

          <button className="big-btn" onClick={onNext}>
            Next Level
          </button>
        </div>
      )}

      {gameState === 'lose' && (
        <div className="overlay-card lose">
          <h2>Out of Moves</h2>
          <p className="defeat">You ran out of moves before breaking all the blocks.</p>

          <button className="big-btn" onClick={onRetry}>
            Retry Level
          </button>
        </div>
      )}
    </div>
  );
}
