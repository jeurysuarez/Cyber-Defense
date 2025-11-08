
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- TYPE DEFINITIONS ---
interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  direction: 'left' | 'right';
  hasWeapon: boolean;
  hasShield: boolean;
  isInvincible: boolean;
  invincibleTimer: number;
}

interface EnemyObject {
  id: number;
  type: 'Mini-Virus' | 'Spam-bot' | 'The Adware King';
  x: number;
  y: number;
  width: number;
  height: number;
  patrolStart: number;
  patrolEnd: number;
  vx: number;
  // FIX: Added 'up' and 'down' to the direction type to support the Adware King's movement.
  direction: 'left' | 'right' | 'up' | 'down';
  shootCooldown?: number;
  health?: number;
  maxHealth?: number;
}

interface LevelEntityObject {
  id: number;
  type: 'platform' | 'power-up-box' | 'firewall' | 'console' | 'log' | 'goal';
  x: number;
  y: number;
  width: number;
  height: number;
  hit?: boolean;
  linkedElementId?: number;
  active?: boolean;
  collected?: boolean;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  owner: 'player' | 'enemy';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

type GameState = 'start' | 'playing' | 'paused' | 'win' | 'lose';

// --- CONSTANTS ---
const WIDTH = 800;
const HEIGHT = 600;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;
const PLAYER_SPEED = 4;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;

const LEVEL_WIDTH = 4800;

// --- LEVEL DATA ---
const levelData: LevelEntityObject[] = [
  // Start area
  { id: 1, type: 'platform', x: 0, y: 550, width: 400, height: 50 },
  { id: 2, type: 'platform', x: 450, y: 500, width: 150, height: 20 },
  { id: 3, type: 'platform', x: 650, y: 450, width: 150, height: 20 },
  { id: 4, type: 'power-up-box', x: 700, y: 350, width: 40, height: 40 },

  // First challenge
  { id: 5, type: 'platform', x: 850, y: 550, width: 300, height: 50 },
  { id: 101, type: 'log', x: 950, y: 518, width: 32, height: 32 },
  { id: 6, type: 'platform', x: 1200, y: 500, width: 100, height: 20 },
  { id: 7, type: 'platform', x: 1350, y: 450, width: 100, height: 20 },
  { id: 8, type: 'platform', x: 1500, y: 400, width: 100, height: 20 },
  { id: 9, type: 'platform', x: 1650, y: 550, width: 400, height: 50 },

  // Firewall challenge
  { id: 10, type: 'firewall', x: 2100, y: 400, width: 20, height: 150, active: true },
  { id: 11, type: 'platform', x: 2050, y: 550, width: 200, height: 50 },
  { id: 12, type: 'console', x: 1950, y: 510, width: 40, height: 40, linkedElementId: 10 },
  { id: 13, type: 'platform', x: 1900, y: 550, width: 100, height: 50 },

  // Mid-section
  { id: 14, type: 'platform', x: 2200, y: 550, width: 600, height: 50 },
  { id: 15, type: 'platform', x: 2400, y: 450, width: 150, height: 20 },
  { id: 16, type: 'power-up-box', x: 2455, y: 350, width: 40, height: 40 },
  { id: 102, type: 'log', x: 2600, y: 418, width: 32, height: 32 },
  { id: 17, type: 'platform', x: 2900, y: 500, width: 150, height: 20 },
  { id: 18, type: 'platform', x: 3100, y: 450, width: 150, height: 20 },
  { id: 19, type: 'platform', x: 3300, y: 400, width: 150, height: 20 },
  
  // Pre-boss area
  { id: 20, type: 'platform', x: 3500, y: 550, width: 500, height: 50 },
  { id: 21, type: 'power-up-box', x: 3700, y: 450, width: 40, height: 40, hit: false },
  { id: 22, type: 'power-up-box', x: 3750, y: 450, width: 40, height: 40, hit: false },
  
  // Boss arena
  { id: 23, type: 'platform', x: 4200, y: 550, width: 600, height: 50 },
  // FIX: Removed duplicate 'id' property. The correct ID is 999 as used in the game logic.
  { id: 999, type: 'firewall', x: 4180, y: 300, width: 20, height: 250, active: true }, // Boss wall
  { id: 25, type: 'goal', x: 4750, y: 500, width: 50, height: 50, active: false }
];

const initialEnemies: EnemyObject[] = [
    { id: 1, type: 'Mini-Virus', x: 900, y: 518, width: 32, height: 32, patrolStart: 850, patrolEnd: 1120, vx: 1, direction: 'right' },
    { id: 2, type: 'Spam-bot', x: 1750, y: 500, width: 40, height: 50, patrolStart: 0, patrolEnd: 0, vx: 0, direction: 'left', shootCooldown: 120 },
    { id: 3, type: 'Mini-Virus', x: 2250, y: 518, width: 32, height: 32, patrolStart: 2200, patrolEnd: 2770, vx: 1, direction: 'right' },
    { id: 4, type: 'Mini-Virus', x: 2500, y: 418, width: 32, height: 32, patrolStart: 2400, patrolEnd: 2520, vx: 1, direction: 'right' },
    { id: 5, type: 'Spam-bot', x: 3200, y: 400, width: 40, height: 50, patrolStart: 0, patrolEnd: 0, vx: 0, direction: 'left', shootCooldown: 120 },
    { id: 6, type: 'The Adware King', x: 4500, y: 300, width: 80, height: 100, patrolStart: 200, patrolEnd: 450, vx: 0, direction: 'down', health: 20, maxHealth: 20, shootCooldown: 90 },
];

const mentorMessages: { [key: number]: string } = {
  101: "> SYSADMIN: Welcome to the system, ZeroByte. These are Audit Logs. Collect them to recover corrupted data... and to understand how this mess started.",
  102: "> SYSADMIN: Watch out. Some malware is passive, but others, like that Spam-bot, will attack on sight. Find a weapon power-up to fight back.",
  12: "> SYSADMIN: That's a system Firewall. It's blocking your path. Find the linked console to disable it. I'm marking it on your HUD.",
  999: "> SYSADMIN: That's him... The Adware King. He's primitive, but he's locked down this sector. Take him out to restore the firewall!",
};

// --- HELPER FUNCTIONS ---
const checkCollision = (a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }) => {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
};

