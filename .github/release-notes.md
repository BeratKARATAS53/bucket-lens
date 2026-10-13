## Türkçe

- Kayıtlı sunucular arasında dosya kopyalama eklendi. Dosya ayrıntısındaki butonla hedef sunucu ve yol seçilir. Kaynakta okuma, hedefte yazma izni kontrol edilir. 1 GB üstü kopyalanmaz.
- Aynı uç noktadaki S3 kovaları sunucu tarafında kopyalanır. FTP ve farklı sağlayıcılar arasında dosya bu bilgisayardan geçer. Hedefte aynı yol varsa üzerine yazmak ayrıca onaylanır. Kopyalama bitene kadar pencere açık kalır.
- Süreli bağlantı oluşturma sorunu giderildi.

---

## English

- Copying a file between saved servers was added. The button in the file details picks the destination server and path. Reading is checked on the source, and writing on the destination. Files over 1 GB are not copied.
- S3 buckets on the same endpoint are copied on the server. Between FTP and different providers, the file passes through this computer. If that path is already on the destination, overwriting asks for confirmation. The window stays open until the copy finishes.
- The issue with the presigned URL has been resolved.
