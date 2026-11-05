
/* =========================================
   FASHION STUDIO — COMPLETE EDITION
========================================= */

const $ = id => document.getElementById(id);
const THREE = window.THREE;

let currentPage = "sketch";
let savedDesigns = [];

let scene, camera, renderer;
let mannequin, outfit;
let initialized3D = false;
let rotating = true;
let dragging = false;
let previousX = 0;

const STORAGE_KEY = "fashionDesigns";

/* =========================================
   NOTIFICATIONS
========================================= */

function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

/* =========================================
   NAVIGATION
========================================= */

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
        currentPage = button.dataset.tab;

        document.querySelectorAll(".tab").forEach(tab => {
            tab.classList.toggle("active", tab === button);
        });

        document.querySelectorAll(".page").forEach(page => {
            page.classList.toggle(
                "active",
                page.id === currentPage
            );
        });

        if (currentPage === "mannequin") {
            initialize3D();

            setTimeout(resize3D, 150);
        }

        if (currentPage === "collection") {
            renderCollection();
        }
    });
});

/* =========================================
   2D SKETCH STUDIO
========================================= */

const canvas = $("designCanvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;

ctx.fillStyle = "#fffefa";
ctx.fillRect(0, 0, canvas.width, canvas.height);

function canvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) *
            canvas.width / rect.width,

        y: (event.clientY - rect.top) *
            canvas.height / rect.height
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

["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
    canvas.addEventListener(type, () => {
        drawing = false;
    });
});

$("clearCanvas").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fffefa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    showToast("Canvas cleared!");
});

$("downloadSketch").addEventListener("click", () => {
    const link = document.createElement("a");

    link.download = "my-fashion-sketch.png";
    link.href = canvas.toDataURL("image/png");

    link.click();

    showToast("Sketch downloaded!");
});

/* =========================================
   3D MATERIALS
========================================= */

