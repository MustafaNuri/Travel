/* =========================================================
   Bilinen Galaksi — Wiki motoru
   Veri: wiki-dizin.json (senkron betiği üretir) + evren.json
   ========================================================= */

// ---- Ayarlar ---------------------------------------------------------------
const DEVLET_RENK = {};          // evren.json'daki "devletler" bölümünden doldurulur (harita ile ortak)
const ETIKET = {                  // frontmatter anahtarı -> bilgi kutusu etiketi
    baskent: "Başkent", yasam_barindiran: "Yaşam barındıran", nufus: "Nüfus",
    dogum: "Doğum", olum: "Ölüm", sistem: "Sistem", gravity: "Yerçekimi", yercekimi: "Yerçekimi",
    kurulus: "Kuruluş", kurucu: "Kurucu", lider: "Lider", meslek: "Meslek", uyruk: "Uyruk",
    bagli: "Bağlılık", baglilik: "Bağlılık", yas: "Yaş", atmosfer: "Atmosfer", iklim: "İklim",
    gelistirilme: "Geliştirilme", gelistiren: "Geliştiren", durum: "Durum", unvan: "Unvan",
    gezegen: "Bağlı olduğu gezegen", yonetim: "Yönetim biçimi", ekonomi: "Ekonomi / Ana kaynak"
};
const DEVLET_ALAN_SIRASI = ["baskent", "kurulus", "kurucu", "yonetim", "lider", "nufus", "ekonomi"];
const GIZLI_ALAN = new Set(["evren_adi", "tags", "cssclasses", "resim", "alt_baslik", "renk", "boyut"]);
const TUR_AD = {
    yildiz: "Yıldız sistemi", gezegen: "Gezegen", uydu: "Uydu", karakter: "Karakter",
    devlet: "Devlet", fraksiyon: "Fraksiyon", sirket: "Şirket", sehir: "Şehir",
    istasyon: "Uzay istasyonu", teknoloji: "Teknoloji", olay: "Olay", tur: "Tür",
    kurum: "Kurum", doga: "Doğa", tarihce: "Tarihçe"
};
// Liste (kategori) sayfaları: wiki.html?liste=<anahtar>
const LISTELER = {
    "gok-cisimleri": { ad: "Gök Cisimleri", aciklama: "Bilinen Galaksi'deki gök cisimleri.", alt: ["yildizlar", "gezegenler", "uydular", "istasyonlar"] },
    "yildizlar":     { ad: "Yıldızlar", ust: "gok-cisimleri", aciklama: "Bilinen yıldız sistemleri, bağlı oldukları devletlere göre." },
    "gezegenler":    { ad: "Gezegenler", ust: "gok-cisimleri", turler: ["gezegen"], evren: "gezegenler", aciklama: "Gezegenler, bulundukları yıldız sistemine göre." },
    "uydular":       { ad: "Uydular", ust: "gok-cisimleri", turler: ["uydu"], evren: "Uydular", aciklama: "Uydular, bulundukları yıldız sistemine göre." },
    "istasyonlar":   { ad: "Uzay İstasyonları", ust: "gok-cisimleri", turler: ["istasyon"], aciklama: "Galaksideki uzay istasyonları." },
    "karakterler":   { ad: "Karakterler", turler: ["karakter"], aciklama: "Bilinen Galaksi'nin insanları." },
    "sehirler":      { ad: "Şehirler", turler: ["sehir"], aciklama: "Gezegenlerdeki ve uydulardaki yerleşimler." },
    "fraksiyonlar":  { ad: "Devlet ve Fraksiyonlar", turler: ["devlet", "sirket", "kurum", "fraksiyon"], grupla: true, aciklama: "Devletler, şirketler ve kurumlar." },
    "olaylar":       { ad: "Olaylar", turler: ["olay"], aciklama: "Galaksinin tarihini şekillendiren olaylar." },
    "teknoloji":     { ad: "Teknoloji", turler: ["teknoloji"], aciklama: "Galakside kullanılan teknolojiler." },
    "doga":          { ad: "Doğa", turler: ["doga"], aciklama: "Yiyecekler, içecekler, bitkiler ve hayvanlar." }
};
const LISTE_SIRASI = ["gok-cisimleri", "yildizlar", "gezegenler", "uydular", "istasyonlar", "karakterler", "sehirler", "fraksiyonlar", "olaylar", "teknoloji", "doga"];
const TUR_LISTE = { yildiz: "yildizlar", gezegen: "gezegenler", uydu: "uydular", istasyon: "istasyonlar", karakter: "karakterler",
    sehir: "sehirler", devlet: "fraksiyonlar", sirket: "fraksiyonlar", kurum: "fraksiyonlar", fraksiyon: "fraksiyonlar",
    olay: "olaylar", teknoloji: "teknoloji", doga: "doga" };
const TUR_COGUL = { devlet: "Devletler", sirket: "Şirketler", kurum: "Kurumlar", fraksiyon: "Fraksiyonlar" };
const ESKI_LISTE = { Karakterler_Listesi: "karakterler", Teknoloji_Listesi: "teknoloji", Fraksiyonlar_Listesi: "fraksiyonlar",
    Sehirler_Listesi: "sehirler", Doga_Listesi: "doga", Gezegenler_Listesi: "gezegenler", Uydular_Listesi: "uydular",
    Uzay_Istasyonlari_Listesi: "istasyonlar", Astroidler_Listesi: "gok-cisimleri" };
const ESKI_KATEGORI_LISTE = { "Teknoloji": "teknoloji", "Gok_Cisimleri/Yildizlar": "yildizlar" };
const listeUrl = (k) => `wiki.html?liste=${k}`;
const SINIF_AD = { O: "Mavi dev", B: "Mavi-beyaz yıldız", A: "Beyaz yıldız", F: "Sarı-beyaz yıldız", G: "Sarı cüce", K: "Turuncu cüce", M: "Kırmızı cüce" };
const OKUR_ANAHTAR = "bg-okur-bolum";
const YAZILMADI = WikiLink.YAZILMADI;   // metni wiki-link.js içinden değiştir

// ---- Yardımcılar -----------------------------------------------------------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugla = (ad) => ad.trim().replace(/\s+/g, "_");
const maddeUrl = (ad) => `wiki.html?madde=${encodeURIComponent(slugla(ad))}`;

function anahtar(s) {
    return String(s).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
        .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
        .replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[\s_]+/g, " ").trim();
}
const etiketle = (k) => ETIKET[k] || (k.charAt(0).toLocaleUpperCase("tr") + k.slice(1)).replace(/_/g, " ");

async function getirJson(yol, varsayilan) {
    try { const r = await fetch(yol); return r.ok ? await r.json() : varsayilan; } catch { return varsayilan; }
}
async function getirMetin(yol) {
    try { const r = await fetch(encodeURI(yol)); return r.ok ? await r.text() : null; } catch { return null; }
}

// ---- Veri ------------------------------------------------------------------
let DIZIN = { bolumler: [], maddeler: [] }, EVREN = { sistemler: [], baglantilar: [] };
const MADDE = new Map();   // anahtar -> madde
const SISTEM = new Map();  // anahtar -> evren sistemi

