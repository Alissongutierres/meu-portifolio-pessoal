import { Mesh, Program, Renderer, Triangle } from "https://esm.sh/ogl@1.0.11";

const hexToRgb = hex => {
  const value = hex.trim().replace(/^#/, '');
  const normalized = value.length === 3 ? value.replace(/./g, channel => channel + channel) : value;
  const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!match) return [1, 1, 1];
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
};

const setColor = (uniform, hex) => {
  const color = hexToRgb(hex);
  uniform.value[0] = color[0];
  uniform.value[1] = color[1];
  uniform.value[2] = color[2];
};

const vertex = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uLayers;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uWaveSpeed;
uniform float uLayerSpeed;
uniform float uTwist;
uniform float uTwistFrequency;
uniform float uTwistSpeed;
uniform float uLineFrequency;
uniform float uLineSpacing;
uniform float uLineSharpness;
uniform float uGlowFalloff;
uniform float uGlowIntensity;
uniform float uBrightness;
uniform float uBlueBoost;
uniform float uVignette;
uniform float uGrain;
uniform float uRotationSpeed;
uniform float uLightMode;
uniform vec3 uLineColor;
uniform vec3 uGlowColor;

out vec4 fragColor;

#define MAX_LAYERS 10

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

float grainHash(vec2 point) {
  point = floor(point);
  float hash = 52.9829189 * fract(dot(point, vec2(0.065, 0.005)));
  return fract(hash);
}

