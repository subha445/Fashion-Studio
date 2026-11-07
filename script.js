
/* ==========================================
   FASHION STUDIO 2.0
   Complete interactive application
========================================== */

const $ = id => document.getElementById(id);

const STORAGE_KEY = "fashionStudioCollectionV2";

let savedDesigns = [];
let currentPage = "sketch";

/* ==========================================
   NOTIFICATIONS
========================================== */

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ==========================================
   NAVIGATION
========================================== */

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    currentPage = button.dataset.tab;

    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.id === currentPage);
    });

    if (currentPage === "mannequin") {
      initialize3D();
      setTimeout(resize3D, 100);
    }

    if (currentPage === "collection") {
      renderCollection();
    }
  });
});

$("startDesigning").addEventListener("click", () => {
  document.querySelector('[data-tab="sketch"]').click();
});

/* ==========================================
   2D CANVAS
========================================== */

const canvas = $("designCanvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;
let undoStack = [];
let redoStack = [];

function clearCanvasBackground() {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fffefa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function saveCanvasState() {
  if (undoStack.length >= 25) undoStack.shift();

  undoStack.push(canvas.toDataURL());
  redoStack = [];
  updateHistoryButtons();
}

function restoreCanvasState(data) {
  const image = new Image();

  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  };

  image.src = data;
}

function updateHistoryButtons() {
  $("undoCanvas").disabled = undoStack.length === 0;
  $("redoCanvas").disabled = redoStack.length === 0;
}

clearCanvasBackground();
saveCanvasState();

function canvasPosition(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener("pointerdown", event => {
  if (event.button !== undefined && event.button !== 0) return;

  event.preventDefault();
  saveCanvasState();

  drawing = true;
  canvas.setPointerCapture(event.pointerId);

  const point = canvasPosition(event);
  lastX = point.x;
  lastY = point.y;

  ctx.beginPath();
  ctx.arc(lastX, lastY, Number($("brushSize").value) / 2, 0, Math.PI * 2);
  ctx.fillStyle = $("drawingTool").value === "eraser"
    ? "#fffefa"
    : $("brushColor").value;
  ctx.fill();
});

canvas.addEventListener("pointermove", event => {
  if (!drawing) return;

  event.preventDefault();

  const point = canvasPosition(event);

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(point.x, point.y);

  ctx.lineWidth = Number($("brushSize").value);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = $("drawingTool").value === "eraser"
    ? "#fffefa"
    : $("brushColor").value;

  ctx.stroke();

  lastX = point.x;
  lastY = point.y;
});

function stopDrawing() {
  drawing = false;
}

["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
  canvas.addEventListener(type, stopDrawing);
});

$("brushSize").addEventListener("input", () => {
  $("brushSizeValue").textContent = $("brushSize").value + " px";
});

$("clearCanvas").addEventListener("click", () => {
  saveCanvasState();
  clearCanvasBackground();
  showToast("Canvas cleared!");
});

$("undoCanvas").addEventListener("click", () => {
  if (undoStack.length <= 1) return;

  redoStack.push(undoStack.pop());
  restoreCanvasState(undoStack[undoStack.length - 1]);
  updateHistoryButtons();
});

$("redoCanvas").addEventListener("click", () => {
  if (!redoStack.length) return;

  const next = redoStack.pop();
  undoStack.push(next);
  restoreCanvasState(next);
  updateHistoryButtons();
});

$("quickColors").addEventListener?.("click", () => {});

document.querySelectorAll(".quick-colors button").forEach(button => {
  button.addEventListener("click", () => {
    $("brushColor").value = button.dataset.color;
    $("drawingTool").value = "pen";
  });
});

$("downloadSketch").addEventListener("click", downloadSketch);

function downloadSketch() {
  const link = document.createElement("a");
  link.download = "fashion-sketch.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Sketch downloaded!");
}

/* ==========================================
   3D STUDIO
========================================== */

let scene;
let camera;
let renderer;
let model;
let outfit;
let initialized3D = false;
let rotating = true;
let pointerDown = false;
let previousX = 0;
let previousY = 0;
let zoom = 8;

const THREE = window.THREE;

function material(color, roughness = 0.65, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function mesh(parent, geometry, mat, x, y, z) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function ball(parent, mat, x, y, z, sx, sy, sz) {
  const object = mesh(
    parent,
    new THREE.SphereGeometry(1, 32, 24),
    mat, x, y, z
  );

  object.scale.set(sx, sy, sz);
  return object;
}

function cylinder(parent, mat, x, y, z, rt, rb, h) {
  return mesh(
    parent,
    new THREE.CylinderGeometry(rt, rb, h, 48),
    mat, x, y, z
  );
}

function segment(parent, mat, a, b, radius) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);

  const object = mesh(
    parent,
    new THREE.CylinderGeometry(radius * 0.85, radius, direction.length(), 24),
    mat, 0, 0, 0
  );

  object.position.copy(start).add(end).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return object;
}

