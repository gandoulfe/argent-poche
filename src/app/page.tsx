'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---- Types ----
interface Child {
  id: string;
  name: string;
  birthdate: string;
  allowance: { amount: number; frequency: 'monthly' | 'weekly'; day: number; startDate: string };
  goal?: { label: string; amount: number };
}
interface Transaction {
  id: string; childId: string; amount: number; label: string; date: string; note?: string;
}
interface AppData { children: Child[]; transactions: Transaction[] }

// ---- Utils ----
function calcAge(birthdate: string): number {
  const b = new Date(birthdate), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
function getAllowanceDates(child: Child): Date[] {
  const { allowance } = child;
  const start = new Date(allowance.startDate);
  const now = new Date(); now.setHours(23, 59, 59, 999);
  const dates: Date[] = [];
  if (allowance.frequency === 'monthly') {
    let d = new Date(start.getFullYear(), start.getMonth(), allowance.day);
    if (d < start) d.setMonth(d.getMonth() + 1);
    while (d <= now) { dates.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
  } else {
    const diff = (allowance.day - start.getDay() + 7) % 7;
    const d = new Date(start); d.setDate(d.getDate() + diff);
    while (d <= now) { dates.push(new Date(d)); d.setDate(d.getDate() + 7); }
  }
  return dates;
}
function calcBalance(child: Child, txs: Transaction[]): number {
  const earned = getAllowanceDates(child).length * child.allowance.amount;
  return earned + txs.filter(t => t.childId === child.id).reduce((s, t) => s + t.amount, 0);
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CHILD_COLORS = [
  { bg: '#7C5CBF', grad: 'linear-gradient(135deg,#7C5CBF,#9B6FD4)' },
  { bg: '#F0956A', grad: 'linear-gradient(135deg,#F0956A,#E07850)' },
  { bg: '#5BA4CF', grad: 'linear-gradient(135deg,#5BA4CF,#3A8ABF)' },
  { bg: '#6BBF8E', grad: 'linear-gradient(135deg,#6BBF8E,#4AA070)' },
];

// ---- Badges ----
interface Badge { emoji: string; label: string }
function getBadges(child: Child, txs: Transaction[], balance: number): Badge[] {
  const badges: Badge[] = [];
  const childTxs = txs.filter(t => t.childId === child.id);
  if (childTxs.length >= 1) badges.push({ emoji: '🌱', label: 'Premier pas' });
  if (childTxs.length >= 10) badges.push({ emoji: '📊', label: '10 transactions' });
  if (balance >= 20) badges.push({ emoji: '💰', label: '20€ épargnés' });
  if (balance >= 50) badges.push({ emoji: '🏆', label: '50€ épargnés' });
  if (balance >= 100) badges.push({ emoji: '👑', label: '100€ épargnés' });
  if (child.goal && balance >= child.goal.amount) badges.push({ emoji: '🎯', label: 'Objectif atteint !' });
  if (childTxs.filter(t => t.amount < 0).length >= 5) badges.push({ emoji: '🛒', label: '5 achats' });
  return badges;
}

// ---- Storage ----
async function loadData(): Promise<AppData> {
  const res = await fetch('/api/data');
  if (!res.ok) return { children: [], transactions: [] };
  return res.json();
}
async function saveData(data: AppData) {
  await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

// ---- Modal ----
const MODAL_OVERLAY = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };
const MODAL_SHEET = { initial: { y: '100%', opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: '100%', opacity: 0 }, transition: { duration: 0.25, ease: 'easeOut' as const } };
const MODAL_SHEET_TOP = { initial: { y: '-100%', opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: '-100%', opacity: 0 }, transition: { duration: 0.25, ease: 'easeOut' as const } };
const PAGE = { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.18, ease: 'easeOut' as const } };

function Modal({ title, onClose, children, position = 'bottom' }: { title: string; onClose: () => void; children: ReactNode; position?: 'top' | 'bottom' }) {
  const sheet = position === 'top' ? MODAL_SHEET_TOP : MODAL_SHEET;
  const align = position === 'top' ? 'items-start' : 'items-end sm:items-center';
  const radius = position === 'top' ? 'rounded-b-3xl sm:rounded-3xl' : 'rounded-t-3xl sm:rounded-3xl';
  return (
    <div className={`fixed inset-0 z-50 flex ${align} justify-center`}>
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} {...MODAL_OVERLAY} />
      <motion.div className={`relative bg-white ${radius} shadow-2xl w-full max-w-md z-10 flex flex-col`} style={{ maxHeight: '90dvh' }} {...sheet}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors text-lg">×</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  );
}

const inp = "w-full border border-gray-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50 focus:bg-white transition-all";
const lbl = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2";

// ---- Child Form ----
type CF = { name: string; birthdate: string; amount: string; freq: string; day: string; start: string };
function ChildForm({ initial, onSubmit, submitLabel }: { initial: CF; onSubmit: (v: CF) => void; submitLabel: string }) {
  const [v, setV] = useState(initial);
  const set = (k: keyof CF, val: string) => setV(f => ({ ...f, [k]: val }));
  return (
    <div className="space-y-4">
      <div><label className={lbl}>Prénom</label><input className={inp} value={v.name} onChange={e => set('name', e.target.value)} placeholder="Emma" autoFocus /></div>
      <div><label className={lbl}>Date de naissance</label><input type="date" className={inp} value={v.birthdate} onChange={e => set('birthdate', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Montant (€)</label><input type="number" className={inp} value={v.amount} onChange={e => set('amount', e.target.value)} placeholder="5" min="0" step="0.5" /></div>
        <div><label className={lbl}>Fréquence</label>
          <select className={inp} value={v.freq} onChange={e => setV(f => ({ ...f, freq: e.target.value, day: e.target.value === 'monthly' ? '5' : '1' }))}>
            <option value="monthly">Mensuel</option>
            <option value="weekly">Hebdo</option>
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>{v.freq === 'monthly' ? 'Jour du mois (1–28)' : 'Jour de la semaine'}</label>
        {v.freq === 'monthly'
          ? <input type="number" className={inp} value={v.day} onChange={e => set('day', e.target.value)} min="1" max="28" />
          : <select className={inp} value={v.day} onChange={e => set('day', e.target.value)}>{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>}
      </div>
      <div><label className={lbl}>Date de début</label><input type="date" className={inp} value={v.start} onChange={e => set('start', e.target.value)} /></div>
      <motion.button onClick={() => onSubmit(v)} disabled={!v.name || !v.birthdate || !v.amount || !v.start} whileTap={{ scale: 0.97 }} className="w-full text-white font-black py-4 rounded-2xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed mt-2" style={{ background: 'linear-gradient(135deg,#7C5CBF,#9B6FD4)' }}>
        {submitLabel}
      </motion.button>
    </div>
  );
}

const EMPTY_CF: CF = { name: '', birthdate: '', amount: '', freq: 'monthly', day: '5', start: '' };
function childToCF(c: Child): CF {
  return { name: c.name, birthdate: c.birthdate, amount: String(c.allowance.amount), freq: c.allowance.frequency, day: String(c.allowance.day), start: c.allowance.startDate };
}
function cfToChild(id: string, v: CF, goal?: Child['goal']): Child {
  return { id, name: v.name.trim(), birthdate: v.birthdate, allowance: { amount: parseFloat(v.amount), frequency: v.freq as 'monthly' | 'weekly', day: parseInt(v.day), startDate: v.start }, ...(goal ? { goal } : {}) };
}

// ---- App ----
export default function App() {
  const [data, setData] = useState<AppData>({ children: [], transactions: [] });
  const [view, setView] = useState<'home' | 'child'>('home');
  const [childId, setChildId] = useState<string | null>(null);
  const [modal, setModal] = useState<'addChild' | 'editChild' | 'addTx' | 'goal' | null>(null);
  const loaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState({ amount: '', label: '', note: '', date: today(), type: 'purchase' });
  const [gf, setGf] = useState({ label: '', amount: '' });

  useEffect(() => { loadData().then(d => { setData(d); loaded.current = true; setLoading(false); }); }, []);
  useEffect(() => { if (loaded.current) saveData(data); }, [data]);

  const child = data.children.find(c => c.id === childId);
  const childIdx = data.children.findIndex(c => c.id === childId);
  const color = CHILD_COLORS[childIdx >= 0 ? childIdx % CHILD_COLORS.length : 0];
  const balance = child ? calcBalance(child, data.transactions) : 0;
  const badges = child ? getBadges(child, data.transactions, balance) : [];

  // Merge manual txs + allowance dates into one sorted list
  const mergedHistory: Array<{ type: 'tx'; tx: Transaction } | { type: 'allowance'; date: Date }> = child
    ? [
        ...data.transactions.filter(t => t.childId === childId).map(tx => ({ type: 'tx' as const, tx })),
        ...getAllowanceDates(child).map(date => ({ type: 'allowance' as const, date })),
      ].sort((a, b) => {
        const da = a.type === 'tx' ? a.tx.date : a.date.toISOString().split('T')[0];
        const db = b.type === 'tx' ? b.tx.date : b.date.toISOString().split('T')[0];
        return db.localeCompare(da);
      })
    : [];

  function addChild(v: CF) {
    if (!v.name.trim() || !v.birthdate || !v.amount || !v.start) return;
    setData(d => ({ ...d, children: [...d.children, cfToChild(crypto.randomUUID(), v)] }));
    setModal(null);
  }
  function editChild(v: CF) {
    if (!childId || !v.name.trim() || !v.birthdate || !v.amount || !v.start) return;
    setData(d => ({ ...d, children: d.children.map(c => c.id !== childId ? c : cfToChild(childId, v, c.goal)) }));
    setModal(null);
  }
  function submitGoal() {
    if (!childId || !gf.label.trim() || !gf.amount) return;
    setData(d => ({ ...d, children: d.children.map(c => c.id !== childId ? c : { ...c, goal: { label: gf.label.trim(), amount: parseFloat(gf.amount) } }) }));
    setModal(null);
  }
  function removeGoal() {
    if (!childId) return;
    setData(d => ({ ...d, children: d.children.map(c => c.id !== childId ? c : { ...c, goal: undefined }) }));
    setModal(null);
  }
  function submitTx() {
    if (!tf.amount || !childId) return;
    const sign = tf.type === 'purchase' ? -1 : 1;
    setData(d => ({ ...d, transactions: [...d.transactions, { id: crypto.randomUUID(), childId, amount: sign * Math.abs(parseFloat(tf.amount)), label: tf.label.trim() || (tf.type === 'purchase' ? 'Achat' : 'Crédit'), date: tf.date, ...(tf.note.trim() ? { note: tf.note.trim() } : {}) }] }));
    setTf({ amount: '', label: '', note: '', date: today(), type: 'purchase' });
    setModal(null);
  }
  function deleteChild(id: string) {
    if (!confirm('Supprimer cet enfant ?')) return;
    setData(d => ({ children: d.children.filter(c => c.id !== id), transactions: d.transactions.filter(t => t.childId !== id) }));
    setView('home');
  }
  function openTx(type: 'purchase' | 'credit') {
    setTf(f => ({ ...f, type, date: today(), amount: '', label: '', note: '' }));
    setModal('addTx');
  }
  function openGoal() {
    setGf({ label: child?.goal?.label ?? '', amount: child?.goal?.amount ? String(child.goal.amount) : '' });
    setModal('goal');
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#FDF0E8 0%,#F5E6F8 100%)' }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        <AnimatePresence mode="popLayout">
          {/* ---- HOME ---- */}
          {view === 'home' && (
            <motion.div key="home" {...PAGE}>
              <header className="mb-8">
                <p className="text-sm font-semibold text-purple-400 mb-1">Bonjour 👋</p>
                <h1 className="text-3xl font-black text-gray-900 leading-tight">Argent<br />de poche</h1>
              </header>
              {loading ? (
                <div className="flex justify-center py-24">
                  <motion.div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                </div>
              ) : data.children.length === 0 ? (
                <div className="text-center py-24">
                  <div className="text-7xl mb-4">🐷</div>
                  <p className="font-bold text-gray-600 text-lg">Aucun enfant</p>
                  <p className="text-sm text-gray-400 mt-1">Appuie sur + en bas pour commencer</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.children.map((c, i) => {
                    const bal = calcBalance(c, data.transactions);
                    const col = CHILD_COLORS[i % CHILD_COLORS.length];
                    const txCount = data.transactions.filter(t => t.childId === c.id).length;
                    return (
                      <motion.button key={c.id} onClick={() => { setChildId(c.id); setView('child'); }} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="w-full rounded-3xl p-5 text-left bg-white shadow-sm" style={{ willChange: 'transform' }}>
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0" style={{ background: col.grad }}>{c.name[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-gray-900 text-lg">{c.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{calcAge(c.birthdate)} ans · {txCount} transaction{txCount !== 1 ? 's' : ''}</div>
                            {c.goal && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-400">🎯 {c.goal.label}</span>
                                  <span className="font-bold" style={{ color: col.bg }}>{Math.min(100, Math.round(bal / c.goal.amount * 100))}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, bal / c.goal.amount * 100))}%`, background: col.grad }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-2xl font-black tabular-nums ${bal >= 0 ? 'text-green-500' : 'text-red-400'}`}>{fmt(bal)}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{c.allowance.amount}€/{c.allowance.frequency === 'monthly' ? 'mois' : 'sem.'}</div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ---- CHILD DETAIL ---- */}
          {view === 'child' && child && (
            <motion.div key="child" {...PAGE}>
              <header className="flex items-center gap-3 mb-6">
                <motion.button onClick={() => setView('home')} whileTap={{ scale: 0.9 }} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-600 font-bold" style={{ willChange: 'transform' }}>←</motion.button>
                <div className="flex-1">
                  <h1 className="text-2xl font-black text-gray-900">{child.name}</h1>
                  <p className="text-xs text-gray-400">{calcAge(child.birthdate)} ans</p>
                </div>
                <button onClick={() => setModal('editChild')} className="text-xs text-purple-500 hover:text-purple-700 px-3 py-1.5 rounded-xl hover:bg-purple-50 transition-colors font-semibold">Modifier</button>
                <button onClick={() => deleteChild(child.id)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors font-semibold">Supprimer</button>
              </header>

              {/* Balance card */}
              <div className="rounded-3xl p-7 mb-4 text-center text-white shadow-xl" style={{ background: color.grad }}>
                <p className="text-sm font-semibold opacity-80 mb-2">Solde actuel</p>
                <div className="text-6xl font-black tabular-nums mb-3">{fmt(balance)}</div>
                <p className="text-sm opacity-70">
                  {child.allowance.amount}€ / {child.allowance.frequency === 'monthly' ? 'mois' : 'semaine'}
                  {child.allowance.frequency === 'monthly' ? ` · le ${child.allowance.day}` : ` · ${WEEKDAYS[child.allowance.day]}`}
                </p>
              </div>

              {/* Goal */}
              {child.goal ? (
                <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-700">🎯 {child.goal.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: color.bg }}>{fmt(balance)} / {fmt(child.goal.amount)}</span>
                      <button onClick={openGoal} className="text-xs text-gray-400 hover:text-purple-500 transition-colors">✏️</button>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, balance / child.goal.amount * 100))}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: color.grad }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-right">{Math.min(100, Math.round(balance / child.goal.amount * 100))}% atteint</p>
                </div>
              ) : (
                <button onClick={openGoal} className="w-full mb-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-semibold hover:border-purple-300 hover:text-purple-400 transition-colors">
                  🎯 Définir un objectif d&apos;épargne
                </button>
              )}

              {/* Badges */}
              {badges.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Trophées</p>
                  <div className="flex flex-wrap gap-2">
                    {badges.map((b, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm text-xs font-bold text-gray-700">
                        <span>{b.emoji}</span><span>{b.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.button onClick={() => openTx('purchase')} whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }} className="flex items-center justify-center gap-2 text-white font-black py-4 rounded-2xl shadow-md text-sm" style={{ background: 'linear-gradient(135deg,#F0956A,#E07850)', willChange: 'transform' }}>🛒 Achat</motion.button>
                <motion.button onClick={() => openTx('credit')} whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }} className="flex items-center justify-center gap-2 text-white font-black py-4 rounded-2xl shadow-md text-sm" style={{ background: 'linear-gradient(135deg,#6BBF8E,#4AA070)', willChange: 'transform' }}>✨ Crédit</motion.button>
              </div>

              {/* Merged history */}
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Historique</h2>
              {mergedHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-3xl">Aucune transaction</div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {mergedHistory.map((item, i) => {
                      if (item.type === 'allowance') {
                        return (
                          <div key={`a-${i}`} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between opacity-70">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-100 text-base flex-shrink-0">💸</div>
                              <div>
                                <div className="text-sm font-bold text-gray-600">Versement automatique</div>
                                <div className="text-xs text-gray-400">{item.date.toLocaleDateString('fr-FR')}</div>
                              </div>
                            </div>
                            <div className="text-sm font-black text-green-500">+{child.allowance.amount.toFixed(2)} €</div>
                          </div>
                        );
                      }
                      const tx = item.tx;
                      return (
                        <motion.div key={tx.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm" style={{ willChange: 'transform, opacity' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${tx.amount >= 0 ? 'bg-green-100' : 'bg-orange-100'}`}>{tx.amount >= 0 ? '↑' : '↓'}</div>
                              <div>
                                <div className="text-sm font-bold text-gray-800">{tx.label}</div>
                                <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('fr-FR')}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`text-sm font-black tabular-nums ${tx.amount >= 0 ? 'text-green-500' : 'text-orange-500'}`}>{tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} €</div>
                              <button onClick={() => { if (confirm(`Supprimer "${tx.label}" ?`)) setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== tx.id) })); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-400 transition-colors text-base leading-none">×</button>
                            </div>
                          </div>
                          {tx.note && <p className="text-xs text-gray-400 mt-1.5 ml-12 italic">&quot;{tx.note}&quot;</p>}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      {view === 'home' && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-6 pointer-events-none">
          <motion.button onClick={() => setModal('addChild')} whileTap={{ scale: 0.93 }} className="pointer-events-auto flex items-center gap-2 px-6 py-3 text-white text-sm font-bold rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg,#7C5CBF,#9B6FD4)', willChange: 'transform' }}>
            + Ajouter un enfant
          </motion.button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === 'addChild' && (
          <Modal title="Ajouter un enfant" onClose={() => setModal(null)}>
            <ChildForm initial={EMPTY_CF} onSubmit={addChild} submitLabel="Ajouter l'enfant" />
          </Modal>
        )}
        {modal === 'editChild' && child && (
          <Modal title={`Modifier ${child.name}`} onClose={() => setModal(null)}>
            <ChildForm initial={childToCF(child)} onSubmit={editChild} submitLabel="Enregistrer" />
          </Modal>
        )}
        {modal === 'goal' && (
          <Modal title="Objectif d'épargne" onClose={() => setModal(null)}>
            <div className="space-y-4">
              <div><label className={lbl}>Nom de l&apos;objectif</label><input className={inp} value={gf.label} onChange={e => setGf(f => ({ ...f, label: e.target.value }))} placeholder="Nintendo Switch, vélo…" autoFocus /></div>
              <div><label className={lbl}>Montant cible (€)</label><input type="number" className={inp} value={gf.amount} onChange={e => setGf(f => ({ ...f, amount: e.target.value }))} placeholder="300" min="0" step="1" /></div>
              <motion.button onClick={submitGoal} disabled={!gf.label.trim() || !gf.amount} whileTap={{ scale: 0.97 }} className="w-full text-white font-black py-4 rounded-2xl shadow-md disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#7C5CBF,#9B6FD4)' }}>
                Enregistrer l&apos;objectif
              </motion.button>
              {child?.goal && (
                <button onClick={removeGoal} className="w-full py-3 text-sm text-red-400 hover:text-red-600 font-semibold transition-colors">
                  Supprimer l&apos;objectif
                </button>
              )}
            </div>
          </Modal>
        )}
        {modal === 'addTx' && (
          <Modal title={tf.type === 'purchase' ? '🛒 Enregistrer un achat' : '✨ Ajouter un crédit'} onClose={() => setModal(null)} position="top">
            <div className="space-y-4">
              <div><label className={lbl}>Montant (€)</label><input type="number" className={inp} value={tf.amount} onChange={e => setTf(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" autoFocus /></div>
              <div><label className={lbl}>Description</label><input className={inp} value={tf.label} onChange={e => setTf(f => ({ ...f, label: e.target.value }))} placeholder={tf.type === 'purchase' ? 'Bonbons, jeu vidéo…' : 'Cadeau, bonus…'} /></div>
              <div><label className={lbl}>Note (optionnelle)</label><input className={inp} value={tf.note} onChange={e => setTf(f => ({ ...f, note: e.target.value }))} placeholder="Pour avoir rangé sa chambre…" /></div>
              <div><label className={lbl}>Date</label><input type="date" className={inp} value={tf.date} onChange={e => setTf(f => ({ ...f, date: e.target.value }))} /></div>
              <motion.button onClick={submitTx} disabled={!tf.amount} whileTap={{ scale: 0.97 }} className="w-full text-white font-black py-4 rounded-2xl shadow-md disabled:opacity-40" style={{ background: tf.type === 'purchase' ? 'linear-gradient(135deg,#F0956A,#E07850)' : 'linear-gradient(135deg,#6BBF8E,#4AA070)', willChange: 'transform' }}>
                {tf.type === 'purchase' ? 'Déduire du solde' : 'Créditer le solde'}
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function fmt(n: number): string { return (n >= 0 ? '' : '-') + Math.abs(n).toFixed(2) + ' €'; }
function today(): string { return new Date().toISOString().split('T')[0]; }
