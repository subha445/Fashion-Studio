
/* ==========================================
   FASHION STUDIO
   2D + 3D COMPLETE EDITION
========================================== */

const $ = (id) => document.getElementById(id);

let currentPage = "sketch";
let savedDesigns = [];
let scene, camera, renderer, mannequin, outfit;
let animationId = null;
let rotating = true;
let initialized3D = false;

// ==========================================
// NOTIFICATION
// ==========================================

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

// ==========================================
// NAVIGATION
// ==========================================

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.tab;
        if (!page) return;

        currentPage = page;

        document.querySelectorAll(".tab").forEach(tab =>
            tab.classList.toggle("active", tab === button)
        );

        document.querySelectorAll(".page").forEach(section =>
            section.classList.toggle("active", section.id === page)
        );

        if (page === "mannequin") {
            initialize3D();
            resize3D();
        }

        if (page === "collection") {
            renderCollection();
        }
    });
});

// ==========================================
// 2D DRAWING STUDIO
// ==========================================

const canvas = $("designCanvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let lastX = 0;
let lastY = 0;

function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
    };
}

canvas.addEventListener("pointerdown", event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);

    const position = getCanvasPosition(event);
    lastX = position.x;
    lastY = position.y;
});

canvas.addEventListener("pointermove", event => {
    if (!drawing) return;

    const position = getCanvasPosition(event);

    const tool = $("drawingTool").value;
    const color = $("brushColor").value;
    const size = Number($("brushSize").value);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(position.x, position.y);

    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = tool === "eraser" ? "#fffefa" : color;

    ctx.stroke();

    lastX = position.x;
    lastY = position.y;
});

function stopDrawing() {
    drawing = false;
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("lostpointercapture", stopDrawing);

$("clearCanvas").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showToast("Canvas cleared!");
});

$("downloadSketch").addEventListener("click", () => {
    downloadCanvas();
});

function downloadCanvas() {
    const link = document.createElement("a");
    link.download = "my-fashion-sketch.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    showToast("Sketch downloaded!");
}

// ==========================================
// 3D MANNEQUIN STUDIO
// ==========================================

function initialize3D() {
    if (initialized3D) return;

    const container = $("threeContainer");

    if (!window.THREE) {
        showToast("Three.js could not load. Check your internet connection.");
        return;
    }

    const THREE = window.THREE;

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9dfd2");

    camera = new THREE.PerspectiveCamera(
        38,
        1,
        0.1,
        100
    );

    camera.position.set(0, 2.1, 7.5);
    camera.lookAt(0, 1.8, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // LIGHTING
    const ambient = new THREE.HemisphereLight(
        "#ffffff",
        "#9b826d",
        2
    );

    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight("#ffffff", 3);
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight("#f3d8bd", 1.4);
    fillLight.position.set(-5, 3, 3);
    scene.add(fillLight);

    // FLOOR
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(4, 64),
        new THREE.MeshStandardMaterial({
            color: "#d6c7b7",
            roughness: 0.9
        })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    // BACKGROUND PLATFORM
    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.65, 1.75, 0.13, 64),
        new THREE.MeshStandardMaterial({
            color: "#f8f3eb",
            roughness: 0.7
        })
    );

    platform.position.y = 0.04;
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);

    // MANNEQUIN
    createMannequin();

    // OUTFIT
    updateOutfit();

    // MOUSE / TOUCH ROTATION
    setupModelControls();

    initialized3D = true;

    resize3D();
    animate3D();
}