// --- COMPONENTS ---
const Player = React.memo(({ player }: { player: PlayerState }) => {
    const { x, y, direction, hasWeapon, hasShield, isInvincible } = player;
    const shieldStyle: React.CSSProperties = {
        position: 'absolute',
        width: `${PLAYER_WIDTH + 20}px`,
        height: `${PLAYER_HEIGHT + 20}px`,
        left: '-10px',
        top: '-10px',
        borderRadius: '50%',
        border: '3px solid #00ffff',
        opacity: hasShield ? 0.75 : 0,
        transition: 'opacity 0.2s ease-in-out',
        animation: 'spin 4s linear infinite',
    };
    
    return (
        <div style={{
            position: 'absolute',
            left: x,
            top: y,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            transform: `scaleX(${direction === 'right' ? 1 : -1})`,
            opacity: isInvincible ? (Math.floor(Date.now() / 100) % 2 === 0 ? 0.5 : 1) : 1,
            transition: 'opacity 0.1s linear',
        }}>
             {hasShield && <div style={shieldStyle} />}
            {/* Body */}
            <div style={{ position: 'absolute', width: '80%', height: '80%', left: '10%', top: '20%', background: '#1a1a1a', border: '2px solid #00ff00' }} />
             {/* Energy Belt */}
            <div style={{ position: 'absolute', width: '85%', height: '10%', left: '7.5%', top: '50%', background: '#00ffff', animation: 'pulse 2s infinite' }} />
            {/* Head/Visor */}
            <div style={{ position: 'absolute', width: '60%', height: '25%', left: '20%', top: '0%', background: '#1a1a1a', border: '2px solid #00ff00' }}>
                 <div style={{width: '90%', height: '40%', margin: '15% auto', background: '#00ffff'}} />
            </div>
            {/* Pulse Glove */}
            <div style={{
                position: 'absolute',
                width: '25%',
                height: '25%',
                left: '70%',
                top: '50%',
                background: hasWeapon ? '#ffff00' : '#444',
                borderRadius: '50%',
                border: '2px solid #00ff00',
                transition: 'background 0.2s'
             }} />
        </div>
    );
});

