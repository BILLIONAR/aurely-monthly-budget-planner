# AurelyStudio Monthly Budget Planner

## Product lock

- Product: AurelyStudio Monthly Budget Planner
- Stage: maintained product source; changes are tested locally before release
- Format: responsive local-first browser app
- Primary differentiator: the right-side `Month Rail`, which becomes a horizontal bottom rail on phones
- Visual direction: bright editorial planner paper with teal-blue, apricot, butter, lilac, and mint accents
- Source reference: the existing AurelyStudio budget planner patterns in `work/aurely_adhd_budget_planner`
- Inspiration reviewed: `https://thelittlemachines.github.io/adhd-budget-planner-demo/#screen-month`

The linked demo was reviewed as a live product-flow reference. Its useful interaction patterns were independently adapted to the AurelyStudio system; its branding, wording, artwork, page composition, and source code were not copied.

## Implemented product scope

- Undated month and year navigation
- Responsive desktop and mobile Month Rail
- Direct left navigation for all 11 screens, with a scrollable menu on smaller displays
- Generated money calendar with bills, spending, paydays, and daily detail
- Expandable monthly agenda list beneath the calendar
- Month summary and gentle daily spending guide
- MIT-licensed 21st.dev-inspired number ticker motion on changing money totals, with Calm Mode and reduced-motion support
- Working spending capture dialog
- Working bill creation and paid/unpaid state
- Working savings goals and progress actions
- Today dashboard with one-tap common spends, editable activity register, Brain Dump, nearby dates, and month runway
- Cinematic opening with flowing teal/champagne light, sequential title reveal, unchanged logo, English device date, immediate entry, pause/Skip, reduced-motion support and a direct replay link
- Keyboard-aware calendar navigation with Arrow keys and Home / End
- Quick Actions palette with `Command/Ctrl + K`, screen search, and typed spending such as `25 groceries`
- Focus Mode and contextual Help Mode
- Full plain-word Help Center with screen-by-screen guidance and print support
- Scheduled paydays and one-time income register
- Usual-paycheck rhythm, real-date anchor, weekend-early option, and clearly labeled payday forecasts
- Today and Settings pay-period summaries with no automatic “money arrived” claims
- Debt balances and dated payment history
- Category envelopes with cap, used, left, over-cap, and unassigned views
- Permanent data-derived milestones
- Edit, remove, and five-second Undo patterns on key registers
- Data-derived daily next steps; permanent XP and levels have been removed
- Separate dated monthly notes with edit/delete/Undo, preserved drafts and dated daily intentions
- Privacy display mode
- Theme Studio with presets, independent color controls, interface and heading fonts, five handwriting choices, coverage options, Night Mode, and Extra Calm Mode
- Simple / Everything Included navigation depth
- JSON backup, native share fallback, restore, and spending CSV export
- Print / PDF Center with month, section, paper-size, and ink-saver controls
- Installable PWA shell with offline cache after the first successful load
- Official AurelyStudio logo and ownership metadata

## Delivery and platform boundaries

- This folder is the maintained app source. Publishing and customer ZIP delivery are separate release actions.
- It does not include a bank connection, account system, server sync, encryption, listing media, or a production deployment package.
- Install availability and the final Print / Save as PDF wording depend on the browser and operating system.
- Font families currently load from Google Fonts; offline fallback uses system fonts. Exact offline typography still requires bundling those licensed assets before a release that promises it.
- Data is stored in the current browser with `localStorage`.

## 2026-09-04.2 usability and calculation pass

