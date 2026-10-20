# bucket-lens

**Türkçe** · [English](README.en.md)

Backblaze B2, Wasabi, Amazon S3, Cloudflare R2, DigitalOcean Spaces, MinIO ve FTP kovalarındaki dosyalara bakmak için masaüstü uygulaması. Klasör özeti, arama, tür süzgeçleri ve indirme tek ekranda. Anahtarlara isteğe bağlı isim verilir. Arayüz Türkçe ve İngilizcedir. Açık ve koyu görünüm vardır.

Anahtar bu bilgisayarda kalır.

## Arayüz

Karşılama. Anahtar henüz yokken kova buradan açılır.

![Karşılama ekranı](docs/karsilama.png)

Kova açıkken klasör özeti, arama, alt klasör taraması ve tür süzgeçleri aynı ekranda durur.

![Dosya listesi](docs/liste.png)

Bir dosyaya tıklanınca boyut, tarih, depolama sınıfı ve içerik türü pencerede görünür. Yol kopyalanır. İndirme bu pencereden başlar.

![Dosya ayrıntısı](docs/ayrinti.png)

Anahtarlar sağdan açılan panelde tutulur. Bağlantıya isim verebilirsin. Yeni anahtarda sağlayıcı seçilir; R2, Spaces ve MinIO da listede. Bölge ve uç nokta ona göre dolar. Kayıtlı gizli anahtarı değiştirmek istemezsen alan boş bırakılır.

![Bağlantı ayarı](docs/baglanti.png)

Ekran görüntülerini yenilemek için: `pnpm screenshots` (önce production derlemesi yapılır, anahtar deposu boş bir geçici klasör kullanılır).

## İndirme

Kurulum dosyaları [GitHub Releases](https://github.com/BeratKARATAS53/BucketLens/releases) sayfasındadır.

- Windows: kurulum dosyası
- Debian ve Ubuntu: deb paketi
- Diğer Linux: tek dosya, kurulum yok

Linux’ta anahtarın yeniden açılıştan sonra durması için oturumda GNOME Keyring veya KWallet açık olmalı. Anahtarda listeleme ve okuma izni olmalı.
