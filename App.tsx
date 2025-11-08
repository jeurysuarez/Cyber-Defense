import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- TYPE DEFINITIONS ---
interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  lives: number;
  hasShield: boolean;
  hasWeapon: boolean;
  invincible: boolean;
  invincibleTimer: number;
}

interface LevelEntityObject {
  id: number;
  type: 'platform' | 'enemy' | 'powerupBox' | 'firewall' | 'console' | 'log' | 'boss' | 'spambot';
  variant?: 'mini-virus';
  x: number;
  y: number;
  width: number;
  height: number;
  patrolStart?: number;
  patrolEnd?: number;
  direction?: number;
  activated?: boolean;
  linkedId?: number;
  health?: number;
  maxHealth?: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'player' | 'enemy';
}

interface ParticleEffect {
    id: number;
    x: number;
    y: number;
}

interface MentorMessage {
  id: number;
  text: string;
  triggered: boolean;
}

// --- GAME CONSTANTS ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const PLAYER_SPEED = 5;
const JUMP_STRENGTH = -12;
const GRAVITY = 0.6;
const PROJECTILE_SPEED = 8;
const LEVEL_WIDTH = 3200; 
const BOSS_ARENA_START = LEVEL_WIDTH - GAME_WIDTH;

// --- LEVEL DATA ---
const level1Data: LevelEntityObject[] = [
    // --- Ground and Platforms ---
    { id: 1, type: 'platform', x: 0, y: 550, width: 800, height: 50 },
    { id: 2, type: 'platform', x: 900, y: 550, width: 600, height: 50 },
    { id: 3, type: 'platform', x: 1600, y: 550, width: 400, height: 50 },
    { id: 4, type: 'platform', x: 2100, y: 550, width: 200, height: 50 },
    { id: 5, type: 'platform', x: 2400, y: 550, width: 800, height: 50 },
    { id: 6, type: 'platform', x: 200, y: 450, width: 150, height: 20 },
    { id: 7, type: 'platform', x: 400, y: 380, width: 150, height: 20 },
    { id: 8, type: 'platform', x: 1000, y: 450, width: 150, height: 20 },
    { id: 9, type: 'platform', x: 1200, y: 350, width: 150, height: 20 },
    { id: 10, type: 'platform', x: 1700, y: 400, width: 150, height: 20 },
    { id: 11, type: 'platform', x: 2200, y: 300, width: 150, height: 20 },

    // --- Enemies ---
    { id: 101, type: 'enemy', variant: 'mini-virus', x: 500, y: 510, width: 40, height: 40, patrolStart: 500, patrolEnd: 700, direction: 1 },
    { id: 102, type: 'enemy', variant: 'mini-virus', x: 1100, y: 510, width: 40, height: 40, patrolStart: 1100, patrolEnd: 1400, direction: 1 },
    { id: 103, type: 'enemy', variant: 'mini-virus', x: 1750, y: 510, width: 40, height: 40, patrolStart: 1750, patrolEnd: 1900, direction: -1 },
    { id: 104, type: 'spambot', x: 1225, y: 310, width: 40, height: 40 },
    { id: 105, type: 'spambot', x: 2225, y: 260, width: 40, height: 40 },

    // --- Power-ups & Interactive ---
    { id: 201, type: 'powerupBox', x: 250, y: 350, width: 40, height: 40, activated: false }, // Weapon
    { id: 202, type: 'powerupBox', x: 1050, y: 350, width: 40, height: 40, activated: false }, // Invincibility
    { id: 203, type: 'powerupBox', x: 1750, y: 300, width: 40, height: 40, activated: false }, // Extra Life
    
    { id: 301, type: 'firewall', x: 2000, y: 450, width: 20, height: 100, activated: true },
    { id: 302, type: 'console', x: 1800, y: 510, width: 50, height: 40, linkedId: 301, activated: false },

    { id: 401, type: 'log', x: 450, y: 350, width: 30, height: 30, activated: false },

    // --- Boss ---
    { id: 501, type: 'boss', x: 2800, y: 300, width: 150, height: 150, health: 10, maxHealth: 10, direction: 1 }
];

