import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Atmosphere3dMode } from '../types/ide';
import { ThemeId } from '../services/themes';

export type AtmospherePhaseKey =
  | 'bg3d_phase_dawn'
  | 'bg3d_phase_noon'
  | 'bg3d_phase_sunset'
  | 'bg3d_phase_evening'
  | 'bg3d_phase_night';

export type AtmosphereEffectKind = 'petals' | 'snow' | 'rain' | 'starlight';

export interface ActiveAtmosphereState {
  phaseKey: AtmospherePhaseKey;
  activeEffect: AtmosphereEffectKind;
  hour: number;
  phaseTintHex: string;
}

export function getActiveAtmosphereState(
  mode: Atmosphere3dMode = 'auto',
  date: Date = new Date()
): ActiveAtmosphereState {
  const hour = date.getHours();
  let phaseKey: AtmospherePhaseKey;
  let naturalEffect: AtmosphereEffectKind;
  let phaseTintHex: string;

  if (hour >= 5 && hour < 11) {
    phaseKey = 'bg3d_phase_dawn';
    naturalEffect = 'petals';
    phaseTintHex = '#ffb7d5';
  } else if (hour >= 11 && hour < 15) {
    phaseKey = 'bg3d_phase_noon';
    naturalEffect = 'rain';
    phaseTintHex = '#e6c8f5';
  } else if (hour >= 15 && hour < 19) {
    phaseKey = 'bg3d_phase_sunset';
    naturalEffect = 'petals';
    phaseTintHex = '#f9a8d4';
  } else if (hour >= 19 && hour < 22) {
    phaseKey = 'bg3d_phase_evening';
    naturalEffect = 'rain';
    phaseTintHex = '#c084fc';
  } else {
    phaseKey = 'bg3d_phase_night';
    naturalEffect = 'snow';
    phaseTintHex = '#d8b4fe';
  }

  return {
    phaseKey,
    activeEffect: mode === 'auto' ? naturalEffect : mode,
    hour,
    phaseTintHex,
  };
}

interface DynamicAtmosphere3DProps {
  enabled: boolean;
  mode: Atmosphere3dMode;
  themeId: ThemeId;
  isDarkTheme: boolean;
  accentHex: string;
  bgHex: string;
}

function createCuppedSakuraPetalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Notched sakura petal silhouette centered near origin
  shape.moveTo(0, -0.22);
  shape.bezierCurveTo(-0.13, -0.14, -0.19, 0.04, -0.12, 0.18);
  shape.bezierCurveTo(-0.07, 0.24, -0.025, 0.21, 0, 0.145);
  shape.bezierCurveTo(0.025, 0.21, 0.07, 0.24, 0.12, 0.18);
  shape.bezierCurveTo(0.19, 0.04, 0.13, -0.14, 0, -0.22);

  const geo = new THREE.ShapeGeometry(shape, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Gentle 3D bowl curvature + curled tip
    const cupZ = 0.045 * Math.cos((x / 0.18) * 1.4) - 0.055 * (y * y * 8.0);
    pos.setZ(i, cupZ);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createSnowCrystalTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);

    // Soft outer halo
    const grad = ctx.createRadialGradient(c, c, 2, c, c, c - 4);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.32, 'rgba(255, 232, 246, 0.65)');
    grad.addColorStop(0.7, 'rgba(244, 212, 255, 0.18)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();

    // 6-arm crystalline star filament
    ctx.save();
    ctx.translate(c, c);
    ctx.strokeStyle = 'rgba(255, 250, 255, 0.95)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -c * 0.72);
      ctx.stroke();

      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -c * 0.34);
      ctx.lineTo(-c * 0.15, -c * 0.49);
      ctx.moveTo(0, -c * 0.34);
      ctx.lineTo(c * 0.15, -c * 0.49);
      ctx.moveTo(0, -c * 0.54);
      ctx.lineTo(-c * 0.1, -c * 0.64);
      ctx.moveTo(0, -c * 0.54);
      ctx.lineTo(c * 0.1, -c * 0.64);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 224, 244, 0.78)');
    grad.addColorStop(0.65, 'rgba(244, 180, 232, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const SKY_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uBgColor;
  uniform vec3 uAccentColor;
  uniform vec3 uPhaseColor;
  uniform float uIsDark;
  varying vec2 vUv;

  float ribbonWave(vec2 uv, float freq, float speed, float offset) {
    float wave = sin(uv.x * freq + uTime * speed + offset) * 0.11
               + cos(uv.x * (freq * 0.55) - uTime * (speed * 0.7) + offset * 1.7) * 0.08;
    float band = 1.0 - smoothstep(0.0, 0.36, abs(uv.y - (0.52 + wave)));
    return band * band;
  }

  void main() {
    vec2 uv = vUv;
    float gradY = smoothstep(0.0, 1.0, uv.y);

    // Delicate top-to-bottom feminine silk gradient anchored to active theme background
    vec3 topTint = mix(uBgColor, mix(uPhaseColor, uAccentColor, 0.42), uIsDark > 0.5 ? 0.34 : 0.24);
    vec3 bottomTint = mix(uBgColor, uAccentColor, uIsDark > 0.5 ? 0.16 : 0.11);
    vec3 col = mix(bottomTint, topTint, gradY);

    // Two drifting pastel aurora ribbons
    float r1 = ribbonWave(uv, 3.4, 0.22, 0.4);
    float r2 = ribbonWave(vec2(uv.x + 0.35, 1.0 - uv.y * 0.85), 2.7, -0.17, 2.1);

    float ribbonStrength = uIsDark > 0.5 ? 0.24 : 0.18;
    col = mix(col, mix(uAccentColor, uPhaseColor, 0.5), r1 * ribbonStrength);
    col = mix(col, uPhaseColor, r2 * (ribbonStrength * 0.85));

    // Soft radial moon/rose glow in the upper right quadrant
    float glowDist = length(uv - vec2(0.76, 0.78));
    float halo = exp(-glowDist * glowDist * 5.2);
    col += mix(uPhaseColor, vec3(1.0, 0.92, 0.97), 0.45) * halo * (uIsDark > 0.5 ? 0.16 : 0.14);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const DynamicAtmosphere3D: React.FC<DynamicAtmosphere3DProps> = ({
  enabled,
  mode,
  themeId,
  isDarkTheme,
  accentHex,
  bgHex,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Live theme / mode refs so WebGL context stays alive across theme or mode switches
  const livePropsRef = useRef({
    mode,
    themeId,
    isDarkTheme,
    accentHex,
    bgHex,
  });
  livePropsRef.current = { mode, themeId, isDarkTheme, accentHex, bgHex };

  useEffect(() => {
    if (!enabled) {
      setWebglUnavailable(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Probe WebGL support and detect software rasterizer cleanly
    let probeCanvas: HTMLCanvasElement | null = document.createElement('canvas');
    let glProbe: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      glProbe =
        probeCanvas.getContext('webgl2', { powerPreference: 'low-power' }) ||
        probeCanvas.getContext('webgl', { powerPreference: 'low-power' });
    } catch {
      glProbe = null;
    }
    if (!glProbe) {
      setWebglUnavailable(true);
      probeCanvas = null;
      return;
    }

    let isSoftwareGl = false;
    try {
      const dbg = glProbe.getExtension('WEBGL_debug_renderer_info');
      const rendererName = dbg
        ? String(glProbe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
        : '';
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
    } catch {
      isSoftwareGl = false;
    }
    // Release probe reference before creating the real renderer
    glProbe = null;
    probeCanvas = null;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);
    const width = container.clientWidth || window.innerWidth || 360;
    const height = container.clientHeight || window.innerHeight || 640;

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 45);
    camera.position.set(0, 0, 9.5);

    // Subtle PBR environment for glossy sakura petals
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.55;
    roomEnv.dispose();

    // Soft feminine studio lighting for petals
    const hemiLight = new THREE.HemisphereLight(0xffeaf6, 0x8b5cf6, 0.9);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xfff1f5, 1.35);
    keyLight.position.set(4, 6, 7);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe879f9, 0.55);
    rimLight.position.set(-5, -2, 4);
    scene.add(rimLight);

    // 1. Custom GLSL Feminine Aurora Sky Dome
    const skyUniforms = {
      uTime: { value: 0 },
      uBgColor: { value: new THREE.Color(bgHex) },
      uAccentColor: { value: new THREE.Color(accentHex) },
      uPhaseColor: { value: new THREE.Color(getActiveAtmosphereState(mode).phaseTintHex) },
      uIsDark: { value: isDarkTheme ? 1.0 : 0.0 },
    };
    const skyGeo = new THREE.PlaneGeometry(46, 30);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: skyUniforms,
      depthWrite: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 0, -11);
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    // 2. Cupped 3D Sakura Petals (InstancedMesh)
    const PETAL_COUNT = 64;
    const petalGeo = createCuppedSakuraPetalGeometry();
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.06,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_COUNT);
    petalMesh.frustumCulled = false;

    const petalPalette = [
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#f9a8d4'),
      new THREE.Color('#fda4af'),
      new THREE.Color('#ffe4e6'),
      new THREE.Color('#f5d0fe'),
      new THREE.Color('#fff1f2'),
    ];

    const petalX = new Float32Array(PETAL_COUNT);
    const petalY = new Float32Array(PETAL_COUNT);
    const petalZ = new Float32Array(PETAL_COUNT);
    const petalFallSpeed = new Float32Array(PETAL_COUNT);
    const petalDriftAmp = new Float32Array(PETAL_COUNT);
    const petalPhase = new Float32Array(PETAL_COUNT);
    const petalRotX = new Float32Array(PETAL_COUNT);
    const petalRotY = new Float32Array(PETAL_COUNT);
    const petalRotZ = new Float32Array(PETAL_COUNT);
    const petalSpinX = new Float32Array(PETAL_COUNT);
    const petalSpinY = new Float32Array(PETAL_COUNT);
    const petalScale = new Float32Array(PETAL_COUNT);

    for (let i = 0; i < PETAL_COUNT; i++) {
      petalX[i] = (Math.random() - 0.5) * 16;
      petalY[i] = (Math.random() - 0.5) * 13;
      petalZ[i] = (Math.random() - 0.5) * 6.5;
      petalFallSpeed[i] = 0.55 + Math.random() * 0.65;
      petalDriftAmp[i] = 0.25 + Math.random() * 0.55;
      petalPhase[i] = Math.random() * Math.PI * 2;
      petalRotX[i] = Math.random() * Math.PI * 2;
      petalRotY[i] = Math.random() * Math.PI * 2;
      petalRotZ[i] = Math.random() * Math.PI * 2;
      petalSpinX[i] = (Math.random() - 0.5) * 1.4;
      petalSpinY[i] = (Math.random() - 0.5) * 1.8;
      petalScale[i] = 0.58 + Math.random() * 0.62;
      petalMesh.setColorAt(i, petalPalette[i % petalPalette.length]);
    }
    if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
    scene.add(petalMesh);

    // 3. Crystalline Feminine Snowflakes (InstancedMesh + Bokeh Points)
    const SNOW_CRYSTAL_COUNT = 72;
    const snowTex = createSnowCrystalTexture();
    const snowGeo = new THREE.PlaneGeometry(0.32, 0.32);
    const snowMat = new THREE.MeshBasicMaterial({
      map: snowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, SNOW_CRYSTAL_COUNT);
    snowMesh.frustumCulled = false;

    const snowPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#fce7f3'),
      new THREE.Color('#f3e8ff'),
      new THREE.Color('#fdf2f8'),
    ];
    const snowX = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowY = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowZ = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowSpeed = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowPhase = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowSpin = new Float32Array(SNOW_CRYSTAL_COUNT);
    const snowScale = new Float32Array(SNOW_CRYSTAL_COUNT);

    for (let i = 0; i < SNOW_CRYSTAL_COUNT; i++) {
      snowX[i] = (Math.random() - 0.5) * 16;
      snowY[i] = (Math.random() - 0.5) * 13;
      snowZ[i] = (Math.random() - 0.5) * 7.0;
      snowSpeed[i] = 0.45 + Math.random() * 0.7;
      snowPhase[i] = Math.random() * Math.PI * 2;
      snowSpin[i] = (Math.random() - 0.5) * 0.9;
      snowScale[i] = 0.55 + Math.random() * 0.95;
      snowMesh.setColorAt(i, snowPalette[i % snowPalette.length]);
    }
    if (snowMesh.instanceColor) snowMesh.instanceColor.needsUpdate = true;
    scene.add(snowMesh);

    // 4. Pastel Rain Streaks + Expanding Water Ripples
    const RAIN_COUNT = 88;
    const rainGeo = new THREE.CylinderGeometry(0.005, 0.014, 0.62, 6);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
    rainMesh.frustumCulled = false;

    const rainPalette = [
      new THREE.Color('#f5d0fe'),
      new THREE.Color('#e0e7ff'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#ddd6fe'),
    ];
    const rainX = new Float32Array(RAIN_COUNT);
    const rainY = new Float32Array(RAIN_COUNT);
    const rainZ = new Float32Array(RAIN_COUNT);
    const rainSpeed = new Float32Array(RAIN_COUNT);
    const rainScale = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      rainX[i] = (Math.random() - 0.5) * 17;
      rainY[i] = (Math.random() - 0.5) * 14;
      rainZ[i] = (Math.random() - 0.5) * 6.5;
      rainSpeed[i] = 6.2 + Math.random() * 4.5;
      rainScale[i] = 0.75 + Math.random() * 0.65;
      rainMesh.setColorAt(i, rainPalette[i % rainPalette.length]);
    }
    if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
    scene.add(rainMesh);

    const RIPPLE_COUNT = 24;
    const rippleGeo = new THREE.RingGeometry(0.16, 0.195, 28);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rippleMesh = new THREE.InstancedMesh(rippleGeo, rippleMat, RIPPLE_COUNT);
    rippleMesh.frustumCulled = false;

    const rippleX = new Float32Array(RIPPLE_COUNT);
    const rippleY = new Float32Array(RIPPLE_COUNT);
    const rippleZ = new Float32Array(RIPPLE_COUNT);
    const rippleAge = new Float32Array(RIPPLE_COUNT);
    const rippleLife = new Float32Array(RIPPLE_COUNT);

    for (let i = 0; i < RIPPLE_COUNT; i++) {
      rippleX[i] = (Math.random() - 0.5) * 12;
      rippleY[i] = -3.4 - Math.random() * 1.9;
      rippleZ[i] = (Math.random() - 0.5) * 5.0;
      rippleLife[i] = 1.4 + Math.random() * 1.1;
      rippleAge[i] = Math.random() * rippleLife[i];
      rippleMesh.setColorAt(i, rainPalette[i % rainPalette.length]);
    }
    if (rippleMesh.instanceColor) rippleMesh.instanceColor.needsUpdate = true;
    scene.add(rippleMesh);

    // 5. Rose-Gold Stardust & Fireflies (Points)
    const STAR_COUNT = 56;
    const glowTex = createSoftGlowTexture();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starBaseX = new Float32Array(STAR_COUNT);
    const starBaseY = new Float32Array(STAR_COUNT);
    const starBaseZ = new Float32Array(STAR_COUNT);
    const starPhase = new Float32Array(STAR_COUNT);
    const starSpeed = new Float32Array(STAR_COUNT);

    const starPalette = [
      new THREE.Color('#fde68a'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#f5d0fe'),
      new THREE.Color('#fda4af'),
    ];
    for (let i = 0; i < STAR_COUNT; i++) {
      starBaseX[i] = (Math.random() - 0.5) * 14.5;
      starBaseY[i] = (Math.random() - 0.5) * 11.5;
      starBaseZ[i] = (Math.random() - 0.5) * 5.5;
      starPhase[i] = Math.random() * Math.PI * 2;
      starSpeed[i] = 0.45 + Math.random() * 0.75;

      starPositions[i * 3] = starBaseX[i];
      starPositions[i * 3 + 1] = starBaseY[i];
      starPositions[i * 3 + 2] = starBaseZ[i];

      const sc = starPalette[i % starPalette.length];
      starColors[i * 3] = sc.r;
      starColors[i * 3 + 1] = sc.g;
      starColors[i * 3 + 2] = sc.b;
    }

    const starGeo = new THREE.BufferGeometry();
    const starPosAttr = new THREE.BufferAttribute(starPositions, 3);
    starGeo.setAttribute('position', starPosAttr);
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      map: glowTex,
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.frustumCulled = false;
    scene.add(starPoints);

    // Pre-allocated scratch math objects (zero allocations in frame loop)
    const dummy = new THREE.Object3D();
    const targetBg = new THREE.Color(bgHex);
    const targetAccent = new THREE.Color(accentHex);
    const targetPhase = new THREE.Color(getActiveAtmosphereState(mode).phaseTintHex);

    // Smoothly damped layer weights
    let wPetals = 0;
    let wSnow = 0;
    let wRain = 0;
    let wStars = 0.25;

    let elapsed = 0;
    let lastNow = performance.now();
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;

    const handleResize = () => {
      if (disposed || !container) return;
      const w = container.clientWidth || window.innerWidth || 360;
      const h = container.clientHeight || window.innerHeight || 640;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const scheduleNextFrame = () => {
      if (disposed || document.hidden) return;
      if (isSoftwareGl) {
        timeoutId = window.setTimeout(() => {
          rafId = requestAnimationFrame(tick);
        }, 34);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      elapsed += dt;

      const {
        mode: curMode,
        isDarkTheme: curDark,
        accentHex: curAccent,
        bgHex: curBg,
      } = livePropsRef.current;

      const state = getActiveAtmosphereState(curMode);

      // Update sky uniforms cleanly without rebuilding shader
      targetBg.set(curBg);
      targetAccent.set(curAccent);
      targetPhase.set(state.phaseTintHex);
      skyUniforms.uTime.value = elapsed;
      skyUniforms.uBgColor.value.lerp(targetBg, Math.min(1, dt * 4));
      skyUniforms.uAccentColor.value.lerp(targetAccent, Math.min(1, dt * 4));
      skyUniforms.uPhaseColor.value.lerp(targetPhase, Math.min(1, dt * 3));
      skyUniforms.uIsDark.value = THREE.MathUtils.damp(
        skyUniforms.uIsDark.value,
        curDark ? 1.0 : 0.0,
        4.5,
        dt
      );

      // Smooth crossfade weights between atmospheric modes
      const tgtPetals = state.activeEffect === 'petals' ? 1.0 : 0.0;
      const tgtSnow = state.activeEffect === 'snow' ? 1.0 : 0.0;
      const tgtRain = state.activeEffect === 'rain' ? 1.0 : 0.0;
      const tgtStars = state.activeEffect === 'starlight' ? 1.0 : curDark ? 0.38 : 0.22;

      wPetals = THREE.MathUtils.damp(wPetals, tgtPetals, 2.8, dt);
      wSnow = THREE.MathUtils.damp(wSnow, tgtSnow, 2.8, dt);
      wRain = THREE.MathUtils.damp(wRain, tgtRain, 3.2, dt);
      wStars = THREE.MathUtils.damp(wStars, tgtStars, 2.6, dt);

      // Keep opacity high enough on light themes without overwhelming editor text
      const themeAlphaFactor = curDark ? 1.0 : 0.78;

      // Update Petals
      petalMesh.visible = wPetals > 0.015;
      if (petalMesh.visible) {
        petalMat.opacity = 0.9 * wPetals * themeAlphaFactor;
        const windX = Math.sin(elapsed * 0.35) * 0.45 + 0.22;
        for (let i = 0; i < PETAL_COUNT; i++) {
          petalY[i] -= petalFallSpeed[i] * dt;
          petalX[i] += (windX + Math.sin(elapsed * 0.95 + petalPhase[i]) * petalDriftAmp[i]) * dt;
          if (petalY[i] < -6.6) {
            petalY[i] = 6.6;
            petalX[i] = (Math.random() - 0.5) * 16;
          }
          if (petalX[i] > 8.6) petalX[i] = -8.6;
          if (petalX[i] < -8.6) petalX[i] = 8.6;

          petalRotX[i] += petalSpinX[i] * dt;
          petalRotY[i] += petalSpinY[i] * dt;
          petalRotZ[i] += Math.sin(elapsed + petalPhase[i]) * 0.65 * dt;

          const s = petalScale[i] * (0.45 + 0.55 * wPetals);
          dummy.position.set(petalX[i], petalY[i], petalZ[i]);
          dummy.rotation.set(petalRotX[i], petalRotY[i], petalRotZ[i]);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          petalMesh.setMatrixAt(i, dummy.matrix);
        }
        petalMesh.instanceMatrix.needsUpdate = true;
      }

      // Update Snowflakes
      snowMesh.visible = wSnow > 0.015;
      if (snowMesh.visible) {
        snowMat.opacity = (curDark ? 0.88 : 0.76) * wSnow;
        for (let i = 0; i < SNOW_CRYSTAL_COUNT; i++) {
          snowY[i] -= snowSpeed[i] * dt;
          snowX[i] += Math.sin(elapsed * 0.65 + snowPhase[i]) * 0.36 * dt;
          if (snowY[i] < -6.6) {
            snowY[i] = 6.6;
            snowX[i] = (Math.random() - 0.5) * 16;
          }

          const s = snowScale[i] * (0.4 + 0.6 * wSnow);
          dummy.position.set(snowX[i], snowY[i], snowZ[i]);
          dummy.rotation.set(0, 0, elapsed * snowSpin[i] + snowPhase[i]);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          snowMesh.setMatrixAt(i, dummy.matrix);
        }
        snowMesh.instanceMatrix.needsUpdate = true;
      }

      // Update Rain & Ripples
      const rainActive = wRain > 0.015;
      rainMesh.visible = rainActive;
      rippleMesh.visible = rainActive;
      if (rainActive) {
        rainMat.opacity = (curDark ? 0.62 : 0.45) * wRain;
        const slant = -0.15;
        for (let i = 0; i < RAIN_COUNT; i++) {
          rainY[i] -= rainSpeed[i] * dt;
          rainX[i] += slant * rainSpeed[i] * dt;
          if (rainY[i] < -6.8) {
            rainY[i] = 6.8;
            rainX[i] = (Math.random() - 0.5) * 17;
          }
          if (rainX[i] < -9.0) rainX[i] = 9.0;

          const s = rainScale[i] * wRain;
          dummy.position.set(rainX[i], rainY[i], rainZ[i]);
          dummy.rotation.set(0, 0, slant);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          rainMesh.setMatrixAt(i, dummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;

        rippleMat.opacity = (curDark ? 0.42 : 0.3) * wRain;
        for (let i = 0; i < RIPPLE_COUNT; i++) {
          rippleAge[i] += dt;
          if (rippleAge[i] >= rippleLife[i]) {
            rippleAge[i] = 0;
            rippleX[i] = (Math.random() - 0.5) * 12;
            rippleY[i] = -3.4 - Math.random() * 1.9;
            rippleZ[i] = (Math.random() - 0.5) * 5.0;
          }
          const progress = rippleAge[i] / rippleLife[i];
          const ringScale = (0.25 + progress * 1.8) * (1.0 - progress * 0.15) * wRain;
          dummy.position.set(rippleX[i], rippleY[i], rippleZ[i]);
          dummy.rotation.set(-Math.PI / 2.25, 0, 0);
          dummy.scale.set(ringScale, ringScale, ringScale);
          dummy.updateMatrix();
          rippleMesh.setMatrixAt(i, dummy.matrix);
        }
        rippleMesh.instanceMatrix.needsUpdate = true;
      }

      // Update Rose-Gold Stardust / Fireflies
      starMat.opacity = (curDark ? 0.85 : 0.58) * wStars;
      starMat.size = 0.28 + 0.14 * wStars + Math.sin(elapsed * 1.8) * 0.025;
      for (let i = 0; i < STAR_COUNT; i++) {
        const p = starPhase[i];
        const sp = starSpeed[i];
        starPositions[i * 3] = starBaseX[i] + Math.sin(elapsed * sp + p) * 0.55;
        starPositions[i * 3 + 1] = starBaseY[i] + Math.cos(elapsed * sp * 0.8 + p) * 0.48;
        starPositions[i * 3 + 2] = starBaseZ[i] + Math.sin(elapsed * 0.45 + p) * 0.35;
      }
      starPosAttr.needsUpdate = true;

      // Subtle breathing camera sway
      camera.position.x = Math.sin(elapsed * 0.16) * 0.22;
      camera.position.y = Math.cos(elapsed * 0.13) * 0.16;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      scheduleNextFrame();
    };

    const handleVisibility = () => {
      if (disposed) return;
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        clearTimeout(timeoutId);
      } else {
        lastNow = performance.now();
        scheduleNextFrame();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    scheduleNextFrame();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);

      skyGeo.dispose();
      skyMat.dispose();
      petalGeo.dispose();
      petalMat.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      snowTex.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      rippleGeo.dispose();
      rippleMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      glowTex.dispose();
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // Only re-initialize WebGL pipeline when enabled flag toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  if (webglUnavailable) {
    const phaseTint = getActiveAtmosphereState(mode).phaseTintHex;
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none transition-colors duration-700"
        style={{
          background: `radial-gradient(circle at 78% 18%, ${phaseTint}33 0%, transparent 52%), radial-gradient(circle at 20% 80%, ${accentHex}24 0%, transparent 55%), ${bgHex}`,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    />
  );
};
