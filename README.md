# BelgeEditor+

**Enes Erkul tarafından geliştirildi.**

BelgeEditor+, PDF belgelerini düzenlemek ve taranmış belgelerdeki metinleri Türkçe/İngilizce OCR ile tanımak için geliştirilmiş bir web uygulamasıdır. Belge sıkıştırma, görselden PDF oluşturma, sayfa döndürme/silme, QR kodu ve filigran ekleme, PDF ve metin karşılaştırma araçlarını bir araya getirir.

## PDF düzenleme ve OCR

- Metin içeren PDF'lerde mevcut metin bilgileri kullanılır; taranmış sayfalarda OCR ile düzenlenebilir metin alanları oluşturulur.
- Değiştirilmemiş alanların özgün görünümü korunur. Metin, boyut, yazı tipi ve renk özellikleri düzenlenebilir.
- Taramalarda font ailesi, kalınlık, renk ve boyut algılama tahminidir. Özel/gömülü fontların birebir yeniden oluşturulması veya fotoğraf, desen ve karmaşık arka planlarda kusursuz metin değiştirme garantisi yoktur; bu uygulama Adobe Acrobat Pro'nun tüm özelliklerinin karşılığı değildir.
- Kaydetmeden önce özellikle düşük çözünürlüklü taramalarda tanınan metni ve düzenlenen alanları kontrol edin.
- Metnin üzerini kapatmak güvenli sansürleme değildir; hassas bilgi kaldırmak için özel bir PDF redaksiyon aracı kullanın.

## Gizlilik

Belgeler tarayıcıda işlenir; belge içerikleri bir sunucuya veya yapay zekâ servisine gönderilmez. Kütüphaneler, OCR motoru/dil dosyaları ve yazı tipleri harici kaynaklardan indirilir. Bu nedenle ilk açılış, OCR ve font yükleme için internet bağlantısı gerekir; tam çevrimdışı çalışma garanti edilmez. PDF araçları için API anahtarı gerekmez.

## Yerelde çalıştırma

Node.js 22 veya üzeri kullanın.

1. Bağımlılıkları yükleyin: `npm install`
2. Geliştirme sunucusunu başlatın: `npm run dev`
3. Üretim derlemesi oluşturun: `npm run build`
4. Derlemeyi yerelde inceleyin: `npm run preview`

## Vercel'de yayınlama

Depoyu Vercel'de **Add New → Project → Import Git Repository** ile içe aktarın. `vercel.json`, Vite derlemesini ve `dist` çıktı klasörünü tanımlar. PDF/OCR özellikleri için ortam değişkeni gerekmez. GitHub entegrasyonu kurulduktan sonra bağlı üretim dalına gönderilen commit'ler otomatik yayınlanır.

Bu depoda Vercel hesabı veya proje kimliği bulunmaz. Canlıya yayınlamak için yetkili bir Vercel hesabıyla projeyi bağlamak gerekir.
