# App Analytics data contract

This document defines the minimum source contract for Digital → App.

## Identity
- Never ingest phone, email, name or other PII into BI.
- Use `user_id_hash` as the stable customer key.
- Use `order_id` as the transaction reconciliation key.
- Preserve `platform` as `ios` or `android`.

## Store daily
Target: `public.staging_app_store_daily`

Required:
- date
- platform
- store_impressions
- product_page_views
- downloads
- first_time_downloads
- redownloads
- installations
- deletions
- first_opens
- store_conversion_rate

Sources: App Store Connect, Google Play Console.

## Firebase daily
Target: `public.staging_app_firebase_daily`

Required:
- date
- platform
- active_users
- new_users
- first_opens
- sign_ups
- logins
- view_items
- add_to_carts
- begin_checkouts
- purchases
- purchase_revenue
- push_opens
- app_removes

## Product quality daily
Target: `public.staging_app_quality_daily`

Required:
- date
- platform
- app_version
- crash_free_users_rate
- crash_free_sessions_rate
- crashes
- fatal_crashes
- nonfatal_errors
- anr
- api_errors
- checkout_errors
- payment_errors

Sources: Firebase Crashlytics / backend monitoring.

## Acquisition daily
Target: `public.staging_app_acquisition_daily`

Required:
- date
- platform
- source
- campaign
- spend
- impressions
- clicks
- installs
- registrations
- first_buyers
- orders
- revenue

Source can be AppsFlyer / Adjust / Branch / Firebase + ad platforms, but attribution rules must be documented.

## App users
Target: `public.staging_app_users`

Required:
- user_id_hash
- platform
- registered_at
- first_open_at
- first_order_at
- last_order_at
- acquisition_source
- acquisition_campaign

This table powers registered-without-order, first buyer conversion and retention cohorts.

## App orders
Target: `public.staging_app_orders`

Required:
- order_id
- ordered_at
- user_id_hash
- platform
- acquisition_source
- acquisition_campaign
- revenue
- contribution_margin
- order_number_for_user
- status
- location_id

## Core business metrics
- CPI = spend / installs
- Cost per registration = spend / registrations
- CAC = spend / first buyers
- AOV = revenue / orders
- Repeat rate = repeat buyers / buyers
- LTV30/60/90/180 = cumulative contribution margin per acquired customer cohort
- LTV/CAC = cohort LTV / CAC
- Payback = first day/month cumulative contribution margin covers CAC

## Reconciliation
- Firebase `purchase.transaction_id` must equal backend `order_id`.
- Revenue from Firebase is diagnostic. Backend order revenue is financial truth.
- Google Ads conversions are not treated as installs or buyers until conversion action definitions are confirmed.
