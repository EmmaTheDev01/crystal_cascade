import type * as THREE from 'three';

// ── Game State ────────────────────────────────────────────────────────────────

export type GameState = 'start' | 'playing' | 'win' | 'lose';

export type SpecialType = 'striped_h' | 'striped_v' | 'wrapped' | 'color_bomb' | 'bomb';

// ── Level Config ──────────────────────────────────────────────────────────────

export interface LevelConfig {
  moves: number;
  colorsUsed: number;
  blockCount: number;
  blockMaxDurability: number;
}

// ── Board Entities ────────────────────────────────────────────────────────────

export interface GemCell {
  type: number;
  mesh: THREE.Mesh;
  special?: SpecialType;
}

export interface BlockCell {
  durability: number;
  mesh: THREE.Mesh;
}

export interface BoardPosition {
  row: number;
  col: number;
}

// ── Animation / Physics ───────────────────────────────────────────────────────

export interface Tween {
  mesh: THREE.Mesh;
  duration: number;
  elapsed: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromScale: THREE.Vector3;
  toScale: THREE.Vector3;
  onComplete: (() => void) | null;
}

export interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  scaleDecay: number;
}

export interface HintTween {
  gemA: THREE.Mesh | null;
  gemB: THREE.Mesh | null;
  baseYA: number;
  baseYB: number;
  timer: number;
}

// ── Interaction ───────────────────────────────────────────────────────────────

export interface DragState {
  row: number;
  col: number;
  startX: number;
  startY: number;
  pointerId: number;
  handled: boolean;
}

// ── Match Engine ──────────────────────────────────────────────────────────────

export interface PossibleMove {
  a: BoardPosition;
  b: BoardPosition;
  count: number;
}

export interface SpecialSpawn {
  r: number;
  c: number;
  colorType: number;
  specialType: SpecialType;
}

export interface MatchResult {
  matched: Set<string>;
  specialsToSpawn: SpecialSpawn[];
}

export interface RunInfo {
  len: number;
  keys: string[];
  color: number;
  r?: number;
  c?: number;
  runStart: number;
  runEnd: number;
}

// ── Engine Internal State ─────────────────────────────────────────────────────

export interface EngineState {
  gameState: GameState;
  aiMode: boolean;
  movesLeft: number;
  collectedCount: Record<string, number>;
  levelConfig: LevelConfig;
  busy: boolean;
  gameOver: boolean;
  selected: BoardPosition | null;
  dragState: DragState | null;
  tweens: Tween[];
  particles: Particle[];
  board: (GemCell | null)[][];
  blocksGrid: (BlockCell | null)[][];
  purgedColors: Set<number>;
  lastInteractionTime: number;
  hintActive: boolean;
  hintTicking: boolean;
  hintTween: HintTween | null;
  lastSwapA?: BoardPosition | null;
  lastSwapB?: BoardPosition | null;
  checkAiMove?: () => void;
}

// ── Component Props ───────────────────────────────────────────────────────────

export interface GameEngineProps {
  levelConfig: LevelConfig;
  gameState: GameState;
  aiMode: boolean;
  muted: boolean;
  movesLeft: number;
  setMovesLeft: React.Dispatch<React.SetStateAction<number>>;
  collectedCount: Record<string, number>;
  setCollectedCount: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onLevelWin: () => void;
  onLevelLose: () => void;
  playEvent: number;
  showToast: (text: string) => void;
}

export interface HUDProps {
  levelIndex: number;
  maxLevels: number;
  movesLeft: number;
  blockCount: number;
  collectedCount: Record<string, number>;
  aiMode: boolean;
  setAiMode: React.Dispatch<React.SetStateAction<boolean>>;
  muted: boolean;
  toggleMute: () => void;
  restartLevel: () => void;
}

export interface OverlayProps {
  gameState: GameState;
  levelIndex: number;
  movesLeft: number;
  blockCount: number;
  onStart: () => void;
  onNext: () => void;
  onRetry: () => void;
}

// ── Color Definition ──────────────────────────────────────────────────────────

export interface GemColor {
  hex: number;
  css: string;
  name: string;
}
