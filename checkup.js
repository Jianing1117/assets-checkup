/* 家庭资产配置体检：计算规则见 docs/方法说明.md */
(() => {
const D = document, KEY = 'la-checkup-v5', OLD = 'la-checkup-v2', YEAR = new Date().getFullYear();
const ART = (slug, text) => `<a class="lk" href="https://longarcsociety.com/assets/${slug}" target="_blank" rel="noreferrer">${text}</a>`;

/* ── 小工具 ── */
const norm = v => String(v ?? '').replace(/[０-９．－]/g, c => c === '－' ? '-' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[,，\s]/g, '');
const n = v => { const x = parseFloat(norm(v)); return isFinite(x) ? x : 0 };
const has = v => v !== null && v !== undefined && isFinite(parseFloat(norm(v)));
const nv = (v, d) => has(v) ? n(v) : d;
const w = x => { if (!isFinite(x)) return '—'; if (Math.abs(x) >= 10000) return (Math.round(x / 1000) / 10).toLocaleString('zh-CN') + ' 亿'; const r = Math.round(x * 10) / 10; return (Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r.toFixed(1)) + ' 万' };
const w2 = x => isFinite(x) ? (Math.round(x * 100) / 100) + ' 万' : '—';
const pc = (x, d = 0) => isFinite(x) ? (Math.round(x * 100 * 10 ** d) / 10 ** d) + '%' : '—';
const mo = x => isFinite(x) ? (Math.round(x * 10) / 10) + ' 个月' : '—';
const yr = x => isFinite(x) ? (Math.round(x * 10) / 10) + ' 年' : '—';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const capOn = t => `<span class="cap">${t}</span>`, capOff = t => `<span class="cap o">${t}</span>`;
const chk = bad => bad === null || bad === undefined ? '' : (bad ? capOn('留意') : capOff('正常'));
const factor = N => N <= 0 ? 0 : (1 - Math.pow(1.015, -N)) / 0.015; /* 《保障 03》的年数系数：扣掉通胀后 1.5% 的回报 */

/* ── 问卷里固定列出的类型：只填金额，归类由类型决定 ── */
const A_CASH = [
  { k: 'cur', name: '活期和现金', cls: 'L', r: 0 },
  { k: 'mmf', name: '货币基金、余额宝', cls: 'L', r: 1.2, note: '现金管理类理财、国债逆回购也记这里' }];
const A_INV = [
  { k: 'dep', name: '定期和大额存单', cls: 'S', sg: 'fi', r: 1.2 },
  { k: 'gov', name: '国债', cls: 'S', sg: 'fi', r: 1.7 },
  { k: 'wm', name: '银行理财', cls: 'S', sg: 'fi', r: 1.7, note: '不保本，净值会波动' },
  { k: 'bf', name: '债券基金', cls: 'S', sg: 'fi', r: 1.7, note: '混合基金里的债券部分也记这里' },
  { k: 'stk', name: '股票', cls: 'K', sg: 'eq', r: 5.3, note: 'A 股、港股，按今天的市值' },
  { k: 'sf', name: '股票基金、偏股混合基金', cls: 'K', sg: 'eq', r: 5.3, note: '混合基金按季报里的股票仓位拆开记' },
  { k: 'os', name: '海外股票和 ETF', cls: 'K', sg: 'eq', r: 5.3, note: '含买海外股票的 QDII 基金，折成人民币' },
  { k: 'gold', name: '黄金', cls: 'G', sg: 'alt', r: null, note: '实物金、黄金 ETF、积存金' },
  { k: 'cry', name: '加密资产', cls: 'X', sg: 'alt', r: 0 }];
const SG = { fi: '稳健类：存款、债券和理财', eq: '股票类', alt: '黄金和加密资产' };
const A_ILL = [
  { k: 'home', name: '自住房', cls: 'home', note: '同小区同户型最近的成交价，工具按九折记' },
  { k: 'invh', name: '投资房', cls: 'inv', note: '几套合计，同样按成交价', x: 'inc', xl: '每年净租金' },
  { k: 'car', name: '车', cls: 'C', note: '二手估价' },
  { k: 'pen', name: '个人养老金、企业年金', cls: 'R' },
  { k: 'sav', name: '储蓄险的现金价值', cls: 'R', note: '年金险、增额终身寿这类；按现金价值，不按已交的保费', x: 'prem', xl: '每年还要交的保费' },
  { k: 'biz', name: '自己的生意和股权投资', cls: 'PE', note: '非上市股权、私募股权、未解禁的股票和期权', x: 'inc', xl: '每年分到的钱' },
  { k: 'lent', name: '借出去的钱', cls: 'O', note: '按估计能收回的金额；填了哪年收回，往后推时那一年算进能动用的钱', x: 'inc', xl: '每年收到的利息', x2: 'back', xl2: '哪年收回' },
  { k: 'oth', name: '信托、收藏品等其他', cls: 'O' }];
const DEBT = [
  { k: 'mort', name: '房贷', note: '商业贷款', home: 1 },
  { k: 'hpfl', name: '公积金贷款', home: 1 },
  { k: 'car', name: '车贷' },
  { k: 'cons', name: '消费贷' },
  { k: 'biz', name: '经营贷', note: '挂在个人名下的' },
  { k: 'card', name: '信用卡分期、花呗、白条', note: '每月全额还清的账单不算' },
  { k: 'fam', name: '亲友借款', note: '没有固定还款的，月还款空着' },
  { k: 'oth', name: '其他' }];
const EXP = [
  { k: 'daily', name: '日常生活', note: '吃饭、日用、交通、物业水电、通讯', need: 1 },
  { k: 'rent', name: '房租', need: 1 },
  { k: 'loan', name: '贷款月还款', note: '按「负债」里的月还款 × 12 自动算，还完的那年自动去掉', need: 1, auto: () => sum(defsOf('debt'), d => n(st.debt[d.k].pay)) * 12 },
  { k: 'edu', name: '孩子的教育', note: '学费、课外班、托管；往后推时付到最小的孩子 22 岁', need: 1 },
  { k: 'prem', name: '保障型保险的保费', note: '医疗、意外、重疾、定期寿险', need: 1 },
  { k: 'care', name: '赡养父母', need: 1 },
  { k: 'med', name: '看病和医疗', need: 1 },
  { k: 'flex', name: '可调整的', note: '外出吃饭、娱乐、购物、旅行、人情往来', need: 0 },
  { k: 'once', name: '一次性的', note: '过去一年里的大额支出，比如换家电', need: 0 }];
const INC = [
  { k: 'side', name: '副业、兼职、稿费', work: 1 },
  { k: 'pas', name: '其他不用工作也有的收入', note: '比如父母固定给的补贴' },
  { k: 'int', name: '利息和理财收益', note: '按「资产」里流动性资产和稳健类的金额和预期年化自动算', auto: () => interestAuto() },
  { k: 'ainc', name: '租金、分红和借款利息', note: '「资产」里不好随时卖的那几行，最后一列的合计', auto: () => sum(defsOf('ill'), d => d.x === 'inc' ? n(st.ill[d.k].inc) : 0) }];
const GROUPS = { cash: A_CASH, inv: A_INV, ill: A_ILL, debt: DEBT, exp: EXP, inc: INC };
const USE = [['edu', '国内教育'], ['eduA', '海外教育'], ['abroad', '海外生活和医疗'], ['care', '赡养父母'], ['home', '买房、换房、装修'], ['car', '买车'], ['other', '其他']];
const USEN = Object.fromEntries(USE);
const RISK = [
  { k: 'q1', q: '你拿过的风险最高的投资是', o: [['0', '只有存款和理财'], ['1', '债券基金、固收加'], ['2', '股票或股票基金，不到三年'], ['3', '股票或股票基金，三年以上']] },
  { k: 'q2', q: '上一次股市大跌时，你做了什么？', note: '比如 2018 年沪深 300 全年跌了约 25%；2021 年初到 2024 年初，跌了四成多', o: [['n', '没经历过，或那时没有股票'], ['0', '卖掉了一部分或全部'], ['2', '没动'], ['3', '加了仓']] },
  { k: 'q3', q: '如果你的股票类资产三个月里跌了 25%，你会', o: [['0', '全部卖掉'], ['1', '卖掉一部分'], ['2', '不动'], ['3', '按计划加仓']] },
  { k: 'q4', q: '10 万元放一年，下面几种结果你更能接受哪一种', o: [['z', '一分都不能亏'], ['1', '最好赚约 6 千，最坏亏约 1.6 千'], ['2', '最好赚约 1.9 万，最坏亏约 1 万'], ['3', '最好赚约 4.2 万，最坏亏约 3.6 万']] }];
const TIER = { cons: { name: '保守', range: [6, 12], adj: -10 }, std: { name: '标准', range: [3, 6], adj: 0 }, aggr: { name: '激进', range: [1, 3], adj: 10 } };
const TORD = ['cons', 'std', 'aggr'];
const ROLE = [['main', '主要收入者'], ['adult', '另一位大人'], ['child', '孩子'], ['elder', '一起生活的老人']];
const ROLEN = Object.fromEntries(ROLE);
const INS = [['yb', '医保'], ['yl', '医疗险'], ['yw', '意外险'], ['zj', '重疾险'], ['sx', '定期寿险']];
const INSN = Object.fromEntries(INS);
const NEED = { main: ['yb', 'yl', 'yw', 'zj', 'sx'], adult: ['yb', 'yl', 'yw', 'zj'], child: ['yb', 'yl', 'yw'], elder: ['yb'] };
const R_RATE = 1.7; /* 受限资产往后推的年化，和债券类一样 */
const rateDef = d => d.r === null ? nv(st.infl, 2) : d.r;
const rateOf = (g, d) => has(st[g][d.k].rate) ? n(st[g][d.k].rate) : rateDef(d);
/* 用户自己加的一行：归类跟着加在哪一块 */
const UDEF = { cash: { cls: 'L', r: 0 }, fi: { cls: 'S', r: 1.2 }, eq: { cls: 'K', r: 5.3 }, alt: { cls: 'G', r: 0 }, ill: { cls: 'O', x: 'inc', xl: '每年的收入' }, debt: {}, exp: { need: 1 }, inc: {} };
const customs = g => Object.keys(st[g]).filter(k => st[g][k] && st[g][k].custom).map(k => ({ k, name: st[g][k].name || '自己加的一项', custom: 1, sg: st[g][k].sg, ...UDEF[g === 'inv' ? st[g][k].sg : g] }));
const defsOf = g => g === 'inv' ? ['fi', 'eq', 'alt'].flatMap(sg => [...A_INV.filter(d => d.sg === sg), ...customs(g).filter(d => d.sg === sg)]) : [...GROUPS[g], ...customs(g)];
const workOf = d => d.custom ? st.inc[d.k].work !== '0' : !!d.work;
const autoOf = (g, k) => { const d = GROUPS[g].find(x => x.k === k); return d && d.auto ? d.auto() : null };
const amt = (g, k) => { const v = st[g][k].amt; if (has(v)) return n(v); const a = autoOf(g, k); return a === null ? 0 : a };
const r2 = x => Math.round(x * 100) / 100;
/* 利息和理财收益：流动性资产和稳健类有现金利息，进今年的收入；股票、黄金、加密的涨跌不算 */
const interestAuto = () => sum(defsOf('cash'), d => amt('cash', d.k) * rateOf('cash', d) / 100) + sum(defsOf('inv').filter(d => d.cls === 'S'), d => amt('inv', d.k) * rateOf('inv', d) / 100);
const RE_W = 0.003; /* 沪深 300 里房地产行业的权重，中证指数 2026 年 8 月 31 日的指数单张 */
const needOf = d => { const v = st.exp[d.k].need; return v === '1' || v === '0' ? v === '1' : !!d.need };

/* ── 状态 ── */
const member = o => ({ name: '', role: 'adult', age: '', income: '', itype: 'stable', yb: false, yl: false, yw: false, zj: false, sx: false, life: '', ci: '', gap: '', gapYears: '', ...o });
const rowsOf = defs => Object.fromEntries(defs.map(d => [d.k, {}]));
const blank = () => ({
  v: 5,
  members: [member({ name: '我', role: 'main' })],
  cash: rowsOf(A_CASH), inv: rowsOf(A_INV), ill: rowsOf(A_ILL), debt: rowsOf(DEBT), exp: rowsOf(EXP), inc: rowsOf(INC),
  usdAmt: '', reFin: '', shrinking: false, sameCity: false, shareName: '',
  retire: 60, pension: '', plans: [],
  risk: {}, tier: '', goldLoss: 5, cryptoLoss: 2, ageOverride: '',
  months: '', shortStock: '', endAge: 90, gs: 2, ge: 2, infl: 2, wr: 3.5,
  ips1: '', ips3: '', ips4: '', ips7: '', ips8: '', tStock: '', tGold: '', tCrypto: '', ipsMonth: '1'
});
const sample = () => {
  const s = blank(), f = (g, k, o) => Object.assign(s[g][k], o);
  s.members = [
    member({ name: '丈夫', role: 'main', age: 38, income: 32, itype: 'vol', yb: true, yl: true, yw: true, zj: true, ci: 50 }),
    member({ name: '妻子', role: 'adult', age: 36, income: 22, yb: true, yl: true, yw: true, zj: true, ci: 30 }),
    member({ name: '孩子', role: 'child', age: 11, yb: true, yl: true, yw: true })];
  f('cash', 'cur', { amt: 4 }); f('cash', 'mmf', { amt: 8 }); f('inv', 'dep', { amt: 20, rate: 3 }); f('inv', 'wm', { amt: 15, rate: 2.8 });
  f('inv', 'stk', { amt: 5 }); f('inv', 'sf', { amt: 20 });
  f('ill', 'home', { amt: 450 }); f('ill', 'car', { amt: 8 }); f('ill', 'pen', { amt: 3 }); f('ill', 'sav', { amt: 6 });
  f('debt', 'mort', { bal: 160, rate: 3.1, pay: 0.895 }); f('debt', 'cons', { bal: 5, rate: 8, pay: 0.23 }); f('debt', 'card', { bal: 2, rate: 13, pay: 0.18 });
  f('exp', 'daily', { amt: 13.2 }); f('exp', 'edu', { amt: 6 }); f('exp', 'prem', { amt: 1.8 }); f('exp', 'flex', { amt: 11.4 }); f('exp', 'once', { amt: 3.5 });
  s.plans = [
    { use: 'edu', kind: 'once', year: YEAR + 1, years: 1, amt: 5, sure: '1', item: '孩子小升初的择校和课外' },
    { use: 'car', kind: 'once', year: YEAR + 2, years: 1, amt: 15, sure: '1', item: '换车' },
    { use: 'care', kind: 'once', year: YEAR + 3, years: 1, amt: 10, sure: '1', item: '给父母预备的医疗费用' },
    { use: 'home', kind: 'once', year: YEAR + 4, years: 1, amt: 10, sure: '1', item: '房子局部翻新' },
    { use: 'edu', kind: 'exp', year: YEAR + 7, years: 4, amt: 10, sure: '0', item: '孩子上大学' }];
  s.risk = { q1: '2', q2: '2', q3: '1', q4: '2' };
  s.tier = 'cons'; s.months = 7;
  return s;
};
function merge(s) {
  const b = blank(), t = { ...b, ...s };
  Object.keys(GROUPS).forEach(g => { t[g] = {}; GROUPS[g].forEach(d => { t[g][d.k] = { ...((s[g] || {})[d.k] || (g === 'inv' && (s.cash || {})[d.k]) || {}) } });
    Object.entries(s[g] || {}).forEach(([k, v]) => { if (v && v.custom) t[g][k] = { ...v } }) });
  t.members = Array.isArray(s.members) ? s.members.map(m => member(m)) : b.members;
  t.plans = Array.isArray(s.plans) ? s.plans : [];
  t.risk = { ...(s.risk || {}) };
  const oldUsd = ((s.inv || {}).usd || (s.cash || {}).usd || {}).amt;
  if (has(oldUsd)) { t.inv.dep.amt = n(t.inv.dep.amt) + n(oldUsd); if (!has(s.usdAmt)) t.usdAmt = n(oldUsd) + n(t.inv.os.amt) }
  return t;
}
/* 旧版（v2、v3）的存档：按名称和归类放进固定的类型里 */
function fromOld(s) {
  const t = blank();
  if (Array.isArray(s.members) && s.members.length) t.members = s.members.map(m => member(m));
  const put = (g, k, f, v) => { if (!has(v)) return; const o = t[g][k]; o[f] = has(o[f]) ? n(o[f]) + n(v) : v };
  const set = (g, k, f, v) => { if (has(v)) t[g][k][f] = v };
  const nm = x => x.name || '';
  let usd = 0;
  (s.cash || []).forEach(x => { if (x.cur === 'usd') usd += n(x.amt); const k = /活期|现金/.test(nm(x)) ? 'cur' : /货币|余额宝/.test(nm(x)) ? 'mmf' : /定期|存单/.test(nm(x)) ? 'dep' : /国债/.test(nm(x)) ? 'gov' : /理财/.test(nm(x)) ? 'wm' : /债/.test(nm(x)) ? 'bf' : (x.cls === 'L' ? 'mmf' : 'wm'); const g = k === 'cur' || k === 'mmf' ? 'cash' : 'inv'; put(g, k, 'amt', x.amt); set(g, k, 'rate', x.rate) });
  (s.invest || []).forEach(x => { if (x.cur === 'usd' && x.cls !== 'X') usd += n(x.amt); const k = x.cls === 'G' ? 'gold' : x.cls === 'X' ? 'cry' : (x.cur === 'usd' || /海外/.test(nm(x))) ? 'os' : /基金/.test(nm(x)) ? 'sf' : 'stk'; put('inv', k, 'amt', x.amt); set('inv', k, 'rate', x.rate) });
  if (usd > 0) t.usdAmt = usd;
  (s.illiq || []).forEach(x => { const k = x.cls === 'home' ? 'home' : x.cls === 'inv' ? 'invh' : x.cls === 'C' ? 'car' : x.cls === 'PE' ? 'biz' : x.cls === 'R' ? (/公积金/.test(nm(x)) ? '' : /保险|储蓄险/.test(nm(x)) ? 'sav' : 'pen') : (/借/.test(nm(x)) ? 'lent' : 'oth'); if (k) put('ill', k, 'amt', x.amt) });
  (s.props || []).forEach(p => { if (p.use === 'inv') { put('ill', 'invh', 'amt', p.price); put('ill', 'invh', 'inc', p.rent) } else put('ill', 'home', 'amt', p.price) });
  put('ill', 'car', 'amt', s.C);
  const DM = { mort: 'mort', hpf: 'hpfl', car: 'car', cons: 'cons', card: 'card' };
  (s.debts || []).forEach(d => { const k = DM[d.type] || 'oth'; put('debt', k, 'bal', d.bal); put('debt', k, 'pay', d.pay); set('debt', k, 'rate', d.rate) });
  (s.expenses || []).forEach(x => { const a = nm(x); if (/房贷月供/.test(a)) return; const k = /房租/.test(a) ? 'rent' : /教育|学/.test(a) ? 'edu' : /保费|保险/.test(a) ? 'prem' : /父母|孝/.test(a) ? 'care' : /看病|医疗/.test(a) ? 'med' : /一次性/.test(a) ? 'once' : /旅行|娱乐|购物/.test(a) ? 'flex' : (x.need === '0' ? 'flex' : 'daily'); put('exp', k, 'amt', x.amt) });
  (s.incomes || []).forEach(x => { if (x.kind === 'interest') return; if (x.kind === 'passive' && /租/.test(nm(x))) put('ill', 'invh', 'inc', x.amt); else put('inc', x.kind === 'work' ? 'side' : 'pas', 'amt', x.amt) });
  const guess = a => /教育|学|择校/.test(a) ? 'edu' : /父母|赡养/.test(a) ? 'care' : /车/.test(a) ? 'car' : /房|装修|翻新|首付/.test(a) ? 'home' : 'other';
  t.plans = (s.plans || []).map(p => ({ use: guess(p.item || ''), kind: p.kind || 'once', year: p.year, years: p.years, amt: p.amt, sure: '1', item: p.item || '' }));
  (s.bills || []).forEach(b => t.plans.push({ use: /学|本科|硕士|留学/.test(b.item || '') ? 'eduA' : 'abroad', kind: 'once', year: b.year, years: 1, amt: b.amt, sure: b.sure || '1', item: b.item || '' }));
  if (has(s.eduYears) && has(s.eduCost)) t.plans.push({ use: 'edu', kind: 'exp', year: YEAR + 1, years: n(s.eduYears), amt: s.eduCost, sure: '1', item: '教育（从旧版带过来，年份请核对）' });
  if (has(s.careAmt) && has(s.careYears)) t.plans.push({ use: 'care', kind: 'exp', year: YEAR, years: n(s.careYears), amt: s.careAmt, sure: '1', item: '给父母的钱（从旧版带过来）' });
  ['shrinking', 'sameCity', 'reFin', 'retire', 'pension', 'goldLoss', 'cryptoLoss', 'ageOverride', 'months', 'shortStock', 'endAge', 'gs', 'ge', 'infl', 'wr', 'ips1', 'ips3', 'ips4', 'ips7', 'ips8', 'tStock', 'tGold', 'tCrypto', 'ipsMonth'].forEach(k => { if (s[k] !== undefined) t[k] = s[k] });
  if (TIER[s.tier] && s.tier !== 'std') t.tier = s.tier;
  return t;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 5) return merge(s) } catch (e) { }
  try { const o = JSON.parse(localStorage.getItem(OLD)); if (o && Array.isArray(o.cash)) return fromOld(o) } catch (e) { }
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch (e) { } }
let st = load() || blank();
const modOf = h => { const m = h.match(/^#m([123])$/); if (m) return +m[1]; const el = h.length > 1 && D.getElementById(decodeURIComponent(h.slice(1))), box = el && el.closest('[data-mod]'); return box ? +box.dataset.mod : 0 };
const POS = 'la-checkup-pos', pos0 = (() => { try { return JSON.parse(sessionStorage.getItem(POS)) } catch (e) { return null } })();
let mod = modOf(location.hash) || (pos0 && pos0.mod) || 1;

/* ── 表格 ── */
const numIn = (attrs, v, ph, cls = '') => `<input class="field${cls ? ' ' + cls : ''}" type="text" inputmode="decimal" ${attrs} value="${esc(v)}"${ph !== undefined && ph !== '' ? ` placeholder="${esc(ph)}"` : ''}>`;
const typeCell = d => `<td class="ty"><div>${d.name}</div>${d.note ? `<div class="s">${d.note}</div>` : ''}</td>`;
/* 固定类型的表：每行一个类型，cols 里每一列是一个要填的数 */
const FIXED = {
  cash: { cols: [{ f: 'amt', l: '金额 万元' }, { f: 'rate', l: '预期年化 %', ph: d => rateDef(d) }] },
  inv: { cols: [{ f: 'amt', l: '金额 万元' }, { f: 'rate', l: '预期年化 %', ph: d => rateDef(d) }] },
  ill: { cols: [{ f: 'amt', l: '金额 万元' }, { f: 'x', l: '每年的收入或保费 万元' }] },
  debt: { cols: [{ f: 'bal', l: '余额 万元' }, { f: 'rate', l: '年化 %' }, { f: 'pay', l: '月还款 万元' }] },
  exp: { cols: [{ f: 'amt', l: '每年 万元' }, { f: 'need', l: '收入断了' }] },
  inc: { cols: [{ f: 'amt', l: '每年 万元' }, { f: 'ret', l: '退休以后' }] }
};
function renderFixed(g) {
  const box = D.querySelector(`[data-fixed="${g}"]`); if (!box) return;
  const cols = FIXED[g].cols;
  const cell = (d, c) => {
    const a = f => `data-g="${g}" data-row="${d.k}" data-f="${f}"`, v = st[g][d.k];
    if (c.f === 'ret') return d.custom ? `<td data-l="${c.l}"><select class="field" ${a('work')}><option value="1"${workOf(d) ? ' selected' : ''}>停</option><option value="0"${workOf(d) ? '' : ' selected'}>照常</option></select></td>` : `<td data-l="${c.l}" class="s">${d.work ? '停' : '照常'}</td>`;
    if (c.f === 'need') { const on = needOf(d); return `<td data-l="${c.l}"><select class="field" ${a('need')}><option value="1"${on ? ' selected' : ''}>还要付</option><option value="0"${on ? '' : ' selected'}>可以停</option></select></td>` }
    if (c.f === 'x') return d.x ? `<td data-l="${d.xl}">${numIn(a(d.x), v[d.x], d.xl)}${d.x2 ? `<div class="in x2">${numIn(a(d.x2), v[d.x2], d.xl2)}<span class="u">年</span></div>` : ''}</td>` : `<td class="na" data-l="">　</td>`;
    if (d.auto && c.f === 'amt') return `<td data-l="${c.l}">${numIn(a('amt'), v.amt, r2(d.auto()), 'auto')}</td>`;
    return `<td data-l="${c.l}">${numIn(a(c.f), v[c.f], c.ph ? c.ph(d) : undefined)}</td>`;
  };
  const defs = defsOf(g), nc = cols.length + 1;
  const addRow = sg => `<tr class="addr"><td colspan="${nc}"><button type="button" class="add lk" data-addfx="${g}"${sg ? ` data-sg="${sg}"` : ''}>+ 添加一项</button></td></tr>`;
  const nameCell = d => `<td class="ty"><div class="un"><input class="field" type="text" data-g="${g}" data-row="${d.k}" data-f="name" value="${esc(st[g][d.k].name)}" placeholder="写上是什么"><button type="button" class="del" data-delfx="${g}" data-row="${d.k}" aria-label="删掉这一行">×</button></div></td>`;
  box.innerHTML = `<table class="tb ed fx"><thead><tr><th>类型</th>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr></thead><tbody>${defs.map((d, i) => `${d.sg && (i === 0 || defs[i - 1].sg !== d.sg) ? `<tr class="sg"><td colspan="${nc}">${SG[d.sg]}</td></tr>` : ''}<tr>${d.custom ? nameCell(d) : typeCell(d)}${cols.map(c => cell(d, c)).join('')}</tr>${d.sg && (i === defs.length - 1 || defs[i + 1].sg !== d.sg) ? addRow(d.sg) : ''}`).join('')}${g === 'inv' ? '' : addRow()}</tbody></table>`;
}
/* 可增减的表：家庭成员、计划 */
const LISTS = {
  members: { add: () => member({}), label: '添加一位家庭成员', cols: [
    { f: 'name', l: '称呼', t: 'text', ph: '比如：我' }, { f: 'role', l: '角色', t: 'sel', o: ROLE }, { f: 'age', l: '年龄', t: 'num' }] },
  plans: { add: () => ({ use: 'other', kind: 'once', year: YEAR + 1, years: 1, amt: '', sure: '1', item: '' }), label: '添加一件事', empty: '比如换车、装修、孩子上大学。没有就空着。', cols: [
    { f: 'item', l: '事项', t: 'text', ph: '比如：换车' }, { f: 'use', l: '用途', t: 'sel', o: USE },
    { f: 'kind', l: '类型', t: 'sel', o: [['once', '一次性支出'], ['exp', '每年一笔支出'], ['inc', '每年一笔收入']] },
    { f: 'year', l: '从哪一年', t: 'num' }, { f: 'years', l: '持续几年', t: 'num' }, { f: 'amt', l: '每次 万元', t: 'num' },
    { f: 'sure', l: '确定吗', t: 'sel', o: [['1', '确定'], ['0', '还不确定']] }] }
};
function cell(list, i, c, v) {
  const a = `data-list="${list}" data-i="${i}" data-f="${c.f}"`;
  if (c.t === 'sel') return `<select class="field" ${a}>${c.o.map(([k, l]) => `<option value="${k}"${String(v) === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  if (c.t === 'cb') return `<input type="checkbox" ${a}${v ? ' checked' : ''} aria-label="${c.l}">`;
  if (c.t === 'ro') return `<span class="ro">${esc(v)}</span>`;
  return `<input class="field" type="text"${c.t === 'num' ? ' inputmode="decimal"' : ''} ${a} value="${esc(v)}"${c.ph ? ` placeholder="${c.ph}"` : ''}>`;
}
function table(name, cols, rows, del, idx) {
  const head = cols.map(c => `<th${c.t === 'cb' ? ' class="c"' : ''}>${c.l}</th>`).join('') + (del ? '<th></th>' : '');
  const body = rows.map((r, j) => { const i = idx ? idx[j] : j; return `<tr>${cols.map(c => `<td data-l="${c.l}"${c.t === 'cb' ? ' class="c"' : ''}>${cell(name, i, c, c.t === 'ro' ? c.v(r) : r[c.f])}</td>`).join('')}${del ? `<td class="x"><button type="button" class="del" data-del="${name}" data-i="${i}" aria-label="删除这一行">×</button></td>` : ''}</tr>` }).join('');
  return `<table class="tb ed"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function renderList(name) {
  const L = LISTS[name], box = D.querySelector(`div[data-list="${name}"]`); if (!box) return;
  const rows = st[name];
  box.innerHTML = (rows.length ? table(name, L.cols, rows, true) : (L.empty ? `<p class="n0">${L.empty}</p>` : '')) + `<button type="button" class="add lk" data-addrow="${name}">+ ${L.label}</button>`;
}
/* 按人列的两张表：收入（04）、保障（07），人从 01 带过来 */
const who = r => `${r.name || '—'}（${ROLEN[r.role] || ''}）`;
function renderIncTable() {
  const box = D.querySelector('[data-out="inctable"]'); if (!box) return;
  const idx = st.members.map((m, i) => i).filter(i => st.members[i].role !== 'child');
  if (!idx.length) { box.innerHTML = '<p class="n0">先在「家庭成员」里把大人加上。</p>'; return }
  const cols = [{ f: 'name', l: '家庭成员', t: 'ro', v: who }, { f: 'income', l: '税后工资和奖金 万元 / 年', t: 'num', ph: '没有就空着' },
    { f: 'itype', l: '收入稳不稳', t: 'sel', o: [['stable', '稳定'], ['vol', '波动大'], ['mkt', '波动大，跟着股市涨跌']] }];
  box.innerHTML = table('members', cols, idx.map(i => st.members[i]), false, idx);
}
function renderInsTable() {
  const box = D.querySelector('[data-out="instable"]'); if (!box) return;
  if (!st.members.length) { box.innerHTML = '<p class="n0">先在「家庭成员」里把人加上。</p>'; return }
  const cols = [{ f: 'name', l: '家庭成员', t: 'ro', v: who }, ...INS.map(([f, l]) => ({ f, l, t: 'cb' })),
    { f: 'life', l: '已有寿险 万元', t: 'num' }, { f: 'ci', l: '已有重疾 万元', t: 'num' }];
  box.innerHTML = table('members', cols, st.members, false);
}
function renderRiskQ() {
  const box = D.querySelector('[data-riskq]'); if (!box) return;
  box.innerHTML = RISK.map((q, i) => `<fieldset class="rq"><legend><span class="lb">${i + 1}</span>${q.q}</legend>${q.note ? `<p class="s">${q.note}</p>` : ''}
    <div class="ro2">${q.o.map(([v, l]) => `<label class="cb"><input type="radio" name="risk-${q.k}" value="${v}" data-risk="${q.k}"${st.risk[q.k] === v ? ' checked' : ''}>${l}</label>`).join('')}</div></fieldset>`).join('');
}

/* ── 计算 ── */
function riskOf() {
  const a = st.risk, pts = { q1: { 0: 0, 1: 1, 2: 2, 3: 3 }, q2: { n: 1, 0: 0, 2: 2, 3: 3 }, q3: { 0: 0, 1: 1, 2: 2, 3: 3 }, q4: { z: 0, 1: 1, 2: 2, 3: 3 } };
  const done = RISK.every(q => a[q.k] !== undefined && a[q.k] !== '');
  const score = sum(RISK, q => pts[q.k][a[q.k]] || 0);
  const capped = a.q1 === '0' || a.q1 === '1' || a.q2 === 'n' || a.q2 === '0', zero = a.q4 === 'z';
  let sugg = !done ? '' : score <= 4 ? 'cons' : score <= 8 ? 'std' : 'aggr';
  if (done && capped && sugg === 'aggr') sugg = 'std';
  if (done && zero) sugg = 'cons';
  return { done, score, capped, zero, sugg };
}
function calc() {
  const r = {};
  r.risk = riskOf();
  r.tk = TIER[st.tier] ? st.tier : (r.risk.sugg || 'std');
  const T = r.T = TIER[r.tk];
  /* 资产 */
  const byCls = (g, defs, cls) => sum(defs.filter(d => d.cls === cls), d => amt(g, d.k));
  const dC = defsOf('cash'), dI = defsOf('inv'), dL = defsOf('ill');
  r.L = byCls('cash', dC, 'L'); r.S = byCls('inv', dI, 'S');
  r.K = byCls('inv', dI, 'K'); r.G = byCls('inv', dI, 'G'); r.X = byCls('inv', dI, 'X');
  r.F = r.L + r.S + r.K + r.G + r.X;
  r.U = has(st.usdAmt) ? n(st.usdAmt) : amt('inv', 'os'); /* 美元资产：问卷里单问一个合计，预填海外股票和 ETF */
  r.interest = amt('inc', 'int'); /* 收入表里的一行：预填按资产算的数，可以改 */
  r.retY = sum(dC, d => amt('cash', d.k) * rateOf('cash', d) / 100) + sum(dI, d => amt('inv', d.k) * rateOf('inv', d) / 100); r.ret = r.F > 0 ? r.retY / r.F : NaN;
  r.vHome = amt('ill', 'home') * .9; r.vInv = amt('ill', 'invh') * .9; r.V = r.vHome + r.vInv;
  r.C = amt('ill', 'car'); r.R = byCls('ill', dL, 'R'); r.PE = byCls('ill', dL, 'PE'); r.O = byCls('ill', dL, 'O');
  r.rent = n(st.ill.invh.inc); r.assetInc = amt('inc', 'ainc');
  r.lentAmt = amt('ill', 'lent'); r.lentInc = n(st.ill.lent.inc); r.lentBack = has(st.ill.lent.back) ? Math.round(n(st.ill.lent.back)) : 0;
  r.savPrem = n(st.ill.sav.prem);
  /* 人和收入 */
  const adults = st.members.filter(m => m.role === 'main' || m.role === 'adult');
  const earners = st.members.filter(m => n(m.income) > 0);
  r.adults = adults; r.earners = earners;
  const aged = adults.filter(m => has(m.age));
  r.ageAuto = aged.length ? sum(aged, m => n(m.age)) / aged.length : 0;
  r.age = Math.round(has(st.ageOverride) ? n(st.ageOverride) : r.ageAuto);
  r.wage = sum(st.members, m => n(m.income));
  const extraInc = defsOf('inc').filter(d => d.custom);
  r.work = r.wage + amt('inc', 'side') + sum(extraInc.filter(workOf), d => amt('inc', d.k));
  r.passive = amt('inc', 'pas') + r.assetInc + sum(extraInc.filter(d => !workOf(d)), d => amt('inc', d.k));
  r.inc = r.work + r.passive + r.interest;
  /* 负债：按月还的，月还款都进支出 */
  const debts = defsOf('debt').map(d => ({ ...d, bal: n(st.debt[d.k].bal), rate: n(st.debt[d.k].rate), pay: n(st.debt[d.k].pay) }));
  r.debtList = debts.filter(d => d.bal > 0 || d.pay > 0);
  r.payAuto = sum(debts, d => d.pay) * 12; r.payY = amt('exp', 'loan'); /* 支出表里的一行：预填负债的月还款，可以改 */
  r.high = debts.filter(d => d.rate > 6 && d.bal > 0);
  r.mid = debts.filter(d => d.rate >= 3 && d.rate <= 6 && d.bal > 0 && !d.home);
  r.H = sum(r.high, d => d.bal); r.Dt = sum(debts, d => d.bal); r.pay = sum(debts, d => d.pay);
  r.mortBal = sum(debts.filter(d => d.home), d => d.bal);
  r.debts = debts.filter(d => d.pay > 0).map(d => d.bal > 0 ? d : { ...d, bal: Infinity }).map(d => { const i = d.rate / 1200, P = d.pay, B = d.bal; const m = i > 0 ? (B * i < P ? -Math.log(1 - B * i / P) / Math.log(1 + i) : Infinity) : B / P; return { ...d, years: m / 12 } });
  /* 支出 */
  const dE = defsOf('exp');
  r.exp = sum(dE, d => amt('exp', d.k));
  r.needY = sum(dE.filter(needOf), d => amt('exp', d.k)); /* 「收入断了」那一列，用户可以改 */
  r.M = (r.needY + r.savPrem) / 12; /* 每月必需流出：必需支出 + 储蓄型保费（AFP 口径） */
  r.surplus = r.inc - r.exp;
  r.freeSave = r.surplus - r.savPrem;
  /* 还掉的贷款本金算存下来（《账本 01》总储蓄率、AFP 储蓄率）：一年的月还款减去按现在余额算的利息 */
  r.principal = sum(debts.filter(d => d.pay > 0 && d.bal > 0), d => clamp(d.pay * 12 - d.bal * d.rate / 100, 0, d.bal));
  r.saveTot = r.surplus + r.principal;
  r.saveR = r.inc > 0 ? r.saveTot / r.inc : NaN; r.freeR = r.inc > 0 ? r.freeSave / r.inc : NaN;
  r.eduRow = amt('exp', 'edu'); r.prem = amt('exp', 'prem'); r.once = amt('exp', 'once');
  /* 计划：五年内要花的进稳钱 */
  r.plans = st.plans.map(p => ({ ...p, year: n(p.year), years: Math.max(1, Math.round(nv(p.years, 1))), amt: n(p.amt) }));
  r.W = 0; r.later = []; r.usdLow = 0; r.usdFar = 0; r.eduFund = 0; r.careFund = 0;
  r.plans.filter(p => p.kind !== 'inc').forEach(p => {
    const yrs = p.kind === 'once' ? 1 : p.years, abroad = p.use === 'eduA' || p.use === 'abroad';
    for (let k = 0; k < yrs; k++) {
      const y = p.year + k;
      if (y >= YEAR && y - YEAR <= 5) r.W += p.amt; else if (y - YEAR > 5 && !r.later.includes(p)) r.later.push(p);
      if (abroad) { if (p.sure === '1' && y - YEAR <= 3) r.usdLow += p.amt; else r.usdFar += p.amt }
    }
    if (p.use === 'edu' || p.use === 'eduA') r.eduFund += p.amt * yrs;
    if (p.use === 'care') r.careFund += p.kind === 'once' ? p.amt : p.amt * factor(yrs);
  });
  r.W = Math.max(0, r.W); r.hasBills = r.usdLow + r.usdFar > 0;
  /* 应急金和分账户 */
  r.months = has(st.months) ? n(st.months) : T.range[1];
  r.E = r.months * r.M;
  let rest = r.F;
  r.aL = Math.min(rest, r.E); rest -= r.aL; r.aH = Math.min(rest, r.H); rest -= r.aH; r.aS = Math.min(rest, r.W); rest -= r.aS;
  r.long = Math.max(0, rest);
  r.short = (r.E - r.aL) + (r.H - r.aH) + (r.W - r.aS);
  r.nowLong = r.K + r.G + r.X;
  r.lowNeed = r.E + r.H + r.W; r.lowNow = r.L + r.S; r.lowGap = r.lowNeed - r.lowNow;
  /* 股票 */
  r.base = 100 - r.age; r.s = clamp(r.base + T.adj, 0, 100);
  r.stock = r.s / 100 * r.long; r.dd = r.stock * .5; r.curDD = r.K * .5;
  r.shortPct = n(st.shortStock); r.shortCost = r.W * r.shortPct / 100 * .5;
  /* 黄金、加密 */
  r.goldCapPct = n(st.goldLoss) / 50; r.goldCap = r.F * r.goldCapPct;
  r.cryptoCapPct = n(st.cryptoLoss) / 80; r.cryptoCap = r.F * r.cryptoCapPct;
  /* 房子与净资产 */
  r.netProp = r.V - r.mortBal;
  r.TA = r.F + r.R + r.PE + r.O + r.V + r.C; r.NW = r.TA - r.Dt;
  r.monInc = r.inc / 12; r.debtRatio = r.monInc > 0 ? r.pay / r.monInc : NaN;
  r.conc = r.V > 0 && r.NW > 0 ? r.netProp / r.NW : NaN;
  r.lev = r.V > 0 && r.netProp > 0 ? r.V / r.netProp : NaN;
  r.drop20 = r.V > 0 && r.NW > 0 ? .2 * r.V / r.NW : NaN;
  r.reFin = has(st.reFin) ? n(st.reFin) : (amt('inv', 'stk') + amt('inv', 'sf')) * RE_W; r.reDup = r.F > 0 ? r.reFin / r.F : NaN;
  r.peShare = r.PE > 0 && r.NW > 0 ? r.PE / r.NW : NaN;
  r.riskShare = r.NW > 0 ? (r.K + r.X + r.PE + Math.max(0, r.netProp)) / r.NW : NaN;
  r.savR = r.inc > 0 ? r.savPrem / r.inc : NaN;
  const filled = g => Object.values(st[g]).some(o => has(o.amt));
  r.missing = [];
  if (!(r.age > 0)) r.missing.push('大人的年龄');
  if (!(r.work + r.passive > 0)) r.missing.push('收入');
  if (!(sum(defsOf('exp').filter(d => !d.auto), d => amt('exp', d.k)) > 0)) r.missing.push('每年的支出');
  if (!['cash', 'inv', 'ill'].some(filled)) r.missing.push('资产');
  /* 保障 */
  r.miss = st.members.map(m => ({ m, lack: (NEED[m.role] || []).filter(k => !m[k]) }));
  r.insGap = r.miss.some(x => x.lack.length);
  const kids = st.members.filter(m => m.role === 'child' && has(m.age));
  r.kidYears = kids.length ? Math.max(0, 22 - Math.min(...kids.map(m => n(m.age)))) : 0;
  r.edu = r.eduFund; r.care = r.careFund;
  r.expEx = Math.max(0, r.exp - r.payY - r.once); /* 以后每年都有的支出：负债另外算进保额，过去一年的一次性支出不会每年都有 */
  r.funeral = r.expEx * .5;
  r.assetsAfterE = Math.max(0, r.F - r.E);
  const nPeople = Math.max(1, st.members.length), wageSum = Math.max(0, r.wage);
  r.ins = st.members.map(m => {
    const inc = n(m.income), o = { m, inc };
    if ((m.role === 'main' || m.role === 'adult') && inc > 0) {
      const others = wageSum - inc;
      o.gapDef = Math.max(0, r.expEx - r.expEx / nPeople - others * .5);
      o.gap = has(m.gap) ? n(m.gap) : o.gapDef;
      o.gapYears = has(m.gapYears) ? n(m.gapYears) : r.kidYears;
      o.f = factor(o.gapYears);
      if (m.role === 'main') { o.share = 1; o.debt = r.Dt; o.eduPart = r.edu; o.carePart = r.care; o.minus = r.assetsAfterE }
      else { o.share = wageSum > 0 ? inc / wageSum : 0; o.debt = r.Dt * o.share; o.eduPart = 0; o.carePart = 0; o.minus = 0 }
      o.lifeNeed = Math.max(0, o.debt + r.funeral + o.eduPart + o.gap * o.f + o.carePart - o.minus);
      o.lifeGap = Math.max(0, o.lifeNeed - n(m.life));
      o.ciNeed = inc * .7 * 3 + 10 + 10;
      o.ciGap = Math.max(0, o.ciNeed - n(m.ci));
    } else if (m.role === 'child') { o.kid = true }
    return o;
  });
  /* 没人靠他的收入生活、也没有负债的，算出来寿险需要是 0，就不算缺定期寿险 */
  r.miss.forEach(x => { const o = r.ins.find(z => z.m === x.m); if (o && o.lifeNeed !== undefined && o.lifeNeed <= .05) x.lack = x.lack.filter(k => k !== 'sx') });
  r.insGap = r.miss.some(x => x.lack.length);
  /* 能不能承受：从前面的数算，只提醒 */
  const er = [], sr = [];
  if (earners.some(m => m.itype !== 'stable')) er.push('收入波动大');
  if (earners.length === 1) er.push('一个人挣钱养家');
  if (st.shrinking) er.push('所在行业正在收缩');
  if (st.members.some(m => m.role === 'child' || m.role === 'elder')) er.push('要照顾老人或孩子');
  if (r.insGap) er.push('保障还没配齐');
  if (r.mortBal > 0) er.push('有房贷');
  if (earners.some(m => m.itype === 'mkt')) sr.push('收入跟着股市涨跌');
  if (r.conc > .7) sr.push('房产净值占净资产七成以上');
  if (r.lev > 2) sr.push('房产杠杆超过 2 倍');
  if (r.debtRatio > .4) sr.push('债务月还款超过收入的四成');
  if (r.peShare > .2) sr.push('股权投资占净资产两成以上');
  r.er = er; r.sr = sr;
  /* 财务自由 */
  r.wr = nv(st.wr, 3.5) / 100;
  r.fi = r.wr > 0 ? Math.max(0, r.expEx - r.passive) / r.wr : 0; /* 《账本 04》：每年支出按退休后的样子估，那时贷款已经还完，一次性支出也不算 */
  r.longTotal = r.long + r.R;
  r.prog = r.fi > 0 ? r.longTotal / r.fi : NaN;
  /* 阶段 */
  r.stages = [
    { name: '财务摸底', slug: 'ledger-sheets', note: '看清家底，堵住漏洞',
      reads: [['ledger-sheets', '账本 01｜家庭财务三张表', '先把家底和一年的收支记清楚'], ['wealth-savings', '财富观 03｜储蓄率比收益率更重要', '起步阶段，多存一点比多赚一点有用'], ['wealth-lifestyle', '财富观 05｜生活方式膨胀', '收入涨了，结余为什么没涨'], ['ledger-debt', '账本 03｜负债利率和投资收益怎么比', '消费贷和信用卡先还哪个']],
      acts: ['按过去 12 个月把收支记清楚，分出「要付」和「可以停」', '从可以停的支出里先砍一项，让每年有结余', '还掉年化超过 6% 的负债', '在随时能取的地方先攒够一个月的必需支出'], conds: [[r.surplus > 0, '每年有结余'], [r.H === 0, '没有年化超过 6% 的负债'], [r.M > 0 && r.L / r.M >= 1, '随时能取的钱够一个月的必需支出']] },
    { name: '安全筑基', slug: 'ledger-buckets', note: '应急金、保障和五年内要花的钱都备好',
      reads: [['ledger-buckets', '账本 02｜家庭资金分四个账户', '按什么时候要用，把钱分开'], ['shield-order', '保障 02｜保险的配置顺序', '先保障后储蓄，先大人后孩子'], ['shield-amount', '保障 03｜保额怎么算', '寿险和重疾险该买多少'], ['wealth-ruin', '财富观 04｜杠杆与破产风险', '先保证不出局']],
      acts: ['应急金补到你选的月数', '按家人逐个配齐基础保障，保额照报告里的缺口补', '五年内要花的钱，按年份放进对应到期的定期或国债', '设一个发薪日自动转账，让钱自己往下流'], conds: [[!r.insGap && st.members.length > 0, '每个人的基础保障配齐'], [r.lowGap <= .05, '应急金和五年内要花的钱都备好了']] },
    { name: '积累增长', slug: 'alloc-ratio', note: '长钱按比例投出去，靠储蓄和时间慢慢攒',
      reads: [['alloc-ratio', '配置 04｜股债比例怎么定', '长钱里股票放多少'], ['alloc-why', '配置 01｜资产配置为什么排在选股前面', '组合的起伏主要来自大类比例'], ['return-fees', '收益 04｜费用的复利', '1% 的费率三十年会吃掉多少'], ['behave-timing', '行为 02｜择时有多难', '一次性投入还是定投'], ['behave-ips', '行为 05｜投资政策书', '一页纸写下自己的规则']],
      acts: ['按报告里的股票比例，把长钱分几个月投出去', '写好投资政策书，和家人一起签字', '每月发薪后自动定投，不看短期涨跌', '每年复核一次比例和保额'], conds: [[r.prog >= 1, '长期的钱达到财务自由数字，不必再为钱工作']] },
    { name: '配置管理', slug: 'alloc-rebalance', note: '工作变成选择，重点从攒钱转向管好比例、再平衡和币种',
      reads: [['alloc-rebalance', '配置 07｜再平衡', '定期检查，超出范围才动手'], ['alloc-correlation', '配置 03｜分散化与相关性', '危机时分散为什么会暂时失灵'], ['global-usd', '全球 01｜为什么要配置美元资产', '账单币种和汇率风险'], ['tool-gold', '工具 06｜黄金的作用', '一份应对极端风险的保险'], ['ledger-goals', '账本 04｜财务自由需要多少钱', '提取率要往下留余地']],
      acts: ['按投资政策书的规则定期检查，偏离超出范围就再平衡', '看看币种和市场是不是太集中在一处', '按 3% 到 3.5% 的提取率规划每年取多少', '少放和收入、房子同一个方向的风险'], conds: [[r.prog >= 5, '长期的钱达到财务自由数字的 5 倍，够几代人用']] },
    { name: '家族传承', slug: 'legacy-tools', note: '钱已经超出自己一代的需要，重点转向税务、传承和下一代',
      reads: [['legacy-tools', '传承 05｜家族信托、保险金信托与遗嘱', '传承工具怎么选'], ['legacy-residency', '传承 02｜税收居民怎么判定', '183 天与双重居民'], ['legacy-crs', '传承 01｜CRS 是什么', '海外账户信息怎样交换回国内'], ['legacy-income', '传承 03｜境外所得怎么交个税', '税率、抵免与申报'], ['global-tax', '全球 03｜持有美股的美国税', '股息预扣与遗产税']],
      acts: ['把产权、受益人和每个账户的位置梳理清楚', '了解跨境资产的税务和申报', '比较家族信托、保险金信托和遗嘱，选适合自己的', '和家人一起写下对这笔钱的想法'], conds: [] }];
  r.stage = r.stages.findIndex(s => s.conds.some(c => !c[0])); if (r.stage < 0) r.stage = 4;
  /* 投资政策书 */
  r.tStockDef = r.F > 0 ? Math.round(r.stock / r.F * 100) : 0;
  r.tStock = has(st.tStock) ? n(st.tStock) : r.tStockDef;
  r.tGold = n(st.tGold); r.tCrypto = n(st.tCrypto);
  r.tRest = 100 - r.tStock - r.tGold - r.tCrypto;
  return r;
}

/* ── 往后推 ── */
function simulate(r, kShift) {
  const age0 = r.age, end = Math.max(age0 + 1, Math.round(nv(st.endAge, 90))), retire = nv(st.retire, 60);
  const infl = nv(st.infl, 2) / 100, gs = nv(st.gs, 2) / 100, ge = nv(st.ge, 2) / 100;
  const growF = sum(defsOf('cash'), d => amt('cash', d.k) * rateOf('cash', d) / 100) + sum(defsOf('inv'), d => amt('inv', d.k) * (rateOf('inv', d) + (d.cls === 'K' ? kShift : 0)) / 100);
  const rF = r.F > 0 ? growF / r.F : R_RATE / 100, rR = R_RATE / 100;
  const A0 = r.F + r.R, rp = A0 > 0 ? (growF + r.R * rR) / A0 : rR;
  const pension = n(st.pension);
  /* 生活支出跟着涨：不含贷款月还款（金额固定，还完就停）和过去一年的一次性支出（不会每年都有） */
  const living0 = Math.max(0, r.exp - r.payY - r.once);
  let F = r.F, R = r.R, broke = null, merged = false;
  const out = [{ t: 0, age: age0, year: YEAR, A: A0, real: A0, inc: 0, exp: 0, ev: 0 }];
  for (let t = 1; t <= end - age0; t++) {
    const age = age0 + t, y = YEAR + t, pi = Math.pow(1 + infl, t), working = age < retire;
    const lentOff = r.lentBack && y > r.lentBack ? Math.min(r.lentInc, r.assetInc) : 0; /* 借出去的钱收回以后，利息停 */
    const inc = (working ? r.work * Math.pow(1 + gs, t) : 0) + (r.passive - lentOff) * pi + (working ? 0 : pension * pi);
    const living = Math.max(0, living0 - (r.kidYears > 0 && t > r.kidYears ? r.eduRow : 0)) * Math.pow(1 + ge, t);
    const loans = r.payAuto > 0 ? sum(r.debts, d => d.pay * 12 * clamp(d.years - (t - 1), 0, 1)) * r.payY / r.payAuto : r.payY;
    const exp = living + loans;
    /* 计划：今年还没花的，算在第一年 */
    let ev = 0;
    r.plans.forEach(p => { const yrs = p.kind === 'once' ? 1 : p.years, on = yy => yy >= p.year && yy < p.year + yrs, sign = p.kind === 'inc' ? 1 : -1;
      if (on(y)) ev += sign * p.amt * pi; if (t === 1 && on(YEAR)) ev += sign * p.amt });
    if (r.lentBack && t === Math.max(1, r.lentBack - YEAR)) ev += r.lentAmt; /* 借出去的钱：按填的年份收回，金额不随通胀变 */
    /* 受限资产（个人养老金、企业年金、储蓄险）退休前不能拿来付支出：单独增长，储蓄型保费存进去，退休那年并进来 */
    const sav = working ? r.savPrem : 0;
    F = F * (1 + rF) + inc - exp - sav + ev;
    R = R * (1 + rR) + sav;
    if (!working && !merged) { F += R; R = 0; merged = true }
    if (F < 0 && broke === null) broke = age;
    out.push({ t, age, year: y, A: F + R, real: (F + R) / pi, F, R, inc, exp, ev });
  }
  return { rows: out, rp, broke, retire };
}

/* ── 渲染 ── */
const out = (k, html) => D.querySelectorAll(`[data-out="${k}"]`).forEach(e => { e.innerHTML = html });
const ratioRow = (name, val, ref, bad) => `<tr><td>${name}</td><td class="num" data-l="你家">${val}</td><td data-l="参照">${ref}</td><td data-l="" class="num">${chk(bad)}</td></tr>`;

function render() {
  const keyOf = e => ['k', 'list', 'i', 'f', 'g', 'row'].map(a => e.dataset[a] ?? '').join('|');
  const ae = D.activeElement, isField = ae && ae.matches && ae.matches('input[type="text"],textarea,select');
  const key = isField ? keyOf(ae) : null, sel = isField && ae.type === 'text' ? [ae.selectionStart, ae.selectionEnd] : null;
  renderAll();
  if (key && !D.body.contains(ae)) { const el = [...D.querySelectorAll('input[type="text"],textarea,select')].find(e => keyOf(e) === key); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]) } catch (e) { } } }
}
function renderAll() {
  const r = calc(), M = r.M, sv = r.surplus;
  D.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.v === r.tk));
  D.querySelectorAll('input[name="tier"]').forEach(i => { i.checked = i.value === r.tk });
  const ready = !r.missing.length;

  /* 单位提醒 */
  const bigs = ['cash', 'inv', 'ill', 'exp'].flatMap(g => defsOf(g).filter(d => amt(g, d.k) >= 10000).map(d => [d.name, amt(g, d.k)]))
    .concat(st.members.filter(m => n(m.income) >= 10000).map(m => [`${m.name || '家庭成员'}的收入`, n(m.income)]));
  out('unitwarn', bigs.length ? `<p class="warn">${bigs.map(([l, v]) => `${esc(l)}填的是 ${v.toLocaleString('zh-CN')}，也就是 ${w(v)}元`).join('；')}。单位是万元，200 万元填 200，确认没有多填几个 0。</p>` : '');
  const gi = D.querySelector('[data-g="inv"][data-row="gold"][data-f="rate"]'); if (gi) gi.placeholder = nv(st.infl, 2);
  const ui = D.querySelector('[data-k="usdAmt"]'); if (ui) ui.placeholder = r2(amt('inv', 'os'));
  const ri = D.querySelector('[data-k="reFin"]'); if (ri) ri.placeholder = r2((amt('inv', 'stk') + amt('inv', 'sf')) * RE_W);
  D.querySelectorAll('.field.auto[data-g]').forEach(el => { const a = autoOf(el.dataset.g, el.dataset.row); if (a !== null) el.placeholder = r2(a) });
  out('assetsum', r.F > 0 ? `<p class="s" style="margin-top:14px">金融资产合计 ${w(r.F)}，按每一项的预期年化加权，约 ${pc(r.ret, 1)}。</p>` : '');
  /* 投资偏好：建议的档位 */
  const rk = r.risk, sugN = rk.sugg ? TIER[rk.sugg].name : '';
  let rs = rk.done ? `<p class="verdict sm">按你的回答，建议「${sugN}」</p><p class="s" style="margin-top:6px">四道题共 ${rk.score} 分：4 分以下保守，5 到 8 分标准，9 分以上激进。${rk.capped && rk.score > 8 ? '没有股票投资经验、没经历过大跌或大跌时卖过的，建议最多到标准。' : ''}</p>`
    : `<p class="s">四道题答完，这里会给出建议的档位。</p>`;
  if (rk.zero) rs += `<div class="tipb"><div class="lb">提醒</div><p>一分都不能亏的话，长钱里哪怕只放一成股票，也可能亏；完全不放，长期大概率跟不上通胀。报告里两种结果都会算给你看。</p></div>`;
  out('risksugg', rs);
  let tn = '';
  if (st.tier && rk.sugg && TORD.indexOf(st.tier) > TORD.indexOf(rk.sugg)) { const step = TORD.indexOf(st.tier) - TORD.indexOf(rk.sugg), more = r.long * step * .1;
    tn += `<p class="warn">你选了「${r.T.name}」，比建议的「${sugN}」激进：股票比例多 ${step * 10} 个百分点${r.long > .05 ? `，长钱里多放约 ${w(more)}股票，跌一半时多亏约 ${w(more * .5)}` : ''}；应急金从 ${TIER[rk.sugg].range.join('–')} 个月变成 ${r.T.range.join('–')} 个月。</p>` }
  if (r.tk !== 'cons' && (r.er.length || r.sr.length) && (r.tk === 'aggr' || (st.tier && rk.sugg && st.tier !== rk.sugg))) tn += `<p class="s" style="margin-top:10px">另外，你家有这几项会削弱承受起伏的能力：${[...r.er, ...r.sr].join('、')}。</p>`;
  if (!st.tier && rk.done) tn += `<p class="s" style="margin-top:10px">按下面四道题的回答，选的是「${sugN}」。</p>`;
  if (st.tier && rk.done && st.tier !== rk.sugg) tn += `<p class="s" style="margin-top:10px"><a class="lk" data-act="tierauto" href="#s-type">回到建议的档位</a></p>`;
  out('tiernote', tn);
  out('assume', `<p class="s" style="margin-top:14px">退休年龄 ${nv(st.retire, 60)} 岁、退休后每年的养老金 ${has(st.pension) ? w(n(st.pension)) : '没填，按 0 算'}，在问卷的「计划」里改；每一项资产的预期年化，在问卷的「资产」里改。</p>`);
  out('agewarn', r.age && (r.age < 18 || r.age > 90) ? `<p class="warn">按 ${r.age} 岁在算，确认一下年龄。</p>` : '');
  out('agehint', r.ageAuto ? `默认取家里大人的平均年龄：${Math.round(r.ageAuto)} 岁` : '默认取家里大人的平均年龄；「家庭成员」里还没填年龄');
  const ai = D.querySelector('[data-k="ageOverride"]'); if (ai) ai.placeholder = r.ageAuto ? Math.round(r.ageAuto) : '';

  /* 01 问卷最后：家底一览 */
  out('overview', ready ? `<dl class="kv">
      <dt>净资产</dt><dd><b>${w(r.NW)}</b>　总资产 ${w(r.TA)} − 负债 ${w(r.Dt)}</dd>
      <dt>每年</dt><dd>收入 ${w(r.inc)}，支出 ${w(r.exp)}，存下 <b>${w(r.saveTot)}</b></dd>
      <dt>每月必需流出</dt><dd>${w2(M)}（收入断了还要付的部分）</dd></dl>
      <p style="margin-top:32px" class="no-print"><a class="go" data-go="2">看体检报告</a></p>`
    : `<p class="n0">${r.missing.length < 4 ? `还缺：${r.missing.join('、')}。` : ''}填上收入、支出和现在的钱，这里会出一份体检报告。想先看看效果，可以点上面的「填入示例家庭」。</p>`);
  /* 附录里可以调的数 */
  const [mlo, mhi] = r.T.range;
  out('mhint', `「${r.T.name}」${mlo}–${mhi} 个月，默认取 ${mhi}；${Object.entries(TIER).filter(([k]) => k !== r.tk).map(([, t]) => `${t.name} ${t.range[0]}–${t.range[1]}`).join('，')}`);
  const mi = D.querySelector('[data-k="months"]'); if (mi) mi.placeholder = mhi;
  out('short', r.shortPct > 0 ? `<p class="warn">五年内要用的 ${w(r.W)}里放 ${r.shortPct}% 股票，约 ${w(r.W * r.shortPct / 100)}。如果用钱那年刚好跌一半，会少 ${w(r.shortCost)}。A 股一次大跌加上涨回来，常常要好几年：沪深 300 从 2021 年 2 月的高点跌到 2024 年 9 月的低点，就用了三年半。</p>` : '');
  /* 03 投资政策书 */
  out('ips2', ready ? `长钱 ${w(r.long)}${r.R > 0 ? `，加上受限资产 ${w(r.R)}` : ''}。不包括 ${mo(r.months)}的应急金 ${w(r.E)}、五年内要用的稳钱 ${w(r.W)}、保险和自住房${r.PE > 0 ? `；股权投资 ${w(r.PE)}单独看，不参与再平衡` : ''}。` : '填完前面的内容，这里会自动写上。');
  out('ips5', ready ? `股票部分最多可能跌一半，按现在的目标，账面会少约 ${w(r.tStock / 100 * r.F * .5)}${M > 0 ? `，相当于 ${mo(r.tStock / 100 * r.F * .5 / M)}的必需支出` : ''}。这是我事先就接受的。` : '填完前面的内容，这里会自动写上。');
  const ti = D.querySelector('[data-k="tStock"]'); if (ti) ti.placeholder = r.tStockDef;
  let i6 = `<p class="s" style="margin-top:10px">比例都按全部金融资产 ${w(r.F)}算，剩下的 ${Math.round(r.tRest)}% 是现金和债券类。股票类默认 ${r.tStockDef}%，就是长钱里的 ${w(r.stock)}。</p>`;
  if (r.tGold > r.goldCapPct * 100 + .01) i6 += `<p class="warn">黄金 ${r.tGold}% 超过了你算出的上限 ${pc(r.goldCapPct)}。</p>`;
  if (r.tCrypto > r.cryptoCapPct * 100 + .01) i6 += `<p class="warn">加密资产 ${r.tCrypto}% 超过了你算出的上限 ${pc(r.cryptoCapPct, 1)}。</p>`;
  if (r.tRest < 0) i6 += `<p class="warn">加起来超过了 100%。</p>`;
  if (has(st.tStock) && n(st.tStock) > r.tStockDef + .5 && ready) i6 += `<p class="warn">比按方法算出的 ${r.tStockDef}% 高。跌一半时会少 ${w(n(st.tStock) / 100 * r.F * .5)}，先确认自己拿得住。</p>`;
  out('ips6', i6);
  const g = r.tGold, band = g > 0 ? `，黄金 ${Math.round(g * .8 * 10) / 10}% 到 ${Math.round(g * 1.2 * 10) / 10}%` : '';
  out('ips9', `每年 ${st.ipsMonth} 月检查一次。股票类在 ${Math.max(0, r.tStock - 5)}% 到 ${Math.min(100, r.tStock + 5)}% 之间不动${band}${r.tCrypto > 0 ? `，加密资产超过目标的 1.5 倍（${Math.round(r.tCrypto * 1.5 * 10) / 10}%）就卖回目标` : ''}；超出范围才再平衡，调回目标。资金顺序：新存下的钱 → 分红和利息 → 最后才卖出超配的部分。${ART('alloc-rebalance', '见《配置 07》')}`);

  renderReport(r, ready);
}


/* ── 体检报告 ── */
/* 顺序：总评 → 资产总览 → 阶段 → 五层体检 → 钱该怎么放 → 行动清单 → 保存和分享；设计见 体检报告-设计.md */
const FID = [[22, 0], [30, 1], [40, 3], [50, 6], [60, 8], [67, 10]]; /* Fidelity 按年龄的储蓄倍数 */
const fidelity = a => { if (a <= 22) return 0; if (a >= 67) return 10; for (let i = 1; i < FID.length; i++) { const [a1, v1] = FID[i - 1], [a2, v2] = FID[i]; if (a <= a2) return v1 + (v2 - v1) * (a - a1) / (a2 - a1) } return 10 };
const freeBand = a => a < 30 ? [5, 15] : a < 40 ? [15, 30] : a < 50 ? [30, 50] : [50, 100]; /* AFP 培训口径：财务自由度按年龄 */
const LVN = ['稳', '留意', '先处理'];
const tag = l => `<span class="tag l${l === null ? 0 : l}">${l === null ? '未填' : LVN[l]}</span>`;
const x1 = v => isFinite(v) ? (Math.round(v * 10) / 10) + ' 倍' : '—';
const SHARE_URL = 'https://longarcsociety.com/tools/checkup'; /* 分享图上的二维码 */
/* 五层从下往上，下面一层是上面一层的地基 */
const LAYER = { shield: ['风险保障', 'PROTECTION'], em: ['流动储备', 'LIQUIDITY'], debt: ['债务管理', 'DEBT'], flow: ['收支结余', 'SAVINGS'], long: ['财富积累', 'GROWTH'] };
let layerSel = null, stagePeek = null, card0 = null, qrSvg = null;
const openHow = new Set();
D.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details[data-key]')) { if (d.open) openHow.add(d.dataset.key); else openHow.delete(d.dataset.key) } }, true);
const how = (key, t, body) => `<details class="how" data-key="${key}"${openHow.has(key) ? ' open' : ''}><summary>${t}</summary><div>${body}</div></details>`;
const pw = (x, m) => m > 0 ? clamp(x / m * 100, 0, 100) : 0;
const seg = (items, max) => { const its = items.filter(x => x[1] > .005), tot = sum(its, x => x[1]); return `<div class="t" style="width:${its.length ? Math.max(1, pw(tot, max)) : 0}%">${its.map(x => `<i style="flex:${x[1]};background:var(--${x[2]})${x[3] ? `;opacity:${x[3]}` : ''}" title="${x[0]} ${w(x[1])}"></i>`).join('')}</div>` };
const legend = (items, total) => `<ul class="lg">${items.filter(x => x[1] > .005).map(x => `<li><b style="background:var(--${x[2]})${x[3] ? `;opacity:${x[3]}` : ''}"></b><span>${x[0]}</span><span>${x[4] || `${w(x[1])}${total > 0 ? ` · ${pc(x[1] / total)}` : ''}`}</span></li>`).join('')}</ul>`;
const cnShare = s => s >= .95 ? '几乎全部' : s >= .1 ? `${'一二三四五六七八九'[Math.floor(s * 10) - 1]}成多` : '';
const big = s => String(s).replace(/ (万|亿|岁|个月)$/, '<small>$1</small>');
const gauge = (val, max, marks, ticks, fmt) => `<div class="ga"><div class="gt"><i style="width:${pw(Math.max(0, val), max)}%"></i></div>${marks.map(([x, l]) => `<div class="mk" style="left:${pw(x, max)}%"><span>${l}</span></div>`).join('')}${ticks.map((x, i) => `<div class="tk${i === 0 ? ' z' : i === ticks.length - 1 ? ' e' : ''}" style="left:${pw(x, max)}%">${fmt(x)}</div>`).join('')}</div>`;
const gline = (l, val, max, mk, mkl, op) => `<div class="gl"><div class="k">${l}</div><div class="gt"><i style="width:${pw(Math.max(0, val), max)}%${op ? `;opacity:${op}` : ''}"></i><b style="left:${pw(mk, max)}%"><span>${mkl}</span></b></div><div class="v num">${pc(val)}</div></div>`;
const nm2 = m => esc(m.name || ROLEN[m.role] || '家人');

function renderReport(r, ready) {
  if (!ready) {
    const msg = `<p class="n0">还缺：${r.missing.join('、')}。补上以后这里才出结论，缺着算出来的数会误导。<a class="lk" data-go="1" href="#m1" style="margin-left:8px">回到问卷</a></p>`;
    ['verdict', 'balance', 'stage', 'layers', 'alloc', 'actions', 'ratios', 'bench', 'simtable'].forEach(k => out(k, msg));
    out('rmeta', ''); card0 = null; renderCard(); return;
  }
  const M = r.M, d0 = new Date();
  const who = st.members.filter(m => m.name || has(m.age)).map(m => `${nm2(m)}${has(m.age) ? ` ${n(m.age)} 岁` : ''}`).join('、');
  out('rmeta', `${who ? who + ' · ' : ''}${d0.getFullYear()} 年 ${d0.getMonth() + 1} 月 ${d0.getDate()} 日 · 单位万元，按今天的钱`);
  const lo = simulate(r, -2.5), mid = simulate(r, 0), hi = simulate(r, 2.5);
  const lastAge = mid.rows[mid.rows.length - 1].age;

  /* 五层：每层一个状态（稳 / 留意 / 先处理）、一个数、一条做法 */
  const emNow = M > 0 ? r.L / M : NaN;
  const prem = r.prem, premR = r.work > 0 ? prem / r.work : NaN;
  const mult = r.work > 0 ? r.longTotal / r.work : NaN, bench = fidelity(r.age);
  const free = r.exp > 0 ? (r.passive + r.interest) / r.exp : NaN, fb = freeBand(r.age);
  const earnerLack = r.miss.filter(x => x.lack.length && n(x.m.income) > 0), otherLack = r.miss.filter(x => x.lack.length && !(n(x.m.income) > 0));
  const gaps = r.ins.filter(o => (o.lifeGap || 0) > .05 || (o.ciGap || 0) > .05);
  const lifeGapSum = sum(r.ins, o => o.lifeGap || 0), ciGapSum = sum(r.ins, o => o.ciGap || 0);
  const dims = {};
  if (!st.members.length) dims.shield = { lvl: null, m: '还没填家庭成员', mm: '', c: '「家庭成员」还没填', fix: '' };
  else {
    const lvl = earnerLack.length ? 2 : (otherLack.length || gaps.length ? 1 : 0);
    const lackTxt = r.miss.filter(x => x.lack.length).map(x => `${nm2(x.m)}缺${x.lack.map(k => INSN[k]).join('、')}`).join('；');
    const gapTxt = [lifeGapSum > .05 && `寿险缺约 ${w(lifeGapSum)}`, ciGapSum > .05 && `重疾险缺约 ${w(ciGapSum)}`].filter(Boolean).join('，');
    dims.shield = { lvl, m: earnerLack.length ? `${nm2(earnerLack[0].m)}缺${INSN[earnerLack[0].lack[0]]}` : gaps.length ? '保额还不够' : '险种和保额都够',
      mm: gapTxt || '保额够', c: [lackTxt, gapTxt && `全家${gapTxt}`].filter(Boolean).join('；') || '基础险种齐了，保额也够',
      fix: earnerLack.length ? `给${earnerLack.map(x => `${nm2(x.m)}补上${x.lack.map(k => INSN[k]).join('、')}`).join('，')}。` : gaps.length ? '把保额补到够。' : `给${otherLack.map(x => nm2(x.m)).join('、')}补上基础险种。` };
  }
  dims.em = { lvl: emNow >= r.months ? 0 : emNow >= 1 ? 1 : 2, m: `能撑 ${mo(emNow)}`, mm: r.L + .05 < r.E ? `还差 ${w(r.E - r.L)}` : '够了',
    c: `流动性资产能撑 ${mo(emNow)}，目标 ${mo(r.months)}${r.L + .05 < r.E ? `，还差 ${w(r.E - r.L)}` : ''}`,
    fix: `活期和货币基金补到 ${w(r.E)}，还差 ${w(Math.max(0, r.E - r.L))}。新存下的钱先放这里。` };
  const dr = r.debtRatio; let dl = !isFinite(dr) ? 0 : dr <= .3 ? 0 : dr <= .4 ? 1 : 2; if (r.H > 0) dl = Math.max(dl, 1);
  dims.debt = { lvl: dl, m: `月还款占收入 ${pc(dr)}`, mm: r.H > 0 ? `高息负债 ${w(r.H)}` : `每月还 ${w2(r.pay)}`,
    c: `月还款占收入 ${pc(dr)}${r.H > 0 ? `，有 ${w(r.H)}年化超过 6% 的负债` : ''}`,
    fix: r.H > 0 ? `还掉年化超过 6% 的负债 ${w(r.H)}。` : '先不加新的贷款。' };
  const rd = x => isFinite(x) ? Math.round(x * 100) / 100 : x; /* 按显示出来的整数百分比判断，免得显示 25% 却评「留意」 */
  const sR = rd(r.saveR), fR = rd(r.freeR);
  dims.flow = { lvl: sR >= .25 ? 0 : sR >= .1 ? 1 : 2, m: `储蓄率 ${pc(sR)}`, mm: `每年存下 ${w(r.saveTot)}`,
    c: `储蓄率 ${pc(sR)}${fR < .1 ? `，但能自由支配的只有 ${pc(fR)}` : `，自由储蓄率 ${pc(fR)}`}`,
    fix: r.surplus < 0 ? `支出比收入多 ${w(-r.surplus)}，先把可以停的支出降下来。` : `每年再多存 ${w(Math.max(0, .25 * r.inc - r.saveTot))}，储蓄率就到 25%。` };
  if (r.work > 0) { const ratio = bench > 0 ? mult / bench : 1;
    dims.long = { lvl: ratio >= 1 ? 0 : ratio >= .5 ? 1 : (r.age >= 40 ? 2 : 1), m: `收入的 ${x1(mult)}`, mm: `长期的钱 ${w(r.longTotal)}`,
      c: `长期的钱是收入的 ${x1(mult)}，${r.age} 岁的参照是 ${x1(bench)}`, fix: `按年龄参照，长期的钱还差 ${w(Math.max(0, bench * r.work - r.longTotal))}。` } }
  else dims.long = { lvl: r.prog >= 1 ? 0 : r.prog >= .5 ? 1 : 2, m: `财务自由数字的 ${pc(r.prog)}`, mm: `长期的钱 ${w(r.longTotal)}`, c: `长期的钱是财务自由数字的 ${pc(r.prog, 1)}`, fix: '支出和取钱的速度要放在一起看。' };
  const order = ['shield', 'em', 'debt', 'flow', 'long'];
  const scored = order.filter(k => dims[k].lvl !== null), worst = scored.length ? Math.max(...scored.map(k => dims[k].lvl)) : 0;
  const n2 = scored.filter(k => dims[k].lvl === 2).length, n1 = scored.filter(k => dims[k].lvl === 1).length;
  const head = worst === 0 ? '家底扎实，五层都在参考线以内' : worst === 1 ? `大体稳，有 ${n1} 处要留意` : `有 ${n2} 处要先处理${n1 ? `，另有 ${n1} 处要留意` : ''}`;
  const top = scored.filter(k => dims[k].lvl > 0).sort((a, b) => dims[b].lvl - dims[a].lvl || order.indexOf(a) - order.indexOf(b))[0];

  /* 1 总评 */
  const kpi = [
    ['净资产', w(r.NW), `总资产 ${w(r.TA)} − 负债 ${w(r.Dt)}`],
    ['金融资产', w(r.F), '不算房子、车和受限资产'],
    ['每年存下', w(r.saveTot), `储蓄率 ${pc(sR)}${r.principal > .05 ? `，含还掉的贷款本金 ${w(r.principal)}` : ''}`],
    ['钱够用到', `${mid.broke || lastAge} 岁`, mid.broke ? `中间情景${lo.broke && lo.broke !== mid.broke ? `；偏低情景 ${lo.broke} 岁` : ''}` : (lo.broke ? `中间情景够用；偏低情景 ${lo.broke} 岁用完` : '三种情景都够用到推演结束')]];
  out('verdict', `<h2 class="hl">${head}</h2>${top ? `<p class="hs">最要紧的一件：${dims[top].fix}<a class="lk" href="#s-layers" style="margin-left:10px">看五层体检</a></p>` : ''}
    <div class="kpis">${kpi.map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="n">${big(v)}</div><div class="d">${d}</div></div>`).join('')}</div>`);

  /* 2 资产总览 */
  const A = [['流动性资产', r.L, 'sky'], ['投资·稳健类', r.S, 'pink'], ['投资·股票、黄金和加密', r.K + r.G + r.X, 'mint'], ['房子', r.V, 'butter'], ['受限资产、股权和其他', r.R + r.PE + r.O, 'grey'], ['车', r.C, 'stone']];
  const Dd = [['房贷', r.mortBal, 'grey'], ['其他负债', Math.max(0, r.Dt - r.mortBal), 'stone']];
  const hS = r.TA > 0 ? r.V / r.TA : 0, fS = r.TA > 0 ? r.F / r.TA : 0;
  const h1 = r.NW < 0 ? `负债比资产多 ${w(-r.NW)}` : `净资产 ${w(r.NW)}${hS >= .5 ? `，${cnShare(hS)}在房子上` : (fS >= .5 ? `，${cnShare(fS)}是金融资产` : '')}`;
  const savIn = Math.min(r.savPrem, Math.max(0, r.surplus));
  const C = [['必需支出', Math.max(0, r.needY - r.principal), 'grey'], ['可以停的支出', Math.max(0, r.exp - r.needY), 'stone'], ['还掉的贷款本金', r.principal, 'butter'], ['储蓄型保险的保费', savIn, 'lilac', .55], ['自由储蓄', Math.max(0, r.surplus - savIn), 'lilac']];
  const cT = Math.max(r.inc, r.exp);
  out('balance', `<div class="rb"><h2 class="hl">${h1}</h2>
      <div class="hb">
        <div class="k">资产</div><div class="r">${seg(A, r.TA)}<span class="v">${w(r.TA)}</span></div>
        <div class="k">负债</div><div class="r">${seg(Dd, r.TA)}<span class="v">${w(r.Dt)}</span></div>
        <div class="k">净资产</div><div class="r">${seg([['净资产', Math.max(0, r.NW), 'lilac']], r.TA)}<span class="v">${w(r.NW)}</span></div>
      </div>${legend(A, r.TA)}
      ${how('bal', '明细', `<p class="s">${r.debtList.length ? `负债：${r.debtList.map(d => `${esc(d.name)} ${w(d.bal)}${d.rate ? `（${d.rate}%）` : ''}`).join('、')}。` : '没有负债。'}房子按近期成交价打九折。受限资产是个人养老金、企业年金和储蓄险的现金价值，退休前不好动。</p>`)}</div>
    <div class="rb"><h2 class="hl">一年收入 ${w(r.inc)}，${r.surplus >= 0 ? `存下 ${w(r.saveTot)}` : `支出比收入多 ${w(-r.surplus)}`}</h2>
      <div class="hb"><div class="k">${r.exp > r.inc ? '支出' : '收入'}</div><div class="r">${seg(C, cT)}<span class="v">${w(cT)}</span></div></div>${legend(C, cT)}
      ${how('flow', '怎么算的', `<p class="s">存下的 = 结余 + 还掉的贷款本金：月还款里还掉的本金变成了房子里的钱，所以算存下来。必需支出是收入断了还要付的那部分，应急金按它和储蓄型保费算。</p>`)}</div>`);

  /* 3 阶段：只讲现在这一步，后面几步点开看 */
  const cd = [
    [r.surplus > 0 ? `去年结余 ${w(r.surplus)}` : `支出比收入多 ${w(-r.surplus)}`, r.H > 0 ? `还有 ${w(r.H)}：${r.high.map(d => `${esc(d.name)} ${w(d.bal)}（${d.rate}%）`).join('、')}` : '', M > 0 ? `流动性资产 ${w(r.L)}，够 ${mo(r.L / M)}` : ''],
    [r.insGap ? r.miss.filter(x => x.lack.length).map(x => `${nm2(x.m)}缺${x.lack.map(k => INSN[k]).join('、')}`).join('；') : '', r.lowGap > .05 ? `活钱和稳钱还差 ${w(r.lowGap)}` : ''],
    [`现在 ${w(r.longTotal)}，财务自由数字约 ${w(r.fi)}`], [`财务自由数字的 5 倍约 ${w(r.fi * 5)}`], []];
  const S = r.stages, si = r.stage, cur = S[si], left = cur.conds.filter(c => !c[0]).length;
  const stageBody = i => { const s = S[i], isCur = i === si, done = i < si;
    return `${isCur ? '' : `<div class="lb">${done ? '已经做到' : '之后'} · 0${i + 1}</div><div class="c">${s.name}：${s.note}</div>`}
      ${s.conds.length ? `<ul class="goals">${s.conds.map(([ok, t], j) => `<li>${ok ? '<span class="tag l0">做到了</span>' : `<span class="tag ${isCur ? 'l1' : 'l0'}">${isCur ? '还差' : '要做到'}</span>`}<div><div>${t}</div>${cd[i][j] ? `<div class="s">${cd[i][j]}</div>` : ''}</div></li>`).join('')}</ul>` : ''}
      <div class="lb" style="margin-top:22px">推荐读</div><ul class="reads">${s.reads.slice(0, 3).map(([slug, t, why]) => `<li>${ART(slug, t)}<span class="s">${why}</span></li>`).join('')}</ul>` };
  if (stagePeek === si) stagePeek = null;
  out('stage', `<h2 class="hl">你在第 ${si + 1} 步「${cur.name}」${left ? `，还差 ${left} 件事` : ''}</h2><p class="hs">${cur.note}。${S[si + 1] && left ? `做到下面几条，就进入「${S[si + 1].name}」。` : ''}</p>
    <div class="trk" data-trk>${S.map((s, i) => `<button type="button" class="${i < si ? 'done' : ''}${i === si ? ' on' : ''}${i === stagePeek ? ' sel' : ''}" data-si="${i}"><i></i><span><span class="lb">0${i + 1}</span> ${s.name}</span></button>`).join('')}</div>
    ${stageBody(si)}
    ${stagePeek !== null ? `<div class="peek">${stageBody(stagePeek)}</div>` : ''}
    <p class="s" style="margin-top:18px">${si < 4 ? '后面几步是灰的，点一下可以先看看要做到什么。' : ''}${si > 0 ? `${si < 4 ? '' : ''}前面几步已经做到，也可以点开看。` : ''}</p>`);

  /* 4 五层体检：金字塔，点一层看细节 */
  if (!layerSel || !dims[layerSel]) layerSel = order.find(k => dims[k].lvl === 2) || order.find(k => dims[k].lvl === 1) || 'shield';
  const hd = k => `<div class="hd2"><span class="lb">0${order.indexOf(k) + 1} · ${LAYER[k][1]}</span><span class="n">${LAYER[k][0]}</span>${tag(dims[k].lvl)}</div><div class="c">${dims[k].c}</div>`;
  const det = {};
  const adults = r.ins.filter(o => o.lifeNeed !== undefined), insMax = Math.max(1, ...adults.flatMap(o => [o.lifeNeed, o.ciNeed]));
  det.shield = `${hd('shield')}${adults.length ? `<div class="bul">${adults.flatMap(o => [[`${nm2(o.m)} 寿险`, o.lifeNeed, n(o.m.life)], [`${nm2(o.m)} 重疾险`, o.ciNeed, n(o.m.ci)]]).filter(x => x[1] > .05).map(([l, need, have]) => `<div>${l}</div><div class="bt" style="width:${Math.max(4, pw(need, insMax))}%"><i class="${have > 0 ? '' : 'z'}" style="width:${pw(Math.min(have, need), need)}%"></i></div><div class="v">已有 ${Math.round(have * 10) / 10} / 需要 ${Math.round(need * 10) / 10}</div>`).join('')}</div>
      <p class="s" style="margin-top:10px">紫色是已有的保额，整条是需要的保额。</p>` : ''}
    ${r.ins.some(o => o.kid) ? `<p class="s" style="margin-top:10px">孩子的重疾险建议 20 到 30 万，主要覆盖父母陪护期间少掉的收入。</p>` : ''}
    ${how('shield', '怎么算的，以及可以改的数', adults.map(o => `<div class="h3" style="margin-top:18px;font-size:15px">${nm2(o.m)}（${ROLEN[o.m.role]}）</div>
      <dl class="kv"><dt>寿险</dt><dd>负债 ${w(o.debt)}${o.share < 1 ? `（按收入占比 ${pc(o.share)}）` : ''} + 丧葬和过渡 ${w(r.funeral)}${o.eduPart ? ` + 教育金 ${w(o.eduPart)}` : ''} + 每年缺口 ${w(o.gap)} × ${yr(o.gapYears)}的系数 ${Math.round(o.f * 100) / 100}${o.carePart ? ` + 赡养 ${w(o.carePart)}` : ''}${o.minus ? ` − 留下应急金后的金融资产 ${w(o.minus)}` : ''} = <b>${w(o.lifeNeed)}</b></dd>
      <dt>合理性检查</dt><dd>常用的粗略参照是 10 倍年收入，${w(o.inc * 10)}。${(() => { const k = o.inc > 0 ? o.lifeNeed / (o.inc * 10) : NaN; return !isFinite(k) ? '' : (k >= .5 && k <= 2 ? '算出来的数和它在同一个量级，合理。' : `算出来的是它的 ${Math.round(k * 10) / 10} 倍，相差较大，回头看看哪一项填得不对。`) })()}</dd>
      <dt>重疾险</dt><dd>年收入 ${w(o.inc)} × 70% × 3 年 + 医疗险报不到的 10 万 + 康复和照护 10 万 = <b>${w(o.ciNeed)}</b></dd></dl>
      <div class="fs no-print"><label class="f"><span>这个人不在了，家里每年还缺多少</span><em>默认：全家每年的支出（不算月供和一次性支出），减去他自己的开销，再减去其他家人收入的一半</em><div class="in"><input class="field" type="text" inputmode="decimal" data-list="members" data-i="${st.members.indexOf(o.m)}" data-f="gap" value="${esc(o.m.gap)}" placeholder="${Math.round(o.gapDef * 10) / 10}"><span class="u">万元 / 年</span></div></label>
      <label class="f"><span>缺口要补几年</span><em>默认补到最小的孩子 22 岁</em><div class="in"><input class="field" type="text" inputmode="decimal" data-list="members" data-i="${st.members.indexOf(o.m)}" data-f="gapYears" value="${esc(o.m.gapYears)}" placeholder="${r.kidYears}"><span class="u">年</span></div></label></div>`).join('') + `<p class="s" style="margin-top:14px">系数假设这笔钱扣掉通胀后每年还有 1.5% 的回报。先保大人，先保障后储蓄。${ART('shield-amount', '方法见《保障 03》')}${st.members.some(m => m.role === 'elder') ? '老人一般配医保、惠民保，再看防癌医疗险和意外险。' : ''}${r.adults.some(m => n(m.income) <= 0) ? '没有收入的大人，寿险主要看家里要请人照顾孩子的费用，这里没有自动算。' : ''}</p>`)}`;
  det.em = `${hd('em')}${gauge(emNow, Math.max(12, r.months + 1), [[r.months, `目标 ${r.months} 个月`]], [0, 3, 6, Math.max(12, r.months + 1)], x => x + ' 个月')}
    ${how('em', '怎么算的', `<p class="s">流动性资产 ${w(r.L)} ÷ 每月必需流出 ${w2(M)}。每月必需流出 = 必需支出 ${w2(r.needY / 12)}（含贷款月还款）${r.savPrem > 0 ? ` + 储蓄型保险的保费 ${w2(r.savPrem / 12)}` : ''}。目标月数按你选的「${r.T.name}」，${r.T.range.join(' 到 ')} 个月，现在取 ${r.months} 个月，可以在附录的「假设和可以调的数」里改。${r.er.length && r.tk !== 'cons' ? `你家有：${r.er.join('、')}，建议往保守那档靠，留 6 到 12 个月。` : ''}${ART('ledger-buckets', '见《账本 02》')}</p>${r.months < 3 ? `<p class="warn">你选了 ${mo(r.months)}：收入一旦中断，这笔钱只能撑 ${mo(r.months)}。想清楚这几个月够不够找到下一份收入。</p>` : ''}`)}`;
  det.debt = `${hd('debt')}${gauge((dr || 0) * 100, 60, [[30, '30% 留意'], [40, '40% 先处理']], [0, 20, 60], x => x + '%')}
    ${r.debtList.length ? `<table class="mini">${r.debtList.map(d => `<tr><td>${esc(d.name)}</td><td>${w(d.bal)}</td><td>${d.rate}%</td><td>${d.rate > 6 ? '<span class="tag l1">高息，先还</span>' : d.rate >= 3 && !d.home ? '<span class="tag l0">一两年内还掉</span>' : ''}</td></tr>`).join('')}</table>` : '<p class="s" style="margin-top:14px">没有负债。</p>'}
    ${how('debt', '怎么算的', `<p class="s">月还款 ${w2(r.pay)} ÷ 月收入 ${w2(r.monInc)}。30% 以内稳，30% 到 40% 留意，超过 40% 先处理；有年化超过 6% 的负债，至少留意。${ART('ledger-debt', '见《账本 03》')}</p>`)}`;
  det.flow = `${hd('flow')}${gline('储蓄率', sR, .5, .25, '25% 稳')}${gline('自由储蓄率', fR, .5, .1, '10%', .5)}
    ${how('flowd', '怎么算的', `<p class="s">储蓄率 =（结余 ${w(r.surplus)} + 还掉的贷款本金 ${w(r.principal)}）÷ 收入 ${w(r.inc)}；25% 以上稳，10% 到 25% 留意，低于 10% 先处理。自由储蓄率是再扣掉还本金和储蓄型保费以后，真正能自由支配的部分，低于 10% 另外提醒。${ART('wealth-savings', '见《财富观 03》')}</p>`)}`;
  const benchSvg = () => { const Wd = 720, Ht = 210, x0 = 44, xa = 700, y0 = 176, y1 = 16, ax = a => x0 + (a - 25) / 42 * (xa - x0), ay = v => y0 - clamp(v, 0, 10) / 10 * (y0 - y1);
    const P = FID.filter(p => p[0] >= 30 && p[0] <= 60), my = isFinite(mult) ? mult : 0, ma = clamp(r.age, 25, 67);
    return `<svg class="bsvg" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="按年龄的储蓄倍数参照，和你家现在的位置">
      ${[0, 5, 10].map(v => `<line x1="${x0}" x2="${xa}" y1="${ay(v)}" y2="${ay(v)}" stroke="#ECECEA"/><text x="${x0 - 8}" y="${ay(v) + 4}" text-anchor="end">${v} 倍</text>`).join('')}
      ${[30, 40, 50, 60].map(a => `<text x="${ax(a)}" y="${Ht - 8}" text-anchor="middle">${a} 岁</text>`).join('')}
      <polyline points="${P.map(p => `${ax(p[0])},${ay(p[1])}`).join(' ')}" fill="none" stroke="var(--grey)" stroke-width="2" stroke-dasharray="4 4"/>
      ${P.map(p => `<circle cx="${ax(p[0])}" cy="${ay(p[1])}" r="4" fill="#fff" stroke="var(--grey)" stroke-width="2"/>`).join('')}
      <text x="${ax(60) + 10}" y="${ay(8) + 4}">参照</text>
      <circle cx="${ax(ma)}" cy="${ay(my)}" r="6.5" fill="var(--lilac)" stroke="var(--ink)" stroke-width="1.5"/>
      <text x="${ax(ma) + 12}" y="${ay(my) - 8}" style="fill:var(--ink)">你家 ${x1(my)}</text></svg>` };
  const fiHit = s => { const x = s.rows.find(z => z.real >= r.fi && z.t > 0); return x ? x.age : null };
  const atRet = s => s.rows.find(z => z.age === Math.round(s.retire)) || s.rows[s.rows.length - 1];
  const simHead = mid.broke ? `照现在的样子，${Math.round(mid.retire)} 岁时约 ${w(atRet(mid).real)}，中间情景 ${mid.broke} 岁左右用完` : `照现在的样子，${Math.round(mid.retire)} 岁时约 ${w(atRet(mid).real)}，中间情景够用到 ${lastAge} 岁`;
  det.long = `${hd('long')}${r.work > 0 ? benchSvg() : ''}
    <p class="s">${r.work > 0 ? '参照来自美国 Fidelity 按年龄的储蓄倍数。' : ''}长期的钱 ${w(r.longTotal)}（长钱加受限资产），财务自由数字约 ${w(r.fi)}，现在是它的 ${pc(r.prog, 1)}${fiHit(mid) ? `，中间情景大约 ${fiHit(mid)} 岁达到` : ''}。</p>
    <div class="c2">${simHead}</div>
    <div class="chart" data-chart role="img" aria-label="往后推到 ${lastAge} 岁，按今天的钱"></div>
    <div class="lgd"><span><i class="sw"></i>偏低到偏高</span><span><i class="ln"></i>中间情景</span><span><i class="rf"></i>财务自由数字</span><span>按今天的钱</span></div>
    ${how('long', '怎么算的', `<p class="s">财务自由数字 =（每年支出 ${w(r.expEx)}${r.payY > 0 || r.once > 0 ? `，不算${[r.payY > 0 && '贷款月还款', r.once > 0 && '过去一年的一次性支出'].filter(Boolean).join('和')}` : ''}${r.passive ? ` − 不工作也有的收入 ${w(r.passive)}` : ''}）÷ 每年取出 ${pc(r.wr, 1)}。${ART('ledger-goals', '见《账本 04》')}</p>
      <p class="s" style="margin-top:8px">往后推：金融资产按问卷里每一项的预期年化加权，中间情景每年约 ${pc(mid.rp, 1)}，股票类再各低、高 2.5 个百分点画成范围带。受限资产按 ${R_RATE}% 单独算，退休前不能拿来付支出，退休那年并进来。生活支出按每年的涨幅涨；贷款月还款金额不变，还清就停；孩子的教育付到最小的孩子 22 岁；过去一年的一次性支出不往后算。借出去的钱${r.lentAmt > 0 && !r.lentBack ? '没填哪年收回，没有算进去' : '按填的年份收回'}。股权投资和房子没有算进去。${n(st.pension) ? '' : '养老金还没填，按 0 算，结果偏保守。'}逐年的数在附录。</p>`)}`;
  out('layers', `<h2 class="hl">${top ? `从地基往上看：「${LAYER[order.find(k => dims[k].lvl === worst)][0]}」要${worst === 2 ? '先补' : '留意'}` : '五层都稳'}</h2>
    <p class="hs">家庭财务分五层，从下往上，下面一层是上面一层的地基。点一层看细节。</p>
    <div class="pyr">${[...order].reverse().map(k => { const i = order.indexOf(k), dd = dims[k]; return `<button type="button" class="ly l${dd.lvl === null ? 0 : dd.lvl}${k === layerSel ? ' sel' : ''}" data-ly="${k}" style="width:${100 - i * 11}%"><span class="lb">0${i + 1}</span><span class="n">${LAYER[k][0]}</span><span class="m">${dd.m}</span>${tag(dd.lvl)}</button>` }).join('')}</div>
    <div class="an">${det[layerSel]}</div>`);
  if (layerSel === 'long') { const el = D.querySelector('[data-out="layers"] [data-chart]'); if (el) drawChart(el, lo.rows, mid.rows, hi.rows, r.fi) }

  /* 5 钱该怎么放 */
  const nowA = [['流动性资产', r.L, 'sky'], ['投资·稳健类', r.S, 'pink'], ['投资·股票、黄金和加密', r.nowLong, 'mint']];
  const shA = [['活钱', r.aL, 'sky'], ['先还的债', r.aH, 'grey'], ['稳钱', r.aS, 'pink'], ['长钱', r.long, 'mint']];
  const ha = r.short > .05 ? `金融资产还不够把应急金、还债和五年内要花的都备好，差 ${w(r.short)}` : r.lowGap > .05 ? `活钱和稳钱还少 ${w(r.lowGap)}，长钱多了 ${w(r.lowGap)}` : r.lowGap < -.05 ? `活钱和稳钱多了 ${w(-r.lowGap)}，可以慢慢挪进长钱` : '四个账户大体对上了';
  const uShare = r.F > 0 ? r.U / r.F : NaN;
  out('alloc', `<h2 class="hl">${ha}</h2>
    <p class="hs">四个账户按什么时候要用来分：活钱管随时要用的，稳钱管五年内已经知道要花的，长钱管五年以上用不到的。金融资产 ${w(r.F)}，现在和该有的对着看：</p>
    <div class="hb"><div class="k">现在</div><div class="r">${seg(nowA, r.F)}</div><div class="k">该有</div><div class="r">${seg(shA, r.F)}</div></div>
    ${legend([['活钱 · 流动性资产', 1, 'sky', 0, `该有 ${w(r.E)} / 现在 ${w(r.L)}`], ['稳钱 · 稳健类', 1, 'pink', 0, `该有 ${w(r.W)} / 现在 ${w(r.S)}`], ['长钱 · 股票类等', 1, 'mint', 0, `该有 ${w(r.long)} / 现在 ${w(r.nowLong)}`], ...(r.H > 0 ? [['先还的债', 1, 'grey', 0, w(r.H)]] : [])])}
    <table class="mini" style="margin-top:28px">
      <tr><td>长钱里放股票</td><td>${r.s}%${r.long >= .05 ? `，约 ${w(r.stock)}` : ''}</td><td class="s">100 − ${r.age} 岁${r.T.adj ? `，「${r.T.name}」${r.T.adj > 0 ? '+' : '−'}${Math.abs(r.T.adj)}` : '，标准档不加减'}</td></tr>
      <tr><td>黄金</td><td>最多 ${w(r.goldCap)}</td><td class="s">现在 ${w(r.G)}${r.G > r.goldCap + .05 ? '，超过了' : ''}</td></tr>
      <tr><td>加密资产</td><td>最多 ${w(r.cryptoCap)}</td><td class="s">现在 ${w(r.X)}${r.X > r.cryptoCap + .05 ? '，超过了' : ''}</td></tr>
      <tr><td>美元</td><td>${r.hasBills ? `至少 ${w(r.usdLow)}` : '没有下限'}</td><td class="s">现在 ${w(r.U)}${isFinite(uShare) ? `，占 ${pc(uShare)}` : ''}</td></tr>
    </table>
    <div class="rb" style="margin-top:44px"><div class="lb">如果坏事发生</div><div class="stress">
      <div><div class="l">收入断了</div><div class="n">撑 ${mo(emNow)}</div><div class="d">靠流动性资产</div></div>
      <div><div class="l">股市跌一半</div><div class="n">少 ${w(r.K * .5)}</div><div class="d">${r.K > 0 && M > 0 ? `相当于 ${mo(r.K * .5 / M)}的必需流出` : '现在没有股票类'}</div></div>
      ${r.V > 0 ? `<div><div class="l">房价跌两成</div><div class="n">少 ${w(.2 * r.V)}</div><div class="d">净资产少 ${pc(r.drop20)}</div></div>` : `<div><div class="l">美元跌 25%</div><div class="n">少 ${w(r.U * .25)}</div><div class="d">像 2005 到 2014 年那样</div></div>`}
    </div></div>
    ${r.sr.length && r.tk !== 'cons' ? `<p class="s" style="margin-top:22px">你家有：${r.sr.join('、')}。股票比例建议往保守那档靠，再低 10 个百分点。</p>` : ''}
    ${how('alloc', '怎么算的，以及需要留意的', `<p class="s">活钱 = 应急金 ${w(r.E)}；稳钱 = 五年内要花的 ${w(r.W)}；年化超过 6% 的负债先还；剩下的是长钱。${r.later.length ? `五年以后的计划（${r.later.map(p => esc(p.item || p.year)).join('、')}）由长钱来管，离用钱五年以内时再挪进稳钱。` : ''}股票比例看到「跌一半会少多少」，问自己会不会卖、会不会影响睡眠和家里的气氛，有一个「会」就往下调。${ART('ledger-buckets', '《账本 02》')} ${ART('alloc-ratio', '《配置 04》')}</p>
      <p class="s" style="margin-top:8px">黄金上限 = 能接受亏掉 ${n(st.goldLoss)}% ÷ 假设跌一半；加密资产上限 = 能接受亏掉 ${n(st.cryptoLoss)}% ÷ 假设跌八成，定为零也完全合理；美元下限 = 三年内确定的海外支出。在中国大陆，虚拟货币相关业务属于非法金融活动。</p>
      ${r.V > 0 ? `<table class="tb res-t" style="margin-top:16px"><thead><tr><th>房子和集中度</th><th class="num">你家</th><th>参考线</th><th></th></tr></thead><tbody>
        ${ratioRow('风险资产占净资产', pc(r.riskShare), '股票类、加密资产、股权投资、房产净值加起来')}
        ${ratioRow('房产集中度', pc(r.conc), '超过 70% 留意', r.conc > .7)}
        ${ratioRow('杠杆倍数', isFinite(r.lev) ? (Math.round(r.lev * 10) / 10) + ' 倍' : '—', '超过 2 倍留意', r.lev > 2)}
        ${r.vInv > 0 ? ratioRow('投资房净租金回报', r.rent > 0 ? pc(r.rent / r.vInv, 1) : '没填租金', '和 10 年期国债收益率比') : ''}
        ${ratioRow('和房地产相关的金融资产', pc(r.reDup), '超过一成留意', r.reDup > .1)}
        ${ratioRow('收入和房子同城同业', st.sameCity ? '是' : '否', '是就留意', !!st.sameCity)}
        ${r.PE > 0 ? ratioRow('股权投资占净资产', pc(r.peShare), '超过两成留意', r.peShare > .2) : ''}
      </tbody></table>` : ''}
      ${r.savPrem > 0 ? `<p class="s" style="margin-top:12px">储蓄型保险每年的保费占家庭年收入 ${pc(r.savR, 1)}${r.savR > .2 ? '，超过两成：分红、万能这类保单，按金监总局 2025 年第 7 号令要投保人签声明' : ''}。它是存钱，但每年非交不可，交不上会损失现金价值。</p>` : ''}`)}`);

  /* 6 行动清单：现在 / 以后，按「保障 → 活钱 → 高息负债 → 稳钱 → 长钱」 */
  const now = [], later = [];
  if (earnerLack.length) now.push(['保障', `给${earnerLack.map(x => { const o = r.ins.find(z => z.m === x.m) || {}; const amt2 = [x.lack.includes('sx') && o.lifeGap > .05 && `寿险保额约 <b>${w(o.lifeGap)}</b>`, x.lack.includes('zj') && o.ciGap > .05 && `重疾险保额约 <b>${w(o.ciGap)}</b>`].filter(Boolean); return `${nm2(x.m)}配上${x.lack.map(k => INSN[k]).join('、')}${amt2.length ? `，${amt2.join('，')}` : ''}` }).join('；')}。${ART('shield-amount', '保额怎么算')}`]);
  if (r.surplus <= 0 && r.exp > 0) now.push(['支出', `每年的支出比收入多 <b>${w(-r.surplus)}</b>，先把可以停的支出降下来，不然后面每一步都没有钱往下流。`]);
  if (r.L + .05 < r.E) now.push(['活钱', `活期和货币基金补到 <b>${w(r.E)}</b>，还差 ${w(r.E - r.L)}${r.S > 0 ? '：定期到期后先不续存，挪过来' : '：新存下的钱先放这里'}。`]);
  if (r.high.length) now.push(['高息负债', `还掉${r.high.map(d => `${esc(d.name)} <b>${w(d.bal)}</b>（${d.rate}%）`).join('、')}，排在存钱前面。${ART('ledger-debt', '先还哪个')}`]);
  const insLater = gaps.filter(o => !earnerLack.some(x => x.m === o.m) || ((o.lifeGap || 0) > .05 && !r.miss.find(x => x.m === o.m).lack.includes('sx')) || ((o.ciGap || 0) > .05 && !r.miss.find(x => x.m === o.m).lack.includes('zj')));
  if (otherLack.length) later.push(['保障', `给${otherLack.map(x => `${nm2(x.m)}补上${x.lack.map(k => INSN[k]).join('、')}`).join('，')}。`]);
  if (insLater.length) later.push(['保障', `补齐保额：${insLater.map(o => { const m2 = r.miss.find(x => x.m === o.m).lack; const p = [(o.lifeGap || 0) > .05 && !(earnerLack.some(x => x.m === o.m) && m2.includes('sx')) && `寿险约 <b>${w(o.lifeGap)}</b>`, (o.ciGap || 0) > .05 && !(earnerLack.some(x => x.m === o.m) && m2.includes('zj')) && `重疾险约 <b>${w(o.ciGap)}</b>`].filter(Boolean); return p.length ? `${nm2(o.m)}${p.join('、')}` : '' }).filter(Boolean).join('；')}。`]);
  if (r.L > r.E + .05) later.push(['活钱', `活期和货币基金比应急金多 ${w(r.L - r.E)}，可以挪去稳钱或长钱。`]);
  if (r.W > 0) later.push(['稳钱', `五年内要花的 <b>${w(r.W)}</b>，按用钱的年份放进对应到期的定期或国债。`]);
  if (r.short > .05) later.push(['长钱', `金融资产还差 <b>${w(r.short)}</b>才能把前面几样备好。${r.nowLong > 0 ? '股票类不必马上卖，在用钱之前一两年分几次挪过来。' : ''}${r.surplus > 0 ? `按每年存下 ${w(r.saveTot)}算，大约 ${Math.ceil(r.short / Math.max(.1, r.saveTot) * 10) / 10} 年能补齐。` : ''}`]);
  else if (r.lowGap > .05) later.push(['长钱', '先停新的投资；股票类里离用钱最近的部分，在用钱前一两年分几次挪回稳钱。']);
  else if (r.long > .05) later.push(['长钱', `长钱 <b>${w(r.long)}</b>里放 ${r.s}% 股票，分几个月投出去。${ART('alloc-ratio', '比例怎么定')}`]);
  if (r.mid.length) later.push(['负债', `${r.mid.map(d => `${esc(d.name)}（${d.rate}%）`).join('、')}的利率在 3% 到 6% 之间，不挡在稳钱前面，最好一两年内还掉。`]);
  if (!now.length && later.length) now.push(later.shift());
  const actRows = a => a.map(([t, x]) => `<li><span class="tagc">${t}</span><div>${x}</div></li>`).join('');
  out('actions', `<h2 class="hl">${now.length ? '接下来做这几件' : '现在没有要马上做的'}</h2><p class="hs">按「保障 → 活钱 → 高息负债 → 稳钱 → 长钱」的顺序，上面的满了，钱再往下流。</p>
    ${now.length ? `<div class="grp2">现在，三个月内</div><ol class="acts">${actRows(now)}</ol>` : ''}
    ${later.length ? `<div class="grp2">以后</div><ol class="acts" style="counter-reset:a ${now.length}">${actRows(later)}</ol>` : ''}`);

  /* 附录：比率明细、和别人比、逐年的数 */
  const row = (name, val, ref, src, bad) => `<tr><td>${name}</td><td class="num" data-l="你家">${val}</td><td data-l="参考线">${ref}</td><td data-l="出处">${src}</td><td data-l="" class="num">${chk(bad)}</td></tr>`;
  out('ratios', `<table class="tb res-t" style="margin-top:6px"><thead><tr><th>比率</th><th class="num">你家</th><th>参考线</th><th>出处</th><th></th></tr></thead><tbody>
    ${row('储蓄率', pc(sR), '（结余 + 还掉的贷款本金）÷ 收入，25% 以上；结余比率也有 30% 的说法', 'AFP 培训口径；汪连新 2016', isFinite(sR) ? sR < .25 : null)}
    ${row('自由储蓄率', pc(fR), '扣掉还本金和储蓄型保费后能自由支配的结余 ÷ 收入，10% 以上', 'AFP 培训口径', isFinite(fR) ? fR < .1 : null)}
    ${row('应急月数', mo(emNow), '流动性资产 ÷ 每月必需流出，3 到 6 个月', '汪连新 2016', isFinite(emNow) ? emNow < 3 : null)}
    ${row('债务月还款 ÷ 收入', pc(dr), '30% 以内为宜，40% 是警戒线', '汪连新 2016', isFinite(dr) ? dr > .3 : null)}
    ${row('资产负债率', pc(r.TA ? r.Dt / r.TA : NaN), '低于 50%；刚买房的家庭才看得出差别', '汪连新 2016', r.TA ? r.Dt / r.TA > .5 : null)}
    ${row('金融资产负债比', pc(r.F + r.R ? r.Dt / (r.F + r.R) : NaN), '不卖房，金融资产够还多少债；有负债的城镇家庭中位数 117.3%', '央行 2019 调查', null)}
    ${row('保费负担率', pc(premR), '保障型保费占工作收入 5% 到 15%，10% 左右为宜', 'AFP 培训口径', isFinite(premR) && prem > 0 ? (premR < .05 || premR > .15) : null)}
    ${row('财务自由度', pc(free), `被动收入 ÷ 支出；${r.age} 岁参考 ${fb[0]}% 到 ${fb[1]}%，100% 算财务自由`, 'AFP 培训口径', isFinite(free) ? free < fb[0] / 100 : null)}
    ${row('储蓄倍数', x1(mult), `长期的钱 ÷ 税后工作收入；${r.age} 岁参照 ${x1(bench)}`, 'Fidelity', isFinite(mult) ? mult < bench : null)}
  </tbody></table>
  <p class="s" style="margin-top:14px">没有列进来的：投资与净资产比率、即付比率、清偿比率。中国家庭的房子占资产六成左右，这几个比率要么几乎人人达标，要么几乎人人不达标，看了也不知道该做什么。</p>`);
  out('bench', `<p class="s">中国人民银行 2019 年对 3 万多户城镇家庭的调查，《账本 01》引过。之后房价变化很大，看个大概。</p>
    <table class="tb res-t" style="margin-top:14px"><thead><tr><th></th><th class="num">你家</th><th class="num">城镇家庭</th></tr></thead><tbody>
      <tr><td>净资产</td><td class="num" data-l="你家">${w(r.NW)}</td><td class="num" data-l="城镇家庭">中位数 141 万</td></tr>
      <tr><td>住房占总资产</td><td class="num" data-l="你家">${pc(r.TA ? r.V / r.TA : NaN)}</td><td class="num" data-l="城镇家庭">59.1%</td></tr>
      <tr><td>金融资产占总资产</td><td class="num" data-l="你家">${pc(r.TA ? (r.F + r.R) / r.TA : NaN)}</td><td class="num" data-l="城镇家庭">20.4%</td></tr>
      <tr><td>资产负债率</td><td class="num" data-l="你家">${pc(r.TA ? r.Dt / r.TA : NaN)}</td><td class="num" data-l="城镇家庭">平均 9.1%</td></tr>
    </tbody></table>
    <p class="s" style="margin-top:14px">储蓄倍数的参照来自美国 Fidelity：假设从 25 岁起每年存下税前收入的 15%、一半以上放股票、67 岁退休。这里用税后收入、也没算基本养老金，只作参照。</p>`);
  out('simtable', `<table class="tb sm res-t"><thead><tr><th>年龄</th><th class="num">年份</th><th class="num">收入</th><th class="num">支出</th><th class="num">计划</th><th class="num">年末资产</th><th class="num">按今天的钱</th></tr></thead><tbody>
    ${mid.rows.map(x => `<tr><td>${x.age}</td><td class="num" data-l="年份">${x.year}</td><td class="num" data-l="收入">${x.t ? w(x.inc) : '—'}</td><td class="num" data-l="支出">${x.t ? w(x.exp) : '—'}</td><td class="num" data-l="计划">${x.ev ? w(x.ev) : ''}</td><td class="num" data-l="年末资产">${w(x.A)}</td><td class="num" data-l="今天的钱">${w(x.real)}</td></tr>`).join('')}
  </tbody></table><p class="s" style="margin-top:10px">中间情景。</p>`);

  /* 7 分享图的数据 */
  card0 = { head, order, dims, S, si, cur, cd, kpi, now };
  renderCard();
}
/* 分享图：默认不带金额，勾选放进哪几块 */
function renderCard() {
  const box = D.querySelector('[data-card]'); if (!box) return;
  if (!card0) { box.innerHTML = '<p class="s">问卷填完以后，这里会出分享图。</p>'; return }
  const on = k => { const el = D.querySelector(`[data-shopts] [data-c="${k}"]`); return !!(el && el.checked) };
  const money = on('money'), c = card0, d = new Date();
  if (qrSvg === null) { try { const q = qrcode(0, 'M'); q.addData(SHARE_URL); q.make(); qrSvg = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }) } catch (e) { qrSvg = '' } }
  const plain = x => x.replace(/<a[^>]*>.*?<\/a>/g, '').replace(/<b>(.*?)<\/b>/g, '$1');
  const noMoney = x => plain(x).replace(/[，,：:；].*$/, '').replace(/\s*[\d.]+ ?(万|亿)/g, '').replace(/。$/, '');
  const nmDef = (() => { const m = st.members.find(x => x.role === 'main') || st.members[0]; const v = m ? String(m.name || '').trim() : ''; return /^(丈夫|妻子|先生|太太|老公|老婆|爸爸|妈妈|家庭成员)$/.test(v) ? '' : v })();
  const ni = D.querySelector('[data-k="shareName"]'); if (ni) ni.placeholder = nmDef || '比如：加宁';
  const who = (has(st.shareName) || String(st.shareName || '').trim() ? String(st.shareName).trim() : nmDef);
  let h = `<div class="ct">${who ? `${esc(who)}家的资产配置体检` : '家庭资产配置体检'}</div><div class="cd">${d.getFullYear()} 年 ${d.getMonth() + 1} 月 · 慢复利 Long Arc</div>`;
  if (on('verdict')) h += `<div class="sv">${c.head}</div><div class="ss"><div class="lb">五层体检</div><div class="cl">${[...c.order].reverse().map(k => { const i = c.order.indexOf(k), dd = c.dims[k]; return `<div class="cr${dd.lvl === 2 ? ' l2' : ''}" style="width:${100 - i * 9}%"><span>${LAYER[k][0]}</span><span class="m">${money ? dd.mm : ''}</span>${tag(dd.lvl)}</div>` }).join('')}</div></div>`;
  if (on('stage')) h += `<div class="ss"><div class="lb">第 ${c.si + 1} 步 · ${c.cur.name}</div><div class="trk">${c.S.map((s, i) => `<button type="button" tabindex="-1" class="${i < c.si ? 'done' : ''}${i === c.si ? ' on' : ''}"><i></i><span>${s.name}</span></button>`).join('')}</div>
    <ul class="cg">${c.cur.conds.map(([ok, t], j) => `<li>${ok ? '做到了' : '还差'}　${t}${money && !ok && c.cd[c.si][j] ? `<div class="s" style="font-size:11px">${c.cd[c.si][j]}</div>` : ''}</li>`).join('')}</ul></div>`;
  if (on('kpi')) h += `<div class="ss"><div class="lb">关键数</div><div class="kp">${c.kpi.map(([l, v]) => `<div><div class="s" style="font-size:11px">${l}</div><div class="n">${money ? big(v) : '—'}</div></div>`).join('')}</div>${money ? '' : '<p class="s" style="font-size:11px;margin-top:6px">打开「带上金额」才显示</p>'}</div>`;
  if (on('acts') && c.now.length) h += `<div class="ss"><div class="lb">接下来做这几件</div><ul class="cg">${c.now.map(([t, x]) => `<li>${t}　${money ? plain(x) : noMoney(x)}</li>`).join('')}</ul></div>`;
  h += `<div class="ft"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMzYgMTkwLjgyIiB3aWR0aD0iMzM2IiBoZWlnaHQ9IjE5MC44MiI+PHBhdGggZmlsbD0iIzE3MTcxNyIgZD0iTTQ0LjkgMjcuNDdIODMuMDlWMzAuNEg0NC45Wk00NC45IDM3LjdIODMuMDlWNDAuNTZINDQuOVpNNDAuNzIgNjIuNzhIODguNFY2NS43MUg0MC43MlpNNTIuMDcgNDcuMzhINTguOTJWNjQuNDJINTIuMDdaTTY4LjY3IDQ3LjM4SDc1LjYyVjY0LjQySDY4LjY3Wk0zNC4xIDcyLjFIODMuMTZWNzQuOTZIMzVaTTc5LjA5IDcyLjFINzcuOTJMODIuOTggNjcuNzFMOTAuNjIgNzQuOFE5MCA3NS40NCA4OS4xIDc1LjY3UTg4LjIgNzUuOTEgODYuMjMgNzYuMDRRNzcuNTUgODcuNzYgNjIuNzQgOTQuOTRRNDcuOTMgMTAyLjEyIDI3Ljk3IDEwNS4wNkwyNy4zNCAxMDMuNDRRMzkuMSAxMDAuNjYgNDkuMiA5Ni4yM1E1OS4zIDkxLjggNjYuOTkgODUuNzZRNzQuNjggNzkuNzIgNzkuMDkgNzIuMVpNNDcuMDQgNzIuMjJRNTAuNDEgNzcuNDIgNTUuNzYgODEuNTFRNjEuMSA4NS42IDY3Ljg3IDg4LjU5UTc0LjYzIDkxLjU4IDgyLjIyIDkzLjYxUTg5LjgxIDk1LjY1IDk3LjYgOTYuNzJMOTcuNTQgOTcuOFE5NS4yIDk4LjI5IDkzLjYxIDEwMC4wMlE5Mi4wMyAxMDEuNzUgOTEuMzEgMTA0LjU0UTgxLjA2IDEwMiA3Mi4xOSA5Ny44OVE2My4zMyA5My43NyA1Ni41MiA4Ny43UTQ5LjcxIDgxLjYyIDQ1LjQ5IDczLjI4Wk03OC40MiAxNy4zMkg3Ny40OUw4MS40IDEzLjE0TDg5Ljk5IDE5LjU1UTg5LjU5IDIwLjExIDg4LjU1IDIwLjY1UTg3LjUgMjEuMTggODYuMSAyMS40OFY0MS4xNlE4Ni4xIDQxLjQ5IDg0Ljk3IDQyLjA1UTgzLjg0IDQyLjYyIDgyLjM3IDQzLjA5UTgwLjkxIDQzLjU3IDc5LjY3IDQzLjU3SDc4LjQyWk00MS44OSAxNy4zMlYxMy44Mkw1MC4wMyAxNy4zMkg4My42MVYyMC4yNUg0OS40OVY0Mi4xMlE0OS40OSA0Mi40MyA0OC41MyA0My4wNVE0Ny41NiA0My42NiA0Ni4wNyA0NC4wOVE0NC41NyA0NC41MiA0My4wMiA0NC41Mkg0MS44OVpNODUuMjEgNDcuMzhIODQuMjhMODguMDggNDMuM0w5Ni40OSA0OS41NlE5Ni4wOSA1MC4xMyA5NS4wNSA1MC42NlE5NCA1MS4yIDkyLjYgNTEuNVY2NS45NFE5Mi42IDY2LjI0IDkxLjU0IDY2LjczUTkwLjQ3IDY3LjIyIDg5LjA1IDY3LjYxUTg3LjYyIDY4IDg2LjM5IDY4SDg1LjIxWk0zNS40OCA0Ny4zOFY0NEw0My4zNiA0Ny4zOEg4Ny42M1Y1MC4zSDQyLjc5VjY3LjAyUTQyLjc5IDY3LjI2IDQxLjg1IDY3LjgzUTQwLjkgNjguMzkgMzkuNDcgNjguOFEzOC4wNSA2OS4yMiAzNi41NCA2OS4yMkgzNS40OFpNMTYuNTUgMTIuODggMjcuNDcgMTQuMDNRMjcuMyAxNS4wMyAyNi41NSAxNS44UTI1LjggMTYuNTcgMjMuOTMgMTYuODdWMTAyLjU1UTIzLjkzIDEwMi45OSAyMy4wNCAxMDMuNjFRMjIuMTUgMTA0LjI0IDIwLjgxIDEwNC43UTE5LjQ3IDEwNS4xNiAxOC4wMyAxMDUuMTZIMTYuNTVaTTkuMjkgMzIuNCAxMC45OCAzMi40N1ExMy40IDQwLjIgMTIuODQgNDYuMTZRMTIuMjggNTIuMTEgMTAuMzYgNTQuOTZROS41MiA1Ni4yNCA4LjEzIDU2Ljk0UTYuNzUgNTcuNjQgNS4zOCA1Ny41NFE0LjAyIDU3LjQ0IDMuMTcgNTYuMzVRMi4xNiA1NC45MiAyLjY5IDUzLjI1UTMuMjIgNTEuNTggNC41NCA1MC4yNFE1Ljg3IDQ4LjYxIDcuMDIgNDUuNzNROC4xNyA0Mi44NSA4LjgzIDM5LjMxUTkuNSAzNS43NyA5LjI5IDMyLjRaTTI2LjMzIDI5LjI1UTMwLjg0IDMyLjA0IDMyLjkyIDM0LjlRMzUuMDEgMzcuNzcgMzUuMyA0MC4yM1EzNS42IDQyLjY4IDM0LjY3IDQ0LjI1UTMzLjczIDQ1LjgyIDMyLjE2IDQ2LjA0UTMwLjU4IDQ2LjI1IDI5IDQ0LjY2UTI5LjEzIDQwLjk2IDI3Ljg0IDM2Ljc5UTI2LjU2IDMyLjYyIDI1LjA0IDI5LjcyWk0xNTUuODEgMTcuNjZRMTU1LjQxIDE4LjUgMTU0LjQyIDE5UTE1My40NCAxOS41IDE1MS44IDE5LjIzUTE0Ni41OSAyOS4wNSAxMzkuNDMgMzYuNDRRMTMyLjI2IDQzLjgzIDEyNC4yNiA0OC4zOEwxMjMuMTEgNDcuMTlRMTI3LjEzIDQzLjM2IDEzMS4xMiAzOC4wMVExMzUuMSAzMi42NSAxMzguNTcgMjYuMjNRMTQyLjA0IDE5LjgyIDE0NC40MyAxMi44NlpNMTk4LjMxIDE3LjkyUTE5OC4zMSAxNy45MiAxOTkuMyAxOC42OVEyMDAuMjggMTkuNDUgMjAxLjg0IDIwLjYzUTIwMy40IDIxLjgyIDIwNS4xIDIzLjE5UTIwNi43OSAyNC41NiAyMDguMjIgMjUuODdRMjA3LjgyIDI3LjQ3IDIwNS41NyAyNy40N0gxNDMuMlYyNC41NEgxOTMuMDRaTTE1MC44IDczLjI1UTE1NC44OCA3OS4yMiAxNjEuMjkgODMuMzdRMTY3LjcgODcuNTIgMTc1LjkyIDkwLjE3UTE4NC4xNCA5Mi44MiAxOTMuNjggOTQuMjRRMjAzLjIzIDk1LjY2IDIxMy41NSA5Ni4xOEwyMTMuNDkgOTcuNDFRMjEwLjgxIDk4LjA0IDIwOS4xMiAxMDAuMDJRMjA3LjQ0IDEwMS45OSAyMDYuODIgMTA1LjAyUTE5My4zIDEwMy4yMSAxODIuMiA5OS43MVExNzEuMDkgOTYuMiAxNjIuODMgOTAuMDZRMTU0LjU4IDgzLjkyIDE0OS4zOCA3NC4zMVpNMTg1LjM0IDcxLjMyIDE5MC45NyA2Ni42NCAxOTguOTggNzQuNDhRMTk4LjMyIDc1LjEyIDE5Ny4zNSA3NS4zNlExOTYuMzggNzUuNTkgMTk0LjM4IDc1LjY2UTE4Ny4zOCA4NC42NiAxNzcuMDIgOTAuNzdRMTY2LjY3IDk2Ljg4IDE1My4zNCAxMDAuMzhRMTQwLjAyIDEwMy44OCAxMjMuOTggMTA1LjE1TDEyMy40OSAxMDMuNDZRMTM3Ljk4IDEwMS4wMiAxNTAuMzUgOTYuODdRMTYyLjcyIDkyLjcyIDE3Mi4wMyA4Ni4zOFExODEuMzMgODAuMDMgMTg2LjU5IDcxLjMyWk0xOTAuMTEgNzEuMzJWNzQuMjVIMTQ5LjE2TDE1MS45OCA3MS4zMlpNMTg2LjMyIDM1Ljg0IDE5MC4zMSAzMS41MiAxOTguODQgMzguMDdRMTk4LjQ0IDM4LjU3IDE5Ny40OSAzOS4wOVExOTYuNTQgMzkuNjEgMTk1LjI2IDM5Ljc4VjYyLjM4UTE5NS4yNiA2Mi42OCAxOTQuMTEgNjMuMjRRMTkyLjk1IDYzLjggMTkxLjQgNjQuMjRRMTg5Ljg1IDY0LjY4IDE4OC40NyA2NC42OEgxODcuMTlWMzUuODRaTTE0OS43MSA2Mi45NlExNDkuNzEgNjMuMyAxNDguNjkgNjMuOTRRMTQ3LjY4IDY0LjU3IDE0Ni4xNiA2NS4wNVExNDQuNjQgNjUuNTMgMTQyLjkyIDY1LjUzSDE0MS43NVYzNS44NFYzMi4xOEwxNTAuMjggMzUuODRIMTkxLjgyVjM4Ljc2SDE0OS43MVpNMTYyLjc0IDY2LjE1UTE2Mi4zNyA2Ni44NSAxNjEuNTcgNjcuMjRRMTYwLjc3IDY3LjYzIDE1OS4wNCA2Ny40UTE1Ni4yNiA3MS42MSAxNTEuOTMgNzYuMDRRMTQ3LjYgODAuNDcgMTQyLjIzIDg0LjQxUTEzNi44NSA4OC4zNiAxMzAuNjcgOTEuMTFMMTI5LjcyIDg5LjgzUTEzNC42NSA4Ni4yMyAxMzguOTkgODEuNFExNDMuMzMgNzYuNTggMTQ2Ljc0IDcxLjM2UTE1MC4xNSA2Ni4xNCAxNTIuMDMgNjEuNVpNMTkwLjc3IDU4LjcyVjYxLjY0SDE0Ni4xN1Y1OC43MlpNMTkwLjc3IDQ3LjI0VjUwLjE3SDE0Ni4xN1Y0Ny4yNFpNMjQxLjQgNDQuMjJIMjgxLjQ0TDI4Ni40MSAzNy40NVEyODYuNDEgMzcuNDUgMjg3LjM0IDM4LjIzUTI4OC4yNyAzOS4wMSAyODkuNzEgNDAuMjNRMjkxLjE0IDQxLjQ1IDI5Mi43MSA0Mi44NFEyOTQuMjggNDQuMjMgMjk1LjU2IDQ1LjU0UTI5NS4xNiA0Ny4xNCAyOTIuODkgNDcuMTRIMjQyLjJaTTI4My4yOSAxMi45NCAyOTIuOTMgMjEuNTNRMjkyLjI1IDIyLjIgMjkwLjc4IDIyLjI0UTI4OS4zMSAyMi4yOCAyODcuMjEgMjEuNTNRMjgxLjY0IDIzLjE4IDI3NC4xIDI0LjgxUTI2Ni41NiAyNi40MyAyNTguMjIgMjcuNjZRMjQ5Ljg5IDI4Ljg4IDI0MS42NyAyOS40N0wyNDEuMjggMjcuOTZRMjQ2LjkyIDI2LjcgMjUyLjg5IDI0LjkyUTI1OC44NyAyMy4xNCAyNjQuNTUgMjEuMTJRMjcwLjIzIDE5LjEgMjc1LjA4IDE2Ljk3UTI3OS45MyAxNC44NCAyODMuMjkgMTIuOTRaTTI2My4zIDQ0LjIySDI3MlY0NS44MlEyNjcuNTEgNTguNjYgMjU5LjIyIDY5LjYxUTI1MC45NCA4MC41NyAyMzkuNjggODguN0wyMzguNDkgODcuNDRRMjQ0LjE5IDgxLjcxIDI0OC45NiA3NC42MVEyNTMuNzMgNjcuNTEgMjU3LjM1IDU5LjcxUTI2MC45NiA1MS45MiAyNjMuMyA0NC4yMlpNMjcyLjQ2IDU0LjE2UTI3OC45MyA1Ni43IDI4Mi45MyA1OS42UTI4Ni45NCA2Mi41IDI4OC44OCA2NS4zNlEyOTAuODMgNjguMjIgMjkxLjEzIDcwLjU5UTI5MS40MyA3Mi45NSAyOTAuNTYgNzQuNDZRMjg5LjY4IDc1Ljk3IDI4OC4wNSA3Ni4xN1EyODYuNDMgNzYuMzggMjg0LjQ2IDc0Ljk0UTI4My43MiA3MS42MyAyODEuNTcgNjcuOTlRMjc5LjQyIDY0LjM0IDI3Ni42OSA2MC45MVEyNzMuOTYgNTcuNDggMjcxLjM3IDU0LjkxWk0yNzIuODEgMjEuNlYxMDIuNTZRMjcyLjgxIDEwMi44NCAyNzEuOTkgMTAzLjQ3UTI3MS4xNiAxMDQuMSAyNjkuNyAxMDQuNThRMjY4LjI0IDEwNS4wNiAyNjYuMjggMTA1LjA2SDI2NC45M1YyMy45NFpNMjk4IDIxLjI2IDMwOS4yMyAyMi40NFEzMDkuMDYgMjMuNDQgMzA4LjI2IDI0LjIxUTMwNy40NiAyNC45OCAzMDUuNTkgMjUuMjJWODEuNzhRMzA1LjU5IDgyLjIxIDMwNC42NSA4Mi44MlEzMDMuNyA4My40NCAzMDIuMzEgODMuOTFRMzAwLjkxIDg0LjM5IDI5OS40NCA4NC4zOUgyOThaTTMxOS41NiAxNC41OSAzMzEuMDQgMTUuODFRMzMwLjg4IDE2Ljg0IDMzMC4wMyAxNy41OVEzMjkuMTggMTguMzQgMzI3LjM4IDE4LjU4VjkzLjg2UTMyNy4zOCA5Ni45IDMyNi42MSA5OS4xN1EzMjUuODUgMTAxLjQ1IDMyMy4zMyAxMDIuODRRMzIwLjgyIDEwNC4yMiAzMTUuNDggMTA0LjhRMzE1LjIyIDEwMi44NyAzMTQuNyAxMDEuNDNRMzE0LjE4IDk5Ljk5IDMxMy4wOCA5OC45NlEzMTEuODQgOTcuOSAzMDkuNzYgOTcuMlEzMDcuNjggOTYuNSAzMDMuOTcgOTUuOTlWOTQuNVEzMDMuOTcgOTQuNSAzMDUuNjcgOTQuNjNRMzA3LjM3IDk0Ljc2IDMwOS43NCA5NC45MVEzMTIuMSA5NS4wNiAzMTQuMiA5NS4yUTMxNi4zIDk1LjMzIDMxNy4wOCA5NS4zM1EzMTguNTMgOTUuMzMgMzE5LjA1IDk0LjgzUTMxOS41NiA5NC4zNCAzMTkuNTYgOTMuMThaIi8+PHBhdGggZmlsbD0iI0E5QUFBQiIgZD0iTTMuODYgMTU2SDguODZWMTgzLjI3SDE3LjA5VjE4Ny44MkgzLjg2Wk00MS44NiAxODAuMjdWMTYzLjU1UTQxLjg2IDE1OS43MyA0My44MiAxNTcuNjRRNDUuNzcgMTU1LjU1IDQ5LjQ1IDE1NS41NVE1My4xNCAxNTUuNTUgNTUuMDkgMTU3LjY0UTU3LjA1IDE1OS43MyA1Ny4wNSAxNjMuNTVWMTgwLjI3UTU3LjA1IDE4NC4wOSA1NS4wOSAxODYuMThRNTMuMTQgMTg4LjI3IDQ5LjQ1IDE4OC4yN1E0NS43NyAxODguMjcgNDMuODIgMTg2LjE4UTQxLjg2IDE4NC4wOSA0MS44NiAxODAuMjdaTTUyLjA1IDE4MC41OVYxNjMuMjNRNTIuMDUgMTYwLjA5IDQ5LjQ1IDE2MC4wOVE0Ni44NiAxNjAuMDkgNDYuODYgMTYzLjIzVjE4MC41OVE0Ni44NiAxODMuNzMgNDkuNDUgMTgzLjczUTUyLjA1IDE4My43MyA1Mi4wNSAxODAuNTlaTTgzLjE0IDE1Nkg4OS40MUw5NC4yNyAxNzUuMDVIOTQuMzZWMTU2SDk4LjgyVjE4Ny44Mkg5My42OEw4Ny42OCAxNjQuNTlIODcuNTlWMTg3LjgySDgzLjE0Wk0xMjQuOTEgMTgwLjI3VjE2My41NVExMjQuOTEgMTU5LjY4IDEyNi44MiAxNTcuNjFRMTI4LjczIDE1NS41NSAxMzIuMzYgMTU1LjU1UTEzNiAxNTUuNTUgMTM3LjkxIDE1Ny42MVExMzkuODIgMTU5LjY4IDEzOS44MiAxNjMuNTVWMTY2LjI3SDEzNS4wOVYxNjMuMjNRMTM1LjA5IDE2MC4wOSAxMzIuNSAxNjAuMDlRMTI5LjkxIDE2MC4wOSAxMjkuOTEgMTYzLjIzVjE4MC42NFExMjkuOTEgMTgzLjczIDEzMi41IDE4My43M1ExMzUuMDkgMTgzLjczIDEzNS4wOSAxODAuNjRWMTc0LjQxSDEzMi41OVYxNjkuODZIMTM5LjgyVjE4MC4yN1ExMzkuODIgMTg0LjE0IDEzNy45MSAxODYuMlExMzYgMTg4LjI3IDEzMi4zNiAxODguMjdRMTI4LjczIDE4OC4yNyAxMjYuODIgMTg2LjJRMTI0LjkxIDE4NC4xNCAxMjQuOTEgMTgwLjI3Wk0yMDIuMzYgMTU2SDIwOS4xNEwyMTQuMzIgMTg3LjgySDIwOS4zMkwyMDguNDEgMTgxLjVWMTgxLjU5SDIwMi43M0wyMDEuODIgMTg3LjgySDE5Ny4xOFpNMjA3LjgyIDE3Ny4yNyAyMDUuNTkgMTYxLjU1SDIwNS41TDIwMy4zMiAxNzcuMjdaTTIzOS40NSAxNTZIMjQ2Ljg2UTI1MC43MyAxNTYgMjUyLjUgMTU3LjhRMjU0LjI3IDE1OS41OSAyNTQuMjcgMTYzLjMyVjE2NS4yN1EyNTQuMjcgMTcwLjIzIDI1MSAxNzEuNTVWMTcxLjY0UTI1Mi44MiAxNzIuMTggMjUzLjU3IDE3My44NlEyNTQuMzIgMTc1LjU1IDI1NC4zMiAxNzguMzZWMTgzLjk1UTI1NC4zMiAxODUuMzIgMjU0LjQxIDE4Ni4xNlEyNTQuNSAxODcgMjU0Ljg2IDE4Ny44MkgyNDkuNzdRMjQ5LjUgMTg3LjA1IDI0OS40MSAxODYuMzZRMjQ5LjMyIDE4NS42OCAyNDkuMzIgMTgzLjkxVjE3OC4wOVEyNDkuMzIgMTc1LjkxIDI0OC42MSAxNzUuMDVRMjQ3LjkxIDE3NC4xOCAyNDYuMTggMTc0LjE4SDI0NC40NVYxODcuODJIMjM5LjQ1Wk0yNDYuMjcgMTY5LjY0UTI0Ny43NyAxNjkuNjQgMjQ4LjUyIDE2OC44NlEyNDkuMjcgMTY4LjA5IDI0OS4yNyAxNjYuMjdWMTYzLjgyUTI0OS4yNyAxNjIuMDkgMjQ4LjY2IDE2MS4zMlEyNDguMDUgMTYwLjU1IDI0Ni43MyAxNjAuNTVIMjQ0LjQ1VjE2OS42NFpNMjgwLjE4IDE4MC40NVYxNjMuMzZRMjgwLjE4IDE1OS42NCAyODIuMDcgMTU3LjU5UTI4My45NSAxNTUuNTUgMjg3LjU1IDE1NS41NVEyOTEuMTQgMTU1LjU1IDI5My4wMiAxNTcuNTlRMjk0LjkxIDE1OS42NCAyOTQuOTEgMTYzLjM2VjE2Ni43M0gyOTAuMThWMTYzLjA1UTI5MC4xOCAxNjAuMDkgMjg3LjY4IDE2MC4wOVEyODUuMTggMTYwLjA5IDI4NS4xOCAxNjMuMDVWMTgwLjgyUTI4NS4xOCAxODMuNzMgMjg3LjY4IDE4My43M1EyOTAuMTggMTgzLjczIDI5MC4xOCAxODAuODJWMTc1Ljk1SDI5NC45MVYxODAuNDVRMjk0LjkxIDE4NC4xOCAyOTMuMDIgMTg2LjIzUTI5MS4xNCAxODguMjcgMjg3LjU1IDE4OC4yN1EyODMuOTUgMTg4LjI3IDI4Mi4wNyAxODYuMjNRMjgwLjE4IDE4NC4xOCAyODAuMTggMTgwLjQ1WiIvPjwvc3ZnPgo=" alt="慢复利 Long Arc"><div class="qr"><p>扫码<br>给你家也做一次</p>${qrSvg}</div></div>`;
  box.innerHTML = h;
}
D.addEventListener('change', e => { if (e.target.closest('[data-shopts]')) renderCard() });
D.addEventListener('click', e => {
  const ly = e.target.closest('[data-ly]'); if (ly) { layerSel = ly.dataset.ly; render(); return }
  const sb = e.target.closest('[data-trk] button[data-si]'); if (sb) { const i = +sb.dataset.si; stagePeek = stagePeek === i ? null : i; render(); return }
  const b = e.target.closest('[data-act="png"],[data-act="pdf"]'); if (!b) return;
  if (b.dataset.act === 'pdf') { D.body.classList.add('pr2'); D.querySelectorAll('[data-mod="2"] details').forEach(x => { x.open = true }); window.print(); return }
  const go = () => html2canvas(D.querySelector('[data-card]'), { scale: 3, backgroundColor: '#ffffff' }).then(cv => { const a = D.createElement('a'); a.download = `家庭资产配置体检-${stamp()}.png`; a.href = cv.toDataURL('image/png'); a.click(); b.disabled = false }).catch(() => { b.disabled = false; toast('没生成成功，再试一次') });
  b.disabled = true;
  if (window.html2canvas) go(); else { const s = D.createElement('script'); s.src = 'lib/html2canvas.min.js'; s.onload = go; s.onerror = () => { b.disabled = false; toast('生成图片的组件没加载上，再试一次') }; D.head.append(s) }
});
addEventListener('afterprint', () => D.body.classList.remove('pr2'));

function drawChart(el, lo, mid, hi, fi) {
  const Wd = 720, Ht = 300, pl = 56, pr = 92, pt = 16, pb = 32, iw = Wd - pl - pr, ih = Ht - pt - pb;
  const ages = mid.map(x => x.age), a0 = ages[0], a1 = ages[ages.length - 1];
  const vmax = Math.max(1, fi * 1.15, ...hi.map(x => x.real)), vmin = 0;
  const X = a => pl + (a - a0) / Math.max(1, a1 - a0) * iw, Y = v => pt + ih - (clamp(v, vmin, vmax) - vmin) / (vmax - vmin) * ih;
  const step = niceStep(vmax / 4), ticks = []; for (let v = 0; v <= vmax + 1e-9; v += step) ticks.push(v);
  const xs = (a1 - a0) > 40 ? 10 : 5, xt = []; for (let a = Math.ceil(a0 / xs) * xs; a <= a1; a += xs) xt.push(a);
  const pts = rows => rows.map(x => `${X(x.age).toFixed(1)},${Y(x.real).toFixed(1)}`);
  const band = 'M' + pts(hi).join('L') + 'L' + pts(lo).reverse().join('L') + 'Z';
  const last = mid[mid.length - 1], fiY = Y(fi), showFi = fi > 0 && fi <= vmax;
  const lastY = Y(last.real), labY = showFi && Math.abs(lastY - fiY) < 14 ? (lastY < fiY ? fiY - 14 : fiY + 14) : lastY;
  el.innerHTML = `<svg viewBox="0 0 ${Wd} ${Ht}" preserveAspectRatio="xMinYMin meet">
    <g class="ax">${ticks.map(v => `<line x1="${pl}" x2="${pl + iw}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pl - 10}" y="${Y(v) + 4}" text-anchor="end">${fmtTick(v)}</text>`).join('')}
    ${xt.map(a => `<text x="${X(a)}" y="${Ht - 8}" text-anchor="middle">${a} 岁</text>`).join('')}</g>
    <path class="band" d="${band}"/>
    ${showFi ? `<line class="ref" x1="${pl}" x2="${pl + iw}" y1="${fiY}" y2="${fiY}"/><text x="${pl + iw + 8}" y="${fiY + 4}" style="fill:var(--ink)">财务自由</text>` : ''}
    <path class="mid" d="M${pts(mid).join('L')}"/>
    <text x="${pl + iw + 8}" y="${labY + 4}">中间 ${last.real < 0 ? '用完' : fmtTick(last.real)}</text>
    <line class="xh" x1="0" x2="0" y1="${pt}" y2="${pt + ih}"/><circle class="dot" r="4.5" cx="0" cy="0"/>
    <rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent" data-hit/></svg><div class="ctip"></div>`;
  const svg = el.querySelector('svg'), xh = el.querySelector('.xh'), dot = el.querySelector('.dot'), tip = el.querySelector('.ctip');
  const show = cx => {
    const rect = svg.getBoundingClientRect(), sx = (cx - rect.left) / rect.width * Wd;
    const i = clamp(Math.round((sx - pl) / iw * (ages.length - 1)), 0, ages.length - 1), x = X(ages[i]);
    xh.setAttribute('x1', x); xh.setAttribute('x2', x); dot.setAttribute('cx', x); dot.setAttribute('cy', Y(mid[i].real));
    tip.textContent = '';
    const h = D.createElement('div'); h.style.color = 'var(--note)'; h.textContent = `${ages[i]} 岁 · ${mid[i].year} 年`; tip.append(h);
    [[hi[i].real, '偏高'], [mid[i].real, '中间'], [lo[i].real, '偏低']].forEach(([v, k]) => { const d = D.createElement('div'), b = D.createElement('b'), s = D.createElement('span'); b.textContent = w(v); s.className = 'k'; s.textContent = k; d.append(b, s); tip.append(d) });
    const px = x / Wd * rect.width; tip.style.left = Math.max(0, Math.min(px + 14, rect.width - tip.offsetWidth - 4)) + 'px'; tip.style.top = '8px';
    el.classList.add('hov');
  };
  const hit = el.querySelector('[data-hit]');
  hit.addEventListener('pointermove', e => show(e.clientX));
  hit.addEventListener('pointerleave', () => el.classList.remove('hov'));
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9)))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p }
function fmtTick(v) { return Math.abs(v) >= 10000 ? (Math.round(v / 1000) / 10) + '亿' : Math.round(v) + '万' }

