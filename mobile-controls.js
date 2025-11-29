// mobile-controls.js
// Virtual joystick + camera drag + buttons for mobile devices
export class MobileControls {
    constructor() {
        this.enabled = this.isMobile();
        this.move = { x: 0, y: 0 };
        this.lookDelta = 0;
        this.lookUpDown = 0;

        if (!this.enabled) return;

        this.uiBuilt = false;

        this.onJump = () => {};
        this.onShoot = () => {};
        this.onAbility = () => {};
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    }

    // Call after pressing Start
    start() {
        if (!this.enabled || this.uiBuilt) return;

        this._buildUI();
        this._attachEvents();
        this.uiBuilt = true;

        // Fade in UI smoothly
        [this.stickOuter, this.stickInner, this.btnJump, this.btnShoot, this.btnAbility].forEach(el => {
            el.style.opacity = 0;
            el.style.transition = 'opacity 0.3s';
            requestAnimationFrame(() => el.style.opacity = 1);
        });
    }

    _buildUI() {
        // ----- LEFT JOYSTICK -----
        this.stickOuter = document.createElement("div");
        this.stickInner = document.createElement("div");
        Object.assign(this.stickOuter.style, {
            position: "fixed",
            left: "20px",
            bottom: "20px",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            touchAction: "none",
            zIndex: 9999
        });
        Object.assign(this.stickInner.style, {
            position: "absolute",
            left: "45px",
            top: "45px",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)"
        });
        this.stickOuter.appendChild(this.stickInner);
        document.body.appendChild(this.stickOuter);

        // ----- RIGHT DRAG AREA (camera) -----
        this.dragArea = document.createElement("div");
        Object.assign(this.dragArea.style, {
            position: "fixed",
            right: "0",
            bottom: "0",
            width: "50%",
            height: "100%",
            zIndex: 9998
        });
        document.body.appendChild(this.dragArea);

        // ----- BUTTONS -----
        this.btnJump = this._makeButton("Jump", 90, 20);
        this.btnShoot = this._makeButton("Shoot", 90, 140);
        this.btnAbility = this._makeButton("Boost", 200, 20);
    }

    _makeButton(text, bottom, right) {
        const btn = document.createElement("div");
        btn.innerText = text;
        Object.assign(btn.style, {
            position: "fixed",
            right: right + "px",
            bottom: bottom + "px",
            width: "80px",
            padding: "15px 0",
            background: "rgba(255,255,255,0.25)",
            color: "#fff",
            textAlign: "center",
            borderRadius: "12px",
            fontSize: "18px",
            userSelect: "none",
            touchAction: "none",
            zIndex: 9999
        });
        document.body.appendChild(btn);
        return btn;
    }

    _attachEvents() {
        // ----- JOYSTICK -----
        let stickActive = false;

        this.stickOuter.addEventListener("touchstart", e => {
            stickActive = true;
            this._updateStick(e);
        });

        this.stickOuter.addEventListener("touchmove", e => {
            if (stickActive) this._updateStick(e);
        });

        this.stickOuter.addEventListener("touchend", () => {
            stickActive = false;
            this.move.x = 0;
            this.move.y = 0;
            this.stickInner.style.left = "45px";
            this.stickInner.style.top = "45px";
        });

        // ----- LOOK DRAG -----
        let lastX = null, lastY = null;

        this.dragArea.addEventListener("touchmove", e => {
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;

            if (lastX != null && lastY != null) {
                const dx = x - lastX;
                const dy = y - lastY;

                this.lookDelta = dx * 0.0025;
                this.lookUpDown = dy * 0.0025;
            }

            lastX = x;
            lastY = y;
        });

        this.dragArea.addEventListener("touchend", () => {
            lastX = null;
            lastY = null;
            this.lookDelta = 0;
            this.lookUpDown = 0;
        });

        // ----- BUTTON EVENTS -----
        this.btnJump.addEventListener("touchstart", () => this.onJump());
        this.btnShoot.addEventListener("touchstart", () => this.onShoot());
        this.btnAbility.addEventListener("touchstart", () => this.onAbility());
    }

    _updateStick(e) {
        const rect = this.stickOuter.getBoundingClientRect();
        const touch = e.touches[0];

        const x = touch.clientX - rect.left - rect.width / 2;
        const y = touch.clientY - rect.top - rect.height / 2;

        const dist = Math.hypot(x, y);
        const max = 60;

        const clampedX = (x / dist) * Math.min(dist, max);
        const clampedY = (y / dist) * Math.min(dist, max);

        this.stickInner.style.left = clampedX + 45 + "px";
        this.stickInner.style.top = clampedY + 45 + "px";

        this.move.x = clampedX / max;
        this.move.y = clampedY / max;
    }

    update() {
        const { x, y } = this.move;

        return {
            forward: -y,
            backward: y > 0 ? y : 0,
            left: x < 0 ? -x : 0,
            right: x > 0 ? x : 0,
            look: this.lookDelta,
            lookUpDown: this.lookUpDown
        };
    }
}