const LevelEntity = React.memo(({ entity }: { entity: LevelEntityObject }) => {
    const { type, x, y, width, height, hit, active, collected } = entity;
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        boxSizing: 'border-box',
    };

    switch (type) {
        case 'platform':
            return <div style={{...style, background: '#333', border: '2px solid #555', borderTop: '4px solid #777' }} />;
        case 'power-up-box':
            return <div style={{ ...style, background: hit ? '#555' : '#ffae00', border: '3px solid #ffff00', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '2em', fontWeight: 'bold' }}>?</div>;
        case 'firewall':
            return active ? <div style={{ ...style, background: 'rgba(255, 0, 0, 0.5)', border: '2px solid red', animation: 'firewall-flicker 1s infinite' }} /> : null;
        case 'console':
            return <div style={{ ...style, background: '#1a4a1a', border: '3px solid #00ff00' }}><div style={{width: '80%', height: '60%', margin: '10% auto', background: '#000'}} /></div>;
        case 'log':
             return !collected ? <div style={{ ...style, background: '#00ffff', borderRadius: '50%', animation: 'pulse 2s infinite' }} /> : null;
        case 'goal':
             return active ? <div style={{ ...style, background: 'green', animation: 'pulse 2s infinite' }} /> : null;
        default:
            return null;
    }
});

const Enemy = React.memo(({ enemy }: { enemy: EnemyObject }) => {
    const { type, x, y, width, height, direction } = enemy;
     const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: `scaleX(${direction === 'right' ? 1 : -1})`,
    };

    if (type === 'Mini-Virus') {
        return <div style={{...style, background: '#333', border: '2px solid #ff0000'}}>
             <div style={{position: 'absolute', width: '40%', height: '40%', left: '30%', top: '30%', background: 'red', borderRadius: '50%', animation: 'pulse 1s infinite'}} />
        </div>;
    }
    if (type === 'Spam-bot') {
        return <div style={{...style, background: '#555', border: '2px solid orange'}}>
             <div style={{position: 'absolute', width: '70%', height: '20%', left: '15%', top: '40%', background: 'orange', borderRadius: '5px'}} />
        </div>;
    }
    if (type === 'The Adware King') {
         return <div style={{...style, background: 'purple', border: '4px solid #ff00ff'}}>
             <div style={{position: 'absolute', width: '50%', height: '20%', background: 'red', left: '25%', top: '10%'}} />
             <div style={{position: 'absolute', width: '20%', height: '20%', background: 'red', left: '15%', top: '40%'}} />
             <div style={{position: 'absolute', width: '20%', height: '20%', background: 'red', left: '65%', top: '40%'}} />
        </div>;
    }
    return null;
});

const ProjectileComponent = React.memo(({ projectile }: { projectile: Projectile }) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: projectile.x,
        top: projectile.y,
        width: 15,
        height: 15,
        borderRadius: '50%',
        background: projectile.owner === 'player' ? 'cyan' : 'orange',
    };
    return <div style={style} />;
});

const ParticleComponent = React.memo(({ particle }: { particle: Particle }) => (
    <div style={{
        position: 'absolute',
        left: particle.x,
        top: particle.y,
        width: 5,
        height: 5,
        background: '#ffff00',
        opacity: particle.opacity,
        borderRadius: '50%',
    }} />
));

const Background = React.memo(() => (
    <div style={{ position: 'absolute', width: '100%', height: '100%', background: '#0c0c1c', overflow: 'hidden' }}>
        {[...Array(50)].map((_, i) => (
             <div key={i} className="blinking-led" style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '4px',
                height: '4px',
                backgroundColor: '#00ff00',
                borderRadius: '50%',
                opacity: 0,
                animation: `blinking ${Math.random() * 5 + 2}s infinite ${Math.random() * 3}s`,
             }} />
        ))}
         <div className="scanline" />
         <div className="grid-bg" />
    </div>
));

const UI = React.memo(({ lives, message }: { lives: number, message: string }) => (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', color: 'white', fontFamily: 'monospace', zIndex: 100 }}>
        <div style={{ padding: '10px', fontSize: '20px' }}>
            ENERGY BYTES: {'💚'.repeat(lives)}
        </div>
         {message && <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.7)', padding: '15px', border: '1px solid #00ff00' }}>{message}</div>}
    </div>
));