function sistemAdi(m) { return m.ozellikler?.evren_adi || m.ad; }

function veriyiHazirla() {
    for (const m of DIZIN.maddeler) {
        [m.ad, m.slug, ...(m.aliases || [])].forEach(a => MADDE.set(anahtar(a), m));
    }
    for (const s of EVREN.sistemler) SISTEM.set(anahtar(s.isim), s);
}

/** Bir link hedefini çözer: {url, ad} ya da null */
function coz(hedef) {
    const k = anahtar(hedef);
    const m = MADDE.get(k);
    if (m) return { url: maddeUrl(m.ad), ad: m.ad, madde: m };
    const s = SISTEM.get(k);
    if (s) return { url: maddeUrl(s.isim), ad: s.isim, sistem: s };
    return null;
}

function linkHtml(hedef, gorunen, eskiKategori) {
    const c = coz(hedef);
    if (c) return `<a href="${c.url}">${esc(gorunen)}</a>`;
    if (eskiKategori) return `<a href="wiki.html?madde=${encodeURIComponent(slugla(hedef))}&kategori=${encodeURIComponent(eskiKategori)}">${esc(gorunen)}</a>`;
    return `<span class="wl-yok" title="${YAZILMADI}">${esc(gorunen)}</span>`;
}

/** Metin içindeki [[link|ad]] ve ==vurgu== işaretlerini HTML'e çevirir (metin zaten güvenli kabul edilir) */
function satirIci(metin, eskiKategori) {
    return metin
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, h, g) => linkHtml(h.trim(), g.trim(), eskiKategori))
        .replace(/\[\[([^\]]+)\]\]/g, (_, h) => linkHtml(h.trim(), h.trim(), eskiKategori))
        .replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
}

/** Frontmatter değerini HTML'e çevirir; sonu " @4" ile biten değerler 4. bölüm spoiler'ıdır */
function degerHtml(v) {
    if (Array.isArray(v)) return v.map(degerHtml).join(", ");
    if (v === null || v === undefined || v === "") return "—";
    let s = String(v), bolum = null;
    const m = s.match(/^(.*?)\s+@(\d+)$/);
    if (m) { s = m[1]; bolum = +m[2]; }
    const html = satirIci(esc(s));
    return bolum ? `<span class="spoiler-satir" data-bolum="${bolum}" title="${bolum}. bölüm spoiler'ı — göstermek için tıkla">${html}</span>` : html;
}

// ---- Markdown --------------------------------------------------------------
function mdCiz(metin, eskiKategori) {
    const parcalar = [];
    const satirlar = metin.replace(/\r\n/g, "\n").split("\n");
    const cikti = [];
    for (let i = 0; i < satirlar.length; i++) {
        const bas = satirlar[i].match(/^>\s*\[!([\w-]+)\][+-]?\s*(.*)$/);
        if (!bas) { cikti.push(satirlar[i]); continue; }
        const ic = [];
        while (i + 1 < satirlar.length && /^>/.test(satirlar[i + 1])) ic.push(satirlar[++i].replace(/^>\s?/, ""));
        const tur = bas[1].toLowerCase(), baslik = bas[2].trim();
        const icHtml = mdCiz(ic.join("\n"), eskiKategori);
        let html;
        if (tur === "spoiler") {
            const b = parseInt(baslik, 10) || 999;
            html = `<div class="spoiler" data-bolum="${b}"><div class="spoiler-ic">${icHtml}</div>` +
                   `<button class="spoiler-ort" type="button"><span>${b === 999 ? "İleriki bölümlerden spoiler" : b + ". bölüm spoiler'ı"} · göstermek için tıkla</span></button></div>`;
        } else {
            html = `<div class="callout callout-${esc(tur)}"><div class="callout-baslik">${esc(baslik || tur)}</div>${icHtml}</div>`;
        }
        parcalar.push(html);
        cikti.push("", `@@PARCA${parcalar.length - 1}@@`, "");
    }
    let html = marked.parse(satirIci(cikti.join("\n"), eskiKategori), { breaks: true });
    return html.replace(/<p>@@PARCA(\d+)@@<\/p>/g, (_, n) => parcalar[+n]);
}

function basligiAyir(metin) {
    const m = metin.match(/^\s*#\s+(.+?)\s*\n/);
    return m ? [m[1], metin.slice(m[0].length)] : [null, metin];
}

// ---- Okur ilerlemesi / spoiler ----------------------------------------------
function okurBolum() {
    try { return parseInt(localStorage.getItem(OKUR_ANAHTAR) || "0", 10) || 0; } catch { return 0; }
}
function spoilerlariUygula() {
    const b = okurBolum();
    document.querySelectorAll("[data-bolum]").forEach(el => {
        el.classList.toggle("acik", el.dataset.elle === "1" || +el.dataset.bolum <= b);
    });
}
document.addEventListener("click", (e) => {
    const sp = e.target.closest(".spoiler-ort, .spoiler-satir:not(.acik)");
    if (!sp) return;
    const kap = sp.closest("[data-bolum]");
    kap.dataset.elle = "1";
    kap.classList.add("acik");
});

function ilerlemeSeciciKur() {
    const sel = $("#okur-bolum");
    const secenekler = [`<option value="0">Henüz başlamadım</option>`]
        .concat(DIZIN.bolumler.map(b => `<option value="${b.no}">${b.no}. ${esc(b.ad)} (${esc(b.pov)})</option>`));
    sel.innerHTML = secenekler.join("");
    sel.value = String(Math.min(okurBolum(), DIZIN.bolumler.length ? DIZIN.bolumler.at(-1).no : 0));
    sel.addEventListener("change", () => {
        try { localStorage.setItem(OKUR_ANAHTAR, sel.value); } catch { }
        document.querySelectorAll("[data-elle]").forEach(el => delete el.dataset.elle);
        spoilerlariUygula();
    });
}

// ---- Arama -----------------------------------------------------------------
function aramaKur() {
    const girdi = $("#wiki-arama"), liste = $("#arama-sonuc");
    const kayitlar = DIZIN.maddeler.map(m => ({ ad: m.ad, tur: TUR_AD[m.tur] || m.kategori.split("/").pop(), url: maddeUrl(m.ad) }));
    for (const s of EVREN.sistemler) {
        if (!MADDE.has(anahtar(s.isim))) kayitlar.push({ ad: s.isim, tur: "Yıldız sistemi", url: maddeUrl(s.isim) });
    }
    kayitlar.forEach(k => k.k = anahtar(k.ad));
    let secili = -1;
    const ciz = () => {
        const q = anahtar(girdi.value);
        if (!q) { liste.hidden = true; return; }
        const sonuc = kayitlar.filter(k => k.k.includes(q))
            .sort((a, b) => (a.k.startsWith(q) ? 0 : 1) - (b.k.startsWith(q) ? 0 : 1) || a.k.localeCompare(b.k)).slice(0, 12);
        secili = sonuc.length ? 0 : -1;
        liste.innerHTML = sonuc.length
            ? sonuc.map((k, i) => `<li><a href="${k.url}" class="${i === 0 ? "secili" : ""}">${esc(k.ad)}<small>${esc(k.tur)}</small></a></li>`).join("")
            : `<li><a>Sonuç yok</a></li>`;
        liste.hidden = false;
    };
    girdi.addEventListener("input", ciz);
    girdi.addEventListener("keydown", (e) => {
        const a = [...liste.querySelectorAll("a[href]")];
        if (e.key === "Enter" && a[secili]) location.href = a[secili].href;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!a.length) return;
            secili = (secili + (e.key === "ArrowDown" ? 1 : a.length - 1)) % a.length;
            a.forEach((x, i) => x.classList.toggle("secili", i === secili));
        }
        if (e.key === "Escape") liste.hidden = true;
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".arama-blok")) liste.hidden = true; });
}

