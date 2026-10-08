# bucket-lens

**Türkçe** · [English](README.en.md)

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-8.13-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

Backblaze B2, Wasabi ve Amazon S3 kovalarına bakmak için tek sayfalık bir arayüz. Klasörleri dolaşır, dosyaları listeler, ada göre arar, türe göre süzer ve indirir. Bir dosyanın ayrıntısı pencerede açılır. Arayüz Türkçe ve İngilizce çalışır; açık ve koyu görünüm vardır.

İmzalama tarayıcıda yapılmaz. Ayarlardan girilen key ID ve gizli anahtar `data/connection.json` dosyasına yazılır. Dosya yalnızca bu makinede durur, depoya eklenmez ve gizli anahtar tarayıcıya geri dönmez. B2 istekleri yereldeki API üzerinden gider.

## Arayüz

Karşılama. Anahtar henüz yokken kova buradan açılır.

![Karşılama ekranı](docs/karsilama.png)

Kova açıkken klasörler, arama, alt klasör taraması ve tür süzgeçleri aynı ekranda durur.

![Dosya listesi](docs/liste.png)

Bir dosyaya tıklanınca boyut, tarih, depolama sınıfı ve içerik türü pencerede görünür. Yol, uç noktayla birlikte kopyalanır. İndirme bu pencereden başlar.

![Dosya ayrıntısı](docs/ayrinti.png)

Anahtarlar sağdan açılan panelde tutulur. Yeni anahtarda sağlayıcı seçilir; bölge ve uç nokta ona göre dolar. Backblaze’te bölge, key ID’nin ilk üç hanesinden önerilebilir. Kayıtlı gizli anahtarı değiştirmek istemezsen alan boş bırakılır.

![Bağlantı ayarı](docs/baglanti.png)

## Kurulum

[Node.js](https://nodejs.org) ve [pnpm](https://pnpm.io) gerekir.

```bash
pnpm install
pnpm start
```

Arayüz `http://localhost:4205` adresinde açılır. `pnpm start` arayüzle birlikte yerel API’yi de başlatır. API yalnızca `127.0.0.1` üzerinde dinler. Anahtar dosyası ilk başarılı kayıtta oluşur.

Kayıt öncesinde anahtarın nesneleri listeleme ve okuma izni olmalı. Uygulama, dosyayı yazmadan önce kovayı bir kez listeler. Uç nokta seçilen bölgeden dolar: Backblaze için `s3.<bölge>.backblazeb2.com`, Wasabi için `s3.<bölge>.wasabisys.com`, Amazon S3 için `s3.<bölge>.amazonaws.com`.

| Komut        | Ne yapar                     |
| ------------ | ---------------------------- |
| `pnpm start` | Arayüzü ve yerel API’yi açar |
| `pnpm build` | Arayüzü derler               |
| `pnpm lint`  | ESLint çalıştırır            |
