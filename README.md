# Fudget Phone

A simple offline-first monthly expense tracker built with React Native and Expo, with optional JSON backup and restore.

## What it includes

- Automatic month browsing with data saved only after entries are added
- Monthly debit and credit tracking with editable amounts and optional dates
- Optional debit and credit groups with a settings screen
- Separate savings accounts with their own credit and debit history
- Optional loans and lending sections
- Local device storage with optional JSON backup and restore

## Run locally

```bash
npm install
npm start
```

## Notes

- Data is stored locally using AsyncStorage.
- The app currently formats currency as Bangladeshi Taka (`BDT`).
- Backup creates a JSON file that you can save anywhere manually.
- Restore loads data back from a previously saved JSON backup file.
