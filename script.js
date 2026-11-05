/* ==========================================
   FASHION STUDIO — PREMIUM 3D EDITION
========================================== */

const $ = id => document.getElementById(id);

let currentPage = "sketch";
let savedDesigns = [];
let scene, camera, renderer, mannequin, outfit;
let initialized3D = false;
let rotating = true;
let animationId = null;

const THREE = window.THREE;

// ==========================================
// NOTIFICATIONS
// ==========================================

function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

// ==========================================
// NAVIGATION
// ==========================================

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
        currentPage = button.dataset.tab;

        document.querySelectorAll(".tab").forEach(tab =>
            tab.classList.toggle("active", tab === button)
        );

        document.querySelectorAll(".page").forEach(page =>
            page.classList.toggle("active", page.id === currentPage)
        );

        if (currentPage === "mannequin") {
            initialize3D();
            setTimeout(resize3D, 100);
        }

        if (currentPage === "collection") {
            renderCollection();
        }
    });
});

// ==========================================
// 2D SKETCH STUDIO
// ==========================================

const canvas = $("designCanvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;

function canvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
    };
}

canvas.addEventListener("pointerdown", event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);

    const point = canvasPosition(event);
    lastX = point.x;
    lastY = point.y;
});

canvas.addEventListener("pointermove", event => {
    if (!drawing) return;

    const point = canvasPosition(event);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(point.x, point.y);

    ctx.lineWidth = Number($("brushSize").value);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle =
        $("drawingTool").value === "eraser"
            ? "#fffefa"
            : $("brushColor").value;

    ctx.stroke();

    lastX = point.x;
    lastY = point.y;
});

["pointerup", "pointercancel", "lostpointercapture"].forEach(event => {
    canvas.addEventListener(event, () => drawing = false);
});

$("clearCanvas").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showToast("Sketch cleared");
});

$("downloadSketch").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "fashion-sketch.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});

// ==========================================
// 3D MATERIALS AND HELPERS
// ==========================================

function material(color, roughness = 0.6, metalness = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });
}

function addMesh(parent, geometry, mat, x, y, z) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function addBall(parent, mat, x, y, z, sx, sy, sz) {
    const mesh = addMesh(
        parent,
        new THREE.SphereGeometry(1, 32, 24),
        mat,
        x, y, z
    );

    mesh.scale.set(sx, sy, sz);
    return mesh;
}

function addSegment(parent, mat, start, end, radius) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);

    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();

    const mesh = addMesh(
        parent,
        new THREE.CylinderGeometry(
            radius * 0.88,
            radius,
            length,
            24
        ),
        mat,
        0, 0, 0
    );

    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
    );

    return mesh;
}

function addLathe(parent, points, mat) {
    const geometry = new THREE.LatheGeometry(
        points.map(point => new THREE.Vector2(point[0], point[1])),
        64
    );

    return addMesh(parent, geometry, mat, 0, 0, 0);
}

// ==========================================
// INITIALISE SHOWROOM
// ==========================================