const tarihYaz = (t) => { try { return new Date(t + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" }); } catch { return t; } };

async function sonEklenenler() {
    const akis = DIZIN.son_eklenenler || [];   // senkron betiği üretir
    $("#son-eklenenler-listesi").innerHTML = akis.map(i => {
        const tur = i.tur === "bolum" ? "Bölüm" : (TUR_AD[i.tur] || "");
        const meta = i.tarih ? `<span class="akis-meta">${esc(tur)}${tur ? " · " : ""}<span class="akis-durum ${i.durum}">${i.durum === "guncellendi" ? "güncellendi" : "eklendi"}</span> · ${esc(tarihYaz(i.tarih))}</span>` : "";
        return `<li class="akis"><a href="${esc(i.url)}">${esc(i.baslik)}</a>${meta}</li>`;
    }).join("");
}

function kategoriMenusu(aktif) {
    $("#kategori-listesi").innerHTML = LISTE_SIRASI.map(k => {
        const L = LISTELER[k];
        return `<li class="${L.ust ? "alt-madde" : ""}${k === aktif ? " aktif" : ""}"><a href="${listeUrl(k)}">${esc(L.ad)}</a></li>`;
    }).join("");
}

// ---- Bilgi kutusu ----------------------------------------------------------
function satirlar(ciftler) {
    const s = ciftler.filter(([, v]) => v !== null && v !== undefined && v !== "");
    return s.length ? `<dl class="ib-satirlar">${s.map(([e, v]) => `<dt>${esc(e)}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
}
function bolum(baslik, ic) { return ic ? `<div class="ib-bolum"><h4>${esc(baslik)}</h4>${ic}</div>` : ""; }
function cipler(adlar) {
    const s = adlar.filter(a => a && String(a).trim());
    return s.length ? `<div class="ib-cipler">${s.map(a => {
        const c = coz(a);
        return c ? `<a class="ib-cip" href="${c.url}">${esc(a)}</a>` : `<span class="ib-cip yok" title="${YAZILMADI}">${esc(a)}</span>`;
    }).join("")}</div>` : "";
}
function ekAlanlar(oz, haric = []) {
    const bos = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
    return Object.entries(oz || {}).filter(([k, v]) => !GIZLI_ALAN.has(k) && !haric.includes(k) && !bos(v))   // boş alanlar gösterilmez
        .map(([k, v]) => [etiketle(k), degerHtml(v)]);
}

/** Devlet rengi: evren.json'daki yazımla (Yildiz Ateseligi) ya da nottaki yazımla (Yıldız Ateşeliği) */
function devletRengi(ad) {
    if (!ad) return null;
    if (DEVLET_RENK[ad]) return DEVLET_RENK[ad];
    const k = Object.keys(DEVLET_RENK).find(x => anahtar(x) === anahtar(ad));
    return k ? DEVLET_RENK[k] : null;
}

function devletHtml(d) {
    if (!d) return "Bağımsız";
    const renk = devletRengi(d);
    const nokta = renk ? `<span class="devlet-nokta" style="background:${renk}"></span>` : "";
    return nokta + linkHtml(d, d);
}

function sinifHtml(tip) {
    if (!tip) return "Bilinmiyor";
    const p = String(tip).split("/").map(t => t.trim());
    const ad = p.length > 1 ? "Çoklu yıldız" : (SINIF_AD[p[0][0]?.toUpperCase()] || "");
    return `${esc(tip)}${ad ? ` <span style="color:var(--soluk)">· ${ad}</span>` : ""}`;
}

/** Çift sistemin eşi (evren.json "ciftler"), yoksa null */
function esi(s) {
    const c = (EVREN.ciftler || []).find(c => c.includes(s.isim));
    return c ? c.find(x => x !== s.isim) : null;
}

/** Vermis bağlantıları; çift sistemde eşlerin bağlantıları ortaktır */
function komsular(s) {
    const es = esi(s), adlar = new Set();
    for (const b of EVREN.baglantilar) {
        for (const ad of [s.isim, es]) {
            if (ad && b.yildiz1 === ad) adlar.add(b.yildiz2);
            if (ad && b.yildiz2 === ad) adlar.add(b.yildiz1);
        }
    }
    adlar.delete(s.isim); if (es) adlar.delete(es);
    return [...adlar];
}

function miniHarita(s) {
    const R = 7, cx = s.x, cy = s.y;
    const SINIR = 14;   // kullanıcı haritayı merkezden en fazla bu kadar ışık yılı kaydırabilir
    const k = R / 11;   // nokta ve yazı boyutları R değişse de ekranda aynı kalsın
    const komsu = new Set(komsular(s));
    // kaydırınca görünebilecek her yıldızı çiz (pencere + kaydırma sınırı)
    const icinde = (o) => Math.abs(o.x - cx) <= R + SINIR && Math.abs(o.y - cy) <= R + SINIR;
    const konum = new Map(EVREN.sistemler.map(o => [o.isim, o]));
    let cizgiler = "", noktalar = "";
    for (const b of EVREN.baglantilar) {
        const a = konum.get(b.yildiz1), c = konum.get(b.yildiz2);
        if (!a || !c || !(icinde(a) || icinde(c))) continue;
        const aktif = a === s || c === s;
        cizgiler += `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${aktif ? "#4da6ff" : "#ffffff"}" stroke-opacity="${aktif ? 0.8 : 0.15}" stroke-width="${(aktif ? 0.12 : 0.07) * k}"/>`;
    }
    for (const o of EVREN.sistemler) {
        if (!icinde(o) || o === s) continue;
        const renk = DEVLET_RENK[o.devlet] || "#bbbbbb";
        noktalar += `<a href="${maddeUrl(o.isim)}"><title>${esc(o.isim)}${o.devlet ? " · " + esc(o.devlet) : ""}</title>` +
            `<circle cx="${o.x}" cy="${o.y}" r="${(komsu.has(o.isim) ? 0.4 : 0.28) * k}" fill="${renk}" fill-opacity="${komsu.has(o.isim) ? 1 : 0.6}"/></a>` +
            (komsu.has(o.isim) ? `<text x="${o.x + 0.6 * k}" y="${o.y + 0.3 * k}" font-size="${0.8 * k}" fill="#c4cad4">${esc(o.isim)}</text>` : "");
    }
    const merkezRenk = DEVLET_RENK[s.devlet] || "#bbbbbb";   // diğer noktalar gibi devlet rengi
    const merkez = `<circle cx="${cx}" cy="${cy}" r="${1.1 * k}" fill="none" stroke="${merkezRenk}" stroke-opacity="0.6" stroke-width="${0.1 * k}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${0.5 * k}" fill="${merkezRenk}"/>` +
        `<text x="${cx + 1.3 * k}" y="${cy + 0.3 * k}" font-size="${0.95 * k}" fill="#fff" font-weight="700">${esc(s.isim)}</text>`;
    return `<div class="mini-kap"><svg class="mini-harita" data-cx="${cx}" data-cy="${cy}" data-r="${R}" data-sinir="${SINIR}" viewBox="${cx - R} ${cy - R} ${2 * R} ${2 * R}" role="img" aria-label="${esc(s.isim)} çevresindeki yıldızlar" font-family="Oxanium, sans-serif">` +
        cizgiler + noktalar + merkez + `</svg><button type="button" class="mini-merkez" title="Merkeze dön" hidden>⌖</button></div>` +
        `<p class="mini-not">Üstten görünüm · ±${R} ışık yılı · sürükleyerek kaydırabilirsin</p>`;
}

/** Mini haritayı sürüklenebilir yapar (sadece kaydırma, döndürme yok) */
function miniHaritaEtkinlestir() {
    document.querySelectorAll(".mini-harita:not(.topraklar)").forEach(svg => {
        const cx = +svg.dataset.cx, cy = +svg.dataset.cy, R = +svg.dataset.r, S = +svg.dataset.sinir;
        const dugme = svg.parentElement.querySelector(".mini-merkez");
        const sinirla = (v) => Math.max(-S, Math.min(S, v));
        let ox = 0, oy = 0, bas = null, suruklendi = false;
        const uygula = () => {
            svg.setAttribute("viewBox", `${cx + ox - R} ${cy + oy - R} ${2 * R} ${2 * R}`);
            dugme.hidden = Math.hypot(ox, oy) < 0.01;
        };
        const merkezeDon = () => { ox = oy = 0; uygula(); };

        svg.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            bas = { x: e.clientX, y: e.clientY, ox, oy, id: e.pointerId };
            suruklendi = false;
        });
        svg.addEventListener("pointermove", (e) => {
            if (!bas) return;
            const dx = e.clientX - bas.x, dy = e.clientY - bas.y;
            if (!suruklendi) {
                if (Math.hypot(dx, dy) < 4) return;          // küçük titremeler tıklama sayılır
                suruklendi = true;
                svg.setPointerCapture(bas.id);
                svg.classList.add("suruklen");
            }
            const olcek = (2 * R) / svg.getBoundingClientRect().width;   // piksel -> ışık yılı
            ox = sinirla(bas.ox - dx * olcek);
            oy = sinirla(bas.oy - dy * olcek);
            uygula();
        });
        const bitir = () => { bas = null; svg.classList.remove("suruklen"); };
        svg.addEventListener("pointerup", bitir);
        svg.addEventListener("pointercancel", bitir);
        // sürükleme bir noktanın üstünde biterse link açılmasın
        svg.addEventListener("click", (e) => {
            if (suruklendi) { e.preventDefault(); e.stopPropagation(); suruklendi = false; }
        }, true);
        svg.addEventListener("dblclick", merkezeDon);
        dugme.addEventListener("click", merkezeDon);
    });
}

// ---- Sistem şeması (yıldız + gezegenler) ------------------------------------
const GEZEGEN_RENKLERI = ["#c9b28f", "#d98b5f", "#6fa3c7", "#7fb07a", "#b98fd6", "#e0c068", "#8a8f99", "#c96f5b", "#5b8fd9"];
const GEZEGEN_BOYUT = { kucuk: 5, orta: 7, buyuk: 10, dev: 13 };   // gezegen notunda "boyut: dev" gibi

function sayiOzeti(ad) { let h = 0; for (const c of ad) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; }

/** Gezegenin rengi ve boyutu: yayınlanmış notunda "renk"/"boyut" varsa onlar, yoksa adından türetilen sabit bir değer */
function gezegenGorunumu(ad) {
    const oz = MADDE.get(anahtar(ad))?.ozellikler || {};
    const h = sayiOzeti(ad);
    const boyut = GEZEGEN_BOYUT[anahtar(String(oz.boyut || ""))] || [5, 6, 7, 8, 10][h % 5];
    const renk = /^#[0-9a-f]{3,8}$/i.test(String(oz.renk || "")) ? oz.renk : GEZEGEN_RENKLERI[(h >>> 3) % GEZEGEN_RENKLERI.length];
    return { boyut, renk };
}

const sade = (x) => anahtar(x).replace(/[\s\-–]/g, "");   // "Gama Kefir III" == "Gama Kefir - III"

/** Sistemdeki gezegenler: evren.json sırası + yayınlanmış ama listede olmayan gezegen notları */
function sistemGezegenleri(s) {
    const liste = (s.gezegenler || []).filter(g => g && String(g).trim());
    const ak = anahtar(s.isim);
    DIZIN.maddeler.filter(x => x.tur === "gezegen" && anahtar(sistemAdiCoz(x.ozellikler?.sistem) || "") === ak)
        .forEach(x => { if (!liste.some(g => sade(g) === sade(x.ad))) liste.push(x.ad); });
    return liste;
}

/** Bir uydunun bağlı olduğu gezegen: notundaki "gezegen" alanı, "Ay (Dünya)" yazımı ya da "Gama Kefir III-b" adı */
function uyduEbeveyni(ad, gezegenler) {
    const bul = (aday) => aday ? gezegenler.find(g => sade(g) === sade(aday)) : null;
    const oz = MADDE.get(anahtar(ad))?.ozellikler || {};
    return bul(sistemAdiCoz(oz.gezegen))
        || bul((String(ad).match(/\(([^)]+)\)\s*$/) || [])[1])
        || bul((String(ad).match(/^(.*?)\s*-\s*[a-zçğıöşü]$/i) || [])[1])
        || null;
}