function createMannequin() {
    const THREE = window.THREE;

    mannequin = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({
        color: "#e7cbb0",
        roughness: 0.65
    });

    function addPart(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mannequin.add(mesh);
        return mesh;
    }

    // HEAD
    addPart(
        new THREE.SphereGeometry(0.24, 32, 32),
        skin,
        0, 3.48, 0
    );

    // NECK
    addPart(
        new THREE.CylinderGeometry(0.105, 0.12, 0.3, 24),
        skin,
        0, 3.17, 0
    );

    // BODY
    addPart(
        new THREE.CylinderGeometry(0.32, 0.43, 1.05, 32),
        skin,
        0, 2.5, 0
    );

    // WAIST
    addPart(
        new THREE.CylinderGeometry(0.34, 0.35, 0.35, 32),
        skin,
        0, 1.82, 0
    );

    // HIPS
    addPart(
        new THREE.SphereGeometry(0.4, 32, 24),
        skin,
        0, 1.58, 0
    );

    // ARMS
    addPart(
        new THREE.CylinderGeometry(0.105, 0.13, 1.1, 20),
        skin,
        -0.53, 2.42, 0,
        0, 0, 0.12
    );

    addPart(
        new THREE.CylinderGeometry(0.105, 0.13, 1.1, 20),
        skin,
        0.53, 2.42, 0,
        0, 0, -0.12
    );

    // HANDS
    addPart(
        new THREE.SphereGeometry(0.12, 20, 20),
        skin,
        -0.59, 1.84, 0
    );

    addPart(
        new THREE.SphereGeometry(0.12, 20, 20),
        skin,
        0.59, 1.84, 0
    );

    // LEGS
    addPart(
        new THREE.CylinderGeometry(0.17, 0.13, 1.35, 24),
        skin,
        -0.19, 0.86, 0
    );

    addPart(
        new THREE.CylinderGeometry(0.17, 0.13, 1.35, 24),
        skin,
        0.19, 0.86, 0
    );

    // FEET
    addPart(
        new THREE.SphereGeometry(0.17, 24, 16),
        skin,
        -0.19, 0.16, 0.09
    );

    addPart(
        new THREE.SphereGeometry(0.17, 24, 16),
        skin,
        0.19, 0.16, 0.09
    );

    scene.add(mannequin);
}

// ==========================================
// OUTFIT GENERATOR
// ==========================================

function updateOutfit() {
    if (!scene || !window.THREE) return;

    const THREE = window.THREE;

    if (outfit) {
        mannequin.remove(outfit);

        outfit.traverse(object => {
            if (object.geometry) object.geometry.dispose();

            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    outfit = new THREE.Group();

    const type = $("outfitType").value;
    const color = $("fabricColor").value;
    const pattern = $("fabricPattern").value;

    const shiny = pattern === "shiny";

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: shiny ? 0.24 : pattern === "soft" ? 0.82 : 0.55,
        metalness: shiny ? 0.32 : 0.02,
        side: THREE.DoubleSide
    });

    function addClothing(geometry, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        outfit.add(mesh);
    }

    if (type === "top") {
        addClothing(
            new THREE.CylinderGeometry(0.36, 0.43, 1.16, 48),
            0, 2.48, 0
        );

        addClothing(
            new THREE.SphereGeometry(0.36, 32, 16),
            0, 2.93, 0
        );
    }

    if (type === "skirt") {
        addClothing(
            new THREE.CylinderGeometry(0.84, 0.39, 1.3, 64, 1, false),
            0, 1.35, 0
        );
    }

    if (type === "gown") {
        addClothing(
            new THREE.CylinderGeometry(0.87, 0.43, 2.15, 64, 1, false),
            0, 1.82, 0
        );

        addClothing(
            new THREE.SphereGeometry(0.36, 32, 16),
            0, 2.93, 0
        );
    }

    // Decorative waist band
    if (type !== "top") {
        const bandMaterial = new THREE.MeshStandardMaterial({
            color: shiny ? "#d9bb79" : color,
            metalness: shiny ? 0.65 : 0.1,
            roughness: 0.4
        });

        const band = new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.035, 12, 64),
            bandMaterial
        );

        band.position.y = type === "skirt" ? 2.02 : 2.65;
        band.rotation.x = Math.PI / 2;
        outfit.add(band);
    }

    mannequin.add(outfit);
}

// ==========================================
// FABRIC CONTROLS
// ==========================================