function initialize3D() {
  if (initialized3D) return;

  if (!THREE) {
    showToast("3D library unavailable. Check your internet connection.");
    return;
  }

  const container = $("threeContainer");

  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9dfd2");

    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 2.4, zoom);
    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#ffffff", "#a58b75", 2));

    const keyLight = new THREE.DirectionalLight("#fff4e7", 3);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fill = new THREE.DirectionalLight("#f0cbd3", 1.5);
    fill.position.set(-4, 4, 3);
    scene.add(fill);

    const floor = mesh(
      scene,
      new THREE.CircleGeometry(5, 80),
      material("#d7c7b6", 0.9),
      0, -0.12, 0
    );
    floor.rotation.x = -Math.PI / 2;

    cylinder(
      scene, material("#f9f2e9", 0.35),
      0, 0.02, 0, 1.45, 1.52, 0.16
    );

    const ring = mesh(
      scene,
      new THREE.TorusGeometry(1.47, 0.018, 12, 90),
      material("#c5a16b", 0.3, 0.5),
      0, 0.11, 0
    );
    ring.rotation.x = Math.PI / 2;

    createModel();
    updateOutfit();
    setup3DControls();

    initialized3D = true;
    resize3D();
    animate3D();
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="loading-message">Unable to start 3D preview. Try refreshing the page.</p>';
    showToast("3D preview could not start.");
  }
}

/* ==========================================
   MANNEQUIN
========================================== */

function createModel() {
  model = new THREE.Group();

  const skin = material("#d9b99d");
  const skinLight = material("#e5c9ae");
  const hair = material("#30211f", 0.45);
  const dark = material("#302321");

  // Body and neck
  cylinder(model, skin, 0, 2.48, 0, 0.34, 0.39, 0.92);
  cylinder(model, skinLight, 0, 3.08, 0, 0.11, 0.11, 0.24);

  // Head and hair
  ball(model, skinLight, 0, 3.48, 0, 0.25, 0.33, 0.23);
  ball(model, hair, 0, 3.68, -0.015, 0.26, 0.16, 0.24);
  ball(model, hair, 0, 3.43, -0.13, 0.23, 0.30, 0.15);

  // Face details
  ball(model, dark, -0.09, 3.52, 0.21, 0.027, 0.018, 0.018);
  ball(model, dark, 0.09, 3.52, 0.21, 0.027, 0.018, 0.018);

  // Shoulders
  ball(model, skin, -0.43, 2.90, 0, 0.20, 0.16, 0.18);
  ball(model, skin, 0.43, 2.90, 0, 0.20, 0.16, 0.18);

  // Arms
  segment(model, skin, [-0.48, 2.90, 0], [-0.61, 2.36, 0], 0.10);
  segment(model, skin, [-0.61, 2.36, 0], [-0.66, 1.93, 0], 0.085);
  segment(model, skin, [0.48, 2.90, 0], [0.61, 2.36, 0], 0.10);
  segment(model, skin, [0.61, 2.36, 0], [0.66, 1.93, 0], 0.085);

  ball(model, skinLight, -0.66, 1.83, 0, 0.08, 0.12, 0.06);
  ball(model, skinLight, 0.66, 1.83, 0, 0.08, 0.12, 0.06);

  // Hips
  ball(model, skin, 0, 1.76, 0, 0.38, 0.30, 0.25);

  // Legs
  segment(model, skin, [-0.19, 1.60, 0], [-0.20, 0.78, 0], 0.13);
  segment(model, skin, [0.19, 1.60, 0], [0.20, 0.78, 0], 0.13);
  segment(model, skin, [-0.20, 0.78, 0], [-0.20, 0.20, 0], 0.095);
  segment(model, skin, [0.20, 0.78, 0], [0.20, 0.20, 0], 0.095);

  ball(model, skinLight, -0.20, 0.12, 0.08, 0.12, 0.09, 0.22);
  ball(model, skinLight, 0.20, 0.12, 0.08, 0.12, 0.09, 0.22);

  scene.add(model);
}

/* ==========================================
   OUTFIT DESIGN
========================================== */

function makeFabric() {
  const color = $("fabricColor").value;
  const fabricType = $("fabricType").value;
  const pattern = $("fabricPattern").value;

  let roughness = 0.65;
  let metalness = 0.01;

  if (fabricType === "silk" || fabricType === "satin") roughness = 0.25;
  if (fabricType === "denim") roughness = 0.85;
  if (fabricType === "velvet") roughness = 0.95;
  if (pattern === "shiny") {
    roughness = 0.2;
    metalness = 0.12;
  }
  if (pattern === "soft") roughness = 0.9;

  return material(color, roughness, metalness);
}

