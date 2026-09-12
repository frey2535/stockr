# Upload keystore

This folder must contain `stockr-upload.jks` and `key.properties`. Those two files are gitignored on purpose.

Create them once:

```bash
npm run android:keystore
```

Copy the whole folder to a password manager or encrypted drive before you upload to Play. Google Play App Signing keeps the app-signing key; this is your **upload** key. Losing it blocks updates.