float layeredGrain(vec2 fragmentPixel) {
  vec2 point = mod(fragmentPixel + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
  vec2 rotated = mat2(0.8, -0.5, 0.5, 0.8) * point;
  float grain = 0.0;
  grain += 0.40 * grainHash(rotated);
  grain += 0.25 * grainHash(rotated * 2.0 + 17.0);
  grain += 0.20 * grainHash(rotated * 4.0 + 47.0);
  grain += 0.10 * grainHash(rotated * 8.0 + 113.0);
  grain += 0.05 * grainHash(rotated * 16.0 + 191.0);
  return grain;
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 uv = (2.0 * gl_FragCoord.xy - resolution) / resolution.y;
  float time = uTime * uSpeed;
  vec3 backdrop = mix(vec3(0.070588, 0.058824, 0.090196), vec3(1.0), step(0.5, uLightMode));
  vec3 centerTone = max(uLineColor * 0.85567 - uGlowColor * 0.06186, vec3(0.0));
  vec3 cloudTone = uLineColor * 0.19588 + uGlowColor * 0.2268;
  vec2 p = uv;
  p /= max(uScale, 0.05);
  p = rotate2d(radians(uRotation) + time * uRotationSpeed) * p;
  vec3 color = vec3(0.0);
  float fiberField = 0.0;

  for (int index = 0; index < MAX_LAYERS; index++) {
    float fi = float(index) + 1.0;
    if (fi > uLayers) break;

    p += uWaveAmplitude * sin(p.yx * fi * uWaveFrequency + time * (uWaveSpeed + fi * uLayerSpeed));

    float radius = length(p);
    float polarAngle = atan(p.y, p.x);
    polarAngle += sin(radius * uTwistFrequency - time * uTwistSpeed + fi) * uTwist;
    p = vec2(cos(polarAngle), sin(polarAngle)) * radius;

    float lines = abs(sin(p.x * (uLineFrequency + fi * uLineSpacing) + sin(p.y * 3.0 + time)));
    lines = pow(max(0.0, 1.0 - lines), uLineSharpness);
    fiberField += lines / fi;
    color += uLineColor * lines / fi;

    float glow = exp(-uGlowFalloff * abs(sin(p.x * 3.0 + time + fi)));
    color += uGlowColor * glow * uGlowIntensity / (fi * 2.0);
  }

  float center = exp(-2.2 * dot(uv, uv));
  color += centerTone * center;

  float cloud = exp(-1.5 * length(uv + vec2(sin(time * 0.3) * 0.25, cos(time * 0.25) * 0.18)));
  color += cloudTone * cloud;

  float vignette = 1.0 - smoothstep(0.35, 1.45, length(uv));
  color *= mix(1.0 - uVignette, 1.0, vignette);
  color = 1.0 - exp(-color * uBrightness);
  color.b *= uBlueBoost;

  vec3 outputColor;
  if (uLightMode > 0.5) {
    float edgeFade = mix(1.0 - uVignette, 1.0, vignette);
    float fibers = pow(smoothstep(0.12, 1.05, fiberField) * edgeFade, 1.5);
    float atmosphere = (center * 0.025 + cloud * 0.015) * edgeFade;
    vec3 fiberInk = mix(backdrop, uLineColor, 0.52);
    vec3 airColor = mix(backdrop, uGlowColor, 0.16);

    outputColor = mix(backdrop, airColor, atmosphere);
    outputColor = mix(outputColor, fiberInk, fibers * 0.3);
  } else {
    outputColor = backdrop + color;
  }

  float noise = (layeredGrain(gl_FragCoord.xy) - 0.5) * uGrain;
  outputColor = clamp(outputColor + noise, 0.0, 1.0);
  fragColor = vec4(outputColor, 1.0);
}
`;

const container = document.querySelector("#fundo");

const renderer = new Renderer({ webgl: 2, alpha: false, antialias: false, dpr: 1 });
const gl = renderer.gl;

gl.canvas.style.display = "block";

container.appendChild(gl.canvas);

const geometry = new Triangle(gl);

const program = new Program(gl, {
  vertex,
  fragment,
  uniforms: {
    uResolution: { value: new Float32Array([gl.drawingBufferWidth, gl.drawingBufferHeight]) },
    uTime: { value: 0 },
    uSpeed: { value: 0.2 },
    uScale: { value: 2 },
    uRotation: { value: 0 },
    uRotationSpeed: { value: 0.25 },
    uLayers: { value: 4 },
    uWaveAmplitude: { value: 0.015 },
    uWaveFrequency: { value: 3 },
    uWaveSpeed: { value: 0.15 },
    uLayerSpeed: { value: 0.08 },
    uTwist: { value: 0.1 },
    uTwistFrequency: { value: 5 },
    uTwistSpeed: { value: 1.2 },
    uLineFrequency: { value: 5 },
    uLineSpacing: { value: 2 },
    uLineSharpness: { value: 16 },
    uGlowFalloff: { value: 10 },
    uGlowIntensity: { value: 1.6 },
    uBrightness: { value: 2 },
    uBlueBoost: { value: 1.25 },
    uVignette: { value: 0.8 },
    uGrain: { value: 0.05 },
    uLightMode: { value: 0 },
    uLineColor: { value: new Float32Array(hexToRgb("#140E35")) },
    uGlowColor: { value: new Float32Array(hexToRgb("#3437A0")) }
  }
});

const mesh = new Mesh(gl, { geometry, program });

const resize = () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  program.uniforms.uResolution.value = new Float32Array([gl.drawingBufferWidth, gl.drawingBufferHeight]);
};

window.addEventListener("resize", resize);
resize();

let elapsed = 0;
let previous = performance.now();

const loop = now => {
  const delta = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  elapsed += delta;

  program.uniforms.uTime.value = elapsed;
  renderer.render({ scene: mesh });

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);
// Guarda os elementos em variáveis para não procurar no HTML toda hora
const botao = document.querySelector('.btn-menu');
const menu = document.querySelector('#menu');
const links = document.querySelectorAll('#menu a');

// Função que abre e fecha o menu
function alternarMenu() {
  const aberto = menu.classList.toggle('ativo');
  botao.classList.toggle('ativo');

  botao.setAttribute('aria-expanded', aberto);
  botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
}

botao.addEventListener('click', alternarMenu);

links.forEach(function (link) {
  link.addEventListener('click', function () {
    if (menu.classList.contains('ativo')) {
      alternarMenu();
    }
  });
});
