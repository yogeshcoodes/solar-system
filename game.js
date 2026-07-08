import * as THREE from 'three';

export class SpaceGame {
    constructor(scene, camera, orbitControls, gltfLoader) {
        this.scene = scene;
        this.camera = camera;
        this.orbitControls = orbitControls;
        this.isActive = false;
        
        // 1. The Core Physics Anchor (Moves the camera and handles true rotation)
        this.ship = new THREE.Group();
        this.ship.rotation.order = 'YXZ'; 
        this.scene.add(this.ship);

        // 2. The Visual Hull (Tilts and banks dynamically inside the core)
        this.shipVisual = new THREE.Group();
        this.ship.add(this.shipVisual);
        
        // 0 = Chase Back, 1 = Cockpit
        this.cameraMode = 0; 
        
        // Flight state
        this.keys = {};
        this.velocity = 0;
        this.pitch = 0;
        this.yaw = 0;
        
        this.baseNear = this.camera.near;

        // Load Audio
        this.engineStart = new Audio('assets/engine-start.wav');
        this.engineLoop = new Audio('assets/spaceship-on.mp3');
        this.engineLoop.loop = true;
        this.clickOut = new Audio('assets/click-out.wav');

        // Dynamically inject CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'game.css';
        document.head.appendChild(link);

        // Fetch and inject UI
        fetch('game.html')
            .then(r => r.text())
            .then(html => {
                document.body.insertAdjacentHTML('beforeend', html);
                this.setupUI();
            })
            .catch(err => console.error("Could not load game.html", err));

        // Load spaceship
        gltfLoader.load('spaceship.glb', (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (maxDim > 0) {
                // Scale decreased by 50% again (0.001 instead of 0.002)
                model.scale.setScalar(0.001 / maxDim);
            }
            
            box.setFromObject(model);
            const center = new THREE.Vector3(); box.getCenter(center);
            model.position.sub(center);
            
            // Corrects models exported facing sideways
            model.rotation.y = -Math.PI / 2;
            
            // Add the 3D model to the Visual Hull instead of the Core Anchor
            this.shipVisual.add(model);
            this.ship.visible = false;
        });
    }

