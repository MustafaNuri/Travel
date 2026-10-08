/* =========================================================
   Ortak wiki linkleri — Roman, Tarihçe ve Wiki sayfaları kullanır
   [[Ad]] / [[Ad|Görünen]] işaretlerini çevirir:
     * maddesi yayımlanmış ya da evren.json'da olan  -> link
     * henüz yazılmamış                              -> noktalı altı çizili yazı
   ========================================================= */
const WikiLink = (() => {
    const YAZILMADI = "Sabret, yazacağız.";   // yazılmamış maddelerin üzerine gelince çıkan yazı
    const bilinen = new Map();                 // anahtar -> maddenin adı
    let hazir = null;

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Büyük/küçük harf ve Türkçe karakter farklarını yok sayar (wiki.js ile aynı kural)
    function anahtar(s) {
        return String(s).normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
            .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
            .replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
            .replace(/[\s_]+/g, " ").trim();
    }

    async function getir(yol) {
        try { const r = await fetch(yol); return r.ok ? await r.json() : {}; } catch { return {}; }
    }

    /** wiki-dizin.json ve evren.json'u bir kez yükler */
    function yukle() {
        return hazir ||= Promise.all([getir("wiki-dizin.json"), getir("evren.json")]).then(([dizin, evren]) => {
            for (const m of dizin.maddeler || []) {
                [m.ad, m.slug, ...(m.aliases || [])].forEach(a => bilinen.set(anahtar(a), m.ad));
            }
            for (const s of evren.sistemler || []) {
                if (!bilinen.has(anahtar(s.isim))) bilinen.set(anahtar(s.isim), s.isim);
            }
        });
    }

    /** Markdown metnindeki [[...]] linklerini HTML'e çevirir (yukle() bittikten sonra çağır) */
    function cevir(metin) {
        return metin.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, hedef, gorunen) => {
            hedef = hedef.split("#")[0].trim();
            gorunen = (gorunen || hedef).trim();
            const ad = bilinen.get(anahtar(hedef));
            return ad
                ? `<a href="wiki.html?madde=${encodeURIComponent(ad.trim().replace(/\s+/g, "_"))}">${esc(gorunen)}</a>`
                : `<span class="wl-yok" title="${YAZILMADI}">${esc(gorunen)}</span>`;
        });
    }

    return { yukle, cevir, YAZILMADI };
})();
