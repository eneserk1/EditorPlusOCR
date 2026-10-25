# BelgeEditor+

PDF araçları ve cihazda çalışan görsel metin editörü. Belge dosyaları OCR veya düzenleme için bir API'ye gönderilmez. PDF.js, Tesseract.js, OCR WASM/dil dosyaları ve fontlar uygulamayla aynı adresten sunulur; CDN bağımlılığı yoktur.

## Çalıştırma

Node.js 22.6+ ve pnpm kullanın:

```sh
pnpm install
pnpm dev
```

`dev` ve `build` komutları, sabit sürümlü paketlerdeki OCR dosyalarını `public/ocr/` klasörüne kopyalar. Bu üretilmiş klasör Git'e eklenmez. Yayın derlemesi: `pnpm build`. İlk açılışta uygulama ve gerekli yerel varlıklar indirilir; belge işlemleri tarayıcıda gerçekleşir. Çevrimdışı yeniden yükleme için servis çalışanı/PWA önbelleği henüz yoktur.

## Metin düzenleme

- PDF'nin gerçek metni, konumu, boyutu ve mevcut font ipuçları sayfa açıldığında okunur. Tarama ve karışık sayfalarda **Metni algıla (OCR)** Türkçe/İngilizce kelime bölgelerini bulur. Tekrar OCR mevcut bölgeleri çoğaltmaz.
- Seçim belgeyi değiştirmez. Kelimeyi seçip sağ panelde düzenleyin. Font ailesi, kalın/italik, renk, punto, harf aralığı, satır tabanı ve alan ölçüleri değiştirilebilir. Noto Sans, Noto Serif ve Roboto Mono adayları orijinal görüntüyle karşılaştırılır; eşleştirme yaklaşık sonuç verir.
- Değiştirilen/silinen kelimenin eski konumunda algılanan yazı pikselleri örneklenen zemin rengiyle temizlenir. Orijinal alanın geri kalanı korunur. Yeni yazı ayrı şeffaf yama olarak çizilir. Beyaz zemin varsayımı yapılmaz. Fotoğraf/desen üzerindeki yazıda kusursuz arka plan onarımı hedeflenmez; karmaşık bölgeler belirtilir.
- Önizleme ve PDF dışa aktarma aynı yamaları kullanır. Yalnızca değişen bölgeler raster PNG yamaları olarak PDF'ye eklenir; diğer sayfa içeriği yeniden rasterleştirilmez. Türkçe glifler tarayıcıda kullanılan fontla çizilir. Düzenlenmemiş tek kaynak PDF, analiz/OCR yapılmış olsa bile orijinal baytlarıyla indirilir.
- Yerleşim PDF noktalarında tutulur. Yakınlaştırma veri ölçülerini değiştirmez; CropBox ve sayfanın mevcut 0/90/180/270 derece dönüşü dışa aktarmada hesaba katılır. Taşıma tutamacı yazı seçimini sürüklemeye dönüştürmez. Uzun metinler sessizce küçültülmez; taşma giderilmeden dışa aktarma yapılmaz.
- Geri/ileri alma, orijinale dönme, sayfa ekleme/silme/döndürme, yeni yazı, silgi, çizgi, vurgu, görsel, QR ve filigran desteklenir.

Bu sürüm görsel düzenleyicidir: yeni yazı görüntü yamasıdır; orijinal metin ve eski görünmez OCR katmanı dosyanın altında kalabilir. Arama/kopyalama sonuçları görsel düzeltmeyle aynı olmayabilir. Güvenli sansür veya PDF içerik nesnelerini doğrudan değiştirme özelliği değildir. İnce taramalarda OCR hataları, özel fontlarda farklılıklar ve yüksek yakınlaştırmada yamaların çözünürlük sınırı görülebilir. Yatay yazı düzenleme önceliklidir; sayfa içindeki eğik/dikey yazı birebir desteklenmez.

## Doğrulama

```sh
pnpm typecheck
pnpm test
pnpm test:fixtures
pnpm dev
```

`pnpm test` değişiklik takibi, orijinale dönüş, yeni yazı ve dönüş koordinatlarını sınar. Fixture üretimi PDF.js'in isteğe bağlı `@napi-rs/canvas` paketini kullanır; isteğe bağlı paketlerin kurulu olması gerekir.

Tarayıcıda `/tests/index.html` sayfasındaki **Testleri çalıştır** düğmesi gerçek motoru test eder: yerel OCR, Türkçe metin, renkli tarama, OCR tekrarı, değiştirilmemiş dosyanın baytları, font/stil değişikliği, taşma, CropBox ve dört dönüşte önizleme/PDF piksel karşılaştırması. Test sayfasının CSP'si dış sunuculara erişimi engeller. Sayfa Vite geliştirme ortamında çalışır; üretim paketine dahil değildir.

Arayüz için `/tests/editor.html` ve `/tests/editor.html?fixture=scan` yerel örnekleri açar. Örnekler React StrictMode altında çalışır. Gerçek dosya seçimi ana uygulamadaki **PDF seç** düğmesinden yapılır.
