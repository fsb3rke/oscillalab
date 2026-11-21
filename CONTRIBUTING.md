# OscillaLab Geliştirici Rehberi

## Yeni Deney Ekleme
1. `src/experiments/<deney-adi>/index.ts` dosyasını oluşturun.
2. `src/core/types.ts` içindeki `ExperimentModule` arayüzünü uygulayın.
3. `registerExperiment(...)` ile deneyi kaydedin ve `src/main.ts` içinde içe aktarın.
4. Güvenlik kuralı: DOM manipülasyonlarında `innerHTML` kullanmayın; `src/core/sanitize.ts` içindeki `el()` ve `clampNumber()` yardımcılarını kullanın.
