# ماز ویدیو — بازطراحی نسخهٔ ۲

## هدف
اپلیکیشن مستقل اندرویدی با مرورگر داخلی biomaze.ir و کتابخانهٔ واقعی ویدئوهای آفلاین ذخیره‌شده در فضای خصوصی همین برنامه؛ بدون وابستگی به Kiwi یا مرورگر خارجی.

## طراحی و تجربه
- زبان و چیدمان فارسی و راست‌به‌چپ است و ظاهر پنل موجود تغییر نمی‌کند.
- خانه، مرورگر، دانلودها، اعلان‌ها، تنظیمات و پخش native در یک lifecycle واحد مدیریت می‌شوند.
- هدر مرورگر native شامل بازگشت، کپسول آدرس گرادیانی و refresh است.
- دانلودها فهرست واقعی فایل‌های فضای خصوصی اپ را با جست‌وجو، حجم MB، rename، delete و native playback نمایش می‌دهند.

## معماری اجرایی
- `assets/panel-5.html` تنها منبع canonical ظاهر است.
- `assets/panel-controller.js` منطق navigation، theme، search، snapshot و پیام‌های پنل را اجرا می‌کند.
- `app/(tabs)/index.tsx` orchestrator lifecycle است: WebView، back handling، player، snapshot handshake، error recovery و dispatch پیام‌ها.
- `features/offline/repository.ts` manifest، migration، قفل عملیات، cleanup، collision و commit اتمیک فایل را مالک است.
- `features/offline/downloader.ts` فقط منابع مستقیم HTTP قابل ذخیره را دریافت می‌کند و m3u8 را رد می‌کند.
- `features/offline/blob-transfer.ts` انتقال chunk را اعتبارسنجی و commit می‌کند.
- `features/browser/site-bridge.ts` فقط داخل WebView همان سایت اجرا می‌شود و با chunk محدود، ACK/NACK و backpressure Blobهای قابل‌خواندن را منتقل می‌کند.
- `features/bridge/protocol.ts` قرارداد پیام versioned و سازگاری legacy را نگه می‌دارد.
- workflow رسمی، هر دو asset پنل را کپی و signing/verification APK را انجام می‌دهد.

## هویت انتشار
- package: `space.manus.mazvideo.v2`
- version: `1.2.0`
- Android versionCode: `3`
- fingerprint مورد انتظار signing در workflow ثابت است.

## محدودیت‌های محصول
دادهٔ مرورگرهای دیگر خوانده نمی‌شود. DRM، MediaSource، رمزگذاری اختصاصی و storage غیرقابل‌خواندن بدون قرارداد رسمی biomaze قابل export نیستند. HLS/m3u8 به‌صورت playlist مستقل ذخیره نمی‌شود؛ پشتیبانی کامل آن نیازمند دانلود segmentها و مجوز مناسب سایت است. APK نهایی فقط پس از build رسمی و بررسی artifact قابل تحویل است.
