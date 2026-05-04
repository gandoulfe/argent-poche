'use client';

import { useState, useEffect, ReactNode } from 'react';

// ---- Types ----
interface Child {
  id: string;
  name: string;
  birthdate: string;
  allowance: {
    amount: number;
    frequency: 'monthly' | 'weekly';
    day: number; // day of month (1-28) or day of week (0-6)
    startDate: string;
  };
}

interface Transaction {
  id: string;
  childId: string;
  amount: number; // negative = purchase, positive = credit
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
    while (d <= now) {
      earned += allowance.amount;
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const diff = (allowance.day - start.getDay() + 7) % 7;
    const d = new Date(start);
    d.setDate(d.getDate() + diff);
    while (d <= now) {
      earned += allowance.amount;
      d.setDate(d.getDate() + 7);
    }
  }

  const manual = txs.filter(t => t.childId === child.id).reduce((s, t) => s + t.amount, 0);
  return earned + manual;
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ---- Storage ----
const KEY = 'argent-poche-v1';

function loadData(): AppData {
  if (typeof window === 'undefined') return { children: [], transactions: [] };
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { children: [], transactions: [] };
  } catch {
    return { children: [], transactions: [] };
  }
}

// ---- Modal ----
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---- Form styles ----
const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 focus:bg-white transition-colors";
const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

