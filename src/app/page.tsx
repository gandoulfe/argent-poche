'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---- Types ----
interface Child {
  id: string;
  name: string;
  birthdate: string;
  allowance: {
    amount: number;
    frequency: 'monthly' | 'weekly';
    day: number;
    startDate: string;
  };
}

interface Transaction {
  id: string;
  childId: string;
  amount: number;
  label: string;
  date: string;
}

interface AppData {
  children: Child[];
  transactions: Transaction[];
}

// ---- Utils ----
function calcAge(birthdate: string): number {
  const b = new Date(birthdate);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

function calcBalance(child: Child, txs: Transaction[]): number {
  const { allowance } = child;
  const start = new Date(allowance.startDate);
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let earned = 0;
  if (allowance.frequency === 'monthly') {
    let d = new Date(start.getFullYear(), start.getMonth(), allowance.day);
    if (d < start) d.setMonth(d.getMonth() + 1);
    while (d <= now) { earned += allowance.amount; d.setMonth(d.getMonth() + 1); }
  } else {
    const diff = (allowance.day - start.getDay() + 7) % 7;
    const d = new Date(start);
    d.setDate(d.getDate() + diff);
    while (d <= now) { earned += allowance.amount; d.setDate(d.getDate() + 7); }
  }

  const manual = txs.filter(t => t.childId === child.id).reduce((s, t) => s + t.amount, 0);
  return earned + manual;
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const CHILD_COLORS = [
  { bg: '#7C5CBF', light: '#EDE7F6' },
  { bg: '#F0956A', light: '#FFF0E8' },
  { bg: '#5BA4CF', light: '#E3F2FD' },
  { bg: '#6BBF8E', light: '#E8F5E9' },
];

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
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
          exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors text-lg">×</button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Form styles ----
const inp = "w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50 focus:bg-white transition-all";
const lbl = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2";

// ---- App ----
export default function App() {
  const [data, setData] = useState<AppData>({ children: [], transactions: [] });
  const [view, setView] = useState<'home' | 'child'>('home');
  const [childId, setChildId] = useState<string | null>(null);
  const [modal, setModal] = useState<'addChild' | 'addTx' | null>(null);
  const loaded = useRef(false);

  const [cf, setCf] = useState({ name: '', birthdate: '', amount: '', freq: 'monthly', day: '5', start: '' });
  const [tf, setTf] = useState({ amount: '', label: '', date: today(), type: 'purchase' });

  useEffect(() => { loadData().then(d => { setData(d); loaded.current = true; }); }, []);
  useEffect(() => { if (loaded.current) saveData(data); }, [data]);

  const child = data.children.find(c => c.id === childId);
  const childTxs = child
    ? data.transactions.filter(t => t.childId === childId).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  function submitChild() {
    if (!cf.name.trim() || !cf.birthdate || !cf.amount || !cf.start) return;
    const newChild: Child = {
      id: crypto.randomUUID(),
      name: cf.name.trim(),
      birthdate: cf.birthdate,
      allowance: { amount: parseFloat(cf.amount), frequency: cf.freq as 'monthly' | 'weekly', day: parseInt(cf.day), startDate: cf.start },
    };
    setData(d => ({ ...d, children: [...d.children, newChild] }));
    setCf({ name: '', birthdate: '', amount: '', freq: 'monthly', day: '5', start: '' });
    setModal(null);
  }

  function submitTx() {
    if (!tf.amount || !childId) return;
    const sign = tf.type === 'purchase' ? -1 : 1;
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      childId,
      amount: sign * Math.abs(parseFloat(tf.amount)),
      label: tf.label.trim() || (tf.type === 'purchase' ? 'Achat' : 'Crédit'),
      date: tf.date,
    };
    setData(d => ({ ...d, transactions: [...d.transactions, newTx] }));
    setTf({ amount: '', label: '', date: today(), type: 'purchase' });
    setModal(null);
  }

  function deleteChild(id: string) {
    if (!confirm('Supprimer cet enfant ?')) return;
    setData(d => ({ children: d.children.filter(c => c.id !== id), transactions: d.transactions.filter(t => t.childId !== id) }));
    setView('home');
  }

  function deleteTx(id: string) {
    setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));
  }

  function openTx(type: 'purchase' | 'credit') {
    setTf(f => ({ ...f, type, date: today() }));
    setModal('addTx');
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #FDF0E8 0%, #F5E6F8 100%)' }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-24">

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              {/* Header */}
              <header className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-sm font-semibold text-purple-400 mb-1">Bonjour 👋</p>
                  <h1 className="text-3xl font-black text-gray-900 leading-tight">Argent<br />de poche</h1>
                </div>
                <motion.button
                  onClick={() => setModal('addChild')}
                  whileTap={{ scale: 0.93 }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7C5CBF, #9B6FD4)' }}
                >
                  +
                </motion.button>
              </header>

              {data.children.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
                  <div className="text-7xl mb-4">🐷</div>
                  <p className="font-bold text-gray-600 text-lg">Aucun enfant</p>
                  <p className="text-sm text-gray-400 mt-1">Appuie sur + pour commencer</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {data.children.map((c, i) => {
                    const bal = calcBalance(c, data.transactions);
                    const color = CHILD_COLORS[i % CHILD_COLORS.length];
                    const txCount = data.transactions.filter(t => t.childId === c.id).length;
                    return (
                      <motion.button
                        key={c.id}
                        onClick={() => { setChildId(c.id); setView('child'); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                        className="w-full rounded-3xl p-5 text-left shadow-sm"
                        style={{ background: 'white' }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${color.bg}, ${color.bg}CC)` }}>
                            {c.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-gray-900 text-lg">{c.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{calcAge(c.birthdate)} ans · {txCount} transaction{txCount !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-2xl font-black tabular-nums ${bal >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                              {fmt(bal)}
                            </div>
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

          {view === 'child' && child && (() => {
            const bal = calcBalance(child, data.transactions);
            const idx = data.children.findIndex(c => c.id === child.id);
            const color = CHILD_COLORS[idx % CHILD_COLORS.length];
            return (
              <motion.div key="child" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                {/* Header */}
                <header className="flex items-center gap-3 mb-6">
                  <motion.button
                    onClick={() => setView('home')}
                    whileTap={{ scale: 0.9 }}
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-600 font-bold"
                  >
                    ←
                  </motion.button>
                  <div className="flex-1">
                    <h1 className="text-2xl font-black text-gray-900">{child.name}</h1>
                    <p className="text-xs text-gray-400">{calcAge(child.birthdate)} ans</p>
                  </div>
                  <button onClick={() => deleteChild(child.id)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors font-semibold">
                    Supprimer
                  </button>
                </header>

                {/* Balance card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl p-7 mb-5 text-center text-white shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${color.bg}, ${color.bg}99)` }}
                >
                  <p className="text-sm font-semibold opacity-80 mb-2">Solde actuel</p>
                  <div className="text-6xl font-black tabular-nums mb-3">{fmt(bal)}</div>
                  <p className="text-sm opacity-70">
                    {child.allowance.amount}€ / {child.allowance.frequency === 'monthly' ? 'mois' : 'semaine'}
                    {child.allowance.frequency === 'monthly' ? ` · le ${child.allowance.day}` : ` · ${WEEKDAYS[child.allowance.day]}`}
                  </p>
                </motion.div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-7">
                  <motion.button
                    onClick={() => openTx('purchase')}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ y: -1 }}
                    className="flex items-center justify-center gap-2 text-white font-black py-4 rounded-2xl shadow-md text-sm"
                    style={{ background: 'linear-gradient(135deg, #F0956A, #E07850)' }}
                  >
                    🛒 Achat
                  </motion.button>
                  <motion.button
                    onClick={() => openTx('credit')}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ y: -1 }}
                    className="flex items-center justify-center gap-2 text-white font-black py-4 rounded-2xl shadow-md text-sm"
                    style={{ background: 'linear-gradient(135deg, #6BBF8E, #4AA070)' }}
                  >
                    ✨ Crédit
                  </motion.button>
                </div>

                {/* Transactions */}
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Historique</h2>
                {childTxs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-3xl">
                    Aucune transaction
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {childTxs.map((tx, i) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: i * 0.03 }}
                          className="bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${tx.amount >= 0 ? 'bg-green-100' : 'bg-orange-100'}`}>
                              {tx.amount >= 0 ? '↑' : '↓'}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-800">{tx.label}</div>
                              <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('fr-FR')}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`text-sm font-black tabular-nums ${tx.amount >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                              {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                            </div>
                            <button onClick={() => deleteTx(tx.id)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-400 transition-colors text-base leading-none">
                              ×
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* ---- MODAL: ADD CHILD ---- */}
      {modal === 'addChild' && (
        <Modal title="Ajouter un enfant" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Prénom</label>
              <input className={inp} value={cf.name} onChange={e => setCf(f => ({ ...f, name: e.target.value }))} placeholder="Emma" autoFocus />
            </div>
            <div>
              <label className={lbl}>Date de naissance</label>
              <input type="date" className={inp} value={cf.birthdate} onChange={e => setCf(f => ({ ...f, birthdate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Montant (€)</label>
                <input type="number" className={inp} value={cf.amount} onChange={e => setCf(f => ({ ...f, amount: e.target.value }))} placeholder="5" min="0" step="0.5" />
              </div>
              <div>
                <label className={lbl}>Fréquence</label>
                <select className={inp} value={cf.freq} onChange={e => setCf(f => ({ ...f, freq: e.target.value, day: e.target.value === 'monthly' ? '5' : '1' }))}>
                  <option value="monthly">Mensuel</option>
                  <option value="weekly">Hebdo</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>{cf.freq === 'monthly' ? 'Jour du mois (1–28)' : 'Jour de la semaine'}</label>
              {cf.freq === 'monthly' ? (
                <input type="number" className={inp} value={cf.day} onChange={e => setCf(f => ({ ...f, day: e.target.value }))} min="1" max="28" />
              ) : (
                <select className={inp} value={cf.day} onChange={e => setCf(f => ({ ...f, day: e.target.value }))}>
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={lbl}>Date de début</label>
              <input type="date" className={inp} value={cf.start} onChange={e => setCf(f => ({ ...f, start: e.target.value }))} />
            </div>
            <motion.button
              onClick={submitChild}
              disabled={!cf.name || !cf.birthdate || !cf.amount || !cf.start}
              whileTap={{ scale: 0.97 }}
              className="w-full text-white font-black py-4 rounded-2xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
              style={{ background: 'linear-gradient(135deg, #7C5CBF, #9B6FD4)' }}
            >
              Ajouter l&apos;enfant
            </motion.button>
          </div>
        </Modal>
      )}

      {/* ---- MODAL: ADD TRANSACTION ---- */}
      {modal === 'addTx' && (
        <Modal title={tf.type === 'purchase' ? '🛒 Enregistrer un achat' : '✨ Ajouter un crédit'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Montant (€)</label>
              <input type="number" className={inp} value={tf.amount} onChange={e => setTf(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" autoFocus />
            </div>
            <div>
              <label className={lbl}>Description</label>
              <input className={inp} value={tf.label} onChange={e => setTf(f => ({ ...f, label: e.target.value }))} placeholder={tf.type === 'purchase' ? 'Bonbons, jeu vidéo…' : 'Cadeau, bonus…'} />
            </div>
            <div>
              <label className={lbl}>Date</label>
              <input type="date" className={inp} value={tf.date} onChange={e => setTf(f => ({ ...f, date: e.target.value }))} />
            </div>
            <motion.button
              onClick={submitTx}
              disabled={!tf.amount}
              whileTap={{ scale: 0.97 }}
              className="w-full text-white font-black py-4 rounded-2xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ background: tf.type === 'purchase' ? 'linear-gradient(135deg, #F0956A, #E07850)' : 'linear-gradient(135deg, #6BBF8E, #4AA070)' }}
            >
              {tf.type === 'purchase' ? 'Déduire du solde' : 'Créditer le solde'}
            </motion.button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return (n >= 0 ? '' : '-') + Math.abs(n).toFixed(2) + ' €';
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}