function createMaterial(color, roughness = 0.6, metalness = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: THREE.DoubleSide
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

function addSegment(parent, mat, start, end, radius, endRadius) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);

    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();

    const mesh = addMesh(
        parent,
        new THREE.CylinderGeometry(
            endRadius || radius,
            radius,
            length,
            32
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

/* =========================================
   3D SHOWROOM
========================================= */

function initialize3D() {
    if (initialized3D) return;

    if (!THREE) {
        showToast("Three.js could not load. Check internet.");
        return;
    }

    const container = $("threeContainer");

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9dfd2");

    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

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

    /* LIGHTING */

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

    /* FLOOR */

    const floor = addMesh(
        scene,
        new THREE.CircleGeometry(5, 80),
        createMaterial("#d7c7b6", 0.9),
        0, -0.12, 0
    );

    floor.rotation.x = -Math.PI / 2;

    /* PLATFORM */

    addMesh(
        scene,
        new THREE.CylinderGeometry(1.45, 1.52, 0.16, 80),
        createMaterial("#f9f2e9", 0.35),
        0, 0.02, 0
    );

    const ring = addMesh(
        scene,
        new THREE.TorusGeometry(1.47, 0.018, 12, 90),
        createMaterial("#c5a16b", 0.3, 0.65),
        0, 0.105, 0
    );

    ring.rotation.x = Math.PI / 2;

    createMannequin();
    updateOutfit();
    setupModelControls();

    initialized3D = true;

    resize3D();
    animate3D();
}

/* =========================================
   BASE FASHION MODEL
========================================= */

function createMannequin() {
    mannequin = new THREE.Group();

    const skin = createMaterial("#d9b99d");
    const skinLight = createMaterial("#e5c9ae");
    const hair = createMaterial("#30211f", 0.42);
    const dark = createMaterial("#302321", 0.35);
    const lips = createMaterial("#a75f63");

    /* BODY */

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

    /* NECK */

    addLathe(mannequin, [
        [0.105, 3.02],
        [0.105, 3.15],
        [0.12, 3.25]
    ], skinLight);

    /* HEAD */

    addBall(
        mannequin, skinLight,
        0, 3.52, 0,
        0.255, 0.34, 0.235
    );

    addBall(
        mannequin, skinLight,
        0, 3.36, 0.035,
        0.19, 0.16, 0.19
    );

    /* EARS */

    addBall(mannequin, skin, -0.255, 3.52, 0,
        0.045, 0.075, 0.055);

    addBall(mannequin, skin, 0.255, 3.52, 0,
        0.045, 0.075, 0.055);

    /* NOSE */

    addBall(
        mannequin, skin,
        0, 3.51, 0.226,
        0.045, 0.075, 0.065
    );

    /* EYES */

    addBall(mannequin, dark, -0.095, 3.56, 0.207,
        0.035, 0.023, 0.018);

    addBall(mannequin, dark, 0.095, 3.56, 0.207,
        0.035, 0.023, 0.018);

    /* MOUTH */

    addBall(
        mannequin, lips,
        0, 3.40, 0.205,
        0.065, 0.018, 0.015
    );

    /* HAIR */

    const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.265, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.56
        ),
        hair
    );

    hairCap.position.set(0, 3.58, -0.005);

    mannequin.add(hairCap);

    addBall(mannequin, hair, 0, 3.39, -0.12,
        0.245, 0.32, 0.17);

    addBall(mannequin, hair, -0.225, 3.47, -0.015,
        0.065, 0.22, 0.085);

    addBall(mannequin, hair, 0.225, 3.47, -0.015,
        0.065, 0.22, 0.085);

    /* SHOULDERS */

    addBall(mannequin, skin, -0.43, 2.91, 0,
        0.20, 0.16, 0.18);

    addBall(mannequin, skin, 0.43, 2.91, 0,
        0.20, 0.16, 0.18);

    /* ARMS */

    const arms = [
        [[-0.49, 2.91, 0], [-0.61, 2.42, 0]],
        [[-0.61, 2.42, 0], [-0.66, 1.96, 0.02]],
        [[0.49, 2.91, 0], [0.61, 2.42, 0]],
        [[0.61, 2.42, 0], [0.66, 1.96, 0.02]]
    ];

    arms.forEach(([a, b]) => {
        addSegment(mannequin, skin, a, b, 0.105);
    });

    /* HANDS */

    addBall(mannequin, skinLight, -0.67, 1.84, 0.025,
        0.095, 0.13, 0.065);

    addBall(mannequin, skinLight, 0.67, 1.84, 0.025,
        0.095, 0.13, 0.065);

    /* FINGERS */

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
    });

    /* HIPS */

    addBall(mannequin, skin, 0, 1.67, 0,
        0.39, 0.32, 0.25);

    /* LEGS */

    addSegment(mannequin, skin,
        [-0.19, 1.56, 0],
        [-0.20, 0.78, 0],
        0.145, 0.13);

    addSegment(mannequin, skin,
        [0.19, 1.56, 0],
        [0.20, 0.78, 0],
        0.145, 0.13);

    addBall(mannequin, skin, -0.20, 0.78, 0,
        0.145, 0.15, 0.14);

    addBall(mannequin, skin, 0.20, 0.78, 0,
        0.145, 0.15, 0.14);

    addSegment(mannequin, skin,
        [-0.20, 0.78, 0],
        [-0.20, 0.20, 0],
        0.105, 0.09);

    addSegment(mannequin, skin,
        [0.20, 0.78, 0],
        [0.20, 0.20, 0],
        0.105, 0.09);

    /* FEET */

    addBall(mannequin, skinLight, -0.20, 0.12, 0.09,
        0.13, 0.10, 0.24);

    addBall(mannequin, skinLight, 0.20, 0.12, 0.09,
        0.13, 0.10, 0.24);

    scene.add(mannequin);
}

/* =========================================
   FABRIC MATERIAL
========================================= */

function getFabricMaterial(color, pattern, fabricType) {
    let roughness = 0.65;
    let metalness = 0.01;

    if (fabricType === "silk" || fabricType === "satin") {
        roughness = 0.25;
    }

    if (fabricType === "denim") {
        roughness = 0.85;
    }

    if (fabricType === "velvet") {
        roughness = 0.95;
    }

    if (pattern === "shiny") {
        roughness = 0.2;
        metalness = 0.12;
    }

    if (pattern === "soft") {
        roughness = 0.9;
    }

    return createMaterial(color, roughness, metalness);
}

