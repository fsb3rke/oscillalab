<div align="center">

# OscillaLab

**Titreşim ve Dalgalar Laboratuvarı Dijital İkiz ve Deneysel Analiz Platformu**  
*Atatürk Üniversitesi • Fen Fakültesi • Fizik Bölümü*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL_PBR-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![i18n](https://img.shields.io/badge/i18n-TR%20%7C%20EN%20%7C%20DE%20%7C%20FR-8B0000?style=flat-square)](#çok-dilli-destek-i18n)
[![License: MIT](https://img.shields.io/badge/License-MIT-2E7D32?style=flat-square)](LICENSE)

</div>

---

## Proje Özeti ve Kapsam

**OscillaLab**, fizik lisans düzeyindeki *Titreşim ve Dalgalar* laboratuvarı deney düzeneklerinin;
1. **Optik Donanım ve Kalibrasyon İncelemesini**,
2. **4. Mertebe Runge-Kutta (RK4) Sayısal Çözücüsü** ile desteklenen etkileşimli 3B fizik simülasyonlarını,
3. **Bessel Düzeltmeli İstatistiksel Belirsizlik ve Doğrusal Regresyon Analizini**

tek bir çevrimdışı çalışabilir (CSP korumalı) web mimarisinde birleştiren açık kaynaklı araştırma ve eğitim platformudur.

## Kayıtlı Deney Modülleri

| Kod | Deney Modülü | Hareket Denklemi | Etkileşimli 3B Donanım | Analiz Çıktısı |
| :--- | :--- | :--- | :--- | :--- |
| **FİZ-203 // EXP-01** | **Burulma Sarkacı** (*Torsional Pendulum*) | $I\ddot{\theta} + b\dot{\theta} + \kappa\theta = 0$ | $0^\circ\text{--}360^\circ$ pirinç açı cetveli, burulma teli deformasyonu, optik fotokapı LED sensörü, Steiner yardımcı kütle rayı | $T^2 - I$ regresyonundan burulma sabiti $\kappa \pm \delta\kappa$ |
| **FİZ-203 // EXP-02** | **Sönümlü ve Zorlanmış Yay-Kütle Sistemi** (*Damped & Driven Spring-Mass*) | $m\ddot{x} + b\dot{x} + kx = F_0\cos(\omega_d t)$ | Eksantrik tahrik volanı, dinamik helisel yay, manyetik eddy-akımı sönümleyici, milimetrik dikey cetvel | $T^2 - m$ regresyonundan yay sabiti $k \pm \delta k$, rezonans ve faz portresi |
| **FİZ-203 // EXP-03** | **Çift Bağlı Osilatör** *(Planlanan)* | $m\ddot{x}_{1,2} = -kx_{1,2} \mp k_c(x_1 - x_2)$ | Simetrik ve antisimetrik normal modlar, enerji aktarımı ve vuruş (*beats*) zarfı | Normal mod frekansları ($\omega_1, \omega_2$) ve bağlaşım sabiti $k_c$ |

---

## Sayısal ve İstatistiksel Metodoloji

* **Zaman İntegrasyonu (`src/core/rk4.ts`):** Diferansiyel hareket denklemleri sabit zaman adımlı ($\Delta t = 2\text{ ms}$, kare başına 8 alt adım) 4. mertebe Runge-Kutta şemasıyla çözülerek uzun süreli salınımlarda enerji sürüklenmesi en aza indirilir.
* **Belirsizlik Yayılımı (`src/core/statistics.ts`):** Tekrarlı periyot ölçümlerinden örneklem standart sapması ($s$), ortalama standart hatası ($\sigma_{\bar{T}} = s/\sqrt{n}$), karesel yayılım belirsizliği ($\delta(T^2) = 2\bar{T}\sigma_{\bar{T}}$) ve en küçük kareler eğim standart hatası ($\sigma_m$) hesaplanır.
* **Raporlama ve Dışa Aktarım (`src/ui/analysis-viewer.ts`):** Deneysel çizelgeler doğrudan **CSV** dosyası olarak indirilebilir veya akademik raporlara yapıştırılmak üzere **LaTeX (`tabular`)** kodu olarak panoya kopyalanabilir.

## Sistem Mimarisi

* **Kayıt ve Yönlendirme:** `ExperimentModule` kayıt defteri
* **1. Düzenek İnceleme:** Etkileşimli optik bileşen ve kalibrasyon noktaları
* **2. Kuramsal Çerçeve:** Diferansiyel hareket denklemleri ve analitik çözümler
* **3. 3B Sayısal Simülasyon:** Sabit adımlı RK4 çözücü ve Three.js PBR sahnesi
* **4. Belirsizlik Analizi:** En küçük kareler regresyonu, CSV ve LaTeX tablo çıktısı

### Çok Dilli Destek (i18n)

Arayüz ve deney modülleri **Türkçe (`TR`)**, **İngilizce (`EN`)**, **Almanca (`DE`)** ve **Fransızca (`FR`)** dillerini destekler.

---

## Yerel Kurulum ve Derleme

    git clone [https://github.com/fsb3rke/oscillalab.git](https://github.com/fsb3rke/oscillalab.git)
    cd oscillalab
    npm install
    npm run dev

Üretim derlemesi için `npm run build` komutunu çalıştırın.

---

## Geliştirici ve Kurumsal Aidiyet

**Berke Avcı** — Atatürk Üniversitesi, Fen Fakültesi, Fizik Bölümü  
GitHub: [@fsb3rke](https://github.com/fsb3rke)

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
