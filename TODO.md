# TODO — ماز ویدیو v2

## بخش‌های تحویل‌شده
- [x] ظاهر فارسی/RTL پنل در `assets/panel-5.html` حفظ شده و منطق آن در `assets/panel-controller.js` متمرکز است.
- [x] خانه، navigation، مرورگر داخلی، هدر native، loading، back handling و پخش native به هم متصل هستند.
- [x] repository خصوصی `documentDirectory/offline` با manifest، revision، شناسهٔ پایدار، migration فایل‌های قدیمی و ثبت اتمیک فعال است.
- [x] عملیات ثبت، refresh، rename، delete، collision نام، cleanup فایل‌های `.part` و recovery پس از restart پوشش داده شده‌اند.
- [x] انتقال Blob با chunk محدود، backpressure و ACK/NACK بین WebView و native انجام می‌شود؛ اندازه، duplicate، کامل‌بودن و integrity حجم بررسی می‌شود.
- [x] لینک مستقیم و منابع download به native منتقل می‌شوند؛ m3u8/HLS و منابع نامناسب برای فایل مستقل عمداً رد می‌شوند.
- [x] ابزار گزارش استخراج، markerهای آن و dependency مربوط حذف شده‌اند.
- [x] boilerplateهای استفاده‌نشدهٔ Expo حذف شده‌اند.

## محدودیت‌های فنی صریح
- [ ] DRM، MediaSource، رمزگذاری اختصاصی و داده‌ای که WebView اجازهٔ خواندن آن را نمی‌دهد، بدون قرارداد رسمی سایت قابل export نیست.
- [ ] HLS/m3u8 به‌عنوان playlist مستقل پشتیبانی نمی‌شود؛ پشتیبانی کامل آن نیازمند downloader چندبخشی و مجوز سایت است.
- [ ] تست end-to-end روی WebView واقعی و Android 13 باید با APK نصب‌شده انجام شود.

## انتشار
- [x] `pnpm check`، تست‌های واحد، syntax-check controller و قرارداد asset موفق هستند.
- [x] package مستقل `space.manus.mazvideo.v2`، version `1.2.0` و versionCode `3` در تنظیمات ثبت شده‌اند.
- [x] workflow شامل typecheck، test، prebuild، کپی هر دو asset پنل، signing، assemble، zipalign و بررسی V2/fingerprint است.
- [ ] اجرای موفق workflow رسمی GitHub روی commit نهایی و دریافت artifact.
- [ ] بررسی artifact نهایی از نظر package، version، versionCode، امضا، zip integrity و hash.
- [ ] نصب و آزمون واقعی روی گوشی Android 13.
