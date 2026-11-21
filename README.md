# OscillaLab

Titreşim ve Dalgalar laboratuvarı deneyleri için geliştirilen, orijinal düzenek görselleri ve 3B sayısal simülasyonları bir araya getiren açık kaynak web uygulaması.

## Özellikler

- **Orijinal Düzenek İncelemesi:** Laboratuvar ekipmanlarının fotoğrafları üzerinde parça tanıtımı ve yakınlaştırma.
- **Sayısal Çözücü (RK4):** Sabit zaman adımlı 4. mertebe Runge-Kutta integratörü ile diferansiyel denklem çözümleri.
- **3B Görselleştirme:** Three.js tabanlı sahne yapısı.
- **Modüler Yapı:** Her deney bağımsız bir modül olarak tanımlanır ve merkezi kayıt sistemine (`registry`) bağlanır.
- **Çoklu Dil ve Tema:** Tarayıcı diline göre Türkçe/İngilizce desteği ve sistem tercihine uyumlu açık/koyu tema.
- **Çevrimdışı Kullanım:** Derleme sonrası internet bağlantısı olmadan tek HTML dosyası olarak çalışabilir.

## Dizin Yapısı

```text
src/
├── core/
│   ├── i18n.ts         # Türkçe / İngilizce dil yönetimi
│   ├── registry.ts     # Deney modülü kayıt sistemi
│   ├── rk4.ts          # Runge-Kutta 4 sayısal çözücü
│   ├── sanitize.ts     # DOM üretimi ve girdi doğrulama yardımcıları
│   ├── theme.ts        # Sistem / Açık / Koyu tema yönetimi
│   └── types.ts        # ExperimentModule arayüz tanımları
├── experiments/        # Deney modülleri
├── ui/
│   └── shell.ts        # Ana arayüz ve sekme yönlendiricisi
├── main.ts             # Uygulama giriş noktası
└── style.css           # Tema değişkenleri ve arayüz stilleri
```

## Kurulum ve Çalıştırma

Gereksinimler: Node.js 18+

```bash
npm install
npm run dev
```

Üretim (tek dosya) derlemesi için:

```bash
npm run build
```

Derlenen dosyalar `dist/` dizini altında oluşturulur.

## Yeni Deney Ekleme

1. `src/experiments/` altında deney için yeni bir dizin ve `index.ts` dosyası oluşturun.
2. `src/core/types.ts` içindeki `ExperimentModule` arayüzünü uygulayın.
3. `registerExperiment()` fonksiyonu ile modülü kaydedin ve `src/main.ts` içinde içe aktarın.

Detaylar için `CONTRIBUTING.md` dosyasına bakabilirsiniz.

## Lisans

MIT