- Today always uses the device's current month; viewing another year does not alter its budget guide.
- Bill payment status is stored per month. Legacy paid flags, which had no dates, are retained only in the old saved month; unknown history cannot be reconstructed.
- Bills due on the 29th–31st appear on the last available day in short months.
- Old undated income is attached to one month, and deleting dated income no longer resurrects a fallback amount.
- Forecasts include weekend paydays shifted across month boundaries. An entered payday replaces the forecast on the same date, leaving other forecasts visible.
- Focus has an explicit notice, Show everything action, and Escape shortcut; it resets on reopening.
- No spending today is a dated, undoable check-in without a fictitious transaction. The seven-day review counts only recorded spending and check-ins.
- Monthly activity supports text search and category filtering, with a result count and total.
- Unsupported or malformed backups are rejected before replacement. Supported restores ask before replacement and offer Undo.
- The device date refreshes when returning to the app and across midnight.
- Budget figures include scheduled income. They are estimates from the entered plan, not available bank balances; the checking field is a manually entered reference.

Reference access: the demo Help page was inspected live; 21st.dev's current public catalog was inspected for interaction reference. New check-in, review, filter, and Focus controls are original HTML/CSS/JS, with no new copied component or dependency. No sticker deliverables were added, per the product exception.

Run calculation/migration regressions with `node --test qa/regression.cjs`.

## 2026-09-05 paycheck budgets and account ledgers

- Planner now contains a Paycheck budget with Bills, Debt, Savings and Other allocations. Add a dated paycheck directly, assign each bill occurrence to one paycheck, and see an unclamped remaining / overallocated amount.
- Bills are visible and payable inside Planner. The bill month can differ from the paycheck month. Assigned bill amounts are saved snapshots; assigning does not mark bills paid.
- Debt/savings/other allocations are reservations only. They do not post cash transactions or subtract again from the monthly guide. Other is a planned allowance, not a linked spending total.
- Goal cards support dated deposits, spending from savings, returns to the monthly budget, balance corrections, and editing goal name/target/monthly plan without erasing history.
- Debt cards support dated payments, additional borrowing/fees, balance corrections, and editing name/APR/usual payment. Borrowing and corrections are excluded from payment totals.
- Every account exposes transaction date, type, amount, optional note/paycheck link, and running balance. Removal recalculates history and refuses to create a negative historical balance; a five-second Undo is available.
- Spending from savings reduces only the savings balance. Returning savings credits the monthly budget only when the goal's keep-out setting is enabled. Do not also enter the same savings purchase as everyday spending.
- Corrections record a signed delta today and have no cash-flow effect. Overdrafts, overpayments and invalid backdated sequences are rejected, not silently truncated.
- Legacy opening amounts are preserved without inventing dates. Version 8 migration reconstructs debt opening balances from the old current balance and its recorded payments; JSON backups include plans, bill snapshots and both ledgers.
- Referenced paychecks cannot be deleted or changed to one-time income until their plans/links are cleared. Forecasts must be saved as dated paychecks before allocating them.
- Test-only browser data uses a separate localhost origin; customer-origin records are not used for destructive tests.

Run all calculation, migration, report and backup tests with `node --test qa/*.cjs`.

## 2026-09-05.2 dynamic paycheck tracking (schema 9)