const mentorMessages: MentorMessage[] = [
    {id: 1, text: "> SYS_ADMIN: Welcome to CyberNetOS, ZeroByte. My diagnostics show the first infection point is in this home network sector. Let's get to work.", triggered: false},
    {id: 2, text: "> SYS_ADMIN: Watch out. Basic malware detected. They're simple, but they can still corrupt your energy bytes.", triggered: false},
    {id: 3, text: "> SYS_ADMIN: I'm detecting power-up containers. Hit them from below. They should contain useful subroutines.", triggered: false},
    {id: 4, text: "> SYS_ADMIN: That's a data log. Collect it. These logs might tell us how the infection started.", triggered: false},
    {id: 5, text: "> SYS_ADMIN: A corrupted firewall is blocking the path. Find its control console to deactivate it. You'll need to get close and interface with 'E'.", triggered: false},
    {id: 6, text: "> SYS_ADMIN: That's it! Firewall deactivated. Proceed with caution.", triggered: false},
    {id: 7, text: "> SYS_ADMIN: Reading high-level corruption ahead... It's the sector's guardian program, now a puppet. You have to take it down. This is the 'Adware King'.", triggered: false},
];


// --- UTILITY FUNCTIONS ---
const useGameLoop = (callback: () => void) => {
    const requestRef = useRef<number>();
    const animate = () => {
        callback();
        requestRef.current = requestAnimationFrame(animate);
    };
    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [callback]);
};

// --- REACT COMPONENTS ---
interface ScreenProps {
    onStart?: () => void;
    onRestart?: () => void;
    children?: React.ReactNode;
}

const UI: React.FC<{ lives: number; hasShield: boolean; hasWeapon: boolean; invincible: boolean; message: string; bossHealth: number | null; bossMaxHealth: number | null }> = ({ lives, hasShield, hasWeapon, invincible, message, bossHealth, bossMaxHealth }) => (
    <div className="absolute top-0 left-0 w-full p-4 text-green-400 font-mono z-20 pointer-events-none">
        <div className="flex justify-between items-start">
            <div>
                <p>ENERGY BYTES: {'O '.repeat(lives)}</p>
                <div className="flex space-x-4 mt-2">
                    {hasShield && <p className="bg-blue-500 text-black px-2 py-1 rounded">SHIELD</p>}
                    {hasWeapon && <p className="bg-yellow-500 text-black px-2 py-1 rounded">WEAPON</p>}
                    {invincible && <p className="bg-purple-500 text-black px-2 py-1 rounded animate-pulse">INVINCIBLE</p>}
                </div>
            </div>
            
        </div>
        {message && <p className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 p-2 rounded">{message}</p>}
        {bossHealth !== null && bossMaxHealth !== null && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-1/2 bg-gray-700 rounded overflow-hidden border-2 border-red-500">
                <div className="bg-red-500 h-6" style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}></div>
                <p className="absolute inset-0 text-center text-white font-bold">THE ADWARE KING</p>
            </div>
        )}
    </div>
);

const StartScreen: React.FC<ScreenProps> = ({ onStart }) => (
    <div className="w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-80 text-green-400 font-mono">
        <h1 className="text-6xl mb-4 animate-pulse">Cyber Defender</h1>
        <h2 className="text-3xl mb-8">The Firewall Quest</h2>
        <button onClick={onStart} className="text-2xl px-8 py-4 border-2 border-green-400 rounded hover:bg-green-400 hover:text-black transition-colors">
            &gt; START MISSION &lt;
        </button>
    </div>
);

const EndScreen: React.FC<ScreenProps> = ({ onRestart }) => (
    <div className="w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-80 text-red-500 font-mono">
        <h1 className="text-6xl mb-4">SYSTEM FAILURE</h1>
        <h2 className="text-3xl mb-8">Energy Bytes Depleted</h2>
        <button onClick={onRestart} className="text-2xl px-8 py-4 border-2 border-red-500 rounded hover:bg-red-500 hover:text-black transition-colors">
            &gt; REBOOT &lt;
        </button>
    </div>
);