function initialize3D() {
    if (initialized3D) return;

    if (!THREE) {
        showToast("3D library not loaded. Check your internet.");
        return;
    }

    const container = $("threeContainer");

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9dfd2");

    camera = new THREE.PerspectiveCamera(
        35, 1, 0.1, 100
    );

    camera.position.set(0, 2.35, 8.3);
    camera.lookAt(0, 1.85, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // SHOWROOM LIGHTING

    scene.add(
        new THREE.HemisphereLight("#ffffff", "#a58b75", 2)
    );

    const keyLight = new THREE.DirectionalLight("#fff6e8", 3);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#e8c8d0", 1.6);
    fillLight.position.set(-5, 4, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight("#f5d5a8", 1.5, 12);
    rimLight.position.set(0, 4, -3);
    scene.add(rimLight);

    // FLOOR

    const floor = addMesh(
        scene,
        new THREE.CircleGeometry(5, 80),
        material("#d7c7b6", 0.9),
        0, -0.12, 0
    );

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    // DISPLAY PLATFORM

    const platform = addMesh(
        scene,
        new THREE.CylinderGeometry(1.45, 1.52, 0.16, 80),
        material("#f9f2e9", 0.35),
        0, 0.02, 0
    );

    platform.castShadow = true;

    const goldRing = addMesh(
        scene,
        new THREE.TorusGeometry(1.47, 0.018, 12, 90),
        material("#c5a16b", 0.3, 0.65),
        0, 0.105, 0
    );

    goldRing.rotation.x = Math.PI / 2;

    createMannequin();
    updateOutfit();
    setupModelControls();

    initialized3D = true;

    resize3D();
    animate3D();
}

// ==========================================
// DETAILED MANNEQUIN
// ==========================================

function createMannequin() {
    mannequin = new THREE.Group();

    const skin = material("#d9b99d", 0.72);
    const skinLight = material("#e5c9ae", 0.7);
    const hair = material("#30211f", 0.42);
    const dark = material("#302321", 0.35);
    const lips = material("#a75f63", 0.5);

    // TORSO — SMOOTH BODY SHAPE

    addLathe(mannequin, [
        [0.20, 1.72],
        [0.29, 1.82],
        [0.36, 2.02],
        [0.32, 2.22],
        [0.35, 2.48],
        [0.44, 2.78],
        [0.47, 2.94],
        [0.31, 3.04],
        [0.17, 3.12]
    ], skin);

    // NECK

    addLathe(mannequin, [
        [0.105, 3.02],
        [0.105, 3.15],
        [0.12, 3.25]
    ], skinLight);

    // HEAD AND FACE

    addBall(
        mannequin, skinLight,
        0, 3.52, 0,
        0.255, 0.34, 0.235
    );

    // JAW

    addBall(
        mannequin, skinLight,
        0, 3.36, 0.035,
        0.19, 0.16, 0.19
    );

    // EARS

    addBall(mannequin, skin, -0.255, 3.52, 0, 0.045, 0.075, 0.055);
    addBall(mannequin, skin, 0.255, 3.52, 0, 0.045, 0.075, 0.055);

    // NOSE

    addBall(
        mannequin, skin,
        0, 3.51, 0.226,
        0.045, 0.075, 0.065
    );

    // EYES

    addBall(mannequin, dark, -0.095, 3.56, 0.207, 0.035, 0.023, 0.018);
    addBall(mannequin, dark, 0.095, 3.56, 0.207, 0.035, 0.023, 0.018);

    // EYE HIGHLIGHTS

    addBall(mannequin, skinLight, -0.103, 3.57, 0.224, 0.009, 0.009, 0.008);
    addBall(mannequin, skinLight, 0.087, 3.57, 0.224, 0.009, 0.009, 0.008);

    // EYEBROWS

    addSegment(
        mannequin, hair,
        [-0.15, 3.61, 0.205],
        [-0.045, 3.62, 0.215],
        0.012
    );

    addSegment(
        mannequin, hair,
        [0.045, 3.62, 0.215],
        [0.15, 3.61, 0.205],
        0.012
    );

    // LIPS

    addBall(
        mannequin, lips,
        0, 3.40, 0.205,
        0.065, 0.018, 0.015
    );

    // HAIR CAP

    const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.265, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.56
        ),
        hair
    );

    hairCap.position.set(0, 3.58, -0.005);
    hairCap.castShadow = true;
    mannequin.add(hairCap);

    // BACK HAIR

    addBall(
        mannequin, hair,
        0, 3.39, -0.12,
        0.245, 0.32, 0.17
    );

    // HAIR SIDES

    addBall(mannequin, hair, -0.225, 3.47, -0.015, 0.065, 0.22, 0.085);
    addBall(mannequin, hair, 0.225, 3.47, -0.015, 0.065, 0.22, 0.085);

    // SHOULDERS

    addBall(mannequin, skin, -0.43, 2.91, 0, 0.20, 0.16, 0.18);
    addBall(mannequin, skin, 0.43, 2.91, 0, 0.20, 0.16, 0.18);

    // ARMS

    const arms = [
        [-0.49, 2.91, 0, -0.61, 2.42, 0],
        [-0.61, 2.42, 0, -0.66, 1.96, 0.02],
        [0.49, 2.91, 0, 0.61, 2.42, 0],
        [0.61, 2.42, 0, 0.66, 1.96, 0.02]
    ];

    arms.forEach(points => {
        addSegment(
            mannequin,
            skin,
            points.slice(0, 3),
            points.slice(3, 6),
            0.105
        );
    });

    // ELBOWS

    addBall(mannequin, skin, -0.61, 2.42, 0, 0.105, 0.11, 0.105);
    addBall(mannequin, skin, 0.61, 2.42, 0, 0.105, 0.11, 0.105);

    // PALMS

    addBall(mannequin, skinLight, -0.67, 1.84, 0.025, 0.095, 0.13, 0.065);
    addBall(mannequin, skinLight, 0.67, 1.84, 0.025, 0.095, 0.13, 0.065);

    // FINGERS

    [-1, 1].forEach(side => {
        for (let i = 0; i < 4; i++) {
            const x = side * (0.61 + i * 0.035);

            addSegment(
                mannequin,
                skinLight,
                [x, 1.80, 0.04],
                [x + side * 0.012, 1.70, 0.04],
                0.018
            );
        }

        addSegment(
            mannequin,
            skinLight,
            [side * 0.59, 1.86, 0.06],
            [side * 0.54, 1.78, 0.07],
            0.023
        );
    });

    // HIPS

    addBall(
        mannequin, skin,
        0, 1.67, 0,
        0.39, 0.32, 0.25
    );

    // LEGS

    addSegment(
        mannequin, skin,
        [-0.19, 1.56, 0],
        [-0.20, 0.78, 0],
        0.145
    );

    addSegment(
        mannequin, skin,
        [0.19, 1.56, 0],
        [0.20, 0.78, 0],
        0.145
    );

    // KNEES

    addBall(mannequin, skin, -0.20, 0.78, 0, 0.145, 0.15, 0.14);
    addBall(mannequin, skin, 0.20, 0.78, 0, 0.145, 0.15, 0.14);

    // LOWER LEGS

    addSegment(
        mannequin, skin,
        [-0.20, 0.78, 0],
        [-0.20, 0.20, 0],
        0.105
    );

    addSegment(
        mannequin, skin,
        [0.20, 0.78, 0],
        [0.20, 0.20, 0],
        0.105
    );

    // FEET

    addBall(
        mannequin, skinLight,
        -0.20, 0.12, 0.09,
        0.13, 0.10, 0.24
    );

    addBall(
        mannequin, skinLight,
        0.20, 0.12, 0.09,
        0.13, 0.10, 0.24
    );

    scene.add(mannequin);
}