- Expense records now have an optional paycheck ID. Add spending directly inside a paycheck, assign an existing unlinked monthly expense, or edit its paycheck link. Moving or editing an expense updates one record, not a duplicate.
- A paycheck lists linked spending and account activity, with Income, Used / assigned, Still reserved, Total used + reserved, and Remaining. Assigned bills are committed regardless of paid status.
- Formula: used = assigned bills + linked expenses + linked debt payments + linked savings contributions − linked savings returns. Remaining = income − used − unspent allowances. Debt payments consume the debt allowance, deposits consume savings, and expenses consume Other. Extra borrowing, savings withdrawals and corrections are not charged to the paycheck a second time.
- Paycheck only hides the monthly dashboard/calendar. The user can still browse all saved paychecks and exact dated history.
- Savings cards explicitly show target, current saved, remaining to goal and progress. Debt cards show starting debt, total payments, remaining debt and progress. Added charges never inflate Total paid.
- Account transactions now support editing date, amount, note and paycheck link. IDs are stable; validation happens before mutation; running balances and paycheck totals recalculate. Transaction type is retained during edits. Corrections remain signed deltas.
- Transaction deletion uses an accessible in-app confirmation, with immediate Undo. No browser-native confirm is required for account-transaction deletion.
- Calculation coverage: the customer's 1800 / 1530 / 270 example, partial and exceeded allowances, returned savings, cross-paycheck expense reassignment, atomic invalid edits, linked balance edits, legacy migration and backup integrity.
- Design-reference pass: https://21st.dev/ public catalog accessed 2026-09-05. Used only information-hierarchy principles (compact totals, grouped activity, disclosure of secondary controls). No third-party code copied; no license or notices introduced; React/Tailwind dependencies are intentionally not added to this vanilla app. Implemented with existing themed HTML/CSS and native dialog/details controls.
- Scope: existing local prototype, not an Etsy upload or production release. No marketplace or policy claims, no listing/media/ZIP changes. No stickers, per the explicit product exception.
- QA: `node --test qa/*.cjs` passes 33 tests, including the real form/confirmation event handlers in a DOM stub. Browser-verified: linked expense creation/edit/reassignment, independent paycheck totals, paycheck-only view, contribution editing with stable ID/note and reload persistence. Old native confirmation in an earlier test tab blocked later browser clicks; it was replaced by an in-app dialog. The new delete/Undo logic passed unit tests, but its final live clicking check remains pending that browser dismissal. Phone and tablet goal grids showed no horizontal overflow.

## 2026-09-06 financial reports and completion checks (assets v25)

Product lock: expand this exact Monthly Budget Planner prototype at localhost:4317. Other AurelyStudio apps, customer ZIPs and published Etsy files are unchanged.

- All four requested workflows are implemented in the app: paycheck-specific Bills / Debt / Savings / Other planning; savings contributions/withdrawals and debt payments/charges; dated, noted, editable/deletable ledgers; paycheck links, JSON backup/restore and printable financial reports.
- Settings → Print now includes paycheck plans with assigned bills, linked spending/account activity, used/reserved totals and remaining money. Select paychecks by month, choose one exact paycheck, or include all years. A paycheck report always includes that paycheck's cross-month linked activity.
- Savings/debt reports show signed amounts, types, full dates, notes, paycheck labels and running balances. Monthly reports carry earlier transactions into Opening, exclude later transactions from Closing, and label the current all-recorded balance separately. All-years reports retain every dated entry. Account history is independent of the paycheck selector.
- Reports use the same BudgetFinance calculations as the live UI and do not mutate balances. Backups include account histories, links, bill snapshots, report settings and theme preferences. The spending CSV is still spending-only, accurately labeled; use JSON for a complete recovery copy.
- Planner contains direct report/backup links. Fixed settings-anchor navigation from other screens. Applied actual A4 / Letter page-size CSS and a local creation timestamp.
- Actual Chrome print preview exposed two trailing blank pages from the old invisible settings layout. Print layout now removes non-report content from flow. Retest produced two content-bearing pages instead of four, with no trailing blank pages. No physical print job was submitted.
- Live isolated test origin :4321: contribution +100 linked to a paycheck changed savings 780→880; confirm-delete changed 880→780 and Undo restored 880 with one history entry. The report showed the same +100 note and paycheck remaining 2200; reload retained it. This completes the previously pending live account-transaction delete/Undo check.
- QA: 39 automated tests passed, including complete backup round trip and report equality, the 1800−1530=270 example, period boundaries, escaped report text and immutable report rendering. Desktop report preview and phone width 390 checked visually; no horizontal page overflow at 390.
- Source/access: existing app files and local IAB/Chrome previews used. No competitor code, new external components or dependencies were added; this extends the established design rather than rebuilding it. No marketplace or policy claims were made. No stickers, per the explicit product exception.
- Delivery boundary: updated local prototype, not a published customer release. No Etsy upload, deployment or replacement customer ZIP was performed.

## Open locally

Serve this folder over HTTP and open `index.html`. HTTP/HTTPS is required for supported local saving and PWA behavior; direct file opening is not a supported delivery route.