/* =========================================
   CLOTHING HELPERS
========================================= */

function createTop(group, fabric, style) {
    let bottom = 2.02;

    if (style === "crop") bottom = 2.36;
    if (style === "shirt") bottom = 1.98;
    if (style === "hoodie") bottom = 1.92;
    if (style === "sweater") bottom = 1.94;

    addLathe(group, [
        [0.30, bottom],
        [0.34, bottom + 0.12],
        [0.34, 2.42],
        [0.40, 2.70],
        [0.46, 2.91],
        [0.30, 3.02]
    ], fabric);

    const sleeveLength =
        style === "tshirt" || style === "crop" ? 2.63 : 2.43;

    addSegment(
        group, fabric,
        [-0.43, 2.91, 0],
        [-0.61, sleeveLength, 0],
        0.13
    );

    addSegment(
        group, fabric,
        [0.43, 2.91, 0],
        [0.61, sleeveLength, 0],
        0.13
    );

    if (style === "shirt" || style === "blouse") {
        const buttons = createMaterial("#f2dfbd", 0.3);

        for (let i = 0; i < 4; i++) {
            addBall(
                group, buttons,
                0, 2.82 - i * 0.16, 0.405,
                0.018, 0.018, 0.012
            );
        }
    }

    if (style === "hoodie") {
        addBall(group, fabric, 0, 3.02, -0.08,
            0.23, 0.20, 0.18);

        addSegment(group, fabric,
            [-0.12, 2.12, 0.33],
            [0.12, 2.12, 0.33],
            0.025);
    }
}

function createSkirt(group, fabric, style) {
    let hem = 0.78;

    if (style === "shorts") hem = 1.40;
    if (style === "trousers") hem = 0.22;
    if (style === "jeans") hem = 0.22;

    const waist = style === "shorts" ? 1.99 : 2.02;

    if (style === "skirt") {
        addLathe(group, [
            [0.35, waist],
            [0.40, 1.90],
            [0.47, 1.62],
            [0.60, 1.25],
            [0.76, hem]
        ], fabric);

        return;
    }

    if (style === "shorts") {
        addLathe(group, [
            [0.36, 2.02],
            [0.42, 1.90],
            [0.43, 1.48],
            [0.24, 1.42]
        ], fabric);

        return;
    }

    [-1, 1].forEach(side => {
        const x = side * 0.20;

        addSegment(
            group, fabric,
            [x, 1.72, 0],
            [x, 0.23, 0],
            style === "jeans" ? 0.15 : 0.14,
            0.105
        );
    });
}

function createDress(group, fabric, style) {
    createTop(group, fabric, "top");

    let hem = 0.72;

    if (style === "party") hem = 1.15;
    if (style === "maxi") hem = 0.30;

    addLathe(group, [
        [0.35, 2.08],
        [0.41, 1.93],
        [0.47, 1.70],
        [0.60, 1.32],
        [0.76, hem],
        [0.88, hem - 0.04]
    ], fabric);
}

