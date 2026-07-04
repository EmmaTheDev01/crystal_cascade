/**
 * Crystal Cascade — Level Winnability Checker
 *
 * Simulates each level's constraints to determine:
 *  1. Are blocks reachable? (all placed in rows 1-6, cols 1-6 — never corners)
 *  2. Is the blockCount vs movesLeft ratio feasible?
 *  3. Can blocks be broken with available moves?
 *
 * Key game rules extracted from GameEngine.jsx:
 *  - Board: 8x8
 *  - Blocks only placed in rows 1–6, cols 1–6 (inner 6x6 = 36 cells max)
 *  - Block durability 1–3 (each match adjacent reduces by 1)
 *  - Each move can break 0–8 blocks (average ~2 in dense layouts)
 *  - Win condition: collect collectedCount['blocks'] >= blockCount
 *  - No moves → board shuffles (free, no move cost)
 */

const BOARD_SIZE = 8;
const INNER_CELLS = (BOARD_SIZE - 2) * (BOARD_SIZE - 2); // 36

const LEVELS = [
  { id: 1, moves: 22, colorsUsed: 4, blockCount: 8,  blockMaxDurability: 1 },
  { id: 2, moves: 18, colorsUsed: 5, blockCount: 16, blockMaxDurability: 1 },
  { id: 3, moves: 15, colorsUsed: 5, blockCount: 24, blockMaxDurability: 2 },
  { id: 4, moves: 14, colorsUsed: 6, blockCount: 30, blockMaxDurability: 2 },
  { id: 5, moves: 12, colorsUsed: 6, blockCount: 36, blockMaxDurability: 3 },
];

function getLevelConfig(idx) {
  if (idx < LEVELS.length) return LEVELS[idx];
  const colorsUsed = Math.min(6, 4 + (idx % 3));
  const moves = Math.max(10, 16 - Math.floor((idx - 5) / 3));
  const blockCount = Math.min(48, 12 + (idx - 5) * 4);
  const blockMaxDurability = Math.min(3, 1 + Math.floor((idx - 5) / 4));
  return { id: idx + 1, moves, colorsUsed, blockCount, blockMaxDurability };
}

// ── Analysis helpers ───────────────────────────────────────────────

/**
 * Effective cap on blocks: code does Math.min(BOARD_SIZE*BOARD_SIZE - 4, blockCount)
 * and only places in inner 6×6 = 36 cells.
 */
function effectiveBlockCount(lvl) {
  const hardCap = BOARD_SIZE * BOARD_SIZE - 4; // 60
  return Math.min(hardCap, Math.min(INNER_CELLS, lvl.blockCount));
}

/**
 * Total "hit-points" to clear (sum over all blocks of their durability).
 * Each block durability is random in [1, blockMaxDurability], avg = (1 + max) / 2
 */
function avgTotalHP(lvl) {
  const blocks = effectiveBlockCount(lvl);
  const avgDur = (1 + lvl.blockMaxDurability) / 2;
  return blocks * avgDur;
}

/**
 * Estimate "block hits per move":
 *  - On an 8×8 board a typical 3-match touches ≈3–4 cells.
 *  - With N blocks spread over 36 inner cells, probability that a matched
 *    gem is adjacent to / on a block ≈ N / 36 (rough linear model).
 *  - Average hits per move ≈ 3.5 * (N / 36), capped at 3.5.
 */
function avgHitsPerMove(lvl) {
  const blocks = effectiveBlockCount(lvl);
  const density = blocks / INNER_CELLS;
  // typical match size 3-4 cells, so 3.5 average
  return Math.min(3.5, 3.5 * density);
}

/**
 * Expected blocks cleared per move:
 * Blocks with durability 1 are cleared on first hit.
 * Blocks with durability d need d hits → a block isn't "cleared" each hit,
 * but the win condition just counts *cleared* blocks.
 * Expected clears per move ≈ hitsPerMove / avgDur
 */
function avgClearsPerMove(lvl) {
  const avgDur = (1 + lvl.blockMaxDurability) / 2;
  return avgHitsPerMove(lvl) / avgDur;
}

/**
 * Pessimistic (worst-case) analysis: all blocks at max durability.
 */
function pessimisticTotalHP(lvl) {
  return effectiveBlockCount(lvl) * lvl.blockMaxDurability;
}

/**
 * Optimistic total hits deliverable in `moves` moves (upper bound):
 * Assumes every match hits a block (density = 1, match size = 3.5).
 */
