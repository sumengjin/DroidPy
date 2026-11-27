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

export type AtmosphereSeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export type AtmosphereSeasonKey =
  | 'bg3d_season_spring'
  | 'bg3d_season_summer'
  | 'bg3d_season_autumn'
  | 'bg3d_season_winter';

export type AtmosphereEffectKind = 'petals' | 'snow' | 'rain' | 'starlight';

export interface ActiveAtmosphereState {
  phaseKey: AtmospherePhaseKey;
  season: AtmosphereSeasonId;
  seasonKey: AtmosphereSeasonKey;
  activeEffect: AtmosphereEffectKind;
  hour: number;
  solarProgress: number; // 0..24 fractional hour
  phaseTintHex: string;
}

export function getSeasonForDate(date: Date = new Date()): {
  season: AtmosphereSeasonId;
  seasonKey: AtmosphereSeasonKey;
} {
  const m = date.getMonth(); // 0 = Jan .. 11 = Dec
  if (m >= 2 && m <= 4) {
    return { season: 'spring', seasonKey: 'bg3d_season_spring' };
  }
  if (m >= 5 && m <= 7) {
    return { season: 'summer', seasonKey: 'bg3d_season_summer' };
  }
  if (m >= 8 && m <= 10) {
    return { season: 'autumn', seasonKey: 'bg3d_season_autumn' };
  }
  return { season: 'winter', seasonKey: 'bg3d_season_winter' };
}