## 2026-09-06 first-screen motion fix (app/styles v30)

The existing ribbon, light sweep and button animations now start during name entry, not only after it. The name heading reveals softly with a gold shimmer; input remains stable and never times out. Pause/resume is available and keyboard-reachable on this first screen. Reduced-motion and Extra Calm remain respected. No design, logo, budget logic or saved data changes. 54 automated tests pass; the real preview showed all three ribbons running and pause/resume working. Existing original CSS only; no new dependencies or external assets.

## 2026-09-06 name-first opening and monogram refinement (assets v29)

- Unnamed profiles see a local name/nickname form before the approved cinematic opening. Existing named profiles do not repeat setup. Settings and JSON backups use the same profile name; financial records are untouched.
- Blank/overlong names are rejected. Failed storage writes restore the previous name and show an English error. Keyboard focus is contained and restored; reduced-motion users still receive the name form without forced decorative animation.
- Explicit owner request overrides the former framed-mark rule for this planner: the app now uses an original unframed uppercase A, fixed champagne gold and independent of themes. Sidebar, opening, preview, print, favicon and manifest share the SVG. No external logo or font outline copied.
- Selected desktop month tabs extend 18 px (previously 8 px), with restrained overshoot; no yellow strip. Phone month navigation is unchanged.
- Reference pass: https://21st.dev/ accessed 2026-09-06; retained the existing animated-hero and button-light principles. This change uses original vanilla HTML/CSS/JS, no third-party component code, license obligations or dependencies added. No sticker deliverable, per the product exception.
- QA: 53 automated tests pass, including five new onboarding cases. Browser checks covered blank-name validation, saved-name reload, personalized replay, 18 px selected-tab extension, and no document overflow at 390×844, 768×1024 and 1440×900. No browser errors observed in these test flows. Test names were entered only on isolated localhost test origins, not the customer preview origin. No publication or ZIP release performed.

## 2026-09-06 cinematic opening revision (assets v28)

The user rejected the quiet ivory opening and explicitly requested more animation/effects. This supersedes the v27 visual treatment without changing financial features, stored records or the official logo.

- Original animated CSS light ribbons over a deep teal background, sequential masked headline reveal, champagne text shimmer, one entrance light sweep and a button sheen. No canvas/WebGL, downloaded imagery or new dependency. Motion only runs while the opening is active.
- Automatic opening now lasts 4.2 seconds and remains skippable. The new `#screen-opening` deep link replays the entrance directly; explicit replay stays until the user enters or skips. Closing removes the replay hash. The unchanged reduced-motion/Extra Calm setting bypasses automatic opening and removes animation from explicit replay.
- Added Pause/Resume motion for prolonged replay. Pausing reveals text immediately so it cannot be frozen illegibly mid-entrance. Keyboard focus cycles among entry, pause and Skip; Escape exits and restores focus.
- Reference: 21st.dev's current animated-hero, background and shimmer patterns reviewed on September 6. These are visual references only; the implementation is original vanilla CSS/JS, with no copied component or new license/dependency requirements. Etsy Master Pro guided branding and motion-accessibility QA; the explicit no-sticker exception remains. No listing or publication changes.
- QA: 48 automated tests, including updated opening timing, replay, reduced motion, focus return and financial-state immutability. Live browser checked direct replay, animated light transforms, Pause/Resume and entry controls; mobile 393×844 and desktop 1440×900 rendered views reviewed. Earlier v27 checks remain historical, not claims that the old design is current.

## 2026-09-06 editorial opening (assets v27)

Scope: opening screen only, in the same Monthly Budget Planner source at localhost:4317. Account balances, notes, budgeting logic, storage schema, official logo asset and ownership metadata are unchanged.