/** Sistemdeki uydular: [{ad, ebeveyn}] */
function sistemUydulari(s, gezegenler) {
    const adlar = (s.Uydular || s.uydular || []).filter(u => u && String(u).trim());
    const ak = anahtar(s.isim);
    DIZIN.maddeler.filter(x => x.tur === "uydu" && anahtar(sistemAdiCoz(x.ozellikler?.sistem) || "") === ak)
        .forEach(x => { if (!adlar.some(u => anahtar(u) === anahtar(x.ad))) adlar.push(x.ad); });
    return adlar.map(ad => ({ ad, ebeveyn: uyduEbeveyni(ad, gezegenler) }));
}

function sistemSemasi(s, gezegenler, uydular = [], vurgu = null) {
    const W = 290, yildizGenislik = 54, bas = yildizGenislik + 22, son = W - 16;
    const n = gezegenler.length;
    const adim = n > 1 ? Math.min(48, (son - bas) / (n - 1)) : 0;   // az gezegen varsa yayılmasın
    const enCokUydu = Math.max(0, ...gezegenler.map(g => uydular.filter(u => u.ebeveyn === g).length));
    const cy = 50 + Math.max(0, enCokUydu - 2) * 10;                    // uydular üstte yer açsın
    const yildizRenk = s.renk || "#ffcc66";
    const enUzun = Math.max(0, ...gezegenler.map(g => String(g).length));
    const H = cy + 26 + Math.min(110, enUzun * 5.4);
    const yr = H * 1.1, ycx = yildizGenislik - yr;                       // yıldız: şemanın solunu boydan boya kaplar
    const vk = vurgu ? anahtar(vurgu) : null;
    const halka = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="0.8"/>`;
    let defs = `<radialGradient id="sm-yildiz" cx="92%" cy="45%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="${esc(yildizRenk)}"/><stop offset="100%" stop-color="${esc(yildizRenk)}" stop-opacity="0.55"/></radialGradient>`;
    // gezegenler mat: düz renk + üstüne yumuşak bir gölge (parlama yok)
    defs += `<radialGradient id="sm-golge" cx="38%" cy="35%" r="75%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="60%" stop-color="#000" stop-opacity="0.18"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></radialGradient>`;
    const matKure = (x, y, r, renk) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${esc(renk)}"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#sm-golge)"/>`;
    const sarmala = (ad, ic, sinif) => { const c = coz(ad); return c ? `<a href="${c.url}" class="${sinif}">${ic}</a>` : `<g class="${sinif} yok">${ic}</g>`; };
    let govde = "";
    gezegenler.forEach((ad, i) => {
        const x = bas + i * adim;
        const { boyut, renk } = gezegenGorunumu(ad);
        const c = coz(ad), secili = anahtar(ad) === vk;
        const ic = `<title>${esc(ad)}${c ? "" : " · " + YAZILMADI}</title>` +
            matKure(x, cy, boyut, renk) + (secili ? halka(x, cy, boyut + 3) : "") +
            `<line x1="${x}" y1="${cy + boyut + 3}" x2="${x}" y2="${cy + 16}" stroke="#8b93a3" stroke-width="0.6"/>` +
            `<text x="${x}" y="${cy + 20}" transform="rotate(-90 ${x} ${cy + 20})" text-anchor="end" dominant-baseline="middle" font-size="9" ${secili ? 'font-weight="700"' : ""} fill="${secili ? "#fff" : c ? "#FFD700" : "#c4cad4"}">${esc(ad)}</text>`;
        govde += sarmala(ad, ic, "sm-gezegen");
        // bu gezegenin uyduları: gezegenin üstünde küçük noktalar
        uydular.filter(u => u.ebeveyn === ad).forEach((u, j) => {
            const uy = cy - boyut - 8 - j * 10, ur = 3;
            const ug = gezegenGorunumu(u.ad), us = anahtar(u.ad) === vk, uc = coz(u.ad);
            const uic = `<title>${esc(u.ad)} (uydu)${uc ? "" : " · " + YAZILMADI}</title>` +
                `<line x1="${x}" y1="${uy + ur}" x2="${x}" y2="${cy - boyut - 1}" stroke="#8b93a3" stroke-opacity="0.5" stroke-width="0.5"/>` +
                matKure(x, uy, ur, ug.renk) + (us ? halka(x, uy, ur + 2.5) : "");
            govde += sarmala(u.ad, uic, "sm-gezegen sm-uydu");
        });
    });
    return `<svg class="sistem-semasi" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.isim)} sistemi" font-family="Oxanium, sans-serif">
        <defs>${defs}</defs>
        <rect x="0" y="${cy - 9}" width="${W}" height="18" fill="${esc(yildizRenk)}" fill-opacity="0.13"/>
        <circle cx="${ycx}" cy="${cy}" r="${yr}" fill="url(#sm-yildiz)"/>
        ${govde}
    </svg><p class="mini-not">Ölçekli değildir · uydular gezegenlerinin üstünde</p>`;
}

