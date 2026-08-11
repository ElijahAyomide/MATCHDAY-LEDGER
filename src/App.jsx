import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Trash2, AlertTriangle, X, Circle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

const CATEGORIES = [
  'Match Winner', 'Over/Under', 'Both Teams to Score',
  'Correct Score', 'Handicap', 'Accumulator', 'Other',
];

const DEFAULT_SETTINGS = {
  startingBankroll: 500,
  currency: '£',
  lossLimitWeekly: 0,
  stakeAlertMultiplier: 2.5,
};

const BETS_KEY = 'matchday-ledger-bets';
const SETTINGS_KEY = 'matchday-ledger-settings';

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
  return `${sign}${symbol}${Math.abs(n).toFixed(2)}`;
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

function TickerRow({ bet, symbol, onSetResult, onRemove }) {
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
        <span className="ticker-match">{bet.competition}</span>
        <span className="ticker-market">{bet.market}</span>
      </div>
      <div className="ticker-actions">
        <span className="ticker-stake">{symbol}{bet.stake.toFixed(2)} @ {bet.odds.toFixed(2)}</span>
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

export default function App() {
  const [bets, setBets] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    competition: '',
    market: CATEGORIES[0],
    stake: '',
    odds: '',
  });

  // Load saved data once, when the app first opens
  useEffect(() => {
    try {
      const savedBets = localStorage.getItem(BETS_KEY);
      if (savedBets) setBets(JSON.parse(savedBets));
    } catch (e) { /* nothing saved yet */ }
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
    } catch (e) { /* nothing saved yet */ }
  }, []);

  // Save any time bets or settings change
  useEffect(() => {
    localStorage.setItem(BETS_KEY, JSON.stringify(bets));
  }, [bets]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const decided = useMemo(() => bets.filter(b => b.result === 'won' || b.result === 'lost'), [bets]);

  const totalStaked = useMemo(() => decided.reduce((s, b) => s + b.stake, 0), [decided]);
  const totalProfit = useMemo(() => decided.reduce((s, b) => s + profitFor(b), 0), [decided]);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const wins = decided.filter(b => b.result === 'won').length;
  const strikeRate = decided.length ? (wins / decided.length) * 100 : 0;
  const bankroll = settings.startingBankroll + totalProfit;
  const avgStake = decided.length ? decided.reduce((s, b) => s + b.stake, 0) / decided.length : 0;

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
    return decided
      .filter(b => new Date(b.date).getTime() >= weekAgo && b.result === 'lost')
      .reduce((s, b) => s + b.stake, 0);
  }, [decided]);

  const limitHit = settings.lossLimitWeekly > 0 && weeklyLoss >= settings.lossLimitWeekly;

  const bankrollHistory = useMemo(() => {
    const chron = [...decided].sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = settings.startingBankroll;
    const points = [{ x: 'START', bankroll: +running.toFixed(2) }];
    chron.forEach((b, i) => {
      running += profitFor(b);
      points.push({ x: `${i + 1}`, bankroll: +running.toFixed(2) });
    });
    return points;
  }, [decided, settings.startingBankroll]);

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
  const stakeIsHigh = !!stakeNum && decided.length >= 3 && stakeNum > avgStake * settings.stakeAlertMultiplier;

  const ticker = [...bets].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));

  const addBet = (e) => {
    e.preventDefault();
    setError('');
    const stake = parseFloat(form.stake);
    const odds = parseFloat(form.odds);
    if (!form.competition.trim()) { setError('Add the match or event.'); return; }
    if (!stake || stake <= 0) { setError('Stake must be a positive number.'); return; }
    if (!odds || odds <= 1) { setError('Odds must be decimal and greater than 1.00.'); return; }
    const bet = { id: uid(), date: form.date, competition: form.competition.trim(), market: form.market, stake, odds, result: 'pending' };
    setBets(prev => [bet, ...prev]);
    setForm({ ...form, competition: '', stake: '', odds: '' });
  };

  const setResult = (id, result) => setBets(prev => prev.map(b => (b.id === id ? { ...b, result } : b)));
  const removeBet = (id) => setBets(prev => prev.filter(b => b.id !== id));

  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setBets([]);
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
        <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
          <Settings size={16} />
        </button>
      </div>

      {limitHit && (
        <div className="warning-banner">
          <AlertTriangle size={15} className="warning-icon" />
          <div>
            <div className="warning-title">You've hit your weekly loss limit</div>
            <div className="warning-body">
              {fmt(-weeklyLoss, settings.currency)} lost in the last 7 days against a {fmt(-settings.lossLimitWeekly, settings.currency)} limit.
              Consider taking a break before logging another bet.
            </div>
          </div>
        </div>
      )}

      <div className="scoreboard">
        <ScoreTile label="Bankroll" value={fmt(bankroll, settings.currency)} colorClass={bankroll >= settings.startingBankroll ? 'text-green' : 'text-red'} />
        <ScoreTile label="Staked" value={fmt(totalStaked, settings.currency)} />
        <ScoreTile label="P/L" value={fmt(totalProfit, settings.currency)} colorClass={totalProfit >= 0 ? 'text-green' : 'text-red'} />
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
          <div className="card">
            <div className="card-label">Log a bet</div>
            <form onSubmit={addBet} className="bet-form">
              <div className="form-row-2">
                <div className="field">
                  <label>DATE</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="field">
                  <label>MARKET</label>
                  <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>MATCH / EVENT</label>
                <input type="text" placeholder="e.g. Arsenal v Chelsea" value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="field">
                  <label>STAKE ({settings.currency})</label>
                  <input
                    type="number" step="0.01" placeholder="10.00" value={form.stake}
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

          <div className="card ticker-card">
            <div className="ticker-header">
              <Circle size={6} className="pulse-dot" />
              <span>BET LOG</span>
            </div>
            <div className="ticker-scroll">
              {ticker.length === 0 ? (
                <div className="ticker-empty">Nothing on the board yet — log your first bet above and it'll print here.</div>
              ) : (
                ticker.map(bet => (
                  <TickerRow key={bet.id} bet={bet} symbol={settings.currency} onSetResult={setResult} onRemove={removeBet} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-label">Bankroll over time</div>
            {bankrollHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={bankrollHistory} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#272E20" vertical={false} />
                  <XAxis dataKey="x" tick={{ fill: '#565D4B', fontSize: 10 }} axisLine={{ stroke: '#272E20' }} tickLine={false} />
                  <YAxis tick={{ fill: '#565D4B', fontSize: 10 }} axisLine={{ stroke: '#272E20' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#181D14', border: '1px solid #272E20', borderRadius: 4, fontSize: 12 }}
                    labelStyle={{ color: '#818A76' }}
                    formatter={(v) => [fmt(v, settings.currency), 'Bankroll']}
                  />
                  <Line type="monotone" dataKey="bankroll" stroke="#3DDC84" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">Settle a few bets to see the line move.</div>
            )}
          </div>

          <div className="card">
            <div className="card-label">ROI by market</div>
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(140, categoryStats.length * 34)}>
                <BarChart data={categoryStats} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#272E20" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#565D4B', fontSize: 10 }} axisLine={{ stroke: '#272E20' }} tickLine={false} unit="%" />
                  <YAxis dataKey="market" type="category" width={110} tick={{ fill: '#818A76', fontSize: 10.5 }} axisLine={{ stroke: '#272E20' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#181D14', border: '1px solid #272E20', borderRadius: 4, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'ROI']}
                  />
                  <Bar dataKey="roi" radius={[0, 3, 3, 0]}>
                    {categoryStats.map((c, i) => (
                      <Cell key={i} fill={c.roi >= 0 ? '#3DDC84' : '#EA5B4E'} />
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
                <label>STARTING BANKROLL</label>
                <input
                  type="number" value={settings.startingBankroll}
                  onChange={e => setSettings({ ...settings, startingBankroll: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label>CURRENCY SYMBOL</label>
                <input
                  type="text" value={settings.currency} maxLength={3}
                  onChange={e => setSettings({ ...settings, currency: e.target.value || '£' })}
                />
              </div>
              <div className="field">
                <label>WEEKLY LOSS LIMIT (0 = OFF)</label>
                <input
                  type="number" value={settings.lossLimitWeekly}
                  onChange={e => setSettings({ ...settings, lossLimitWeekly: parseFloat(e.target.value) || 0 })}
                />
                <div className="field-hint">You'll see a warning banner once losses in a rolling 7 days reach this.</div>
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
                  {confirmClear ? 'Click again to permanently clear all bets' : 'Clear all bet history'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