/* =========================================
   CLOTHING DESIGNER
========================================= */

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
    const fabricType = $("fabricType").value;
    const accessory = $("accessoryType").value;

    const fabric = getFabricMaterial(
        color,
        pattern,
        fabricType
    );

    const gold = createMaterial("#c5a16b", 0.3, 0.65);

    /* TOPS */

    if (
        ["top", "shirt", "tshirt", "blouse", "crop",
         "jacket", "blazer", "hoodie", "sweater"].includes(type)
    ) {
        createTop(outfit, fabric, type);

        if (type === "jacket" || type === "blazer") {
            addLathe(outfit, [
                [0.36, 1.94],
                [0.39, 2.20],
                [0.41, 2.70],
                [0.47, 2.92]
            ], fabric);

            addSegment(outfit, fabric,
                [-0.44, 2.91, 0],
                [-0.63, 2.40, 0],
                0.14);

            addSegment(outfit, fabric,
                [0.44, 2.91, 0],
                [0.63, 2.40, 0],
                0.14);
        }
    }

    /* BOTTOMS */

    if (["trousers", "jeans", "shorts", "skirt"].includes(type)) {
        createSkirt(outfit, fabric, type);
    }

    /* DRESSES */

    if (["dress", "gown", "maxi", "party"].includes(type)) {
        createDress(outfit, fabric, type);

        if (type === "gown") {
            addLathe(outfit, [
                [0.38, 2.05],
                [0.47, 1.90],
                [0.60, 1.55],
                [0.82, 1.10],
                [1.02, 0.68]
            ], fabric);
        }
    }

    /* TRADITIONAL INSPIRED OPTIONS */

    if (type === "traditional" || type === "ethnic") {
        createTop(outfit, fabric, "blouse");

        addLathe(outfit, [
            [0.36, 2.05],
            [0.42, 1.90],
            [0.50, 1.65],
            [0.72, 1.20],
            [0.88, 0.75]
        ], fabric);

        addMesh(
            outfit,
            new THREE.TorusGeometry(0.39, 0.025, 12, 64),
            gold,
            0, 1.95, 0
        ).rotation.x = Math.PI / 2;
    }

    /* BELT DETAIL */

    if (
        ["trousers", "jeans", "shorts", "skirt"].includes(type)
    ) {
        const belt = addMesh(
            outfit,
            new THREE.TorusGeometry(0.39, 0.025, 12, 64),
            gold,
            0, 2.00, 0
        );

        belt.rotation.x = Math.PI / 2;
    }

    /* PATTERN DETAILS */

    if (pattern === "floral") {
        const flowerMaterial = createMaterial("#f6dfbd", 0.5);

        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;

            addBall(
                outfit,
                flowerMaterial,
                Math.sin(angle) * 0.30,
                2.48 + Math.cos(angle) * 0.18,
                0.35,
                0.035, 0.035, 0.018
            );
        }
    }

    if (pattern === "striped") {
        const stripeMaterial = createMaterial("#f5e9d8", 0.5);

        for (let i = 0; i < 4; i++) {
            addSegment(
                outfit,
                stripeMaterial,
                [-0.24, 2.40 + i * 0.12, 0.35],
                [0.24, 2.40 + i * 0.12, 0.35],
                0.009
            );
        }
    }

    /* ACCESSORIES */

    if (accessory === "bag") {
        const bagMaterial = createMaterial("#654638", 0.55);

        addMesh(
            outfit,
            new THREE.BoxGeometry(0.22, 0.30, 0.13),
            bagMaterial,
            0.76, 1.85, 0.04
        );

        addMesh(
            outfit,
            new THREE.TorusGeometry(0.12, 0.015, 10, 32),
            gold,
            0.76, 2.04, 0.04
        );
    }

    if (accessory === "belt") {
        const belt = addMesh(
            outfit,
            new THREE.TorusGeometry(0.40, 0.035, 12, 64),
            gold,
            0, 2.00, 0
        );

        belt.rotation.x = Math.PI / 2;
    }

    if (accessory === "necklace") {
        const necklace = addMesh(
            outfit,
            new THREE.TorusGeometry(0.15, 0.012, 10, 64),
            gold,
            0, 3.02, 0.08
        );

        necklace.rotation.x = Math.PI / 2;
    }

    if (accessory === "hat") {
        addMesh(
            outfit,
            new THREE.CylinderGeometry(0.22, 0.24, 0.08, 40),
            fabric,
            0, 3.87, 0
        );
    }

    mannequin.add(outfit);
}

/* =========================================
   OUTFIT EVENT CONTROLS
========================================= */

[
    "outfitType",
    "fabricColor",
    "fabricPattern",
    "fabricType",
    "accessoryType"
].forEach(id => {
    $(id).addEventListener("change", () => {
        if (initialized3D) updateOutfit();
    });

    $(id).addEventListener("input", () => {
        if (initialized3D && id === "fabricColor") {
            updateOutfit();
        }
    });
});

$("a