- Replaced the orbiting tokens, glow/grid effects and simulated loading messages with an original ivory-and-champagne editorial cover, fixed brand block, large serif title and English device-local date. No images or component dependencies were added.
- Ordinary motion-enabled entry closes after 2.6 seconds, once per tab session. Open my planner, Skip intro and Escape close it immediately. Reduced motion or Extra Calm bypasses the automatic intro. Explicit Replay opening stays open until dismissed and is static in calm mode.
- Background controls are inert while the opening is active. Tab cycles through the two exit buttons; closing restores focus to the previous control. The exit overlay cannot intercept clicks during its fade.
- Source pass: current 21st.dev catalog (https://21st.dev/) inspected on September 6 for hero typography and restrained transitions. Original vanilla CSS/JS implementation; no third-party code copied, so no new component license/dependency or attribution obligation. Existing app blueprint and Etsy Master Pro guided the scope and QA. No stickers per the product exception, no listing/publication changes or marketplace claims.
- QA: 48 automated tests pass, including three opening lifecycle tests for automatic close, session skip, replay, focus restoration, reduced motion and unchanged financial state. Browser opening checked for overflow at 320, 360, 393, 768, 1024, 1280 and 1440 CSS pixels. Mobile and desktop rendered views inspected; Tab/Shift+Tab and Escape verified. No app errors in the tested flow.

## 2026-09-06 daily experience, English dates and kept notes (assets v26)

This pass continues the exact source and existing storage key. Historical names in the folder/key and earlier changelog entries are retained for compatibility; the customer-facing title, description and footer no longer say Prototype.

- Today opens by default when no valid screen link is supplied. Its date and morning/afternoon/evening greeting follow the device clock. The seven-day strip opens exact dated spending and intentions, with previous/next-day controls and a full date chooser. Viewing a past day never changes today's guide.
- Added explicit logged-today totals, common-spend prices, plan-through date and six-week upcoming bills/income across month/year boundaries. Paid bill occurrences are excluded. Forecast income remains clearly labeled, not presented as received bank cash.
- Planner headings no longer use decorative circles; month tabs no longer display decorative data dots. Selected tabs retain a small pull-out. Date/welcome typography, notes spacing, mobile navigation and dark-theme links were refined. Pocket summary now names its selected month/year to distinguish it from Today.
- All app-owned date/month controls use an original English chooser, while retaining ISO values in existing forms. It supports year selection, leap days, required dates and min/max validation, including nested account/paycheck dialogs. Native browser/OS print/share dialogs remain outside the app's language control.
- Monthly notes now have a composer and a separate kept-note list. Keep appends rather than overwrites; edits keep the original date, deletes offer Undo, drafts remain per month and notes never affect money. Existing undated intention text is retained without inventing a date. Kept notes are included in full JSON backups and the Notes print section.
- Settings shows the last recorded backup export and counts of saved paychecks, bills, spending, account transactions and kept notes. A timestamp means an export was initiated, not that a file has been verified in external storage. CSV remains spending-only.
- Service-worker cleanup is scoped to this app's cache names and no longer returns HTML as a missing offline script/style.

Reference audit: the supplied demo Today and Settings pages were inspected live on September 6, 2026. The useful date, next-action, notes, payday, setup, recovery and report flows were compared with this product. The 21st.dev public catalog was reviewed for interaction reference; this pass uses original vanilla HTML/CSS/JS and introduces no copied component or dependency. Multi-bank registers, automatic multi-stream payday rules and optional encrypted device sync from the reference are not claimed here; this app supports manual dated paychecks, one forecast rhythm and portable JSON backup instead. No bank connection, cloud service or Etsy publication was added.

Verification: `node --test qa/*.cjs` — 45 passing tests. Added English date/leap-year tests, a six-week year-boundary test, exact-day journal checks and kept-note backup/escaping/rejection cases. In the isolated :4322 browser, two notes survived reload and month switching; edit/delete/Undo worked; the Notes print preview included their text. A paycheck selected for February 29, 2028 was saved on that exact date. Today and Planner were checked at 390px and 1440px; Night Mode cards remained fully opaque, and the browser error log was empty during the tested flows. Actual PDF pagination was previously verified in the v25 pass; this pass checked the new notes in the in-app print preview.
