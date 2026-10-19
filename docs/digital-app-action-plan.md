# Digital / App Analytics — Action Plan

Updated: 2026-10-19

## Goal

Build one management system that answers:

- How many users download the app on iOS / Android?
- How many actually open it?
- How many register?
- How many register but never order?
- How many become first-time buyers?
- How many repeat?
- How many app orders and how much revenue?
- Where do users drop off?
- What errors / crashes block conversion?
- What does one acquired customer cost?
- What is CAC, LTV30/60/90/180, LTV/CAC and payback?
- Which source / campaign / creative acquired the customer?
- Does app acquisition create profitable repeat customers?

---

# 1. Kostiantyn — owner / access tasks

Status legend: TODO / WAITING / DONE

| Task | Status | Notes |
|---|---|---|
| Send App Analytics request to Pasha | DONE | Sent 2026-10-19 |
| Send acquisition / attribution request to Sofia / agency | DONE | Sent 2026-10-19 |
| Connect Firebase to ChatGPT if account access is available | TODO | Enables direct project / analytics / Crashlytics audit |
| Confirm / provide App Store Connect access | TODO | Required for iOS downloads, store conversion, deletions, etc. |
| Confirm / provide Google Play Console access | TODO | Required for Android acquisition / store / install metrics |
| Approve access to backend/order data if Pasha identifies source | WAITING | Needed for real orders, revenue, repeat and LTV |
| Confirm attribution provider if agency uses AppsFlyer / Adjust / Branch | WAITING | Sofia / agency response |
| Connect Google Merchant Center in Windsor if Merchant account is active | TODO / P2 | Separate Google Commerce / feed-quality block, not App Analytics |
| Review Digital preview before production release | TODO | Production remains untouched |

---

# 2. Pasha — technical / product analytics

## A. Current stack audit

Need exact answers and access details for:

- Firebase project
- GA4 app property / data stream
- Firebase Analytics SDK
- Firebase Crashlytics
- App Store Connect
- Google Play Console
- backend / order database
- push provider
- error monitoring / API monitoring
- deep-link provider if any
- app versioning / release source

Deliverable:
- what exists;
- what does not exist;
- who owns access;
- API / export method;
- what needs implementation.

## B. Fix app analytics telemetry

Check why current Myastoria App GA4 property has almost no usable telemetry.

Minimum event set:

- first_open
- session_start
- sign_up
- login
- view_item / view_menu
- select_item
- add_to_cart
- remove_from_cart
- begin_checkout
- add_shipping_info
- add_payment_info
- purchase
- refund / cancel
- push_received / push_open
- app_update
- technical error events where appropriate

For purchase:
- transaction_id
- user_id
- platform
- value
- currency
- item data
- promo / discount
- delivery / pickup
- location
- payment_method

## C. Identity and reconciliation

Required:

- stable internal user ID;
- BI receives only user_id_hash, no phone / email / name;
- transaction_id in Firebase purchase must equal backend order_id;
- every backend order must carry source platform: app / web;
- preferably platform: ios / android / web;
- app version available on events or order context where possible.

## D. Backend / order data

Need export or API for:

- order_id
- ordered_at
- user_id_hash
- platform
- revenue
- discount
- delivery subsidy if available
- payment cost if available
- contribution_margin if available or enough fields to calculate it
- order status
- location
- order_number_for_user

This powers:
- first buyer;
- registered but no order;
- repeat buyers;
- retention;
- LTV;
- margin LTV;
- payback.

## E. Product quality

Crashlytics / monitoring must provide:

- crash-free users %
- crash-free sessions %
- crashes
- fatal crashes
- non-fatal errors
- ANR on Android
- app version
- OS version
- device model
- API errors
- auth errors
- cart errors
- checkout errors
- payment errors

Target: identify whether product quality reduces conversion.

---

# 3. Sofia / agency — acquisition / attribution

Need by platform:
- iOS
- Android

Need by:
- source
- campaign
- ad group
- creative

Required metrics:
- spend
- impressions
- clicks
- CTR
- CPC
- store visits
- installs
- CPI
- first opens
- registrations
- cost / registration
- first buyers
- CAC
- orders
- revenue
- AOV
- repeat orders
- ROAS
- D7 / D30 / D60 / D90 retention
- LTV30 / LTV60 / LTV90 / LTV180
- LTV/CAC
- payback

Need attribution specification:
- which platform owns attribution;
- Google Ads / Meta / Firebase / SKAdNetwork / MMP;
- AppsFlyer / Adjust / Branch if used;
- attribution window;
- view-through rules;
- click-through rules;
- organic handling;
- re-attribution rules;
- deep links;
- deferred deep links;
- whether source / campaign / creative survives through purchase.

Critical:
Google Ads App_Android currently shows paid conversions, but they must NOT be treated as installs or customers until the conversion action definition is confirmed.

---

# 4. BI implementation — already prepared

## Supabase contracts created

- public.staging_app_store_daily
- public.staging_app_firebase_daily
- public.staging_app_quality_daily
- public.staging_app_acquisition_daily
- public.staging_app_users
- public.staging_app_orders

## BI App report target

Digital → App:

- App Overview
- Acquisition
- Funnel
- Orders & Revenue
- Retention
- LTV / CAC
- Product Quality
- Attribution

## Core formulas

- CPI = spend / installs
- Cost per Registration = spend / registrations
- CAC = spend / first buyers
- AOV = revenue / orders
- Repeat Rate = repeat buyers / buyers
- LTV30/60/90/180 = cumulative contribution margin per acquisition cohort
- LTV/CAC = cohort LTV / CAC
- Payback = time until cumulative contribution margin >= CAC

Financial truth:
- Firebase purchase revenue = analytical / diagnostic
- backend order revenue = operational / financial truth
- contribution-margin LTV preferred over revenue-only LTV

---

# 5. Existing live evidence

Google Ads currently has App campaigns:

- App_Android
- App_IOS

Available snapshot:
- App_Android has spend, impressions, clicks and Google Ads conversions
- Conversion value currently equals 0
- conversion action type still requires confirmation
- App_IOS currently has essentially no paid activity in the available snapshot

Do not label Google Ads conversions as installs / first buyers until confirmed.

---

# 6. Google Merchant Center

Windsor connector exists: `google_merchant`.

Purpose:
- Merchant / product feed health
- product approvals / disapprovals
- feed diagnostics
- free listings / Shopping performance if applicable
- product-level visibility / clicks where source supports it

Priority: P2.

This is a separate Google Commerce / Feed Quality source and is not part of App customer analytics.

Next action:
- connect Merchant account in Windsor only if M’ЯСТОРІЯ actively uses Merchant Center / product feeds.
- after connection, inspect available accounts / fields and decide whether a dedicated Commerce / Feed Health report is useful.