// --- MAIN APP COMPONENT ---
export default function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [player, setPlayer] = useState<PlayerState>({ x: 50, y: 450, vx: 0, vy: 0, onGround: false, direction: 'right', hasWeapon: false, hasShield: false, isInvincible: false, invincibleTimer: 0 });
  const [enemies, setEnemies] = useState<EnemyObject[]>(JSON.parse(JSON.stringify(initialEnemies)));
  const [level, setLevel] = useState<LevelEntityObject[]>(JSON.parse(JSON.stringify(levelData)));
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [cameraX, setCameraX] = useState(0);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState('');
  const messageTimerRef = useRef<number | null>(null);
  
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const gameLoopRef = useRef<number>();

  const resetGame = useCallback(() => {
    setPlayer({ x: 50, y: 450, vx: 0, vy: 0, onGround: false, direction: 'right', hasWeapon: false, hasShield: false, isInvincible: false, invincibleTimer: 0 });
    setEnemies(JSON.parse(JSON.stringify(initialEnemies)));
    setLevel(JSON.parse(JSON.stringify(levelData)));
    setProjectiles([]);
    setParticles([]);
    setLives(3);
    setMessage('');
    setGameState('playing');
  }, []);
  
  const createParticles = useCallback((x: number, y: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
        newParticles.push({
            id: Math.random(),
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            opacity: 1,
        });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if(messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 4000);
  }, []);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    // --- Player Logic ---
    setPlayer(p => {
        let { x, y, vx, vy, onGround, direction, hasShield, isInvincible, invincibleTimer } = p;
        
        // Horizontal movement
        vx = 0;
        if (keysRef.current.ArrowLeft || keysRef.current.a) { vx = -PLAYER_SPEED; direction = 'left'; }
        if (keysRef.current.ArrowRight || keysRef.current.d) { vx = PLAYER_SPEED; direction = 'right'; }
        
        // Jumping
        if ((keysRef.current.ArrowUp || keysRef.current.w) && onGround) {
            vy = JUMP_FORCE;
            onGround = false;
        }

        // Apply gravity
        vy += GRAVITY;
        
        // Handle invincibility timer
        if (isInvincible) {
            invincibleTimer -= 1;
            if(invincibleTimer <= 0) isInvincible = false;
        }
        
        // Update position
        let newX = x + vx;
        let newY = y + vy;
        
        onGround = false;

        // Collision with level
        level.forEach(entity => {
            if (entity.type !== 'platform' && entity.type !== 'firewall') return;
            if (entity.type === 'firewall' && !entity.active) return;
            
            const entityRect = { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
            const playerRect = { x: newX, y: newY, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };

            if (checkCollision(playerRect, entityRect)) {
                // Vertical collision
                if (y + PLAYER_HEIGHT <= entity.y && newY + PLAYER_HEIGHT > entity.y) {
                    newY = entity.y - PLAYER_HEIGHT;
                    vy = 0;
                    onGround = true;
                }
                // Hitting head
                else if (y >= entity.y + entity.height && newY < entity.y + entity.height) {
                    newY = entity.y + entity.height;
                    vy = 0;
                }
                 // Horizontal collision
                else if (x + PLAYER_WIDTH <= entity.x && newX + PLAYER_WIDTH > entity.x) {
                    newX = entity.x - PLAYER_WIDTH;
                } else if (x >= entity.x + entity.width && newX < entity.x + entity.width) {
                    newX = entity.x + entity.width;
                }
            }
        });
        
        // Out of bounds check
        if(newY > HEIGHT + 100) {
            setLives(l => l - 1);
            if(lives -1 <= 0) {
                setGameState('lose');
            } else {
                return {...p, x: 50, y: 450, vx:0, vy:0};
            }
        }
        
        return { ...p, x: newX, y: newY, vx, vy, onGround, direction, isInvincible, invincibleTimer };
    });
    
    // --- Enemy Logic ---
    setEnemies(prevEnemies => prevEnemies.map(e => {
        let { x, y, vx, direction, shootCooldown, health, patrolStart, patrolEnd } = e;
        if(e.type === 'Mini-Virus') {
            x += vx;
            if (x < patrolStart) { x = patrolStart; vx = -vx; direction = 'right'; }
            if (x + e.width > patrolEnd) { x = patrolEnd - e.width; vx = -vx; direction = 'left'; }
        }
        if(e.type === 'Spam-bot') {
            const playerDist = Math.abs(player.x - x);
            if(playerDist < 400 && shootCooldown <= 0) {
                 setProjectiles(pr => [...pr, {id: Math.random(), x: e.x, y: e.y + 20, vx: player.x < x ? -5:5, owner: 'enemy'}]);
                 shootCooldown = 120;
            }
            if(shootCooldown > 0) shootCooldown--;
        }
        if(e.type === 'The Adware King') {
            if (player.x > 4200 && level.find(l => l.id === 999)?.active) {
                if (direction === 'down') y += 1; else y -= 1;
                if (y < patrolStart) direction = 'down';
                if (y > patrolEnd) direction = 'up';
                 if (shootCooldown <= 0) {
                    setProjectiles(pr => [...pr, {id: Math.random(), x: e.x, y: e.y + 50, vx: -8, owner: 'enemy'}]);
                    setProjectiles(pr => [...pr, {id: Math.random(), x: e.x, y: e.y + 50, vx: -6, owner: 'enemy'}]);
                    shootCooldown = 90;
                }
                if (shootCooldown > 0) shootCooldown--;
            }
        }

        return { ...e, x, y, vx, direction, shootCooldown, health };
    }).filter(e => (e.health ?? 1) > 0));

    // --- Projectiles Logic ---
    setProjectiles(prev => prev.map(p => ({...p, x: p.x + p.vx})).filter(p => p.x > cameraX && p.x < cameraX + WIDTH));
    
    // --- Collision Detection ---
    setPlayer(p => {
        if(p.isInvincible) return p;

        let playerHit = false;
        
        // Player vs Enemies
        enemies.forEach(enemy => {
            if(checkCollision({...p, width: PLAYER_WIDTH, height: PLAYER_HEIGHT}, enemy)) {
                playerHit = true;
            }
        });

        // Player vs Projectiles
        projectiles.forEach(proj => {
            if(proj.owner === 'enemy' && checkCollision({...p, width: PLAYER_WIDTH, height: PLAYER_HEIGHT}, {...proj, width: 10, height: 10})) {
                playerHit = true;
                setProjectiles(pr => pr.filter(x => x.id !== proj.id));
            }
        });
        
        if (playerHit) {
            if(p.hasShield) {
                return {...p, hasShield: false, isInvincible: true, invincibleTimer: 120};
            } else {
                setLives(l => l-1);
                if(lives-1 <= 0) setGameState('lose');
                return {...p, x: 50, y: 450, vx: 0, vy: 0, isInvincible: true, invincibleTimer: 120};
            }
        }
        return p;
    });

    // Projectile vs Enemies
    projectiles.forEach(proj => {
        if (proj.owner === 'player') {
            enemies.forEach(enemy => {
                if (checkCollision({ ...proj, width: 10, height: 10 }, enemy)) {
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    setProjectiles(pr => pr.filter(x => x.id !== proj.id));
                    setEnemies(en => en.map(e => e.id === enemy.id ? {...e, health: (e.health ?? 1) - 1} : e));
                }
            });
        }
    });

    // --- Interactive Elements ---
    setPlayer(p => {
        const playerHead = { x: p.x, y: p.y - 1, width: PLAYER_WIDTH, height: 1 };
        let updatedLevel = [...level];
        let playerUpdated = {...p};

        updatedLevel.forEach(entity => {
             // Power-up box
            if (entity.type === 'power-up-box' && !entity.hit && p.vy < 0) {
                 if(checkCollision(playerHead, entity)) {
                     entity.hit = true;
                     createParticles(entity.x + entity.width / 2, entity.y + entity.height / 2);
                     const powerups = ['weapon', 'shield', 'invincibility', 'life'];
                     const randomPowerup = powerups[Math.floor(Math.random() * powerups.length)];
                     switch(randomPowerup) {
                         case 'weapon': playerUpdated.hasWeapon = true; break;
                         case 'shield': playerUpdated.hasShield = true; break;
                         case 'invincibility': playerUpdated.isInvincible = true; playerUpdated.invincibleTimer = 300; break;
                         case 'life': setLives(l => l + 1); break;
                     }
                 }
            }
            // Console
            if (entity.type === 'console' && keysRef.current.e) {
                 if (checkCollision({x:p.x,y:p.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT}, entity)) {
                     const linkedFirewall = updatedLevel.find(f => f.id === entity.linkedElementId);
                     if(linkedFirewall && linkedFirewall.type === 'firewall') {
                         linkedFirewall.active = false;
                         showMessage(mentorMessages[entity.id]);
                     }
                 }
            }
            // Log
            if (entity.type === 'log' && !entity.collected) {
                 if (checkCollision({x:p.x,y:p.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT}, entity)) {
                     entity.collected = true;
                     showMessage(mentorMessages[entity.id]);
                 }
            }
             // Goal
            if (entity.type === 'goal' && entity.active) {
                if (checkCollision({x:p.x,y:p.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT}, entity)) {
                    setGameState('win');
                }
            }
        });
        
        setLevel(updatedLevel);
        return playerUpdated;
    });
    
    if (player.x > 4200 && level.find(l => l.id === 999)?.active) {
        showMessage(mentorMessages[999]);
    }

    if (!enemies.some(e => e.type === 'The Adware King')) {
        const goal = level.find(e => e.type === 'goal');
        if (goal) goal.active = true;
    }


    // --- Particles Logic ---
    setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        opacity: p.opacity - 0.05,
    })).filter(p => p.opacity > 0));

    // --- Camera Logic ---
    setCameraX(prev => {
        const target = player.x - WIDTH / 2;
        const newCamX = prev + (target - prev) * 0.1;
        return Math.max(0, Math.min(LEVEL_WIDTH - WIDTH, newCamX));
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, player.x, lives, level, enemies, projectiles, cameraX, createParticles, showMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => {
        keysRef.current[e.key] = false;
        if (e.key === 'x' && player.hasWeapon) {
            setProjectiles(prev => [...prev, {
                id: Math.random(),
                x: player.x + (player.direction === 'right' ? PLAYER_WIDTH : -10),
                y: player.y + PLAYER_HEIGHT / 2,
                vx: player.direction === 'right' ? 10 : -10,
                owner: 'player'
            }]);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [player.hasWeapon, player.direction, player.x, player.y]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);
  
  const StartScreen = () => (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center text-white font-mono z-50">
      <h1 className="text-5xl text-green-400 mb-4">Cyber Defender</h1>
      <p className="text-xl mb-8">The Firewall Quest</p>
      <button className="px-8 py-4 bg-green-500 text-black font-bold text-2xl border-2 border-green-300 hover:bg-green-400" onClick={resetGame}>Start Mission</button>
    </div>
  );

  const EndScreen = ({ message, onRestart }: { message: string, onRestart: () => void }) => (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center text-white font-mono z-50">
      <h1 className="text-5xl text-red-500 mb-4">{message}</h1>
      <button className="px-8 py-4 bg-red-500 text-black font-bold text-2xl border-2 border-red-300 hover:bg-red-400" onClick={onRestart}>Retry</button>
    </div>
  );

  const GameScreen = ({ children, cameraX }: { children: React.ReactNode, cameraX: number }) => (
      <div style={{ transform: `translateX(-${cameraX}px)`, width: LEVEL_WIDTH, height: HEIGHT, position: 'relative' }}>
        {children}
      </div>
  )

  const boss = enemies.find(e => e.type === 'The Adware King');

  return (
    <>
    <div style={{ width: WIDTH, height: HEIGHT, margin: '20px auto', overflow: 'hidden', position: 'relative', background: 'black', border: '2px solid #00ff00' }}>
      {gameState === 'start' && <StartScreen />}
      {gameState === 'lose' && <EndScreen message="SYSTEM FAILURE" onRestart={resetGame} />}
      {gameState === 'win' && <EndScreen message="SECTOR CLEARED" onRestart={resetGame} />}

      {gameState === 'playing' && (
        <>
        <Background />
        <UI lives={lives} message={message}/>
        {/* FIX: Wrapped children in a React Fragment to resolve a potential typing issue. */}
        <GameScreen cameraX={cameraX}>
            <>
                {level.map(e => <LevelEntity key={e.id} entity={e} />)}
                {enemies.map(e => <Enemy key={e.id} enemy={e} />)}
                <Player player={player} />
                {projectiles.map(p => <ProjectileComponent key={p.id} projectile={p} />)}
                {particles.map(p => <ParticleComponent key={p.id} particle={p} />)}
            </>
        </GameScreen>
        {boss && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', width: '50%', background: '#333', border: '1px solid red' }}>
                <div style={{ height: 20, width: `${(boss.health! / boss.maxHealth!) * 100}%`, background: 'red' }} />
            </div>
        )}
        </>
      )}
    </div>
    <style>{`
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        @keyframes firewall-flicker {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }
        @keyframes blinking {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }
        .scanline {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%);
            background-size: 100% 4px;
            animation: scan 10s linear infinite;
            pointer-events: none;
        }
        .grid-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 200%;
            height: 200%;
            background-image:
                linear-gradient(to right, rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: move-grid 20s linear infinite;
        }
        @keyframes scan {
            from { background-position: 0 0; }
            to { background-position: 0 -600px; }
        }
        @keyframes move-grid {
             from { transform: translate(0, 0); }
             to { transform: translate(-50px, -50px); }
        }
    `}</style>
    </>
  );
}