function maxHitsDeliverable(lvl) {
  return lvl.moves * 3.5;
}

// ── Critical issue check ───────────────────────────────────────────

function checkLevel(lvl) {
  const blocks  = effectiveBlockCount(lvl);
  const avgHP   = avgTotalHP(lvl);
  const pessHP  = pessimisticTotalHP(lvl);
  const maxHits = maxHitsDeliverable(lvl);
  const clearsPerMove = avgClearsPerMove(lvl);
  const expectedClears = clearsPerMove * lvl.moves;
  const issues  = [];

  // Issue 1: More blocks than inner cells (physically impossible to place)
  if (lvl.blockCount > INNER_CELLS) {
    issues.push(`❌ blockCount (${lvl.blockCount}) exceeds inner cell limit (${INNER_CELLS}). ` +
                `Only ${INNER_CELLS} blocks will actually be placed.`);
  }

  // Issue 2: Even with max density you can't deliver enough hits in worst case
  if (maxHits < pessHP) {
    issues.push(`❌ WORST-CASE UNWINNABLE: max possible hits (${maxHits.toFixed(1)}) < ` +
                `pessimistic HP (${pessHP}) — cannot break all ${blocks} blocks at max durability.`);
  }

  // Issue 3: Expected clears well below requirement (risky even on average)
  if (expectedClears < blocks * 0.8) {
    issues.push(`⚠️  LOW EXPECTED CLEARS: expected ~${expectedClears.toFixed(1)} blocks cleared ` +
                `but need ${blocks} (${((expectedClears / blocks) * 100).toFixed(0)}% of goal). ` +
                `Likely unwinnable without cascades/specials.`);
  }

  // Issue 4: Level 5 — 36 blocks fills entire inner grid at max durability=3
  // Each block must be hit 3 times; with 12 moves only 42 total hits possible optimistically
  if (blocks === INNER_CELLS && lvl.blockMaxDurability >= 3 && lvl.moves <= 15) {
    issues.push(`❌ FULL GRID + HIGH DURABILITY: ${blocks} blocks all at max durability ${lvl.blockMaxDurability}, ` +
                `only ${lvl.moves} moves. Total HP = ${pessHP}, max hits = ${maxHits.toFixed(1)}.`);
  }

  return {
    id: lvl.id,
    moves: lvl.moves,
    colors: lvl.colorsUsed,
    blockCount: lvl.blockCount,
    effectiveBlocks: blocks,
    blockMaxDurability: lvl.blockMaxDurability,
    avgTotalHP: avgHP.toFixed(1),
    pessimisticHP: pessHP,
    maxHitsDeliverable: maxHits.toFixed(1),
    expectedBlockClears: expectedClears.toFixed(1),
    issues,
    verdict: issues.some(i => i.startsWith('❌')) ? '❌ PROBLEM' :
             issues.some(i => i.startsWith('⚠️')) ? '⚠️  RISKY'  : '✅ OK'
  };
}

// ── Run for levels 1–10 ────────────────────────────────────────────

console.log('Crystal Cascade — Level Winnability Report');
console.log('='.repeat(70));

for (let i = 0; i < 10; i++) {
  const lvl = getLevelConfig(i);
  const result = checkLevel(lvl);

  console.log(`\nLevel ${result.id} [${result.verdict}]`);
  console.log(`  Moves: ${result.moves} | Colors: ${result.colors} | Blocks: ${result.blockCount} (effective: ${result.effectiveBlocks}) | Max Durability: ${result.blockMaxDurability}`);
  console.log(`  Avg total HP: ${result.avgTotalHP} | Pessimistic HP: ${result.pessimisticHP} | Max hits deliverable: ${result.maxHitsDeliverable}`);
  console.log(`  Expected clears: ${result.expectedBlockClears} / ${result.effectiveBlocks} blocks`);
  if (result.issues.length === 0) {
    console.log('  ✅ No issues found.');
  } else {
    result.issues.forEach(iss => console.log('  ' + iss));
  }
}

console.log('\n' + '='.repeat(70));
console.log('Notes:');
console.log('  • "max hits" = moves × 3.5 (optimistic: every match hits a block)');
console.log('  • "expected clears" uses avg durability and density of blocks on board');
console.log('  • Shuffles are free (no move cost) — board reshuffles if no valid moves');
console.log('  • Specials (striped/wrapped/bomb) can hit many blocks per move — benefit not modelled');