const LevelCompleteScreen: React.FC<ScreenProps> = ({ onRestart }) => (
    <div className="w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-80 text-cyan-400 font-mono">
        <h1 className="text-6xl mb-4">SECTOR CLEANSED</h1>
        <h2 className="text-3xl mb-8">Adware King Defeated</h2>
        <button onClick={onRestart} className="text-2xl px-8 py-4 border-2 border-cyan-400 rounded hover:bg-cyan-400 hover:text-black transition-colors">
            &gt; CONTINUE TO NEXT SECTOR &lt;
        </button>
    </div>
);

const Player: React.FC<{ x: number; y: number; invincible: boolean }> = ({ x, y, invincible }) => (
    <div
        className={`absolute transition-transform duration-100 ${invincible ? 'opacity-50' : ''}`}
        style={{
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            transform: `translate(${x}px, ${y}px)`,
        }}
    >
        <div className="w-full h-full bg-black border-2 border-green-400 relative">
            {/* Visor */}
            <div className="absolute top-[10px] left-[5px] right-[5px] h-[10px] bg-blue-400 border border-blue-200"></div>
             {/* Body detail */}
            <div className="absolute bottom-[10px] left-[15px] right-[15px] h-[20px] bg-gray-800 border-t border-green-500"></div>
        </div>
         {/* Floating Hands */}
        <div className="absolute top-[25px] -left-[10px] w-5 h-5 bg-gray-600 border border-green-400 rounded-full animate-float"></div>
        <div className="absolute top-[25px] -right-[10px] w-5 h-5 bg-gray-600 border border-green-400 rounded-full animate-float-delay"></div>
        {/* Floating Feet */}
        <div className="absolute bottom-[-15px] left-[5px] w-6 h-4 bg-gray-700 border border-green-400"></div>
        <div className="absolute bottom-[-15px] right-[5px] w-6 h-4 bg-gray-700 border border-green-400"></div>
        <style>{`
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
            .animate-float { animation: float 2s ease-in-out infinite; }
            .animate-float-delay { animation: float 2s 1s ease-in-out infinite; }
        `}</style>
    </div>
);


