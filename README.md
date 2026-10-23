# BelgeEditor+ — PDF Düzenleme ve OCR

**Enes Erkul tarafından geliştirildi.**

BelgeEditor+, PDF metinlerini düzenlemek, taranmış belgelerdeki metinleri OCR ile tanımak, dosyaları sıkıştırmak, görselleri PDF'e dönüştürmek ve belgeleri karşılaştırmak için geliştirilmiş Türkçe bir web uygulamasıdır.

## PDF düzenleme

- Metin içeren PDF'lerde mevcut metinler konum ve yazı özellikleriyle algılanır.
- Taranmış sayfalarda Türkçe ve İngilizce OCR ile düzenlenebilir metin alanları oluşturulur.
- Metin, yazı tipi, boyut ve renk değişiklikleri; sayfa döndürme, işaretleme ve QR kod araçları sunulur.
- Değiştirilmeyen içerik özgün PDF üzerinde korunur.

OCR sonucu belgenin çözünürlüğüne ve okunabilirliğine bağlıdır. Taramalardaki font ailesi ve boyutu tahminidir; Adobe Acrobat ile birebir eşdeğerlik veya her belgede kusursuz font eşleşmesi garanti edilmez. Karmaşık arka planlarda metin değişimi görsel iz bırakabilir. Metin kapatma/silme araçları güvenli sansür değildir; alttaki özgün içerik PDF'den geri çıkarılabilir.

## Yerel çalıştırma

Node.js 22 veya üzeri gereklidir.

1. Bağımlılıkları yükleyin: `npm ci`
2. Geliştirme sunucusunu başlatın: `npm run dev`
3. Üretim çıktısı alın: `npm run build`
4. Üretim çıktısını önizleyin: `npm run preview`

PDF ve OCR araçları için API anahtarı gerekmez. Belgeler tarayıcıda işlenir; belge dosyaları bir sunucuya gönderilmez. Kütüphanelerin, OCR motorunun ve dil verilerinin ilk yüklenmesi internet gerektirir. Uygulama tam çevrimdışı kullanım garantisi vermez.

## Vercel üzerinde yayınlama

Vercel'de bu GitHub deposunu içe aktarın. Depodaki `vercel.json`, Vite derlemesini ve `dist` çıktı klasörünü tanımlar. Kurulum komutu `npm ci`, derleme komutu `npm run build` şeklindedir; ortam değişkeni gerekmez.

GitHub deposu bağlıysa üretim dalına yapılan gönderimler Vercel tarafından otomatik yayınlanır. Diğer dallar önizleme yayını oluşturabilir. Vercel hesabı/proje erişimi olmadan bu depodan canlı yayın başlatılamaz.

GitHub **About** alanı için önerilen açıklama:

> Enes Erkul tarafından geliştirilen Türkçe PDF düzenleme ve OCR uygulaması. Belgeleri tarayıcıda düzenleyin, sıkıştırın, dönüştürün ve karşılaştırın.

## Yazı tipleri

PDF dışa aktarımında Türkçe karakterleri destekleyen DejaVu yazı tipleri kullanılır. Lisans bilgisi `public/fonts/LICENSE.txt` dosyasındadır.
