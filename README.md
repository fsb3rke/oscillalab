# OscillaLab

**OscillaLab**, klasik mekanik ve salinim sistemlerini etkilesimli 3B sahneler, dorduncu mertebe Runge-Kutta (**RK4**) sayisal integrasyonu, en kucuk kareler (**OLS**) regresyon analizi ve otomatik **LaTeX (.tex)** rapor uretimiyle inceleyen moduler bir fizik laboratuvari web uygulamasidir.

---

## Temel Ozellikler ve Mimari

- **Moduler Fizik Cekirdegi (ExperimentModule):** Her deney id, parameters, hotspots, theory, getInitialState ve computeDerivatives arayuzunu uygular; fizik motoru ile 3B goruntuleme ve analiz katmanlari birbirinden ayrilir.
- **RK4 Sayisal Cozucu (src/core/rk4.ts):** Durum vektoru uzerinde dort adimli Runge-Kutta integrasyonu yaparak mekanik enerji korunumu, rezonans, normal modlar ve vurus (beats) davranislarini hesaplar.
- **Etkilesimli 3B Sahne (Three.js):** Gercek zamanli animasyon, kamera kontrolu, deney sicak noktalari ve ozel lab-slider (--pct doluluk senkronizasyonlu) kontrolleri sunar.
- **Analiz ve LaTeX Raporlama (analysis-viewer):** Deney olcum tablolari, Bessel duzeltmeli orneklem istatistikleri, OLS dogrusal regresyonu, CSV disari aktarma ve .tex rapor uretimi saglar.
- **Cok Dilli Arayuz ve Tema:** Turkce ve Ingilizce yerellestirme (i18n) ile acik/koyu tema destegi icerir.

---

## Deney Modulleri

| Kod | Modul Adi | Fiziksel Kapsam |
| :--- | :--- | :--- |
| **EXP-01** | torsional-pendulum | Burulma sarkaci; eylemsizlik momenti (I) ve burulma sabiti (kappa) uzerinden periyot analizi |
| **EXP-02** | driven-spring-mass | Zorlanmis kutle-yay sistemi; rezonans frekansi, genlik tepkisi ve yay sabiti (k) regresyonu |
| **EXP-03** | coupled-oscillators | Iki bagli osilator; simetrik (omega_+) ve antisimetrik (omega_-) normal modlar ile vurus zarfi (omega_beat) |
| **EXP-04** | damped-driven-pendulum | Sonumlu ve surekli zorlanmis dogrusal olmayan sarkac (sin(theta)), faz uzayi ve periyot ikileme/kaos rejimleri |

---

## Kurulum, Test ve Derleme

```bash
npm install
npm run dev
npm test
npm run build
```

---

## Kaynaklar ve Referanslar

1. John R. Taylor, Classical Mechanics - Bagli osilatorler, normal modlar, zorlanmis/sonumlu salinimlar ve dogrusal olmayan sarkacta periyot ikileme ile kaos.
2. Jerry B. Marion & Stephen T. Thornton, Classical Dynamics of Particles and Systems - Normal koordinatlar, rezonans egrileri ve mekanik diferansiyel denklemler.
3. UCSD Physics 141/241 - Numerical Integration (RK4): [https://jduarte.physics.ucsd.edu/phys141/lectures/03_Numerical_Methods.html](https://jduarte.physics.ucsd.edu/phys141/lectures/03_Numerical_Methods.html)
4. University of Virginia (Galileo and Einstein) - Driven Damped Pendulum, Period Doubling and Chaos: [https://galileoandeinstein.phys.virginia.edu/7010/CM_22a_Period_Doubling_Chaos.html](https://galileoandeinstein.phys.virginia.edu/7010/CM_22a_Period_Doubling_Chaos.html)
5. Three.js Manual: [https://threejs.org/manual/](https://threejs.org/manual/)
6. Vite Documentation: [https://vite.dev/](https://vite.dev/)
7. TypeScript Documentation: [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/)