const LevelEntity: React.FC<{ entity: LevelEntityObject }> = ({ entity }) => {
    const baseStyle = {
        position: 'absolute',
        left: entity.x,
        top: entity.y,
        width: entity.width,
        height: entity.height,
    } as React.CSSProperties;

    const getEntityStyle = () => {
        switch(entity.type) {
            case 'platform':
                return { 
                    ...baseStyle, 
                    backgroundColor: '#052e16', // dark green
                    border: '2px solid #10b981', // emerald-500
                    boxShadow: 'inset 0 0 10px #10b981',
                };
            case 'enemy':
                 return { ...baseStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' };
            case 'spambot':
                return { ...baseStyle, backgroundColor: '#4a4a4a', border: '2px solid #f97316' };
            case 'powerupBox':
                return {
                    ...baseStyle,
                    backgroundColor: entity.activated ? '#333' : '#f59e0b',
                    border: '2px solid white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '2rem',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: entity.activated ? 'none' : '0 0 15px #f59e0b'
                };
            case 'firewall':
                return { ...baseStyle, backgroundColor: entity.activated ? 'rgba(239, 68, 68, 0.7)' : 'rgba(74, 222, 128, 0.3)', border: `2px solid ${entity.activated ? '#ef4444' : '#4ade80'}` };
            case 'console':
                return { ...baseStyle, backgroundColor: '#1f2937', border: `3px solid ${entity.activated ? '#4ade80' : '#f59e0b'}` };
            case 'log':
                return { ...baseStyle, backgroundColor: '#3b82f6', borderRadius: '50%', border: '2px solid white' };
            case 'boss':
                 return { ...baseStyle, backgroundColor: '#4a044e', border: '4px solid #a21caf' };
            default:
                return baseStyle;
        }
    };

    return (
        <div style={getEntityStyle()}>
            {entity.type === 'powerupBox' && !entity.activated && '?'}
            {entity.type === 'console' && (
                <div className="w-full h-full flex justify-center items-center">
                    <div className="w-3/4 h-1/2 bg-black border border-green-400 animate-pulse"></div>
                </div>
            )}
            {entity.type === 'enemy' && entity.variant === 'mini-virus' && (
                <div className="w-1/2 h-1/2 bg-red-600 rounded-full animate-pulse border-2 border-red-300"></div>
            )}
             {entity.type === 'spambot' && (
                <div className="w-1/2 h-1/2 bg-orange-500 rounded-full border-2 border-orange-200"></div>
            )}
            {entity.type === 'boss' && (
                <div className="w-full h-full flex justify-center items-center">
                    <div className="w-1/3 h-1/3 bg-red-500 animate-pulse"></div>
                </div>
            )}
        </div>
    );
};


const ProjectileComponent: React.FC<{ projectile: Projectile }> = ({ projectile }) => (
    <div
        className="absolute"
        style={{
            left: projectile.x,
            top: projectile.y,
            width: 15,
            height: 15,
            backgroundColor: projectile.type === 'player' ? '#67e8f9' : '#f97316',
            borderRadius: '50%',
            boxShadow: `0 0 10px ${projectile.type === 'player' ? '#67e8f9' : '#f97316'}`,
        }}
    ></div>
);

const ParticleEffect: React.FC<{ x: number; y: number }> = ({ x, y }) => {
    const particles = Array.from({ length: 10 });
    return (
        <div className="absolute" style={{ left: x, top: y, width: 1, height: 1 }}>
            {particles.map((_, i) => (
                <div
                    key={i}
                    className="absolute bg-yellow-400 rounded-full"
                    style={{
                        animation: `particle-burst 0.5s ease-out forwards`,
                        '--angle': `${Math.random() * 360}deg`,
                        '--distance': `${Math.random() * 30 + 20}px`,
                        width: '5px',
                        height: '5px',
                    }}
                ></div>
            ))}
            <style>{`
                @keyframes particle-burst {
                    from { transform: rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
                    to { transform: rotate(var(--angle)) translateX(var(--distance)) scale(0); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

const GameBackground: React.FC<{ cameraX: number }> = ({ cameraX }) => (
    <div 
        className="absolute top-0 left-0 w-full h-full bg-black overflow-hidden"
    >
        <div 
            className="absolute top-0 left-0 w-[200%] h-full bg-[linear-gradient(rgba(0,0,0,0.9),rgba(0,0,0,0.9)),url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%20width%3D%2232%22%20height%3D%2232%22%20fill%3D%22none%22%20stroke%3D%22%23059669%22%3E%3Cpath%20d%3D%22M0%20.5H32V32%22/%3E%3C/svg%3E')]"
            style={{
                transform: `translateX(${-cameraX * 0.1}px)`,
                animation: 'background-pan 10s linear infinite alternate',
            }}
        ></div>
         <div 
            className="absolute top-0 left-0 w-[200%] h-full"
            style={{
                transform: `translateX(${-cameraX * 0.3}px)`,
                background: `radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 30%),
                             radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.1) 0%, transparent 30%)`,
            }}
        ></div>
    </div>
);


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'dead' | 'levelComplete'>('start');
    
    const [playerState, setPlayerState] = useState<PlayerState>({ x: 100, y: 490, vx: 0, vy: 0, onGround: false, lives: 3, hasShield: false, hasWeapon: false, invincible: false, invincibleTimer: 0 });
    
    const [levelEntities, setLevelEntities] = useState<LevelEntityObject[]>(JSON.parse(JSON.stringify(level1Data)));
    
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [enemyProjectiles, setEnemyProjectiles] = useState<Projectile[]>([]);

    const [particleEffects, setParticleEffects] = useState<ParticleEffect[]>([]);
    
    const [keys, setKeys] = useState<Record<string, boolean>>({});
    const [cameraX, setCameraX] = useState(0);

    const [currentMessage, setCurrentMessage] = useState("");
    const [messages, setMessages] = useState<MentorMessage[]>(JSON.parse(JSON.stringify(mentorMessages)));
    // FIX: Changed NodeJS.Timeout to number for browser compatibility.
    const messageTimeoutRef = useRef<number | null>(null);

    const shootCooldown = useRef(false);
    const spambotCooldowns = useRef<Record<number, boolean>>({});

    const triggerMessage = useCallback((text: string) => {
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
        }
        setCurrentMessage(text);
        messageTimeoutRef.current = setTimeout(() => {
            setCurrentMessage("");
        }, 5000);
    }, []);

    const checkAndTriggerMentorMessage = useCallback((condition: boolean, msgId: number) => {
        const msg = messages.find(m => m.id === msgId);
        if (condition && msg && !msg.triggered) {
            triggerMessage(msg.text);
            setMessages(prev => prev.map(m => m.id === msgId ? {...m, triggered: true} : m));
        }
    }, [messages, triggerMessage]);

    const resetGame = useCallback(() => {
        setPlayerState({ x: 100, y: 490, vx: 0, vy: 0, onGround: false, lives: 3, hasShield: false, hasWeapon: false, invincible: false, invincibleTimer: 0 });
        setLevelEntities(JSON.parse(JSON.stringify(level1Data)));
        setProjectiles([]);
        setEnemyProjectiles([]);
        setMessages(JSON.parse(JSON.stringify(mentorMessages)));
        setCurrentMessage("");
        setGameState('playing');
    }, []);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
        const handleKeyUp = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const gameLogic = useCallback(() => {
        if (gameState !== 'playing') return;

        let newPlayerState = { ...playerState };

        // --- Handle Input ---
        let targetVx = 0;
        if (keys['a'] || keys['arrowleft']) targetVx = -PLAYER_SPEED;
        if (keys['d'] || keys['arrowright']) targetVx = PLAYER_SPEED;
        newPlayerState.vx = targetVx;

        if ((keys['w'] || keys['arrowup'] || keys[' ']) && newPlayerState.onGround) {
            newPlayerState.vy = JUMP_STRENGTH;
            newPlayerState.onGround = false;
        }

        if (keys['x'] && playerState.hasWeapon && !shootCooldown.current) {
            setProjectiles(prev => [...prev, { id: Date.now(), x: playerState.x + PLAYER_WIDTH / 2, y: playerState.y + PLAYER_HEIGHT / 2, vx: PLAYER_SPEED + 2, vy: 0 }]);
            shootCooldown.current = true;
            setTimeout(() => { shootCooldown.current = false; }, 300);
        }

        // --- Physics & Player Update ---
        newPlayerState.vy += GRAVITY;
        newPlayerState.x += newPlayerState.vx;
        newPlayerState.y += newPlayerState.vy;
        newPlayerState.onGround = false;

        // --- Boundary checks ---
        if (newPlayerState.x < 0) newPlayerState.x = 0;
        if (newPlayerState.x + PLAYER_WIDTH > LEVEL_WIDTH) newPlayerState.x = LEVEL_WIDTH - PLAYER_WIDTH;
        if (newPlayerState.y > GAME_HEIGHT) { // Player fell
            newPlayerState.lives -= 1;
            if (newPlayerState.lives <= 0) {
                setGameState('dead');
            } else {
                newPlayerState.x = 100;
                newPlayerState.y = 490;
                newPlayerState.vy = 0;
            }
        }
        
        // --- Collision Detection with platforms/firewalls ---
        levelEntities.forEach(entity => {
            if (entity.type !== 'platform' && entity.type !== 'firewall') return;
            if (entity.type === 'firewall' && !entity.activated) return;

            if (newPlayerState.x < entity.x + entity.width &&
                newPlayerState.x + PLAYER_WIDTH > entity.x &&
                newPlayerState.y < entity.y + entity.height &&
                newPlayerState.y + PLAYER_HEIGHT > entity.y) {

                const overlapX = (newPlayerState.x + PLAYER_WIDTH / 2) - (entity.x + entity.width / 2);
                const overlapY = (newPlayerState.y + PLAYER_HEIGHT / 2) - (entity.y + entity.height / 2);
                const combinedHalfWidths = PLAYER_WIDTH / 2 + entity.width / 2;
                const combinedHalfHeights = PLAYER_HEIGHT / 2 + entity.height / 2;

                if (Math.abs(overlapX) < combinedHalfWidths && Math.abs(overlapY) < combinedHalfHeights) {
                    const overlapXAmount = combinedHalfWidths - Math.abs(overlapX);
                    const overlapYAmount = combinedHalfHeights - Math.abs(overlapY);
                    
                    if (overlapYAmount < overlapXAmount) {
                         if (overlapY > 0 && newPlayerState.vy < 0) { // Collision from top
                            newPlayerState.y = entity.y + entity.height;
                            newPlayerState.vy = 0;
                            
                            if(entity.type === 'platform') { // Check for powerup box hit
                                const box = levelEntities.find(p => p.type === 'powerupBox' && !p.activated && newPlayerState.x < p.x + p.width && newPlayerState.x + PLAYER_WIDTH > p.x && p.y > entity.y && Math.abs((newPlayerState.y - PLAYER_HEIGHT) - p.y) < 50);
                                if (box && newPlayerState.y > box.y + box.height) { // Ensure player is below the box
                                     setLevelEntities(prev => prev.map(e => e.id === box.id ? {...e, activated: true} : e));
                                    setParticleEffects(prev => [...prev, { id: Date.now(), x: box.x + box.width / 2, y: box.y + box.height / 2 }]);
                                    
                                    if(box.id === 201) newPlayerState.hasWeapon = true;
                                    if(box.id === 202) {
                                        newPlayerState.invincible = true;
                                        newPlayerState.invincibleTimer = 300; // 5 seconds at 60fps
                                    }
                                    if(box.id === 203) newPlayerState.lives = Math.min(5, newPlayerState.lives + 1);
                                }
                            }
                        } else { // Collision from bottom
                            newPlayerState.y = entity.y - PLAYER_HEIGHT;
                            newPlayerState.vy = 0;
                            newPlayerState.onGround = true;
                        }
                    } else {
                         if (overlapX > 0) { // Collision from left
                            newPlayerState.x = entity.x + entity.width;
                        } else { // Collision from right
                            newPlayerState.x = entity.x - PLAYER_WIDTH;
                        }
                    }
                }
            }
        });
        
        // --- Invincibility Timer ---
        if (newPlayerState.invincibleTimer > 0) {
            newPlayerState.invincibleTimer -= 1;
        } else if (newPlayerState.invincible) {
            newPlayerState.invincible = false;
        }

        const takeDamage = () => {
            if (newPlayerState.invincible) return;
            newPlayerState.lives -= 1;
            newPlayerState.invincible = true;
            newPlayerState.invincibleTimer = 120; // 2 seconds of invincibility after hit
            if (newPlayerState.lives <= 0) {
                setGameState('dead');
            }
        };

        // --- Enemy Logic and Collision ---
        const newLevelEntities = levelEntities.map(entity => {
            let newEntity = {...entity};
            if (entity.type === 'enemy' || entity.type === 'boss' || entity.type === 'spambot') {
                // Player-Enemy collision
                if (newPlayerState.x < entity.x + entity.width &&
                    newPlayerState.x + PLAYER_WIDTH > entity.x &&
                    newPlayerState.y < entity.y + entity.height &&
                    newPlayerState.y + PLAYER_HEIGHT > entity.y) {
                    takeDamage();
                }
            }

            if (entity.type === 'enemy' && entity.variant === 'mini-virus') {
                newEntity.x += newEntity.direction! * 2;
                if (newEntity.x < newEntity.patrolStart! || newEntity.x + newEntity.width > newEntity.patrolEnd!) {
                    newEntity.direction = -newEntity.direction!;
                }
            }
            if (entity.type === 'spambot') {
                 if (!spambotCooldowns.current[entity.id] && Math.abs((playerState.x + PLAYER_WIDTH/2) - (entity.x + entity.width/2)) < 400 ) {
                    setEnemyProjectiles(prev => [...prev, {id: Date.now(), x: entity.x + entity.width/2, y: entity.y + entity.height / 2, vx: playerState.x < entity.x ? -PROJECTILE_SPEED/2 : PROJECTILE_SPEED/2, vy: 0}]);
                    spambotCooldowns.current[entity.id] = true;
                    setTimeout(() => { spambotCooldowns.current[entity.id] = false; }, 2000);
                }
            }
            if (entity.type === 'boss') {
                const playerCenterY = newPlayerState.y + PLAYER_HEIGHT / 2;
                if (playerCenterY < newEntity.y + newEntity.height / 2) newEntity.y -= 1;
                if (playerCenterY > newEntity.y + newEntity.height / 2) newEntity.y += 1;
                
                 if (!spambotCooldowns.current[entity.id]) {
                    setEnemyProjectiles(prev => [...prev, {id: Date.now(), x: entity.x, y: entity.y + entity.height / 2, vx: -PROJECTILE_SPEED, vy: (Math.random() - 0.5) * 4}]);
                    spambotCooldowns.current[entity.id] = true;
                    setTimeout(() => { spambotCooldowns.current[entity.id] = false; }, 1500);
                }
            }
            return newEntity;
        }).filter(e => e.health === undefined || e.health > 0);
        
        // --- Projectile Logic ---
        const updatedProjectiles = projectiles.map(p => ({...p, x: p.x + p.vx})).filter(p => p.x < LEVEL_WIDTH && p.x > 0);
        const updatedEnemyProjectiles = enemyProjectiles.map(p => ({...p, x: p.x + p.vx})).filter(p => p.x < LEVEL_WIDTH && p.x > 0);

        let projectilesToRemove: number[] = [];
        let enemiesToRemove: number[] = [];
        let bossDamage = 0;

        updatedProjectiles.forEach(p => {
            newLevelEntities.forEach(e => {
                if ((e.type === 'enemy' || e.type === 'spambot' || e.type === 'boss') && p.x < e.x + e.width && p.x + 15 > e.x && p.y < e.y + e.height && p.y + 15 > e.y) {
                    projectilesToRemove.push(p.id);
                    if (e.type === 'boss') {
                        bossDamage++;
                    } else {
                        enemiesToRemove.push(e.id);
                    }
                    setParticleEffects(prev => [...prev, { id: Date.now(), x: p.x, y: p.y }]);
                }
            });
        });
        
        updatedEnemyProjectiles.forEach(p => {
             if (p.x < newPlayerState.x + PLAYER_WIDTH && p.x + 15 > newPlayerState.x && p.y < newPlayerState.y + PLAYER_HEIGHT && p.y + 15 > newPlayerState.y) {
                projectilesToRemove.push(p.id);
                takeDamage();
            }
        });
        
        const finalEntities = newLevelEntities.filter(e => !enemiesToRemove.includes(e.id)).map(e => {
            if (e.type === 'boss' && bossDamage > 0) {
                const newHealth = e.health! - bossDamage;
                if (newHealth <= 0) {
                    setGameState('levelComplete');
                    return {...e, health: 0};
                }
                return {...e, health: newHealth};
            }
            return e;
        });

        setProjectiles(updatedProjectiles.filter(p => !projectilesToRemove.includes(p.id)));
        setEnemyProjectiles(updatedEnemyProjectiles.filter(p => !projectilesToRemove.includes(p.id)));
        setLevelEntities(finalEntities);

        // --- Interactive Objects Logic ---
        finalEntities.forEach(entity => {
            if (entity.type === 'console' && !entity.activated) {
                if (newPlayerState.x < entity.x + entity.width && newPlayerState.x + PLAYER_WIDTH > entity.x && keys['e']) {
                    setLevelEntities(prev => prev.map(e => {
                        if (e.id === entity.id) return {...e, activated: true};
                        if (e.id === entity.linkedId) return {...e, activated: false};
                        return e;
                    }));
                    checkAndTriggerMentorMessage(true, 6);
                }
            }
            if (entity.type === 'log' && !entity.activated) {
                 if (newPlayerState.x < entity.x + entity.width && newPlayerState.x + PLAYER_WIDTH > entity.x) {
                     setLevelEntities(prev => prev.map(e => e.id === entity.id ? {...e, activated: true} : e));
                     checkAndTriggerMentorMessage(true, 4);
                 }
            }
        });

        // --- Update player state ---
        setPlayerState(newPlayerState);

        // --- Update Camera ---
        const targetCameraX = newPlayerState.x - GAME_WIDTH / 2;
        const newCameraX = Math.max(0, Math.min(LEVEL_WIDTH - GAME_WIDTH, targetCameraX));
        setCameraX(newCameraX);

        // --- Mentor Messages ---
        checkAndTriggerMentorMessage(newPlayerState.x > 50, 1);
        checkAndTriggerMentorMessage(newPlayerState.x > 400, 2);
        checkAndTriggerMentorMessage(newPlayerState.x > 200, 3);
        checkAndTriggerMentorMessage(newPlayerState.x > 1600, 5);
        checkAndTriggerMentorMessage(newPlayerState.x > BOSS_ARENA_START - 200, 7);

         // --- Particle effects cleanup ---
        if (particleEffects.length > 0) {
            setTimeout(() => {
                setParticleEffects(prev => prev.slice(1));
            }, 500);
        }

    }, [gameState, playerState, keys, levelEntities, projectiles, enemyProjectiles, checkAndTriggerMentorMessage, particleEffects.length]);

    useGameLoop(gameLogic);

    const boss = levelEntities.find(e => e.type === 'boss');

    const renderGameScreen = () => (
        <div
            className="relative w-full h-full overflow-hidden bg-black"
            style={{ transform: `translateX(-${cameraX}px)` }}
        >
            <GameBackground cameraX={cameraX} />
            <Player x={playerState.x} y={playerState.y} invincible={playerState.invincible} />
            {levelEntities.map(entity => (
                <LevelEntity key={entity.id} entity={entity} />
            ))}
            {projectiles.map(p => <ProjectileComponent key={p.id} projectile={p} />)}
            {enemyProjectiles.map(p => <ProjectileComponent key={p.id} projectile={p} />)}
            {particleEffects.map(p => <ParticleEffect key={p.id} x={p.x} y={p.y} />)}
        </div>
    );

    return (
        <div className="w-screen h-screen flex justify-center items-center bg-gray-900">
            <div
                className="relative bg-gray-900 overflow-hidden"
                style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
            >
                {gameState !== 'start' && (
                    <UI 
                        lives={playerState.lives} 
                        hasShield={playerState.hasShield}
                        hasWeapon={playerState.hasWeapon}
                        invincible={playerState.invincible}
                        message={currentMessage}
                        bossHealth={boss ? boss.health! : null}
                        bossMaxHealth={boss ? boss.maxHealth! : null}
                    />
                )}
                
                {gameState === 'start' && <StartScreen onStart={() => setGameState('playing')} />}
                {gameState === 'playing' && renderGameScreen()}
                {gameState === 'dead' && <EndScreen onRestart={resetGame} />}
                {gameState === 'levelComplete' && <LevelCompleteScreen onRestart={resetGame} />}

            </div>
        </div>
    );
};

interface GameScreenProps {
  cameraX: number;
  children: React.ReactNode;
}

const GameScreen: React.FC<GameScreenProps> = ({ cameraX, children }) => (
  <div
    className="relative w-full h-full overflow-hidden bg-black"
    style={{
      width: `${LEVEL_WIDTH}px`,
      transform: `translateX(-${cameraX}px)`,
    }}
  >
    {children}
  </div>
);

export default App;
