import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scales = {
  yo: [0, 2, 5, 7, 9],
  inSen: [0, 1, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  pelogLike: [0, 1, 3, 7, 8],
  majorPent: [0, 2, 4, 7, 9],
};

const roots = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3'];

const ui = {
  canvas: document.getElementById('stage'),
  startButton: document.getElementById('startButton'),
  resetButton: document.getElementById('resetButton'),
  scaleSelect: document.getElementById('scaleSelect'),
  rootSelect: document.getElementById('rootSelect'),
  synthType: document.getElementById('synthType'),
  count: document.getElementById('count'),
  countOut: document.getElementById('countOut'),
  loopDuration: document.getElementById('loopDuration'),
  loopOut: document.getElementById('loopOut'),
  amplitude: document.getElementById('amplitude'),
  ampOut: document.getElementById('ampOut'),
  spacing: document.getElementById('spacing'),
  spacingOut: document.getElementById('spacingOut'),
  lengthBase: document.getElementById('lengthBase'),
  lengthOut: document.getElementById('lengthOut'),
  reverb: document.getElementById('reverb'),
  reverbOut: document.getElementById('reverbOut'),
  volume: document.getElementById('volume'),
  volOut: document.getElementById('volOut'),
};

Object.keys(scales).forEach((name) => {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  ui.scaleSelect.append(option);
});
ui.scaleSelect.value = 'yo';

roots.forEach((root) => {
  const option = document.createElement('option');
  option.value = root;
  option.textContent = root;
  ui.rootSelect.append(option);
});
ui.rootSelect.value = 'D3';

let started = false;
let elapsed = 0;
let prevFrame = performance.now();

const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf0f1f2, 22, 43);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
camera.position.set(0, 4.7, 24);
camera.lookAt(0, -1, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(7, 10, 11);
scene.add(key);

const fill = new THREE.DirectionalLight(0xe5ebff, 0.7);
fill.position.set(-8, 4, 8);
scene.add(fill);

const rig = new THREE.Group();
scene.add(rig);

const bar = new THREE.Mesh(
  new THREE.BoxGeometry(40, 0.22, 0.42),
  new THREE.MeshStandardMaterial({ color: 0x9ca8ba, roughness: 0.36, metalness: 0.5 })
);
bar.position.set(0, 7.5, 0);
scene.add(bar);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 80),
  new THREE.MeshStandardMaterial({ color: 0xf1f2f5, roughness: 0.9, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -6.4;
scene.add(floor);

let synth;
let reverb;

const state = {
  count: Number(ui.count.value),
  loopDuration: Number(ui.loopDuration.value),
  amplitudeDeg: Number(ui.amplitude.value),
  spacing: Number(ui.spacing.value),
  lengthBase: Number(ui.lengthBase.value),
  scaleName: ui.scaleSelect.value,
  root: ui.rootSelect.value,
  synthType: ui.synthType.value,
  reverbWet: Number(ui.reverb.value),
  volumeDb: Number(ui.volume.value),
};

const pendulums = [];
const noteSet = [];

function syncOutputText() {
  ui.countOut.textContent = state.count;
  ui.loopOut.textContent = state.loopDuration.toFixed(0);
  ui.ampOut.textContent = state.amplitudeDeg.toFixed(0);
  ui.spacingOut.textContent = state.spacing.toFixed(2);
  ui.lengthOut.textContent = state.lengthBase.toFixed(1);
  ui.reverbOut.textContent = state.reverbWet.toFixed(2);
  ui.volOut.textContent = state.volumeDb.toFixed(0);
}

function regenerateNotes() {
  noteSet.length = 0;
  const scale = scales[state.scaleName] || scales.yo;
  const rootMidi = Tone.Frequency(state.root).toMidi();
  for (let i = 0; i < state.count; i += 1) {
    const octave = Math.floor(i / scale.length);
    const degree = scale[i % scale.length];
    noteSet.push(Tone.Frequency(rootMidi + degree + octave * 12, 'midi').toNote());
  }
}

function buildPendulums() {
  while (rig.children.length) {
    const obj = rig.children.pop();
    obj.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose());
        else child.material.dispose();
      }
    });
  }
  pendulums.length = 0;

  const offset = ((state.count - 1) * state.spacing) / 2;
  for (let i = 0; i < state.count; i += 1) {
    const holder = new THREE.Group();
    const x = i * state.spacing - offset;
    const length = state.lengthBase + i * 0.085;

    const wireGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -length, 0),
    ]);
    const wire = new THREE.Line(
      wireGeom,
      new THREE.LineBasicMaterial({ color: 0x2a313e, transparent: true, opacity: 0.64 })
    );
    holder.add(wire);

    const bob = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 18, 18),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.6 - (i / state.count) * 0.35, 0.74, 0.55),
        roughness: 0.34,
        metalness: 0.1,
      })
    );
    bob.position.y = -length;
    holder.add(bob);

    holder.position.set(x, bar.position.y, 0);
    rig.add(holder);

    pendulums.push({
      holder,
      bob,
      length,
      period: state.loopDuration / (state.count + i),
      lastX: 0,
      gate: false,
    });
  }

  regenerateNotes();
}

