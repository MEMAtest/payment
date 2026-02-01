
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-3d');
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 20); // Moved back slightly
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- 1. The Core Particle Globe ---
    const particlesGeometry = new THREE.BufferGeometry();
    const count = 1200; // Even denser for a rich look

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    const colorPrimary = new THREE.Color(0x2a9d8f); // Sea
    const colorGold = new THREE.Color(0xf4b83f); // Sun
    const colorWhite = new THREE.Color(0xffffff); // White

    for (let i = 0; i < count; i++) {
        // Uniform sphere distribution
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;

        // Varying radius for "Atmosphere" depth
        const rBase = 6.5;
        const radius = rBase + (Math.random() * 1.5);

        let x = radius * Math.cos(theta) * Math.sin(phi);
        let y = radius * Math.sin(theta) * Math.sin(phi);
        let z = radius * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Gradient coloring - more organic
        let mixedColor;
        const rand = Math.random();
        if (rand > 0.8) mixedColor = colorGold;
        else if (rand > 0.5) mixedColor = colorWhite;
        else mixedColor = colorPrimary;

        colors[i * 3] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;

        scales[i] = Math.random();
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particlesGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    const globe = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(globe);


    // --- Animation Loop ---
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.003;

        // Rotate Model
        globe.rotation.y = time * 0.4;

        // Gentle float of entire scene
        scene.position.y = Math.sin(time) * 0.2;

        renderer.render(scene, camera);
    }

    animate();

    // --- Interaction ---
    let mouseX = 0;
    let mouseY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX) * 0.0005;
        mouseY = (event.clientY - windowHalfY) * 0.0005;

        scene.rotation.x += (mouseY - scene.rotation.x) * 0.05;
        scene.rotation.y += (mouseX - scene.rotation.y) * 0.05;
    });

    window.addEventListener('resize', () => {
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
});