/** Bilgi kutusundaki "Sistem" bölümü (yıldız, gezegen ve uydu sayfalarında ortak) */
function sistemBolumu(s, vurgu) {
    const gezegen = sistemGezegenleri(s), uydu = sistemUydulari(s, gezegen);
    const sema = gezegen.length ? sistemSemasi(s, gezegen, uydu, vurgu) : `<p class="mini-not" style="text-align:left">Kayıtlı gezegen yok.</p>`;
    const cip = uydu.length ? `<p class="mini-not" style="text-align:left;margin:10px 0 6px">Uydular (${uydu.length})</p>${cipler(uydu.map(u => u.ad))}` : "";
    return bolum("Sistem", sema + cip);
}

// ---- Devlet sayfaları ----------------------------------------------------------
/** Noktaların dışbükey zarfı (3D haritadaki bölge hacminin üstten görünümü) */
function disbukeyZarf(noktalar) {
    const p = [...noktalar].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const capraz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const alt = [], ust = [];
    for (const q of p) { while (alt.length >= 2 && capraz(alt.at(-2), alt.at(-1), q) <= 0) alt.pop(); alt.push(q); }
    for (const q of [...p].reverse()) { while (ust.length >= 2 && capraz(ust.at(-2), ust.at(-1), q) <= 0) ust.pop(); ust.push(q); }
    return alt.slice(0, -1).concat(ust.slice(0, -1));
}

/** Devletin evren.json'daki sistemleri ve (varsa) genişleme bölgesi */
function devletSistemleri(m) {
    const ak = anahtar(m.ozellikler?.evren_adi || m.ad);
    const sistemler = EVREN.sistemler.filter(s => s.devlet && anahtar(s.devlet) === ak);
    // genişleme bölgesi: notta "genisleme_bolgesi" yazılıysa o, yoksa "Pulsar ... Genişleme Bölgesi" gibi aynı kelimeyle başlayan bölge
    const ilkKelime = anahtar(m.ad).split(" ")[0];
    const bolgeAdi = sistemAdiCoz(m.ozellikler?.genisleme_bolgesi)
        || [...new Set(EVREN.sistemler.map(s => s.devlet).filter(Boolean))].find(d => anahtar(d).includes("genisleme") && anahtar(d).split(" ")[0] === ilkKelime);
    const genisleme = bolgeAdi ? EVREN.sistemler.filter(s => s.devlet && anahtar(s.devlet) === anahtar(bolgeAdi)) : [];
    return { sistemler, genisleme, bolgeAdi };
}

