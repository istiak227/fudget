# Fudget Phone

A simple offline-first monthly expense tracker built with React Native and Expo.

## What it includes

- Automatic month browsing with data saved only after entries are added
- Monthly debit and credit tracking with editable amounts and optional dates
- Separate savings accounts with their own credit and debit history
- Optional loans and lending sections
- Local device storage with Excel export

## Run locally

```bash
npm install
npm start
```

## Notes

- Data is stored locally using AsyncStorage.
- The app currently formats currency as Bangladeshi Taka (`BDT`).
- Excel export uses the device share sheet when available.
