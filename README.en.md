# Household Financial Checkup

[中文](README.md)

**Fill in one household financial checkup questionnaire, get a clear picture of your family's financial health, plus a one-page family Investment Policy Statement. No sign-up, nothing leaves your browser, no products for sale.**

Try it: **[longarcsociety.com/tools/checkup](https://longarcsociety.com/tools/checkup)** (Chinese interface)

Built for Chinese families: amounts are in 10,000 CNY, the defaults use A-share and CSI 300 assumptions, and the categories cover mortgages, savings-type insurance and private pensions.

![Five layers, checked from the foundation up](screenshots/layers.jpg)

## What it does

1. **Questionnaire.** Family members, assets, debts, income, spending, plans and insurance. Each number is entered once. Anything that can be derived (interest, loan payments) is prefilled and stays editable.
2. **Report.**
   - Net worth and balance sheet.
   - Which of five stages the family is in, and what this stage asks for.
   - A five-layer checkup, rated steady / watch / fix first: protection, liquidity reserve, debt, savings, wealth accumulation.
   - How the money should be split (cash, short-term, long-term), with stock share and stress tests in money terms.
   - An action list.
   - A share image (amounts hidden by default) and PDF export.
3. **Investment Policy Statement.** The one page private banks and advisors write for clients. What can be computed is prefilled; the rest you write, print and sign together. Includes a plan for 10%, 20% and 30% drawdowns.

## Use it

- Online at the link above.
- Offline: Code → Download ZIP, unzip, double-click `index.html`.
- Self-host: static files only, no build step.

## Privacy

Data lives only in your browser's localStorage. There are no analytics. The page loads web fonts; the QR and image libraries are bundled in `lib/`.

## Method

Every rule, default and source is listed in [docs/方法说明.md](docs/方法说明.md) (Chinese). The reasoning behind them is in the 52-article [投资配置](https://longarcsociety.com/assets/invest) series on Long Arc.

This is not investment advice. The tool computes categories and amounts by a stated method. It never recommends funds, products or stocks.

## License

Code under [MIT](LICENSE). The Long Arc (慢复利) name and logos in `assets/` and on the page are not covered; replace them in your fork.