function topraklarHaritasi(m, renk, sistemler, genisleme, baskentYildiz) {
    // çerçeve: bir devlete bağlı tüm yıldızlar (yerleşik galaksi); çok uzaktaki bağımsız yıldızlar çerçeveyi büyütmesin
    const cekirdek = EVREN.sistemler.filter(s => s.devlet);
    const xs = cekirdek.map(s => s.x), ys = cekirdek.map(s => s.y);
    const pay = 4, x0 = Math.min(...xs) - pay, y0 = Math.min(...ys) - pay;
    const w = Math.max(...xs) + pay - x0, h = Math.max(...ys) + pay - y0;
    const k = Math.max(w, h) / 45;   // boyutlar haritanın genişliğine göre
    const bolge = (liste, opak) => {
        if (!liste.length) return "";
        const z = disbukeyZarf(liste.map(s => [s.x, s.y]));
        if (z.length < 3) return liste.map(s => `<circle cx="${s.x}" cy="${s.y}" r="${2.2 * k}" fill="${renk}" fill-opacity="${opak}"/>`).join("");
        return `<polygon points="${z.map(q => q.join(",")).join(" ")}" fill="${renk}" fill-opacity="${opak}" stroke="${renk}" stroke-opacity="${opak * 2.5}" stroke-width="${0.25 * k}" stroke-linejoin="round"/>`;
    };
    const uye = new Set(sistemler), gen = new Set(genisleme);
    let noktalar = "";
    for (const s of EVREN.sistemler) {
        const benim = uye.has(s), g = gen.has(s);
        const r = (benim ? 0.55 : 0.4) * k;
        const ic = `<title>${esc(s.isim)}${s.devlet ? " · " + esc(s.devlet) : ""}</title><circle cx="${s.x}" cy="${s.y}" r="${r}" fill="${benim || g ? renk : "#8b93a3"}" fill-opacity="${benim ? 1 : g ? 0.55 : 0.35}"/>`;
        noktalar += `<a href="${maddeUrl(s.isim)}">${ic}</a>`;
    }
    const yildizIsaret = baskentYildiz ? `<circle cx="${baskentYildiz.x}" cy="${baskentYildiz.y}" r="${1.3 * k}" fill="none" stroke="#fff" stroke-width="${0.18 * k}"/>` : "";
    return `<svg class="mini-harita topraklar" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="${esc(m.ad)} toprakları" font-family="Oxanium, sans-serif">
        ${bolge(genisleme, 0.08)}${bolge(sistemler, 0.2)}${noktalar}${yildizIsaret}
    </svg><p class="mini-not">Üstten görünüm · yerleşik galaksi${genisleme.length ? " · soluk bölge: genişleme alanı" : ""}${baskentYildiz ? " · halka: başkent" : ""}</p>`;
}

function devletKutusu(m) {
    const renk = devletRengi(m.ozellikler?.evren_adi || m.ad) || "#8b93a3";
    const oz = { ...(m.ozellikler || {}) };
    delete oz.genisleme_bolgesi;
    // alanları sabit sırayla göster, kalanlar sonda
    const sirali = {};
    DEVLET_ALAN_SIRASI.forEach(k => { if (k in oz) sirali[k] = oz[k]; });
    Object.keys(oz).forEach(k => { if (!(k in sirali)) sirali[k] = oz[k]; });
    const { sistemler, genisleme, bolgeAdi } = devletSistemleri(m);
    // başkentin yıldızı: başkent bir gezegen/şehir ise onu barındıran sistem
    const bAd = sistemAdiCoz(oz.baskent);
    const baskentYildiz = bAd ? (EVREN.sistemler.find(s => anahtar(s.isim) === anahtar(bAd) || (s.gezegenler || []).some(g => g && anahtar(g) === anahtar(bAd)))
        || SISTEM.get(anahtar(sistemAdiCoz(MADDE.get(anahtar(bAd))?.ozellikler?.sistem) || ""))) : null;
    const gezegenSayisi = sistemler.reduce((t, s) => t + (s.gezegenler || []).filter(g => g && String(g).trim()).length, 0);
    const ozet = `<p class="mini-not" style="text-align:left;margin:8px 0 6px">${sistemler.length} yıldız sistemi · ${gezegenSayisi} bilinen gezegen${genisleme.length ? ` · genişleme bölgesinde ${genisleme.length} sistem` : ""}</p>`;
    const topraklar = sistemler.length || genisleme.length
        ? topraklarHaritasi(m, renk, sistemler, genisleme, baskentYildiz) + ozet + cipler(sistemler.map(s => s.isim))
          + (genisleme.length ? `<p class="mini-not" style="text-align:left;margin:10px 0 6px">${esc(bolgeAdi)}</p>${cipler(genisleme.map(s => s.isim))}` : "")
        : `<p class="mini-not" style="text-align:left">Haritada kayıtlı toprağı yok.</p>`;
    const kisaltma = m.ad.split(/\s+/).filter(w => w.length > 2 || /^[A-ZÇĞİÖŞÜ]/.test(w)).slice(0, 2).map(w => w[0].toLocaleUpperCase("tr")).join("");
    return `<aside class="ib" style="--yildiz:${esc(renk)}">
        <div class="ib-bas"><div class="ib-amblem"><span>${esc(kisaltma)}</span></div><h3>${esc(m.ad)}</h3><p>${esc(TUR_AD[m.tur] || "Devlet")}</p></div>
        ${bolum("Genel", satirlar(ekAlanlar(sirali)))}
        ${bolum("Topraklar", topraklar)}
    </aside>`;
}

/** Gezegen ve uydu sayfalarının bilgi kutusu */
function gokCismiKutusu(m, s) {
    const { renk } = gezegenGorunumu(m.ad);
    const oz = { ...(m.ozellikler || {}) };
    const satir = [["Sistem", linkHtml(s.isim, s.isim)]];
    if (s.devlet) satir.push(["Bağlılık", devletHtml(s.devlet)]);
    if (m.tur === "uydu") {
        const ebeveyn = uyduEbeveyni(m.ad, sistemGezegenleri(s));
        if (ebeveyn) { satir.push(["Gezegeni", linkHtml(ebeveyn, ebeveyn)]); delete oz.gezegen; }
    }
    delete oz.sistem;
    satir.push(...ekAlanlar(oz));
    return `<aside class="ib" style="--yildiz:${esc(renk)}">
        <div class="ib-bas"><div class="ib-kure mat"></div><h3>${esc(m.ad)}</h3><p>${esc(TUR_AD[m.tur] || "")} · ${esc(s.isim)} sistemi</p></div>
        ${bolum("Genel", satirlar(satir))}
        ${sistemBolumu(s, m.ad)}
    </aside>`;
}

function yildizKutusu(s, m) {
    const oz = m?.ozellikler || {};
    const uzaklik = Math.hypot(s.x, s.y, s.z);
    const genel = satirlar([
        ["Bağlılık", devletHtml(s.devlet)],
        ["Yıldız sınıfı", sinifHtml(s.tip)],
        ["Sol'a uzaklık", s.isim === "Sol" ? "—" : `${uzaklik.toFixed(2)} ışık yılı`],
        ...(esi(s) ? [["Eş yıldız", linkHtml(esi(s), esi(s))]] : []),
        ...ekAlanlar(oz)
    ]);
    const k = komsular(s);
    return `<aside class="ib" style="--yildiz:${esc(s.renk || "#ffcc66")}">
        <div class="ib-bas"><div class="ib-kure"></div><h3>${esc(m?.ad || s.isim)}</h3><p>${esc(s.tip || "?")} sınıfı yıldız sistemi</p></div>
        ${bolum("Genel", genel)}
        ${sistemBolumu(s, null)}
        ${bolum("Konum", miniHarita(s) + satirlar([["Koordinat", `<span style="font-size:.8rem">${s.x} · ${s.y} · ${s.z}</span>`]]))}
        ${bolum("Bağlantılı sistemler", cipler(k))}
    </aside>`;
}

function genelKutu(m) {
    const alanlar = ekAlanlar(m.ozellikler);
    if (!alanlar.length) return "";
    return `<aside class="ib"><div class="ib-bas"><h3>${esc(m.ad)}</h3><p>${esc(TUR_AD[m.tur] || "")}</p></div>${bolum("Bilgiler", satirlar(alanlar))}</aside>`;
}

