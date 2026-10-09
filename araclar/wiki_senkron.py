# -*- coding: utf-8 -*-
"""
Wiki senkron betiği
===================
Obsidian vault'undaki `yayinla: true` olan notları sitenin wiki/ klasörüne
kopyalar ve wiki arayüzünün kullandığı wiki-dizin.json dosyasını üretir.

Kullanım (site klasöründe, push etmeden önce):
    python araclar/wiki_senkron.py

Farklı klasörlerle denemek için:
    python araclar/wiki_senkron.py --vault "C:/..../Roman" --site "C:/..../yildiz-haritasi"

Bir notta yapılanlar:
  * Frontmatter (--- arasındaki kısım) okunur, bilgi kutusu için dizine yazılır.
  * "Yazar Notları" başlığından sonrası siteye GİTMEZ.
  * %% yorumlar %% ve ```dataview``` blokları silinir.
  * Geri kalan metin wiki/<kategori>/<Not_Adi>.md olarak yazılır.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------- AYARLAR --
# Hangi bilgisayarda hangi vault kullanılacak (bilgisayar adı -> vault yolu).
# Betik önce bu bilgisayarın adına bakar. Adı listede yoksa VAULT_ADAYLARI'na geçer;
# orada birden fazla yol varsa yanlış kopyayı okumamak için durur ve size sorar.
BILGISAYAR_VAULT = {
    "NURI": r"C:\Users\musta\Documents\a\Roman",   # iş bilgisayarı
    "DESKTOP-8HA5V59": r"D:\Roman\The Travel",   # ev bilgisayarı
}
VAULT_ADAYLARI = [
    r"C:\Users\musta\Documents\a\Roman",   # iş bilgisayarı
    r"D:\Roman\The Travel",                   # ev bilgisayarı
]
VARSAYILAN_SITE = str(Path(__file__).resolve().parent.parent)

# Vault'taki üst klasör -> sitedeki wiki kategorisi
KATEGORI_HARITASI = {
    "Yıldızlar": "Gok_Cisimleri/Yildizlar",
    "Gezegen ve Uydular": "Gok_Cisimleri/Gezegenler",
    "Karakterler": "Karakterler",
    "Teknolojiler": "Teknoloji",
    "Devlet, Bölge ve Fraksiyonlar": "Fraksiyonlar",
    "Şehirler": "Sehirler",
    "Olaylar ve Sonuçlar": "Olaylar",
    "Yiyecek, içecek, bitki, hayvanlar": "Doga",
    "Tarihçe": "Tarihce",
}
# Bu klasörlerdeki hiçbir not siteye gitmez
HARIC_KLASORLER = {"00_Roman", "YY Planlama", "ZZ dosyalar", "Haritalar"}
# Roman bölümleri: bu klasördeki "(1) Başlık (Bakış Açısı).md" biçimli notlar.
# Notta "yayinla: true" varsa bölüm sitenin roman/ klasörüne kopyalanır.
ROMAN_KLASORU = "00_Roman/Uzay_Yolculugu"
BOLUM_ADI = r"^\((\d+)\)\s*(.+?)\s*\(([^)]+)\)$"
VARSAYILAN_KATEGORI = "Diger"

# Otomatik etiketleme: bu klasörlerde "yayinla" alanı olmayan bir not bulunursa
# notun en üstüne "yayinla: false" (ve yoksa "tur: ...") eklenir. Notun metnine dokunulmaz.
# Böylece kök dizindeki bir notu doğru klasöre taşıyıp betiği çalıştırmanız yeterli olur.
VARSAYILAN_TUR = {
    "Yıldızlar": "yildiz",
    "Gezegen ve Uydular": "gezegen",        # adı "-b", "- a" gibi bitiyorsa: uydu
    "Karakterler": "karakter",
    "Teknolojiler": "teknoloji",
    "Devlet, Bölge ve Fraksiyonlar": "devlet",   # şirket/kurum ise notta elle değiştirin
    "Şehirler": "sehir",
    "Olaylar ve Sonuçlar": "olay",
    "Yiyecek, içecek, bitki, hayvanlar": "doga",
}
ALT_KLASOR_TUR = {"Uzay İstasyonları": "istasyon"}
# ---------------------------------------------------------------------------

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    import yaml  # Anaconda'da hazır gelir
except ImportError:
    yaml = None


def nfc(s):
    return unicodedata.normalize("NFC", s)


def frontmatter_ayir(metin):
    """(frontmatter_dict, govde) döndürür."""
    m = re.match(r"^\ufeff?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(\r?\n|$)", metin, re.S)
    if not m:
        return {}, metin
    ham = m.group(1)
    govde = metin[m.end():]
    if yaml:
        try:
            veri = yaml.safe_load(ham) or {}
            return (veri if isinstance(veri, dict) else {}), govde
        except Exception as e:
            print(f"  ! frontmatter okunamadı ({e}); basit okuyucu deneniyor")
    return basit_yaml(ham), govde


def basit_yaml(ham):
    """PyYAML yoksa: 'anahtar: deger' ve '  - liste' satırlarını okur."""
    veri, son = {}, None
    for satir in ham.splitlines():
        if not satir.strip() or satir.lstrip().startswith("#"):
            continue
        liste = re.match(r"^\s+-\s*(.*)$", satir)
        if liste and son:
            if not isinstance(veri.get(son), list):
                veri[son] = []
            veri[son].append(liste.group(1).strip().strip('"\''))
            continue
        kv = re.match(r"^([^:]+):\s*(.*)$", satir)
        if kv:
            son = kv.group(1).strip()
            d = kv.group(2).strip().strip('"\'')
            if d.lower() in ("true", "false"):
                d = d.lower() == "true"
            veri[son] = d if d != "" else None
    return veri


def json_uyumlu(v):
    if isinstance(v, dict):
        return {str(k): json_uyumlu(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [json_uyumlu(x) for x in v]
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    return str(v)  # tarih vb.


def govdeyi_temizle(govde):
    g = govde.replace("\r\n", "\n")
    # Yazar notları ve sonrası
    m = re.search(r"^[ \t]*(?:---[ \t]*\n\s*)?#{1,6}[ \t]*Yazar Notlar.*", g, re.M | re.I)
    if m:
        g = g[: m.start()]
    g = re.sub(r"%%.*?%%", "", g, flags=re.S)                     # Obsidian yorumları
    g = re.sub(r"```dataview(js)?\n.*?```", "", g, flags=re.S)     # dataview blokları
    g = re.sub(r"^#{1,6}[ \t]*Wiki Sayfas[ıi].*\n?", "", g, flags=re.M | re.I)
    g = "\n".join(s.rstrip() for s in g.split("\n"))               # sondaki boşluklar
    g = re.sub(r"\n{3,}", "\n\n", g).strip()
    g = re.sub(r"\n-{3,}$", "", g).strip()                         # sonda kalan ayraç
    return g + "\n"


def linkleri_bul(*parcalar):
    bulunan = []
    for p in parcalar:
        for m in re.finditer(r"\[\[([^\]|#]+)", p):
            hedef = m.group(1).strip()
            if hedef and hedef not in bulunan:
                bulunan.append(hedef)
    return bulunan


def ozet_cikar(govde):
    for paragraf in re.split(r"\n\s*\n", govde):
        p = paragraf.strip()
        if not p or p.startswith(("#", ">", "|", "-", "*", "```", "<")):
            continue
        p = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", p)
        p = re.sub(r"\[\[([^\]]+)\]\]", r"\1", p)
        p = re.sub(r"[=*_`]", "", p)
        p = re.sub(r"\s+", " ", p)
        return p[:220] + ("…" if len(p) > 220 else "")
    return ""


def tur_tahmin(parcalar, ad):
    if len(parcalar) > 2 and parcalar[-2] in ALT_KLASOR_TUR:
        return ALT_KLASOR_TUR[parcalar[-2]]
    tur = VARSAYILAN_TUR.get(parcalar[0])
    if tur == "gezegen" and re.search(r"-\s*[a-zçğıöşü]$", ad):
        tur = "uydu"
    return tur


def yayin_alani_ekle(dosya, fm, tur, deger=False):
    """Notta 'yayinla' yoksa en üste ekler. Metnin geri kalanı ve satır sonları aynen kalır."""
    ham = dosya.read_bytes().decode("utf-8")
    sat = "\r\n" if "\r\n" in ham else "\n"
    satirlar = (["tur: " + tur] if tur and "tur" not in fm else []) + ["yayinla: " + ("true" if deger else "false")]
    ek = "".join(s + sat for s in satirlar)
    m = re.match(r"^\ufeff?---[ \t]*\r?\n(.*?\r?\n)?---[ \t]*(\r?\n|$)", ham, re.S)
    if m:   # frontmatter var: açılış satırının hemen altına ekle
        ilk = re.match(r"^\ufeff?---[ \t]*\r?\n", ham).end()
        yeni = ham[:ilk] + ek + ham[ilk:]
    else:   # frontmatter yok: yeni blok aç
        yeni = "---" + sat + ek + "---" + sat + ham
    with open(dosya, "w", encoding="utf-8", newline="") as f:
        f.write(yeni)
    return satirlar


def bolum_temizle(govde):
    """Roman bölümü için hafif temizlik: yorumlar ve yazar notları çıkar, metnin geri kalanı aynen kalır."""
    m = re.search(r"^[ \t]*(?:---[ \t]*\r?\n\s*)?#{1,6}[ \t]*Yazar Notlar.*", govde, re.M | re.I | re.S)
    if m:
        govde = govde[: m.start()]
    govde = re.sub(r"%%.*?%%", "", govde, flags=re.S)
    return govde.strip("\r\n") + ("\r\n" if "\r\n" in govde else "\n")


def dosya_yaz_baglantisiz(hedef, icerik):
    """Hedef dosya Obsidian'daki notla hard link ile bağlıysa önce bağı koparır, sonra yazar.
    (Böylece siteye yazılan temiz kopya Obsidian'daki asıl bölüme dokunmaz.)"""
    if hedef.exists():
        bagli = hedef.stat().st_nlink > 1
        if not bagli and hedef.read_bytes() == icerik.encode("utf-8"):
            return False
        hedef.unlink()   # sadece sitedeki kopyayı siler; Obsidian'daki not yerinde kalır
    hedef.parent.mkdir(parents=True, exist_ok=True)
    with open(hedef, "w", encoding="utf-8", newline="") as f:
        f.write(icerik)
    return True


def bolumleri_yayinla(vault, site, etiketlenen):
    """Vault'taki bölümlerden yayinla: true olanları site/roman/ klasörüne kopyalar."""
    klasor = vault / ROMAN_KLASORU
    yazilan, degisen = [], 0
    if not klasor.is_dir():
        print(f"  ! Roman klasörü bulunamadı: {klasor}")
        return yazilan, degisen
    for dosya in sorted(klasor.glob("*.md")):
        ad = nfc(dosya.stem)
        if not re.match(BOLUM_ADI, ad):
            continue
        metin = dosya.read_bytes().decode("utf-8", errors="replace")
        fm, govde = frontmatter_ayir(metin)
        hedef_goreli = f"roman/{ad}.md"
        hedef = site / hedef_goreli
        if "yayinla" not in fm:
            # İlk geçiş: sitede zaten olan bölümler yayında kalsın, diğerleri taslak olsun
            deger = hedef.exists()
            yayin_alani_ekle(dosya, fm, None, deger)
            etiketlenen.append((f"{ROMAN_KLASORU}/{ad}.md", "yayinla: " + ("true" if deger else "false")))
            metin = dosya.read_bytes().decode("utf-8", errors="replace")
            fm, govde = frontmatter_ayir(metin)
        if fm.get("yayinla") is not True:
            continue
        if dosya_yaz_baglantisiz(hedef, bolum_temizle(govde)):
            degisen += 1
        yazilan.append(hedef_goreli)
    return yazilan, degisen


BUGUN = datetime.now().strftime("%Y-%m-%d")


def imza(*parcalar):
    """İçeriğin parmak izi: içerik değişirse imza da değişir."""
    h = hashlib.sha1()
    for p in parcalar:
        h.update((p if isinstance(p, bytes) else str(p).encode("utf-8")))
    return h.hexdigest()[:12]


def tarihleri_belirle(kayit, eski, yeni_imza, ilk_varsayilan):
    """İlk yayın tarihini korur; içerik değiştiyse son değişim tarihini bugüne çeker."""
    kayit["imza"] = yeni_imza
    kayit["ilk_yayin"] = eski.get("ilk_yayin") or eski.get("guncelleme") or ilk_varsayilan
    if eski.get("imza") and eski["imza"] != yeni_imza:
        kayit["son_degisim"] = BUGUN
    else:
        kayit["son_degisim"] = eski.get("son_degisim") or kayit["ilk_yayin"]


def bolumleri_oku(site, eski_bolumler):
    bolumler = []
    klasor = site / "roman"
    if klasor.is_dir():
        for f in klasor.glob("*.md"):
            m = re.match(r"^\((\d+)\)\s*(.+?)\s*\(([^)]+)\)$", nfc(f.stem))
            if m:
                b = {"no": int(m.group(1)), "ad": m.group(2), "pov": m.group(3), "dosya": f"roman/{nfc(f.name)}"}
                ilk = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
                tarihleri_belirle(b, eski_bolumler.get(b["no"], {}), imza(f.read_bytes()), ilk)
                bolumler.append(b)
    return sorted(bolumler, key=lambda b: b["no"])


def akis_olustur(maddeler, bolumler, adet=10):
    """'Son eklenenler' listesi: en son eklenen ya da güncellenen maddeler ve bölümler."""
    akis = []
    for m in maddeler:
        akis.append({"baslik": m["ad"], "url": f"wiki.html?madde={m['slug']}", "tur": m["tur"],
                     "tarih": m["son_degisim"], "durum": "eklendi" if m["son_degisim"] == m["ilk_yayin"] else "guncellendi"})
    for b in bolumler:
        akis.append({"baslik": f"Kısım {b['no']}: {b['ad']}", "url": f"roman.html#bolum-{b['no']}", "tur": "bolum",
                     "tarih": b["son_degisim"], "durum": "eklendi" if b["son_degisim"] == b["ilk_yayin"] else "guncellendi"})
    akis.sort(key=lambda a: (a["tarih"], a["durum"] == "eklendi"), reverse=True)
    return akis[:adet]


def anahtar(ad):
    """Link eşleştirme anahtarı: küçük harf, Türkçe karakterler sadeleştirilmiş."""
    ad = nfc(ad).replace("İ", "i").replace("I", "ı").lower()
    tablo = str.maketrans("ıışğüöçâîû", "iisguocaiu")
    ad = ad.translate(tablo)
    return re.sub(r"[\s_]+", " ", ad).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", default=None)
    ap.add_argument("--site", default=VARSAYILAN_SITE)
    args = ap.parse_args()
    site = Path(args.site)
    bilgisayar = (os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "").upper()
    if args.vault:
        vault = Path(args.vault)
    elif bilgisayar in BILGISAYAR_VAULT:
        vault = Path(BILGISAYAR_VAULT[bilgisayar])
    else:
        bulunan = [Path(a) for a in VAULT_ADAYLARI if Path(a).is_dir()]
        if not bulunan:
            sys.exit(f"Obsidian vault'u bulunamadı (bilgisayar: {bilgisayar}).\n"
                     f"araclar/wiki_senkron.py içindeki BILGISAYAR_VAULT listesine şu satırı ekleyin:\n"
                     f'    "{bilgisayar}": r"<vault yolu>",')
        if len(bulunan) > 1:
            sys.exit(f"Bu bilgisayarda ({bilgisayar}) birden fazla vault bulundu, hangisinin doğru olduğundan emin olamıyorum:\n"
                     + "".join(f"    {b}\n" for b in bulunan)
                     + f"araclar/wiki_senkron.py içindeki BILGISAYAR_VAULT listesine doğru olanı ekleyin, örneğin:\n"
                     f'    "{bilgisayar}": r"{bulunan[-1]}",')
        vault = bulunan[0]
    if not vault.is_dir():
        sys.exit(f"Vault bulunamadı: {vault}")
    print(f"Bilgisayar: {bilgisayar or '?'}   Vault: {vault}\n")

    dizin_yolu = site / "wiki-dizin.json"
    eski_dizin = {}
    if dizin_yolu.exists():
        try:
            eski_dizin = json.loads(dizin_yolu.read_text("utf-8"))
        except Exception:
            pass
    eski_yonetilen = set(eski_dizin.get("yonetilen_dosyalar", []))
    eski_maddeler = {m["ad"]: m for m in eski_dizin.get("maddeler", [])}
    eski_bolumler = {b["no"]: b for b in eski_dizin.get("bolumler", [])}

    tum_not_adlari = set()
    maddeler, yazilan, degisen = [], [], 0
    etiketlenen = []

    for dosya in sorted(vault.rglob("*.md")):
        goreli = dosya.relative_to(vault)
        parcalar = [nfc(p) for p in goreli.parts]
        if any(p.startswith(".") for p in parcalar) or parcalar[0] in HARIC_KLASORLER:
            continue
        ad = nfc(dosya.stem)
        tum_not_adlari.add(anahtar(ad))
        try:
            metin = dosya.read_text("utf-8")
        except UnicodeDecodeError:
            metin = dosya.read_text("utf-8", errors="replace")
        fm, govde = frontmatter_ayir(metin)
        if "yayinla" not in fm and len(parcalar) > 1 and parcalar[0] in VARSAYILAN_TUR:
            eklenen = yayin_alani_ekle(dosya, fm, tur_tahmin(parcalar, ad))
            etiketlenen.append((str(Path(*parcalar)), ", ".join(eklenen)))
        for alias in (fm.get("aliases") or []) if isinstance(fm.get("aliases"), list) else []:
            tum_not_adlari.add(anahtar(str(alias)))
        if fm.get("yayinla") is not True:
            continue

        kategori = KATEGORI_HARITASI.get(parcalar[0], VARSAYILAN_KATEGORI) if len(parcalar) > 1 else VARSAYILAN_KATEGORI
        slug = re.sub(r"\s+", "_", ad)
        hedef_goreli = f"wiki/{kategori}/{slug}.md"
        hedef = site / hedef_goreli
        temiz = govdeyi_temizle(govde)

        hedef.parent.mkdir(parents=True, exist_ok=True)
        if not hedef.exists() or hedef.read_text("utf-8") != temiz:
            hedef.write_text(temiz, "utf-8", newline="\n")
            degisen += 1
        yazilan.append(hedef_goreli)

        fm_json = json_uyumlu(fm)
        fm_json.pop("yayinla", None)
        yeni_imza = imza(temiz, json.dumps(fm_json, ensure_ascii=False, sort_keys=True))
        madde = {
            "ad": ad,
            "slug": slug,
            "kategori": kategori,
            "dosya": hedef_goreli,
            "tur": fm_json.pop("tur", None),
            "ilk_bolum": fm_json.pop("ilk_bolum", None),
            "aliases": fm_json.pop("aliases", None) or [],
            "ozellikler": fm_json,
            "baglantilar": linkleri_bul(temiz, json.dumps(fm_json, ensure_ascii=False)),
            "ozet": ozet_cikar(temiz),
            "klasor": parcalar[-2] if len(parcalar) > 2 else None,   # örn. "Merkez Cumhuriyeti" (bağlı kurumlar için)
        }
        tarihleri_belirle(madde, eski_maddeler.get(ad, {}), yeni_imza, BUGUN)
        maddeler.append(madde)

    # Roman bölümleri
    bolum_yazilan, bolum_degisen = bolumleri_yayinla(vault, site, etiketlenen)
    yazilan += bolum_yazilan

    # Artık yayınlanmayan (daha önce bu betiğin yazdığı) dosyaları kaldır
    silinen = 0
    for eski in eski_yonetilen - set(yazilan):
        p = site / eski
        if p.exists():
            p.unlink()
            silinen += 1

    # Evren.json'daki yıldız adları da geçerli link hedefidir
    evren_adlari = set()
    try:
        evren = json.loads((site / "evren.json").read_text("utf-8"))
        evren_adlari = {anahtar(s["isim"]) for s in evren.get("sistemler", [])}
    except Exception as e:
        print(f"  ! evren.json okunamadı: {e}")

    bolumler = bolumleri_oku(site, eski_bolumler)
    dizin = {
        "bolumler": bolumler,
        "son_eklenenler": akis_olustur(maddeler, bolumler),
        "maddeler": sorted(maddeler, key=lambda m: anahtar(m["ad"])),
        "yonetilen_dosyalar": sorted(yazilan),
    }
    yeni = json.dumps(dizin, ensure_ascii=False, indent=2) + "\n"
    if not dizin_yolu.exists() or dizin_yolu.read_text("utf-8") != yeni:
        dizin_yolu.write_text(yeni, "utf-8", newline="\n")

    if etiketlenen:
        print(f"Notlarına yayın alanı eklenen not: {len(etiketlenen)}")
        for yol, ek in etiketlenen:
            print(f"  * {yol}  ({ek})")
        print()
    print(f"Yayınlanan bölüm: {len(bolum_yazilan)}  (değişen: {bolum_degisen})")
    for b in bolum_yazilan:
        print(f"  + {b}")
    print(f"Yayınlanan madde: {len(maddeler)}  (değişen: {degisen}, kaldırılan: {silinen})")
    for m in maddeler:
        print(f"  + {m['ad']}  ->  {m['dosya']}")

    # Yazara uyarı: hiçbir notu olmayan link hedefleri
    kirik = set()
    for m in maddeler:
        for l in m["baglantilar"]:
            k = anahtar(l)
            if k not in tum_not_adlari and k not in evren_adlari:
                kirik.add(f"{m['ad']} -> [[{l}]]")
    if kirik:
        print("\nVault'ta notu olmayan linkler:")
        for k in sorted(kirik):
            print("  ?", k)


if __name__ == "__main__":
    main()