    setupUI() {
        const enterBtn = document.getElementById('game-btn');
        if(enterBtn) enterBtn.addEventListener('click', () => this.start());

        const exitBtn = document.getElementById('game-exit-btn');
        if(exitBtn) exitBtn.addEventListener('click', () => this.stop());

        const camBtn = document.getElementById('game-cam-btn');
        if(camBtn) camBtn.addEventListener('click', () => {
            this.cameraMode = (this.cameraMode + 1) % 2;
            const modes = ['Chase Back', 'Cockpit'];
            camBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Cam: ${modes[this.cameraMode]}`;
        });

        // Hide Roll buttons dynamically from UI since we are using Drone/Airplane controls
        const rollLeft = document.getElementById('btn-roll-left');
        const rollRight = document.getElementById('btn-roll-right');
        if (rollLeft) rollLeft.style.display = 'none';
        if (rollRight) rollRight.style.display = 'none';

        // Bind Hold Controls
        const bindBtn = (id, key) => {
            const btn = document.getElementById(id);
            if(!btn) return;
            const press = (e) => { e.preventDefault(); this.keys[key] = true; };
            const release = (e) => { e.preventDefault(); this.keys[key] = false; };
            btn.addEventListener('mousedown', press); btn.addEventListener('mouseup', release); btn.addEventListener('mouseleave', release);
            btn.addEventListener('touchstart', press, {passive: false}); btn.addEventListener('touchcancel', release);
        };

        // UI Button Bindings
        bindBtn('btn-forward', 'w');
        bindBtn('btn-backward', 's');
        bindBtn('btn-turn-left', 'arrowleft');
        bindBtn('btn-turn-right', 'arrowright');
        bindBtn('btn-tilt-down', 'arrowup');
        bindBtn('btn-tilt-up', 'arrowdown');

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ') e.preventDefault(); // Prevent spacebar from scrolling the page
            this.keys[e.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    start() {
        this.isActive = true;
        this.orbitControls.enabled = false; 
        document.getElementById('game-ui').style.display = 'block';
        this.ship.visible = true;
        
        this.cameraMode = 0; 
        const camBtn = document.getElementById('game-cam-btn');
        if (camBtn) camBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Cam: Chase Back`;

        // Prevent camera clipping through the small ship geometry
        this.camera.near = 0.001; 
        this.camera.updateProjectionMatrix();

        // Initial Spawn Location
        this.ship.position.set(26, 0.5, 0);
        this.ship.rotation.set(0, 0, 0);
        
        // Reset Visual Hull
        this.shipVisual.rotation.set(0, 0, 0);

        this.velocity = 0;
        this.pitch = 0;
        this.yaw = 0;

        // Audio
        this.engineStart.currentTime = 0;
        this.engineStart.play().then(() => {
            this.engineLoop.play();
        }).catch(()=>{});
    }

    stop() {
        this.isActive = false;
        this.orbitControls.enabled = true; 
        document.getElementById('game-ui').style.display = 'none';
        this.ship.visible = false;
        
        // Restore main app camera planes
        this.camera.near = this.baseNear;
        this.camera.updateProjectionMatrix();

        // Audio
        this.engineLoop.pause();
        this.clickOut.currentTime = 0;
        this.clickOut.play().catch(()=>{});
    }

    update(dt) {
        // --- READ INPUTS ---
        const thrustInput = (this.keys['w'] ? 1 : 0) - (this.keys['s'] ? 1 : 0);
        const yawInput = ((this.keys['arrowleft'] || this.keys['a']) ? 1 : 0) - ((this.keys['arrowright'] || this.keys['d']) ? 1 : 0);
        const pitchInput = (this.keys['arrowdown'] ? 1 : 0) - (this.keys['arrowup'] ? 1 : 0);

        // --- SPEED LOGIC ---
        // Hold SHIFT to engage hyper-speed
        let speedMultiplier = this.keys['shift'] ? 10.0 : 0.4; 
        
        // Feature: W + Space doubles the current speed multiplier
        if (this.keys['w'] && this.keys[' ']) {
            speedMultiplier *= 2.0;
        }

        const maxVelocity = thrustInput * speedMultiplier;

        // Smooth acceleration to max speed
        this.velocity = THREE.MathUtils.lerp(this.velocity, maxVelocity, dt * 4.0);

        // --- ROTATION LOGIC ---
        const turnSpeed = 1.0 * dt; 
        
        // Accumulate rotation
        this.yaw += yawInput * turnSpeed;
        this.pitch += pitchInput * turnSpeed;

        // Clamp Pitch so the ship cannot physically do a backflip
        const maxPitch = Math.PI / 2.1; 
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

        // Apply rotation exactly to the Core Anchor (Moves the camera)
        this.ship.rotation.y = this.yaw;
        this.ship.rotation.x = this.pitch;
        this.ship.rotation.z = 0; 

        // --- MOVEMENT LOGIC ---
        // Move the ship strictly ALONG its local Z axis
        this.ship.translateZ(-this.velocity * dt * 20);

        // ==========================================
        // DYNAMIC VISUAL BANKING / TILTING
        // ==========================================
        // This tilts the 3D model for realism without rotating the locked camera
        const targetBank = yawInput * 0.45;        // Bank left/right when turning
        const targetPitchTilt = pitchInput * 0.15; // Slightly dip/raise nose when pitching

        this.shipVisual.rotation.z = THREE.MathUtils.lerp(this.shipVisual.rotation.z, targetBank, dt * 6.0);
        this.shipVisual.rotation.x = THREE.MathUtils.lerp(this.shipVisual.rotation.x, targetPitchTilt, dt * 6.0);

        // ==========================================
        // CRITICAL FIX FOR THE FPS STUTTER / GLITCH
        // ==========================================
        this.ship.updateMatrixWorld(true);

        // --- PERFECT RIGID CAMERA LOCK ---
        const localCameraPos = new THREE.Vector3();
        const localLookTarget = new THREE.Vector3();

        if (this.cameraMode === 0) {
            // Chase Back View (Moved 50% closer to match the smaller ship)
            localCameraPos.set(0, 0.001, 0.006); 
            localLookTarget.set(0, 0, -10);      
        } else {
            // Cockpit View (Moved slightly closer/adjusted for the smaller scale)
            localCameraPos.set(0, 0.00025, -0.00025); 
            localLookTarget.set(0, 0, -10);
        }

        // Convert the local points to absolute world points based on the fully updated matrix
        const worldCameraPos = localCameraPos.applyMatrix4(this.ship.matrixWorld);
        const worldLookTarget = localLookTarget.applyMatrix4(this.ship.matrixWorld);

        // Hard set the camera exactly to those world points. ZERO lag.
        this.camera.position.copy(worldCameraPos);
        this.camera.lookAt(worldLookTarget);
    }
}