// ---- Sayfalar --------------------------------------------------------------
function kirinti(liste, ad) {
    const zincir = [];
    for (let k = liste; k && LISTELER[k]; k = LISTELER[k].ust) zincir.unshift([LISTELER[k].ad, listeUrl(k)]);
    const yol = [["Wiki", "wiki.html"], ...zincir];
    if (!ad) return `<nav class="kirinti">${yol.slice(0, -1).map(([a, u]) => `<a href="${u}">${esc(a)}</a>`).join("<span>›</span>")}${yol.length > 1 ? "<span>›</span>" : ""}${esc(yol.at(-1)[0])}</nav>`;
    return `<nav class="kirinti">${yol.map(([a, u]) => u ? `<a href="${u}">${esc(a)}</a>` : esc(a)).join("<span>›</span>")}<span>›</span>${esc(ad)}</nav>`;
}

function kartlar(liste) {
    return `<div class="kart-izgara">${liste.map(m => `<a class="kart" href="${maddeUrl(m.ad)}"><strong>${esc(m.ad)}</strong><small>${esc(TUR_AD[m.tur] || "")}</small>${m.ozet ? `<p>${esc(m.ozet)}</p>` : ""}</a>`).join("")}</div>`;
}

function ekBolumler(m, s) {
    let html = "", gosterilen = new Set();
    if (s) {  // bu sisteme bağlı maddeler (frontmatter'da sistem: [[X]])
        const ak = anahtar(s.isim);
        const bagli = DIZIN.maddeler.filter(x => x !== m && [].concat(x.ozellikler?.sistem || []).some(v => anahtar(String(v).replace(/[\[\]]/g, "")) === ak));
        bagli.forEach(x => gosterilen.add(x));
        if (bagli.length) html += `<section class="madde-ek"><h2>Bu sistemdeki maddeler</h2>${kartlar(bagli)}</section>`;
    }
    if (m && m.tur === "devlet") {
        const ak = anahtar(m.ad);
        // bağlı kurumlar: notunda "bagli: [[Devlet]]" yazanlar; alan yoksa devletin klasöründekiler
        const kurumlar = DIZIN.maddeler.filter(x => x !== m && ["sirket", "kurum", "fraksiyon"].includes(x.tur) && (
            x.ozellikler?.bagli ? anahtar(sistemAdiCoz(x.ozellikler.bagli) || "") === ak : (x.klasor && anahtar(x.klasor) === ak)));
        kurumlar.forEach(x => gosterilen.add(x));
        if (kurumlar.length) html += `<section class="madde-ek"><h2>Bağlı kurum ve şirketler</h2>${kartlar(kurumlar)}</section>`;
        const adlar = new Set([m.ad, m.slug, ...(m.aliases || [])].map(anahtar));
        const linkli = (tur) => DIZIN.maddeler.filter(x => x !== m && !gosterilen.has(x) && x.tur === tur && x.baglantilar.some(l => adlar.has(anahtar(l))));
        const kisiler = linkli("karakter"); kisiler.forEach(x => gosterilen.add(x));
        if (kisiler.length) html += `<section class="madde-ek"><h2>İlgili kişiler</h2>${kartlar(kisiler)}</section>`;
        const olaylar = linkli("olay"); olaylar.forEach(x => gosterilen.add(x));
        if (olaylar.length) html += `<section class="madde-ek"><h2>Olaylar</h2>${kartlar(olaylar)}</section>`;
    }
    if (m) {
        const adlar = new Set([m.ad, m.slug, ...(m.aliases || [])].map(anahtar));
        const geri = DIZIN.maddeler.filter(x => x !== m && !gosterilen.has(x) && x.baglantilar.some(l => adlar.has(anahtar(l))));
        if (geri.length) html += `<section class="madde-ek"><h2>Bu maddeye bağlantı verenler</h2>${kartlar(geri)}</section>`;
    }
    return html;
}

function maddeCiz({ baslik, alt, liste, govdeHtml, kutu, ek }) {
    document.title = `${baslik} - Wiki - The Travel`;
    kategoriMenusu(liste);
    $("#wiki-icerik").innerHTML = `<article class="madde">
        ${kirinti(liste, baslik)}
        <header class="madde-baslik"><h1>${esc(baslik)}</h1>${alt ? `<p class="madde-alt">${alt}</p>` : ""}</header>
        <div class="madde-izgara ${kutu ? "" : "kutusuz"}" ${kutu ? "" : 'style="grid-template-columns:1fr"'}>
            <div class="madde-govde">${govdeHtml}</div>
            ${kutu || ""}
        </div>
        ${ek || ""}
    </article>`;
    spoilerlariUygula();
    miniHaritaEtkinlestir();
}

async function maddeSayfasi(madde, kategori) {
    const k = anahtar(madde);
    const m = MADDE.get(k);
    const s = m ? (SISTEM.get(anahtar(sistemAdi(m))) || null) : SISTEM.get(k);

    // gezegen/uydu: notundaki sistem alanından yıldızını bul
    const gokYildiz = m && (m.tur === "gezegen" || m.tur === "uydu") ? SISTEM.get(anahtar(sistemAdiCoz(m.ozellikler?.sistem) || "")) : null;

    if (m) {
        const ham = await getirMetin(m.dosya);
        const [h1, govde] = basligiAyir(ham ?? "");
        const govdeHtml = govde.trim() ? mdCiz(govde) : `<p class="bos-not">Bu madde henüz yazılmadı.</p>`;
        const altParca = [TUR_AD[m.tur] || ""];
        if (s?.devlet) altParca.push(linkHtml(s.devlet, s.devlet));
        if (gokYildiz) altParca.push(`${linkHtml(gokYildiz.isim, gokYildiz.isim)} sistemi`);
        maddeCiz({
            baslik: s ? m.ad : (h1 || m.ad),   // yıldız sayfalarında başlık her zaman yıldızın adı
            liste: TUR_LISTE[m.tur] || (s ? "yildizlar" : null), govdeHtml,
            alt: altParca.filter(Boolean).join(" · "),
            kutu: s ? yildizKutusu(s, m) : gokYildiz ? gokCismiKutusu(m, gokYildiz) : m.tur === "devlet" ? devletKutusu(m) : genelKutu(m),
            ek: ekBolumler(m, s)
        });
        return;
    }
    if (s) {   // evren.json'da olan ama maddesi yazılmamış yıldız
        maddeCiz({
            baslik: s.isim, liste: "yildizlar",
            alt: `Yıldız sistemi${s.devlet ? " · " + linkHtml(s.devlet, s.devlet) : ""}`,
            govdeHtml: `<p class="bos-not">Bu sistem hakkında henüz bir madde yazılmadı. Haritadaki verileri sağdaki bilgi kutusunda görebilirsin.</p>`,
            kutu: yildizKutusu(s, null), ek: ekBolumler(null, s)
        });
        return;
    }
    // Eski sistem: wiki/<kategori>/<madde>.md (dizinde olmayan, elle eklenmiş sayfalar)
    const kat = kategori || "Teknoloji";
    const ham = await getirMetin(`wiki/${kat}/${madde}.md`);
    if (ham !== null) {
        const [h1, govde] = basligiAyir(ham);
        maddeCiz({ baslik: h1 || madde.replace(/_/g, " "), liste: ESKI_KATEGORI_LISTE[kat] || null, govdeHtml: mdCiz(govde, kat) });
        return;
    }
    maddeCiz({ baslik: madde.replace(/_/g, " "), liste: null, govdeHtml: `<p class="bos-not">Bu madde henüz yazılmadı ya da yayımlanmadı.</p>` });
}

