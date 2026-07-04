import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gameAudio } from '../utils/audio';
import type {
  GameEngineProps,
  EngineState,
  GemCell,
  BlockCell,
  SpecialType,
  Tween,
  Particle,
  HintTween,
  BoardPosition,
  PossibleMove,
  MatchResult,
  SpecialSpawn,
  RunInfo,
  GemColor,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const BOARD_SIZE    = 8;
const TILE_SPACING  = 1.05;
const DRAG_THRESHOLD = 20;

const SWAP_MS          = 200;
const CLEAR_MS         = 200;
const FALL_MS_PER_ROW  = 85;

const COLORS: GemColor[] = [
  { hex: 0xe6395f, css: '#e6395f', name: 'ruby'     },
  { hex: 0xf4b942, css: '#f4b942', name: 'citrine'  },
  { hex: 0x3fae6a, css: '#3fae6a', name: 'emerald'  },
  { hex: 0x3f8cd6, css: '#3f8cd6', name: 'sapphire' },
  { hex: 0xa24fd1, css: '#a24fd1', name: 'amethyst' },
  { hex: 0xf27ab0, css: '#f27ab0', name: 'rose'     },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function GameEngine({
  levelConfig,
  gameState,
  aiMode,
  muted,       // eslint-disable-line @typescript-eslint/no-unused-vars
  movesLeft,
  setMovesLeft,
  collectedCount,
  setCollectedCount,
  onLevelWin,
  onLevelLose,
  playEvent,
  showToast,
}: GameEngineProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<EngineState>({
    gameState,
    aiMode,
    movesLeft,
    collectedCount,
    levelConfig,
    busy: false,
    gameOver: false,
    selected: null,
    dragState: null,
    tweens: [],
    particles: [],
    board: [],
    blocksGrid: [],
    purgedColors: new Set(),
    lastInteractionTime: Date.now(),
    hintActive: false,
    hintTicking: true,
    hintTween: null,
  });

  // Keep ref in sync with React prop updates
  useEffect(() => {
    stateRef.current.gameState      = gameState;
    stateRef.current.aiMode         = aiMode;
    stateRef.current.movesLeft      = movesLeft;
    stateRef.current.collectedCount = collectedCount;
    stateRef.current.levelConfig    = levelConfig;

    if (gameState === 'playing' && stateRef.current.gameOver) {
      stateRef.current.gameOver = false;
    }
  }, [gameState, aiMode, movesLeft, collectedCount, levelConfig]);

  // ── Main engine effect (re-runs only on explicit level change/restart) ──────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width  = container.clientWidth  || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const boardWorldSize = (BOARD_SIZE - 1) * TILE_SPACING;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.up.set(0, 0, -1);

    function adjustCameraDistance(w: number, h: number): void {
      const aspect = w / h;
      camera.aspect = aspect;

      const boardWidthToContain  = BOARD_SIZE * TILE_SPACING + 1.2;
      const boardHeightToContain = BOARD_SIZE * TILE_SPACING + 3.2;

      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const distanceHeight = boardHeightToContain / (2 * Math.tan(fovRad / 2));
      const distanceWidth  = boardWidthToContain  / (2 * aspect * Math.tan(fovRad / 2));

      const targetDistance = Math.max(distanceHeight, distanceWidth, 10.5);

      camera.position.set(0, targetDistance, 0);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    adjustCameraDistance(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(0, 10, 0);
    scene.add(keyLight);
    const shineLight = new THREE.DirectionalLight(0xffffff, 0.3);
    shineLight.position.set(3, 8, -3);
    scene.add(shineLight);

    // Board base + trim
    const baseGeo = new THREE.BoxGeometry(boardWorldSize + 1.2, 0.05, boardWorldSize + 1.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1528, roughness: 0.9, metalness: 0.05 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.55;
    scene.add(base);

    const trimGeo = new THREE.BoxGeometry(boardWorldSize + 1.4, 0.02, boardWorldSize + 1.4);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6, roughness: 0.3, metalness: 0.7,
      emissive: 0x4c1d95, emissiveIntensity: 0.5,
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = -0.54;
    scene.add(trim);

    // Per-cell tile panels
    const cellTileGeo  = new THREE.BoxGeometry(0.97, 0.03, 0.97);
    const cellTileMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d2440, roughness: 0.85, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: 0x251e38, roughness: 0.85, metalness: 0.05 }),
    ];
    for (let tr = 0; tr < BOARD_SIZE; tr++) {
      for (let tc = 0; tc < BOARD_SIZE; tc++) {
        const tileMesh = new THREE.Mesh(cellTileGeo, cellTileMats[(tr + tc) % 2]);
        tileMesh.position.set(
          tc * TILE_SPACING - boardWorldSize / 2,
          -0.52,
          tr * TILE_SPACING - boardWorldSize / 2,
        );
        scene.add(tileMesh);
      }
    }

    const boardGroup = new THREE.Group();
    boardGroup.position.set(-boardWorldSize / 2, 0, -boardWorldSize / 2);
    scene.add(boardGroup);

    // Gem geometries
    const gemGeometries: THREE.IcosahedronGeometry[] = COLORS.map(() => new THREE.IcosahedronGeometry(0.38, 1));
    const stripeGeo  = new THREE.OctahedronGeometry(0.42, 0);
    const rainbowGeo = new THREE.DodecahedronGeometry(0.40, 0);
    const wrappedGeo = new THREE.TorusGeometry(0.28, 0.13, 8, 12);

    const faceMaterials: THREE.MeshStandardMaterial[] = COLORS.map(c =>
      new THREE.MeshStandardMaterial({
        color: c.hex, roughness: 0.05, metalness: 0.4,
        emissive: c.hex, emissiveIntensity: 0.55, flatShading: true,
      })
    );

    const rainbowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.0, metalness: 1.0,
      emissive: 0xff88ff, emissiveIntensity: 1.5, flatShading: true,
    });

    // Block geometries and materials
    const blockGeo = new THREE.BoxGeometry(0.95, 0.04, 0.95);
    const blockMaterials: THREE.MeshStandardMaterial[] = [
      new THREE.MeshStandardMaterial({
        color: 0xc8dde8, roughness: 0.1, metalness: 0.05,
        emissive: 0x8faabb, emissiveIntensity: 0.25, transparent: true, opacity: 0.72,
      }),
      new THREE.MeshStandardMaterial({
        color: 0xf4b942, roughness: 0.15, metalness: 0.7,
        emissive: 0xb87a00, emissiveIntensity: 0.35, transparent: true, opacity: 0.82,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x555580, roughness: 0.35, metalness: 0.6,
        emissive: 0x220044, emissiveIntensity: 0.4, transparent: true, opacity: 0.88,
      }),
    ];

    // Point lights
    const gemLight = new THREE.PointLight(0xffffff, 0.8, 25);
    gemLight.position.set(0, 5, 0);
    scene.add(gemLight);
    const gemLight2 = new THREE.PointLight(0x8866ff, 0.5, 20);
    gemLight2.position.set(-4, 4, -4);
    scene.add(gemLight2);

    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const clock     = new THREE.Clock();

    // ── Board helpers ────────────────────────────────────────────────────────

    function cellPosition(row: number, col: number): THREE.Vector3 {
      return new THREE.Vector3(col * TILE_SPACING, 0, row * TILE_SPACING);
    }

    function pickAllowedType(): number {
      const colorsLimit = stateRef.current.levelConfig.colorsUsed || 5;
      return Math.floor(Math.random() * colorsLimit);
    }

    function createsInitialMatch(row: number, col: number, type: number): boolean {
      const board = stateRef.current.board;
      if (col >= 2 && board[row][col - 1]?.type === type && board[row][col - 2]?.type === type) return true;
      if (row >= 2 && board[row - 1]?.[col]?.type === type && board[row - 2]?.[col]?.type === type) return true;
      return false;
    }

    function makeGemMesh(type: number, row: number, col: number, specialType: SpecialType | null = null): THREE.Mesh {
      let mat: THREE.Material;
      let geo: THREE.BufferGeometry;

      if (specialType === 'color_bomb') {
        geo = rainbowGeo;
        mat = rainbowMat;
      } else if (specialType === 'wrapped') {
        geo = wrappedGeo;
        mat = new THREE.MeshStandardMaterial({
          color: 0xffd700, roughness: 0.04, metalness: 0.95,
          emissive: COLORS[type].hex, emissiveIntensity: 0.85, flatShading: false,
        });
      } else if (specialType === 'striped_h' || specialType === 'striped_v') {
        geo = stripeGeo;
        mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.05, metalness: 0.9,
          emissive: COLORS[type].hex, emissiveIntensity: 0.9, flatShading: true,
        });
      } else {
        geo = gemGeometries[type];
        mat = faceMaterials[type].clone();
        (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
      }

      const mesh = new THREE.Mesh(geo, mat);
      const pos  = cellPosition(row, col);
      mesh.position.copy(pos);
      mesh.rotation.set(0, 0, 0);
      mesh.userData = { row, col, type, special: specialType, phase: (row * BOARD_SIZE + col) * 0.37 };
      mesh.scale.set(1, 1, 1);

      if (specialType === 'striped_h' || specialType === 'striped_v') {
        const stripeLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.85 });
        const stripePoints = [
          new THREE.Vector3(-0.45, 0, 0), new THREE.Vector3(0.45, 0, 0),
          new THREE.Vector3(0, -0.45, 0), new THREE.Vector3(0, 0.45, 0),
          new THREE.Vector3(-0.32, -0.32, 0), new THREE.Vector3(0.32, 0.32, 0),
        ];
        const stripeGeoLines = new THREE.BufferGeometry().setFromPoints(stripePoints);
        const stripeLines    = new THREE.LineSegments(stripeGeoLines, stripeLineMat);
        if (specialType === 'striped_v') stripeLines.rotation.z = Math.PI / 2;
        mesh.add(stripeLines);
        mesh.userData._stripeLines = stripeLines;
      }

      boardGroup.add(mesh);
      return mesh;
    }

    function spawnParticles(position: THREE.Vector3, color: number, count = 12, size = 0.12): void {
      const pGeo = new THREE.IcosahedronGeometry(size, 0);
      const pMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.6, roughness: 0.1, flatShading: true,
      });

      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(pGeo, pMat);
        mesh.position.copy(position);
        mesh.position.x += (Math.random() - 0.5) * 0.3;
        mesh.position.y += (Math.random() - 0.5) * 0.3;
        mesh.position.z += (Math.random() - 0.5) * 0.3;

        boardGroup.add(mesh);

        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          0,
          (Math.random() - 0.5) * 5 - 1.5,
        );

        const particle: Particle = {
          mesh, velocity, gravity: -9.8,
          life: 0.5 + Math.random() * 0.45,
          maxLife: 1.0, scaleDecay: 1.2,
        };
        stateRef.current.particles.push(particle);
      }
    }

    // ── Near-miss seeding (Fix B) ────────────────────────────────────────────
    // After board generation, deliberately plant patterns like A A _ A so the
    // player can complete a 4-in-a-row with a single swap. This guarantees
    // special gems are reachable in the first few moves.
    function plantNearMisses(): void {
      const state = stateRef.current;
      const board = state.board;
      const colorsLimit = state.levelConfig.colorsUsed || 5;
      let planted = 0;
      const TARGET_PLANTS = 3;
      const MAX_ATTEMPTS  = 20;

      for (let attempt = 0; attempt < MAX_ATTEMPTS && planted < TARGET_PLANTS; attempt++) {
        const isRow = Math.random() > 0.5;

        if (isRow) {
          // Pattern: [seed seed gap seed] → swapping gap with neighbour = 4-in-a-row
          // gap position is index 2: A A _ A  (swap col+2 ↔ col+3 reveals A A A A)
          const r      = Math.floor(Math.random() * BOARD_SIZE);
          const startC = Math.floor(Math.random() * (BOARD_SIZE - 3));
          const [c0, c1, c2, c3] = [startC, startC + 1, startC + 2, startC + 3];

          const cells = [board[r][c0], board[r][c1], board[r][c2], board[r][c3]];
          if (cells.some(c => !c)) continue;

          const seedColor = cells[0]!.type;
          const gapColor  = (seedColor + 1) % colorsLimit;

          // Avoid creating a 3-run at c0/c1 in column direction
          const colConflict =
            (r >= 1 && board[r - 1][c0]?.type === seedColor && board[r - 1][c1]?.type === seedColor) ||
            (r < BOARD_SIZE - 1 && board[r + 1][c0]?.type === seedColor && board[r + 1][c1]?.type === seedColor);
          if (colConflict) continue;

          cells[0]!.type = seedColor;
          cells[1]!.type = seedColor;
          cells[2]!.type = gapColor;   // gap: different colour
          cells[3]!.type = seedColor;  // matching tail — swapping c2↔c3 completes 4
          planted++;
        } else {
          // Column variant: same idea down rows
          const c      = Math.floor(Math.random() * BOARD_SIZE);
          const startR = Math.floor(Math.random() * (BOARD_SIZE - 3));
          const [r0, r1, r2, r3] = [startR, startR + 1, startR + 2, startR + 3];

          const cells = [board[r0]?.[c], board[r1]?.[c], board[r2]?.[c], board[r3]?.[c]];
          if (cells.some(cell => !cell)) continue;

          const seedColor = cells[0]!.type;
          const gapColor  = (seedColor + 1) % colorsLimit;

          const rowConflict =
            (c >= 1 && board[r0][c - 1]?.type === seedColor && board[r1][c - 1]?.type === seedColor) ||
            (c < BOARD_SIZE - 1 && board[r0][c + 1]?.type === seedColor && board[r1][c + 1]?.type === seedColor);
          if (rowConflict) continue;

          cells[0]!.type = seedColor;
          cells[1]!.type = seedColor;
          cells[2]!.type = gapColor;
          cells[3]!.type = seedColor;
          planted++;
        }
      }

      // Sync all mesh materials to updated cell types
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = board[r][c];
          if (cell) {
            cell.mesh.geometry = gemGeometries[cell.type];
            const newMat = faceMaterials[cell.type].clone();
            newMat.emissiveIntensity = 0.55;
            cell.mesh.material = newMat;
            cell.mesh.userData.type = cell.type;
          }
        }
      }
    }

    // ── Board setup ──────────────────────────────────────────────────────────

    function setupBoard(): void {
      const lvl = stateRef.current.levelConfig;
      stateRef.current.purgedColors.clear();
      stateRef.current.selected  = null;
      stateRef.current.busy      = false;
      stateRef.current.tweens    = [];
      stateRef.current.particles = [];
      clearBoardMeshes();

      // Blocks grid
      const grid: (BlockCell | null)[][] = [];
      for (let r = 0; r < BOARD_SIZE; r++) grid.push(new Array(BOARD_SIZE).fill(null));
      stateRef.current.blocksGrid = grid;

      const targetBlockCount = Math.min(BOARD_SIZE * BOARD_SIZE - 4, lvl.blockCount || 0);
      if (targetBlockCount > 0) {
        const slots: { r: number; c: number }[] = [];
        for (let r = 1; r < BOARD_SIZE - 1; r++)
          for (let c = 1; c < BOARD_SIZE - 1; c++)
            slots.push({ r, c });

        // Fisher-Yates shuffle
        for (let i = slots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }

        for (let i = 0; i < targetBlockCount; i++) {
          const slot    = slots[i];
          const maxD    = lvl.blockMaxDurability || 1;
          const durability = Math.floor(Math.random() * maxD) + 1;

          const mesh = new THREE.Mesh(blockGeo, blockMaterials[durability - 1]);
          const wPos = cellPosition(slot.r, slot.c);
          wPos.y = -0.48;
          mesh.position.copy(wPos);
          boardGroup.add(mesh);

          stateRef.current.blocksGrid[slot.r][slot.c] = { durability, mesh };
        }
      }

      // Gems board
      const gemsBoard: (GemCell | null)[][] = [];
      for (let r = 0; r < BOARD_SIZE; r++) gemsBoard.push(new Array(BOARD_SIZE).fill(null));
      stateRef.current.board = gemsBoard;

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          let tries = 0;
          let type  = pickAllowedType();
          while (tries < 50 && createsInitialMatch(r, c, type)) {
            type = pickAllowedType();
            tries++;
          }
          stateRef.current.board[r][c] = { type, mesh: makeGemMesh(type, r, c) };
        }
      }

      // FIX B — plant near-miss patterns so 4-in-a-row specials are reachable
      plantNearMisses();

      // Safeguard: ensure at least one valid swap exists
      let possibleMoves = findPossibleMoves();
      let reshuffleLimit = 0;
      while (possibleMoves.length === 0 && reshuffleLimit < 10) {
        reshuffleBoardDirect();
        possibleMoves = findPossibleMoves();
        reshuffleLimit++;
      }
    }

    function clearBoardMeshes(): void {
      const b = stateRef.current.board;
      if (b) {
        for (let r = 0; r < BOARD_SIZE; r++)
          for (let c = 0; c < BOARD_SIZE; c++)
            if (b[r]?.[c]?.mesh) boardGroup.remove(b[r][c]!.mesh);
      }

      const bl = stateRef.current.blocksGrid;
      if (bl) {
        for (let r = 0; r < BOARD_SIZE; r++)
          for (let c = 0; c < BOARD_SIZE; c++)
            if (bl[r]?.[c]?.mesh) boardGroup.remove(bl[r][c]!.mesh);
      }

      stateRef.current.particles.forEach(pt => boardGroup.remove(pt.mesh));
    }

    // ── Tweens & physics ────────────────────────────────────────────────────

    function tweenTo(
      mesh: THREE.Mesh,
      targetPos: THREE.Vector3,
      duration: number,
      opts: { toScale?: THREE.Vector3; onComplete?: () => void } = {},
    ): void {
      const tween: Tween = {
        mesh, duration, elapsed: 0,
        fromPos:   mesh.position.clone(),
        toPos:     targetPos.clone(),
        fromScale: mesh.scale.clone(),
        toScale:   opts.toScale ? opts.toScale.clone() : mesh.scale.clone(),
        onComplete: opts.onComplete ?? null,
      };
      stateRef.current.tweens.push(tween);
    }

    function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }

    function updatePhysicsAndTweens(delta: number): void {
      const state = stateRef.current;

      if (state.tweens.length > 0) {
        const remaining: Tween[] = [];
        for (const tw of state.tweens) {
          tw.elapsed += delta * 1000;
          const t  = Math.min(tw.elapsed / tw.duration, 1);
          const et = easeOutQuad(t);
          if (tw.mesh) {
            tw.mesh.position.lerpVectors(tw.fromPos, tw.toPos, et);
            tw.mesh.scale.lerpVectors(tw.fromScale, tw.toScale, et);
          }
          if (t >= 1) { if (tw.onComplete) tw.onComplete(); }
          else remaining.push(tw);
        }
        state.tweens = remaining;
      }

      if (state.particles.length > 0) {
        const remainingParticles: Particle[] = [];
        for (const p of state.particles) {
          p.life -= delta;
          p.velocity.z -= p.gravity * delta;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.rotation.x += delta * 4;
          p.mesh.rotation.y += delta * 5;
          const pct = Math.max(0, p.life / p.maxLife);
          const cs  = pct * p.scaleDecay;
          p.mesh.scale.set(cs, cs, cs);
          if (p.life <= 0) boardGroup.remove(p.mesh);
          else remainingParticles.push(p);
        }
        state.particles = remainingParticles;
      }

      if (state.gameState === 'playing' && !state.busy && !state.gameOver && !state.aiMode) {
        const elapsedIdle = Date.now() - state.lastInteractionTime;
        if (elapsedIdle > 6000 && !state.hintActive) triggerHint();
      }
    }

    // ── Match logic ──────────────────────────────────────────────────────────

    function findMatches(): MatchResult {
      const state   = stateRef.current;
      const matched = new Set<string>();
      const squareBlastKeys = new Set<string>();

      const rowMatches: RunInfo[] = [];
      const colMatches: RunInfo[] = [];

      // Row runs
      for (let r = 0; r < BOARD_SIZE; r++) {
        let runStart = 0;
        for (let c = 1; c <= BOARD_SIZE; c++) {
          const sameAsStart = c < BOARD_SIZE &&
            state.board[r][c] != null && state.board[r][runStart] != null &&
            state.board[r][c]!.type === state.board[r][runStart]!.type;

          if (c === BOARD_SIZE || !sameAsStart) {
            const len = c - runStart;
            if (len >= 3) {
              const runKeys: string[] = [];
              for (let k = runStart; k < c; k++) runKeys.push(`${r},${k}`);
              rowMatches.push({ len, keys: runKeys, color: state.board[r][runStart]!.type, r, runStart, runEnd: c });
            }
            runStart = c;
          }
        }
      }

      // Column runs
      for (let c = 0; c < BOARD_SIZE; c++) {
        let runStart = 0;
        for (let r = 1; r <= BOARD_SIZE; r++) {
          const sameAsStart = r < BOARD_SIZE &&
            state.board[r]?.[c] != null && state.board[runStart]?.[c] != null &&
            state.board[r]![c]!.type === state.board[runStart]![c]!.type;

          if (r === BOARD_SIZE || !sameAsStart) {
            const len = r - runStart;
            if (len >= 3) {
              const runKeys: string[] = [];
              for (let k = runStart; k < r; k++) runKeys.push(`${k},${c}`);
              colMatches.push({ len, keys: runKeys, color: state.board[runStart]![c]!.type, c, runStart, runEnd: r });
            }
            runStart = r;
          }
        }
      }

      // 2×2 square detection → area blast
      for (let r = 0; r < BOARD_SIZE - 1; r++) {
        for (let c = 0; c < BOARD_SIZE - 1; c++) {
          const a = state.board[r][c];
          const b = state.board[r][c + 1];
          const d = state.board[r + 1][c];
          const e = state.board[r + 1][c + 1];
          if (a && b && d && e && a.type === b.type && a.type === d.type && a.type === e.type) {
            matched.add(`${r},${c}`);
            matched.add(`${r},${c + 1}`);
            matched.add(`${r + 1},${c}`);
            matched.add(`${r + 1},${c + 1}`);
            for (let br = r - 1; br <= r + 2; br++) {
              for (let bc = c - 1; bc <= c + 2; bc++) {
                if (br >= 0 && br < BOARD_SIZE && bc >= 0 && bc < BOARD_SIZE && state.board[br][bc]) {
                  matched.add(`${br},${bc}`);
                  squareBlastKeys.add(`${br},${bc}`);
                }
              }
            }
          }
        }
      }

      // Add run cells
      rowMatches.forEach(rm => rm.keys.forEach(k => matched.add(k)));
      colMatches.forEach(cm => cm.keys.forEach(k => matched.add(k)));

      // L/T intersections → wrapped gem
      const ltIntersections = new Map<string, { r: number; c: number; color: number }>();
      rowMatches.forEach(rm => {
        if (rm.len >= 5) return; // 5-in-a-row → color_bomb, not wrapped
        colMatches.forEach(cm => {
          if (cm.len >= 5) return;
          if (rm.color !== cm.color) return;
          const sharedKey = rm.keys.find(k => cm.keys.includes(k));
          if (sharedKey && !ltIntersections.has(sharedKey)) {
            const [ri, ci] = sharedKey.split(',').map(Number);
            ltIntersections.set(sharedKey, { r: ri, c: ci, color: rm.color });
          }
        });
      });

      // Special crystal spawning
      const specialsToSpawn: SpecialSpawn[] = [];
      const spawnSlots = new Set<string>();

      ltIntersections.forEach((info, key) => {
        specialsToSpawn.push({ r: info.r, c: info.c, colorType: info.color, specialType: 'wrapped' });
        spawnSlots.add(key);
        showToast('🔶 WRAPPED GEM!');
      });

      function pickSpawnInRun(isRow: boolean, lineIdx: number, runStart: number, runEnd: number): number {
        if (isRow) {
          const r = lineIdx;
          if (stateRef.current.lastSwapA?.row === r && (stateRef.current.lastSwapA.col ?? -1) >= runStart && (stateRef.current.lastSwapA.col ?? -1) < runEnd) return stateRef.current.lastSwapA!.col;
          if (stateRef.current.lastSwapB?.row === r && (stateRef.current.lastSwapB.col ?? -1) >= runStart && (stateRef.current.lastSwapB.col ?? -1) < runEnd) return stateRef.current.lastSwapB!.col;
          return Math.floor((runStart + runEnd - 1) / 2);
        } else {
          const c = lineIdx;
          if (stateRef.current.lastSwapA?.col === c && (stateRef.current.lastSwapA.row ?? -1) >= runStart && (stateRef.current.lastSwapA.row ?? -1) < runEnd) return stateRef.current.lastSwapA!.row;
          if (stateRef.current.lastSwapB?.col === c && (stateRef.current.lastSwapB.row ?? -1) >= runStart && (stateRef.current.lastSwapB.row ?? -1) < runEnd) return stateRef.current.lastSwapB!.row;
          return Math.floor((runStart + runEnd - 1) / 2);
        }
      }

      rowMatches.forEach(rm => {
        if (rm.len < 4) return;
        const spawnC = pickSpawnInRun(true, rm.r!, rm.runStart, rm.runEnd);
        const key    = `${rm.r},${spawnC}`;
        if (spawnSlots.has(key)) return;
        const sType: SpecialType = rm.len >= 5 ? 'color_bomb' : 'striped_h';
        specialsToSpawn.push({ r: rm.r!, c: spawnC, colorType: rm.color, specialType: sType });
        spawnSlots.add(key);
        showToast(sType === 'color_bomb' ? '✨ RAINBOW CRYSTAL!' : '⚡ STRIPED CRYSTAL!');
      });

      colMatches.forEach(cm => {
        if (cm.len < 4) return;
        const spawnR = pickSpawnInRun(false, cm.c!, cm.runStart, cm.runEnd);
        const key    = `${spawnR},${cm.c}`;
        if (spawnSlots.has(key)) return;
        const sType: SpecialType = cm.len >= 5 ? 'color_bomb' : 'striped_v';
        specialsToSpawn.push({ r: spawnR, c: cm.c!, colorType: cm.color, specialType: sType });
        spawnSlots.add(key);
        showToast(sType === 'color_bomb' ? '✨ RAINBOW CRYSTAL!' : '⚡ STRIPED CRYSTAL!');
      });

      if (squareBlastKeys.size > 0) showToast('💥 SQUARE BLAST!');

      return { matched, specialsToSpawn };
    }

    // FIX A — checkMatchesOnly now also detects 2×2 squares (consistent with findMatches)
    function checkMatchesOnly(): number {
      const state   = stateRef.current;
      const matched = new Set<string>();

      for (let r = 0; r < BOARD_SIZE; r++) {
        let runStart = 0;
        for (let c = 1; c <= BOARD_SIZE; c++) {
          const sameAsStart = c < BOARD_SIZE &&
            state.board[r][c] != null && state.board[r][runStart] != null &&
            state.board[r][c]!.type === state.board[r][runStart]!.type;
          if (c === BOARD_SIZE || !sameAsStart) {
            if (c - runStart >= 3) for (let k = runStart; k < c; k++) matched.add(`${r},${k}`);
            runStart = c;
          }
        }
      }
      for (let c = 0; c < BOARD_SIZE; c++) {
        let runStart = 0;
        for (let r = 1; r <= BOARD_SIZE; r++) {
          const sameAsStart = r < BOARD_SIZE &&
            state.board[r]?.[c] != null && state.board[runStart]?.[c] != null &&
            state.board[r]![c]!.type === state.board[runStart]![c]!.type;
          if (r === BOARD_SIZE || !sameAsStart) {
            if (r - runStart >= 3) for (let k = runStart; k < r; k++) matched.add(`${k},${c}`);
            runStart = r;
          }
        }
      }
      // FIX A: also count 2×2 squares
      for (let r = 0; r < BOARD_SIZE - 1; r++) {
        for (let c = 0; c < BOARD_SIZE - 1; c++) {
          const a = state.board[r][c];
          const b = state.board[r][c + 1];
          const d = state.board[r + 1][c];
          const e = state.board[r + 1][c + 1];
          if (a && b && d && e && a.type === b.type && a.type === d.type && a.type === e.type) {
            matched.add(`${r},${c}`); matched.add(`${r},${c + 1}`);
            matched.add(`${r + 1},${c}`); matched.add(`${r + 1},${c + 1}`);
          }
        }
      }
      return matched.size;
    }

    // ── Match resolution ─────────────────────────────────────────────────────

    function resolveMatches(matchResult: MatchResult, comboMultiplier: number): void {
      const state   = stateRef.current;
      const matched = matchResult.matched;
      state.busy = true;

      // Expand specials recursively
      let expanded = true;
      const processedSpecials = new Set<string>();
      while (expanded) {
        expanded = false;
        const list = Array.from(matched);
        for (const key of list) {
          if (processedSpecials.has(key)) continue;
          const [r, c] = key.split(',').map(Number);
          const cell   = state.board[r]?.[c];
          if (cell?.special) {
            processedSpecials.add(key);
            expanded = true;
            const sType = cell.special;
            if (sType === 'wrapped') {
              showToast('🔶 WRAPPED BLAST!');
              for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = r + dr, nc = c + dc;
                  if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) matched.add(`${nr},${nc}`);
                }
            } else if (sType === 'striped_h') {
              showToast('ROW BLAST!');
              for (let col = 0; col < BOARD_SIZE; col++) matched.add(`${r},${col}`);
            } else if (sType === 'striped_v') {
              showToast('COLUMN BLAST!');
              for (let row = 0; row < BOARD_SIZE; row++) matched.add(`${row},${c}`);
            } else if (sType === 'bomb') {
              showToast('COSMIC BLAST!');
              for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = r + dr, nc = c + dc;
                  if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) matched.add(`${nr},${nc}`);
                }
            } else if (sType === 'color_bomb') {
              showToast('HYPERNOVA BLAST!');
              const targetColor = cell.type;
              for (let row = 0; row < BOARD_SIZE; row++)
                for (let col = 0; col < BOARD_SIZE; col++)
                  if (state.board[row][col]?.type === targetColor) matched.add(`${row},${col}`);
            }
          }
        }
      }

      state.lastSwapA = null;
      state.lastSwapB = null;

      gameAudio.playMatch(comboMultiplier);
      if (comboMultiplier > 1) showToast(`x${comboMultiplier} COMBO!`);

      const newCollected = { ...state.collectedCount };
      matched.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const cell   = state.board[r]?.[c];
        if (cell) newCollected[cell.type] = (newCollected[cell.type] || 0) + 1;
      });

      let blocksDamaged = false;
      let blocksClearedThisTurn = 0;
      matched.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const b = state.blocksGrid[r]?.[c];
        if (b) {
          b.durability--;
          blocksDamaged = true;
          spawnParticles(b.mesh.position, 0xaaaaaa, 10, 0.08);
          if (b.durability <= 0) {
            tweenTo(b.mesh, b.mesh.position, CLEAR_MS, {
              toScale: new THREE.Vector3(0.001, 0.001, 0.001),
              onComplete: () => boardGroup.remove(b.mesh),
            });
            state.blocksGrid[r][c] = null;
            blocksClearedThisTurn++;
          } else {
            b.mesh.material = blockMaterials[b.durability - 1];
          }
        }
      });

      if (blocksClearedThisTurn > 0) newCollected['blocks'] = (newCollected['blocks'] || 0) + blocksClearedThisTurn;
      setCollectedCount(newCollected);
      if (blocksDamaged) gameAudio.playBlockBreak();

      const specials    = matchResult.specialsToSpawn ?? [];
      const specialSpawnMap: Record<string, SpecialSpawn> = {};
      specials.forEach(s => { specialSpawnMap[`${s.r},${s.c}`] = s; });

      let toRemove = matched.size;
      matched.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const cell   = state.board[r]?.[c];

        if (!cell) {
          toRemove--;
          if (toRemove === 0) { spawnPendingSpecials(specials); collapseAndRefill(comboMultiplier); }
          return;
        }

        spawnParticles(cell.mesh.position, COLORS[cell.type].hex, 14, 0.1);

        if (specialSpawnMap[key]) {
          boardGroup.remove(cell.mesh);
          toRemove--;
          state.board[r][c] = null;
          if (toRemove === 0) { spawnPendingSpecials(specials); collapseAndRefill(comboMultiplier); }
          return;
        }

        tweenTo(cell.mesh, cell.mesh.position, CLEAR_MS, {
          toScale: new THREE.Vector3(0.001, 0.001, 0.001),
          onComplete: () => {
            boardGroup.remove(cell.mesh);
            toRemove--;
            if (toRemove === 0) { spawnPendingSpecials(specials); collapseAndRefill(comboMultiplier); }
          },
        });
        state.board[r][c] = null;
      });
    }

    function spawnPendingSpecials(specials: SpecialSpawn[]): void {
      if (!specials) return;
      const state = stateRef.current;
      specials.forEach(s => {
        if (state.board[s.r][s.c] === null) {
          const mesh = makeGemMesh(s.colorType, s.r, s.c, s.specialType);
          mesh.scale.set(0.001, 0.001, 0.001);
          const targetScale = s.specialType === 'color_bomb' ? 1.4 : (s.specialType === 'bomb' ? 1.3 : 1.22);
          tweenTo(mesh, mesh.position, 220, { toScale: new THREE.Vector3(targetScale, targetScale, targetScale) });
          state.board[s.r][s.c] = { type: s.colorType, special: s.specialType, mesh };
        }
      });
    }

    function collapseAndRefill(comboMultiplier: number): void {
      const state = stateRef.current;
      const pendingTweens: { mesh: THREE.Mesh; targetPos: THREE.Vector3; dist: number }[] = [];

      for (let c = 0; c < BOARD_SIZE; c++) {
        let writeRow = BOARD_SIZE - 1;
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
          if (state.board[r][c]) {
            if (writeRow !== r) {
              state.board[writeRow][c] = state.board[r][c];
              state.board[r][c] = null;
              state.board[writeRow][c]!.mesh.userData.row = writeRow;
              const targetPos = cellPosition(writeRow, c);
              pendingTweens.push({ mesh: state.board[writeRow][c]!.mesh, targetPos, dist: writeRow - r });
            }
            writeRow--;
          }
        }

        for (let r = writeRow; r >= 0; r--) {
          const type = pickAllowedType();
          const mesh = makeGemMesh(type, r, c);
          const spawnAbove = cellPosition(r, c);
          spawnAbove.z = -1.25 - (writeRow - r) * TILE_SPACING;
          spawnAbove.y = 0;
          mesh.position.copy(spawnAbove);
          state.board[r][c] = { type, mesh };
          const targetPos = cellPosition(r, c);
          pendingTweens.push({ mesh, targetPos, dist: (writeRow - r) + 3 });
        }
      }

      if (pendingTweens.length === 0) { finishCascadeStep(comboMultiplier); return; }

      let remaining = pendingTweens.length;
      pendingTweens.forEach(pt => {
        const dur = 180 + pt.dist * FALL_MS_PER_ROW;
        tweenTo(pt.mesh, pt.targetPos, dur, {
          onComplete: () => { remaining--; if (remaining === 0) finishCascadeStep(comboMultiplier); },
        });
      });
    }

    function finishCascadeStep(comboMultiplier: number): void {
      const next = findMatches();
      if (next.matched.size > 0) resolveMatches(next, comboMultiplier + 1);
      else afterCascadeSettled();
    }

    function afterCascadeSettled(): void {
      const state = stateRef.current;
      state.busy = false;
      evaluateLevelEnd();
      if (!state.gameOver && findPossibleMoves().length === 0) triggerShuffle();
      else if (!state.gameOver && state.aiMode) checkAiMove();
    }

    function evaluateLevelEnd(): void {
      const state      = stateRef.current;
      const blockCount = state.levelConfig.blockCount || 0;
      const allBlocksMet = blockCount === 0 || (state.collectedCount['blocks'] || 0) >= blockCount;

      if (allBlocksMet) {
        state.gameOver = true;
        gameAudio.playWin();
        onLevelWin();
        return;
      }

      if (state.movesLeft <= 0) {
        state.gameOver = true;
        gameAudio.playLose();
        onLevelLose();
      }
    }

    // ── Shuffle ──────────────────────────────────────────────────────────────

    function triggerShuffle(): void {
      const state = stateRef.current;
      state.busy = true;
      showToast('NO MOVES! SHUFFLING...');

      const cellsToShuffle: GemCell[] = [];
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
          if (state.board[r][c]) cellsToShuffle.push(state.board[r][c]!);

      if (cellsToShuffle.length === 0) { state.busy = false; return; }

      let finishedDown = 0;
      const onAllDown = () => {
        reshuffleBoardDirect();
        let finishedUp = 0;
        cellsToShuffle.forEach(cell => {
          cell.mesh.geometry = gemGeometries[cell.type];
          cell.mesh.material = faceMaterials[cell.type];
          cell.mesh.userData.type = cell.type;
          const targetPos = cellPosition(cell.mesh.userData.row as number, cell.mesh.userData.col as number);
          cell.mesh.position.copy(targetPos);
          tweenTo(cell.mesh, targetPos, 300, {
            toScale: new THREE.Vector3(1, 1, 1),
            onComplete: () => {
              finishedUp++;
              if (finishedUp === cellsToShuffle.length) {
                state.busy = false;
                clearHintVisual();
                if (state.aiMode) checkAiMove();
              }
            },
          });
        });
      };

      cellsToShuffle.forEach(cell => {
        tweenTo(cell.mesh, cell.mesh.position, 300, {
          toScale: new THREE.Vector3(0.001, 0.001, 0.001),
          onComplete: () => { finishedDown++; if (finishedDown === cellsToShuffle.length) onAllDown(); },
        });
      });
    }

    function reshuffleBoardDirect(): void {
      const state = stateRef.current;
      const cellsToShuffle: GemCell[] = [];
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
          if (state.board[r][c]) cellsToShuffle.push(state.board[r][c]!);

      let attempts = 0;
      let success  = false;

      while (attempts < 150) {
        const types = cellsToShuffle.map(cell => cell.type);
        for (let i = types.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [types[i], types[j]] = [types[j], types[i]];
        }

        let idx = 0;
        for (let r = 0; r < BOARD_SIZE; r++)
          for (let c = 0; c < BOARD_SIZE; c++)
            if (state.board[r][c]) state.board[r][c]!.type = types[idx++];

        if (checkMatchesOnly() === 0 && findPossibleMoves().length > 0) { success = true; break; }
        attempts++;
      }

      if (!success) {
        for (let r = 0; r < BOARD_SIZE; r++)
          for (let c = 0; c < BOARD_SIZE; c++)
            if (state.board[r][c]) {
              let tries = 0;
              let type  = pickAllowedType();
              while (tries < 20 && createsInitialMatch(r, c, type)) { type = pickAllowedType(); tries++; }
              state.board[r][c]!.type = type;
            }
      }
    }

    // ── AI / Move-finding ────────────────────────────────────────────────────

    function findPossibleMoves(): PossibleMove[] {
      const state = stateRef.current;
      const moves: PossibleMove[] = [];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 1; c++) {
          if (state.board[r][c] && state.board[r][c + 1]) {
            const temp = state.board[r][c];
            state.board[r][c] = state.board[r][c + 1];
            state.board[r][c + 1] = temp;
            const count = checkMatchesOnly();
            if (count > 0) moves.push({ a: { row: r, col: c }, b: { row: r, col: c + 1 }, count });
            state.board[r][c + 1] = state.board[r][c];
            state.board[r][c]     = temp;
          }
        }
      }
      for (let r = 0; r < BOARD_SIZE - 1; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (state.board[r][c] && state.board[r + 1][c]) {
            const temp = state.board[r][c];
            state.board[r][c]     = state.board[r + 1][c];
            state.board[r + 1][c] = temp;
            const count = checkMatchesOnly();
            if (count > 0) moves.push({ a: { row: r, col: c }, b: { row: r + 1, col: c }, count });
            state.board[r + 1][c] = state.board[r][c];
            state.board[r][c]     = temp;
          }
        }
      }
      return moves;
    }

    function checkAiMove(): void {
      const state = stateRef.current;
      if (!state.aiMode || state.busy || state.gameOver || state.gameState !== 'playing') return;

      setTimeout(() => {
        if (!state.aiMode || state.busy || state.gameOver || state.gameState !== 'playing') return;
        const moves = findPossibleMoves();
        if (moves.length === 0) { triggerShuffle(); return; }

        let bestMove: PossibleMove | null = null;
        let bestWeight = -1;

        moves.forEach(m => {
          const temp = state.board[m.a.row][m.a.col];
          state.board[m.a.row][m.a.col] = state.board[m.b.row][m.b.col];
          state.board[m.b.row][m.b.col] = temp;

          let weight = m.count * 1.5;
          const matchedSet = new Set<string>();

          for (let r = 0; r < BOARD_SIZE; r++) {
            let runStart = 0;
            for (let c = 1; c <= BOARD_SIZE; c++) {
              const same = c < BOARD_SIZE && state.board[r][c] && state.board[r][runStart] && state.board[r][c]!.type === state.board[r][runStart]!.type;
              if (c === BOARD_SIZE || !same) {
                if (c - runStart >= 3) for (let k = runStart; k < c; k++) matchedSet.add(`${r},${k}`);
                runStart = c;
              }
            }
          }
          for (let c = 0; c < BOARD_SIZE; c++) {
            let runStart = 0;
            for (let r = 1; r <= BOARD_SIZE; r++) {
              const same = r < BOARD_SIZE && state.board[r]?.[c] && state.board[runStart]?.[c] && state.board[r]![c]!.type === state.board[runStart]![c]!.type;
              if (r === BOARD_SIZE || !same) {
                if (r - runStart >= 3) for (let k = runStart; k < r; k++) matchedSet.add(`${k},${c}`);
                runStart = r;
              }
            }
          }

          matchedSet.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const cell   = state.board[r]?.[c];
            if (cell) weight += 2;
          });

          state.board[m.b.row][m.b.col] = state.board[m.a.row][m.a.col];
          state.board[m.a.row][m.a.col] = temp;

          if (weight > bestWeight) { bestWeight = weight; bestMove = m; }
        });

        if (bestMove) attemptSwap((bestMove as PossibleMove).a, (bestMove as PossibleMove).b);
      }, 700);
    }

    // ── Hint system ──────────────────────────────────────────────────────────

    function triggerHint(): void {
      const state = stateRef.current;
      if (state.busy || state.gameOver || state.aiMode || state.gameState !== 'playing') return;

      const moves = findPossibleMoves();
      if (moves.length === 0) return;

      const move = moves[Math.floor(Math.random() * moves.length)];
      state.hintActive = true;

      const gemA = state.board[move.a.row][move.a.col];
      const gemB = state.board[move.b.row][move.b.col];

      if (gemA && gemB) {
        const ht: HintTween = {
          gemA: gemA.mesh,
          gemB: gemB.mesh,
          baseYA: gemA.mesh.position.y,
          baseYB: gemB.mesh.position.y,
          timer: 0,
        };
        state.hintTween = ht;
      }
    }

    function updateHintBounce(delta: number): void {
      const state = stateRef.current;
      if (!state.hintActive || !state.hintTween) return;
      const ht = state.hintTween;
      ht.timer += delta * 5;
      const bounce = Math.abs(Math.sin(ht.timer)) * 0.28;
      if (ht.gemA) ht.gemA.position.y = ht.baseYA + bounce;
      if (ht.gemB) ht.gemB.position.y = ht.baseYB + bounce;
    }

    function clearHintVisual(): void {
      const state = stateRef.current;
      state.lastInteractionTime = Date.now();
      if (state.hintActive && state.hintTween) {
        const ht = state.hintTween;
        if (ht.gemA) ht.gemA.position.y = ht.baseYA || 0;
        if (ht.gemB) ht.gemB.position.y = ht.baseYB || 0;
      }
      state.hintActive = false;
      state.hintTween  = null;
    }

    // ── Input handling ───────────────────────────────────────────────────────

    function getTileFromEvent(evt: PointerEvent | TouchEvent): BoardPosition | null {
      const rect    = renderer.domElement.getBoundingClientRect();
      const clientX = (evt as PointerEvent).clientX ?? ((evt as TouchEvent).touches?.[0]?.clientX);
      const clientY = (evt as PointerEvent).clientY ?? ((evt as TouchEvent).touches?.[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return null;

      mouse.x = ((clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const meshes: THREE.Mesh[] = [];
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
          if (stateRef.current.board[r]?.[c]) meshes.push(stateRef.current.board[r][c]!.mesh);

      const hits = raycaster.intersectObjects(meshes);
      if (hits.length === 0) return null;
      const { row, col } = hits[0].object.userData as { row: number; col: number };
      return { row, col };
    }

    function attemptSwap(a: BoardPosition, b: BoardPosition): void {
      const state = stateRef.current;
      state.busy = true;
      state.lastSwapA = a;
      state.lastSwapB = b;

      const cellA = state.board[a.row][a.col];
      const cellB = state.board[b.row][b.col];
      if (!cellA || !cellB) { state.busy = false; return; }

      const posA = cellPosition(a.row, a.col);
      const posB = cellPosition(b.row, b.col);

      let finished = 0;
      const onBothDone = () => {
        finished++;
        if (finished < 2) return;

        state.board[a.row][a.col] = cellB;
        state.board[b.row][b.col] = cellA;
        cellB.mesh.userData.row = a.row; cellB.mesh.userData.col = a.col;
        cellA.mesh.userData.row = b.row; cellA.mesh.userData.col = b.col;

        const isAColorBomb = cellA.special === 'color_bomb';
        const isBColorBomb = cellB.special === 'color_bomb';
        const isAStriped   = cellA.special === 'striped_h' || cellA.special === 'striped_v';
        const isBStriped   = cellB.special === 'striped_h' || cellB.special === 'striped_v';
        const isAWrapped   = cellA.special === 'wrapped';
        const isBWrapped   = cellB.special === 'wrapped';
        const isASpecial   = isAColorBomb || isAStriped || isAWrapped;
        const isBSpecial   = isBColorBomb || isBStriped || isBWrapped;

        function blastArea(row: number, col: number, m: Set<string>): void {
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const nr = row + dr, nc = col + dc;
              if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) m.add(`${nr},${nc}`);
            }
        }
        function blastLine(cell: GemCell, row: number, col: number, m: Set<string>): void {
          if (cell.special === 'striped_h')
            for (let cc = 0; cc < BOARD_SIZE; cc++) m.add(`${row},${cc}`);
          else
            for (let rr = 0; rr < BOARD_SIZE; rr++) m.add(`${rr},${col}`);
        }
        function blastColor(colorType: number, m: Set<string>): void {
          for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
              if (state.board[r][c]?.type === colorType) m.add(`${r},${c}`);
        }

        if (isASpecial || isBSpecial) {
          setMovesLeft(prev => prev - 1);
          const matched = new Set<string>();
          matched.add(`${a.row},${a.col}`);
          matched.add(`${b.row},${b.col}`);

          if (isAWrapped && isBWrapped) {
            showToast('💥 DOUBLE AREA BLAST!'); blastArea(a.row, a.col, matched); blastArea(b.row, b.col, matched);
          } else if (isAStriped && isBStriped) {
            showToast('✚ CROSS BLAST!');
            [a.row, b.row].forEach(r => { for (let cc = 0; cc < BOARD_SIZE; cc++) matched.add(`${r},${cc}`); });
            [a.col, b.col].forEach(c => { for (let rr = 0; rr < BOARD_SIZE; rr++) matched.add(`${rr},${c}`); });
          } else if (isAColorBomb && isBColorBomb) {
            showToast('🌟 SUPERNOVA! BOARD CLEARED!');
            for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) matched.add(`${r},${c}`);
          } else if (isAWrapped && isBStriped) {
            showToast('💥⚡ AREA + LINE!'); blastArea(a.row, a.col, matched); blastLine(cellB, b.row, b.col, matched);
          } else if (isBWrapped && isAStriped) {
            showToast('💥⚡ AREA + LINE!'); blastArea(b.row, b.col, matched); blastLine(cellA, a.row, a.col, matched);
          } else if (isAWrapped && isBColorBomb) {
            showToast('💥✨ AREA + COLOR CLEAR!'); blastArea(a.row, a.col, matched); blastColor(cellA.type, matched);
          } else if (isBWrapped && isAColorBomb) {
            showToast('💥✨ AREA + COLOR CLEAR!'); blastArea(b.row, b.col, matched); blastColor(cellB.type, matched);
          } else if (isAStriped && isBColorBomb) {
            showToast('⚡✨ LINE + COLOR CLEAR!'); blastLine(cellA, a.row, a.col, matched); blastColor(cellB.type, matched);
          } else if (isBStriped && isAColorBomb) {
            showToast('⚡✨ LINE + COLOR CLEAR!'); blastLine(cellB, b.row, b.col, matched); blastColor(cellA.type, matched);
          } else if (isAColorBomb) {
            showToast('✨ HYPERNOVA BLAST!'); blastColor(cellB.type, matched);
          } else if (isBColorBomb) {
            showToast('✨ HYPERNOVA BLAST!'); blastColor(cellA.type, matched);
          } else if (isAStriped) {
            showToast(cellA.special === 'striped_h' ? '⚡ ROW BLAST!' : '⚡ COLUMN BLAST!'); blastLine(cellA, a.row, a.col, matched);
          } else if (isBStriped) {
            showToast(cellB.special === 'striped_h' ? '⚡ ROW BLAST!' : '⚡ COLUMN BLAST!'); blastLine(cellB, b.row, b.col, matched);
          } else if (isAWrapped) {
            showToast('🔶 WRAPPED BLAST!'); blastArea(a.row, a.col, matched);
          } else if (isBWrapped) {
            showToast('🔶 WRAPPED BLAST!'); blastArea(b.row, b.col, matched);
          }

          resolveMatches({ matched, specialsToSpawn: [] }, 1);
          return;
        }

        const matchResult = findMatches();
        if (matchResult.matched.size > 0) {
          setMovesLeft(prev => prev - 1);
          resolveMatches(matchResult, 1);
        } else {
          let backDone = 0;
          const onBackDone = () => {
            backDone++;
            if (backDone < 2) return;
            state.board[a.row][a.col] = cellA;
            state.board[b.row][b.col] = cellB;
            cellA.mesh.userData.row = a.row; cellA.mesh.userData.col = a.col;
            cellB.mesh.userData.row = b.row; cellB.mesh.userData.col = b.col;
            state.busy = false;
            if (state.aiMode) checkAiMove();
          };
          tweenTo(cellA.mesh, posA, SWAP_MS, { onComplete: onBackDone });
          tweenTo(cellB.mesh, posB, SWAP_MS, { onComplete: onBackDone });
        }
      };

      gameAudio.playSwap();
      tweenTo(cellA.mesh, posB, SWAP_MS, { onComplete: onBothDone });
      tweenTo(cellB.mesh, posA, SWAP_MS, { onComplete: onBothDone });
    }

    function handleTileClick(row: number, col: number): void {
      const state = stateRef.current;
      clearHintVisual();

      if (!state.selected) {
        state.selected = { row, col };
        setSelectedVisual(row, col, true);
        return;
      }

      if (state.selected.row === row && state.selected.col === col) {
        setSelectedVisual(row, col, false);
        state.selected = null;
        return;
      }

      const dr = Math.abs(state.selected.row - row);
      const dc = Math.abs(state.selected.col - col);

      if (dr + dc !== 1) {
        setSelectedVisual(state.selected.row, state.selected.col, false);
        state.selected = { row, col };
        setSelectedVisual(row, col, true);
        return;
      }

      setSelectedVisual(state.selected.row, state.selected.col, false);
      const targetA = state.selected;
      state.selected = null;
      attemptSwap(targetA, { row, col });
    }

    function setSelectedVisual(row: number, col: number, isSelected: boolean): void {
      const state = stateRef.current;
      const cell  = state.board[row]?.[col];
      if (!cell?.mesh) return;
      const s = isSelected ? 1.2 : 1.0;
      cell.mesh.scale.set(s, s, s);
      const mat = cell.mesh.material as THREE.MeshStandardMaterial;
      if (mat?.emissiveIntensity !== undefined)
        mat.emissiveIntensity = isSelected ? 1.2 : 0.55;
    }

    function onPointerDown(evt: PointerEvent): void {
      const state = stateRef.current;
      if (state.busy || state.gameOver || state.aiMode || state.gameState !== 'playing') return;
      const tile = getTileFromEvent(evt);
      if (!tile) return;
      evt.preventDefault();
      try { renderer.domElement.setPointerCapture(evt.pointerId); } catch (_) { /* ignore */ }
      state.dragState = {
        row: tile.row, col: tile.col,
        startX: evt.clientX, startY: evt.clientY,
        pointerId: evt.pointerId, handled: false,
      };
      clearHintVisual();
    }

    function onPointerMove(evt: PointerEvent): void {
      const state = stateRef.current;
      if (!state.dragState || state.dragState.pointerId !== evt.pointerId || state.dragState.handled) return;
      if (state.busy || state.gameOver || state.aiMode || state.gameState !== 'playing') return;

      const dx = evt.clientX - state.dragState.startX;
      const dy = evt.clientY - state.dragState.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      evt.preventDefault();

      let dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
      else dr = dy > 0 ? 1 : -1;

      const targetRow = state.dragState.row + dr;
      const targetCol = state.dragState.col + dc;
      state.dragState.handled = true;

      if (state.selected) { setSelectedVisual(state.selected.row, state.selected.col, false); state.selected = null; }

      if (targetRow >= 0 && targetRow < BOARD_SIZE && targetCol >= 0 && targetCol < BOARD_SIZE)
        attemptSwap({ row: state.dragState.row, col: state.dragState.col }, { row: targetRow, col: targetCol });
    }

    function onPointerUp(evt: PointerEvent): void {
      const state = stateRef.current;
      if (!state.dragState || state.dragState.pointerId !== evt.pointerId) return;
      try { renderer.domElement.releasePointerCapture(evt.pointerId); } catch (_) { /* ignore */ }
      if (!state.dragState.handled && !state.busy && !state.gameOver && !state.aiMode)
        handleTileClick(state.dragState.row, state.dragState.col);
      state.dragState = null;
      clearHintVisual();
    }

    // ── Render loop ──────────────────────────────────────────────────────────

    let animationFrameId: number;
    let isRenderingActive = true;

    function animate(): void {
      if (!isRenderingActive) return;
      animationFrameId = requestAnimationFrame(animate);
      const delta        = clock.getDelta();
      const cappedDelta  = Math.min(delta, 0.1);

      updatePhysicsAndTweens(cappedDelta);
      updateHintBounce(cappedDelta);

      const state = stateRef.current;
      const t     = Date.now();
      if (state.board) {
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = state.board[r][c];
            if (!cell?.mesh) continue;
            const phase = (cell.mesh.userData.phase as number) || 0;
            const mat   = cell.mesh.material as THREE.MeshStandardMaterial;

            if (cell.special === 'color_bomb') {
              const hue = ((t * 0.00035) + phase * 0.15) % 1;
              rainbowMat.emissive.set(new THREE.Color().setHSL(hue, 1.0, 0.58));
              rainbowMat.emissiveIntensity = 1.3 + 0.3 * Math.sin(t * 0.003 + phase);
            } else if (cell.special === 'wrapped') {
              mat.emissiveIntensity = 0.7 + 0.55 * Math.abs(Math.sin(t * 0.0035 + phase));
            } else if (cell.special === 'striped_h' || cell.special === 'striped_v') {
              mat.emissiveIntensity = 0.6 + 0.7 * Math.abs(Math.sin(t * 0.005 + phase));
            } else {
              mat.emissiveIntensity = 0.35 + 0.3 * Math.sin(t * 0.002 + phase);
            }
          }
        }
      }

      renderer.render(scene, camera);
    }

    function handleResize(): void {
      if (!renderer || !camera || !container) return;
      const w = container.clientWidth  || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      adjustCameraDistance(w, h);
      renderer.setSize(w, h);
    }

    stateRef.current.checkAiMove = checkAiMove;
    setupBoard();
    animate();

    window.addEventListener('resize', handleResize);
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown',  onPointerDown);
    canvas.addEventListener('pointermove',  onPointerMove);
    canvas.addEventListener('pointerup',    onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp as EventListener);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRenderingActive = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else if (!isRenderingActive) {
        isRenderingActive = true;
        clock.getDelta();
        animate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleContentVisibility = (e: Event) => {
      const ce = e as Event & { skipped?: boolean };
      if (ce.skipped) {
        isRenderingActive = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else if (!isRenderingActive) {
        isRenderingActive = true;
        clock.getDelta();
        animate();
      }
    };
    container.addEventListener('contentvisibilityautostatechange', handleContentVisibility);

    return () => {
      isRenderingActive = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      container.removeEventListener('contentvisibilityautostatechange', handleContentVisibility);

      canvas.removeEventListener('pointerdown',   onPointerDown);
      canvas.removeEventListener('pointermove',   onPointerMove);
      canvas.removeEventListener('pointerup',     onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp as EventListener);

      clearBoardMeshes();
      baseGeo.dispose(); baseMat.dispose(); trimGeo.dispose(); trimMat.dispose();
      gemGeometries.forEach(g => g.dispose());
      faceMaterials.forEach(m => m.dispose());
      blockGeo.dispose(); blockMaterials.forEach(m => m.dispose());
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [playEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger AI when mode changes
  useEffect(() => {
    if (gameState === 'playing' && aiMode && stateRef.current.checkAiMove)
      stateRef.current.checkAiMove();
  }, [aiMode, gameState]);

  return (
    <div
      className="heavy-component"
      style={{
        position: 'absolute',
        inset: 0,
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto none auto 100%',
      }}
      ref={mountRef}
    />
  );
}
