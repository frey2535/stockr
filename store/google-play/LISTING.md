# Google Play listing

Package name (cannot change later):

```
org.currentflowconsulting.stockr
```

App name: **Stockr**

Privacy policy URL (required):

```
https://stockr.currentflowconsulting.org/privacy
```

Terms:

```
https://stockr.currentflowconsulting.org/terms
```

Category: Business

Contact: stockr@currentflowconsulting.org

## Upload file

Build the Android App Bundle (not the APK) and upload `dist/android/stockr-release.aab` in Play Console → Production or Testing.

```bash
npm run android:bundle
```

Content rating: Business / productivity. Camera is used to scan barcodes and optionally upload a still photo for product identification. No public social UGC.

Target audience: 18+ tradespeople and office staff.

Upload certificate SHA-256 (also in `upload-cert-sha256.txt`):

```
EF:55:3E:23:CA:CE:10:78:C8:77:4A:69:96:A0:8D:FD:00:2B:4D:AD:D8:CF:AE:E9:C8:89:3E:11:AC:07:DE:34
```

After the first Play App Signing upload, add the **app signing** SHA-256 from Play Console → App integrity to `public/.well-known/assetlinks.json` (keep the upload cert too).

## Graphics

- High-res icon: `public/logo-512.png` (512×512)
- Feature graphic: `store/google-play/en-US/images/feature-graphic-1024x500.png`
- Phone placeholders: `store/google-play/en-US/images/phone-*.png` — replace with device captures of Dashboard, Scanner, Inventory, and Locations before store review
- Data safety: photos leave the device for Photo ID; account email and inventory are collected; payments via Google Play Billing
- Crash reports: Play Console Android vitals. Optional Sentry DSN can be added later.

Copy-paste text lives in `store/google-play/en-US/`.

## Console checklist

1. Create subscriptions `stockr_pro` and `stockr_fleet`.
2. Add GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Play Android Publisher).
3. Add Stripe secrets for the website only.
4. Run `supabase/play-production.sql` in the Stockr Supabase SQL editor.
5. Closed testing track, then production.