$("applyOutfit").addEventListener("click", () => {
    if (!initialized3D) initialize3D();

    updateOutfit();
    showToast("Your outfit has been updated!");
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
// ROTATION AND ZOOM
// ==========================================

function setupModelControls() {
    const container = $("threeContainer");

    let dragging = false;
    let previousX = 0;
    let previousY = 0;

    container.addEventListener("pointerdown", event => {
        dragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
        container.setPointerCapture(event.pointerId);
    });

    container.addEventListener("pointermove", event => {
        if (!dragging || !mannequin) return;

        const dx = event.clientX - previousX;
        const dy = event.clientY - previousY;

        mannequin.rotation.y += dx * 0.008;

        camera.position.y = Math.max(
            1.3,
            Math.min(3.4, camera.position.y + dy * 0.008)
        );

        camera.lookAt(0, 1.8, 0);

        previousX = event.clientX;
        previousY = event.clientY;
    });

    function stopDrag() {
        dragging = false;
    }

    container.addEventListener("pointerup", stopDrag);
    container.addEventListener("pointercancel", stopDrag);
    container.addEventListener("lostpointercapture", stopDrag);

    container.addEventListener("wheel", event => {
        event.preventDefault();

        camera.position.z = Math.max(
            5,
            Math.min(10, camera.position.z + event.deltaY * 0.005)
        );

        camera.lookAt(0, 1.8, 0);
    }, { passive: false });
}

// ==========================================
// ROTATION BUTTON
// ==========================================

$("rotateModel").addEventListener("click", () => {
    rotating = !rotating;

    $("rotateModel").textContent =
        rotating ? "Pause Rotation" : "Start Rotation";

    showToast(rotating ? "Rotation started" : "Rotation paused");
});

// ==========================================
// ANIMATION
// ==========================================

function animate3D() {
    animationId = requestAnimationFrame(animate3D);

    if (rotating && mannequin && currentPage === "mannequin") {
        mannequin.rotation.y += 0.003;
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
// SAVE DESIGN
// ==========================================

function getDesignPreview() {
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
        savedDesigns = JSON.parse(
            localStorage.getItem("fashionDesigns")
        ) || [];

        if (!Array.isArray(savedDesigns)) savedDesigns = [];
    } catch {
        savedDesigns = [];
    }
}

function saveDesign() {
    const name = prompt("Give your design a name:");

    if (!name || !name.trim()) return;

    const design = {
        id: Date.now(),
        name: name.trim(),
        page: currentPage,
        type: $("outfitType").value,
        color: $("fabricColor").value,
        pattern: $("fabricPattern").value,
        preview: getDesignPreview(),
        sketch: canvas.toDataURL("image/png"),
        date: new Date().toLocaleDateString()
    };

    savedDesigns.unshift(design);

    try {
        localStorage.setItem(
            "fashionDesigns",
            JSON.stringify(savedDesigns)
        );

        showToast("Design saved successfully!");
    } catch (error) {
        savedDesigns.shift();
        showToast("Storage full. Delete some saved designs.");
    }
}

$("saveDesign").addEventListener("click", saveDesign);

// ==========================================
// COLLECTION
// ==========================================

function renderCollection() {
    const grid = $("collectionGrid");
    const empty = $("emptyMessage");

    grid.innerHTML = "";

    loadSavedDesigns();

    empty.style.display = savedDesigns.length ? "none" : "block";

    savedDesigns.forEach(design => {
        const card = document.createElement("div");
        card.className = "collection-item";

        const preview = document.createElement("div");
        preview.className = "collection-preview";

        if (design.preview) {
            const image = document.createElement("img");
            image.src = design.preview;
            image.alt = "Saved fashion design";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "contain";
            preview.appendChild(image);
        } else {
            preview.textContent = "👗";
        }

        const title = document.createElement("h3");
        title.textContent = design.name;

        const details = document.createElement("p");
        details.textContent =
            `${design.type.toUpperCase()} • ${design.date}`;

        const loadButton = document.createElement("button");
        loadButton.textContent = "Load Design";

        loadButton.addEventListener("click", () => {
            loadDesign(design);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.style.marginLeft = "7px";

        deleteButton.addEventListener("click", () => {
            deleteDesign(design.id);
        });

        card.append(
            preview,
            title,
            details,
            loadButton,
            deleteButton
        );

        grid.appendChild(card);
    });
}

function loadDesign(design) {
    $("outfitType").value = design.type;
    $("fabricColor").value = design.color;
    $("fabricPattern").value = design.pattern;

    if (design.sketch) {
        const image = new Image();

        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        };

        image.src = design.sketch;
    }

    if (initialized3D) updateOutfit();

    showToast("Design loaded!");
}

function deleteDesign(id) {
    if (!confirm("Delete this design?")) return;

    savedDesigns = savedDesigns.filter(design => design.id !== id);

    localStorage.setItem(
        "fashionDesigns",
        JSON.stringify(savedDesigns)
    );

    renderCollection();
    showToast("Design deleted!");
}

// ==========================================
// START APPLICATION
// ==========================================

loadSavedDesigns();

console.log("Fashion Studio loaded successfully!");
