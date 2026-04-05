/* ============================================================
   THE VELOCITY ENGINE — Main Engine
   Wind Tunnel · Front Wing · Power Unit · F1 Telemetry
   Three.js · GSAP · Lenis
   ============================================================ */

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────
  const state = {
    mouse: { x: 0, y: 0, nx: 0, ny: 0 },
    scroll: { y: 0, progress: 0 },
    isMobile: window.innerWidth < 768,
    scenes: {},
    loaded: false,
  };

  // ─── Utilities ────────────────────────────────────────────
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // ─── Mouse tracking ──────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    state.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // ─── Scroll tracking ─────────────────────────────────────
  window.addEventListener('scroll', () => {
    state.scroll.y = window.scrollY || window.pageYOffset;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    state.scroll.progress = docH > 0 ? state.scroll.y / docH : 0;
  });

  // ─── Lenis smooth scroll ─────────────────────────────────
  let lenis;
  function initLenis() {
    try {
      lenis = new Lenis({
        duration: 1.6,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } catch (e) {
      console.warn('Lenis init failed:', e);
    }
  }

  // ─── Mobile nav toggle ───────────────────────────────────
  function initNav() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        links.classList.toggle('open');
      });
      links.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => links.classList.remove('open'));
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SCENE 1: Wind Tunnel — Airflow Particles
  // ═══════════════════════════════════════════════════════════
  function initWindTunnel() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const count = state.isMobile ? 2000 : 6000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const crimson = new THREE.Color(0xD70000);
    const dimCrimson = new THREE.Color(0x660000);
    const white = new THREE.Color(0xCCCCCC);
    const grey = new THREE.Color(0x444444);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spread particles across a wide volume, primarily flowing downward
      positions[i3]     = (Math.random() - 0.5) * 20;      // x spread
      positions[i3 + 1] = (Math.random() - 0.5) * 20;      // y spread
      positions[i3 + 2] = (Math.random() - 0.5) * 12 - 2;  // z depth

      // Base downward velocity (airflow)
      velocities[i] = 0.01 + Math.random() * 0.025;

      // Color distribution: mostly grey/white, some crimson sparks
      const colorChoice = Math.random();
      let color;
      if (colorChoice < 0.08) color = crimson;
      else if (colorChoice < 0.15) color = dimCrimson;
      else if (colorChoice < 0.5) color = white;
      else color = grey;

      colors[i3]     = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: state.isMobile ? 0.018 : 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    state.scenes.wind = { renderer, scene, camera, particles, positions, velocities, count };

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function animateWindTunnel() {
    const s = state.scenes.wind;
    if (!s) return;

    const pos = s.positions;
    const vel = s.velocities;

    // Scroll-linked speed multiplier: faster as user scrolls
    const speedMult = 1 + state.scroll.progress * 4;
    const mx = state.mouse.nx * 0.15;

    for (let i = 0; i < s.count; i++) {
      const i3 = i * 3;

      // Downward airflow (Y-axis)
      pos[i3 + 1] -= vel[i] * speedMult;

      // Slight horizontal drift from mouse
      pos[i3] += mx * 0.0005;

      // Wrap particles that fall below
      if (pos[i3 + 1] < -10) {
        pos[i3 + 1] = 10;
        pos[i3] = (Math.random() - 0.5) * 20;
        pos[i3 + 2] = (Math.random() - 0.5) * 12 - 2;
      }
    }

    s.particles.geometry.attributes.position.needsUpdate = true;

    // Subtle camera response to mouse
    s.camera.position.x = lerp(s.camera.position.x, mx * 0.3, 0.015);
    s.camera.position.y = lerp(s.camera.position.y, state.mouse.ny * 0.15, 0.015);

    s.renderer.render(s.scene, s.camera);
  }

  // ═══════════════════════════════════════════════════════════
  // SCENE 2: Hero — Abstract Front Wing
  // ═══════════════════════════════════════════════════════════
  function initFrontWing() {
    const canvas = document.getElementById('hero-3d-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.5, 5);

    const wingGroup = new THREE.Group();

    // Crimson material (solid body)
    const crimsonMat = new THREE.MeshBasicMaterial({
      color: 0xD70000,
      transparent: true,
      opacity: 0.15,
    });

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xD70000,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    // Carbon grey body
    const carbonMat = new THREE.MeshBasicMaterial({
      color: 0x3A3A3A,
      transparent: true,
      opacity: 0.2,
    });

    // Main wing element — wide, thin box
    const mainWingGeo = new THREE.BoxGeometry(4, 0.06, 0.8);
    const mainWing = new THREE.Mesh(mainWingGeo, carbonMat);
    mainWing.position.set(0, 0, 0);
    wingGroup.add(mainWing);

    // Wing wireframe overlay
    const mainWingWire = new THREE.Mesh(mainWingGeo, wireMat);
    mainWingWire.position.copy(mainWing.position);
    wingGroup.add(mainWingWire);

    // Endplates — vertical fins on each side
    const endplateGeo = new THREE.BoxGeometry(0.04, 0.5, 1);
    const lEndplate = new THREE.Mesh(endplateGeo, crimsonMat);
    lEndplate.position.set(-2, 0.1, 0);
    wingGroup.add(lEndplate);

    const rEndplate = new THREE.Mesh(endplateGeo, crimsonMat);
    rEndplate.position.set(2, 0.1, 0);
    wingGroup.add(rEndplate);

    // Endplate wireframes
    const lEndWire = new THREE.Mesh(endplateGeo, wireMat);
    lEndWire.position.copy(lEndplate.position);
    wingGroup.add(lEndWire);

    const rEndWire = new THREE.Mesh(endplateGeo, wireMat);
    rEndWire.position.copy(rEndplate.position);
    wingGroup.add(rEndWire);

    // Secondary wing elements (flaps)
    for (let i = 0; i < 3; i++) {
      const flapGeo = new THREE.BoxGeometry(3.6 - i * 0.4, 0.03, 0.3);
      const flap = new THREE.Mesh(flapGeo, carbonMat);
      flap.position.set(0, 0.15 + i * 0.12, -0.25 + i * 0.15);
      flap.rotation.x = -0.1 - i * 0.08;
      wingGroup.add(flap);

      const flapWire = new THREE.Mesh(flapGeo, wireMat.clone());
      flapWire.material.opacity = 0.2;
      flapWire.position.copy(flap.position);
      flapWire.rotation.copy(flap.rotation);
      wingGroup.add(flapWire);
    }

    // Nose cone / central pillar
    const noseGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8);
    const nose = new THREE.Mesh(noseGeo, crimsonMat);
    nose.position.set(0, -0.2, 0.3);
    wingGroup.add(nose);

    const noseWire = new THREE.Mesh(noseGeo, wireMat);
    noseWire.position.copy(nose.position);
    wingGroup.add(noseWire);

    // Aerodynamic vortex rings
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xD70000,
      transparent: true,
      opacity: 0.1,
    });

    for (let i = 0; i < 2; i++) {
      const torusGeo = new THREE.TorusGeometry(1.8 + i * 0.4, 0.008, 8, 80);
      const torus = new THREE.Mesh(torusGeo, vortexMat);
      torus.position.set(0, 0, 0);
      torus.rotation.x = Math.PI / 2 + (i === 0 ? 0.1 : -0.1);
      torus.rotation.z = i * 0.3;
      wingGroup.add(torus);
    }

    // Position wing group
    wingGroup.position.set(0, 0, 0);
    wingGroup.rotation.x = 0.15;
    scene.add(wingGroup);

    state.scenes.frontWing = { renderer, scene, camera, wingGroup };

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function animateFrontWing(time) {
    const s = state.scenes.frontWing;
    if (!s) return;

    const g = s.wingGroup;

    // Slow rotation + mouse parallax
    g.rotation.y = lerp(g.rotation.y, state.mouse.nx * 0.25 + Math.sin(time * 0.2) * 0.05, 0.03);
    g.rotation.x = lerp(g.rotation.x, 0.15 + state.mouse.ny * 0.1, 0.03);

    // Gentle float
    g.position.y = Math.sin(time * 0.4) * 0.1;

    // Vortex ring animation (last two children are torus)
    const children = g.children;
    const ringStart = children.length - 2;
    for (let i = ringStart; i < children.length; i++) {
      if (children[i]) {
        children[i].rotation.z += 0.003 * (i === ringStart ? 1 : -1);
      }
    }

    // Fade out on scroll
    const fadeStart = window.innerHeight * 0.15;
    const fadeEnd = window.innerHeight * 0.7;
    const opacity = 1 - clamp((state.scroll.y - fadeStart) / (fadeEnd - fadeStart), 0, 1);

    g.children.forEach((c) => {
      if (c.material) {
        if (c.userData.baseOpacity === undefined) {
          c.userData.baseOpacity = c.material.opacity;
        }
        c.material.opacity = c.userData.baseOpacity * opacity;
      }
    });

    s.renderer.render(s.scene, s.camera);
  }

  // ═══════════════════════════════════════════════════════════
  // SCENE 3: Project Mini Scenes (Cards)
  // ═══════════════════════════════════════════════════════════
  function initProjectScenes() {
    // Spectrum VR — Floating Headset
    initProjectCanvas('spectrum-canvas', (scene) => {
      const group = new THREE.Group();

      // Headset body (rounded box approximation)
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 0.5, 2, 2, 2);
      const bodyMat = new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.5,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      // Wireframe
      const wireBody = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({
        color: 0xD70000,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      }));
      group.add(wireBody);

      // Lenses — two glowing circles
      const lensGeo = new THREE.CircleGeometry(0.15, 24);
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xD70000,
        transparent: true,
        opacity: 0.6,
      });
      const lensL = new THREE.Mesh(lensGeo, lensMat);
      lensL.position.set(-0.25, 0, 0.26);
      group.add(lensL);

      const lensR = new THREE.Mesh(lensGeo, lensMat);
      lensR.position.set(0.25, 0, 0.26);
      group.add(lensR);

      // Glow halos around lenses
      const glowGeo = new THREE.RingGeometry(0.15, 0.22, 24);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xD70000,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const glowL = new THREE.Mesh(glowGeo, glowMat);
      glowL.position.set(-0.25, 0, 0.27);
      group.add(glowL);

      const glowR = new THREE.Mesh(glowGeo, glowMat);
      glowR.position.set(0.25, 0, 0.27);
      group.add(glowR);

      // Strap
      const strapGeo = new THREE.TorusGeometry(0.7, 0.02, 8, 32, Math.PI);
      const strapMat = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.3,
      });
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.rotation.z = Math.PI;
      strap.position.set(0, 0.15, -0.1);
      group.add(strap);

      scene.add(group);
      return group;
    });

    // SmartTrace — Data Pulse in Pipe
    initProjectCanvas('smarttrace-canvas', (scene) => {
      const group = new THREE.Group();

      // Translucent pipe
      const pipeGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 16, 1, true);
      const pipeMat = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      });
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.rotation.z = Math.PI / 2; // Horizontal
      group.add(pipe);

      // Pipe wireframe
      const pipeWire = new THREE.Mesh(pipeGeo, new THREE.MeshBasicMaterial({
        color: 0x666666,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      }));
      pipeWire.rotation.z = Math.PI / 2;
      group.add(pipeWire);

      // Data pulse (glowing sphere that travels)
      const pulseGeo = new THREE.SphereGeometry(0.1, 16, 16);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0xD70000,
        transparent: true,
        opacity: 0.8,
      });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.userData.isPulse = true;
      group.add(pulse);

      // Pulse glow
      const pulseGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xD70000,
          transparent: true,
          opacity: 0.15,
        })
      );
      pulseGlow.userData.isPulse = true;
      group.add(pulseGlow);

      // Data trail particles along pipe
      const trailCount = 60;
      const trailGeo = new THREE.BufferGeometry();
      const trailPos = new Float32Array(trailCount * 3);
      for (let i = 0; i < trailCount; i++) {
        trailPos[i * 3] = (Math.random() - 0.5) * 2.5;
        trailPos[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
        trailPos[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      }
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      const trailMat = new THREE.PointsMaterial({
        color: 0xD70000,
        size: 0.02,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      const trail = new THREE.Points(trailGeo, trailMat);
      group.add(trail);

      scene.add(group);
      return group;
    });

    // Epoch Luxury — Watch Casing with Gears
    initProjectCanvas('epoch-canvas', (scene) => {
      const group = new THREE.Group();

      // Watch case (flat cylinder)
      const caseGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 32);
      const caseMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.3,
      });
      const watchCase = new THREE.Mesh(caseGeo, caseMat);
      watchCase.rotation.x = Math.PI / 2;
      group.add(watchCase);

      // Case wireframe
      const caseWire = new THREE.Mesh(caseGeo, new THREE.MeshBasicMaterial({
        color: 0xD70000,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      }));
      caseWire.rotation.x = Math.PI / 2;
      group.add(caseWire);

      // Watch face glass
      const glassGeo = new THREE.CircleGeometry(0.55, 32);
      const glassMat = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.4,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.z = 0.07;
      group.add(glass);

      // Hour markers
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const markerGeo = new THREE.BoxGeometry(0.02, 0.06, 0.01);
        const markerMat = new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xD70000 : 0x666666,
          transparent: true,
          opacity: 0.7,
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(
          Math.sin(angle) * 0.45,
          Math.cos(angle) * 0.45,
          0.07
        );
        marker.rotation.z = -angle;
        group.add(marker);
      }

      // Gear (torus with teeth)
      const gearGeo = new THREE.TorusGeometry(0.25, 0.02, 6, 24);
      const gearMat = new THREE.MeshBasicMaterial({
        color: 0xD70000,
        transparent: true,
        opacity: 0.25,
        wireframe: true,
      });
      const gear = new THREE.Mesh(gearGeo, gearMat);
      gear.position.set(0.1, -0.05, 0.06);
      gear.userData.isGear = true;
      group.add(gear);

      // Smaller gear
      const gear2Geo = new THREE.TorusGeometry(0.15, 0.015, 6, 18);
      const gear2 = new THREE.Mesh(gear2Geo, gearMat.clone());
      gear2.position.set(-0.15, 0.1, 0.06);
      gear2.userData.isGear = true;
      group.add(gear2);

      // Watch hands
      const handMat = new THREE.MeshBasicMaterial({
        color: 0xD70000,
        transparent: true,
        opacity: 0.6,
      });

      const hourHandGeo = new THREE.BoxGeometry(0.02, 0.25, 0.01);
      const hourHand = new THREE.Mesh(hourHandGeo, handMat);
      hourHand.position.set(0, 0.1, 0.08);
      hourHand.userData.isHand = true;
      hourHand.userData.speed = 0.1;
      group.add(hourHand);

      const minHandGeo = new THREE.BoxGeometry(0.015, 0.35, 0.01);
      const minHand = new THREE.Mesh(minHandGeo, handMat.clone());
      minHand.position.set(0, 0.15, 0.08);
      minHand.userData.isHand = true;
      minHand.userData.speed = 0.4;
      group.add(minHand);

      scene.add(group);
      return group;
    });
  }

  function initProjectCanvas(canvasId, buildScene) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const container = canvas.parentElement;
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 220;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 3;

    const group = buildScene(scene);

    state.scenes[canvasId] = { renderer, scene, camera, group };

    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    ro.observe(container);
  }

  function animateProjectScenes(time) {
    // Spectrum — floating headset
    const spec = state.scenes['spectrum-canvas'];
    if (spec && spec.group) {
      spec.group.rotation.y = Math.sin(time * 0.4) * 0.3;
      spec.group.rotation.x = Math.sin(time * 0.25) * 0.1;
      spec.group.position.y = Math.sin(time * 0.5) * 0.08;
      spec.renderer.render(spec.scene, spec.camera);
    }

    // SmartTrace — pulse traveling through pipe
    const st = state.scenes['smarttrace-canvas'];
    if (st && st.group) {
      st.group.rotation.y = Math.sin(time * 0.3) * 0.15;
      // Animate pulse along pipe
      st.group.children.forEach((child) => {
        if (child.userData.isPulse) {
          child.position.x = Math.sin(time * 1.5) * 1.1;
        }
      });
      st.renderer.render(st.scene, st.camera);
    }

    // Epoch — watch with rotating gears
    const ep = state.scenes['epoch-canvas'];
    if (ep && ep.group) {
      ep.group.rotation.y = Math.sin(time * 0.3) * 0.2;
      ep.group.rotation.x = Math.sin(time * 0.2) * 0.1 + 0.3;
      ep.group.children.forEach((child) => {
        if (child.userData.isGear) {
          child.rotation.z = time * 0.5;
        }
        if (child.userData.isHand) {
          child.rotation.z = -time * child.userData.speed;
        }
      });
      ep.renderer.render(ep.scene, ep.camera);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SCENE 4: Power Unit — Interactive 3D Engine
  // ═══════════════════════════════════════════════════════════
  function initPowerUnit() {
    const canvas = document.getElementById('engine-canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 6);

    const engineGroup = new THREE.Group();
    const clickableParts = [];

    // Materials
    const crimsonWire = new THREE.MeshBasicMaterial({
      color: 0xD70000,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });

    const carbonBody = new THREE.MeshBasicMaterial({
      color: 0x2A2A2A,
      transparent: true,
      opacity: 0.35,
    });

    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xD70000,
      transparent: true,
      opacity: 0.5,
    });

    // === ENGINE BLOCK (center) ===
    const blockGeo = new THREE.BoxGeometry(2, 1.2, 1.2, 2, 2, 2);
    const block = new THREE.Mesh(blockGeo, carbonBody);
    block.position.set(0, 0, 0);
    block.userData = {
      partName: 'ENGINE BLOCK',
      partDesc: 'Java · OOP · Data Structures · Spring Framework',
      partType: 'block',
    };
    engineGroup.add(block);
    clickableParts.push(block);

    const blockWire = new THREE.Mesh(blockGeo, crimsonWire);
    blockWire.position.copy(block.position);
    engineGroup.add(blockWire);

    // === PISTONS (top of block) ===
    for (let i = 0; i < 4; i++) {
      const pistonGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 12);
      const piston = new THREE.Mesh(pistonGeo, carbonBody.clone());
      piston.position.set(-0.7 + i * 0.47, 0.9, 0);
      piston.userData = {
        partName: 'PISTON V' + (i + 1),
        partDesc: 'Python · ML Pipelines · Automation · Data Science',
        partType: 'piston',
        animOffset: i * 0.5,
      };
      engineGroup.add(piston);
      clickableParts.push(piston);

      const pistonWire = new THREE.Mesh(pistonGeo, crimsonWire.clone());
      pistonWire.position.copy(piston.position);
      engineGroup.add(pistonWire);
    }

    // === TURBOCHARGER (right side) ===
    const turboGeo = new THREE.TorusGeometry(0.4, 0.12, 12, 32);
    const turbo = new THREE.Mesh(turboGeo, carbonBody.clone());
    turbo.position.set(1.6, 0.3, 0);
    turbo.rotation.y = Math.PI / 2;
    turbo.userData = {
      partName: 'TURBO',
      partDesc: 'TensorFlow · Neural Networks · Deep Learning · Computer Vision',
      partType: 'turbo',
    };
    engineGroup.add(turbo);
    clickableParts.push(turbo);

    const turboWire = new THREE.Mesh(turboGeo, crimsonWire.clone());
    turboWire.position.copy(turbo.position);
    turboWire.rotation.copy(turbo.rotation);
    engineGroup.add(turboWire);

    // Turbo intake pipe
    const intakeGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
    const intake = new THREE.Mesh(intakeGeo, carbonBody.clone());
    intake.position.set(2.1, 0.3, 0);
    intake.rotation.z = Math.PI / 2;
    engineGroup.add(intake);

    // === BATTERY PACK (left side) ===
    const batteryGeo = new THREE.BoxGeometry(0.6, 0.8, 0.8);
    const battery = new THREE.Mesh(batteryGeo, carbonBody.clone());
    battery.position.set(-1.6, -0.1, 0);
    battery.userData = {
      partName: 'BATTERY PACK',
      partDesc: 'Embedded Systems · Arduino · ESP32 · FPGA · Circuit Design',
      partType: 'battery',
    };
    engineGroup.add(battery);
    clickableParts.push(battery);

    const batteryWire = new THREE.Mesh(batteryGeo, crimsonWire.clone());
    batteryWire.position.copy(battery.position);
    engineGroup.add(batteryWire);

    // Battery cells (small boxes inside)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const cellGeo = new THREE.BoxGeometry(0.12, 0.2, 0.1);
        const cellMat = new THREE.MeshBasicMaterial({
          color: 0xD70000, transparent: true, opacity: 0.15,
        });
        const cell = new THREE.Mesh(cellGeo, cellMat);
        cell.position.set(
          -1.75 + c * 0.15,
          -0.2 + r * 0.35,
          0.35
        );
        engineGroup.add(cell);
      }
    }

    // === EXHAUST (rear) ===
    const exhaustGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.2, 12);
    const exhaust = new THREE.Mesh(exhaustGeo, carbonBody.clone());
    exhaust.position.set(0, 0.2, -1.2);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.userData = {
      partName: 'EXHAUST SYSTEM',
      partDesc: 'Unity · OpenXR · VR/AR · Spatial Computing · Immersive Design',
      partType: 'exhaust',
    };
    engineGroup.add(exhaust);
    clickableParts.push(exhaust);

    const exhaustWire = new THREE.Mesh(exhaustGeo, crimsonWire.clone());
    exhaustWire.position.copy(exhaust.position);
    exhaustWire.rotation.copy(exhaust.rotation);
    engineGroup.add(exhaustWire);

    // === GEARBOX (beneath) ===
    const gearboxGeo = new THREE.BoxGeometry(1.4, 0.5, 0.9, 2, 2, 2);
    const gearbox = new THREE.Mesh(gearboxGeo, carbonBody.clone());
    gearbox.position.set(0.3, -1, 0);
    gearbox.userData = {
      partName: 'GEARBOX',
      partDesc: 'MySQL · MongoDB · Firebase · Database Architecture',
      partType: 'gearbox',
    };
    engineGroup.add(gearbox);
    clickableParts.push(gearbox);

    const gearboxWire = new THREE.Mesh(gearboxGeo, crimsonWire.clone());
    gearboxWire.position.copy(gearbox.position);
    engineGroup.add(gearboxWire);

    // Gears inside gearbox
    for (let i = 0; i < 3; i++) {
      const gGeo = new THREE.TorusGeometry(0.12 + i * 0.05, 0.02, 6, 16);
      const gMat = new THREE.MeshBasicMaterial({
        color: 0xD70000, transparent: true, opacity: 0.2, wireframe: true,
      });
      const gear = new THREE.Mesh(gGeo, gMat);
      gear.position.set(-0.1 + i * 0.3, -1, 0.4);
      gear.userData.isGear = true;
      gear.userData.gearSpeed = 0.3 + i * 0.2;
      engineGroup.add(gear);
    }

    // === ECU (Electronic Control Unit — small box on top) ===
    const ecuGeo = new THREE.BoxGeometry(0.5, 0.25, 0.4);
    const ecu = new THREE.Mesh(ecuGeo, carbonBody.clone());
    ecu.position.set(0.8, 0.75, 0.5);
    ecu.userData = {
      partName: 'ECU',
      partDesc: 'HTML · CSS · JavaScript · Three.js · GSAP · Web Development',
      partType: 'ecu',
    };
    engineGroup.add(ecu);
    clickableParts.push(ecu);

    const ecuWire = new THREE.Mesh(ecuGeo, crimsonWire.clone());
    ecuWire.position.copy(ecu.position);
    engineGroup.add(ecuWire);

    // ECU indicator LED
    const ledGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({
      color: 0xD70000, transparent: true, opacity: 0.8,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0.8, 0.9, 0.65);
    led.userData.isLed = true;
    engineGroup.add(led);

    // Tilt engine slightly
    engineGroup.rotation.set(0.2, -0.5, 0);
    scene.add(engineGroup);

    // === Raycaster for click ===
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    const detailPanel = document.getElementById('engine-detail');
    const partNameEl = document.getElementById('engine-part-name');
    const partDescEl = document.getElementById('engine-part-desc');

    let activeHighlight = null;

    canvas.style.cursor = 'default';

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVec, camera);
      const intersects = raycaster.intersectObjects(clickableParts);

      if (intersects.length > 0) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVec, camera);
      const intersects = raycaster.intersectObjects(clickableParts);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const data = mesh.userData;

        // Spring animation
        gsap.to(mesh.scale, {
          x: 1.3, y: 1.3, z: 1.3,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: 'back.out(3)',
        });

        // Highlight
        if (activeHighlight) {
          activeHighlight.material.opacity = activeHighlight.userData._origOpacity || 0.35;
        }
        mesh.userData._origOpacity = mesh.userData._origOpacity || mesh.material.opacity;
        mesh.material.opacity = 0.6;
        mesh.material.color.set(0xD70000);
        activeHighlight = mesh;

        // Update panel
        partNameEl.textContent = data.partName;
        partDescEl.textContent = data.partDesc;
        detailPanel.classList.add('visible');

        // Auto-hide after 4s
        clearTimeout(detailPanel._hideTimer);
        detailPanel._hideTimer = setTimeout(() => {
          detailPanel.classList.remove('visible');
          if (activeHighlight) {
            activeHighlight.material.opacity = activeHighlight.userData._origOpacity || 0.35;
            activeHighlight.material.color.set(0x2A2A2A);
            activeHighlight = null;
          }
        }, 4000);
      }
    });

    state.scenes.engine = {
      renderer, scene, camera, engineGroup, clickableParts,
    };

    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    ro.observe(container);
  }

  function animatePowerUnit(time) {
    const s = state.scenes.engine;
    if (!s) return;

    // Slow auto-rotation
    s.engineGroup.rotation.y = -0.5 + Math.sin(time * 0.15) * 0.25;

    // Animate pistons (up/down)
    s.engineGroup.children.forEach((child) => {
      if (child.userData.partType === 'piston') {
        const offset = child.userData.animOffset || 0;
        child.position.y = 0.9 + Math.sin(time * 3 + offset) * 0.12;
      }
      if (child.userData.partType === 'turbo') {
        child.rotation.x += 0.02;
      }
      if (child.userData.isGear) {
        child.rotation.z = time * (child.userData.gearSpeed || 0.3);
      }
      if (child.userData.isLed) {
        child.material.opacity = 0.4 + Math.sin(time * 4) * 0.4;
      }
    });

    s.renderer.render(s.scene, s.camera);
  }

  // ═══════════════════════════════════════════════════════════
  // Project Card 3D Tilt
  // ═══════════════════════════════════════════════════════════
  function initProjectCardTilt() {
    const cards = document.querySelectorAll('.perf-module');
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6;
        const rotateY = ((x - centerX) / centerX) * 6;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GSAP Scroll Animations
  // ═══════════════════════════════════════════════════════════
  function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // Nav visibility
    ScrollTrigger.create({
      trigger: '#telemetry',
      start: 'top 80%',
      onEnter: () => document.getElementById('main-nav').classList.add('visible'),
      onLeaveBack: () => document.getElementById('main-nav').classList.remove('visible'),
    });

    // Hero entrance with spring-bounce feel
    const heroTl = gsap.timeline({ delay: 0.3 });
    heroTl
      .to('.hero-tag', {
        opacity: 1, y: 0, duration: 0.7,
        ease: 'back.out(1.2)',
      })
      .to('.hero-title', {
        opacity: 1, y: 0, duration: 0.9,
        ease: 'back.out(1.4)',
      }, '-=0.35')
      .to('.hero-subtitle', {
        opacity: 1, y: 0, duration: 0.7,
        ease: 'back.out(1.2)',
      }, '-=0.4')
      .to('.hero-ctas', {
        opacity: 1, y: 0, duration: 0.6,
        ease: 'back.out(1.5)',
      }, '-=0.3')
      .to('.scroll-prompt', {
        opacity: 1, y: 0, duration: 0.5,
        ease: 'power3.out',
      }, '-=0.2');

    // General reveals with spring ease
    const reveals = document.querySelectorAll(
      '.reveal:not(.hero-tag):not(.hero-title):not(.hero-subtitle):not(.hero-ctas):not(.scroll-prompt)'
    );
    reveals.forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'back.out(1.2)',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            end: 'top 60%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    // Performance modules stagger with motion blur effect
    gsap.fromTo('.perf-module',
      { opacity: 0, y: 50, scale: 0.96, filter: 'blur(4px)' },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.65,
        stagger: 0.18,
        ease: 'back.out(1.3)',
        scrollTrigger: {
          trigger: '.performance-modules',
          start: 'top 80%',
        },
      }
    );

    // Tech spec cards stagger
    gsap.fromTo('.tech-spec-card',
      { opacity: 0, y: 25, scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.08,
        ease: 'back.out(1.2)',
        scrollTrigger: {
          trigger: '#tech-specs-grid',
          start: 'top 88%',
        },
      }
    );

    // Telemetry bars animation
    ScrollTrigger.create({
      trigger: '#driver-stats-panel',
      start: 'top 75%',
      onEnter: () => animateTelemetryBars(),
      once: true,
    });
  }

  // ─── Telemetry Bars ─────────────────────────────────────
  function animateTelemetryBars() {
    const bars = document.querySelectorAll('.telemetry-bar-fill');
    const values = document.querySelectorAll('.telemetry-bar-value');

    bars.forEach((bar, i) => {
      const targetWidth = bar.dataset.width || 0;
      setTimeout(() => {
        bar.style.width = targetWidth + '%';
      }, i * 150);
    });

    values.forEach((val, i) => {
      const target = parseInt(val.dataset.value) || 0;
      const obj = { current: 0 };
      setTimeout(() => {
        gsap.to(obj, {
          current: target,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => {
            val.textContent = Math.round(obj.current) + '%';
          },
        });
      }, i * 150);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Scroll-to-Deploy prompt
  // ═══════════════════════════════════════════════════════════
  function initScrollPrompt() {
    const prompt = document.getElementById('scroll-prompt');
    if (prompt) {
      prompt.addEventListener('click', () => {
        const telemetry = document.getElementById('telemetry');
        if (telemetry) {
          if (lenis) {
            lenis.scrollTo(telemetry);
          } else {
            telemetry.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // Ghost button smooth scroll
    document.querySelectorAll('.btn-ghost').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const href = btn.getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
          if (lenis) {
            lenis.scrollTo(target);
          } else {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Contact Form Interaction
  // ═══════════════════════════════════════════════════════════
  function initContactForm() {
    const form = document.getElementById('contact-form');
    const btn = document.getElementById('btn-transmit');
    if (form && btn) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        btn.textContent = '✓ TRANSMITTED';
        btn.style.borderColor = '#34D399';
        btn.style.color = '#34D399';
        btn.style.boxShadow = '0 0 30px rgba(52, 211, 153, 0.3)';
        setTimeout(() => {
          btn.textContent = 'Transmit';
          btn.style.borderColor = '';
          btn.style.color = '';
          btn.style.boxShadow = '';
          form.reset();
        }, 2500);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Main Animation Loop
  // ═══════════════════════════════════════════════════════════
  let clock;
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    animateWindTunnel();
    animateFrontWing(time);
    animateProjectScenes(time);
    animatePowerUnit(time);
  }

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════
  function init() {
    clock = new THREE.Clock();

    // Initialize all 3D scenes
    initWindTunnel();
    initFrontWing();
    initProjectScenes();
    initPowerUnit();

    // UI
    initNav();
    initProjectCardTilt();
    initContactForm();
    initScrollPrompt();

    // Start animation loop
    animate();

    // Init GSAP + Lenis after short delay
    setTimeout(() => {
      initLenis();
      initScrollAnimations();

      // Hide loader
      const loader = document.getElementById('loader');
      if (loader) loader.classList.add('hidden');
      state.loaded = true;
    }, 1000);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