function createOutfitDetails(group, fabric, type) {
  const gold = material("#c5a16b", 0.3, 0.5);
  const pattern = $("fabricPattern").value;

  if (pattern === "striped") {
    const stripe = material("#f3e7d6");

    for (let i = 0; i < 4; i++) {
      const line = cylinder(
        group, stripe, 0, 2.55 - i * 0.12, 0,
        0.355 - i * 0.01, 0.355 - i * 0.01, 0.018
      );
    }
  }

  if (pattern === "floral") {
    const flower = material("#f5d9bd");
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10;
      ball(
        group, flower,
        Math.sin(angle) * 0.32,
        2.48 + Math.cos(angle) * 0.23,
        0.20,
        0.035, 0.035, 0.025
      );
    }
  }

  if (["shirt", "blouse", "traditional", "ethnic"].includes(type)) {
    for (let i = 0; i < 5; i++) {
      ball(
        group, gold, 0, 2.79 - i * 0.13, 0.34,
        0.018, 0.018, 0.012
      );
    }
  }

  const accessory = $("accessoryType").value;

  if (accessory === "necklace") {
    const necklace = mesh(
      group,
      new THREE.TorusGeometry(0.17, 0.018, 10, 50),
      gold, 0, 3.01, 0.08
    );
    necklace.rotation.x = Math.PI / 2;
  }

  if (accessory === "belt") {
    const belt = cylinder(
      group, gold, 0, 1.99, 0,
      0.40, 0.40, 0.07
    );
  }

  if (accessory === "bag") {
    mesh(
      group, new THREE.BoxGeometry(0.24, 0.30, 0.14),
      material("#654638"), 0.72, 1.90, 0.05
    );
    const strap = mesh(
      group,
      new THREE.TorusGeometry(0.15, 0.015, 8, 30),
      gold, 0.72, 2.09, 0.05
    );
  }

  if (accessory === "hat") {
    cylinder(group, fabric, 0, 3.89, 0, 0.25, 0.25, 0.09);
    cylinder(group, fabric, 0, 3.84, 0, 0.35, 0.35, 0.035);
  }
}