// ---- Liste sayfaları --------------------------------------------------------
const sistemAdiCoz = (v) => { const s = [].concat(v || [])[0]; return s ? String(s).replace(/[\[\]]/g, "").split("|")[0].trim() : null; };

/** Bir listedeki kayıtlar: {ad, grup, alt, renk} — sadece yayımlanmış maddeler ve evren.json'daki adlar */
function listeKayitlari(k) {
    const L = LISTELER[k];
    if (k === "yildizlar") {
        return EVREN.sistemler.map(s => ({ ad: s.isim, grup: s.devlet || "Bağımsız", alt: s.tip ? `${s.tip} sınıfı` : "", renk: DEVLET_RENK[s.devlet] }));
    }
    const kayit = new Map();
    if (L.evren) {
        for (const s of EVREN.sistemler) for (const g of (s[L.evren] || []).filter(x => x && String(x).trim())) {
            kayit.set(anahtar(g), { ad: g, grup: s.isim });
        }
    }
    for (const m of DIZIN.maddeler.filter(m => (L.turler || []).includes(m.tur))) {
        const grup = L.evren ? (sistemAdiCoz(m.ozellikler?.sistem) || "Sistemi bilinmeyen") : (L.grupla ? (TUR_COGUL[m.tur] || "Diğer") : "");
        kayit.set(anahtar(m.ad), { ad: m.ad, grup });
    }
    return [...kayit.values()];
}

function listeKutusu(x) {
    const c = coz(x.ad);
    const nokta = x.renk ? `<span class="devlet-nokta" style="background:${x.renk}"></span>` : "";
    const ic = `<span class="liste-ad">${nokta}${esc(x.ad)}</span>${x.alt ? `<small>${esc(x.alt)}</small>` : ""}`;
    return c ? `<a class="liste-kutu" href="${c.url}">${ic}</a>`
             : `<span class="liste-kutu yok" title="${YAZILMADI}">${ic}</span>`;
}

function listeGovdesi(k) {
    const kayitlar = listeKayitlari(k);
    if (!kayitlar.length) return `<p class="bos-not">Bu kategoride henüz yayımlanmış madde yok. ${YAZILMADI}</p>`;
    // grupları ilk görünme sırasıyla topla (yıldızlarda Bağımsız en sonda)
    const gruplar = new Map();
    for (const x of kayitlar) { if (!gruplar.has(x.grup)) gruplar.set(x.grup, []); gruplar.get(x.grup).push(x); }
    let adlar = [...gruplar.keys()];
    if (gruplar.has("Bağımsız")) adlar = adlar.filter(g => g !== "Bağımsız").concat("Bağımsız");
    if (gruplar.has("Sistemi bilinmeyen")) adlar = adlar.filter(g => g !== "Sistemi bilinmeyen").concat("Sistemi bilinmeyen");
    return adlar.map(g => {
        const ogeler = gruplar.get(g).sort((a, b) => k === "yildizlar" ? 0 : a.ad.localeCompare(b.ad, "tr"));
        const renk = k === "yildizlar" ? DEVLET_RENK[g] : null;
        const baslik = !g ? "" : `<h2 class="liste-grup-baslik">${renk ? `<span class="devlet-nokta" style="background:${renk}"></span>` : ""}${g === "Bağımsız" || g === "Sistemi bilinmeyen" ? esc(g) : linkHtml(g, g)}<small>${ogeler.length}</small></h2>`;
        return `<section class="liste-grup">${baslik}<div class="liste-izgara">${ogeler.map(listeKutusu).join("")}</div></section>`;
    }).join("");
}

function listeSayisi(k) { return LISTELER[k].alt ? LISTELER[k].alt.reduce((t, a) => t + listeSayisi(a), 0) : listeKayitlari(k).length; }

function listeSayfasi(k) {
    const L = LISTELER[k];
    document.title = `${L.ad} - Wiki - The Travel`;
    kategoriMenusu(k);
    const govde = L.alt
        ? `<div class="wiki-kategoriler">${L.alt.map(a => `<a class="kategori-kutu" href="${listeUrl(a)}"><h2>${esc(LISTELER[a].ad)}<small>${listeSayisi(a)} kayıt</small></h2></a>`).join("")}</div>`
        : listeGovdesi(k);
    $("#wiki-icerik").innerHTML = `<article class="madde liste-sayfasi">
        ${kirinti(k)}
        <header class="madde-baslik"><h1>${esc(L.ad)}</h1>${L.aciklama ? `<p class="madde-alt">${esc(L.aciklama)}</p>` : ""}</header>
        <div class="liste-govde">${govde}</div>
    </article>`;
}

function anaSayfa() {
    kategoriMenusu(null);
    const ana = LISTE_SIRASI.filter(k => !LISTELER[k].ust);
    const son = [...DIZIN.maddeler].sort((a, b) => (b.son_degisim || "").localeCompare(a.son_degisim || "")).slice(0, 6);
    $("#wiki-icerik").innerHTML = `<div class="wiki-giris">
        <h1>Wiki</h1>
        <p>Bilinen Galaksi'ye ait karakterler, yerler ve terimler.</p>
        <p class="yan-not">${DIZIN.maddeler.length} madde · ${EVREN.sistemler.length} yıldız sistemi</p>
        <div class="wiki-kategoriler">
            ${ana.map(k => `<a class="kategori-kutu" href="${listeUrl(k)}"><h2>${esc(LISTELER[k].ad)}<small>${listeSayisi(k)} kayıt</small></h2></a>`).join("")}
        </div>
        ${son.length ? `<section class="madde-ek"><h2>Son güncellenen maddeler</h2>${kartlar(son)}</section>` : ""}
    </div>`;
}

// ---- Başlat ----------------------------------------------------------------
(async function baslat() {
    [DIZIN, EVREN] = await Promise.all([
        getirJson("wiki-dizin.json", { bolumler: [], maddeler: [] }),
        getirJson("evren.json", { sistemler: [], baglantilar: [] })
    ]);
    DIZIN.bolumler ||= []; DIZIN.maddeler ||= []; EVREN.baglantilar ||= [];
    Object.assign(DEVLET_RENK, EVREN.devletler || {});
    veriyiHazirla();
    ilerlemeSeciciKur();
    aramaKur();
    sonEklenenler();

    const p = new URLSearchParams(location.search);
    let liste = p.get("liste");
    const madde = p.get("madde");
    if (!liste && madde && ESKI_LISTE[madde]) {   // eski "..._Listesi" linkleri
        liste = ESKI_LISTE[madde];
        history.replaceState(null, "", listeUrl(liste));
    }
    if (liste && LISTELER[liste]) listeSayfasi(liste);
    else if (madde) await maddeSayfasi(madde, p.get("kategori"));
    else anaSayfa();
})();