// ==========================================
// TAILORED OUTFIT DESIGNER
// ==========================================

function updateOutfit() {
    if (!mannequin) return;

    if (outfit) {
        mannequin.remove(outfit);
        outfit.traverse(object => {
            if (object.geometry) object.geometry.dispose();
        });
    }

    outfit = new THREE.Group();

    const type = $("outfitType").value;
    const color = $("fabricColor").value;
    const pattern = $("fabricPattern").value;

    const fabric = new THREE.MeshStandardMaterial({
        color,
        roughness:
            pattern === "shiny" ? 0.22 :
            pattern === "soft" ? 0.85 : 0.55,
        metalness: pattern === "shiny" ? 0.25 : 0.02,
        side: THREE.DoubleSide
    });

    const trim = material("#c5a16b", 0.32, 0.55);

    // TOP

    if (type === "top") {
        addLathe(outfit, [
            [0.30, 2.02],
            [0.35, 2.18],
            [0.34, 2.42],
            [0.40, 2.70],
            [0.46, 2.91],
            [0.30, 3.02]
        ], fabric);

        // Sleeves

        addSegment(outfit, fabric,
            [-0.44, 2.91, 0],
            [-0.62, 2.43, 0],
            0.13
        );

        addSegment(outfit, fabric,
            [0.44, 2.91, 0],
            [0.62, 2.43, 0],
            0.13
        );
    }

    // SKIRT

    if (type === "skirt") {
        addLathe(outfit, [
            [0.35, 2.02],
            [0.40, 1.93],
            [0.45, 1.72],
            [0.57, 1.38],
            [0.73, 1.02],
            [0.92, 0.78]
        ], fabric);
    }

    // GOWN

    if (type === "gown") {
        addLathe(outfit, [
            [0.30, 2.02],
            [0.34, 2.20],
            [0.37, 2.50],
            [0.44, 2.82],
            [0.30, 3.02]
        ], fabric);

        addLathe(outfit, [
            [0.36, 2.10],
            [0.42, 1.93],
            [0.48, 1.65],
            [0.61, 1.30],
            [0.78, 0.98],
            [0.96, 0.73]
        ], fabric);

        // Gown sleeves

        addSegment(outfit, fabric,
            [-0.44, 2.91, 0],
            [-0.62, 2.43, 0],
            0.13
        );

        addSegment(outfit, fabric,
            [0.44, 2.91, 0],
            [0.62, 2.43, 0],
            0.13
        );
    }

    // WAIST DETAIL

    if (type !== "top") {
        const belt = addMesh(
            outfit,
            new THREE.TorusGeometry(0.39, 0.035, 12, 64),
            trim,
            0, 2.00, 0
        );

        belt.rotation.x = Math.PI / 2;
    }

    // DECORATIVE FRONT DETAIL

    if (pattern !== "plain") {
        for (let i = 0; i < 5; i++) {
            const detail = addMesh(
                outfit,
                new THREE.SphereGeometry(0.025, 12, 12),
                trim,
                0, 2.65 - i * 0.12, 0.40
            );

            detail.scale.set(0.7, 1, 0.5);
        }
    }

    mannequin.add(outfit);
}