export function getActiveAtmosphereState(
  mode: Atmosphere3dMode = 'auto',
  date: Date = new Date()
): ActiveAtmosphereState {
  const hour = date.getHours();
  const solarProgress = hour + date.getMinutes() / 60;
  const { season, seasonKey } = getSeasonForDate(date);

  let phaseKey: AtmospherePhaseKey;
  let naturalEffect: AtmosphereEffectKind;
  let phaseTintHex: string;

  if (hour >= 5 && hour < 10) {
    phaseKey = 'bg3d_phase_dawn';
    phaseTintHex = season === 'autumn' ? '#fdba74' : season === 'winter' ? '#e0e7ff' : '#fbcfe8';
    naturalEffect = season === 'winter' ? 'snow' : 'petals';
  } else if (hour >= 10 && hour < 16) {
    phaseKey = 'bg3d_phase_noon';
    phaseTintHex = season === 'autumn' ? '#fbbf24' : season === 'winter' ? '#bae6fd' : '#e0f2fe';
    naturalEffect =
      season === 'summer'
        ? 'rain'
        : season === 'winter'
        ? 'snow'
        : 'petals';
  } else if (hour >= 16 && hour < 19) {
    phaseKey = 'bg3d_phase_sunset';
    phaseTintHex = '#e9a8d8';
    naturalEffect = season === 'winter' ? 'snow' : 'petals';
  } else if (hour >= 19 && hour < 22) {
    phaseKey = 'bg3d_phase_evening';
    phaseTintHex = season === 'summer' ? '#a5b4fc' : '#c084fc';
    naturalEffect =
      season === 'winter'
        ? 'snow'
        : season === 'autumn' || season === 'summer'
        ? 'rain'
        : 'starlight';
  } else {
    phaseKey = 'bg3d_phase_night';
    phaseTintHex = season === 'winter' ? '#c7d2fe' : '#a78bfa';
    naturalEffect = season === 'winter' ? 'snow' : 'starlight';
  }

  return {
    phaseKey,
    season,
    seasonKey,
    activeEffect: mode === 'auto' ? naturalEffect : mode,
    hour,
    solarProgress,
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
  shape.moveTo(0, -0.22);
  shape.bezierCurveTo(-0.135, -0.14, -0.195, 0.04, -0.125, 0.185);
  shape.bezierCurveTo(-0.075, 0.24, -0.025, 0.21, 0, 0.14);
  shape.bezierCurveTo(0.025, 0.21, 0.075, 0.24, 0.125, 0.185);
  shape.bezierCurveTo(0.195, 0.04, 0.135, -0.14, 0, -0.22);

  const geo = new THREE.ShapeGeometry(shape, 12);
  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const cupZ = 0.048 * Math.cos((x / 0.19) * 1.45) - 0.055 * (y * y * 8.0);
    pos.setZ(i, cupZ);
    if (uvs) {
      uvs.setXY(i, (x + 0.2) / 0.4, (y + 0.23) / 0.48);
    }
  }
  pos.needsUpdate = true;
  if (uvs) uvs.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createMapleLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Stylized 5-lobe Japanese maple leaf silhouette
  shape.moveTo(0, -0.26);
  shape.lineTo(-0.02, -0.16);
  shape.lineTo(-0.16, -0.19);
  shape.lineTo(-0.12, -0.10);
  shape.lineTo(-0.27, -0.02);
  shape.lineTo(-0.16, 0.04);
  shape.lineTo(-0.22, 0.16);
  shape.lineTo(-0.09, 0.11);
  shape.lineTo(-0.05, 0.27);
  shape.lineTo(0, 0.19);
  shape.lineTo(0.05, 0.27);
  shape.lineTo(0.09, 0.11);
  shape.lineTo(0.22, 0.16);
  shape.lineTo(0.16, 0.04);
  shape.lineTo(0.27, -0.02);
  shape.lineTo(0.12, -0.10);
  shape.lineTo(0.16, -0.19);
  shape.lineTo(0.02, -0.16);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, 4);
  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const curl = 0.04 * Math.sin(x * 7.5) + 0.03 * (y * y * 5.0);
    pos.setZ(i, curl);
    if (uvs) {
      uvs.setXY(i, (x + 0.28) / 0.56, (y + 0.27) / 0.55);
    }
  }
  pos.needsUpdate = true;
  if (uvs) uvs.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createBotanicalPetalTexture(mode: 'sakura' | 'maple'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (mode === 'sakura') {
      const grad = ctx.createLinearGradient(0, size, 0, 0);
      grad.addColorStop(0, '#f472b6');
      grad.addColorStop(0.35, '#fbcfe8');
      grad.addColorStop(0.85, '#fff1f2');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Subtle translucent petal veins radiating from stem
      ctx.strokeStyle = 'rgba(219, 39, 119, 0.16)';
      ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.95);
        ctx.quadraticCurveTo(size * (0.5 + i * 0.07), size * 0.52, size * (0.5 + i * 0.12), size * 0.1);
        ctx.stroke();
      }
    } else {
      const grad = ctx.createRadialGradient(size * 0.5, size * 0.72, 6, size * 0.5, size * 0.45, size * 0.65);
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(0.42, '#ea580c');
      grad.addColorStop(0.82, '#be123c');
      grad.addColorStop(1, '#881337');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.lineWidth = 1.6;
      const tips: [number, number][] = [
        [0.5, 0.08],
        [0.2, 0.25],
        [0.8, 0.25],
        [0.14, 0.58],
        [0.86, 0.58],
      ];
      for (const [tx, ty] of tips) {
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.85);
        ctx.lineTo(size * tx, size * ty);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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

    const grad = ctx.createRadialGradient(c, c, 2, c, c, c - 3);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.28, 'rgba(235, 245, 255, 0.72)');
    grad.addColorStop(0.68, 'rgba(224, 231, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(c, c);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -c * 0.76);
      ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -c * 0.30);
      ctx.lineTo(-c * 0.16, -c * 0.45);
      ctx.moveTo(0, -c * 0.30);
      ctx.lineTo(c * 0.16, -c * 0.45);
      ctx.moveTo(0, -c * 0.52);
      ctx.lineTo(-c * 0.12, -c * 0.65);
      ctx.moveTo(0, -c * 0.52);
      ctx.lineTo(c * 0.12, -c * 0.65);
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

function createSoftBokehTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.24, 'rgba(255, 236, 248, 0.85)');
    grad.addColorStop(0.62, 'rgba(244, 210, 240, 0.25)');
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

