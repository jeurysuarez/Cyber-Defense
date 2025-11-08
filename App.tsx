/*
Cyber Defender: The Firewall Quest

A 2D platformer game built with React.

--- CORE MECHANICS ---
- Player Movement: Left/Right (A/D or Arrow Keys), Jump (W, Up Arrow, or Space).
- Combat: Shoot projectiles (X key) after collecting the weapon power-up.
- Health: Player has 3 lives. Colliding with enemies or hazards removes a life.
- Power-ups:
  - Shield: Provides a one-hit protection layer.
  - Weapon: Enables shooting projectiles.
  - Invincibility: Grants temporary invulnerability.
  - Extra Life: Adds one life.
- Interactive Elements:
  - Consoles: Can be hacked (E key) to disable obstacles like firewalls.
  - Audit Logs: Collectibles that provide story/mentor messages.
- Enemies:
  - Mini-Virus: Patrols back and forth.
  - Spam-bot: Stationary enemy that shoots projectiles at the player.
- Boss: The Adware King, a multi-stage boss at the end of the level.

--- COMPONENT STRUCTURE ---
- App: Main component, handles game state, logic loop, and renders different screens.
- GameScreen: Renders all active game elements (player, enemies, platforms, etc.).
- Player: Renders the player character, ZeroByte.
- LevelEntity: A generic component for rendering all other game objects.
- UI: Displays game information like lives and active power-ups.
- StartScreen, EndScreen, LevelCompleteScreen: Static screens for different game states.
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- TYPE DEFINITIONS ---
interface GameObject {
  id: number;
  type: 'platform' | 'enemy' | 'powerupBox' | 'firewall' | 'goal' | 'console' | 'log' | 'projectile' | 'enemyProjectile' | 'particle' | 'boss';
  subtype?: 'mini-virus' | 'spam-bot' | 'router' | 'keyboard' | 'shield' | 'weapon' | 'invincibility' | 'extraLife';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  patrolStart?: number;
  patrolEnd?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  vx?: number;
  vy?: number;
  static?: boolean;
  hit?: boolean;
  targetId?: number; // For consoles targeting firewalls
  message?: string; // For logs and consoles
  health?: number;
}

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  direction: 'left' | 'right';
}

// --- GAME CONSTANTS ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const PLAYER_SPEED = 5;
const JUMP_STRENGTH = 13;
const GRAVITY = 0.7;
const TERMINAL_VELOCITY = 15;
const FRICTION = 0.8;
const PROJECTILE_SPEED = 10;
const BOSS_HEALTH = 20;

// --- LEVEL DATA ---
const levelData: GameObject[] = [
  // Starting Area
  { id: 1, type: 'platform', subtype: 'keyboard', x: 0, y: 550, width: 400, height: 50 },
  { id: 2, type: 'platform', subtype: 'keyboard', x: 450, y: 550, width: 350, height: 50 },

  // First Jump
  { id: 3, type: 'platform', subtype: 'router', x: 600, y: 450, width: 150, height: 30 },
  { id: 4, type: 'platform', subtype: 'router', x: 800, y: 400, width: 150, height: 30 },

  // Power-up introduction
  { id: 5, type: 'platform', subtype: 'keyboard', x: 950, y: 500, width: 300, height: 50 },
  { id: 100, type: 'powerupBox', subtype: 'weapon', x: 1080, y: 440, width: 40, height: 40 },

  // Enemies
  { id: 6, type: 'platform', subtype: 'keyboard', x: 1300, y: 550, width: 500, height: 50 },
  { id: 200, type: 'enemy', subtype: 'mini-virus', x: 1400, y: 500, width: 40, height: 40, patrolStart: 1350, patrolEnd: 1700, direction: 'right' },
  { id: 201, type: 'enemy', subtype: 'spam-bot', x: 1700, y: 350, width: 40, height: 50 },
  { id: 7, type: 'platform', subtype: 'router', x: 1650, y: 400, width: 150, height: 30 },

  // Hacking introduction
  { id: 8, type: 'platform', subtype: 'keyboard', x: 1900, y: 550, width: 400, height: 50 },
  { id: 300, type: 'console', x: 1950, y: 510, width: 40, height: 40, targetId: 998, message: "> Accessing console... Firewall ID:998 disabled." },
  { id: 998, type: 'firewall', x: 2300, y: 350, width: 20, height: 200 },
  
  // Collectible and more powerups
  { id: 9, type: 'platform', subtype: 'router', x: 2400, y: 450, width: 150, height: 30 },
  { id: 400, type: 'log', x: 2450, y: 410, width: 30, height: 30, message: "> AUDIT LOG: Unusual traffic detected. The infection seems to originate from the core." },
  { id: 10, type: 'platform', subtype: 'router', x: 2600, y: 350, width: 150, height: 30 },
  { id: 101, type: 'powerupBox', subtype: 'shield', x: 2650, y: 310, width: 40, height: 40 },

  // Pre-boss area
  { id: 11, type: 'platform', subtype: 'keyboard', x: 2900, y: 550, width: 800, height: 50 },
  { id: 202, type: 'enemy', subtype: 'mini-virus', x: 3000, y: 500, width: 40, height: 40, patrolStart: 2950, patrolEnd: 3200, direction: 'left' },
  { id: 203, type: 'enemy', subtype: 'mini-virus', x: 3300, y: 500, width: 40, height: 40, patrolStart: 3250, patrolEnd: 3600, direction: 'right' },
  { id: 102, type: 'powerupBox', subtype: 'invincibility', x: 3400, y: 400, width: 40, height: 40 },
  { id: 12, type: 'platform', subtype: 'router', x: 3380, y: 440, width: 80, height: 20 },
  { id: 103, type: 'powerupBox', subtype: 'extraLife', x: 3500, y: 510, width: 40, height: 40 },
  
  // Boss arena
  { id: 999, type: 'firewall', x: 3700, y: 350, width: 20, height: 200 },
  { id: 13, type: 'platform', subtype: 'keyboard', x: 3720, y: 550, width: 800, height: 50 },
  { id: 14, type: 'boss', x: 4100, y: 350, width: 100, height: 100, health: BOSS_HEALTH, direction: 'down' },
  
  // Goal
  { id: 1000, type: 'goal', x: 4450, y: 490, width: 50, height: 60 },
];
const LEVEL_WIDTH = 4600;

// --- HELPER FUNCTIONS ---
const checkCollision = (a: { x: number, y: number, width: number, height: number }, b: GameObject) => {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
};


// --- REACT COMPONENTS ---

const App = () => {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameOver' | 'levelComplete'>('start');
  const [lives, setLives] = useState(3);
  const [cameraX, setCameraX] = useState(0);

  const playerState = useRef<PlayerState>({
    x: 100, y: 400, vx: 0, vy: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, onGround: false, direction: 'right'
  });

  const keys = useRef<{ [key: string]: boolean }>({});
  const gameEntities = useRef<GameObject[]>(JSON.parse(JSON.stringify(levelData)));
  const particles = useRef<GameObject[]>([]);

  const [hasShield, setHasShield] = useState(false);
  const [hasWeapon, setHasWeapon] = useState(false);
  const [isInvincible, setIsInvincible] = useState(false);
  const invincibleTimer = useRef<number | null>(null);

  const [mentorMessage, setMentorMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  const resetGame = useCallback(() => {
    playerState.current = {
      x: 100, y: 400, vx: 0, vy: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, onGround: false, direction: 'right'
    };
    gameEntities.current = JSON.parse(JSON.stringify(levelData));
    setLives(3);
    setHasShield(false);
    setHasWeapon(false);
    setIsInvincible(false);
    if (invincibleTimer.current) clearTimeout(invincibleTimer.current);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMentorMessage(null);
    setGameState('playing');
  }, []);

  const showMessage = useCallback((text: string, duration: number = 3000) => {
    setMentorMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => {
      setMentorMessage(null);
    }, duration);
  }, []);

  // Player input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let shootCooldown = 0;
    let spambotCooldown = 0;
    let bossCooldown = 0;
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / (1000 / 60); // Normalize to 60 FPS
      lastTime = currentTime;
      shootCooldown = Math.max(0, shootCooldown - 1);
      spambotCooldown = Math.max(0, spambotCooldown - 1);
      bossCooldown = Math.max(0, bossCooldown - 1);

      const player = playerState.current;

      // --- Player Movement ---
      if (keys.current['a'] || keys.current['arrowleft']) {
        player.vx -= 1;
        player.direction = 'left';
      }
      if (keys.current['d'] || keys.current['arrowright']) {
        player.vx += 1;
        player.direction = 'right';
      }
      if ((keys.current['w'] || keys.current['arrowup'] || keys.current[' ']) && player.onGround) {
        player.vy = -JUMP_STRENGTH;
        player.onGround = false;
      }
      
      // Shooting
      if (keys.current['x'] && hasWeapon && shootCooldown === 0) {
        gameEntities.current.push({
          id: Date.now(),
          type: 'projectile',
          x: player.direction === 'right' ? player.x + player.width : player.x,
          y: player.y + player.height / 2 - 5,
          width: 10,
          height: 10,
          vx: player.direction === 'right' ? PROJECTILE_SPEED : -PROJECTILE_SPEED,
        });
        shootCooldown = 20; // 3 shots per second at 60fps
      }

      // Apply physics
      player.vx *= FRICTION;
      player.vx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, player.vx));
      if (Math.abs(player.vx) < 0.1) player.vx = 0;

      player.vy += GRAVITY;
      player.vy = Math.min(TERMINAL_VELOCITY, player.vy);

      player.x += player.vx * deltaTime;
      
      // --- Collision Detection (X-axis) ---
      for (const entity of gameEntities.current) {
        if (entity.type === 'platform' || entity.type === 'firewall' || entity.type === 'powerupBox') {
          if (checkCollision(player, entity)) {
            if (player.vx > 0) {
              player.x = entity.x - player.width;
            } else if (player.vx < 0) {
              player.x = entity.x + entity.width;
            }
            player.vx = 0;
          }
        }
      }

      player.y += player.vy * deltaTime;
      player.onGround = false;

      // --- Collision Detection (Y-axis) ---
      for (const entity of gameEntities.current) {
        if (entity.type === 'platform' || entity.type === 'powerupBox') {
          if (checkCollision(player, entity)) {
            if (player.vy > 0 && player.y + player.height - player.vy * deltaTime <= entity.y) {
               player.y = entity.y - player.height;
               player.vy = 0;
               player.onGround = true;
            } else if (player.vy < 0 && player.y - player.vy * deltaTime >= entity.y + entity.height) {
              player.y = entity.y + entity.height;
              player.vy = 0;
              // Player hits a powerup box from below
              if (entity.type === 'powerupBox' && !entity.hit) {
                 entity.hit = true;
                 const { subtype } = entity;
                 if (subtype === 'shield') setHasShield(true);
                 if (subtype === 'weapon') setHasWeapon(true);
                 if (subtype === 'invincibility') {
                    setIsInvincible(true);
                    if (invincibleTimer.current) clearTimeout(invincibleTimer.current);
                    invincibleTimer.current = window.setTimeout(() => setIsInvincible(false), 5000);
                 }
                 if (subtype === 'extraLife') setLives(l => l + 1);
              }
            }
          }
        } else if (entity.type === 'firewall') {
           if (checkCollision(player, entity)) {
              if (player.vy > 0) {
                 player.y = entity.y - player.height;
                 player.vy = 0;
                 player.onGround = true;
              } else if (player.vy < 0) {
                 player.y = entity.y + entity.height;
                 player.vy = 0;
              }
           }
        }
      }

      // Player bounds
      player.x = Math.max(0, Math.min(player.x, LEVEL_WIDTH - player.width));
      if (player.y > GAME_HEIGHT) { // Fell off screen
         setLives(l => l - 1);
         if (lives - 1 <= 0) {
            setGameState('gameOver');
         } else {
             player.x = 100;
             player.y = 400;
             player.vx = 0;
             player.vy = 0;
         }
      }

      // --- Entity Logic ---
      const newEntities: GameObject[] = [];
      for (let entity of gameEntities.current) {
        let keepEntity = true;

        // Enemy movement
        if (entity.type === 'enemy' && entity.subtype === 'mini-virus') {
          const speed = 1.5;
          if (entity.direction === 'right') {
            entity.x += speed * deltaTime;
            if (entity.x > entity.patrolEnd!) entity.direction = 'left';
          } else {
            entity.x -= speed * deltaTime;
            if (entity.x < entity.patrolStart!) entity.direction = 'right';
          }
        }
        
        // Spambot shooting
        if (entity.type === 'enemy' && entity.subtype === 'spam-bot' && spambotCooldown === 0) {
            const dx = player.x - entity.x;
            if (Math.abs(dx) < 300) { // Shoot if player is within range
                newEntities.push({
                    id: Date.now(),
                    type: 'enemyProjectile',
                    x: entity.x + entity.width / 2,
                    y: entity.y + 20,
                    width: 12,
                    height: 12,
                    vx: dx > 0 ? 4 : -4,
                });
                spambotCooldown = 120; // Shoots every 2 seconds
            }
        }
        
        // Boss logic
        if (entity.type === 'boss') {
            if(player.x > 3720) { // Activate boss
                const speed = 2;
                if (entity.direction === 'down') {
                    entity.y += speed * deltaTime;
                    if (entity.y > 430) entity.direction = 'up';
                } else {
                    entity.y -= speed * deltaTime;
                    if (entity.y < 250) entity.direction = 'down';
                }
                if (bossCooldown === 0) {
                    // Shoot a burst
                    for (let i = 0; i < 3; i++) {
                         newEntities.push({
                            id: Date.now() + i, type: 'enemyProjectile',
                            x: entity.x + entity.width / 2, y: entity.y + entity.height / 2,
                            width: 15, height: 15, vx: -5 + i * 2, vy: 5
                         });
                    }
                    bossCooldown = 90; // Shoots every 1.5 seconds
                }
            }
        }

        // Projectile movement and collision
        if (entity.type === 'projectile' || entity.type === 'enemyProjectile') {
          entity.x += (entity.vx || 0) * deltaTime;
          entity.y += (entity.vy || 0) * deltaTime;
          if (entity.x < 0 || entity.x > LEVEL_WIDTH) keepEntity = false;

          // Projectile hits enemy
          if (entity.type === 'projectile') {
            for (const other of gameEntities.current) {
              if ((other.type === 'enemy' || other.type === 'boss') && checkCollision(entity, other)) {
                keepEntity = false;
                other.health = (other.health || 1) - 1;
                for (let i = 0; i < 10; i++) {
                    particles.current.push({ id: Date.now() + i, type: 'particle', x: other.x + other.width / 2, y: other.y + other.height / 2, width: 5, height: 5, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 });
                }
              }
            }
          }
        }

        if (keepEntity) {
          newEntities.push(entity);
        }
      }
      gameEntities.current = newEntities.filter(e => (e.health === undefined || e.health > 0));

      // Merge newly created entities
      gameEntities.current.push(...newEntities.filter(e => e.type !== 'projectile' && e.type !== 'enemyProjectile'));


      // Player-item/enemy interaction
      const nextEntities = [];
      for (const entity of gameEntities.current) {
        let keep = true;
        if (checkCollision(player, entity)) {
          if (entity.type === 'goal') {
            setGameState('levelComplete');
          }
          if ((entity.type === 'enemy' || entity.type === 'enemyProjectile' || entity.type === 'boss') && !isInvincible) {
              if (hasShield) {
                  setHasShield(false);
                  if(entity.type === 'enemyProjectile') keep = false; // projectile disappears
              } else {
                  setLives(l => l - 1);
                  if (lives - 1 <= 0) {
                      setGameState('gameOver');
                  } else {
                      player.x = 100;
                      player.y = 400;
                      player.vx = 0;
                      player.vy = 0;
                  }
              }
          }
          if (entity.type === 'log') {
             showMessage(entity.message!);
             keep = false;
          }
          if (entity.type === 'console' && (keys.current['e'])) {
             showMessage(entity.message!);
             // Disable the target firewall
             gameEntities.current = gameEntities.current.filter(e => e.id !== entity.targetId);
             keep = false; // Console is used up
          }
        }
        if (keep) nextEntities.push(entity);
      }
      gameEntities.current = nextEntities;


      // Update particles
      particles.current = particles.current.map(p => ({
          ...p,
          x: p.x + p.vx!,
          y: p.y + p.vy!,
          vy: p.vy! + 0.1, // particle gravity
          width: Math.max(0, p.width - 0.1), // shrink
          height: Math.max(0, p.height - 0.1),
      })).filter(p => p.width > 0);


      // Update Camera
      const targetCameraX = player.x - GAME_WIDTH / 2;
      const smoothedCameraX = cameraX + (targetCameraX - cameraX) * 0.1;
      setCameraX(Math.max(0, Math.min(smoothedCameraX, LEVEL_WIDTH - GAME_WIDTH)));

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (invincibleTimer.current) clearTimeout(invincibleTimer.current);
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [gameState, hasWeapon, isInvincible, hasShield, lives, cameraX, resetGame, showMessage]);

  const renderGame = () => {
    switch (gameState) {
      case 'start':
        return <StartScreen onStart={() => resetGame()} />;
      case 'playing':
        return (
          <GameScreen cameraX={cameraX}>
            <Player playerState={playerState.current} isInvincible={isInvincible} hasShield={hasShield} hasWeapon={hasWeapon} />
            {gameEntities.current.map(entity => <LevelEntity key={entity.id} entity={entity} />)}
            {particles.current.map(p => <LevelEntity key={p.id} entity={p} />)}
            <UI lives={lives} hasShield={hasShield} hasWeapon={hasWeapon} isInvincible={isInvincible} />
            {mentorMessage && <MentorMessage text={mentorMessage} />}
          </GameScreen>
        );
      case 'gameOver':
        return <EndScreen onRestart={resetGame} />;
      case 'levelComplete':
        return <LevelCompleteScreen onRestart={resetGame} />;
      default:
        return null;
    }
  };

  return (
    <>
      <GameStyles />
      <div style={{ width: GAME_WIDTH, height: GAME_HEIGHT, overflow: 'hidden', margin: 'auto', position: 'relative', border: '2px solid #00FF7F' }}>
        {renderGame()}
      </div>
    </>
  );
};

// Fix: Replaced inline prop type with a named interface to resolve TypeScript errors.
interface GameScreenProps {
  children: React.ReactNode;
  cameraX: number;
}
const GameScreen = ({ children, cameraX }: GameScreenProps) => (
    <div style={{ position: 'relative', width: LEVEL_WIDTH, height: GAME_HEIGHT, transform: `translateX(-${cameraX}px)` }}>
        <div className="background-scroller"></div>
        {children}
    </div>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface PlayerProps {
  playerState: PlayerState;
  isInvincible: boolean;
  hasShield: boolean;
  hasWeapon: boolean;
}
const Player = ({ playerState, isInvincible, hasShield, hasWeapon }: PlayerProps) => {
  const shieldStyle: React.CSSProperties = hasShield ? {
    boxShadow: '0 0 15px 5px #00aeff, 0 0 5px 2px #fff inset',
    animation: 'shield-pulse 2s infinite',
  } : {};
  
  const invincibilityStyle: React.CSSProperties = isInvincible ? {
    animation: 'invincible-flash 0.2s infinite'
  } : {};

  return (
    <div style={{
      position: 'absolute',
      left: playerState.x,
      top: playerState.y,
      width: playerState.width,
      height: playerState.height,
      transform: playerState.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
      transition: 'opacity 0.2s',
      ...invincibilityStyle
    }}>
      <div className="player-body" style={{...shieldStyle}}>
          <div className="player-visor"></div>
          <div className="player-accent"></div>
          <div className={`player-gauntlet ${hasWeapon ? 'active' : ''}`}></div>
      </div>
    </div>
  );
};

// Fix: Replaced inline prop type with a named interface to resolve TypeScript errors with the `key` prop.
interface LevelEntityProps {
  entity: GameObject;
}
const LevelEntity = ({ entity }: LevelEntityProps) => {
    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: entity.x,
        top: entity.y,
        width: entity.width,
        height: entity.height,
    };

    const getEntityStyle = (): React.CSSProperties => {
        switch (entity.type) {
            case 'platform':
                if (entity.subtype === 'router') return { ...baseStyle, background: '#444', border: '2px solid #00FF7F', boxSizing: 'border-box' };
                return { ...baseStyle, background: '#555', border: '1px solid #777', backgroundImage: 'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 5px 5px' };
            case 'firewall': return { ...baseStyle, background: 'rgba(255, 0, 0, 0.5)', border: '2px solid red' };
            case 'powerupBox': return { ...baseStyle, background: entity.hit ? '#333' : '#ffcc00', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'black', fontSize: '2em', fontWeight: 'bold' };
            case 'goal': return { ...baseStyle, background: '#00FF7F', boxShadow: '0 0 10px #00FF7F' };
            case 'enemy':
                if (entity.subtype === 'spam-bot') return { ...baseStyle, background: '#555', border: '2px solid orange' };
                return { ...baseStyle, background: 'red', borderRadius: '5px' };
            case 'boss': return {...baseStyle, background: 'purple', border: '3px solid #00FF7F'};
            case 'console': return { ...baseStyle, background: '#222', border: '2px solid #00FF7F' };
            case 'log': return { ...baseStyle, background: '#00aeff', borderRadius: '50%' };
            case 'projectile': return { ...baseStyle, background: '#00FF7F', borderRadius: '50%', boxShadow: '0 0 5px #00FF7F' };
            case 'enemyProjectile': return { ...baseStyle, background: 'orange', borderRadius: '3px' };
            case 'particle': return { ...baseStyle, background: 'yellow', borderRadius: '50%' };
            default: return baseStyle;
        }
    };
    
    const style = getEntityStyle();
    
    return (
        <div style={style}>
            {entity.type === 'powerupBox' && !entity.hit && '?'}
            {entity.subtype === 'router' && <div className="router-light"></div>}
        </div>
    );
};


// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface UIProps {
  lives: number;
  hasShield: boolean;
  hasWeapon: boolean;
  isInvincible: boolean;
}
const UI = ({ lives, hasShield, hasWeapon, isInvincible }: UIProps) => (
  <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontFamily: 'monospace', fontSize: '18px', zIndex: 100, textShadow: '2px 2px #000' }}>
    <div>LIVES: {lives}</div>
    {hasShield && <div>SHIELD: ACTIVE</div>}
    {hasWeapon && <div>WEAPON: ONLINE</div>}
    {isInvincible && <div>INVINCIBILITY</div>}
  </div>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface MentorMessageProps {
  text: string;
}
const MentorMessage = ({ text }: MentorMessageProps) => (
  <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', border: '1px solid #00FF7F', color: '#00FF7F', fontFamily: 'monospace', zIndex: 100 }}>
    {text}
  </div>
);

// Fix: Replaced inline prop type with a named interface to resolve TypeScript errors.
interface ScreenContainerProps {
  children: React.ReactNode;
}
const ScreenContainer = ({ children }: ScreenContainerProps) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#000', fontFamily: 'monospace', textAlign: 'center' }}>
    {children}
  </div>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface TitleProps {
  text: string;
}
const Title = ({ text }: TitleProps) => <h1 style={{ color: '#00FF7F', textShadow: '0 0 10px #00FF7F' }}>{text}</h1>;

// Fix: Replaced inline prop type with a named interface to resolve TypeScript errors.
interface StyledButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}
const StyledButton = ({ onClick, children }: StyledButtonProps) => (
    <button onClick={onClick} style={{ background: '#00FF7F', color: 'black', border: 'none', padding: '10px 20px', fontSize: '1.2em', cursor: 'pointer' }}>
        {children}
    </button>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface StartScreenProps {
  onStart: () => void;
}
const StartScreen = ({ onStart }: StartScreenProps) => (
  <ScreenContainer>
    <Title text="Cyber Defender: The Firewall Quest" />
    <p>Use [A/D] or [Arrows] to Move. [W/Up/Space] to Jump.</p>
    <p>[X] to Shoot (with power-up). [E] to Interact.</p>
    <StyledButton onClick={onStart}>START MISSION</StyledButton>
  </ScreenContainer>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface EndScreenProps {
  onRestart: () => void;
}
const EndScreen = ({ onRestart }: EndScreenProps) => (
  <ScreenContainer>
    <Title text="SYSTEM FAILURE" />
    <p>Game Over</p>
    <StyledButton onClick={onRestart}>REBOOT</StyledButton>
  </ScreenContainer>
);

// Fix: Replaced inline prop type with a named interface for better readability and consistency.
interface LevelCompleteScreenProps {
  onRestart: () => void;
}
const LevelCompleteScreen = ({ onRestart }: LevelCompleteScreenProps) => (
    <ScreenContainer>
        <Title text="SECTOR CLEARED" />
        <p>Congratulations, agent!</p>
        <StyledButton onClick={onRestart}>NEXT MISSION</StyledButton>
    </ScreenContainer>
);

// --- STYLES ---
const GameStyles = () => (
    <style>{`
        @keyframes shield-pulse {
            0% { transform: scale(1); box-shadow: 0 0 15px 5px #00aeff, 0 0 5px 2px #fff inset; }
            50% { transform: scale(1.05); box-shadow: 0 0 25px 10px #00aeff, 0 0 8px 4px #fff inset; }
            100% { transform: scale(1); box-shadow: 0 0 15px 5px #00aeff, 0 0 5px 2px #fff inset; }
        }
        @keyframes invincible-flash {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        @keyframes scroll-background {
            0% { background-position: 0 0; }
            100% { background-position: 0 2000px; }
        }
        @keyframes blink {
            0%, 48%, 100% { background: #00FF7F; box-shadow: 0 0 5px #00FF7F; }
            50%, 98% { background: #005c2d; box-shadow: none; }
        }
        .background-scroller {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g fill="none" stroke="%23003366" stroke-width="1"><path d="M0 50 L100 50 M50 0 L50 100 M0 25 L100 25 M0 75 L100 75 M25 0 L25 100 M75 0 L75 100"/></g></svg>');
            animation: scroll-background 60s linear infinite;
        }
        .player-body {
            width: 100%; height: 100%;
            background: #111;
            border: 2px solid #00aeff;
            box-sizing: border-box;
            border-radius: 5px;
            position: relative;
        }
        .player-visor {
            position: absolute;
            top: 10px; left: 50%;
            transform: translateX(-50%);
            width: 70%; height: 15px;
            background: #2E0B3A;
            border: 2px solid #00aeff;
        }
        .player-accent {
            position: absolute;
            bottom: 10px; left: 50%;
            transform: translateX(-50%);
            width: 50%; height: 5px;
            background: #00FF7F;
            box-shadow: 0 0 5px #00FF7F;
        }
        .player-gauntlet {
            position: absolute;
            top: 25px; left: 5px;
            width: 10px; height: 15px;
            background: #00FF7F;
            transition: background 0.2s, box-shadow 0.2s;
        }
        .player-gauntlet.active {
            background: yellow;
            box-shadow: 0 0 8px yellow;
        }
        .router-light {
            position: absolute;
            top: 5px; right: 5px;
            width: 5px; height: 5px;
            border-radius: 50%;
            animation: blink 2s infinite;
        }
    `}</style>
);


export default App;