/* ── 两个部分的切换 ── */
function showMod(k, scroll) {
  mod = clamp(k, 1, 3);
  D.querySelectorAll('[data-mod]').forEach(m => m.classList.toggle('on', +m.dataset.mod === mod));
  D.querySelectorAll('[data-mods] a').forEach(a => a.classList.toggle('on', +a.dataset.go === mod));
  if (location.hash !== '#m' + mod) history.replaceState(null, '', '#m' + mod);
  if (mod === 1) { renderIncTable(); renderInsTable() }
  if (scroll) D.querySelector('[data-mods]').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

/* ── 表单与状态同步 ── */
function fillForm() {
  D.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k, v = st[k];
    if (el.type === 'radio') el.checked = el.value === v;
    else if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
  });
  Object.keys(LISTS).forEach(renderList); Object.keys(GROUPS).forEach(renderFixed); renderIncTable(); renderInsTable(); renderRiskQ();
}
D.addEventListener('input', onEdit); D.addEventListener('change', onEdit);
function onEdit(e) {
  const el = e.target;
  if (el.dataset.risk) { if (!el.checked) return; st.risk[el.dataset.risk] = el.value }
  else if (el.dataset.g) { const row = st[el.dataset.g][el.dataset.row]; if (!row) return; row[el.dataset.f] = el.value }
  else if (el.dataset.k) {
    const k = el.dataset.k;
    if (el.type === 'radio') { if (!el.checked) return; st[k] = el.value; if (k === 'tier') resetMonths() }
    else if (el.type === 'checkbox') st[k] = el.checked; else st[k] = el.value;
  } else if (el.dataset.list && el.dataset.f) {
    const row = st[el.dataset.list][+el.dataset.i]; if (!row) return;
    row[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.list === 'members' && (el.dataset.f === 'name' || el.dataset.f === 'role') && el.closest('[data-list="members"]')) { renderIncTable(); renderInsTable() }
  } else return;
  save(); render();
}
function resetMonths() { st.months = ''; const m = D.querySelector('[data-k="months"]'); if (m) m.value = '' }
D.addEventListener('click', e => {
  const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); showMod(+go.dataset.go, true); return }
  const a = e.target.closest('[data-addrow]'); if (a) { const nm = a.dataset.addrow; st[nm].push(LISTS[nm].add()); renderList(nm); if (nm === 'members') { renderIncTable(); renderInsTable() } save(); render(); const inp = a.parentNode.querySelector('tbody tr:last-child .field'); inp && inp.focus(); return }
  const af = e.target.closest('[data-addfx]'); if (af) { const g = af.dataset.addfx, k = 'u' + Date.now().toString(36); st[g][k] = { custom: 1, name: '', ...(af.dataset.sg ? { sg: af.dataset.sg } : {}) }; renderFixed(g); save(); render(); const inp = D.querySelector(`[data-g="${g}"][data-row="${k}"][data-f="name"]`); inp && inp.focus(); return }
  const df = e.target.closest('[data-delfx]'); if (df) { delete st[df.dataset.delfx][df.dataset.row]; renderFixed(df.dataset.delfx); save(); render(); return }
  const d = e.target.closest('[data-del]'); if (d) { st[d.dataset.del].splice(+d.dataset.i, 1); renderList(d.dataset.del); if (d.dataset.del === 'members') { renderIncTable(); renderInsTable() } save(); render(); return }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'tierauto') { e.preventDefault(); st.tier = ''; resetMonths(); save(); render(); return }
  if (act === 'sample') { if (hasData() && !confirm('用示例家庭的数据覆盖现在填的内容？')) return; st = sample(); fillForm(); save(); render(); toast('已填入示例家庭：夫妻 38 岁和 36 岁，孩子 11 岁') }
  if (act === 'clear') { if (!confirm('清空所有填写的内容？清空之前可以先备份。')) return; st = blank(); fillForm(); save(); render(); toast('已清空') }
  if (act === 'backup') { download(`家庭资产配置体检-${stamp()}.json`, JSON.stringify({ app: 'la-checkup', version: 5, saved: new Date().toISOString(), data: st }, null, 2), 'application/json'); toast('备份文件已下载') }
  if (act === 'restore') D.querySelector('[data-file]').click();
  if (act === 'md') { const md = toMd(); download(`家庭资产配置体检-${stamp()}.md`, md, 'text/markdown'); try { navigator.clipboard && navigator.clipboard.writeText(md) } catch (err) { } toast('已下载，也复制到了剪贴板，可以直接贴给 AI') }
  if (act === 'print') window.print();
});
D.querySelector('[data-file]').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { const j = JSON.parse(rd.result), d = j && j.data; if (!d || typeof d !== 'object') throw 0; if (d.v === 5) st = merge(d); else if (Array.isArray(d.cash)) st = fromOld(d); else throw 0; fillForm(); save(); render(); toast('已恢复备份') } catch (err) { toast('这个文件读不出来，确认是这里导出的备份') } e.target.value = '' };
  rd.readAsText(f);
});
addEventListener('hashchange', () => { const h = location.hash, k = modOf(h); if (k && k !== mod) { showMod(k, false); if (!/^#m[123]$/.test(h)) { const el = D.getElementById(decodeURIComponent(h.slice(1))); el && el.scrollIntoView() } } });
addEventListener('pagehide', () => { try { sessionStorage.setItem(POS, JSON.stringify({ mod, y: scrollY })) } catch (e) { } });
function hasData() { return Object.keys(GROUPS).some(g => Object.values(st[g]).some(o => Object.values(o).some(has))) || st.members.some(m => has(m.income) || has(m.age)) }
function stamp() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` }
function download(name, text, type) { const u = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); const a = D.createElement('a'); a.href = u; a.download = name; D.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000) }
let tt; function toast(t) { const el = D.querySelector('[data-toast]'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2600) }

/* ── 导出给 AI ── */
function toMd() {
  const r = calc(), L = [];
  L.push('# 我的家庭资产配置体检', '', `用慢复利「家庭资产配置体检」整理，${stamp()}。金额单位：万元。下面的数是按一套方法算出的参考，请帮我检查有没有漏掉的情况、哪些数值得再想想。不需要推荐具体的基金或产品。`, '');
  const fin = [['cash', defsOf('cash')], ['inv', defsOf('inv')]].flatMap(([g, defs]) => defs.filter(d => amt(g, d.k) > 0).map(d => `${d.name} ${amt(g, d.k)}（预期年化 ${rateOf(g, d)}%）`));
  L.push('## 资产总览', `- 家庭成员：${st.members.map(m => `${m.name || '家庭成员'}（${ROLEN[m.role]}，${m.age || '?'} 岁${n(m.income) ? `，税后年收入 ${n(m.income)}，${{ stable: '稳定', vol: '波动大', mkt: '跟着股市' }[m.itype]}` : ''}）`).join('、')}`,
    `- 金融资产：${fin.join('；') || '未填'}；加权约 ${pc(r.ret, 1)}`,
    `- 不好随时卖的：${defsOf('ill').filter(d => amt('ill', d.k) > 0).map(d => `${d.name} ${amt('ill', d.k)}${d.x && has(st.ill[d.k][d.x]) ? `（${d.xl} ${n(st.ill[d.k][d.x])}）` : ''}`).join('；') || '无'}（房子按九折记）`,
    `- 负债：${defsOf('debt').filter(d => has(st.debt[d.k].bal)).map(d => `${d.name} ${n(st.debt[d.k].bal)}（年化 ${n(st.debt[d.k].rate)}%，月还 ${n(st.debt[d.k].pay)}）`).join('；') || '无'}`,
    `- 每年收入 ${w(r.inc)}（其中利息和理财收益 ${w2(r.interest)}，资产带来的收入 ${w2(r.assetInc)}），支出 ${w(r.exp)}（其中贷款月还款 ${w(r.payY)}），结余 ${w(r.surplus)}${r.savPrem ? `（其中储蓄型保费 ${w2(r.savPrem)}）` : ''}；还掉的贷款本金约 ${w(r.principal)}；储蓄率 ${pc(r.saveR)}，自由储蓄率 ${pc(r.freeR)}；每月必需流出 ${w2(r.M)}`,
    `- 计划：${nv(st.retire, 60)} 岁退休，养老金每年 ${has(st.pension) ? n(st.pension) : '未填'}；${r.plans.map(p => `${p.year} 年起 ${p.item || USEN[p.use]}（${USEN[p.use]}）${p.amt}（${{ once: '一次性', exp: `每年支出，${p.years} 年`, inc: `每年收入，${p.years} 年` }[p.kind]}${p.sure === '0' ? '，还不确定' : ''}）`).join('；') || '没有其他大事'}`,
    `- 投资偏好：${r.risk.done ? `四道题 ${r.risk.score} 分，建议「${TIER[r.risk.sugg].name}」` : '没答完'}${st.tier ? `，自己选了「${r.T.name}」` : ''}`);
  L.push('', '## 阶段', `- 现在在「${r.stages[r.stage].name}」；长期的钱 ${w(r.longTotal)}，财务自由数字 ${w(r.fi)}（${pc(r.prog, 1)}）`);
  L.push('', '## 保障', ...r.ins.filter(o => o.lifeNeed !== undefined).map(o => `- ${o.m.name}：寿险需要 ${w(o.lifeNeed)}，已有 ${w(n(o.m.life))}；重疾需要 ${w(o.ciNeed)}，已有 ${w(n(o.m.ci))}`));
  if (r.insGap) L.push(`- 还缺的险种：${r.miss.filter(x => x.lack.length).map(x => `${x.m.name} ${x.lack.map(k => INSN[k]).join('、')}`).join('；')}`);
  L.push('', '## 配置', `- 类型：${r.T.name}；按 ${r.age} 岁算`, `- 四个账户：活钱 ${w(r.E)}（${r.months} 个月），稳钱 ${w(r.W)}，长钱 ${w(r.long)}${r.H ? `；先还高息负债 ${w(r.H)}` : ''}`,
    `- 长钱里股票 ${r.s}%，约 ${w(r.stock)}；跌一半少 ${w(r.dd)}`, `- 黄金上限 ${w(r.goldCap)}；加密资产上限 ${w(r.cryptoCap)}；美元下限 ${w(r.usdLow)}`);
  if (r.er.length || r.sr.length) L.push(`- 提醒：${[...r.er, ...r.sr].join('、')}`);
  L.push(`- 投资政策书：股票类 ${r.tStock}%，黄金 ${r.tGold}%，加密资产 ${r.tCrypto}%，现金和债券类 ${Math.round(r.tRest)}%；每年 ${st.ipsMonth} 月检查`);
  [['ips1', '这笔钱为了什么'], ['ips3', '谁来决定'], ['ips4', '对收益的预期'], ['ips7', '工具和禁区'], ['ips8', '执行规则']].forEach(([k, t]) => st[k] && L.push(`- ${t}：${st[k]}`));
  if (r.age > 0) { const mid = simulate(r, 0); L.push('', '## 往后推（中间情景）', `- 假设：${nv(st.retire, 60)} 岁退休，工资每年涨 ${nv(st.gs, 2)}%，支出每年涨 ${nv(st.ge, 2)}%，通胀 ${nv(st.infl, 2)}%，组合收益约 ${pc(mid.rp, 1)}`, `- ${mid.broke ? `${mid.broke} 岁左右钱用完` : `够用到 ${nv(st.endAge, 90)} 岁`}`) }
  return L.join('\n') + '\n';
}

/* ── 启动 ── */
const ms = D.querySelector('[data-k="ipsMonth"]');
if (ms) ms.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} 月</option>`).join('');
try { history.scrollRestoration = 'manual' } catch (e) { }
const anchor = !/^#m[12]$/.test(location.hash) && location.hash.length > 1 && D.getElementById(decodeURIComponent(location.hash.slice(1)));
fillForm(); render(); showMod(mod, false);
const restore = () => { if (anchor) anchor.scrollIntoView({ behavior: 'instant' }); else if (pos0 && pos0.mod === mod) window.scrollTo({ top: pos0.y, behavior: 'instant' }) };
if (D.readyState === 'complete') requestAnimationFrame(restore); else addEventListener('load', () => requestAnimationFrame(restore), { once: true });
})();
