import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Trash2, AlertTriangle, X, Circle, Wallet, Eye, EyeOff, Coffee, Copy, Check } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

const CATEGORIES = [
  'Match Winner', 'Over/Under', 'Both Teams to Score',
  'Correct Score', 'Handicap', 'Accumulator', 'Other',
];

const DEFAULT_SETTINGS = {
  currency: '₦',
  lossLimitWeekly: 0,
  stakeAlertMultiplier: 2.5,
};

const BETS_KEY = 'matchday-ledger-bets';
const SETTINGS_KEY = 'matchday-ledger-settings';
const PLATFORMS_KEY = 'matchday-ledger-platforms';

const SUPPORT_ACCOUNTS = [
  { bank: 'Union Bank', accountNumber: '0144128799', accountName: 'Omosanyin Elijah Ayomide' },
  { bank: 'Opay', accountNumber: '8145686089', accountName: 'Omosanyin Elijah Ayomide' },
];

// Mirrors the :root variables in App.css. Charts are drawn with SVG and can't
// read CSS variables directly, so these are the one other place to edit colors —
// keep this in sync with the :root block at the top of App.css.
const CHART_COLORS = {
  line: '#272E20',
  dim: '#565D4B',
  dimmer: '#818A76',
  surface2: '#181D14',
  green: '#3DDC84',
  red: '#EA5B4E',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function profitFor(bet) {
  if (bet.result === 'won') return +(bet.stake * (bet.odds - 1)).toFixed(2);
  if (bet.result === 'lost') return -bet.stake;
  return 0;
}

function fmt(n, symbol) {
  const sign = n < 0 ? '-' : '';
  const formatted = Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${symbol}${formatted}`;
}

function fmtMasked(n, symbol, visible) {
  if (visible) return fmt(n, symbol);
  return `${symbol}••••••`;
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function ScoreTile({ label, value, sub, colorClass }) {
  return (
    <div className="score-tile">
      <div className="score-label">{label}</div>
      <div className={`score-value ${colorClass || ''}`}>{value}</div>
      {sub ? <div className="score-sub">{sub}</div> : null}
    </div>
  );
}

function TickerRow({ bet, symbol, platformName, onSetResult, onRemove }) {
  const profit = profitFor(bet);
  let resultClass = 'result-pending';
  let resultLabel = 'PENDING';
  if (bet.result === 'won') { resultClass = 'result-won'; resultLabel = `WON ${fmt(profit, symbol)}`; }
  if (bet.result === 'lost') { resultClass = 'result-lost'; resultLabel = `LOST ${fmt(profit, symbol)}`; }
  if (bet.result === 'void') { resultClass = 'result-void'; resultLabel = 'VOID'; }

  return (
    <div className="ticker-row">
      <div className="ticker-info">
        <span className="ticker-date">{formatDate(bet.date)}</span>
        <span className="platform-tag">{platformName || 'Unknown'}</span>
        <span className="ticker-match">{bet.competition}</span>
        <span className="ticker-market">{bet.market}</span>
      </div>
      <div className="ticker-actions">
        <span className="ticker-stake">
          {symbol}{bet.stake.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ {bet.odds.toFixed(2)}
        </span>
        {bet.result === 'pending' ? (
          <div className="result-buttons">
            <button className="result-btn btn-won" onClick={() => onSetResult(bet.id, 'won')}>WON</button>
            <button className="result-btn btn-lost" onClick={() => onSetResult(bet.id, 'lost')}>LOST</button>
            <button className="result-btn btn-void" onClick={() => onSetResult(bet.id, 'void')}>VOID</button>
          </div>
        ) : (
          <span className={`result-label ${resultClass}`}>{resultLabel}</span>
        )}
        <button className="delete-btn" onClick={() => onRemove(bet.id)} aria-label="Delete bet">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function SupportAccountRow({ account, onCopy, copied }) {
  return (
    <div className="support-account">
      <div className="support-account-bank">{account.bank}</div>
      <div className="support-account-line">
        <span className="support-account-number">{account.accountNumber}</span>
        <button className="copy-btn" onClick={() => onCopy(account.accountNumber)}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div className="support-account-name">{account.accountName}</div>
    </div>
  );
}

export default function App() {
  const [bets, setBets] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [viewPlatform, setViewPlatform] = useState('all');
  const [tickerExpanded, setTickerExpanded] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    competition: '',
    market: CATEGORIES[0],
    stake: '',
    odds: '',
    platformId: '',
  });

  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformAmount, setNewPlatformAmount] = useState('');
  const [fundsFormOpenId, setFundsFormOpenId] = useState(null);
  const [fundsFormMode, setFundsFormMode] = useState('add'); // 'add' | 'withdraw'
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsError, setFundsError] = useState('');

  // Balance visibility defaults to hidden every time the app opens — a quick
  // privacy toggle for glancing at the app around other people.
  const [balanceVisible, setBalanceVisible] = useState(false);

  const [showSupport, setShowSupport] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(null);

  const copyAccountNumber = async (number) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(n => (n === number ? null : n)), 2000);
    } catch (e) { /* clipboard blocked in this browser */ }
  };

  // Load saved data once, when the app first opens
  useEffect(() => {
    try {
      const savedBets = localStorage.getItem(BETS_KEY);
      if (savedBets) setBets(JSON.parse(savedBets));
    } catch (e) { /* nothing saved yet */ }
    try {
      const savedPlatforms = localStorage.getItem(PLATFORMS_KEY);
      if (savedPlatforms) setPlatforms(JSON.parse(savedPlatforms));
    } catch (e) { /* nothing saved yet */ }
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
    } catch (e) { /* nothing saved yet */ }
  }, []);

  useEffect(() => { localStorage.setItem(BETS_KEY, JSON.stringify(bets)); }, [bets]);
  useEffect(() => { localStorage.setItem(PLATFORMS_KEY, JSON.stringify(platforms)); }, [platforms]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  // Keep the bet-form platform selector pointed at a real platform once one exists
  useEffect(() => {
    if (!form.platformId && platforms.length > 0) {
      setForm(f => ({ ...f, platformId: platforms[0].id }));
    }
  }, [platforms, form.platformId]);

  useEffect(() => { setTickerExpanded(false); }, [viewPlatform]);

  // All settled bets, regardless of which platform is currently being viewed.
  // Platform-level stats and the loss-limit safety check always use this —
  // filtering the view should never hide real risk or break other platforms' numbers.
  const allDecided = useMemo(() => bets.filter(b => b.result === 'won' || b.result === 'lost'), [bets]);

  // Settled bets scoped to whatever the "Viewing" dropdown is set to — this is
  // what drives the scoreboard, the balance chart, and the ROI-by-market chart.
  const decided = useMemo(() => {
    if (viewPlatform === 'all') return allDecided;
    return allDecided.filter(b => b.platformId === viewPlatform);
  }, [allDecided, viewPlatform]);

  const platformName = (id) => platforms.find(p => p.id === id)?.name;

  const totalLoaded = (p) => p.deposits.reduce((s, d) => s + (d.type === 'withdrawal' ? -d.amount : d.amount), 0);
  const platformDecided = (id) => allDecided.filter(b => b.platformId === id);
  const platformProfit = (id) => platformDecided(id).reduce((s, b) => s + profitFor(b), 0);
  const platformStaked = (id) => platformDecided(id).reduce((s, b) => s + b.stake, 0);

  const platformStats = useMemo(() => platforms.map(p => {
    const loaded = totalLoaded(p);
    const profit = platformProfit(p.id);
    const staked = platformStaked(p.id);
    return {
      ...p,
      loaded,
      profit,
      staked,
      balance: loaded + profit,
      roi: staked > 0 ? +((profit / staked) * 100).toFixed(1) : 0,
    };
  }), [platforms, allDecided]);

  // Loaded amount scoped to the current view: all platforms combined, or just the selected one.
  const viewLoaded = useMemo(() => {
    if (viewPlatform === 'all') return platformStats.reduce((s, p) => s + p.loaded, 0);
    return platformStats.find(p => p.id === viewPlatform)?.loaded || 0;
  }, [platformStats, viewPlatform]);

  const totalStaked = useMemo(() => decided.reduce((s, b) => s + b.stake, 0), [decided]);
  const totalProfit = useMemo(() => decided.reduce((s, b) => s + profitFor(b), 0), [decided]);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const wins = decided.filter(b => b.result === 'won').length;
  const strikeRate = decided.length ? (wins / decided.length) * 100 : 0;
  const viewBalance = viewLoaded + totalProfit;
  const avgStake = allDecided.length ? allDecided.reduce((s, b) => s + b.stake, 0) / allDecided.length : 0;

  const streak = useMemo(() => {
    const chron = [...decided].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!chron.length) return { type: null, count: 0 };
    const type = chron[chron.length - 1].result;
    let count = 0;
    for (let i = chron.length - 1; i >= 0; i--) {
      if (chron[i].result === type) count++; else break;
    }
    return { type, count };
  }, [decided]);

  const weeklyLoss = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return allDecided
      .filter(b => new Date(b.date).getTime() >= weekAgo && b.result === 'lost')
      .reduce((s, b) => s + b.stake, 0);
  }, [allDecided]);

  const limitHit = settings.lossLimitWeekly > 0 && weeklyLoss >= settings.lossLimitWeekly;

  // Balance over time, scoped to the current view: all platforms' deposits + results,
  // or just the selected platform's, merged into one running timeline.
  const balanceHistory = useMemo(() => {
    const relevantPlatforms = viewPlatform === 'all' ? platforms : platforms.filter(p => p.id === viewPlatform);
    const depositEvents = relevantPlatforms.flatMap(p => p.deposits.map(d => ({ date: d.date, delta: d.type === 'withdrawal' ? -d.amount : d.amount, key: `dep-${d.id}` })));
    const betEvents = decided.map(b => ({ date: b.date, delta: profitFor(b), key: `bet-${b.id}` }));
    const events = [...depositEvents, ...betEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    const points = [{ x: 'START', balance: 0 }];
    events.forEach((e, i) => {
      running += e.delta;
      points.push({ x: `${i + 1}`, balance: +running.toFixed(2) });
    });
    return points;
  }, [platforms, decided, viewPlatform]);

  const categoryStats = useMemo(() => {
    const map = {};
    decided.forEach(b => {
      if (!map[b.market]) map[b.market] = { market: b.market, staked: 0, profit: 0 };
      map[b.market].staked += b.stake;
      map[b.market].profit += profitFor(b);
    });
    return Object.values(map)
      .map(m => ({ ...m, roi: m.staked ? +((m.profit / m.staked) * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.roi - a.roi);
  }, [decided]);

  const stakeNum = parseFloat(form.stake);
  const stakeIsHigh = !!stakeNum && allDecided.length >= 3 && stakeNum > avgStake * settings.stakeAlertMultiplier;

  const ticker = useMemo(() => {
    const sorted = [...bets].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
    if (viewPlatform === 'all') return sorted;
    return sorted.filter(b => b.platformId === viewPlatform);
  }, [bets, viewPlatform]);
  const visibleTicker = tickerExpanded ? ticker : ticker.slice(0, 3);

  const addPlatform = (e) => {
    e.preventDefault();
    setError('');
    const name = newPlatformName.trim();
    const amount = parseFloat(newPlatformAmount);
    if (!name) { setError('Give the platform a name.'); return; }
    if (!amount || amount < 0) { setError('Starting amount must be zero or more.'); return; }
    const platform = { id: uid(), name, deposits: amount > 0 ? [{ id: uid(), date: new Date().toISOString().slice(0, 10), amount, type: 'deposit' }] : [] };
    setPlatforms(prev => [...prev, platform]);
    setNewPlatformName('');
    setNewPlatformAmount('');
  };

  const openFundsForm = (platformId, mode) => {
    setFundsFormOpenId(platformId);
    setFundsFormMode(mode);
    setFundsAmount('');
    setFundsError('');
  };

  const submitFunds = (platformId) => {
    setFundsError('');
    const amount = parseFloat(fundsAmount);
    if (!amount || amount <= 0) { setFundsError('Enter an amount above zero.'); return; }
    if (fundsFormMode === 'withdraw') {
      const p = platformStats.find(pl => pl.id === platformId);
      if (p && amount > p.balance) { setFundsError(`Can't withdraw more than the current balance (${fmt(p.balance, settings.currency)}).`); return; }
    }
    setPlatforms(prev => prev.map(p => p.id === platformId
      ? { ...p, deposits: [...p.deposits, { id: uid(), date: new Date().toISOString().slice(0, 10), amount, type: fundsFormMode === 'withdraw' ? 'withdrawal' : 'deposit' }] }
      : p));
    setFundsAmount('');
    setFundsFormOpenId(null);
  };

  const removePlatform = (platformId) => {
    const hasBets = bets.some(b => b.platformId === platformId);
    if (hasBets) return;
    setPlatforms(prev => prev.filter(p => p.id !== platformId));
  };

  const addBet = (e) => {
    e.preventDefault();
    setError('');
    if (platforms.length === 0) { setError('Add a platform below before logging a bet.'); return; }
    const stake = parseFloat(form.stake);
    const odds = parseFloat(form.odds);
    if (!form.platformId) { setError('Choose which platform this bet was placed on.'); return; }
    if (!form.competition.trim()) { setError('Add the match or event.'); return; }
    if (!stake || stake <= 0) { setError('Stake must be a positive number.'); return; }
    if (!odds || odds <= 1) { setError('Odds must be decimal and greater than 1.00.'); return; }
    const bet = {
      id: uid(), date: form.date, competition: form.competition.trim(), market: form.market,
      stake, odds, result: 'pending', platformId: form.platformId,
    };
    setBets(prev => [bet, ...prev]);
    setForm({ ...form, competition: '', stake: '', odds: '' });
  };

  const setResult = (id, result) => setBets(prev => prev.map(b => (b.id === id ? { ...b, result } : b)));
  const removeBet = (id) => setBets(prev => prev.filter(b => b.id !== id));

  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setBets([]);
    setPlatforms([]);
    setConfirmClear(false);
    setShowSettings(false);
  };

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-title">MATCHDAY LEDGER</div>
          <div className="live-indicator">
            <Circle size={7} className="pulse-dot" />
            <span>LIVE · SEASON {new Date().getFullYear()}/{String(new Date().getFullYear() + 1).slice(2)}</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="settings-btn"
            onClick={() => setBalanceVisible(v => !v)}
            aria-label={balanceVisible ? 'Hide balance figures' : 'Show balance figures'}
            title={balanceVisible ? 'Hide balance figures' : 'Show balance figures'}
          >
            {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="view-selector-row">
        <span className="view-selector-label">VIEWING</span>
        <select className="view-selector" value={viewPlatform} onChange={e => setViewPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {limitHit && (
        <div className="warning-banner">
          <AlertTriangle size={15} className="warning-icon" />
          <div>
            <div className="warning-title">You've hit your weekly loss limit</div>
            <div className="warning-body">
              {fmt(-weeklyLoss, settings.currency)} lost across all platforms in the last 7 days against a {fmt(-settings.lossLimitWeekly, settings.currency)} limit.
              Consider taking a break before logging another bet.
            </div>
          </div>
        </div>
      )}

      <div className="scoreboard">
        <ScoreTile label="Total Balance" value={fmtMasked(viewBalance, settings.currency, balanceVisible)} colorClass={balanceVisible ? (viewBalance >= viewLoaded ? 'text-green' : 'text-red') : ''} />
        <ScoreTile
          label="Total Loaded"
          value={fmtMasked(viewLoaded, settings.currency, balanceVisible)}
          sub={viewPlatform === 'all' ? `${platforms.length} platform${platforms.length === 1 ? '' : 's'}` : platformName(viewPlatform)}
        />
        <ScoreTile label="P/L" value={fmtMasked(totalProfit, settings.currency, balanceVisible)} sub={`staked ${fmtMasked(totalStaked, settings.currency, balanceVisible)}`} colorClass={balanceVisible ? (totalProfit >= 0 ? 'text-green' : 'text-red') : ''} />
        <ScoreTile label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} colorClass={roi >= 0 ? 'text-green' : 'text-red'} />
        <ScoreTile label="Strike Rate" value={`${strikeRate.toFixed(0)}%`} sub={`${wins}W ${decided.length - wins}L`} />
        <ScoreTile
          label="Streak"
          value={streak.type ? `${streak.type === 'won' ? 'W' : 'L'}${streak.count}` : '—'}
          colorClass={streak.type === 'won' ? 'text-green' : streak.type === 'lost' ? 'text-red' : ''}
        />
      </div>

      <div className="grid-main">
        <div className="col">
          {/* Platforms */}
          <div className="card">
            <div className="card-label">Platforms</div>
            {platformStats.length > 0 && (
              <div className="platform-list">
                {platformStats.map(p => (
                  <div key={p.id} className={`platform-item ${viewPlatform === p.id ? 'platform-item-active' : ''}`}>
                    <div className="platform-item-top">
                      <button className="platform-item-name" onClick={() => setViewPlatform(p.id)}>
                        <Wallet size={13} /> {p.name}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => removePlatform(p.id)}
                        title={bets.some(b => b.platformId === p.id) ? "Can't remove — bets are logged on this platform" : 'Remove platform'}
                        style={{ opacity: bets.some(b => b.platformId === p.id) ? 0.3 : 1 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="platform-item-stats">
                      <span>Loaded <b>{fmtMasked(p.loaded, settings.currency, balanceVisible)}</b></span>
                      <span>Balance <b className={balanceVisible ? (p.profit >= 0 ? 'text-green' : 'text-red') : ''}>{fmtMasked(p.balance, settings.currency, balanceVisible)}</b></span>
                      <span>ROI <b className={p.roi >= 0 ? 'text-green' : 'text-red'}>{p.roi >= 0 ? '+' : ''}{p.roi}%</b></span>
                    </div>
                    {fundsFormOpenId === p.id ? (
                      <div className="add-funds-block">
                        <div className="add-funds-row">
                          <input
                            type="number" step="0.01"
                            placeholder={fundsFormMode === 'withdraw' ? 'Amount to withdraw' : 'Amount to add'}
                            autoFocus value={fundsAmount} onChange={e => setFundsAmount(e.target.value)}
                          />
                          <button className={fundsFormMode === 'withdraw' ? 'btn-small btn-small-red' : 'btn-small'} onClick={() => submitFunds(p.id)}>
                            {fundsFormMode === 'withdraw' ? 'Withdraw' : 'Add'}
                          </button>
                          <button className="btn-small-ghost" onClick={() => { setFundsFormOpenId(null); setFundsAmount(''); setFundsError(''); }}>Cancel</button>
                        </div>
                        {fundsError && <div className="error-text">{fundsError}</div>}
                      </div>
                    ) : (
                      <div className="funds-links">
                        <button className="link-btn" onClick={() => openFundsForm(p.id, 'add')}>+ Add funds</button>
                        <button className="link-btn link-btn-withdraw" onClick={() => openFundsForm(p.id, 'withdraw')}>− Withdraw</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addPlatform} className="form-row-2 platform-add-form">
              <input className="platform-name"
                type="text" placeholder="Platform name (e.g. SportyBet)"
                value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)}
              />
              <div className="platform-add-amount">
                <input
                  type="number" step="0.01" placeholder={`Starting amount (${settings.currency})`}
                  value={newPlatformAmount} onChange={e => setNewPlatformAmount(e.target.value)}
                />
                <button type="submit" className="btn-small"><Plus size={13} /></button>
              </div>
            </form>
          </div>

          {/* Bet form */}
          <div className="card">
            <div className="card-label">Log a bet</div>
            <form onSubmit={addBet} className="bet-form">
              <div className="form-row-2">
                <div className="field">
                  <label>DATE</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="field">
                  <label>PLATFORM</label>
                  <select value={form.platformId} onChange={e => setForm({ ...form, platformId: e.target.value })} disabled={platforms.length === 0}>
                    {platforms.length === 0 && <option value="">Add a platform first</option>}
                    {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div className="field">
                  <label>MATCH / EVENT</label>
                  <input type="text" placeholder="e.g. Arsenal v Chelsea" value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} />
                </div>
                <div className="field">
                  <label>MARKET</label>
                  <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div className="field">
                  <label>STAKE ({settings.currency})</label>
                  <input
                    type="number" step="0.01" placeholder="1000" value={form.stake}
                    onChange={e => setForm({ ...form, stake: e.target.value })}
                    className={stakeIsHigh ? 'input-warning' : ''}
                  />
                </div>
                <div className="field">
                  <label>ODDS (DECIMAL)</label>
                  <input type="number" step="0.01" placeholder="2.10" value={form.odds} onChange={e => setForm({ ...form, odds: e.target.value })} />
                </div>
              </div>
              {stakeIsHigh && (
                <div className="stake-warning">
                  <AlertTriangle size={12} /> That's over {settings.stakeAlertMultiplier}× your average stake ({fmt(avgStake, settings.currency)}).
                </div>
              )}
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn-primary">
                <Plus size={14} /> ADD TO LEDGER
              </button>
            </form>
          </div>

          {/* Ticker */}
          <div className="card ticker-card">
            <div className="ticker-header">
              <div className="ticker-header-left">
                <Circle size={6} className="pulse-dot" />
                <span>BET LOG</span>
              </div>
              {ticker.length > 0 && (
                <span className="ticker-count">{ticker.length} bet{ticker.length === 1 ? '' : 's'}</span>
              )}
            </div>
            <div className="ticker-scroll">
              {ticker.length === 0 ? (
                <div className="ticker-empty">Nothing on the board yet — log your first bet above and it'll print here.</div>
              ) : (
                visibleTicker.map(bet => (
                  <TickerRow key={bet.id} bet={bet} symbol={settings.currency} platformName={platformName(bet.platformId)} onSetResult={setResult} onRemove={removeBet} />
                ))
              )}
            </div>
            {ticker.length > 3 && (
              <button className="show-more-btn" onClick={() => setTickerExpanded(e => !e)}>
                {tickerExpanded ? 'Show less' : `Show more (${ticker.length - 3})`}
              </button>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-label">
              {viewPlatform === 'all' ? 'Combined balance over time' : `${platformName(viewPlatform)} balance over time`}
            </div>
            {balanceHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={balanceHistory} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.line} vertical={false} />
                  <XAxis dataKey="x" tick={{ fill: CHART_COLORS.dim, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
                  <YAxis tick={{ fill: CHART_COLORS.dim, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: CHART_COLORS.surface2, border: `1px solid ${CHART_COLORS.line}`, borderRadius: 4, fontSize: 12 }}
                    labelStyle={{ color: CHART_COLORS.dimmer }}
                    formatter={(v) => [fmt(v, settings.currency), 'Balance']}
                  />
                  <Line type="monotone" dataKey="balance" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">Add a platform and settle a few bets to see the line move.</div>
            )}
          </div>

          {viewPlatform === 'all' && (
            <div className="card">
              <div className="card-label">ROI by platform</div>
              {platformStats.filter(p => p.staked > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(140, platformStats.length * 34)}>
                  <BarChart data={platformStats} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.line} horizontal={false} />
                    <XAxis type="number" tick={{ fill: CHART_COLORS.dim, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} unit="%" />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fill: CHART_COLORS.dimmer, fontSize: 10.5 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: CHART_COLORS.surface2, border: `1px solid ${CHART_COLORS.line}`, borderRadius: 4, fontSize: 12 }}
                      formatter={(v) => [`${v}%`, 'ROI']}
                    />
                    <Bar dataKey="roi" radius={[0, 3, 3, 0]}>
                      {platformStats.map((p, i) => (
                        <Cell key={i} fill={p.roi >= 0 ? CHART_COLORS.green : CHART_COLORS.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">Settle a few bets on each platform to compare them.</div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-label">ROI by market</div>
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(140, categoryStats.length * 34)}>
                <BarChart data={categoryStats} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.line} horizontal={false} />
                  <XAxis type="number" tick={{ fill: CHART_COLORS.dim, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} unit="%" />
                  <YAxis dataKey="market" type="category" width={110} tick={{ fill: CHART_COLORS.dimmer, fontSize: 10.5 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: CHART_COLORS.surface2, border: `1px solid ${CHART_COLORS.line}`, borderRadius: 4, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'ROI']}
                  />
                  <Bar dataKey="roi" radius={[0, 3, 3, 0]}>
                    {categoryStats.map((c, i) => (
                      <Cell key={i} fill={c.roi >= 0 ? CHART_COLORS.green : CHART_COLORS.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">Settle a few bets to see which markets actually pay off.</div>
            )}
          </div>
        </div>
      </div>

      <div className="support-banner">
        <div className="support-banner-text">
          <Coffee size={16} />
          <span>Matchday Ledger is free to use. If it's helped you keep track this season, you can buy Elijah a meal.</span>
        </div>
        <button className="support-banner-btn" onClick={() => setShowSupport(true)}>Buy Elijah a Meal</button>
      </div>

      {showSupport && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span>BUY ELIJAH A MEAL</span>
              <button onClick={() => setShowSupport(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="support-intro">
                Thanks for even considering it — this app is free and always will be. Send whatever feels right to either account below.
              </div>
              {SUPPORT_ACCOUNTS.map(acc => (
                <SupportAccountRow key={acc.accountNumber} account={acc} onCopy={copyAccountNumber} copied={copiedNumber === acc.accountNumber} />
              ))}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span>SETTINGS</span>
              <button onClick={() => { setShowSettings(false); setConfirmClear(false); }} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>CURRENCY SYMBOL</label>
                <input
                  type="text" value={settings.currency} maxLength={3}
                  onChange={e => setSettings({ ...settings, currency: e.target.value || '₦' })}
                />
              </div>
              <div className="field">
                <label>WEEKLY LOSS LIMIT (0 = OFF)</label>
                <input
                  type="number" value={settings.lossLimitWeekly}
                  onChange={e => setSettings({ ...settings, lossLimitWeekly: parseFloat(e.target.value) || 0 })}
                />
                <div className="field-hint">Combined across all platforms — warns once losses in a rolling 7 days reach this.</div>
              </div>
              <div className="field">
                <label>STAKE ALERT MULTIPLIER</label>
                <input
                  type="number" step="0.1" value={settings.stakeAlertMultiplier}
                  onChange={e => setSettings({ ...settings, stakeAlertMultiplier: parseFloat(e.target.value) || 0 })}
                />
                <div className="field-hint">Flags a new bet when its stake is this many times your average.</div>
              </div>
              <div className="modal-danger">
                <button className={confirmClear ? 'btn-danger-confirm' : 'btn-danger'} onClick={clearAll}>
                  {confirmClear ? 'Click again to permanently clear all data' : 'Clear all bets & platforms'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