function setupAudioGraph() {
  if (reverb) reverb.dispose();
  if (synth) synth.dispose();

  reverb = new Tone.Reverb({ decay: 3.8, wet: state.reverbWet }).toDestination();
  synth = new Tone.PolySynth(Tone.Synth, {
    volume: state.volumeDb,
    oscillator: { type: state.synthType },
    envelope: {
      attack: 0.005,
      decay: 0.17,
      sustain: 0.15,
      release: 0.55,
    },
  }).connect(reverb);
}

function resetLoop() {
  elapsed = 0;
  pendulums.forEach((p) => {
    p.lastX = 0;
    p.gate = false;
  });
}

function updatePendulums() {
  const amp = THREE.MathUtils.degToRad(state.amplitudeDeg);

  pendulums.forEach((p, i) => {
    const phase = (elapsed / p.period) * Math.PI * 2;
    const angle = amp * Math.sin(phase);
    p.holder.rotation.z = angle;

    const x = Math.sin(angle);
    const crossing = p.lastX <= 0 && x > 0;
    if (crossing && !p.gate && started && synth) {
      synth.triggerAttackRelease(noteSet[i], '8n', undefined, 0.7);
      p.gate = true;
    }

    if (x < -0.1) p.gate = false;
    p.lastX = x;

    const pulse = 0.92 + Math.abs(Math.sin(phase * 0.5)) * 0.36;
    p.bob.scale.setScalar(pulse);
  });
}

function tick(now) {
  const dt = Math.min((now - prevFrame) / 1000, 0.04);
  prevFrame = now;
  elapsed += dt;

  updatePendulums();
  rig.rotation.y = Math.sin(elapsed * 0.18) * 0.09;
  renderer.render(scene, camera);

  requestAnimationFrame(tick);
}

function resize() {
  const wrap = ui.canvas.parentElement;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function bindSlider(slider, key, onChange = null) {
  slider.addEventListener('input', () => {
    state[key] = Number(slider.value);
    syncOutputText();
    if (onChange) onChange();
  });
}

bindSlider(ui.count, 'count', buildPendulums);
bindSlider(ui.loopDuration, 'loopDuration', buildPendulums);
bindSlider(ui.amplitude, 'amplitudeDeg');
bindSlider(ui.spacing, 'spacing', buildPendulums);
bindSlider(ui.lengthBase, 'lengthBase', buildPendulums);
bindSlider(ui.reverb, 'reverbWet', () => {
  if (reverb) reverb.wet.value = state.reverbWet;
});
bindSlider(ui.volume, 'volumeDb', () => {
  if (synth) synth.volume.value = state.volumeDb;
});

ui.scaleSelect.addEventListener('change', () => {
  state.scaleName = ui.scaleSelect.value;
  regenerateNotes();
});

ui.rootSelect.addEventListener('change', () => {
  state.root = ui.rootSelect.value;
  regenerateNotes();
});

ui.synthType.addEventListener('change', () => {
  state.synthType = ui.synthType.value;
  setupAudioGraph();
});

ui.startButton.addEventListener('click', async () => {
  await Tone.start();
  started = true;
  ui.startButton.textContent = 'Audio Running';
  ui.startButton.disabled = true;
});

ui.resetButton.addEventListener('click', () => {
  resetLoop();
});

window.addEventListener('resize', resize);

setupAudioGraph();
syncOutputText();
buildPendulums();
resize();
requestAnimationFrame(tick);