// ---- App ----
export default function App() {
  const [data, setData] = useState<AppData>({ children: [], transactions: [] });
  const [view, setView] = useState<'home' | 'child'>('home');
  const [childId, setChildId] = useState<string | null>(null);
  const [modal, setModal] = useState<'addChild' | 'addTx' | null>(null);

  // Child form
  const [cf, setCf] = useState({ name: '', birthdate: '', amount: '', freq: 'monthly', day: '5', start: '' });
  // Transaction form
  const [tf, setTf] = useState({ amount: '', label: '', date: today(), type: 'purchase' });

  useEffect(() => { setData(loadData()); }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

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
      allowance: {
        amount: parseFloat(cf.amount),
        frequency: cf.freq as 'monthly' | 'weekly',
        day: parseInt(cf.day),
        startDate: cf.start,
      },
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
    if (!confirm('Supprimer cet enfant et toutes ses transactions ?')) return;
    setData(d => ({
      children: d.children.filter(c => c.id !== id),
      transactions: d.transactions.filter(t => t.childId !== id),
    }));
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-lg mx-auto px-4 py-8 pb-24">

        {/* ---- HOME ---- */}
        {view === 'home' && (
          <>
            <header className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Argent de poche 💰</h1>
                <p className="text-sm text-gray-500 mt-0.5">Gérez l&apos;argent de poche de vos enfants</p>
              </div>
              <button
                onClick={() => setModal('addChild')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
              >
                + Enfant
              </button>
            </header>

            {data.children.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-6xl mb-4">👶</div>
                <p className="font-medium">Aucun enfant pour l&apos;instant</p>
                <p className="text-sm mt-1">Cliquez sur &quot;+ Enfant&quot; pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.children.map(c => {
                  const bal = calcBalance(c, data.transactions);
                  const txCount = data.transactions.filter(t => t.childId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setChildId(c.id); setView('child'); }}
                      className="w-full bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all text-left border border-gray-100 hover:border-indigo-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
                            {c.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{c.name}</div>
                            <div className="text-xs text-gray-400">{calcAge(c.birthdate)} ans · {txCount} transaction{txCount !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${bal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt(bal)}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                        {c.allowance.amount.toFixed(2)} € / {c.allowance.frequency === 'monthly' ? 'mois' : 'semaine'}
                        {c.allowance.frequency === 'monthly'
                          ? ` · le ${c.allowance.day} du mois`
                          : ` · le ${WEEKDAYS[c.allowance.day]}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---- CHILD DETAIL ---- */}
        {view === 'child' && child && (() => {
          const bal = calcBalance(child, data.transactions);
          return (
            <>
              <header className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setView('home')}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm hover:shadow text-gray-500 hover:text-gray-800 transition-all border border-gray-100"
                >
                  ←
                </button>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">{child.name}</h1>
                  <p className="text-xs text-gray-400">{calcAge(child.birthdate)} ans</p>
                </div>
                <button
                  onClick={() => deleteChild(child.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              </header>

              {/* Balance card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center border border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Solde actuel</div>
                <div className={`text-5xl font-bold tabular-nums ${bal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {fmt(bal)}
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  {child.allowance.amount.toFixed(2)} € / {child.allowance.frequency === 'monthly' ? 'mois' : 'semaine'}
                  {child.allowance.frequency === 'monthly'
                    ? ` · le ${child.allowance.day} du mois`
                    : ` · le ${WEEKDAYS[child.allowance.day]}`}
                  {' · depuis le '}{new Date(child.allowance.startDate).toLocaleDateString('fr-FR')}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => openTx('purchase')}
                  className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl shadow-sm transition-colors"
                >
                  🛒 Achat
                </button>
                <button
                  onClick={() => openTx('credit')}
                  className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl shadow-sm transition-colors"
                >
                  ➕ Crédit
                </button>
              </div>

              {/* Transactions */}
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historique</h2>
              {childTxs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Aucune transaction manuelle
                </div>
              ) : (
                <div className="space-y-2">
                  {childTxs.map(tx => (
                    <div key={tx.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          {tx.amount >= 0 ? '↑' : '↓'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{tx.label}</div>
                          <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-sm font-bold tabular-nums ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                        </div>
                        <button
                          onClick={() => deleteTx(tx.id)}
                          className="text-gray-300 hover:text-red-400 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ---- MODAL: ADD CHILD ---- */}
      {modal === 'addChild' && (
        <Modal title="Ajouter un enfant" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Prénom</label>
              <input
                className={inp}
                value={cf.name}
                onChange={e => setCf(f => ({ ...f, name: e.target.value }))}
                placeholder="Emma"
                autoFocus
              />
            </div>
            <div>
              <label className={lbl}>Date de naissance</label>
              <input
                type="date"
                className={inp}
                value={cf.birthdate}
                onChange={e => setCf(f => ({ ...f, birthdate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Montant (€)</label>
                <input
                  type="number"
                  className={inp}
                  value={cf.amount}
                  onChange={e => setCf(f => ({ ...f, amount: e.target.value }))}
                  placeholder="5"
                  min="0"
                  step="0.5"
                />
              </div>
              <div>
                <label className={lbl}>Fréquence</label>
                <select
                  className={inp}
                  value={cf.freq}
                  onChange={e => setCf(f => ({ ...f, freq: e.target.value, day: e.target.value === 'monthly' ? '5' : '1' }))}
                >
                  <option value="monthly">Mensuel</option>
                  <option value="weekly">Hebdomadaire</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>{cf.freq === 'monthly' ? 'Jour du versement (1–28)' : 'Jour de la semaine'}</label>
              {cf.freq === 'monthly' ? (
                <input
                  type="number"
                  className={inp}
                  value={cf.day}
                  onChange={e => setCf(f => ({ ...f, day: e.target.value }))}
                  min="1"
                  max="28"
                />
              ) : (
                <select className={inp} value={cf.day} onChange={e => setCf(f => ({ ...f, day: e.target.value }))}>
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={lbl}>Date de début</label>
              <input
                type="date"
                className={inp}
                value={cf.start}
                onChange={e => setCf(f => ({ ...f, start: e.target.value }))}
              />
            </div>
            <button
              onClick={submitChild}
              disabled={!cf.name || !cf.birthdate || !cf.amount || !cf.start}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              Ajouter l&apos;enfant
            </button>
          </div>
        </Modal>
      )}

      {/* ---- MODAL: ADD TRANSACTION ---- */}
      {modal === 'addTx' && (
        <Modal
          title={tf.type === 'purchase' ? '🛒 Enregistrer un achat' : '➕ Ajouter un crédit'}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className={lbl}>Montant (€)</label>
              <input
                type="number"
                className={inp}
                value={tf.amount}
                onChange={e => setTf(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <div>
              <label className={lbl}>Description</label>
              <input
                className={inp}
                value={tf.label}
                onChange={e => setTf(f => ({ ...f, label: e.target.value }))}
                placeholder={tf.type === 'purchase' ? 'Ex : bonbons, jeu vidéo…' : 'Ex : cadeau, bonus…'}
              />
            </div>
            <div>
              <label className={lbl}>Date</label>
              <input
                type="date"
                className={inp}
                value={tf.date}
                onChange={e => setTf(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <button
              onClick={submitTx}
              disabled={!tf.amount}
              className={`w-full text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                tf.type === 'purchase' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {tf.type === 'purchase' ? 'Déduire du solde' : 'Créditer le solde'}
            </button>
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
