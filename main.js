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
labelRenderer.domElement.style.zIndex = '1';   // etiketler bilgi panelinin altında kalsın
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
// Sol'un bulunduğu düzlemde silik ızgara: her kare 5 ışık yılı (Vermis Geçitlerinin menzili)
const izgara = new THREE.GridHelper(70, 14, 0x2a3550, 0x161c2a);
izgara.material.transparent = true;
izgara.material.opacity = 0.6;
scene.add(izgara);

// ---- Arka plan: uzak yıldızlar ve Samanyolu --------------------------------------
// Harita koordinatları ekvatoral sistemde (Sirius, Procyon, Tau Ceti gerçek yerlerinde),
// bu yüzden Samanyolu bandı gökyüzündeki gerçek yönüne yerleştirilir.
// Gökyüzü kamerayla birlikte taşınır: kaydırınca kaymaz, sadece döndürünce döner.
const gokyuzu = new THREE.Group();
scene.add(gokyuzu);
(function gokyuzunuKur() {
    const GOK_R = 900;
    // Ekvatoral (harita) yönünü three.js eksenlerine çevir: haritada (x, y, z) -> sahnede (x, z, y)
    const ekv = (raDer, decDer) => {
        const a = THREE.MathUtils.degToRad(raDer), d = THREE.MathUtils.degToRad(decDer);
        return new THREE.Vector3(Math.cos(d) * Math.cos(a), Math.sin(d), Math.cos(d) * Math.sin(a));
    };
    const GM = ekv(266.40499, -28.93617);   // galaksi merkezi (Yay takımyıldızı yönü)
    const KGK = ekv(192.85948, 27.12825);   // kuzey galaktik kutup
    // l = 90° yönü: ekvatoral sistemde KGK × GM; eksen takası (y<->z) yönü ters çevirdiği için burada GM × KGK
    const G90 = new THREE.Vector3().crossVectors(GM, KGK).normalize();
    const galaktikYon = (lDer, bDer) => {
        const l = THREE.MathUtils.degToRad(lDer), b = THREE.MathUtils.degToRad(bDer);
        return new THREE.Vector3()
            .addScaledVector(GM, Math.cos(b) * Math.cos(l))
            .addScaledVector(G90, Math.cos(b) * Math.sin(l))
            .addScaledVector(KGK, Math.sin(b));
    };

    // Basit, tekrarlanabilir rastgele sayı (her açılışta aynı gökyüzü)
    let tohum = 20260809;
    const rnd = () => ((tohum = (tohum * 1664525 + 1013904223) >>> 0) / 4294967296);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const RENKLER = [[0.72, 0.82, 1.0], [0.85, 0.9, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.82], [1.0, 0.84, 0.66]];

    // --- 1) Yıldız noktaları: her yöne dağılmış olanlar + Samanyolu boyunca yoğunlaşanlar
    const konum = [], renk = [], boyut = [];
    const ekle = (yon, parlaklik, b) => {
        yon.multiplyScalar(GOK_R); konum.push(yon.x, yon.y, yon.z);
        const r = RENKLER[Math.floor(rnd() * RENKLER.length)];
        renk.push(r[0] * parlaklik, r[1] * parlaklik, r[2] * parlaklik);
        boyut.push(b);
    };
    for (let i = 0; i < 4500; i++) {
        const z = rnd() * 2 - 1, f = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
        const p = Math.pow(rnd(), 3);                       // çoğu sönük, birkaçı parlak
        ekle(new THREE.Vector3(s * Math.cos(f), z, s * Math.sin(f)), 0.25 + 0.6 * p, 1.2 + 1.8 * p);
    }
    for (let i = 0; i < 9000; i++) {
        let l = rnd() * 360;
        if (rnd() < 0.45) l = gauss() * 35;                 // merkeze doğru daha yoğun
        const genislik = 4 + 5 * Math.exp(-Math.pow(l / 30, 2));
        const p = Math.pow(rnd(), 4);
        ekle(galaktikYon(l, gauss() * genislik), 0.18 + 0.45 * p, 1.0 + 1.4 * p);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(konum, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
    geo.setAttribute('boyut', new THREE.Float32BufferAttribute(boyut, 1));
    const noktaMat = new THREE.ShaderMaterial({
        uniforms: { oran: { value: renderer.getPixelRatio() } },
        vertexShader: `attribute float boyut; varying vec3 vRenk; uniform float oran;
            void main() { vRenk = color; gl_PointSize = boyut * oran;
                          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vRenk;
            void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d);
                          gl_FragColor = vec4(vRenk * a, a); }`,
        vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
    });
    const noktalar = new THREE.Points(geo, noktaMat);
    noktalar.renderOrder = -10;
    gokyuzu.add(noktalar);

    // --- 2) Samanyolu'nun puslu ışığı: galaktik koordinatlarda çizilen doku
    const W = 1024, H = 512;
    const tuval = document.createElement('canvas'); tuval.width = W; tuval.height = H;
    const ctx = tuval.getContext('2d'), img = ctx.createImageData(W, H);
    // pürüzlü görünüm için tekrarlanabilir değer gürültüsü (l yönünde sarmalı)
    const GX = 96, GY = 48, izgaraG = Array.from({ length: GX * GY }, rnd);
    const deger = (x, y) => {
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const g = (i, j) => izgaraG[((j % GY + GY) % GY) * GX + ((i % GX + GX) % GX)];
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy;
    };
    const fbm = (x, y) => 0.55 * deger(x, y) + 0.3 * deger(x * 2.1, y * 2.1) + 0.15 * deger(x * 4.3, y * 4.3);
    for (let j = 0; j < H; j++) {
        const b = 90 - (j + 0.5) / H * 180;
        for (let i = 0; i < W; i++) {
            let l = (i + 0.5) / W * 360; const lf = l > 180 ? l - 360 : l;   // -180..180, 0 = merkez
            const gx = l / 360 * GX, gy = (b + 90) / 180 * GY * 0.5;
            const n = fbm(gx, gy), n2 = fbm(gx * 1.7 + 13, gy * 1.7 + 7);
            const genislik = 5 + 7 * Math.exp(-Math.pow(lf / 32, 2));
            let I = Math.exp(-Math.pow(b / genislik, 2)) * (0.45 + 0.9 * n);
            I += 0.9 * Math.exp(-(Math.pow(lf / 16, 2) + Math.pow(b / 9, 2)));          // merkezdeki şişkinlik
            const toz = 1 - 0.6 * Math.exp(-Math.pow(b / 2.4, 2)) * Math.exp(-Math.pow(lf / 70, 2)) * (0.4 + 0.8 * n2);
            I = Math.max(0, I * toz);
            const sicak = Math.exp(-Math.pow(lf / 50, 2));                                  // merkez sıcak, kenarlar mavimsi
            const k = (j * W + i) * 4;
            img.data[k] = 255 * Math.min(1, I * (0.72 + 0.28 * sicak));
            img.data[k + 1] = 255 * Math.min(1, I * (0.78 + 0.12 * sicak));
            img.data[k + 2] = 255 * Math.min(1, I * (1.0 - 0.25 * sicak));
            img.data[k + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const doku = new THREE.CanvasTexture(tuval);
    doku.colorSpace = THREE.SRGBColorSpace;
    // Dokunun her pikseli (l, b) yönüne denk gelsin diye küreyi kendimiz kuruyoruz
    const kure = new THREE.SphereGeometry(GOK_R * 1.05, 96, 48);
    const poz = kure.attributes.position, uv = kure.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < poz.count; i++) {
        v.fromBufferAttribute(poz, i).normalize();
        const b = Math.asin(THREE.MathUtils.clamp(v.dot(KGK), -1, 1));
        let l = Math.atan2(v.dot(G90), v.dot(GM)); if (l < 0) l += Math.PI * 2;
        uv.setXY(i, l / (Math.PI * 2), 0.5 + b / Math.PI);
    }
    // l = 0/360 dikişinde doku tersine sarmasın diye: üçgen içinde u farkı büyükse düzelt

    const kopya = kure.toNonIndexed(); const uv2 = kopya.attributes.uv; const poz2 = kopya.attributes.position;
    for (let t = 0; t < uv2.count; t += 3) {
        const us = [uv2.getX(t), uv2.getX(t + 1), uv2.getX(t + 2)];
        if (Math.max(...us) - Math.min(...us) > 0.5) for (let q = 0; q < 3; q++) if (us[q] < 0.5) uv2.setX(t + q, us[q] + 1);
    }
    doku.wrapS = THREE.RepeatWrapping;
    const pus = new THREE.Mesh(kopya, new THREE.MeshBasicMaterial({
        map: doku, side: THREE.BackSide, transparent: true, opacity: 0.24,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
    }));
    pus.renderOrder = -11;
    gokyuzu.add(pus);
})();

const tiklanabilirObjeler = [];   // tıklama için görünmez, biraz büyük küreler
const labelElements = [];
const lineElements = [];
const devletHaritasi = new Map();

// ---- Bilgi paneli için veriler -------------------------------------------------
const SISTEMLER = new Map();   // isim -> { sistem, mesh, etiket }
const KOMSULAR = new Map();    // isim -> [{ isim, mesafe }]
const ESLER = new Map();       // çift sistemler: isim -> eşinin adı (evren.json "ciftler")
const UYDU_NOTLARI = new Map(); // yıldız anahtarı -> [{ ad, gezegen, sira }] (yayınlanmış uydu maddeleri)
const GEZEGEN_NOTLARI = new Map(); // yıldız anahtarı -> [{ ad, sira }] (yayınlanmış gezegen maddeleri)
const MADDELER = new Map();    // anahtar -> yayınlanmış wiki maddesi (wiki-dizin.json)
let DEVLET_RENK = {};
let BOLGELER = {};               // bölge -> bağlı olduğu devlet (evren.json "bolgeler")
const SINIF_AD = { O: "Mavi dev", B: "Mavi-beyaz yıldız", A: "Beyaz yıldız", F: "Sarı-beyaz yıldız", G: "Sarı cüce", K: "Turuncu cüce", M: "Kırmızı cüce" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Büyük/küçük harf ve Türkçe karakter farklarını yok sayar (wiki ile aynı kural)
function anahtar(s) {
    return String(s).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
        .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
        .replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[\s_]+/g, " ").trim();
}
// Yörünge sırası: notun "sira" alanı; yoksa addaki Roma rakamı ("Eminence - IV" -> 4) ya da uydu harfi ("III-b" -> 2)
function yorungeSirasi(ad, sira) {
    const v = String(sira ?? "").trim().replace(/^["']+|["']+$/g, "");
    if (v !== "" && !isNaN(parseFloat(v))) return parseFloat(v);
    const r = String(ad).match(/[\s\-–]([IVXLC]+)$/);
    if (r) {
        const D = { I: 1, V: 5, X: 10, L: 50, C: 100 };
        return [...r[1]].reduce((t, c, i, a) => t + (D[c] < (D[a[i + 1]] || 0) ? -D[c] : D[c]), 0);
    }
    const h = String(ad).match(/[\s\-–]([a-z])$/i);
    return h ? h[1].toLowerCase().charCodeAt(0) - 96 : null;
}
/** Listeyi yerinde sıralar; sırası olmayan, listede önündekinin hemen arkasında kalır (wiki ile aynı kural) */
function yorungeyeGoreDiz(liste) {
    let onceki = 0;
    liste.forEach((x, i) => { x._k = x.sira === null ? onceki + 0.001 * (i + 1) : (onceki = x.sira); x._i = i; });
    return liste.sort((a, b) => a._k - b._k || a._i - b._i);
}
const wikiUrl = (ad) => `wiki.html?madde=${encodeURIComponent(String(ad).trim().replace(/\s+/g, "_"))}`;
const lyYaz = (x) => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Harita index.html içinde açıksa o sayfayı, tek başına açıksa kendini yönlendirir */
function sayfayaGit(url) {
    try {
        if (window.parent !== window && window.parent.location.origin === location.origin) {
            window.parent.location.href = url;
            return;
        }
    } catch (e) { /* başka bir sitenin içindeyse (ör. Obsidian) kendi çerçevesinde kalır */ }
    location.href = url;
}

// Seçili yıldızın etrafındaki halka
const secimHalkasi = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.34, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false })
);
secimHalkasi.visible = false;
secimHalkasi.renderOrder = 10;
scene.add(secimHalkasi);
let secili = null;   // { sistem, mesh, etiket }

async function evreniYukle() {
    try {
        const response = await fetch('evren.json');
        const data = await response.json();
        DEVLET_RENK = data.devletler || {};
        BOLGELER = data.bolgeler || {};
        for (const [a, b] of data.ciftler || []) { ESLER.set(a, b); ESLER.set(b, a); }

        // Yayınlanmış wiki maddeleri (varsa panelde özet ve linkler için)
        try {
            const dizin = await (await fetch('wiki-dizin.json')).json();
            const linkAdi = (v) => v ? String(v).replace(/^\[\[|\]\]$/g, '').split('|')[0].trim() : '';
            for (const m of dizin.maddeler || []) {
                [m.ad, m.slug, m.ozellikler?.evren_adi, ...(m.aliases || [])].filter(Boolean)
                    .forEach(a => MADDELER.set(anahtar(a), m));
                // Gezegen/uydu notu: "sistem: [[Eminence]]", uyduda ayrıca "gezegen: [[Eminence - IV]]"
                if ((m.tur === 'gezegen' || m.tur === 'uydu') && m.ozellikler?.sistem) {
                    const hedef = m.tur === 'gezegen' ? GEZEGEN_NOTLARI : UYDU_NOTLARI;
                    const k = anahtar(linkAdi(m.ozellikler.sistem));
                    if (!hedef.has(k)) hedef.set(k, []);
                    hedef.get(k).push({ ad: m.ad, gezegen: linkAdi(m.ozellikler.gezegen), sira: yorungeSirasi(m.ad, m.ozellikler.sira) });
                }
            }
            for (const liste of [...GEZEGEN_NOTLARI.values(), ...UYDU_NOTLARI.values()]) yorungeyeGoreDiz(liste);
        } catch (e) { /* dizin yoksa panel yine çalışır */ }

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
                isim: sistem.isim
            };
            
            scene.add(yildiz);

            // Küçük yıldızlara tıklamak kolay olsun diye görünmez, daha büyük bir küre
            const hedef = new THREE.Mesh(
                new THREE.SphereGeometry(0.45, 8, 8),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
            );
            hedef.userData.isim = sistem.isim;
            yildiz.add(hedef);
            tiklanabilirObjeler.push(hedef);

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

            p.onclick = (e) => { e.stopPropagation(); yildizSec(sistem.isim); };
            const c2d = new CSS2DObject(p);
            c2d.position.set(0, 0.3, 0);
            yildiz.add(c2d);

            labelElements.push({ mesh: yildiz, element: p });
            SISTEMLER.set(sistem.isim, { sistem, mesh: yildiz, etiket: p });
        });
        
        // Devlet renkleri evren.json'daki "devletler" bölümünden gelir (wiki de aynısını kullanır)
        const devletRenkleri = data.devletler || {};

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
                    for (const [a, b] of [[baglanti.yildiz1, baglanti.yildiz2], [baglanti.yildiz2, baglanti.yildiz1]]) {
                        if (!KOMSULAR.has(a)) KOMSULAR.set(a, []);
                        KOMSULAR.get(a).push({ isim: b, mesafe });
                    }
                    
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

function isabet(event) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((event.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const k = raycaster.intersectObjects(tiklanabilirObjeler, false);
    return k.length ? k[0].object.userData.isim : null;
}

// Sürükleyip döndürmeyi tıklamadan ayırmak için basılan noktayı hatırla
let basilan = null;
renderer.domElement.addEventListener('pointerdown', (e) => { basilan = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
    if (!basilan || Math.hypot(e.clientX - basilan.x, e.clientY - basilan.y) > 5) return;
    basilan = null;
    const isim = isabet(e);
    if (isim) yildizSec(isim); else paneliKapat();
});
renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    renderer.domElement.style.cursor = isabet(e) ? 'pointer' : '';
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') paneliKapat(); });

// ---- Kamera uçuşu --------------------------------------------------------------
let ucus = null;
function odakla(konum) {
    const ofset = camera.position.clone().sub(controls.target);
    if (ofset.length() > 14) ofset.setLength(10);   // çok uzaktaysa yaklaş, etiketler görünsün
    ucus = {
        t0: performance.now(), sure: 700,
        hedefBas: controls.target.clone(), hedefSon: konum.clone(),
        kamBas: camera.position.clone(), kamSon: konum.clone().add(ofset)
    };
}

// ---- Bilgi paneli ----------------------------------------------------------------
const panel = document.getElementById('yildiz-paneli');

function devletAdi(d) {
    const m = MADDELER.get(anahtar(d));
    return m && m.tur === 'devlet' ? m.ad : d;   // "Yildiz Ateseligi" -> "Yıldız Ateşeliği"
}

/** Bölgeyse bağlı olduğu devlet ve bölge etiketi: { ust, etiket }; değilse { ust: d } */
function baglilik(d) {
    const k = Object.keys(BOLGELER).find(x => anahtar(x) === anahtar(d));
    if (!k) return { ust: d, etiket: '' };
    const ust = BOLGELER[k], ilk = ust.split(' ')[0];
    const etiket = (d.startsWith(ilk + ' ') ? d.slice(ilk.length + 1) : d).toLocaleLowerCase('tr');
    return { ust, etiket };
}

function linkVeyaYazi(ad, gorunen = ad) {
    return MADDELER.has(anahtar(ad))
        ? `<a href="${wikiUrl(MADDELER.get(anahtar(ad)).ad)}" data-git>${esc(gorunen)}</a>`
        : `<span>${esc(gorunen)}</span>`;
}

function yildizSec(isim) {
    const kayit = SISTEMLER.get(isim);
    if (!kayit) return;
    secili = kayit;
    secimHalkasi.visible = true;
    odakla(kayit.mesh.position);
    paneliDoldur(kayit.sistem);
}

function paneliKapat() {
    secili = null;
    secimHalkasi.visible = false;
    panel.hidden = true;
}

/** Sistemin gezegenleri: yalnızca yayınlanmış gezegen notlarından, yıldızdan uzaklık sırasıyla. [{ ad, sira }] */
function sistemGezegenleri(s) {
    return GEZEGEN_NOTLARI.get(anahtar(s.isim)) || [];
}

/** Sistemin uyduları: yalnızca yayınlanmış uydu notlarından ("sistem: [[Yıldız]]"). [{ ad, gezegen }] */
function sistemUydulari(s) {
    return UYDU_NOTLARI.get(anahtar(s.isim)) || [];
}

function paneliDoldur(s) {
    const tip = s.tip ? String(s.tip) : '';
    const tipler = tip.split('/').map(t => t.trim()).filter(Boolean);
    const sinif = tipler.length > 1 ? 'Çoklu yıldız' : (SINIF_AD[tipler[0]?.[0]?.toUpperCase()] || '');
    const uzaklik = Math.hypot(s.x, s.y, s.z);
    const bag = s.devlet ? baglilik(s.devlet) : null;
    const devlet = bag
        ? `<span class="yp-nokta" style="background:${esc(DEVLET_RENK[bag.ust] || DEVLET_RENK[s.devlet] || '#8b93a3')}"></span>` +
          `<a href="${wikiUrl(devletAdi(bag.ust))}" data-git>${esc(devletAdi(bag.ust))}</a>` +
          (bag.etiket ? `<span class="yp-ebeveyn"> · ${esc(bag.etiket)}</span>` : '')
        : 'Bağımsız';

    const gezegenler = sistemGezegenleri(s).map(g => g.ad);
    const uydular = sistemUydulari(s);
    const cipler = (liste) => liste.map(g => `<li>${linkVeyaYazi(g)}</li>`).join('');

    // Çift sistemde eşlerin Vermis bağlantıları ortaktır; mesafe bu yıldızın kendi konumundan ölçülür
    const es = ESLER.get(s.isim);
    const esSistem = es && SISTEMLER.get(es)?.sistem;
    const mesafe = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const adlar = new Set([...(KOMSULAR.get(s.isim) || []), ...(es ? KOMSULAR.get(es) || [] : [])].map(k => k.isim));
    adlar.delete(s.isim); if (es) adlar.delete(es);
    const komsular = [...adlar].filter(ad => SISTEMLER.has(ad))
        .map(ad => ({ isim: ad, mesafe: mesafe(s, SISTEMLER.get(ad).sistem) }))
        .sort((a, b) => a.mesafe - b.mesafe);
    const komsuHtml = komsular.map(k =>
        `<li><button type="button" data-yildiz="${esc(k.isim)}">${esc(k.isim)}</button>` +
        `<span class="${k.mesafe > 5 ? 'yp-uzun' : ''}">${lyYaz(k.mesafe)} ly${k.mesafe > 5 ? ' · uzun atlama' : ''}</span></li>`).join('');

    const madde = MADDELER.get(anahtar(s.isim));
    const ozet = madde?.ozet ? `<p class="yp-ozet">${esc(madde.ozet)}</p>` : '';

    panel.innerHTML = `
        <button type="button" class="yp-kapat" aria-label="Kapat">×</button>
        <div class="yp-bas">
            <span class="yp-kure" style="--renk:${esc(s.renk || '#ffffff')}"></span>
            <div><h2>${esc(s.isim)}</h2><p>${tip ? `${esc(tip)} tipi${sinif ? ' · ' + sinif : ''}` : 'Tipi bilinmiyor'}</p></div>
        </div>
        <dl class="yp-satirlar">
            <dt>Bağlılık</dt><dd>${devlet}</dd>
            <dt>Sol'a uzaklık</dt><dd>${s.isim === 'Sol' ? '—' : lyYaz(uzaklik) + ' ışık yılı'}</dd>
            ${esSistem ? `<dt>Eş yıldız</dt><dd><button type="button" class="yp-es" data-yildiz="${esc(es)}">${esc(es)}</button> · ${lyYaz(mesafe(s, esSistem))} ly</dd>` : ''}
        </dl>
        ${ozet}
        <h3>Gezegenler</h3>
        ${gezegenler.length ? `<ul class="yp-cipler">${cipler(gezegenler)}</ul>` : '<p class="yp-bos">Kayıtlı gezegen yok.</p>'}
        ${uydular.length ? `<h3>Uydular</h3><ul class="yp-cipler">${uydular.map(u =>
            `<li>${linkVeyaYazi(u.ad)}${u.gezegen && !String(u.ad).includes('(') ? `<span class="yp-ebeveyn"> · ${esc(u.gezegen)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        <h3>Vermis bağlantıları</h3>
        ${komsular.length ? `<ul class="yp-komsular">${komsuHtml}</ul>` : '<p class="yp-bos">Bağlantı yok.</p>'}
        <a class="yp-wiki" href="${wikiUrl(s.isim)}" data-git>Wiki sayfasına git →</a>`;
    panel.hidden = false;
    panel.scrollTop = 0;
}

panel.addEventListener('click', (e) => {
    const komsu = e.target.closest('[data-yildiz]');
    if (komsu) { yildizSec(komsu.dataset.yildiz); return; }
    if (e.target.closest('.yp-kapat')) { paneliKapat(); return; }
    const link = e.target.closest('a[data-git]');
    if (link) { e.preventDefault(); sayfayaGit(link.getAttribute('href')); }
});

// ---- Arama kutusu -----------------------------------------------------------------
const aramaKutusu = document.getElementById('yildiz-ara');
const aramaListe = document.getElementById('ara-sonuc');
let aramaKayitlari = null;   // ilk kullanımda hazırlanır (veri yüklendikten sonra)
let aramaSonuclari = [], aramaSecili = -1;

function aramaHazirla() {
    if (aramaKayitlari && aramaKayitlari.length) return aramaKayitlari;
    aramaKayitlari = [];
    for (const { sistem } of SISTEMLER.values()) {
        aramaKayitlari.push({ ad: sistem.isim, yildiz: sistem.isim, devlet: sistem.devlet, tur: 'yıldız' });
        for (const { ad: g } of sistemGezegenleri(sistem))
            aramaKayitlari.push({ ad: g, yildiz: sistem.isim, devlet: sistem.devlet, tur: 'gezegen' });
        for (const u of sistemUydulari(sistem))
            aramaKayitlari.push({ ad: u.ad, yildiz: sistem.isim, devlet: sistem.devlet, tur: 'uydu', gezegen: u.gezegen });
    }
    aramaKayitlari.forEach(k => k.k = anahtar(k.ad));
    return aramaKayitlari;
}

function aramaGoster() {
    const q = anahtar(aramaKutusu.value);
    if (!q) { aramaListe.hidden = true; aramaSonuclari = []; return; }
    const kayitlar = aramaHazirla();
    // Önce adı aranan kelimeyle başlayanlar, sonra içinde geçenler; yıldızlar gezegenlerden önce
    aramaSonuclari = kayitlar
        .map(k => ({ k, sira: k.k.startsWith(q) ? 0 : k.k.includes(q) ? 1 : 9 }))
        .filter(x => x.sira < 9)
        .sort((a, b) => a.sira - b.sira || (a.k.tur !== 'yıldız') - (b.k.tur !== 'yıldız') || a.k.ad.localeCompare(b.k.ad, 'tr'))
        .slice(0, 8).map(x => x.k);
    aramaSecili = aramaSonuclari.length ? 0 : -1;
    aramaListe.innerHTML = aramaSonuclari.length
        ? aramaSonuclari.map((k, i) => {
            const bag = k.devlet ? baglilik(k.devlet) : null;
            const renk = (bag && DEVLET_RENK[bag.ust]) || DEVLET_RENK[k.devlet] || '#8b93a3';
            const alt = k.tur === 'yıldız' ? (bag ? devletAdi(bag.ust) + (bag.etiket ? ' · ' + bag.etiket : '') : 'Bağımsız')
                : k.tur === 'uydu' ? `Uydu · ${k.gezegen && !k.ad.includes('(') ? k.gezegen + ' · ' : ''}${k.yildiz} sistemi`
                : `Gezegen · ${k.yildiz} sistemi`;
            return `<li role="option" data-i="${i}" class="${i === aramaSecili ? 'secili' : ''}">` +
                `<span class="yp-nokta" style="background:${esc(renk)}"></span><span class="ara-ad">${esc(k.ad)}</span>` +
                `<span class="ara-alt">${esc(alt)}</span></li>`;
        }).join('')
        : '<li class="ara-yok">Bulunamadı</li>';
    aramaListe.hidden = false;
}

function aramaSec(i) {
    const k = aramaSonuclari[i];
    if (!k) return;
    yildizSec(k.yildiz);
    aramaKutusu.value = k.ad;
    aramaListe.hidden = true;
    aramaKutusu.blur();
}

function aramaIsaretle(i) {
    aramaSecili = i;
    aramaListe.querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('secili', +li.dataset.i === i));
}

aramaKutusu.addEventListener('input', aramaGoster);
aramaKutusu.addEventListener('focus', () => { if (aramaKutusu.value) aramaGoster(); });
aramaKutusu.addEventListener('keydown', (e) => {
    const n = aramaSonuclari.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); aramaIsaretle((aramaSecili + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); aramaIsaretle((aramaSecili - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); aramaSec(Math.max(aramaSecili, 0)); }
    else if (e.key === 'Escape') { e.stopPropagation(); aramaKutusu.value = ''; aramaListe.hidden = true; aramaKutusu.blur(); }
});
aramaListe.addEventListener('mousedown', (e) => {   // mousedown: kutu odağını kaybetmeden seçilsin
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); aramaSec(+li.dataset.i); }
});
aramaKutusu.addEventListener('blur', () => setTimeout(() => { aramaListe.hidden = true; }, 100));
// "/" tuşu aramaya geçirir (bir yazı alanında değilken)
window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== aramaKutusu) { e.preventDefault(); aramaKutusu.focus(); aramaKutusu.select(); }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(zaman) {
    requestAnimationFrame(animate);

    if (ucus) {
        const k = Math.min(1, (performance.now() - ucus.t0) / ucus.sure);
        const e = 1 - Math.pow(1 - k, 3);   // yumuşak yavaşlama
        controls.target.lerpVectors(ucus.hedefBas, ucus.hedefSon, e);
        camera.position.lerpVectors(ucus.kamBas, ucus.kamSon, e);
        if (k === 1) ucus = null;
    }
    controls.update();
    gokyuzu.position.copy(camera.position);   // gökyüzü hep sonsuz uzakta dursun

    if (secili) {
        secimHalkasi.position.copy(secili.mesh.position);
        secimHalkasi.quaternion.copy(camera.quaternion);
        secimHalkasi.scale.setScalar(1 + 0.12 * Math.sin((zaman || 0) / 300));
    }

    labelElements.forEach(item => {
        const mesafe = camera.position.distanceTo(item.mesh.position);
        const seciliMi = secili && secili.mesh === item.mesh;
        item.element.style.visibility = (mesafe < 25 || seciliMi) ? 'visible' : 'hidden';
        item.element.classList.toggle('etiket-secili', !!seciliMi);
    });

    lineElements.forEach(item => {
        const mesafe = camera.position.distanceTo(item.midpoint);
        item.element.style.visibility = mesafe < 25 ? 'visible' : 'hidden';
    });

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
animate();