// ==========================================
// OUTFIT CONTROLS
// ==========================================

$("applyOutfit").addEventListener("click", () => {
    if (!initialized3D) initialize3D();
    updateOutfit();
    showToast("New outfit designed!");
});

$("outfitType").addEventListener("change", () => {
    if (initialized3D) updateOutfit();
});

$("fabricColor").addEventListener("input", () => {
    if (initialized3D) updateOutfit();
});

$("fabricPattern").addEventListener("change", () => {
    if (initialized3D) updateOutfit();
});

document.querySelectorAll(".swatches span").forEach(swatch => {
    swatch.addEventListener("click", () => {
        $("fabricColor").value = swatch.dataset.color;
        if (initialized3D) updateOutfit();
    });
});

// ==========================================
// MODEL ROTATION AND ZOOM
// ==========================================

function setupModelControls() {
    const container = $("threeContainer");

    let dragging = false;
    let previousX = 0;

    container.addEventListener("pointerdown", event => {
        dragging = true;
        previousX = event.clientX;
        container.setPointerCapture(event.pointerId);
    });

    container.addEventListener("pointermove", event => {
        if (!dragging || !mannequin) return;

        const difference = event.clientX - previousX;
        mannequin.rotation.y += difference * 0.009;
        previousX = event.clientX;
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
        container.addEventListener(type, () => dragging = false);
    });

    container.addEventListener("wheel", event => {
        event.preventDefault();

        camera.position.z = Math.max(
            5.5,
            Math.min(11, camera.position.z + event.deltaY * 0.005)
        );

        camera.lookAt(0, 1.85, 0);
    }, { passive: false });
}

$("rotateModel").addEventListener("click", () => {
    rotating = !rotating;

    $("rotateModel").textContent =
        rotating ? "Pause Rotation" : "Start Rotation";
});

// ==========================================
// RENDERING
// ==========================================

function animate3D() {
    animationId = requestAnimationFrame(animate3D);

    if (rotating && mannequin && currentPage === "mannequin") {
        mannequin.rotation.y += 0.0025;
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function resize3D() {
    if (!renderer || !camera) return;

    const container = $("threeContainer");
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize3D);

// ==========================================
// SAVE AND COLLECTION
// ==========================================

function loadSavedDesigns() {
    try {
        savedDesigns = JSON.parse(
            localStorage.getItem("fashionDesigns")
        ) || [];
    } catch {
        savedDesigns = [];
    }
}

function saveDesign() {
    const name = prompt("Name your fashion creation:");
    if (!name || !name.trim()) return;

    if (currentPage === "mannequin" && renderer) {
        renderer.render(scene, camera);
    }

    const preview = currentPage === "sketch"
        ? canvas.toDataURL("image/png")
        : renderer
            ? renderer.domElement.toDataURL("image/png")
            : "";

    const design = {
        id: Date.now(),
        name: name.trim(),
        type: $("outfitType").value,
        color: $("fabricColor").value,
        pattern: $("fabricPattern").value,
        preview,
        sketch: canvas.toDataURL("image/png"),
        date: new Date().toLocaleDateString()
    };

    savedDesigns.unshift(design);

    try {
        localStorage.setItem(
            "fashionDesigns",
            JSON.stringify(savedDesigns)
        );
        showToast("Design saved to your collection!");
    } catch {
        savedDesigns.shift();
        showToast("Storage full. Delete an older design.");
    }
}

$("saveDesign").addEventListener("click", saveDesign);

function renderCollection() {
    const grid = $("collectionGrid");
    const empty = $("emptyMessage");

    loadSavedDesigns();
    grid.innerHTML = "";

    empty.style.display = savedDesigns.length ? "none" : "block";

    savedDesigns.forEach(design => {
        const card = document.createElement("div");
        card.className = "collection-item";

        const image = document.createElement("img");
        image.src = design.preview || "";
        image.alt = design.name;
        image.style.width = "100%";
        image.style.height = "160px";
        image.style.objectFit = "contain";

        const title = document.createElement("h3");
        title.textContent = design.name;

        const details = document.createElement("p");
      
details.textContent = `${design.type} • ${design.date}`;

const deleteButton = document.createElement("button");
deleteButton.textContent = "Delete";

deleteButton.addEventListener("click", () => {
    savedDesigns = savedDesigns.filter(
        item => item.id !== design.id
    );

    localStorage.setItem(
        "fashionDesigns",
        JSON.stringify(savedDesigns)
    );

    renderCollection();
});

card.append(image, title, details, deleteButton);
grid.appendChild(card);
});
}

loadSavedDesigns();

