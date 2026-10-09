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

const tiklanabilirObjeler = [];   // tıklama için görünmez, biraz büyük küreler
const labelElements = [];
const lineElements = [];
const devletHaritasi = new Map();

// ---- Bilgi paneli için veriler -------------------------------------------------
const SISTEMLER = new Map();   // isim -> { sistem, mesh, etiket }
const KOMSULAR = new Map();    // isim -> [{ isim, mesafe }]
const ESLER = new Map();       // çift sistemler: isim -> eşinin adı (evren.json "ciftler")
const MADDELER = new Map();    // anahtar -> yayınlanmış wiki maddesi (wiki-dizin.json)
let DEVLET_RENK = {};
const SINIF_AD = { O: "Mavi dev", B: "Mavi-beyaz yıldız", A: "Beyaz yıldız", F: "Sarı-beyaz yıldız", G: "Sarı cüce", K: "Turuncu cüce", M: "Kırmızı cüce" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Büyük/küçük harf ve Türkçe karakter farklarını yok sayar (wiki ile aynı kural)
function anahtar(s) {
    return String(s).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
        .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
        .replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[\s_]+/g, " ").trim();
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
        for (const [a, b] of data.ciftler || []) { ESLER.set(a, b); ESLER.set(b, a); }

        // Yayınlanmış wiki maddeleri (varsa panelde özet ve linkler için)
        try {
            const dizin = await (await fetch('wiki-dizin.json')).json();
            for (const m of dizin.maddeler || []) {
                [m.ad, m.slug, m.ozellikler?.evren_adi, ...(m.aliases || [])].filter(Boolean)
                    .forEach(a => MADDELER.set(anahtar(a), m));
            }
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
                isim: sistem.isim,
                gezegenler: sistem.gezegenler
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

function paneliDoldur(s) {
    const tip = s.tip ? String(s.tip) : '';
    const tipler = tip.split('/').map(t => t.trim()).filter(Boolean);
    const sinif = tipler.length > 1 ? 'Çoklu yıldız' : (SINIF_AD[tipler[0]?.[0]?.toUpperCase()] || '');
    const uzaklik = Math.hypot(s.x, s.y, s.z);
    const devlet = s.devlet
        ? `<span class="yp-nokta" style="background:${esc(DEVLET_RENK[s.devlet] || '#8b93a3')}"></span>` +
          `<a href="${wikiUrl(devletAdi(s.devlet))}" data-git>${esc(devletAdi(s.devlet))}</a>`
        : 'Bağımsız';

    const gezegenler = (s.gezegenler || []).filter(Boolean);
    const uydular = (s.Uydular || []).filter(Boolean);
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
        ${uydular.length ? `<h3>Uydular</h3><ul class="yp-cipler">${cipler(uydular)}</ul>` : ''}
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
        for (const g of (sistem.gezegenler || []).filter(Boolean))
            aramaKayitlari.push({ ad: g, yildiz: sistem.isim, devlet: sistem.devlet, tur: 'gezegen' });
        for (const u of (sistem.Uydular || []).filter(Boolean))
            aramaKayitlari.push({ ad: u, yildiz: sistem.isim, devlet: sistem.devlet, tur: 'uydu' });
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
            const renk = DEVLET_RENK[k.devlet] || '#8b93a3';
            const alt = k.tur === 'yıldız' ? (k.devlet ? devletAdi(k.devlet) : 'Bağımsız') : `${k.tur === 'uydu' ? 'Uydu' : 'Gezegen'} · ${k.yildiz} sistemi`;
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