import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(10, 10, 15);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
const axesHelper = new THREE.AxesHelper(70);
scene.add(axesHelper);

const tiklanabilirObjeler = [];
const labelElements = [];
const lineElements = [];
const devletHaritasi = new Map();

async function evreniYukle() {
    try {
        const response = await fetch('evren.json');
        const data = await response.json();

        const yildizHaritasi = new Map();

        // 1. Yıldızları oluştur ve haritaya kaydet
        data.sistemler.forEach(sistem => {
            const yildizGeometrisi = new THREE.SphereGeometry(0.15, 16, 16);
            const yildizMateryali = new THREE.MeshBasicMaterial({ color: sistem.renk || 0xffffff });
            
            const yildiz = new THREE.Mesh(yildizGeometrisi, yildizMateryali);
            
            if (sistem.devlet) {
                if (!devletHaritasi.has(sistem.devlet)) {
                    devletHaritasi.set(sistem.devlet, []);
                }
                devletHaritasi.get(sistem.devlet).push(yildiz.position);
            }

            yildiz.position.set(sistem.x, sistem.z, sistem.y);
            
            yildiz.userData = {
                isim: sistem.isim,
                gezegenler: sistem.gezegenler
            };
            
            scene.add(yildiz);
            tiklanabilirObjeler.push(yildiz);

            yildizHaritasi.set(sistem.isim, yildiz.position);

            const p = document.createElement('div');
            p.textContent = sistem.isim;
            p.style.color = 'white';
            p.style.fontFamily = "'Oxanium', sans-serif"; 
            p.style.fontSize = '11px';
            p.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            p.style.padding = '2px 6px';
            p.style.borderRadius = '4px';
            p.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            p.style.visibility = 'hidden';

            // Label (etiket) için tıklama ayarları
            p.style.pointerEvents = 'auto'; 
            p.style.cursor = 'pointer';

            p.onclick = () => {
                const urlFormat = sistem.isim.replace(/\s+/g, '_');
                window.parent.location.href = `wiki.html?kategori=Gok_Cisimleri/Yildizlar&madde=${urlFormat}`;
            };
            const c2d = new CSS2DObject(p);
            c2d.position.set(0, 0.3, 0);
            yildiz.add(c2d);

            labelElements.push({ mesh: yildiz, element: p });
        });
        
        const devletRenkleri = {
            "Merkez Cumhuriyeti": 0x00aaff,
            "Yildiz Ateseligi": 0xff3344,
            "Pulsar Koloni Devleti": 0x006600,
            "Pulsar Genişleme Bölgesi": 0x00FF00,
            "Daytona Rejimi": 0xff9900,
            "Üç Yıldız Şehirleri": 0x9933ff
        };

        devletHaritasi.forEach((vektorler, devletAdi) => {
            const renk = devletRenkleri[devletAdi] || 0xffffff;
            let geometry;

            if (vektorler.length >= 4) {
                geometry = new ConvexGeometry(vektorler);
            } else if (vektorler.length === 3) {
                geometry = new THREE.BufferGeometry();
                const positions = new Float32Array([
                    vektorler[0].x, vektorler[0].y, vektorler[0].z,
                    vektorler[1].x, vektorler[1].y, vektorler[1].z,
                    vektorler[2].x, vektorler[2].y, vektorler[2].z,
                ]);
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            }

            if (geometry) {
                const material = new THREE.MeshBasicMaterial({
                    color: renk,
                    transparent: true,
                    opacity: 0.12,
                    wireframe: false,
                    side: THREE.DoubleSide
                });
                const bolgeMesh = new THREE.Mesh(geometry, material);
                scene.add(bolgeMesh);
            }
        });

        // 2. Sadece JSON içinde belirtilen bağlantıları çiz
        if (data.baglantilar) {
            data.baglantilar.forEach(baglanti => {
                const p1 = yildizHaritasi.get(baglanti.yildiz1);
                const p2 = yildizHaritasi.get(baglanti.yildiz2);

                if (p1 && p2) {
                    const mesafe = p1.distanceTo(p2);
                    
                    // Mesafe 5'ten büyükse mor, değilse gri renk seç
                    const hatRengi = mesafe > 5 ? 0x9933ff : 0x555555;

                    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                    const material = new THREE.LineDashedMaterial({
                        color: hatRengi,
                        dashSize: 0.2,
                        gapSize: 0.1
                    });
                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances();
                    scene.add(line);

                    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

                    const lp = document.createElement('div');
                    lp.textContent = `${mesafe.toFixed(2)} ly`;
                    lp.style.color = '#aaaaaa';
                    lp.style.fontFamily = "'Oxanium', sans-serif";
                    lp.style.fontSize = '9px';
                    lp.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    lp.style.padding = '1px 4px';
                    lp.style.borderRadius = '3px';
                    lp.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                    lp.style.visibility = 'hidden';

                    const lc2d = new CSS2DObject(lp);
                    lc2d.position.copy(midpoint);
                    scene.add(lc2d);

                    lineElements.push({ midpoint: midpoint, element: lp });
                }
            });
        }
    } catch (hata) {
        console.error("evren.json okunamadı:", hata);
    }
}

evreniYukle();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const kesisenler = raycaster.intersectObjects(tiklanabilirObjeler);
    
    if (kesisenler.length > 0) {
        const veri = kesisenler[0].object.userData;
        alert(`Sistem: ${veri.isim}\nGezegenler:\n- ${veri.gezegenler.join('\n- ')}`);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    labelElements.forEach(item => {
        const mesafe = camera.position.distanceTo(item.mesh.position);
        item.element.style.visibility = mesafe < 25 ? 'visible' : 'hidden';
    });

    lineElements.forEach(item => {
        const mesafe = camera.position.distanceTo(item.midpoint);
        item.element.style.visibility = mesafe < 25 ? 'visible' : 'hidden';
    });

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
animate();