function updateOutfit() {
  if (!model) return;

  if (outfit) {
    model.remove(outfit);

    outfit.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  outfit = new THREE.Group();

  const type = $("outfitType").value;
  const fabric = makeFabric();

  // Tops and outerwear
  if (["top", "shirt", "tshirt", "blouse", "crop",
       "jacket", "blazer", "hoodie"].includes(type)) {

    let length = 0.86;
    if (type === "crop") length = 0.55;
    if (type === "hoodie") length = 1.0;

    cylinder(
      outfit, fabric, 0, 2.48, 0,
      0.40, 0.35, length
    );

    const sleeveLength = type === "tshirt" || type === "crop" ? 0.30 : 0.48;

    segment(outfit, fabric, [-0.43, 2.88, 0], [-0.61, 2.88 - sleeveLength, 0], 0.12);
    segment(outfit, fabric, [0.43, 2.88, 0], [0.61, 2.88 - sleeveLength, 0], 0.12);

    if (type === "jacket" || type === "blazer") {
      const opening = mesh(
        outfit,
        new THREE.BoxGeometry(0.025, 0.85, 0.025),
        material("#f4e5d3"), 0, 2.48, 0.36
      );
    }

    if (type === "hoodie") {
      ball(outfit, fabric, 0, 3.03, -0.08, 0.23, 0.19, 0.16);
    }
  }

  // Bottoms
  if (type === "trousers" || type === "jeans" || type === "shorts") {
    const isShort = type === "shorts";
    const legLength = isShort ? 0.38 : 1.42;
    const radius = type === "jeans" ? 0.16 : 0.145;

    [-1, 1].forEach(side => {
      cylinder(
        outfit, fabric,
        side * 0.20,
        1.73 - legLength / 2,
        0,
        radius, radius * 0.8, legLength
      );
    });

    cylinder(outfit, fabric, 0, 1.99, 0, 0.41, 0.38, 0.18);
  }

  // Skirt
  if (type === "skirt") {
    cylinder(outfit, fabric, 0, 1.48, 0, 0.76, 0.39, 1.02);
  }

  // Dresses
  if (["dress", "gown", "maxi", "party"].includes(type)) {
    cylinder(outfit, fabric, 0, 2.50, 0, 0.40, 0.35, 0.85);

    const hem = type === "party" ? 1.20 : type === "maxi" ? 0.35 : 0.72;
    const width = type === "gown" ? 1.05 : 0.78;

    const skirt = mesh(
      outfit,
      new THREE.CylinderGeometry(width, width * 1.18, 2.05 - hem, 64),
      fabric, 0, (2.05 + hem) / 2, 0
    );
  }

  // Traditional and ethnic outfits
  if (type === "traditional" || type === "ethnic") {
    cylinder(outfit, fabric, 0, 2.48, 0, 0.38, 0.35, 0.65);
    segment(outfit, fabric, [-0.43, 2.85, 0], [-0.60, 2.45, 0], 0.12);
    segment(outfit, fabric, [0.43, 2.85, 0], [0.60, 2.45, 0], 0.12);

    mesh(
      outfit,
      new THREE.CylinderGeometry(0.42, 0.90, 1.35, 64),
      fabric, 0, 1.25, 0
    );

    const border = cylinder(
      outfit, material("#c5a16b", 0.3, 0.5),
      0, 0.64, 0, 0.88, 0.88, 0.07
    );
  }

  createOutfitDetails(outfit, fabric, type);
  model.add(outfit);
}

[
  "outfitType",
  "fabricColor",
  "fabricPattern",
  "fabricType",
  "accessoryType"
].forEach(id => {
  $(id).addEventListener("change", () => {
    $("colorValue").textContent = $("fabricColor").value.toUpperCase();
    updateOutfit();
  });

  $(id).addEventListener("input", () => {
    if (id === "fabricColor") {
      $("colorValue").textContent = $("fabricColor").value.toUpperCase();
      updateOutfit();
    }
  });
});

document.querySelectorAll(".swatches button").forEach(button => {
  button.addEventListener("click", () => {
    $("fabricColor").value = button.dataset.color;
    $("colorValue").textContent = button.dataset.color.toUpperCase();
    updateOutfit();
  });
});

$("applyOutfit").addEventListener("click", () => {
  updateOutfit();
  showToast("Your outfit design has been applied!");
});

/* ==========================================
   3D ROTATION AND ZOOM
========================================== */

function setup3DControls() {
  const element = renderer.domElement;

  element.addEventListener("pointerdown", event => {
    pointerDown = true;
    previousX = event.clientX;
    previousY = event.clientY;
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", event => {
    if (!pointerDown || !model) return;

    const dx = event.clientX - previousX;
    const dy = event.clientY - previousY;

    model.rotation.y += dx * 0.008;
    model.rotation.x = Math.max(
      -0.25,
      Math.min(0.25, model.rotation.x + dy * 0.002)
    );

    previousX = event.clientX;
    previousY = event.clientY;
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
    element.addEventListener(type, () => {
      pointerDown = false;
    });
  });

  element.addEventListener("wheel", event => {
    event.preventDefault();
    zoom = Math.max(5, Math.min(11, zoom + event.deltaY * 0.008));
    camera.position.z = zoom;
  }, { passive: false });
}

$("rotateModel").addEventListener("click", () => {
  rotating = !rotating;
  $("rotateModel").textContent = rotating
    ? "Ⅱ Pause rotation"
    : "▶ Resume rotation";
});

function resize3D() {
  if (!renderer || !camera) return;

  const container = $("threeContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate3D() {
  if (!renderer) return;

  requestAnimationFrame(animate3D);

  if (rotating && model && !pointerDown) {
    model.rotation.y += 0.003;
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", resize3D);

$("download3D").addEventListener("click", () => {
  if (!renderer || !initialized3D) {
    showToast("Open the 3D studio first.");
    return;
  }

  try {
    renderer.render(scene, camera);

    const link = document.createElement("a");
    link.download = "fashion-3d-preview.png";
    link.href = renderer.domElement.toDataURL("image/png");
    link.click();

    showToast("3D preview downloaded!");
  } catch (error) {
    showToast("Unable to download preview.");
  }
});

/* ==========================================
   SAVE AND LOAD DESIGNS
========================================== */

function getDesignSettings() {
  return {
    type: $("outfitType").value,
    color: $("fabricColor").value,
    pattern: $("fabricPattern").value,
    fabric: $("fabricType").value,
    accessory: $("accessoryType").value
  };
}

function getPreview() {
  if (currentPage === "sketch") {
    return canvas.toDataURL("image/png");
  }

  if (initialized3D && renderer) {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  }

  return "";
}

function loadSavedDesigns() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    savedDesigns = Array.isArray(data) ? data : [];
  } catch (error) {
    savedDesigns = [];
  }

  updateCollectionCount();
}

function persistDesigns() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDesigns));
    updateCollectionCount();
    return true;
  } catch (error) {
    showToast("Storage full. Delete s
