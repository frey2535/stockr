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

Content rating: Business / productivity, no user-generated public social content, camera used only to read barcodes.

Target audience: 18+ tradespeople and office staff.

Upload certificate SHA-256 (also in `upload-cert-sha256.txt`):

```
EF:55:3E:23:CA:CE:10:78:C8:77:4A:69:96:A0:8D:FD:00:2B:4D:AD:D8:CF:AE:E9:C8:89:3E:11:AC:07:DE:34
```

## Graphics

- High-res icon: `public/logo-512.png` (512×512)
- Feature graphic: add a 1024×500 image under `store/google-play/en-US/images/` before you submit
- Phone screenshots: capture Dashboard, Scanner, Inventory, and Locations on a phone

Copy-paste text lives in `store/google-play/en-US/`.
