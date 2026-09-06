# v33 — Visual budgeting and settings alignment

## Final v34 follow-up

The owner explicitly removed levels and permanent XP. Removed the header badge, XP awarding and celebration logic, and game state from defaults/normalization. Older XP metadata is ignored on restore and omitted from subsequent saves/backups. Small-step checklists now derive completion from saved spending/no-spend records, monthly bill status and dated savings deposits, not rewards. Financial state, paycheck planning, editable ledgers, backups and print reports are unchanged. Final validation: 63 automated tests passing. v34 is the final customer release for this pass; v32/v33 were local intermediate versions.

September 6, 2026. Existing full Monthly Budget Planner; demo unchanged.

## Customer-facing changes

- Today first, Planner immediately underneath.
- Today/Planner: monthly allocation ring, category drill-down, daily spending columns and exact-value tables.
- Planner: five-part Bills / Debt / Savings / Other / Left paycheck allocation with live allowance updates. Calculation details collapsed by default.
- Planner: six-month Income entries / Spending logs comparison. Select a column group to browse that month. These are saved entries, not bank-confirmed cash; forecasts, bills and transfers are explicitly excluded.
- Goals and Debt: balance line/area charts derived from ordered account transactions, with direct access to review/edit the latest transaction. Opening balances remain undated. X-axis is transaction order, explicitly labeled; large histories show the last 30 balances while full histories stay available.
- Privacy neutralizes charts and masks amounts. Calm/reduced-motion remains supported. No extra chart dependencies or changes to the financial storage schema.
- Settings form controls align at their tops and share a 48px height, including Full Look handwriting. The weekend switch has explicit grid layout. Night settings tabs use the dark paper surface.

## Sources and design

Reviewed https://21st.dev/@reaviz/components/area-chart-1 and the 21st.dev card/chart catalogs for compact chart cards, hierarchy and progressive disclosure. Reaviz's listing uses React/Reaviz/Framer Motion. No component source copied, no new dependencies or third-party art; this app's charts use original SVG/CSS and existing cash/ledger calculations.

## QA

- 62 automated tests passing (`node --test qa/*.cjs`). Includes financial reconciliation, savings returns, charge exclusions, chronological account balances, paycheck allowances without double counting, chart privacy and cross-year six-month filtering.
- Isolated localhost only: contribution +100 updated the savings plot; editing the same transaction to 80 changed the plot to +80 and current balance to 860. Review latest transaction opened that exact existing record. Debt charge +50 changed the balance journey to +50.
- Live allowance inputs of Debt 200, Savings 100, Other 300 showed Left 1700 from income 2300 immediately.
- Six-month August chart click changed the planner to August and the chart range to March–August.
- New account and paycheck/trend charts fit a 390px phone with no document overflow; inspected a real phone render. Earlier v31 checks covered Today from 320 through 1440px, night mode, masking, date navigation and calm mode.
- Settings top alignment was remeasured under Full Look; follow-up shared 48px height prevents the native select from growing taller than the date trigger.
- Source tests do not claim exhaustive correctness across all legacy flows, arbitrary themes or browsers. No customer-origin records were mutated for tests.