// Photorealistic atmospheric Rayleigh/Mie sky scattering + volumetric FBM cloud deck
const SKY_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uRainWeight;
  uniform float uDayFactor;    // 0 = deep night, 0.5 = twilight/dawn/sunset, 1 = bright noon
  uniform float uTwilightFactor;
  uniform float uIsDark;
  uniform vec2 uSunUv;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunColor;
  uniform vec3 uBgColor;
  uniform vec3 uAccentColor;
  uniform float uCloudOctaves;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.52;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      if (float(i) >= uCloudOctaves) break;
      v += amp * noise(p);
      p = rot * p * 2.05 + vec2(13.1, 7.7);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float alt = clamp(uv.y, 0.0, 1.0);

    // 1. Atmospheric gradient anchored smoothly to current time-of-day & season
    float horizonCurve = pow(1.0 - alt, 1.65);
    vec3 atmo = mix(uZenithColor, uHorizonColor, horizonCurve);

    // 2. Solar / Lunar Mie scattering disc & atmospheric glow halo
    vec2 aspectDelta = (uv - uSunUv) * vec2(1.45, 1.0);
    float sunDist = length(aspectDelta);
    float mieGlow = exp(-sunDist * sunDist * 6.5) * (0.45 + 0.55 * uTwilightFactor);
    float bodyDisc = smoothstep(0.068, 0.022, sunDist);
    atmo += uSunColor * (mieGlow * 0.52 + bodyDisc * 0.42);

    // 3. Soft realistic FBM cloud deck moving in atmospheric perspective
    vec2 cloudUv = vec2(uv.x * 2.6 + uTime * 0.012, uv.y * 4.2 + 0.15);
    float cBase = fbm(cloudUv + fbm(cloudUv * 0.7 - uTime * 0.005));
    float cloudHeightMask = smoothstep(0.18, 0.45, uv.y) * (1.0 - smoothstep(0.82, 1.0, uv.y));
    float cloudDensity = smoothstep(0.46 - uRainWeight * 0.14, 0.84, cBase) * cloudHeightMask;
    vec3 cloudLit = mix(uHorizonColor, uSunColor, 0.32 + 0.35 * exp(-sunDist * 2.4));
    cloudLit = mix(cloudLit, vec3(0.42, 0.47, 0.58), uRainWeight * 0.52);
    atmo = mix(atmo, cloudLit, cloudDensity * (0.42 + 0.25 * uDayFactor));

    // 4. Distant soft misty mountain/horizon silhouette at bottom edge
    float ridge1 = 0.13 + 0.035 * sin(uv.x * 5.2 + 0.4) + 0.018 * cos(uv.x * 13.0);
    float ridge2 = 0.085 + 0.024 * sin(uv.x * 7.8 + 2.1) + 0.014 * sin(uv.x * 18.0);
    float m1 = 1.0 - smoothstep(ridge1 - 0.012, ridge1 + 0.012, uv.y);
    float m2 = 1.0 - smoothstep(ridge2 - 0.009, ridge2 + 0.009, uv.y);
    vec3 farHillCol = mix(uZenithColor * 0.58, uHorizonColor * 0.85, 0.48);
    vec3 nearHillCol = mix(uZenithColor * 0.38, uBgColor, 0.45);
    atmo = mix(atmo, farHillCol, m1 * 0.55);
    atmo = mix(atmo, nearHillCol, m2 * 0.72);

    // 5. Harmonize gently with active IDE theme canvas so code contrast stays high
    float themeAnchor = uIsDark > 0.5 ? 0.10 : 0.08;
    vec3 col = mix(atmo, uBgColor, themeAnchor);
    // Keep theme accents out of the full-screen atmosphere; the theme base
    // is already blended above, without washing every scene in its accent hue.

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
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 48);
    camera.position.set(0, 0, 9.6);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.65;
    roomEnv.dispose();

    // Outdoor lighting starts neutral; the animation loop shifts it with the
    // actual time phase and season instead of permanently tinting every scene pink.
    const hemiLight = new THREE.HemisphereLight(0xe8f2ff, 0x596579, 0.9);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xfff8e8, 1.35);
    keyLight.position.set(4, 6, 7);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd8e4ff, 0.22);
    rimLight.position.set(-5, -2, 4);
    scene.add(rimLight);

    // 1. Photorealistic Time & Season Atmospheric Sky Dome
    const skyUniforms = {
      uTime: { value: 0 },
      uRainWeight: { value: 0 },
      uDayFactor: { value: 0.7 },
      uTwilightFactor: { value: 0.4 },
      uIsDark: { value: isDarkTheme ? 1.0 : 0.0 },
      uSunUv: { value: new THREE.Vector2(0.76, 0.78) },
      uZenithColor: { value: new THREE.Color('#3b82f6') },
      uHorizonColor: { value: new THREE.Color('#fed7aa') },
      uSunColor: { value: new THREE.Color('#fffbeb') },
      uBgColor: { value: new THREE.Color(bgHex) },
      uAccentColor: { value: new THREE.Color(accentHex) },
      uCloudOctaves: { value: isSoftwareGl ? 3.0 : 4.0 },
    };
    const skyGeo = new THREE.PlaneGeometry(48, 32);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: skyUniforms,
      depthWrite: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 0, -11.5);
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    // 2. Botanical Petals (Spring/Summer Sakura) + Maple Leaves (Autumn)
    const FOLIAGE_COUNT = isSoftwareGl ? 42 : 64;
    const sakuraTex = createBotanicalPetalTexture('sakura');
    const mapleTex = createBotanicalPetalTexture('maple');

    const petalGeo = createCuppedSakuraPetalGeometry();
    const petalMat = new THREE.MeshStandardMaterial({
      map: sakuraTex,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.04,
      envMapIntensity: 0.85,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, FOLIAGE_COUNT);
    petalMesh.frustumCulled = false;

    const mapleGeo = createMapleLeafGeometry();
    const mapleMat = new THREE.MeshStandardMaterial({
      map: mapleTex,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.03,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const mapleMesh = new THREE.InstancedMesh(mapleGeo, mapleMat, FOLIAGE_COUNT);
    mapleMesh.frustumCulled = false;

    const sakuraPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#ffe4e6'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#f9a8d4'),
    ];
    const maplePalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#fed7aa'),
      new THREE.Color('#fca5a5'),
      new THREE.Color('#fde68a'),
    ];

    const foliageX = new Float32Array(FOLIAGE_COUNT);
    const foliageY = new Float32Array(FOLIAGE_COUNT);
    const foliageZ = new Float32Array(FOLIAGE_COUNT);
    const foliageFallSpeed = new Float32Array(FOLIAGE_COUNT);
    const foliageDriftAmp = new Float32Array(FOLIAGE_COUNT);
    const foliagePhase = new Float32Array(FOLIAGE_COUNT);
    const foliageRotX = new Float32Array(FOLIAGE_COUNT);
    const foliageRotY = new Float32Array(FOLIAGE_COUNT);
    const foliageRotZ = new Float32Array(FOLIAGE_COUNT);
    const foliageSpinX = new Float32Array(FOLIAGE_COUNT);
    const foliageSpinY = new Float32Array(FOLIAGE_COUNT);
    const foliageScale = new Float32Array(FOLIAGE_COUNT);

    for (let i = 0; i < FOLIAGE_COUNT; i++) {
      foliageX[i] = (Math.random() - 0.5) * 16;
      foliageY[i] = (Math.random() - 0.5) * 13;
      foliageZ[i] = (Math.random() - 0.5) * 6.5;
      foliageFallSpeed[i] = 0.52 + Math.random() * 0.62;
      foliageDriftAmp[i] = 0.28 + Math.random() * 0.55;
      foliagePhase[i] = Math.random() * Math.PI * 2;
      foliageRotX[i] = Math.random() * Math.PI * 2;
      foliageRotY[i] = Math.random() * Math.PI * 2;
      foliageRotZ[i] = Math.random() * Math.PI * 2;
      foliageSpinX[i] = (Math.random() - 0.5) * 1.45;
      foliageSpinY[i] = (Math.random() - 0.5) * 1.75;
      foliageScale[i] = 0.58 + Math.random() * 0.62;
      petalMesh.setColorAt(i, sakuraPalette[i % sakuraPalette.length]);
      mapleMesh.setColorAt(i, maplePalette[i % maplePalette.length]);
    }
    if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
    if (mapleMesh.instanceColor) mapleMesh.instanceColor.needsUpdate = true;
    scene.add(petalMesh);
    scene.add(mapleMesh);

    // 3. Crystalline Winter Snowflakes + Soft Bokeh
    const SNOW_COUNT = isSoftwareGl ? 50 : 76;
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
    const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, SNOW_COUNT);
    snowMesh.frustumCulled = false;

    const snowPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#f0f9ff'),
      new THREE.Color('#fdf2f8'),
      new THREE.Color('#eef2ff'),
    ];
    const snowX = new Float32Array(SNOW_COUNT);
    const snowY = new Float32Array(SNOW_COUNT);
    const snowZ = new Float32Array(SNOW_COUNT);
    const snowSpeed = new Float32Array(SNOW_COUNT);
    const snowPhase = new Float32Array(SNOW_COUNT);
    const snowSpin = new Float32Array(SNOW_COUNT);
    const snowScale = new Float32Array(SNOW_COUNT);

    for (let i = 0; i < SNOW_COUNT; i++) {
      snowX[i] = (Math.random() - 0.5) * 16;
      snowY[i] = (Math.random() - 0.5) * 13;
      snowZ[i] = (Math.random() - 0.5) * 7.0;
      snowSpeed[i] = 0.42 + Math.random() * 0.68;
      snowPhase[i] = Math.random() * Math.PI * 2;
      snowSpin[i] = (Math.random() - 0.5) * 0.85;
      snowScale[i] = 0.55 + Math.random() * 0.95;
      snowMesh.setColorAt(i, snowPalette[i % snowPalette.length]);
    }
    if (snowMesh.instanceColor) snowMesh.instanceColor.needsUpdate = true;
    scene.add(snowMesh);

    // 4. Realistic Rain Streaks + Water Ripples
    const RAIN_COUNT = isSoftwareGl ? 60 : 96;
    const rainGeo = new THREE.CylinderGeometry(0.0045, 0.012, 0.66, 6);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
    rainMesh.frustumCulled = false;

    const rainPalette = [
      new THREE.Color('#e0f2fe'),
      new THREE.Color('#f5d0fe'),
      new THREE.Color('#e0e7ff'),
      new THREE.Color('#fbcfe8'),
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
      rainSpeed[i] = 6.5 + Math.random() * 4.8;
      rainScale[i] = 0.72 + Math.random() * 0.65;
      rainMesh.setColorAt(i, rainPalette[i % rainPalette.length]);
    }
    if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
    scene.add(rainMesh);

    const RIPPLE_COUNT = 26;
    const rippleGeo = new THREE.RingGeometry(0.16, 0.195, 28);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
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
      rippleLife[i] = 1.35 + Math.random() * 1.0;
      rippleAge[i] = Math.random() * rippleLife[i];
      rippleMesh.setColorAt(i, rainPalette[i % rainPalette.length]);
    }
    if (rippleMesh.instanceColor) rippleMesh.instanceColor.needsUpdate = true;
    scene.add(rippleMesh);

    // 5. Realistic Multi-Magnitude Sky Stars + Foreground Fireflies
    const STAR_COUNT = 120;
    const bokehTex = createSoftBokehTexture();
    const skyStarPositions = new Float32Array(STAR_COUNT * 3);
    const skyStarColors = new Float32Array(STAR_COUNT * 3);
    const skyStarPalette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#dbeafe'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#fce7f3'),
    ];
    for (let i = 0; i < STAR_COUNT; i++) {
      skyStarPositions[i * 3] = (Math.random() - 0.5) * 24;
      skyStarPositions[i * 3 + 1] = -0.5 + Math.random() * 8.5; // above horizon
      skyStarPositions[i * 3 + 2] = -7.5 - Math.random() * 2.5;
      const sc = skyStarPalette[i % skyStarPalette.length];
      skyStarColors[i * 3] = sc.r;
      skyStarColors[i * 3 + 1] = sc.g;
      skyStarColors[i * 3 + 2] = sc.b;
    }
    const skyStarGeo = new THREE.BufferGeometry();
    skyStarGeo.setAttribute('position', new THREE.BufferAttribute(skyStarPositions, 3));
    skyStarGeo.setAttribute('color', new THREE.BufferAttribute(skyStarColors, 3));
    const skyStarMat = new THREE.PointsMaterial({
      map: bokehTex,
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const skyStars = new THREE.Points(skyStarGeo, skyStarMat);
    skyStars.frustumCulled = false;
    scene.add(skyStars);

    const FIREFLY_COUNT = 48;
    const ffPositions = new Float32Array(FIREFLY_COUNT * 3);
    const ffColors = new Float32Array(FIREFLY_COUNT * 3);
    const ffBaseX = new Float32Array(FIREFLY_COUNT);
    const ffBaseY = new Float32Array(FIREFLY_COUNT);
    const ffBaseZ = new Float32Array(FIREFLY_COUNT);
    const ffPhase = new Float32Array(FIREFLY_COUNT);
    const ffSpeed = new Float32Array(FIREFLY_COUNT);
    const ffPalette = [
      new THREE.Color('#fde68a'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#d9f99d'),
      new THREE.Color('#f5d0fe'),
    ];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      ffBaseX[i] = (Math.random() - 0.5) * 14.5;
      ffBaseY[i] = (Math.random() - 0.5) * 11.5;
      ffBaseZ[i] = (Math.random() - 0.5) * 5.2;
      ffPhase[i] = Math.random() * Math.PI * 2;
      ffSpeed[i] = 0.42 + Math.random() * 0.72;
      ffPositions[i * 3] = ffBaseX[i];
      ffPositions[i * 3 + 1] = ffBaseY[i];
      ffPositions[i * 3 + 2] = ffBaseZ[i];
      const fc = ffPalette[i % ffPalette.length];
      ffColors[i * 3] = fc.r;
      ffColors[i * 3 + 1] = fc.g;
      ffColors[i * 3 + 2] = fc.b;
    }
    const ffGeo = new THREE.BufferGeometry();
    const ffPosAttr = new THREE.BufferAttribute(ffPositions, 3);
    ffGeo.setAttribute('position', ffPosAttr);
    ffGeo.setAttribute('color', new THREE.BufferAttribute(ffColors, 3));
    const ffMat = new THREE.PointsMaterial({
      map: bokehTex,
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ffPoints = new THREE.Points(ffGeo, ffMat);
    ffPoints.frustumCulled = false;
    scene.add(ffPoints);

    // Pre-allocated scratch colors/objects (zero per-frame heap allocations)
    const dummy = new THREE.Object3D();
    const targetBg = new THREE.Color(bgHex);
    const targetAccent = new THREE.Color(accentHex);
    const targetZenith = new THREE.Color();
    const targetHorizon = new THREE.Color();
    const targetSun = new THREE.Color();
    const targetHemiSky = new THREE.Color();
    const targetHemiGround = new THREE.Color();
    const targetKeyLight = new THREE.Color();
    const targetRimLight = new THREE.Color();
    const targetSunUv = new THREE.Vector2(0.75, 0.78);

    let wSakura = 0;
    let wMaple = 0;
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

      const st = getActiveAtmosphereState(curMode);

      // Compute outdoor sky and scene lighting from local time and season.
      // Keep the light rig neutral at noon and progressively cooler/dimmer at night.
      let dayFactor = 0.5;
      let twilightFactor = 0.4;
      let hemiIntensity = 0.7;
      let keyIntensity = 0.9;
      let rimIntensity = 0.18;
      let hemiSky = '#dcecff';
      let hemiGround = st.season === 'autumn' ? '#665345' : st.season === 'winter' ? '#536477' : '#596579';
      let keyLightColor = '#fff4df';
      let rimLightColor = '#b8c9e8';
      if (st.phaseKey === 'bg3d_phase_dawn') {
        dayFactor = 0.65;
        twilightFactor = 0.9;
        hemiIntensity = 0.72;
        keyIntensity = 0.92;
        rimIntensity = 0.24;
        hemiSky = '#f1e8ff';
        keyLightColor = '#ffd8b0';
        rimLightColor = '#b9c9ee';
        targetSunUv.set(0.72, 0.58);
        targetZenith.set(st.season === 'winter' ? '#64748b' : '#6366f1');
        targetHorizon.set(st.season === 'autumn' ? '#fdba74' : '#fbcfe8');
        targetSun.set('#fff1f2');
      } else if (st.phaseKey === 'bg3d_phase_noon') {
        dayFactor = 1.0;
        twilightFactor = 0.2;
        hemiIntensity = 1.05;
        keyIntensity = 1.55;
        rimIntensity = 0.2;
        hemiSky = st.season === 'winter' ? '#e4f2ff' : '#eaf5ff';
        keyLightColor = '#fff8e9';
        rimLightColor = '#d8e7ff';
        targetSunUv.set(0.68, 0.84);
        targetZenith.set(
          st.season === 'winter'
            ? '#38bdf8'
            : st.season === 'autumn'
            ? '#2563eb'
            : '#60a5fa'
        );
        targetHorizon.set(
          st.season === 'autumn'
            ? '#fed7aa'
            : st.season === 'summer'
            ? '#bae6fd'
            : '#fce7f3'
        );
        targetSun.set('#fffbeb');
      } else if (st.phaseKey === 'bg3d_phase_sunset') {
        dayFactor = 0.55;
        twilightFactor = 1.0;
        hemiIntensity = 0.68;
        keyIntensity = 1.02;
        rimIntensity = 0.3;
        hemiSky = '#e8d9f0';
        keyLightColor = st.season === 'autumn' ? '#ffd0a1' : '#f4c9d9';
        rimLightColor = '#aaa9df';
        targetSunUv.set(0.28, 0.46);
        targetZenith.set(st.season === 'autumn' ? '#62456f' : '#6d28d9');
        targetHorizon.set('#f0a6cf');
        targetSun.set('#fce7f3');
      } else if (st.phaseKey === 'bg3d_phase_evening') {
        dayFactor = 0.2;
        twilightFactor = 0.55;
        hemiIntensity = 0.42;
        keyIntensity = 0.34;
        rimIntensity = 0.16;
        hemiSky = '#aebde0';
        keyLightColor = '#bdcafa';
        rimLightColor = '#747fb8';
        targetSunUv.set(0.74, 0.72);
        targetZenith.set('#1e1b4b');
        targetHorizon.set(st.season === 'autumn' ? '#881337' : '#581c87');
        targetSun.set('#f5d0fe');
      } else {
        dayFactor = 0.05;
        twilightFactor = 0.25;
        hemiIntensity = 0.24;
        keyIntensity = 0.12;
        rimIntensity = 0.09;
        hemiSky = '#8795c3';
        keyLightColor = '#9eadd8';
        rimLightColor = '#626f9e';
        targetSunUv.set(0.76, 0.78);
        targetZenith.set('#090d1f');
        targetHorizon.set(st.season === 'winter' ? '#1e3a5f' : '#2e1065');
        targetSun.set('#e0e7ff');
      }

      // Smoothly transition the 3D objects' real material lighting as well as the sky.
      targetHemiSky.set(hemiSky);
      targetHemiGround.set(hemiGround);
      targetKeyLight.set(keyLightColor);
      targetRimLight.set(rimLightColor);
      hemiLight.color.lerp(targetHemiSky, Math.min(1, dt * 1.8));
      hemiLight.groundColor.lerp(targetHemiGround, Math.min(1, dt * 1.8));
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, hemiIntensity, 1.8, dt);
      keyLight.color.lerp(targetKeyLight, Math.min(1, dt * 1.8));
      keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, keyIntensity, 1.8, dt);
      rimLight.color.lerp(targetRimLight, Math.min(1, dt * 1.8));
      rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, rimIntensity, 1.8, dt);

      targetBg.set(curBg);
      targetAccent.set(curAccent);
      skyUniforms.uTime.value = elapsed;
      skyUniforms.uBgColor.value.lerp(targetBg, Math.min(1, dt * 4));
      skyUniforms.uAccentColor.value.lerp(targetAccent, Math.min(1, dt * 4));
      skyUniforms.uZenithColor.value.lerp(targetZenith, Math.min(1, dt * 2.5));
      skyUniforms.uHorizonColor.value.lerp(targetHorizon, Math.min(1, dt * 2.5));
      skyUniforms.uSunColor.value.lerp(targetSun, Math.min(1, dt * 2.5));
      skyUniforms.uSunUv.value.lerp(targetSunUv, Math.min(1, dt * 2.5));
      skyUniforms.uDayFactor.value = THREE.MathUtils.damp(skyUniforms.uDayFactor.value, dayFactor, 2.5, dt);
      skyUniforms.uTwilightFactor.value = THREE.MathUtils.damp(
        skyUniforms.uTwilightFactor.value,
        twilightFactor,
        2.5,
        dt
      );
      skyUniforms.uIsDark.value = THREE.MathUtils.damp(
        skyUniforms.uIsDark.value,
        curDark ? 1.0 : 0.0,
        4.5,
        dt
      );

      // Foliage: render Autumn maple leaves when in autumn season & petals active, else sakura petals
      const showPetals = st.activeEffect === 'petals';
      const isAutumnFoliage = st.season === 'autumn' && curMode === 'auto';
      const tgtSakura = showPetals && !isAutumnFoliage ? 1.0 : 0.0;
      const tgtMaple = showPetals && isAutumnFoliage ? 1.0 : 0.0;
      const tgtSnow = st.activeEffect === 'snow' ? 1.0 : 0.0;
      const tgtRain = st.activeEffect === 'rain' ? 1.0 : 0.0;
      const isNightish = st.phaseKey === 'bg3d_phase_night' || st.phaseKey === 'bg3d_phase_evening';
      const tgtStars = st.activeEffect === 'starlight' ? 1.0 : isNightish || curDark ? 0.45 : 0.14;

      wSakura = THREE.MathUtils.damp(wSakura, tgtSakura, 2.8, dt);
      wMaple = THREE.MathUtils.damp(wMaple, tgtMaple, 2.8, dt);
      wSnow = THREE.MathUtils.damp(wSnow, tgtSnow, 2.8, dt);
      wRain = THREE.MathUtils.damp(wRain, tgtRain, 3.2, dt);
      wStars = THREE.MathUtils.damp(wStars, tgtStars, 2.6, dt);
      skyUniforms.uRainWeight.value = wRain;

      const themeAlphaFactor = curDark ? 1.0 : 0.82;
      const anyFoliage = wSakura > 0.015 || wMaple > 0.015;
      if (anyFoliage) {
        const windX = Math.sin(elapsed * 0.38) * 0.48 + (isAutumnFoliage ? 0.34 : 0.22);
        for (let i = 0; i < FOLIAGE_COUNT; i++) {
          foliageY[i] -= foliageFallSpeed[i] * dt;
          foliageX[i] +=
            (windX + Math.sin(elapsed * 0.95 + foliagePhase[i]) * foliageDriftAmp[i]) * dt;
          if (foliageY[i] < -6.6) {
            foliageY[i] = 6.6;
            foliageX[i] = (Math.random() - 0.5) * 16;
          }
          if (foliageX[i] > 8.6) foliageX[i] = -8.6;
          if (foliageX[i] < -8.6) foliageX[i] = 8.6;

          foliageRotX[i] += foliageSpinX[i] * dt;
          foliageRotY[i] += foliageSpinY[i] * dt;
          foliageRotZ[i] += Math.sin(elapsed + foliagePhase[i]) * 0.65 * dt;
        }
      }

      petalMesh.visible = wSakura > 0.015;
      if (petalMesh.visible) {
        petalMat.opacity = 0.92 * wSakura * themeAlphaFactor;
        for (let i = 0; i < FOLIAGE_COUNT; i++) {
          const s = foliageScale[i] * (0.45 + 0.55 * wSakura);
          dummy.position.set(foliageX[i], foliageY[i], foliageZ[i]);
          dummy.rotation.set(foliageRotX[i], foliageRotY[i], foliageRotZ[i]);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          petalMesh.setMatrixAt(i, dummy.matrix);
        }
        petalMesh.instanceMatrix.needsUpdate = true;
      }

      mapleMesh.visible = wMaple > 0.015;
      if (mapleMesh.visible) {
        mapleMat.opacity = 0.94 * wMaple * themeAlphaFactor;
        for (let i = 0; i < FOLIAGE_COUNT; i++) {
          const s = foliageScale[i] * 1.12 * (0.45 + 0.55 * wMaple);
          dummy.position.set(foliageX[i], foliageY[i], foliageZ[i]);
          dummy.rotation.set(foliageRotX[i], foliageRotY[i], foliageRotZ[i]);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          mapleMesh.setMatrixAt(i, dummy.matrix);
        }
        mapleMesh.instanceMatrix.needsUpdate = true;
      }

      snowMesh.visible = wSnow > 0.015;
      if (snowMesh.visible) {
        snowMat.opacity = (curDark ? 0.9 : 0.78) * wSnow;
        for (let i = 0; i < SNOW_COUNT; i++) {
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

      const rainActive = wRain > 0.015;
      rainMesh.visible = rainActive;
      rippleMesh.visible = rainActive;
      if (rainActive) {
        rainMat.opacity = (curDark ? 0.62 : 0.44) * wRain;
        const slant = -0.14;
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

        rippleMat.opacity = (curDark ? 0.44 : 0.32) * wRain;
        for (let i = 0; i < RIPPLE_COUNT; i++) {
          rippleAge[i] += dt;
          if (rippleAge[i] >= rippleLife[i]) {
            rippleAge[i] = 0;
            rippleX[i] = (Math.random() - 0.5) * 12;
            rippleY[i] = -3.4 - Math.random() * 1.9;
            rippleZ[i] = (Math.random() - 0.5) * 5.0;
          }
          const progress = rippleAge[i] / rippleLife[i];
          const ringScale = (0.25 + progress * 1.85) * (1.0 - progress * 0.15) * wRain;
          dummy.position.set(rippleX[i], rippleY[i], rippleZ[i]);
          dummy.rotation.set(-Math.PI / 2.25, 0, 0);
          dummy.scale.set(ringScale, ringScale, ringScale);
          dummy.updateMatrix();
          rippleMesh.setMatrixAt(i, dummy.matrix);
        }
        rippleMesh.instanceMatrix.needsUpdate = true;
      }

      // Upper sky pinpoint stars appear cleanly during night/evening/starlight
      const starVis = (1.0 - dayFactor) * wStars;
      skyStars.visible = starVis > 0.04;
      if (skyStars.visible) {
        skyStarMat.opacity = Math.min(0.88, starVis * (curDark ? 1.1 : 0.55));
        skyStars.rotation.z = elapsed * 0.008;
      }

      // Foreground fireflies & stardust
      ffMat.opacity = (curDark ? 0.85 : 0.52) * wStars;
      ffMat.size = 0.26 + 0.16 * wStars + Math.sin(elapsed * 1.9) * 0.025;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const p = ffPhase[i];
        const sp = ffSpeed[i];
        ffPositions[i * 3] = ffBaseX[i] + Math.sin(elapsed * sp + p) * 0.55;
        ffPositions[i * 3 + 1] = ffBaseY[i] + Math.cos(elapsed * sp * 0.8 + p) * 0.48;
        ffPositions[i * 3 + 2] = ffBaseZ[i] + Math.sin(elapsed * 0.45 + p) * 0.35;
      }
      ffPosAttr.needsUpdate = true;

      camera.position.x = Math.sin(elapsed * 0.15) * 0.22;
      camera.position.y = Math.cos(elapsed * 0.12) * 0.16;
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
      sakuraTex.dispose();
      mapleGeo.dispose();
      mapleMat.dispose();
      mapleTex.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      snowTex.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      rippleGeo.dispose();
      rippleMat.dispose();
      skyStarGeo.dispose();
      skyStarMat.dispose();
      ffGeo.dispose();
      ffMat.dispose();
      bokehTex.dispose();
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
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
