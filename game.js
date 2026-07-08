// game.js

import * as THREE from 'three';

export class SpaceGame {
    constructor(scene, camera, orbitControls, gltfLoader) {
        this.scene = scene;
        this.camera = camera;
        this.orbitControls = orbitControls;
        this.isActive = false;

        this.ship = new THREE.Group();
        this.ship.rotation.order = 'YXZ';
        this.scene.add(this.ship);

        this.shipVisual = new THREE.Group();
        this.ship.add(this.shipVisual);

        this.cameraMode = 0;

        this.keys = {};
        this.velocity = 0;
        this.pitch = 0;
        this.yaw = 0;

        this.baseNear = this.camera.near;

        // Custom free-look properties
        this.freeLookAngleX = 0;
        this.freeLookAngleY = 0;
        this.isDragging = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;

        // Free Look Event Listeners
        const handleStart = (x, y, e) => {
            if (!this.isActive || e.target.closest('.ui-group') || e.target.closest('.game-ctrl') || e.target.closest('#game-top-bar')) return;
            this.isDragging = true;
            this.lastTouchX = x;
            this.lastTouchY = y;
        };
        const handleMove = (x, y) => {
            if (this.isDragging && this.isActive) {
                const dx = x - this.lastTouchX;
                const dy = y - this.lastTouchY;
                this.freeLookAngleX -= dx * 0.005;
                this.freeLookAngleY -= dy * 0.005;
                this.freeLookAngleY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.freeLookAngleY));
                this.lastTouchX = x;
                this.lastTouchY = y;
            }
        };
        const handleEnd = () => this.isDragging = false;

        document.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY, e));
        document.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleEnd);

        document.addEventListener('touchstart', e => {
            if (e.touches.length > 0) handleStart(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });
        document.addEventListener('touchmove', e => {
            if (this.isDragging && e.touches.length > 0) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        window.addEventListener('touchend', handleEnd);

        this.engineStart = new Audio('assets/engine-start.wav');
        this.engineLoop = new Audio('assets/spaceship-on.mp3');
        this.engineLoop.loop = true;
        this.clickOut = new Audio('assets/click-out.wav');

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'game.css';
        document.head.appendChild(link);

        fetch('game.html')
            .then(r => r.text())
            .then(html => {
                document.body.insertAdjacentHTML('beforeend', html);
                this.setupUI();
            })
            .catch(err => console.error("Could not load game.html", err));

        gltfLoader.load('spaceship.glb', (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);

            if (maxDim > 0) {
                model.scale.setScalar(0.001 / maxDim);
            }

            box.setFromObject(model);
            const center = new THREE.Vector3(); box.getCenter(center);
            model.position.sub(center);

            model.rotation.y = -Math.PI / 2;

            this.shipVisual.add(model);
            this.ship.visible = false;
        });
    }

    setupUI() {
        const enterBtn = document.getElementById('game-btn');
        if (enterBtn) enterBtn.addEventListener('click', () => this.start());

        const exitBtn = document.getElementById('game-exit-btn');
        if (exitBtn) exitBtn.addEventListener('click', () => this.stop());

        const camBtn = document.getElementById('game-cam-btn');
        if (camBtn) camBtn.addEventListener('click', () => {
            this.cameraMode = (this.cameraMode + 1) % 2;
            const modes = ['Chase Back', 'Cockpit'];
            camBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Cam: ${modes[this.cameraMode]}`;
        });

        const rollLeft = document.getElementById('btn-roll-left');
        const rollRight = document.getElementById('btn-roll-right');
        if (rollLeft) rollLeft.style.display = 'none';
        if (rollRight) rollRight.style.display = 'none';

        // FIXED touch release behavior on buttons
        const bindBtn = (id, key) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const press = (e) => { e.preventDefault(); this.keys[key] = true; };
            const release = (e) => { e.preventDefault(); this.keys[key] = false; };
            btn.addEventListener('mousedown', press);
            btn.addEventListener('mouseup', release);
            btn.addEventListener('mouseleave', release);
            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release);
            btn.addEventListener('touchcancel', release);
        };

        bindBtn('btn-forward', 'w');
        bindBtn('btn-backward', 's');
        bindBtn('btn-turn-left', 'arrowleft');
        bindBtn('btn-turn-right', 'arrowright');
        bindBtn('btn-tilt-down', 'arrowup');
        bindBtn('btn-tilt-up', 'arrowdown');

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ') e.preventDefault();
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

        // Hide overlay UI entirely in mobile/desktop to prevent Z-Index issues
        const tb = document.getElementById('top-bar'); if (tb) tb.style.display = 'none';
        const lg = document.getElementById('legend'); if (lg) lg.style.display = 'none';
        const ht = document.getElementById('hint'); if (ht) ht.style.display = 'none';
        const ip = document.getElementById('info-panel'); if (ip) ip.style.display = 'none';

        this.ship.visible = true;

        this.cameraMode = 0;
        const camBtn = document.getElementById('game-cam-btn');
        if (camBtn) camBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Cam: Chase Back`;

        this.camera.near = 0.001;
        this.camera.updateProjectionMatrix();

        this.ship.position.set(26, 0.5, 0);
        this.ship.rotation.set(0, 0, 0);

        this.shipVisual.rotation.set(0, 0, 0);

        this.velocity = 0;
        this.pitch = 0;
        this.yaw = 0;
        this.freeLookAngleX = 0;
        this.freeLookAngleY = 0;

        this.engineStart.currentTime = 0;
        this.engineStart.play().then(() => {
            this.engineLoop.play();
        }).catch(() => { });
    }

    stop() {
        this.isActive = false;
        this.orbitControls.enabled = true;
        document.getElementById('game-ui').style.display = 'none';

        // Restore overlay UI elements
        const tb = document.getElementById('top-bar'); if (tb) tb.style.display = 'flex';
        const lg = document.getElementById('legend'); if (lg) lg.style.display = 'flex';
        const ht = document.getElementById('hint'); if (ht) ht.style.display = 'block';
        const ip = document.getElementById('info-panel'); if (ip) ip.style.display = '';

        this.ship.visible = false;

        this.camera.near = this.baseNear;
        this.camera.updateProjectionMatrix();

        this.engineLoop.pause();
        this.clickOut.currentTime = 0;
        this.clickOut.play().catch(() => { });
    }

    update(dt) {
        const thrustInput = (this.keys['w'] ? 1 : 0) - (this.keys['s'] ? 1 : 0);
        const yawInput = ((this.keys['arrowleft'] || this.keys['a']) ? 1 : 0) - ((this.keys['arrowright'] || this.keys['d']) ? 1 : 0);
        const pitchInput = (this.keys['arrowdown'] ? 1 : 0) - (this.keys['arrowup'] ? 1 : 0);

        let speedMultiplier = this.keys['shift'] ? 10.0 : 0.4;

        if (this.keys['w'] && this.keys[' ']) {
            speedMultiplier *= 2.0;
        }

        const maxVelocity = thrustInput * speedMultiplier;
        this.velocity = THREE.MathUtils.lerp(this.velocity, maxVelocity, dt * 4.0);

        const turnSpeed = 1.0 * dt;

        this.yaw += yawInput * turnSpeed;
        this.pitch += pitchInput * turnSpeed;

        const maxPitch = Math.PI / 2.1;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

        this.ship.rotation.y = this.yaw;
        this.ship.rotation.x = this.pitch;
        this.ship.rotation.z = 0;

        this.ship.translateZ(-this.velocity * dt * 20);

        const targetBank = yawInput * 0.45;
        const targetPitchTilt = pitchInput * 0.15;

        this.shipVisual.rotation.z = THREE.MathUtils.lerp(this.shipVisual.rotation.z, targetBank, dt * 6.0);
        this.shipVisual.rotation.x = THREE.MathUtils.lerp(this.shipVisual.rotation.x, targetPitchTilt, dt * 6.0);

        this.ship.updateMatrixWorld(true);

        // Auto-center camera if maneuvering
        const isInputActive = Math.abs(thrustInput) > 0 || Math.abs(yawInput) > 0 || Math.abs(pitchInput) > 0;
        if (isInputActive) {
            this.freeLookAngleX = THREE.MathUtils.lerp(this.freeLookAngleX, 0, dt * 8.0);
            this.freeLookAngleY = THREE.MathUtils.lerp(this.freeLookAngleY, 0, dt * 8.0);
        }

        const localCameraPos = new THREE.Vector3();
        const localLookTarget = new THREE.Vector3();

        if (this.cameraMode === 0) {
            localCameraPos.set(0, 0.001, 0.006);
            localLookTarget.set(0, 0, -10);

            // Free Look transformation around the ship center
            const euler = new THREE.Euler(this.freeLookAngleY, this.freeLookAngleX, 0, 'YXZ');
            localCameraPos.applyEuler(euler);
            localLookTarget.applyEuler(euler);
        } else {
            localCameraPos.set(0, 0.00025, -0.00025);
            localLookTarget.set(0, 0, -10);

            // Free Look pivots camera rotation in first-person
            const euler = new THREE.Euler(this.freeLookAngleY, this.freeLookAngleX, 0, 'YXZ');
            localLookTarget.applyEuler(euler);
        }

        const worldCameraPos = localCameraPos.applyMatrix4(this.ship.matrixWorld);
        const worldLookTarget = localLookTarget.applyMatrix4(this.ship.matrixWorld);

        this.camera.position.copy(worldCameraPos);
        this.camera.lookAt(worldLookTarget);
    }
}