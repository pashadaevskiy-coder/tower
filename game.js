(function() {
    'use strict';
    
    // Safe localStorage wrapper
    const Storage = {
        get(key, fallback) {
            try {
                const val = localStorage.getItem(key);
                return val !== null ? val : fallback;
            } catch(e) { return fallback; }
        },
        set(key, val) {
            try { localStorage.setItem(key, val); } catch(e) {}
        }
    };
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    let W, H;
    
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Audio System — calm, atmospheric
    const AudioSystem = {
        ctx: null,
        ambientGain: null,
        ambientOscs: [],
        init() {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch(e) {}
        },
        startAmbient() {
            if (!this.ctx || this.ambientOscs.length) return;
            try {
                this.ambientGain = this.ctx.createGain();
                this.ambientGain.gain.value = 0.04;
                this.ambientGain.connect(this.ctx.destination);
                const freqs = [110, 165, 220];
                freqs.forEach((f, i) => {
                    const osc = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = f;
                    g.gain.value = 0.15 / (i + 1);
                    osc.connect(g);
                    g.connect(this.ambientGain);
                    osc.start();
                    this.ambientOscs.push(osc);
                });
            } catch(e) {}
        },
        stopAmbient() {
            this.ambientOscs.forEach(o => { try { o.stop(); } catch(e) {} });
            this.ambientOscs = [];
            this.ambientGain = null;
        },
play(type) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            const now = this.ctx.currentTime;
            
            switch(type) {
                case 'bounce':
                case 'land': // Changed from 'jump' to 'land' for bounce
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'coin':
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.setValueAtTime(800, now + 0.1);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'death':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'checkpoint':
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.setValueAtTime(400, now + 0.1);
                    osc.frequency.setValueAtTime(500, now + 0.2);
                    osc.frequency.setValueAtTime(600, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.setValueAtTime(0.1, now + 0.35);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'gameover':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'ui':
                    // Soft UI click sound
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
            }
        } catch(e) {}
    }
};
    
    // Mute System
    let audioMuted = Storage.get('towerchaos_muted', 'false') === 'true';
    
    function toggleMute() {
        audioMuted = !audioMuted;
        Storage.set('towerchaos_muted', audioMuted ? 'true' : 'false');
        updateMuteIcon();
        if (audioMuted && AudioSystem.ambientGain) {
            AudioSystem.ambientGain.gain.value = 0;
        } else if (!audioMuted && AudioSystem.ambientGain) {
            AudioSystem.ambientGain.gain.value = 0.04;
        }
    }
    
    function updateMuteIcon() {
        const icon = document.getElementById('mute-icon');
        if (icon) {
            icon.textContent = audioMuted ? '🔇' : '🔊';
        }
    }
    
    const origAudioPlay = AudioSystem.play.bind(AudioSystem);
    AudioSystem.play = function(type) {
        if (audioMuted) return;
        origAudioPlay(type);
    };
    
    const origStartAmbient = AudioSystem.startAmbient.bind(AudioSystem);
    AudioSystem.startAmbient = function() {
        if (audioMuted) {
            // Still init but keep gain at 0
            origStartAmbient();
            if (this.ambientGain) this.ambientGain.gain.value = 0;
            return;
        }
        origStartAmbient();
    };
    
    // Game State
    const GameState = {
        MENU: 'menu',
        PLAYING: 'playing',
        GAMEOVER: 'gameover',
        SKINS: 'skins'
    };
    
    // Game Variables
    let state = GameState.MENU;
    let height = 0;
    let maxHeight = 0;
    let bestHeight = parseInt(Storage.get('towerchaos_best', '0'));
    let coins = parseInt(Storage.get('towerchaos_coins', '0'));
    let coinsThisRun = 0;
    let checkpointHeight = 0;
    let currentCheckpoint = 0;
    let screenShake = { x: 0, y: 0, intensity: 0 };
    let timeScale = 1;
    let runCounter = 0;
    
    // Skins - Neon Sci-Fi Characters
    const SKINS = [
        { id: 'neon', name: 'Neon Runner', color: '#00ffff', accent: '#8b5cf6', price: 0, unlocked: true, trail: 'cyan' },
        { id: 'void', name: 'Void Ghost', color: '#1a0a2e', accent: '#a855f7', price: 15, unlocked: false, trail: 'purple' },
        { id: 'plasma', name: 'Plasma Core', color: '#0066ff', accent: '#00ccff', price: 30, unlocked: false, trail: 'electric' },
        { id: 'inferno', name: 'Inferno', color: '#ff3300', accent: '#ff9900', price: 50, unlocked: false, trail: 'fire' },
        { id: 'toxic', name: 'Toxic Pulse', color: '#00ff66', accent: '#33ff00', price: 75, unlocked: false, trail: 'toxic' },
        { id: 'galaxy', name: 'Galaxy Walker', color: '#1a0033', accent: '#ff00ff', price: 100, unlocked: false, trail: 'stars' },
        { id: 'gold', name: 'Gold Reactor', color: '#ffd700', accent: '#ffffff', price: 150, unlocked: false, trail: 'gold' },
        { id: 'ninja', name: 'Cyber Ninja', color: '#0a0a0a', accent: '#ff0044', price: 200, unlocked: false, trail: 'blade' },
        { id: 'frozen', name: 'Frozen Echo', color: '#00ffff', accent: '#ffffff', price: 250, unlocked: false, trail: 'ice' },
        { id: 'shadow', name: 'Shadow Byte', color: '#0d0d0d', accent: '#00ff00', price: 300, unlocked: false, trail: 'glitch' },
        { id: 'mythic', name: 'Mythic Prism', color: '#ff00ff', accent: '#ffff00', price: 500, unlocked: false, trail: 'rainbow' },
        { id: 'diamond', name: 'Crystal Core', color: '#00ffff', accent: '#ff00ff', price: 350, unlocked: false, trail: 'shimmer' },
        { id: 'stealth', name: 'Stealth Ops', color: '#1a1a2e', accent: '#00ffaa', price: 175, unlocked: false, trail: 'tech' },
        { id: 'ember', name: 'Ember Spirit', color: '#ff6600', accent: '#ffcc00', price: 125, unlocked: false, trail: 'embers' },
        { id: 'frost', name: 'Frost Knight', color: '#88ccff', accent: '#ffffff', price: 225, unlocked: false, trail: 'snow' }
    ];
    
    let selectedSkin = Storage.get('towerchaos_skin', 'neon');
    let unlockedSkins = JSON.parse(Storage.get('towerchaos_unlocked', '["neon"]'));
    let selectedSkinInShop = null;
    
    // Input
    const input = {
        left: false,
        right: false,
        jump: false,
        jumpPressed: false,
        joystickX: 0
    };

    let inputCooldown = { left: 0, right: 0, jump: 0 };
    const player = {
        x: 0, y: 0,
        vx: 0, vy: 0,
        width: 30, height: 40,
        grounded: false,
        squash: 1,
        stretch: 1,
        facingRight: true,
        trail: [],
        maxTrail: 8
    };
    
    // Physics — relaxing bounce flow
    const GRAVITY = 0.42;
    const BOUNCE_FORCE = -11.5;
    const MOVE_SPEED = 4.2;
    const FRICTION = 0.88;
    const AIR_FRICTION = 0.94;
    const TOUCH_FOLLOW_SMOOTH = 0.14;
    const CAMERA_SMOOTH = 0.07;
    let cameraY = 0;
    
    // Touch follow (mobile)
    let touchActive = false;
    let touchTargetX = 0;
    
    // World
    let platforms = [];
    let traps = [];
    let coins_arr = [];
    let particles = [];
    let backgroundObjects = [];

    // Background System - Neon Sci-Fi
    const BG_COLORS = {
        darkBlue: '#0a0a1a',
        black: '#050508',
        cyan: '#00ffff',
        purple: '#8b5cf6',
        cyanDark: '#0891b2',
        purpleDark: '#7c3aed'
    };

    let bgLayers = [];
    let bgParticles = [];
    let bgTime = 0;

    function initBackground() {
        bgLayers = [];
        bgParticles = [];
        
        for (let i = 0; i < 30; i++) {
            bgLayers.push({
                type: 'star',
                x: Math.random() * W,
                y: Math.random() * H * 3,
                size: Math.random() * 1.5 + 0.5,
                speed: 0.02,
                layer: 1,
                opacity: Math.random() * 0.4 + 0.1
            });
        }
        
        for (let i = 0; i < 8; i++) {
            bgLayers.push({
                type: 'glow',
                x: Math.random() * W,
                y: Math.random() * H * 3,
                radius: Math.random() * 150 + 80,
                speed: 0.05,
                layer: 2,
                color: Math.random() > 0.5 ? BG_COLORS.cyan : BG_COLORS.purple,
                opacity: Math.random() * 0.15 + 0.05
            });
        }
        
        for (let i = 0; i < 5; i++) {
            bgLayers.push({
                type: 'glow',
                x: Math.random() * W,
                y: Math.random() * H * 3,
                radius: Math.random() * 100 + 50,
                speed: 0.1,
                layer: 3,
                color: i % 2 === 0 ? BG_COLORS.cyanDark : BG_COLORS.purpleDark,
                opacity: Math.random() * 0.2 + 0.1
            });
        }
        
        for (let i = 0; i < 25; i++) {
            bgParticles.push({
                x: Math.random() * W,
                y: Math.random() * H * 3,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.5 ? BG_COLORS.cyan : BG_COLORS.purple
            });
        }
    }

    function renderBackground() {
        bgTime += 0.012;
        
        const camY = state === GameState.PLAYING ? cameraY : 0;
        const biome = state === GameState.PLAYING ? getCurrentBiome() : null;
        
        // Get biome colors based on height
        let bgColor1, bgColor2, fogColor1, fogColor2;
        
        if (biome) {
            bgColor1 = biome.bg;
            bgColor2 = biome.bgAlt;
            const acc = hexToRgb(biome.accent);
            fogColor1 = `rgba(${acc.r}, ${acc.g}, ${acc.b}, 0.04)`;
            fogColor2 = `rgba(${Math.floor(acc.r*0.3)}, ${Math.floor(acc.g*0.3)}, ${Math.floor(acc.b*0.3)}, 0.08)`;
        } else {
            bgColor1 = BG_COLORS.darkBlue;
            bgColor2 = BG_COLORS.black;
            fogColor1 = 'rgba(139, 92, 246, 0.03)';
            fogColor2 = 'rgba(0, 255, 255, 0.02)';
        }
        
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, bgColor1);
        gradient.addColorStop(0.5, bgColor2);
        gradient.addColorStop(1, bgColor1);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
        
        // PARALLAX LAYER 1 - Far background (mountains, city skyline, etc)
        if (biome) {
            renderParallaxLayer1(camY, biome);
        }
        
        // PARALLAX LAYER 2 - Mid background (trees, buildings, rocks)
        if (biome) {
            renderParallaxLayer2(camY, biome);
        }
        
        // Atmospheric fog
        const fogGradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H));
        fogGradient.addColorStop(0, fogColor1);
        fogGradient.addColorStop(0.5, fogColor2);
        fogGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        ctx.fillStyle = fogGradient;
        ctx.fillRect(0, 0, W, H);
        
        // Layer 3 - Near particles/glows
        for (let layer of bgLayers) {
            let renderY = layer.y - camY * layer.speed;
            renderY = ((renderY % (H * 3)) + H * 3) % (H * 3) - H;
            
            if (layer.type === 'star') {
                const twinkle = Math.sin(bgTime * 2 + layer.x) * 0.3 + 0.7;
                ctx.globalAlpha = layer.opacity * twinkle;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(layer.x, renderY, layer.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (layer.type === 'glow') {
                const pulse = Math.sin(bgTime * 0.5 + layer.x * 0.01) * 0.1 + 0.9;
                
                const r = parseInt(layer.color.slice(1, 3), 16);
                const g = parseInt(layer.color.slice(3, 5), 16);
                const b = parseInt(layer.color.slice(5, 7), 16);
                
                const glow = ctx.createRadialGradient(layer.x, renderY, 0, layer.x, renderY, layer.radius * pulse);
                glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${layer.opacity * pulse})`);
                glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${layer.opacity * pulse * 0.3})`);
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                ctx.fillStyle = glow;
                ctx.fillRect(layer.x - layer.radius, renderY - layer.radius, layer.radius * 2, layer.radius * 2);
            }
        }
        
        for (let p of bgParticles) {
            const wrapY = ((p.y - camY * 0.03) % (H * 3) + H * 3) % (H * 3) - H;
            
            p.x += p.vx;
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            
            const float = Math.sin(bgTime + p.x * 0.1) * 0.3 + 0.7;
            
            const pr = parseInt(p.color.slice(1, 3), 16);
            const pg = parseInt(p.color.slice(3, 5), 16);
            const pb = parseInt(p.color.slice(5, 7), 16);
            
            ctx.globalAlpha = p.opacity * float;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${p.opacity * float})`;
            ctx.beginPath();
            ctx.arc(p.x, wrapY, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        ctx.globalAlpha = 1;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.lineWidth = 1;
        const gridOffset = (camY * 0.012) % 80;
        for (let y = -gridOffset; y < H; y += 80) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        
        // AMBIENT BIOME DETAILS
        if (biome) {
            renderAmbientDetails(camY, biome);
        }
    }
    
    // Parallax Layer 1 - Far background elements
    function renderParallaxLayer1(camY, biome) {
        const offset = camY * 0.06;
        
        if (biome.name === 'desert') {
            // Distant dunes
            ctx.fillStyle = 'rgba(60, 45, 30, 0.4)';
            ctx.beginPath();
            ctx.moveTo(0, H * 0.7 - offset);
            for (let x = 0; x <= W; x += 50) {
                ctx.lineTo(x, H * 0.6 - offset + Math.sin(x * 0.02) * 30);
            }
            ctx.lineTo(W, H);
            ctx.lineTo(0, H);
            ctx.fill();
            
            // Ancient ruins silhouettes
            ctx.fillStyle = 'rgba(40, 30, 20, 0.3)';
            for (let i = 0; i < 5; i++) {
                const rx = (i * W / 4 + 100 - offset * 0.5) % (W + 200) - 100;
                const rh = 40 + Math.sin(i) * 20;
                ctx.fillRect(rx, H * 0.5 - offset - rh, 30, rh);
                ctx.fillRect(rx + 5, H * 0.5 - offset - rh - 20, 20, 20);
            }
        }
        
        if (biome.name === 'jungle') {
            // Giant tree trunks in background
            ctx.fillStyle = 'rgba(20, 40, 20, 0.5)';
            for (let i = 0; i < 4; i++) {
                const tx = (i * W / 3 + 150 - offset * 0.3) % (W + 100) - 50;
                const th = 200 + Math.sin(i * 2) * 100;
                ctx.fillRect(tx, H * 0.3 - offset, 40, th);
            }
            
            // Distant waterfall
            const waterfallX = (W * 0.7 - offset * 0.2) % W;
            ctx.fillStyle = 'rgba(100, 180, 255, 0.2)';
            ctx.fillRect(waterfallX, H * 0.3 - offset, 30, 150);
        }
        
        if (biome.name === 'ice') {
            // Snowy mountain peaks
            ctx.fillStyle = 'rgba(180, 200, 220, 0.4)';
            ctx.beginPath();
            ctx.moveTo(0, H * 0.6 - offset);
            for (let x = 0; x <= W; x += 80) {
                ctx.lineTo(x, H * 0.4 - offset - Math.abs(Math.sin(x * 0.015)) * 80);
            }
            ctx.lineTo(W, H * 0.6 - offset);
            ctx.lineTo(W, H);
            ctx.lineTo(0, H);
            ctx.fill();
            
            // Frozen cliffs
            ctx.fillStyle = 'rgba(150, 180, 200, 0.3)';
            for (let i = 0; i < 3; i++) {
                const cx = (i * W / 2 + 200 - offset * 0.4) % (W + 100) - 50;
                ctx.beginPath();
                ctx.moveTo(cx, H * 0.5 - offset);
                ctx.lineTo(cx + 30, H * 0.3 - offset - Math.sin(i) * 40);
                ctx.lineTo(cx + 60, H * 0.5 - offset);
                ctx.fill();
            }
        }
        
        if (biome.name === 'cyber') {
            // City skyline
            ctx.fillStyle = 'rgba(30, 20, 50, 0.6)';
            for (let i = 0; i < 8; i++) {
                const bx = (i * W / 7 + 50 - offset * 0.2) % (W + 50);
                const bh = 100 + Math.sin(i * 1.5) * 80 + Math.sin(bgTime + i) * 10;
                ctx.fillRect(bx, H * 0.4 - offset - bh, 40 + i % 3 * 10, bh);
                
                // Building windows
                ctx.fillStyle = Math.random() > 0.7 ? 'rgba(139, 92, 246, 0.5)' : 'rgba(30, 20, 50, 0.6)';
                for (let wy = 0; wy < bh - 20; wy += 20) {
                    for (let wx = 5; wx < 35; wx += 10) {
                        if (Math.random() > 0.6) {
                            ctx.fillRect(bx + wx, H * 0.4 - offset - bh + wy + 10, 5, 8);
                        }
                    }
                }
                ctx.fillStyle = 'rgba(30, 20, 50, 0.6)';
            }
            
            // Giant hologram billboard
            const hx = (W * 0.3 - offset * 0.3) % W;
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            ctx.fillRect(hx, H * 0.2 - offset, 120, 80);
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hx, H * 0.2 - offset, 120, 80);
        }
        
        if (biome.name === 'void') {
            // Floating ruins
            ctx.fillStyle = 'rgba(20, 10, 30, 0.5)';
            for (let i = 0; i < 6; i++) {
                const rx = (i * W / 5 + 100 - offset * 0.15 + Math.sin(bgTime * 0.5 + i) * 20) % (W + 100) - 50;
                const ry = H * 0.4 - offset - Math.sin(i * 0.8) * 100 + Math.sin(bgTime + i) * 10;
                const rr = 20 + Math.sin(i) * 15;
                ctx.beginPath();
                ctx.moveTo(rx, ry - rr);
                ctx.lineTo(rx + rr, ry);
                ctx.lineTo(rx + rr * 0.5, ry + rr);
                ctx.lineTo(rx - rr * 0.5, ry + rr);
                ctx.closePath();
                ctx.fill();
            }
            
            // Strange floating eyes in far distance
            ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
            for (let i = 0; i < 3; i++) {
                const ex = (i * W / 2 + 300 - offset * 0.05) % W;
                const ey = H * 0.5 - offset + Math.sin(bgTime * 0.3 + i * 2) * 30;
                const size = 5 + Math.sin(bgTime + i) * 2;
                ctx.beginPath();
                ctx.arc(ex, ey, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                ctx.arc(ex, ey, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
            }
        }
    }
    
    // Parallax Layer 2 - Mid background elements
    function renderParallaxLayer2(camY, biome) {
        const offset = camY * 0.3;
        
        if (biome.name === 'desert') {
            // Cacti silhouettes
            ctx.fillStyle = 'rgba(30, 25, 20, 0.4)';
            for (let i = 0; i < 4; i++) {
                const cx = (i * W / 3 + 80 - offset * 0.6) % (W + 60) - 30;
                const cy = H * 0.7 - offset;
                ctx.fillRect(cx, cy - 50, 8, 50);
                ctx.fillRect(cx - 15, cy - 35, 15, 8);
                ctx.fillRect(cx + 10, cy - 25, 12, 8);
            }
        }
        
        if (biome.name === 'jungle') {
            // Hanging vines
            ctx.strokeStyle = 'rgba(40, 80, 40, 0.4)';
            ctx.lineWidth = 3;
            for (let i = 0; i < 6; i++) {
                const vx = (i * W / 5 + 60 - offset * 0.5) % (W + 40) - 20;
                const sway = Math.sin(bgTime * 1.5 + i) * 10;
                ctx.beginPath();
                ctx.moveTo(vx, H * 0.2 - offset);
                ctx.quadraticCurveTo(vx + sway, H * 0.5 - offset, vx + sway * 0.5, H * 0.8 - offset);
                ctx.stroke();
            }
            
            // Distant fireflies
            ctx.fillStyle = 'rgba(150, 255, 150, 0.6)';
            ctx.shadowColor = '#88ff88';
            ctx.shadowBlur = 10;
            for (let i = 0; i < 8; i++) {
                const fx = (i * 120 + 50 - offset * 0.4) % (W + 50);
                const fy = H * 0.4 - offset + Math.sin(bgTime * 2 + i * 1.5) * 30 + Math.sin(i) * 20;
                const flicker = Math.sin(bgTime * 8 + i * 3) * 0.5 + 0.5;
                ctx.globalAlpha = flicker;
                ctx.beginPath();
                ctx.arc(fx, fy, 2 + flicker * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
        
        if (biome.name === 'ice') {
            // Ice crystals
            ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
            for (let i = 0; i < 5; i++) {
                const ix = (i * W / 4 + 100 - offset * 0.5) % W;
                const iy = H * 0.6 - offset + Math.sin(i) * 30;
                const shimmer = Math.sin(bgTime * 3 + i * 2) * 0.3 + 0.7;
                ctx.globalAlpha = shimmer * 0.5;
                ctx.beginPath();
                ctx.moveTo(ix, iy - 15);
                ctx.lineTo(ix + 8, iy);
                ctx.lineTo(ix, iy + 15);
                ctx.lineTo(ix - 8, iy);
                ctx.closePath();
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            
            // Snow particles falling
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            for (let i = 0; i < 20; i++) {
                const sx = (i * 50 + Math.sin(i) * 20 - offset * 0.2) % W;
                const sy = ((H * 0.2 - offset + i * 30 + bgTime * 30) % (H * 0.8 + H * 0.2));
                ctx.beginPath();
                ctx.arc(sx, sy, 1 + Math.sin(i) * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        if (biome.name === 'cyber') {
            // Neon signs
            for (let i = 0; i < 4; i++) {
                const nx = (i * W / 3 + 100 - offset * 0.4) % W;
                const ny = H * 0.5 - offset + Math.sin(i) * 40;
                const colors = ['#8b5cf6', '#00ffff', '#ff00ff', '#00ff00'];
                ctx.strokeStyle = colors[i % 4];
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.6 + Math.sin(bgTime * 4 + i) * 0.2;
                ctx.strokeRect(nx, ny, 40 + i * 10, 20);
                
                // Flickering text lines
                ctx.fillStyle = colors[i % 4];
                ctx.fillRect(nx + 5, ny + 5, 30 + i * 3, 2);
            }
            ctx.globalAlpha = 1;
            
            // Digital rain effect
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            for (let i = 0; i < 15; i++) {
                const dx = (i * W / 14 + 20 - offset * 0.3) % W;
                const dy = (H * 0.3 - offset + (bgTime * 100 + i * 40) % (H * 0.5));
                const alpha = Math.sin((bgTime * 5 + i) % 3.14) * 0.3 + 0.3;
                ctx.globalAlpha = alpha;
                ctx.fillRect(dx, dy, 2, 15 + Math.sin(i) * 10);
            }
            ctx.globalAlpha = 1;
        }
        
        if (biome.name === 'void') {
            // Glitch distortion lines
            ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
            for (let i = 0; i < 8; i++) {
                if (Math.random() > 0.95) {
                    const gx = Math.random() * W;
                    const gy = H * 0.3 - offset + Math.random() * H * 0.5;
                    const gw = 20 + Math.random() * 100;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(gx, gy, gw, 2);
                }
            }
            ctx.globalAlpha = 1;
            
            // Floating debris
            ctx.fillStyle = 'rgba(50, 30, 60, 0.5)';
            for (let i = 0; i < 10; i++) {
                const dx = (i * W / 9 + 30 - offset * 0.25 + Math.sin(bgTime + i) * 20) % W;
                const dy = H * 0.4 - offset + Math.sin(bgTime * 0.5 + i * 1.5) * 50 + Math.cos(i) * 30;
                const rotate = bgTime + i;
                ctx.save();
                ctx.translate(dx, dy);
                ctx.rotate(rotate);
                ctx.fillRect(-5, -3, 10, 6);
                ctx.restore();
            }
            
            // Dark particles
            ctx.fillStyle = 'rgba(80, 40, 100, 0.4)';
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = 5;
            for (let i = 0; i < 12; i++) {
                const px = (i * 80 + 40 - offset * 0.35) % W;
                const py = H * 0.5 - offset + Math.sin(bgTime * 0.8 + i) * 40;
                const pulse = Math.sin(bgTime * 3 + i * 2) * 0.5 + 0.5;
                ctx.globalAlpha = pulse * 0.5;
                ctx.beginPath();
                ctx.arc(px, py, 2 + pulse * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
    }
    
    // Ambient details - floating particles, birds, effects
    function renderAmbientDetails(camY, biome) {
        const time = Date.now() / 1000;
        
        if (biome.name === 'desert') {
            // Sand wind particles
            ctx.fillStyle = 'rgba(212, 165, 116, 0.4)';
            for (let i = 0; i < 15; i++) {
                const sx = (i * W / 14 + time * 30 - camY * 0.05) % W;
                const sy = ((time * 20 + i * 50 + camY * 0.02) % (H + 100)) - 50;
                ctx.globalAlpha = 0.3 + Math.sin(time * 2 + i) * 0.2;
                ctx.beginPath();
                ctx.arc(sx, sy, 1 + Math.random(), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            
            // Heat shimmer
            ctx.fillStyle = 'rgba(255, 200, 100, 0.02)';
            for (let i = 0; i < 3; i++) {
                const sy = H * 0.3 + i * 50;
                const wave = Math.sin(time * 3 + i) * 20;
                ctx.fillRect(0, sy + wave, W, 30);
            }
            
            // Distant birds occasionally
            if (Math.random() > 0.995) {
                ctx.strokeStyle = 'rgba(50, 40, 30, 0.3)';
                ctx.lineWidth = 2;
                const birdX = (W + 50 - time * 50) % W;
                ctx.beginPath();
                ctx.moveTo(birdX, H * 0.2 - camY * 0.1);
                ctx.quadraticCurveTo(birdX + 10, H * 0.18 - camY * 0.1, birdX + 20, H * 0.2 - camY * 0.1);
                ctx.stroke();
            }
        }
        
        if (biome.name === 'jungle') {
            // Falling leaves
            ctx.fillStyle = 'rgba(74, 124, 67, 0.5)';
            for (let i = 0; i < 8; i++) {
                const lx = (i * W / 7 + 30 - camY * 0.1 + time * 10) % W;
                const ly = ((time * 15 + i * 80 + camY * 0.05) % (H + 50)) - 25;
                const rotation = time * 2 + i;
                ctx.save();
                ctx.translate(lx, ly);
                ctx.rotate(rotation);
                ctx.globalAlpha = 0.4 + Math.sin(time + i) * 0.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            
            // Occasional monkey in background (rare)
            if (Math.random() > 0.998) {
                const mx = (W - time * 80) % W;
                const my = H * 0.35 - camY * 0.15 + Math.sin(time * 3) * 20;
                ctx.fillStyle = 'rgba(60, 40, 30, 0.4)';
                ctx.beginPath();
                ctx.arc(mx, my, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(mx - 4, my + 5, 8, 10);
            }
            
            // Birds in distance
            if (Math.random() > 0.99) {
                ctx.strokeStyle = 'rgba(30, 50, 30, 0.3)';
                ctx.lineWidth = 1;
                const birdX = (W + 30 - time * 60) % W;
                ctx.beginPath();
                ctx.moveTo(birdX, H * 0.25 - camY * 0.08);
                ctx.quadraticCurveTo(birdX + 5, H * 0.23 - camY * 0.08, birdX + 10, H * 0.25 - camY * 0.08);
                ctx.stroke();
            }
        }
        
        if (biome.name === 'ice') {
            // More snow particles
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            for (let i = 0; i < 25; i++) {
                const sx = (i * W / 24 + Math.sin(i * 0.5) * 20 - camY * 0.08) % W;
                const sy = ((time * 40 + i * 25 + camY * 0.03) % (H + 30));
                const drift = Math.sin(time + i) * 3;
                ctx.globalAlpha = 0.4 + Math.sin(time * 2 + i) * 0.3;
                ctx.beginPath();
                ctx.arc(sx + drift, sy, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            
            // Frozen fog wisps
            ctx.fillStyle = 'rgba(200, 230, 255, 0.1)';
            for (let i = 0; i < 4; i++) {
                const fx = (i * W / 3 + 50 - camY * 0.12 + Math.sin(time * 0.5 + i) * 30) % W;
                const fy = H * 0.6 - camY * 0.1 + Math.sin(time * 0.3 + i * 0.5) * 20;
                const fw = 80 + Math.sin(i) * 40;
                ctx.globalAlpha = 0.15 + Math.sin(time + i) * 0.05;
                ctx.beginPath();
                ctx.ellipse(fx, fy, fw, 20, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        
        if (biome.name === 'cyber') {
            // Scanlines effect
            ctx.fillStyle = 'rgba(139, 92, 246, 0.02)';
            for (let y = 0; y < H; y += 4) {
                if (Math.floor((time * 10 + y) % 8) === 0) {
                    ctx.fillRect(0, y, W, 2);
                }
            }
            
            // Flying drones (rare)
            if (Math.random() > 0.997) {
                const dx = (W + 50 - time * 100) % W;
                const dy = H * 0.3 - camY * 0.1;
                ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
                ctx.shadowColor = '#8b5cf6';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(dx, dy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(dx - 10, dy - 2, 20, 4);
                ctx.shadowBlur = 0;
            }
            
            // Hologram flicker
            if (Math.random() > 0.98) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
                ctx.fillRect(Math.random() * W, Math.random() * H * 0.5, W * 0.3, H * 0.2);
            }
        }
        
        if (biome.name === 'void') {
            // Glitch effect
            if (Math.random() > 0.97) {
                const gx = Math.random() * W;
                const gy = Math.random() * H;
                const gw = 50 + Math.random() * 200;
                ctx.fillStyle = Math.random() > 0.5 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(gx, gy, gw, 3 + Math.random() * 10);
            }
            
            // Distortion waves
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
            ctx.lineWidth = 2;
            const waveCount = 2;
            for (let w = 0; w < waveCount; w++) {
                const waveY = H * 0.4 - camY * 0.15 + Math.sin(time + w) * 50 + w * 100;
                const waveAmp = 20 + Math.sin(time * 2 + w) * 10;
                ctx.globalAlpha = 0.1 + Math.sin(time + w) * 0.05;
                ctx.beginPath();
                for (let x = 0; x < W; x += 10) {
                    const y = waveY + Math.sin(x * 0.02 + time + w) * waveAmp;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            
            // Unstable geometry flicker
            ctx.fillStyle = 'rgba(20, 10, 30, 0.3)';
            for (let i = 0; i < 5; i++) {
                if (Math.random() > 0.92) {
                    const fx = (i * W / 4 + 100 - camY * 0.2 + Math.random() * 50) % W;
                    const fy = H * 0.5 - camY * 0.1 + Math.random() * 100;
                    ctx.fillRect(fx - 10, fy - 10, 20 + Math.random() * 30, 20 + Math.random() * 30);
                }
            }
        }
    }
    
    const PLATFORM_HEIGHT = 20;
    const VERTICAL_GAP_MIN = 95;
    const VERTICAL_GAP_MAX = 155;
    
    function getPlatformWidthRange() {
        if (isMobile) return { min: 62, max: 138 };
        return { min: 80, max: 180 };
    }
    
    // Zig-zag path generation state
    let pathDirection = 1;
    let pathStreak = 0;
    let pathStreakTarget = 3;
    
    function heightAtY(y) {
        return Math.max(0, Math.floor((H - y) / 10));
    }
    
    function getDifficultyTier(h) {
        if (h < 200) return 0;
        if (h < 500) return 1;
        if (h < 900) return 2;
        return 3;
    }
    
    function getVerticalGap(estHeight) {
        const tier = getDifficultyTier(estHeight);
        let min = VERTICAL_GAP_MIN;
        let max = VERTICAL_GAP_MAX;
        if (tier >= 1) { min += 5; max += 8; }
        if (tier >= 2) { min += 3; max += 5; }
        return min + Math.random() * (max - min);
    }
    
    function getMaxHorizontalReach(gapY, tier) {
        return Math.min(W * 0.32, 60 + gapY * 0.3 + tier * 12);
    }
    
    function computePlatformX(lastPlatform, y, width, estHeight) {
        const tier = getDifficultyTier(estHeight);
        const margin = 42;
        const lastCenter = lastPlatform.x + lastPlatform.width / 2;
        const gapY = Math.max(40, lastPlatform.y - y);
        const minSep = 55 + tier * 8;
        const maxReach = getMaxHorizontalReach(gapY, tier);
        
        if (pathStreak >= pathStreakTarget) {
            pathDirection *= -1;
            pathStreak = 0;
            pathStreakTarget = 2 + Math.floor(Math.random() * 3);
        }
        pathStreak++;
        
        const step = minSep + Math.random() * Math.max(10, maxReach - minSep);
        let targetCenter = lastCenter + pathDirection * step;
        
        if (Math.abs(targetCenter - lastCenter) > maxReach) {
            targetCenter = lastCenter + pathDirection * maxReach;
        }
        if (Math.abs(targetCenter - lastCenter) < minSep) {
            targetCenter = lastCenter + pathDirection * minSep;
        }
        
        if (Math.random() < 0.08) {
            const roll = Math.random();
            if (roll < 0.33) targetCenter = W * 0.3 + Math.random() * 40;
            else if (roll < 0.66) targetCenter = W * 0.5 + (Math.random() - 0.5) * 40;
            else targetCenter = W * 0.7 + (Math.random() - 0.5) * 40;
            
            const dist = Math.abs(targetCenter - lastCenter);
            if (dist > maxReach) {
                targetCenter = lastCenter + pathDirection * (maxReach * 0.8);
            }
        }
        
        let x = targetCenter - width / 2;
        return Math.max(margin, Math.min(W - width - margin, x));
    }
    
    function applyPlatformModifiers(platform, estHeight) {
        const tier = getDifficultyTier(estHeight);
        
        if (tier >= 1 && Math.random() < 0.1 + tier * 0.02) {
            platform.type = 'cracked';
            platform.cracked = true;
            platform.crackTimer = 0;
            platform.cracking = false;
        }
        if (tier >= 2 && Math.random() < 0.09) {
            platform.type = 'falling';
            platform.falling = false;
            platform.fallDelay = 0;
            platform.fallVy = 0;
        }
    }
    
    function spawnObstaclesForPlatform(platform, lastPlatform, estHeight) {
        const tier = getDifficultyTier(estHeight);
        
        const midX = lastPlatform
            ? (lastPlatform.x + lastPlatform.width / 2 + platform.x + platform.width / 2) / 2
            : platform.x + platform.width / 2;
        const midY = lastPlatform
            ? (lastPlatform.y + platform.y) / 2 - 50
            : platform.y - 40;
        
        // Tier 0 (0-200m): gentle push traps
        if (tier === 0 && Math.random() < 0.04) {
            spawnTrap('push', midX, midY, platform);
        }
        
        // Tier 1 (200-500m): push + saw blades
        if (tier === 1) {
            if (Math.random() < 0.08) {
                spawnTrap('push', midX, midY, platform);
            }
            if (Math.random() < 0.05) {
                spawnTrap('saw', midX, midY - 30, platform);
            }
        }
        
        // Tier 2 (500-900m): wind + laserGate + saw + spike
        if (tier === 2) {
            if (Math.random() < 0.1) {
                spawnTrap('wind', midX, midY, platform);
            }
            if (Math.random() < 0.07) {
                spawnTrap('laserGate', platform.x + platform.width / 2, platform.y);
            }
            if (Math.random() < 0.06) {
                spawnTrap('saw', midX, midY - 30, platform);
            }
            if (Math.random() < 0.05) {
                spawnTrap('spike', platform.x + platform.width * 0.3, platform.y, platform);
            }
        }
        
        // Tier 3 (900m+): all traps, higher frequency
        if (tier >= 3) {
            if (Math.random() < 0.12) {
                spawnTrap('wind', midX, midY, platform);
            }
            if (Math.random() < 0.09) {
                spawnTrap('laserGate', platform.x + platform.width / 2, platform.y);
            }
            if (Math.random() < 0.08) {
                spawnTrap('saw', midX, midY - 30, platform);
            }
            if (Math.random() < 0.07) {
                spawnTrap('spike', platform.x + platform.width * 0.3, platform.y, platform);
            }
            if (Math.random() < 0.06) {
                spawnTrap('push', midX, midY, platform);
            }
        }
    }
    
    // Biome System - Detailed Visual Settings
    const BIOMES = [
        { 
            name: 'desert', start: 0, 
            bg: '#1e1812', bgAlt: '#2a2218',
            platforms: '#c9a066', accent: '#a8845a', highlight: '#e8d4b0',
            decorations: ['sand', 'cracks', 'dust'],
            particles: { color: '#d4b896', count: 2 },
            shimmer: { color: 'rgba(255,220,180,0.06)', speed: 0.015 }
        },
        { 
            name: 'jungle', start: 200, 
            bg: '#0c1810', bgAlt: '#142820',
            platforms: '#3d6b38', accent: '#5a8f52', highlight: '#8bc47a',
            decorations: ['leaves', 'vines', 'moss'],
            particles: { color: '#7ab86a', count: 2 },
            shimmer: { color: 'rgba(120,200,120,0.05)', speed: 0.02 }
        },
        { 
            name: 'ice', start: 500, 
            bg: '#101a22', bgAlt: '#182830',
            platforms: '#8ecae6', accent: '#b8dff0', highlight: '#f0f8ff',
            decorations: ['crystals', 'snow', 'frost'],
            particles: { color: '#e8f4ff', count: 3 },
            shimmer: { color: 'rgba(180,220,255,0.08)', speed: 0.025 }
        },
        { 
            name: 'cyber', start: 800, 
            bg: '#12101c', bgAlt: '#1a1628',
            platforms: '#7c6aad', accent: '#9b8fc9', highlight: '#c8bde8',
            decorations: ['lines', 'panels', 'glow'],
            particles: { color: '#b8a8e0', count: 2 },
            shimmer: { color: 'rgba(140,120,200,0.1)', speed: 0.03 }
        },
        { 
            name: 'void', start: 1200, 
            bg: '#08060e', bgAlt: '#100c18',
            platforms: '#2a1838', accent: '#6b5a8f', highlight: '#a898c8',
            decorations: ['glitch', 'void', 'distortion'],
            particles: { color: '#8b7ab8', count: 3 },
            shimmer: { color: 'rgba(120,100,160,0.12)', speed: 0.035 }
        }
    ];
    
    let biomeParticles = [];
    let biomeDecorations = [];
    
    function initBiomeDecorations() {
        biomeParticles = [];
        biomeDecorations = [];
    }
    
    function getCurrentBiome() {
        let biome = BIOMES[0];
        for (let b of BIOMES) {
            if (height >= b.start) biome = b;
        }
        return biome;
    }
    
    // Trap Types
    const TRAP_TYPES = ['moving', 'falling', 'hammer', 'push', 'laser', 'ice', 'bounce', 'fake', 'wind', 'gravity', 'walls', 'swing', 'laserGate', 'collapsing'];

    let voidWaveActive = false;
    let voidWaveTimer = 0;
    
    // Platform Generation
    let lastPlatformY = 0;
    let generatedUpTo = 0;
    
    function generatePlatform(y) {
        const estHeight = heightAtY(y);
        let biome = BIOMES[0];
        for (let b of BIOMES) {
            if (estHeight >= b.start) biome = b;
        }
        const tier = getDifficultyTier(estHeight);
        const pw = getPlatformWidthRange();
        const width = pw.min + Math.random() * (pw.max - pw.min) * (1 - tier * 0.06);
        
        const lastPlatform = platforms.length > 0 ? platforms[platforms.length - 1] : null;
        let x;
        if (!lastPlatform) {
            x = W / 2 - width / 2;
        } else {
            x = computePlatformX(lastPlatform, y, width, estHeight);
        }
        
        const platform = {
            x, y, width, height: PLATFORM_HEIGHT,
            type: 'normal',
            color: biome.platforms,
            biomeName: biome.name,
            cracked: false,
            crackTimer: 0,
            cracking: false,
            animPhase: Math.random() * Math.PI * 2,
            squash: 0,
            glow: 0
        };
        
        applyPlatformModifiers(platform, estHeight);
        platforms.push(platform);
        
        if (Math.random() < 0.28) {
            coins_arr.push({
                x: x + Math.random() * (width - 20) + 10,
                y: y - 28,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }
        
        spawnObstaclesForPlatform(platform, lastPlatform, estHeight);
        return platform;
    }
    
    function spawnTrap(type, x, y, refPlatform) {
        switch(type) {
            case 'wind': {
                const dir = pathDirection || (Math.random() > 0.5 ? 1 : -1);
                traps.push({
                    type: 'wind',
                    x: x - 70,
                    y: y - 70,
                    width: 140,
                    height: 120,
                    strength: 1.1 + Math.random() * 0.7,
                    direction: dir,
                    color: 'rgba(150,210,230,0.45)'
                });
                break;
            }
            case 'laserGate':
                traps.push({
                    type: 'laserGate',
                    x: x - 3,
                    y: y - 120,
                    width: 6,
                    height: 120,
                    active: false,
                    warning: false,
                    charging: false,
                    timer: 0,
                    warningTime: 70,
                    chargeTime: 35,
                    activeTime: 22,
                    interval: 130 + Math.random() * 50,
                    color: '#c97a9a'
                });
                break;
            case 'push': {
                const dir = Math.random() > 0.5 ? 1 : -1;
                traps.push({
                    type: 'push',
                    x: x - 50,
                    y: y - 50,
                    width: 100,
                    height: 80,
                    strength: 0.8 + Math.random() * 0.5,
                    direction: dir,
                    color: 'rgba(255,180,100,0.35)',
                    pulse: 0
                });
                break;
            }
            case 'saw': {
                traps.push({
                    type: 'saw',
                    x: x - 18,
                    y: y - 18,
                    radius: 18,
                    rotation: 0,
                    rotSpeed: 0.12 + Math.random() * 0.06,
                    moveRange: 40 + Math.random() * 30,
                    moveSpeed: 0.02 + Math.random() * 0.015,
                    baseX: x - 18,
                    baseY: y - 18,
                    moveAxis: Math.random() > 0.5 ? 'x' : 'y',
                    color: '#ff4444'
                });
                break;
            }
            case 'spike': {
                traps.push({
                    type: 'spike',
                    x: x,
                    y: y - 14,
                    width: 30,
                    height: 14,
                    color: '#cc3333'
                });
                break;
            }
        }
    }
    
    // Particles
    function spawnParticle(x, y, vx, vy, color, life, size) {
        particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
    }
    
    function spawnBounceParticles(x, y, color) {
        for (let i = 0; i < 4; i++) {
            spawnParticle(
                x + (Math.random() - 0.5) * 16,
                y,
                (Math.random() - 0.5) * 1.5,
                -0.5 - Math.random() * 1.5,
                color || '#e8e0d0',
                18 + Math.random() * 8,
                1.5 + Math.random() * 1.5
            );
        }
    }
    
    function triggerPlatformBounce(p) {
        p.squash = 1;
        p.glow = 1;
    }
    
    function updatePlatformAnims() {
        for (let p of platforms) {
            if (p.removed) continue;
            p.squash *= 0.82;
            if (p.squash < 0.01) p.squash = 0;
            p.glow *= 0.9;
            if (p.glow < 0.01) p.glow = 0;
        }
    }
    
    // Initialize
    function init() {
        platforms = [];
        traps = [];
        coins_arr = [];
        particles = [];
        height = 0;
        maxHeight = 0;
        coinsThisRun = 0;
        checkpointHeight = currentCheckpoint;
        
        player.x = W / 2;
        player.y = H - 100;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.squash = 1;
        player.stretch = 1;
        player.trail = [];
        cameraY = player.y - H / 2;
        touchActive = false;
        
        lastPlatformY = H - 50;
        generatedUpTo = H - 50;
        pathDirection = Math.random() > 0.5 ? 1 : -1;
        pathStreak = 0;
        pathStreakTarget = 2 + Math.floor(Math.random() * 2);
        
        const startBiome = getCurrentBiome();
        const startPlatform = {
            x: W / 2 - 100, y: H - 50, width: 200, height: PLATFORM_HEIGHT,
            type: 'normal', color: startBiome.platforms, biomeName: startBiome.name,
            animPhase: 0, squash: 0, glow: 0
        };
        platforms.push(startPlatform);
        
        while (generatedUpTo > -H) {
            const estH = heightAtY(generatedUpTo);
            generatedUpTo -= getVerticalGap(estH);
            generatePlatform(generatedUpTo);
        }
    }
    
    function respawnAtCheckpoint() {
        // Find nearest platform above checkpoint
        let spawnY = checkpointHeight * 10 + H / 2;
        let spawnPlatform = null;
        
        for (let p of platforms) {
            if (p.y > spawnY - 50 && p.y < spawnY + 200) {
                spawnPlatform = p;
                break;
            }
        }
        
        if (!spawnPlatform) {
            spawnPlatform = platforms[Math.min(Math.floor((H - spawnY) / 100), platforms.length - 1)];
        }
        
        player.x = spawnPlatform.x + spawnPlatform.width / 2;
        player.y = spawnPlatform.y - player.height;
        player.vx = 0;
        player.vy = BOUNCE_FORCE * 0.5;
        player.grounded = false;
    }
    
    // Update
    function update() {
        if (state !== GameState.PLAYING) return;
        
        const biome = getCurrentBiome();
        
        // Horizontal movement — smooth, relaxing
        if (isMobile && touchActive) {
            const targetX = touchTargetX - player.width / 2;
            const dx = targetX - player.x;
            player.x += dx * TOUCH_FOLLOW_SMOOTH;
            player.vx *= 0.7;
            if (Math.abs(dx) > 1) player.facingRight = dx > 0;
        } else {
            let moveX = 0;
            if (input.left) moveX -= 1;
            if (input.right) moveX += 1;
            if (moveX !== 0) {
                player.vx += moveX * MOVE_SPEED * 0.22;
                player.facingRight = moveX > 0;
            }
            player.vx *= AIR_FRICTION;
        }
        
        // Gravity
        player.vy += GRAVITY;
        
        // Move
        player.x += player.vx;
        player.y += player.vy;
        
        // Smooth camera
        const targetCamY = isMobile
            ? player.y - H * 0.4
            : player.y - H / 2;
        cameraY += (targetCamY - cameraY) * CAMERA_SMOOTH;
        
        // Squash/stretch recovery
        player.squash += (1 - player.squash) * 0.2;
        player.stretch += (1 - player.stretch) * 0.2;
        
        // Trail
        player.trail.unshift({ x: player.x + player.width / 2, y: player.y + player.height / 2 });
        if (player.trail.length > player.maxTrail) player.trail.pop();
        
        // Platform collision — auto bounce
        player.grounded = false;
        
        for (let p of platforms) {
            if (p.removed) continue;
            
            if (player.vy >= 0 &&
                player.x + player.width > p.x + 4 &&
                player.x < p.x + p.width - 4 &&
                player.y + player.height > p.y &&
                player.y + player.height < p.y + p.height + player.vy + 6) {
                
                player.y = p.y - player.height;
                player.vy = BOUNCE_FORCE;
                player.stretch = 1.12;
                player.squash = 0.88;
                triggerPlatformBounce(p);
                spawnBounceParticles(player.x + player.width / 2, p.y, biome.accent);
                AudioSystem.play('bounce');
                
                if (p.cracked && !p.cracking) {
                    p.cracking = true;
                    p.crackTimer = 0;
                }
                if (p.type === 'falling' && !p.falling) {
                    p.falling = true;
                    p.fallDelay = 50;
                    p.fallVy = 0;
                }
            }
        }
        
        updatePlatformAnims();
        
        // Obstacles — wind (gentle), laser gate (fair, deadly only when active)
        for (let t of traps) {
            if (t.removed) continue;
            
            if (t.type === 'wind') {
                if (rectCollision(player.x, player.y, player.width, player.height, t.x, t.y, t.width, t.height)) {
                    player.vx += t.direction * t.strength * 0.045;
                }
            } else if (t.type === 'laserGate' && t.active) {
                if (rectCollision(player.x, player.y, player.width, player.height, t.x - 4, t.y, t.width + 8, t.height)) {
                    die();
                    return;
                }
            } else if (t.type === 'push') {
                if (rectCollision(player.x, player.y, player.width, player.height, t.x, t.y, t.width, t.height)) {
                    player.vx += t.direction * t.strength * 0.06;
                    t.pulse = 1;
                }
                t.pulse *= 0.92;
            } else if (t.type === 'saw') {
                t.rotation += t.rotSpeed;
                const moveOffset = Math.sin(Date.now() * t.moveSpeed * 0.06) * t.moveRange;
                if (t.moveAxis === 'x') {
                    t.x = t.baseX + moveOffset;
                } else {
                    t.y = t.baseY + moveOffset;
                }
                const sawLeft = t.x - 4;
                const sawTop = t.y - 4;
                const sawSize = t.radius * 2 + 8;
                if (rectCollision(player.x, player.y, player.width, player.height, sawLeft, sawTop, sawSize, sawSize)) {
                    die();
                    return;
                }
            } else if (t.type === 'spike') {
                if (rectCollision(player.x, player.y, player.width, player.height, t.x, t.y, t.width, t.height)) {
                    die();
                    return;
                }
            }
        }
        
        // Coin collection
        for (let c of coins_arr) {
            if (c.collected) continue;
            const dist = Math.hypot(player.x + player.width / 2 - c.x, player.y + player.height / 2 - c.y);
            if (dist < 30) {
                c.collected = true;
                coinsThisRun++;
                coins++;
                AudioSystem.play('coin');
                for (let i = 0; i < 3; i++) {
                    spawnParticle(c.x, c.y, (Math.random() - 0.5) * 3, -Math.random() * 3, '#e8c878', 18, 2.5);
                }
            }
        }
        
        // Update obstacles
        for (let t of traps) {
            if (t.removed) continue;
            if (t.type === 'laserGate') {
                t.timer++;
                if (t.timer >= t.interval && !t.warning && !t.charging && !t.active) {
                    t.warning = true;
                    t.timer = 0;
                } else if (t.warning && t.timer > t.warningTime) {
                    t.warning = false;
                    t.charging = true;
                    t.timer = 0;
                } else if (t.charging && t.timer > t.chargeTime) {
                    t.charging = false;
                    t.active = true;
                    t.timer = 0;
                } else if (t.active && t.timer > t.activeTime) {
                    t.active = false;
                    t.timer = 0;
                    t.interval = 130 + Math.random() * 50;
                }
            }
        }
        
        // Cracked platforms — visible warning, then break
        for (let p of platforms) {
            if (p.cracked && p.cracking && !p.removed) {
                p.crackTimer++;
                if (p.crackTimer > 55) {
                    p.removed = true;
                    for (let i = 0; i < 6; i++) {
                        spawnParticle(
                            p.x + Math.random() * p.width,
                            p.y + p.height / 2,
                            (Math.random() - 0.5) * 3,
                            (Math.random() - 0.5) * 3 - 1,
                            '#a08060',
                            18 + Math.random() * 8,
                            2 + Math.random() * 2
                        );
                    }
                }
            }
        }
        
        // Falling platforms — slow drop after bounce
        for (let p of platforms) {
            if (p.type === 'falling' && p.falling && !p.removed) {
                if (p.fallDelay > 0) {
                    p.fallDelay--;
                } else {
                    p.fallVy = (p.fallVy || 0) + 0.06;
                    p.y += p.fallVy;
                }
                if (p.y > player.y + H * 1.5) p.removed = true;
            }
        }
        
        // Void wave — rare pressure (900m+)
        if (height >= 900 && !voidWaveActive && Math.random() < 0.00004) {
            voidWaveActive = true;
            voidWaveTimer = 28;
            player.vy = -13;
            screenShake.intensity = 3;
            AudioSystem.play('bounce');
            for (let i = 0; i < 5; i++) {
                spawnParticle(
                    player.x + player.width / 2,
                    player.y + player.height / 2,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 3,
                    '#9b8fc9',
                    20,
                    2
                );
            }
        }
        if (voidWaveActive) {
            voidWaveTimer--;
            player.vy -= 0.45;
            if (voidWaveTimer <= 0) voidWaveActive = false;
        }
        
        // Wall boundaries — soft bounce
        if (player.x < 0) {
            player.x = 0;
            player.vx *= -0.35;
        }
        if (player.x + player.width > W) {
            player.x = W - player.width;
            player.vx *= -0.35;
        }
        
        // Update height
        const newHeight = Math.floor((H - player.y) / 10);
        if (newHeight > maxHeight) {
            maxHeight = newHeight;
            height = maxHeight;
        }
        
        // Checkpoint
        const newCheckpoint = Math.floor(height / 100);
        if (newCheckpoint > currentCheckpoint) {
            currentCheckpoint = newCheckpoint;
            checkpointHeight = currentCheckpoint * 100;
            showCheckpointFlash();
            AudioSystem.play('checkpoint');
        }
        
        // Death (fell off)
        if (player.y > lastPlatformY + 300) {
            die();
            return;
        }
        
        // Generate more platforms
        while (generatedUpTo > player.y - H) {
            const estH = heightAtY(generatedUpTo);
            generatedUpTo -= getVerticalGap(estH);
            generatePlatform(generatedUpTo);
        }
        
        // Remove old platforms
        platforms = platforms.filter(p => p.y < player.y + H * 2 && !p.removed);
        traps = traps.filter(t => !t.removed && t.y < player.y + H * 2);
        coins_arr = coins_arr.filter(c => !c.collected && c.y < player.y + H * 2);
        
        // Update particles
        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
        }
        particles = particles.filter(p => p.life > 0);
        
        // Screen shake
        if (screenShake.intensity > 0) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.intensity *= 0.9;
        }
        
        // Update UI
        updateUI();
    }
    
    function rectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    function die() {
        AudioSystem.play('death');
        screenShake.intensity = 6;
        
        // Death particles
        for (let i = 0; i < 20; i++) {
            spawnParticle(
                player.x + player.width / 2,
                player.y + player.height / 2,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                '#ff6b6b',
                30,
                4 + Math.random() * 4
            );
        }
        
        // Save best
        if (height > bestHeight) {
            bestHeight = height;
            Storage.set('towerchaos_best', bestHeight);
        }
        Storage.set('towerchaos_coins', coins);
        
        runCounter++;
        
        state = GameState.GAMEOVER;
        AudioSystem.play('gameover');
        showGameOver();
        
        if (runCounter >= 5) {
            runCounter = 0;
            showFullscreenAd();
        }
    }
    
    function showCheckpointFlash() {
        const el = document.getElementById('checkpoint-flash');
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1000);
    }
    
    function updateUI() {
        document.querySelector('#current-height span').textContent = height;
        document.querySelector('#best-height span').textContent = bestHeight;
        document.getElementById('coins-count').textContent = coins;
    }
    
    function showGameOver() {
        document.getElementById('final-height').textContent = height;
        document.getElementById('final-best').textContent = bestHeight;
        document.getElementById('coins-earned').textContent = coinsThisRun;
        document.getElementById('game-over').classList.add('active');
    }
    
    // --- Platform visual helpers (render only; hitbox unchanged) ---
    function platformRand(p, salt) {
        const v = Math.sin((p.x * 0.017 + p.y * 0.031 + p.width * 0.009 + salt * 2.41) * 127.1) * 43758.5453;
        return v - Math.floor(v);
    }
    
    function platformProfile(p) {
        if (p._visProfile) return p._visProfile;
        const n = 9 + Math.floor(platformRand(p, 0) * 3);
        const top = [];
        const bot = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const dx = t * p.width;
            top.push({
                dx,
                dy: (platformRand(p, i + 1) - 0.5) * 5,
                bulge: platformRand(p, i + 50) > 0.72 ? 2 + platformRand(p, i + 51) * 4 : 0
            });
            bot.push({
                dx,
                dy: (platformRand(p, i + 30) - 0.5) * 3
            });
        }
        const decor = [];
        const bumpCount = 2 + Math.floor(platformRand(p, 60) * 3);
        for (let i = 0; i < bumpCount; i++) {
            decor.push({
                type: 'bump',
                x: platformRand(p, 70 + i) * p.width,
                y: -2 - platformRand(p, 80 + i) * 5,
                r: 3 + platformRand(p, 90 + i) * 5
            });
        }
        for (let i = 0; i < 3; i++) {
            decor.push({
                type: 'chip',
                x: platformRand(p, 100 + i) * p.width,
                side: platformRand(p, 110 + i) > 0.5 ? 1 : -1
            });
        }
        p._visProfile = { top, bot, decor, n };
        return p._visProfile;
    }
    
    function traceChunkPath(px, py, pw, ph, p, profile, depthOffset) {
        const dy = depthOffset || 0;
        const topY = py + dy;
        const botY = py + ph + dy;
        const leftIn = 2 + platformRand(p, 200) * 5;
        const rightIn = pw - 2 - platformRand(p, 201) * 5;
        
        ctx.beginPath();
        const t0 = profile.top[0];
        ctx.moveTo(px + t0.dx + leftIn * 0.3, topY + t0.dy - t0.bulge);
        
        for (let i = 1; i < profile.top.length; i++) {
            const prev = profile.top[i - 1];
            const cur = profile.top[i];
            const x0 = px + prev.dx + (i === 1 ? leftIn : 0);
            const x1 = px + cur.dx + (i === profile.top.length - 1 ? -rightIn * 0.3 : 0);
            const y0 = topY + prev.dy - prev.bulge;
            const y1 = topY + cur.dy - cur.bulge;
            const mx = (x0 + x1) / 2;
            const my = (y0 + y1) / 2 - (cur.bulge + prev.bulge) * 0.15;
            ctx.quadraticCurveTo(x0, y0, mx, my);
            ctx.quadraticCurveTo(x1, y1, x1, y1);
        }
        
        const lastBot = profile.bot[profile.bot.length - 1];
        ctx.lineTo(px + lastBot.dx - rightIn * 0.2, botY + lastBot.dy + 2);
        
        for (let i = profile.bot.length - 2; i >= 0; i--) {
            const cur = profile.bot[i];
            const next = profile.bot[i + 1];
            const x0 = px + cur.dx + (i === 0 ? leftIn : 0);
            const x1 = px + next.dx;
            const y0 = botY + cur.dy + 1;
            const y1 = botY + next.dy + 1;
            const mx = (x0 + x1) / 2;
            ctx.quadraticCurveTo(x1, y1, mx, (y0 + y1) / 2);
            ctx.quadraticCurveTo(x0, y0, x0, y0);
        }
        ctx.closePath();
    }
    
    function fillChunkGradient(px, py, pw, ph, p, profile, baseColor, darkColor, depth) {
        traceChunkPath(px, py, pw, ph, p, profile, depth);
        const g = ctx.createLinearGradient(px, py + depth, px, py + ph + depth + 8);
        g.addColorStop(0, baseColor);
        g.addColorStop(0.55, darkColor);
        g.addColorStop(1, darkColor);
        ctx.fillStyle = g;
        ctx.fill();
    }
    
    function drawDesertChunk(px, py, pw, ph, p, profile, biome, time) {
        const depth = 7;
        const base = p.color || biome.platforms;
        const dark = biome.accent;
        const deep = '#7a5c38';
        
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        traceChunkPath(px + 3, py + 5, pw, ph, p, profile, 0);
        ctx.fill();
        
        fillChunkGradient(px, py, pw, ph, p, profile, dark, deep, depth);
        traceChunkPath(px, py, pw, ph, p, profile, 0);
        const topG = ctx.createLinearGradient(px, py, px, py + ph * 0.6);
        topG.addColorStop(0, base);
        topG.addColorStop(1, dark);
        ctx.fillStyle = topG;
        ctx.fill();
        
        traceChunkPath(px, py, pw, ph, p, profile, 0);
        ctx.strokeStyle = 'rgba(60,40,25,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(90,60,35,0.25)';
        for (let i = 0; i < 5; i++) {
            const sx = px + platformRand(p, 300 + i) * pw;
            const sy = py + 4 + platformRand(p, 310 + i) * (ph - 4);
            ctx.fillRect(sx, sy, 4 + platformRand(p, 320 + i) * 8, 2);
        }
        
        ctx.strokeStyle = 'rgba(50,35,20,0.45)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
            const cx = px + pw * (0.2 + platformRand(p, 330 + i) * 0.6);
            ctx.beginPath();
            ctx.moveTo(cx, py + 2);
            ctx.lineTo(cx + (platformRand(p, 340 + i) - 0.5) * 12, py + ph * 0.7);
            ctx.stroke();
        }
        
        profile.decor.forEach(d => {
            if (d.type === 'bump') {
                ctx.fillStyle = base;
                ctx.beginPath();
                ctx.ellipse(px + d.x, py + d.y, d.r, d.r * 0.55, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(240,210,160,0.4)';
                ctx.beginPath();
                ctx.ellipse(px + d.x - 1, py + d.y - 1, d.r * 0.5, d.r * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    function drawJungleChunk(px, py, pw, ph, p, profile, biome, time) {
        const depth = 8;
        const earth = '#5c4030';
        const earthDark = '#3d2a1f';
        const grass = biome.highlight;
        const moss = biome.accent;
        
        fillChunkGradient(px, py + 2, pw, ph, p, profile, earthDark, '#2a1a12', depth + 2);
        
        traceChunkPath(px, py, pw, ph, p, profile, 0);
        const earthG = ctx.createLinearGradient(px, py + ph * 0.3, px, py + ph);
        earthG.addColorStop(0, earth);
        earthG.addColorStop(1, earthDark);
        ctx.fillStyle = earthG;
        ctx.fill();
        
        traceChunkPath(px, py - 2, pw, ph + 2, p, profile, 0);
        ctx.fillStyle = moss;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        traceChunkPath(px, py - 4, pw, 3, p, profile, 0);
        ctx.fillStyle = grass;
        ctx.fill();
        
        for (let i = 0; i < profile.top.length - 1; i++) {
            if (platformRand(p, 400 + i) > 0.55) continue;
            const t = profile.top[i];
            const gx = px + t.dx + (platformRand(p, 410 + i) - 0.5) * 6;
            const gy = py + t.dy - 5 + Math.sin(time * 1.2 + p.animPhase + i) * 0.8;
            ctx.fillStyle = grass;
            ctx.beginPath();
            ctx.moveTo(gx, gy + 3);
            ctx.quadraticCurveTo(gx - 3, gy - 2, gx, gy - 5);
            ctx.quadraticCurveTo(gx + 3, gy - 2, gx, gy + 3);
            ctx.fill();
        }
        
        ctx.strokeStyle = '#2d4a20';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 2; i++) {
            const rx = px + pw * (0.15 + platformRand(p, 420 + i) * 0.7);
            ctx.beginPath();
            ctx.moveTo(rx, py + ph);
            ctx.quadraticCurveTo(rx + 6, py + ph + 5, rx + 2, py + ph + 10 + platformRand(p, 430 + i) * 4);
            ctx.stroke();
        }
        
        profile.decor.forEach(d => {
            if (d.type === 'bump') {
                ctx.fillStyle = moss;
                ctx.beginPath();
                ctx.ellipse(px + d.x, py + d.y, d.r * 1.1, d.r * 0.6, 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    function drawIceChunk(px, py, pw, ph, p, profile, biome, time) {
        const depth = 6;
        const ice = p.color || biome.platforms;
        const iceDeep = biome.accent;
        
        ctx.globalAlpha = 0.25;
        fillChunkGradient(px, py + 3, pw, ph, p, profile, iceDeep, '#5a8aa8', depth + 3);
        ctx.globalAlpha = 1;
        
        traceChunkPath(px, py, pw, ph, p, profile, 0);
        const iceG = ctx.createLinearGradient(px, py, px + pw, py + ph);
        iceG.addColorStop(0, 'rgba(240,248,255,0.95)');
        iceG.addColorStop(0.35, ice);
        iceG.addColorStop(1, iceDeep);
        ctx.fillStyle = iceG;
        ctx.fill();
        
        traceChunkPath(px, py, pw, ph, p, profile, 0);
        ctx.strokeStyle = 'rgba(200,230,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        
        traceChunkPath(px, py - 3, pw, 5, p, profile, 0);
        ctx.fillStyle = '#f4faff';
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        profile.decor.forEach(d => {
            if (d.type === 'bump') {
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.ellipse(px + d.x, py + d.y - 1, d.r * 1.2, d.r * 0.65, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        });
        
        for (let i = 0; i < 3; i++) {
            if (platformRand(p, 500 + i) < 0.4) continue;
            const ix = px + platformRand(p, 510 + i) * pw;
            ctx.strokeStyle = 'rgba(180,220,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ix, py + 1);
            ctx.lineTo(ix + (platformRand(p, 520 + i) - 0.5) * 3, py - 4 - platformRand(p, 530 + i) * 5);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(220,240,255,0.35)';
        for (let i = 0; i < 2; i++) {
            const hx = px + pw * (0.2 + i * 0.45);
            ctx.beginPath();
            ctx.moveTo(hx, py + 2);
            ctx.lineTo(hx + 8, py + 1);
            ctx.lineTo(hx + 4, py + 5);
            ctx.fill();
        }
    }
    
    function drawCyberChunk(px, py, pw, ph, p, profile, biome, time) {
        const pulse = Math.sin(time * 2 + p.animPhase) * 0.12 + 0.88;
        const depth = 5;
        const panel = p.color || biome.platforms;
        const frame = '#12101c';
        
        fillChunkGradient(px, py + 2, pw, ph, p, profile, frame, '#080610', depth + 2);
        
        traceChunkPath(px + 2, py + 2, pw - 4, ph - 3, p, profile, 0);
        ctx.fillStyle = panel;
        ctx.globalAlpha = 0.85 * pulse;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        traceChunkPath(px + 4, py + 4, pw - 8, ph - 6, p, profile, 0);
        ctx.fillStyle = '#1e1830';
        ctx.fill();
        
        traceChunkPath(px + 3, py + 3, pw - 6, ph - 5, p, profile, 0);
        ctx.strokeStyle = biome.highlight;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.45 * pulse;
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        ctx.shadowColor = biome.accent;
        ctx.shadowBlur = 4 + p.glow * 6;
        ctx.strokeStyle = biome.accent;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.35 * pulse;
        traceChunkPath(px + 2, py + 2, pw - 4, ph - 2, p, profile, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        
        const slotY = py + ph * 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(px + 8, slotY, pw - 16, 3);
        ctx.fillStyle = biome.highlight;
        ctx.globalAlpha = 0.25 * pulse;
        ctx.fillRect(px + 10, slotY + 1, pw - 20, 1);
        ctx.globalAlpha = 1;
    }
    
    function drawVoidChunk(px, py, pw, ph, p, profile, biome, time) {
        const depth = 6;
        const rock = p.color || biome.platforms;
        const gap = 3 + Math.floor(platformRand(p, 600) * 3);
        const sliceW = (pw - gap * (gap - 1)) / gap;
        
        for (let i = 0; i < gap; i++) {
            const ox = px + i * (sliceW + gap) + (Math.sin(time * 0.6 + p.animPhase + i) * 0.8);
            const oy = py + (platformRand(p, 610 + i) - 0.5) * 2;
            const subP = { x: p.x + ox - px, y: p.y, width: sliceW, _visProfile: null };
            const subProf = platformProfile(subP);
            
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            traceChunkPath(ox + 2, oy + 4, sliceW, ph, subP, subProf, 0);
            ctx.fill();
            
            fillChunkGradient(ox, oy, sliceW, ph, subP, subProf, rock, '#0a0610', depth);
            traceChunkPath(ox, oy, sliceW, ph, subP, subProf, 0);
            ctx.strokeStyle = 'rgba(100,80,140,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            if (platformRand(p, 620 + i) > 0.6) {
                ctx.fillStyle = biome.highlight;
                ctx.globalAlpha = 0.25;
                ctx.fillRect(ox + platformRand(p, 630 + i) * sliceW, oy, 2, ph);
                ctx.globalAlpha = 1;
            }
        }
        
        if (platformRand(p, 640) > 0.5) {
            const fx = px + platformRand(p, 641) * pw;
            const fy = py - 6 - platformRand(p, 642) * 8;
            ctx.fillStyle = rock;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(fx, fy + 6);
            ctx.lineTo(fx + 8, fy);
            ctx.lineTo(fx + 4, fy + 10);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    function drawPlatform(p, biome, time, shakeX, shakeY) {
        const breath = Math.sin(time * 1.2 + p.animPhase) * 1.2;
        const squashH = p.squash * 4;
        const py = p.y + shakeY + breath;
        const ph = p.height + squashH;
        const px = p.x + shakeX;
        const pw = p.width;
        const bn = p.biomeName || biome.name;
        const profile = platformProfile(p);
        
        ctx.save();
        
        if (p.glow > 0.05) {
            ctx.shadowColor = biome.accent;
            ctx.shadowBlur = 5 + p.glow * 8;
        }
        
        switch (bn) {
            case 'desert': drawDesertChunk(px, py, pw, ph, p, profile, biome, time); break;
            case 'jungle': drawJungleChunk(px, py, pw, ph, p, profile, biome, time); break;
            case 'ice': drawIceChunk(px, py, pw, ph, p, profile, biome, time); break;
            case 'cyber': drawCyberChunk(px, py, pw, ph, p, profile, biome, time); break;
            case 'void': drawVoidChunk(px, py, pw, ph, p, profile, biome, time); break;
            default: drawDesertChunk(px, py, pw, ph, p, profile, biome, time);
        }
        
        ctx.shadowBlur = 0;
        
        if (p.squash > 0.02) {
            traceChunkPath(px, py, pw, ph, p, profile, 0);
            ctx.fillStyle = `rgba(255,255,255,${p.squash * 0.1})`;
            ctx.fill();
        }
        
        if (p.cracked) {
            ctx.strokeStyle = p.cracking ? 'rgba(60,40,25,0.75)' : 'rgba(50,35,22,0.4)';
            ctx.lineWidth = p.cracking ? 1.5 : 1;
            const cx = px + pw * 0.32;
            ctx.beginPath();
            ctx.moveTo(cx, py + 2);
            ctx.lineTo(cx + pw * 0.1, py + ph * 0.45);
            ctx.lineTo(cx - pw * 0.06, py + ph - 2);
            ctx.moveTo(cx + pw * 0.2, py + 3);
            ctx.lineTo(cx + pw * 0.15, py + ph * 0.7);
            ctx.stroke();
            if (p.cracking) {
                traceChunkPath(px, py, pw, ph, p, profile, 0);
                ctx.fillStyle = `rgba(120,90,70,${p.crackTimer / 55 * 0.22})`;
                ctx.fill();
            }
        }
        if (p.type === 'falling') {
            if (p.falling && p.fallDelay > 0) {
                traceChunkPath(px, py, pw, ph, p, profile, 0);
                ctx.fillStyle = `rgba(200,150,100,${0.12 + (1 - p.fallDelay / 50) * 0.15})`;
                ctx.fill();
            } else if (!p.falling) {
                ctx.strokeStyle = 'rgba(180,130,90,0.35)';
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(px + 2, py - 1, pw - 4, 2);
                ctx.setLineDash([]);
            }
        }
        
        ctx.restore();
    }
    
    // Draw
    function draw() {
        ctx.save();
        ctx.translate(screenShake.x, screenShake.y);
        
        renderBackground();
        
        if (state !== GameState.PLAYING) {
            ctx.restore();
            return;
        }
        
        const camY = cameraY;
        const time = Date.now() / 1000;
        const currentBiome = getCurrentBiome();
        
        ctx.save();
        ctx.translate(0, -camY);
        
        for (let p of platforms) {
            if (p.removed) continue;
            let shakeX = 0, shakeY = 0;
            if (p.cracked && p.cracking) {
                shakeX = (Math.random() - 0.5) * 3;
                shakeY = (Math.random() - 0.5) * 1.5;
            }
            if (p.type === 'falling' && p.falling && p.fallDelay > 0) {
                shakeX = (Math.random() - 0.5) * 2;
                shakeY = (Math.random() - 0.5) * 1;
            }
            drawPlatform(p, currentBiome, time, shakeX, shakeY);
        }
        
        // Obstacles
        for (let t of traps) {
            if (t.removed) continue;
            
            if (t.type === 'wind') {
                const pulse = Math.sin(time * 2 + t.x * 0.01) * 0.15 + 0.85;
                ctx.globalAlpha = 0.12 * pulse;
                ctx.fillStyle = t.color;
                ctx.fillRect(t.x, t.y, t.width, t.height);
                ctx.globalAlpha = 0.35 * pulse;
                ctx.strokeStyle = 'rgba(180,220,240,0.5)';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    const wy = t.y + 15 + i * (t.height / 4);
                    const drift = Math.sin(time * 1.5 + i) * 8;
                    ctx.beginPath();
                    ctx.moveTo(t.x + 10, wy);
                    ctx.quadraticCurveTo(
                        t.x + t.width / 2 + drift * t.direction,
                        wy - 8,
                        t.x + t.width - 10 + t.direction * 25,
                        wy + 5
                    );
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(200,230,255,0.5)';
                ctx.font = '11px sans-serif';
                ctx.fillText(t.direction > 0 ? '→' : '←', t.x + t.width / 2 - 4, t.y + t.height / 2);
                ctx.globalAlpha = 1;
            } else if (t.type === 'laserGate') {
                if (t.warning) {
                    ctx.fillStyle = 'rgba(200,120,150,0.15)';
                    ctx.fillRect(t.x - 12, t.y, t.width + 24, t.height);
                    ctx.fillStyle = 'rgba(220,140,160,0.35)';
                    ctx.globalAlpha = 0.4 + Math.sin(time * 6) * 0.2;
                    ctx.fillRect(t.x - 2, t.y, t.width + 4, t.height);
                    ctx.globalAlpha = 1;
                } else if (t.charging) {
                    ctx.fillStyle = 'rgba(220,150,170,0.25)';
                    ctx.fillRect(t.x - 6, t.y, t.width + 12, t.height);
                    ctx.globalAlpha = 0.5 + Math.sin(time * 10) * 0.25;
                    ctx.fillStyle = '#e8a0b8';
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.globalAlpha = 1;
                } else if (t.active) {
                    ctx.shadowColor = '#e8a0b8';
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = 'rgba(232,160,184,0.85)';
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.fillStyle = 'rgba(255,240,245,0.6)';
                    ctx.fillRect(t.x + 1, t.y, 2, t.height);
                    ctx.shadowBlur = 0;
                } else {
                    ctx.globalAlpha = 0.15;
                    ctx.fillStyle = '#c97a9a';
                    ctx.fillRect(t.x, t.y, t.width, t.height);
                    ctx.globalAlpha = 1;
                }
            } else if (t.type === 'push') {
                const pulse = Math.sin(time * 3 + t.x * 0.02) * 0.2 + 0.8;
                const glow = t.pulse * 0.3;
                ctx.globalAlpha = (0.15 + glow) * pulse;
                ctx.fillStyle = t.color;
                ctx.fillRect(t.x, t.y, t.width, t.height);
                ctx.globalAlpha = (0.4 + glow) * pulse;
                ctx.strokeStyle = 'rgba(255,200,120,0.6)';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 3; i++) {
                    const wy = t.y + 10 + i * (t.height / 3);
                    const drift = Math.sin(time * 2 + i) * 6;
                    ctx.beginPath();
                    ctx.moveTo(t.x + 8, wy);
                    ctx.quadraticCurveTo(
                        t.x + t.width / 2 + drift * t.direction,
                        wy - 6,
                        t.x + t.width - 8 + t.direction * 20,
                        wy + 4
                    );
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(255,220,150,0.6)';
                ctx.font = '11px sans-serif';
                ctx.fillText(t.direction > 0 ? '»' : '«', t.x + t.width / 2 - 3, t.y + t.height / 2);
                ctx.globalAlpha = 1;
            } else if (t.type === 'saw') {
                const cx = t.x + t.radius;
                const cy = t.y + t.radius;
                const r = t.radius;
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(t.rotation);
                
                ctx.shadowColor = '#ff4444';
                ctx.shadowBlur = 8;
                ctx.fillStyle = '#882222';
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#cc3333';
                const teeth = 8;
                for (let i = 0; i < teeth; i++) {
                    const angle = (i / teeth) * Math.PI * 2;
                    const nextAngle = ((i + 0.5) / teeth) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * (r + 6), Math.sin(angle) * (r + 6));
                    ctx.lineTo(Math.cos(nextAngle) * r, Math.sin(nextAngle) * r);
                    ctx.closePath();
                    ctx.fill();
                }
                
                ctx.fillStyle = '#666';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;
                ctx.restore();
            } else if (t.type === 'spike') {
                ctx.fillStyle = t.color;
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 4;
                const spikeCount = 4;
                const spikeW = t.width / spikeCount;
                for (let i = 0; i < spikeCount; i++) {
                    ctx.beginPath();
                    ctx.moveTo(t.x + i * spikeW, t.y + t.height);
                    ctx.lineTo(t.x + i * spikeW + spikeW / 2, t.y);
                    ctx.lineTo(t.x + (i + 1) * spikeW, t.y + t.height);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
        }
        
        // Coins
        for (let c of coins_arr) {
            if (c.collected) continue;
            const bob = Math.sin(time * 3 + c.bobOffset) * 5;
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(c.x, c.y + bob, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(c.x - 3, c.y + bob - 3, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Player trail
        const skinData = getSkinData();
        const trailColor = getTrailColor(skinData);
        
        for (let i = 0; i < player.trail.length; i++) {
            const t = player.trail[i];
            const alpha = (1 - i / player.trail.length) * 0.4;
            ctx.globalAlpha = alpha;
            
            if (trailColor === 'rainbow') {
                const hue = (Date.now() / 10 + i * 30) % 360;
                ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
            } else {
                ctx.fillStyle = trailColor;
                ctx.shadowColor = trailColor;
            }
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(t.x, t.y, player.width / 2 * (1 - i / player.trail.length), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
        
        // Player
        if (state === GameState.PLAYING) {
            renderCharacter(player.x, player.y, player.width, player.height, skinData, time, player.squash, player.stretch, player.facingRight, player.vx);
        }
        
        // Particles
        for (let p of particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        ctx.restore();
        ctx.restore();
    }
    
    function getSkinColor() {
        const skin = SKINS.find(s => s.id === selectedSkin);
        return skin ? skin.color : '#00ffff';
    }

    function getSkinData() {
        return SKINS.find(s => s.id === selectedSkin) || SKINS[0];
    }

    function getTrailColor(skin) {
        const colors = {
            cyan: '#00ffff',
            purple: '#a855f7',
            electric: '#00ccff',
            fire: '#ff6600',
            toxic: '#00ff66',
            stars: '#ff66ff',
            gold: '#ffd700',
            blade: '#ff0044',
            ice: '#88ddff',
            glitch: '#00ff00',
            rainbow: 'rainbow',
            shimmer: '#00ffff',
            tech: '#00ffaa',
            embers: '#ff4400',
            snow: '#aaddff'
        };
        return colors[skin.trail] || '#00ffff';
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 255, b: 255 };
    }

    function renderCharacter(x, y, w, h, skin, time, squash, stretch, facingRight, vx, customCtx) {
        const renderCtx = customCtx || ctx;
        renderCtx.save();
        renderCtx.translate(x + w / 2, y + h / 2);
        renderCtx.scale(squash, stretch);
        renderCtx.translate(-w / 2, -h / 2);
        
        const rgb = hexToRgb(skin.color);
        const acc = hexToRgb(skin.accent);
        const baseColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
        const glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        const accentColor = `rgba(${acc.r}, ${acc.g}, ${acc.b}, 1)`;

        switch(skin.id) {
            case 'neon':
                renderCtx.shadowColor = '#00ffff';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#001a1a';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 18, 6);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(6, 10, w - 12, h - 22, 4);
                renderCtx.fill();
                renderCtx.fillStyle = '#00ffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 12, 8, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 2, 11, 3, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#001a1a';
                renderCtx.beginPath();
                renderCtx.ellipse(w / 2 + (facingRight ? 2 : -2), 20, 4, 6, 0, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.strokeStyle = '#00ffff';
                renderCtx.lineWidth = 1;
                renderCtx.beginPath();
                renderCtx.moveTo(8, h - 8);
                renderCtx.lineTo(8, h - 2);
                renderCtx.moveTo(w - 8, h - 8);
                renderCtx.lineTo(w - 8, h - 2);
                renderCtx.stroke();
                renderCtx.shadowBlur = 0;
                break;

            case 'void':
                renderCtx.shadowColor = '#a855f7';
                renderCtx.shadowBlur = 12;
                renderCtx.fillStyle = '#0a0515';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 6, w - 8, h - 12, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(6, 8, w - 12, h - 16, 6);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 6, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.globalAlpha = 0.7;
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 3, 9, 2, 0, Math.PI * 2);
                renderCtx.arc(w / 2 + 3, 9, 2, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.globalAlpha = 1;
                renderCtx.fillStyle = '#0a0515';
                renderCtx.beginPath();
                renderCtx.moveTo(4, 18);
                renderCtx.lineTo(w / 2, h - 4);
                renderCtx.lineTo(w - 4, 18);
                renderCtx.fill();
                renderCtx.shadowBlur = 0;
                break;

            case 'plasma':
                renderCtx.shadowColor = '#00ccff';
                renderCtx.shadowBlur = 20;
                renderCtx.fillStyle = '#001122';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 6);
                renderCtx.fill();
                const gradient = renderCtx.createLinearGradient(5, 10, w - 5, h - 10);
                gradient.addColorStop(0, '#00ccff');
                gradient.addColorStop(0.5, '#0066ff');
                gradient.addColorStop(1, '#00ccff');
                renderCtx.fillStyle = gradient;
                renderCtx.beginPath();
                renderCtx.roundRect(7, 12, w - 14, h - 24, 4);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 5, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#00ccff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 2, 0, Math.PI * 2);
                renderCtx.fill();
                for (let i = 0; i < 3; i++) {
                    const lx = 8 + i * 6;
                    renderCtx.strokeStyle = '#00ccff';
                    renderCtx.lineWidth = 1;
                    renderCtx.globalAlpha = 0.5;
                    renderCtx.beginPath();
                    renderCtx.moveTo(lx, h - 10);
                    renderCtx.lineTo(lx + Math.sin(time * 10 + i) * 3, h - 4);
                    renderCtx.stroke();
                }
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'inferno':
                renderCtx.shadowColor = '#ff6600';
                renderCtx.shadowBlur = 18;
                renderCtx.fillStyle = '#1a0500';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 6);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 4);
                renderCtx.fill();
                const fireGrad = renderCtx.createLinearGradient(5, h - 10, 5, h);
                fireGrad.addColorStop(0, '#ff3300');
                fireGrad.addColorStop(0.5, '#ff6600');
                fireGrad.addColorStop(1, '#ffcc00');
                renderCtx.fillStyle = fireGrad;
                renderCtx.beginPath();
                renderCtx.moveTo(6, h - 8);
                renderCtx.quadraticCurveTo(w / 2, h - 15 + Math.sin(time * 15) * 3, w - 6, h - 8);
                renderCtx.lineTo(w - 6, h - 4);
                renderCtx.lineTo(6, h - 4);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffcc00';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 12, 6, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 2, 11, 2, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.shadowBlur = 0;
                break;

            case 'toxic':
                renderCtx.shadowColor = '#00ff66';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#001a0a';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 6);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 11, 7, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 2, 10, 3, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#00ff66';
                renderCtx.globalAlpha = 0.3;
                for (let i = 0; i < 5; i++) {
                    const py = 25 + i * 4;
                    renderCtx.beginPath();
                    renderCtx.arc(w / 2 + Math.sin(time * 5 + i) * 5, py, 2, 0, Math.PI * 2);
                    renderCtx.fill();
                }
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'galaxy':
                renderCtx.shadowColor = '#ff00ff';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#0a0015';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 10);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 8);
                renderCtx.fill();
                const galGrad = renderCtx.createRadialGradient(w / 2, 10, 0, w / 2, 10, 15);
                galGrad.addColorStop(0, '#ff00ff');
                galGrad.addColorStop(0.5, '#6600ff');
                galGrad.addColorStop(1, '#001a33');
                renderCtx.fillStyle = galGrad;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 10, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.globalAlpha = 0.8;
                for (let i = 0; i < 8; i++) {
                    const angle = (time * 2 + i * Math.PI / 4) % (Math.PI * 2);
                    const dist = 5 + i % 3;
                    renderCtx.beginPath();
                    renderCtx.arc(w / 2 + Math.cos(angle) * dist, 10 + Math.sin(angle) * dist, 1, 0, Math.PI * 2);
                    renderCtx.fill();
                }
                renderCtx.globalAlpha = 1;
                renderCtx.fillStyle = '#1a0033';
                renderCtx.beginPath();
                renderCtx.moveTo(6, h - 12);
                renderCtx.quadraticCurveTo(w / 2, h - 6, w - 6, h - 12);
                renderCtx.lineTo(w - 6, h - 4);
                renderCtx.lineTo(6, h - 4);
                renderCtx.fill();
                renderCtx.shadowBlur = 0;
                break;

            case 'gold':
                renderCtx.shadowColor = '#ffd700';
                renderCtx.shadowBlur = 20;
                renderCtx.fillStyle = '#1a1400';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 6);
                renderCtx.fill();
                const goldGrad = renderCtx.createLinearGradient(5, 10, w - 5, h - 10);
                goldGrad.addColorStop(0, '#ffd700');
                goldGrad.addColorStop(0.3, '#ffaa00');
                goldGrad.addColorStop(0.7, '#ffaa00');
                goldGrad.addColorStop(1, '#ffd700');
                renderCtx.fillStyle = goldGrad;
                renderCtx.beginPath();
                renderCtx.roundRect(7, 12, w - 14, h - 24, 4);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 6, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffd700';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 3, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.strokeStyle = '#ffd700';
                renderCtx.lineWidth = 1;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 8, 0, Math.PI * 2);
                renderCtx.stroke();
                renderCtx.shadowBlur = 0;
                break;

            case 'ninja':
                renderCtx.shadowColor = '#ff0044';
                renderCtx.shadowBlur = 10;
                renderCtx.fillStyle = '#0a0a0a';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 6, w - 8, h - 12, 4);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 8, w - 10, h - 16, 3);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.moveTo(w / 2 - 8, 6);
                renderCtx.lineTo(w / 2 - 4, 14);
                renderCtx.lineTo(w / 2, 8);
                renderCtx.lineTo(w / 2 + 4, 14);
                renderCtx.lineTo(w / 2 + 8, 6);
                renderCtx.lineTo(w / 2, 10);
                renderCtx.fill();
                renderCtx.fillStyle = '#ff0044';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 18, 4, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.strokeStyle = '#333';
                renderCtx.lineWidth = 2;
                renderCtx.beginPath();
                renderCtx.moveTo(6, h - 6);
                renderCtx.lineTo(8, h - 2);
                renderCtx.moveTo(w - 6, h - 6);
                renderCtx.lineTo(w - 8, h - 2);
                renderCtx.stroke();
                renderCtx.shadowBlur = 0;
                break;

            case 'frozen':
                renderCtx.shadowColor = '#88ddff';
                renderCtx.shadowBlur = 18;
                renderCtx.fillStyle = '#001a22';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 10);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 8);
                renderCtx.fill();
                const iceGrad = renderCtx.createLinearGradient(5, 10, w - 5, h - 10);
                iceGrad.addColorStop(0, '#88ccff');
                iceGrad.addColorStop(0.5, '#ffffff');
                iceGrad.addColorStop(1, '#88ccff');
                renderCtx.fillStyle = iceGrad;
                renderCtx.beginPath();
                renderCtx.roundRect(6, 12, w - 12, h - 24, 6);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 7, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#0066cc';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 10, 3, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.globalAlpha = 0.3;
                renderCtx.strokeStyle = '#88ddff';
                renderCtx.lineWidth = 1;
                renderCtx.beginPath();
                renderCtx.moveTo(8, h - 8);
                renderCtx.lineTo(8, h - 2);
                renderCtx.moveTo(w - 8, h - 8);
                renderCtx.lineTo(w - 8, h - 2);
                renderCtx.stroke();
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'shadow':
                renderCtx.shadowColor = '#00ff00';
                renderCtx.shadowBlur = 8;
                renderCtx.fillStyle = '#050505';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 14, 4);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 18, 3);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                const glitchOffset = Math.floor(Math.sin(time * 20) * 2);
                renderCtx.beginPath();
                renderCtx.rect(w / 2 - 5 + glitchOffset, 8, 10, 6);
                renderCtx.fill();
                renderCtx.fillStyle = '#00ff00';
                renderCtx.beginPath();
                renderCtx.rect(w / 2 - 2 + glitchOffset, 16, 4, 8);
                renderCtx.fill();
                renderCtx.fillStyle = '#00ff00';
                renderCtx.globalAlpha = 0.5;
                for (let i = 0; i < 4; i++) {
                    renderCtx.fillRect(4 + i * 8, h - 6, 3, 4);
                }
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'mythic':
                renderCtx.shadowColor = '#ff00ff';
                renderCtx.shadowBlur = 25;
                renderCtx.fillStyle = '#0a0015';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 12);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 20, 10);
                renderCtx.fill();
                const rainbowGrad = renderCtx.createConicGradient(time * 2, w / 2, 10);
                rainbowGrad.addColorStop(0, '#ff0000');
                rainbowGrad.addColorStop(0.2, '#ffaa00');
                rainbowGrad.addColorStop(0.4, '#ffff00');
                rainbowGrad.addColorStop(0.6, '#00ff00');
                rainbowGrad.addColorStop(0.8, '#00ffff');
                rainbowGrad.addColorStop(1, '#ff0000');
                renderCtx.fillStyle = rainbowGrad;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 12, 10, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 2, 11, 3, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.strokeStyle = '#ffffff';
                renderCtx.lineWidth = 1;
                renderCtx.globalAlpha = 0.5;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, h / 2, 12, 0, Math.PI * 2);
                renderCtx.stroke();
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'diamond':
                renderCtx.shadowColor = '#00ffff';
                renderCtx.shadowBlur = 20;
                renderCtx.fillStyle = '#001a1a';
                renderCtx.beginPath();
                renderCtx.moveTo(w / 2, 4);
                renderCtx.lineTo(w - 4, 14);
                renderCtx.lineTo(w - 4, h - 8);
                renderCtx.lineTo(w / 2, h - 2);
                renderCtx.lineTo(4, h - 8);
                renderCtx.lineTo(4, 14);
                renderCtx.closePath();
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.moveTo(w / 2, 6);
                renderCtx.lineTo(w - 6, 14);
                renderCtx.lineTo(w - 6, h - 10);
                renderCtx.lineTo(w / 2, h - 4);
                renderCtx.lineTo(6, h - 10);
                renderCtx.lineTo(6, 14);
                renderCtx.closePath();
                renderCtx.fill();
                const diamGrad = renderCtx.createLinearGradient(w / 2, 6, w / 2, h - 4);
                diamGrad.addColorStop(0, '#ffffff');
                diamGrad.addColorStop(0.5, '#00ffff');
                diamGrad.addColorStop(1, '#ff00ff');
                renderCtx.fillStyle = diamGrad;
                renderCtx.beginPath();
                renderCtx.moveTo(w / 2, 8);
                renderCtx.lineTo(w / 2 + 6, 14);
                renderCtx.lineTo(w / 2, h - 8);
                renderCtx.lineTo(w / 2 - 6, 14);
                renderCtx.closePath();
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 14, 4, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.shadowBlur = 0;
                break;

            case 'stealth':
                renderCtx.shadowColor = '#00ffaa';
                renderCtx.shadowBlur = 12;
                renderCtx.fillStyle = '#0a0a12';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 14, 5);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 18, 4);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.roundRect(w / 2 - 5, 8, 10, 4, 2);
                renderCtx.fill();
                renderCtx.fillRect(w / 2 - 2, 16, 4, 10);
                renderCtx.fillStyle = '#00ffaa';
                renderCtx.globalAlpha = 0.6;
                renderCtx.fillRect(4, h - 6, 6, 2);
                renderCtx.fillRect(w - 10, h - 6, 6, 2);
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'ember':
                renderCtx.shadowColor = '#ff6600';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#1a0800';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 14, 6);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 10, w - 10, h - 18, 4);
                renderCtx.fill();
                const emberGrad = renderCtx.createLinearGradient(5, 10, w - 5, h - 8);
                emberGrad.addColorStop(0, '#ff6600');
                emberGrad.addColorStop(0.5, '#ffcc00');
                emberGrad.addColorStop(1, '#ff3300');
                renderCtx.fillStyle = emberGrad;
                renderCtx.beginPath();
                renderCtx.roundRect(6, 12, w - 12, h - 22, 3);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffcc00';
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 11, 6, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.arc(w / 2 - 1, 10, 2, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.fillStyle = '#ff3300';
                renderCtx.globalAlpha = 0.4;
                for (let i = 0; i < 4; i++) {
                    renderCtx.beginPath();
                    renderCtx.arc(8 + i * 6, h - 6, 2, 0, Math.PI * 2);
                    renderCtx.fill();
                }
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            case 'frost':
                renderCtx.shadowColor = '#aaddff';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#0a1a2a';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 6, w - 8, h - 12, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(5, 8, w - 10, h - 16, 6);
                renderCtx.fill();
                renderCtx.fillStyle = '#ffffff';
                renderCtx.beginPath();
                renderCtx.roundRect(6, 10, w - 12, 12, 4);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 16, 4, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.strokeStyle = '#88ccff';
                renderCtx.lineWidth = 1;
                renderCtx.globalAlpha = 0.4;
                renderCtx.beginPath();
                renderCtx.moveTo(8, h - 8);
                renderCtx.lineTo(8, h - 2);
                renderCtx.moveTo(w - 8, h - 8);
                renderCtx.lineTo(w - 8, h - 2);
                renderCtx.stroke();
                renderCtx.globalAlpha = 1;
                renderCtx.shadowBlur = 0;
                break;

            default:
                renderCtx.shadowColor = '#00ffff';
                renderCtx.shadowBlur = 15;
                renderCtx.fillStyle = '#001a1a';
                renderCtx.beginPath();
                renderCtx.roundRect(4, 8, w - 8, h - 16, 8);
                renderCtx.fill();
                renderCtx.fillStyle = baseColor;
                renderCtx.beginPath();
                renderCtx.roundRect(6, 10, w - 12, h - 20, 6);
                renderCtx.fill();
                renderCtx.fillStyle = accentColor;
                renderCtx.beginPath();
                renderCtx.arc(w / 2, 12, 8, 0, Math.PI * 2);
                renderCtx.fill();
                renderCtx.shadowBlur = 0;
                break;
        }
        
        renderCtx.restore();
    }
    
    // Game Loop
    let lastTime = 0;
    let gamePaused = false;
    
    function gameLoop(timestamp) {
        const dt = timestamp - lastTime;
        lastTime = timestamp;
        
        if (!gamePaused) {
            update();
            draw();
        }
        
        requestAnimationFrame(gameLoop);
    }
    
    // Auto-pause on tab switch / visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            gamePaused = true;
            if (AudioSystem.ambientGain) {
                AudioSystem.ambientGain.gain.value = 0;
            }
        } else {
            gamePaused = false;
            if (!audioMuted && AudioSystem.ambientGain) {
                AudioSystem.ambientGain.gain.value = 0.04;
            }
        }
    });
    
    window.addEventListener('blur', () => {
        gamePaused = true;
    });
    
    window.addEventListener('focus', () => {
        gamePaused = false;
    });
    
    // Input — desktop A/D or arrows
    document.addEventListener('keydown', (e) => {
        if (state === GameState.PLAYING) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    });
    
    // Mobile — finger follows X across screen
    const touchLayer = document.getElementById('touch-layer');
    const canvasEl = document.getElementById('gameCanvas');
    
    function handleTouchX(clientX) {
        touchTargetX = clientX;
        touchActive = true;
    }
    
    function onTouchStart(e) {
        if (state !== GameState.PLAYING) return;
        e.preventDefault();
        handleTouchX(e.touches[0].clientX);
    }
    
    function onTouchMove(e) {
        if (state !== GameState.PLAYING || !touchActive) return;
        e.preventDefault();
        handleTouchX(e.touches[0].clientX);
    }
    
    function onTouchEnd() {
        touchActive = false;
    }
    
    if (touchLayer) {
        touchLayer.addEventListener('touchstart', onTouchStart, { passive: false });
        touchLayer.addEventListener('touchmove', onTouchMove, { passive: false });
        touchLayer.addEventListener('touchend', onTouchEnd);
        touchLayer.addEventListener('touchcancel', onTouchEnd);
    }
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onTouchEnd);
    
    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMute();
        });
        muteBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleMute();
        });
        updateMuteIcon();
    }
    
    // UI Buttons
    document.getElementById('play-btn').addEventListener('click', () => {
        AudioSystem.init();
        AudioSystem.startAmbient();
        AudioSystem.play('ui');
        init();
        state = GameState.PLAYING;
        document.getElementById('main-menu').classList.remove('active');
        if (muteBtn) muteBtn.classList.add('visible');
    });
    
    document.getElementById('retry-btn').addEventListener('click', () => {
        AudioSystem.play('ui');
        init();
        state = GameState.PLAYING;
        document.getElementById('game-over').classList.remove('active');
        if (muteBtn) muteBtn.classList.add('visible');
    });
    
    document.getElementById('revive-btn').addEventListener('click', () => {
        showRewardedAd(() => {
            currentCheckpoint = Math.floor(checkpointHeight / 100);
            init();
            respawnAtCheckpoint();
            state = GameState.PLAYING;
            document.getElementById('game-over').classList.remove('active');
        });
    });
    
    document.getElementById('menu-btn').addEventListener('click', () => {
        AudioSystem.stopAmbient();
        document.getElementById('game-over').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
        document.getElementById('menu-best').textContent = bestHeight;
        state = GameState.MENU;
        cameraY = 0;
    });
    
    document.getElementById('skins-btn').addEventListener('click', () => {
        AudioSystem.play('ui');
        document.getElementById('main-menu').classList.remove('active');
        document.getElementById('skins-menu').classList.add('active');
        renderSkins();
    });
    
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('skins-menu').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
    });
    
    function renderSkins() {
        const grid = document.getElementById('skins-grid');
        grid.innerHTML = '';
        document.getElementById('skins-coins').textContent = coins;
        
        const buyBtn = document.getElementById('buy-btn');
        buyBtn.classList.remove('show');
        selectedSkinInShop = null;
        
        SKINS.forEach(skin => {
            const unlocked = unlockedSkins.includes(skin.id);
            const item = document.createElement('div');
            item.className = 'skin-item' + (selectedSkin === skin.id ? ' selected' : '');
            
            const preview = document.createElement('div');
            preview.className = 'skin-preview';
            
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 60;
            previewCanvas.height = 80;
            const pctx = previewCanvas.getContext('2d');
            pctx.scale(2, 2.67);
            pctx.shadowColor = skin.accent;
            pctx.shadowBlur = 8;
            renderCharacter(0, 0, 30, 40, skin, 0, 1, 1, true, 0, pctx);
            
            preview.appendChild(previewCanvas);
            
            const name = document.createElement('div');
            name.className = 'skin-name';
            name.textContent = skin.name + (unlocked ? '' : ' - ' + skin.price);
            
            item.appendChild(preview);
            item.appendChild(name);
            
            item.addEventListener('click', () => {
                if (unlocked) {
                    selectedSkin = skin.id;
                    Storage.set('towerchaos_skin', selectedSkin);
                    renderSkins();
                } else {
                    selectedSkinInShop = skin;
                    document.querySelectorAll('.skin-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    document.getElementById('buy-price').textContent = skin.price;
                    buyBtn.classList.add('show');
                }
            });
            
            grid.appendChild(item);
        });
    }
    
    document.getElementById('buy-btn').addEventListener('click', () => {
        if (selectedSkinInShop && !unlockedSkins.includes(selectedSkinInShop.id)) {
            if (coins >= selectedSkinInShop.price) {
                coins -= selectedSkinInShop.price;
                unlockedSkins.push(selectedSkinInShop.id);
                Storage.set('towerchaos_coins', coins);
                Storage.set('towerchaos_unlocked', JSON.stringify(unlockedSkins));
                selectedSkin = selectedSkinInShop.id;
                Storage.set('towerchaos_skin', selectedSkin);
                renderSkins();
            }
        }
    });
    
    // Yandex Games Integration
    let ysdk = null;
    let ysdkReady = false;

    function initYandexSDK() {
        if (ysdkReady) return;
        try {
            if (typeof YaGames === 'undefined') return;
            YaGames.init().then(sdk => {
                ysdk = sdk;
                ysdkReady = true;
            }).catch(err => {
                console.error('[Yandex] SDK init error:', err.message);
            });
        } catch(e) {
            console.error('[Yandex] SDK init failed:', e.message);
        }
    }

    function showRewardedAd(callback) {
        if (!ysdkReady || !ysdk) {
            if (callback) callback();
            return;
        }
        try {
            ysdk.adv.showRewardedVideo({
                callbacks: {
                    onOpen: () => {},
                    onRewarded: () => {
                        if (callback) callback();
                    },
                    onClose: () => {},
                    onError: (e) => {
                        console.error('[Yandex] Rewarded ad error:', e.message);
                    }
                }
            });
        } catch(e) {
            console.error('[Yandex] Rewarded ad failed:', e.message);
        }
    }

    function showFullscreenAd(callback) {
        if (!ysdkReady || !ysdk) {
            if (callback) callback();
            return;
        }
        try {
            ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onOpen: () => {},
                    onClose: (wasShown) => {
                        if (callback) callback();
                    },
                    onError: (e) => {
                        console.error('[Yandex] Interstitial ad error:', e.message);
                        if (callback) callback();
                    }
                }
            });
        } catch(e) {
            console.error('[Yandex] Interstitial ad failed:', e.message);
            if (callback) callback();
        }
    }

    function saveBestScore(score) {
        Storage.set('towerchaos_best', score);
    }
    
    function loadBestScore() {
        return parseInt(Storage.get('towerchaos_best', '0'));
    }

    // Try to init Yandex SDK on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initYandexSDK);
    } else {
        initYandexSDK();
    }
    
    // Initialize menu
    document.getElementById('menu-best').textContent = bestHeight;
    
    // Start
    initBackground();
    requestAnimationFrame(gameLoop);
    
    // Loading screen fade out
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const loadingScreen = document.getElementById('loading-screen');
    
    let loadProgress = 0;
    const loadInterval = setInterval(() => {
        loadProgress += 15 + Math.random() * 20;
        if (loadProgress >= 100) {
            loadProgress = 100;
            clearInterval(loadInterval);
            if (loadingBar) loadingBar.style.width = '100%';
            if (loadingText) loadingText.textContent = 'Готово!';
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.classList.add('fade-out');
                    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
                }
            }, 300);
        } else {
            if (loadingBar) loadingBar.style.width = loadProgress + '%';
        }
    }, 150);
})();
