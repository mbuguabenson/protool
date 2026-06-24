import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { useGlobalToggle } from '@/hooks/useGlobalToggle';
import './account.scss';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface StatementEntry {
    transaction_id: number;
    action_type: string;
    date: string;
    amount: number;
    balance_after: number;
    contract_id?: number;
    shortcode?: string;
    payout?: number;
    reference_id?: number;
}

interface ProfitEntry {
    contract_id: number;
    transaction_id: number;
    buy_price: number;
    sell_price: number;
    pnl: number;
    shortcode?: string;
    date?: string;
    transaction_time?: number;
}

interface StrategyProfit {
    name: string;
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
}

interface AccountInfo {
    loginid?: string;
    currency?: string;
    balance?: number;
    email?: string;
    country?: string;
    full_name?: string;
}

/* ─── KES conversion (approx live rate) ─────────────────────────────────── */
const USD_TO_KES = 129.5;

function formatAmount(amount: number, currency: string, isKes: boolean): string {
    if (isKes) {
        return `KES ${(amount * USD_TO_KES).toFixed(2)}`;
    }
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
const AccountPage = observer(() => {
    const store = useStore();
    const client = store?.client;

    const [isKes] = useGlobalToggle({ key: 'currency_mode_kes', defaultValue: false });

    const [activeTab, setActiveTab] = useState<
        'statement' | 'deposits' | 'withdrawals' | 'pnl' | 'strategies' | 'settings'
    >('statement');
    const [statement, setStatement] = useState<StatementEntry[]>([]);
    const [profitTable, setProfitTable] = useState<ProfitEntry[]>([]);
    const [accountInfo, setAccountInfo] = useState<AccountInfo>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [stmtOffset, setStmtOffset] = useState(0);
    const [profitOffset, setProfitOffset] = useState(0);
    const PAGE_SIZE = 25;

    // Sort
    const [sortField, setSortField] = useState<'date' | 'amount' | 'balance_after'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Filter
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const hasFetched = useRef(false);

    const currency = accountInfo.currency || client?.currency || 'USD';

    /* ── Fetch statement ── */
    const fetchStatement = useCallback(async (offset = 0) => {
        if (!api_base?.api) return;
        setLoading(true);
        setError(null);
        try {
            const resp = await api_base.api.send({
                statement: 1,
                limit: 100,
                offset,
                description: 1,
            });
            if (resp.error) throw new Error(resp.error.message);
            const entries: StatementEntry[] = (resp.statement?.transactions || []).map((t: any) => ({
                transaction_id: t.transaction_id,
                action_type: t.action_type,
                date: new Date(t.transaction_time * 1000).toLocaleString(),
                amount: t.amount ?? 0,
                balance_after: t.balance_after ?? 0,
                contract_id: t.contract_id,
                shortcode: t.shortcode,
                payout: t.payout,
                reference_id: t.reference_id,
            }));
            if (offset === 0) {
                setStatement(entries);
            } else {
                setStatement(prev => [...prev, ...entries]);
            }
            setStmtOffset(offset);
        } catch (e: any) {
            setError(e?.message || 'Failed to fetch statement');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Fetch profit table ── */
    const fetchProfitTable = useCallback(async (offset = 0) => {
        if (!api_base?.api) return;
        setLoading(true);
        setError(null);
        try {
            const resp = await api_base.api.send({
                profit_table: 1,
                limit: 100,
                offset,
                description: 1,
                sort: 'DESC',
            });
            if (resp.error) throw new Error(resp.error.message);
            const entries: ProfitEntry[] = (resp.profit_table?.transactions || []).map((t: any) => ({
                contract_id: t.contract_id,
                transaction_id: t.transaction_id,
                buy_price: t.buy_price ?? 0,
                sell_price: t.sell_price ?? 0,
                pnl: (t.sell_price ?? 0) - (t.buy_price ?? 0),
                shortcode: t.shortcode,
                date: new Date(t.transaction_time * 1000).toLocaleString(),
                transaction_time: t.transaction_time,
            }));
            if (offset === 0) {
                setProfitTable(entries);
            } else {
                setProfitTable(prev => [...prev, ...entries]);
            }
            setProfitOffset(offset);
        } catch (e: any) {
            setError(e?.message || 'Failed to fetch profit table');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Fetch account settings ── */
    const fetchAccountInfo = useCallback(async () => {
        if (!api_base?.api) return;
        try {
            const resp = await api_base.api.send({ get_account_status: 1 });
            const settings = await api_base.api.send({ get_settings: 1 });
            const balance_resp = await api_base.api.send({ balance: 1 });
            setAccountInfo({
                loginid: client?.loginid || '',
                currency: client?.currency || 'USD',
                balance: balance_resp?.balance?.balance ?? 0,
                email: settings?.get_settings?.email || '',
                country: settings?.get_settings?.country || '',
                full_name:
                    `${settings?.get_settings?.first_name || ''} ${settings?.get_settings?.last_name || ''}`.trim(),
            });
        } catch (e: any) {
            // Silent - just use client store data
            setAccountInfo({
                loginid: client?.loginid || '',
                currency: client?.currency || 'USD',
                balance: 0,
            });
        }
    }, [client?.loginid, client?.currency]);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        fetchStatement(0);
        fetchProfitTable(0);
        fetchAccountInfo();
    }, [fetchStatement, fetchProfitTable, fetchAccountInfo]);

    /* ── Derived stats ── */
    const deposits = statement.filter(e => e.action_type === 'deposit');
    const withdrawals = statement.filter(e => e.action_type === 'withdrawal');
    const trades = statement.filter(e => ['buy', 'sell'].includes(e.action_type));

    const totalDeposits = deposits.reduce((s, e) => s + Math.abs(e.amount), 0);
    const totalWithdrawals = withdrawals.reduce((s, e) => s + Math.abs(e.amount), 0);
    const totalPnL = profitTable.reduce((s, e) => s + e.pnl, 0);
    const wins = profitTable.filter(e => e.pnl > 0).length;
    const losses = profitTable.filter(e => e.pnl < 0).length;
    const winRate = profitTable.length > 0 ? ((wins / profitTable.length) * 100).toFixed(1) : '0';

    /* ── Strategy grouping ── */
    const strategyMap: Record<string, StrategyProfit> = {};
    profitTable.forEach(e => {
        const raw = e.shortcode || 'Unknown';
        // Extract market+type from shortcode e.g. "CALL_1HZ100V_..."
        const parts = raw.split('_');
        const name = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : raw.substring(0, 20);
        if (!strategyMap[name]) {
            strategyMap[name] = { name, trades: 0, wins: 0, losses: 0, pnl: 0 };
        }
        strategyMap[name].trades++;
        strategyMap[name].pnl += e.pnl;
        if (e.pnl > 0) strategyMap[name].wins++;
        else strategyMap[name].losses++;
    });
    const strategies = Object.values(strategyMap)
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, 20);

    /* ── Filtered & sorted statement ── */
    const filteredStatement = statement
        .filter(e => typeFilter === 'all' || e.action_type === typeFilter)
        .sort((a, b) => {
            let va: number, vb: number;
            if (sortField === 'date') {
                va = new Date(a.date).getTime();
                vb = new Date(b.date).getTime();
            } else if (sortField === 'amount') {
                va = a.amount;
                vb = b.amount;
            } else {
                va = a.balance_after;
                vb = b.balance_after;
            }
            return sortDir === 'desc' ? vb - va : va - vb;
        });

    const paginatedStatement = filteredStatement.slice(0, (stmtOffset + 1) * PAGE_SIZE + PAGE_SIZE);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sortArrow = (field: typeof sortField) => (sortField === field ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '');

    const isLoggedIn = !!client?.loginid;

    if (!isLoggedIn) {
        return (
            <div className='account-page'>
                <div className='account-page__empty'>
                    <div className='empty-icon'>🔒</div>
                    <p>Please log in to view your account details and trading history.</p>
                </div>
            </div>
        );
    }

    return (
        <div className='account-page'>
            {/* Header */}
            <div className='account-page__header'>
                <h1>Account Overview</h1>
                <div className='account-page__header-meta'>
                    <span className='live-badge'>
                        <span className='pulse' />
                        LIVE
                    </span>
                    <span>{accountInfo.loginid || client?.loginid}</span>
                    <span>·</span>
                    <span>{currency}</span>
                </div>
            </div>

            {/* Summary Cards */}
            <div className='account-page__summary-grid'>
                <div className='account-page__summary-card account-page__summary-card--balance'>
                    <div className='card-icon'>💰</div>
                    <div className='card-label'>Balance</div>
                    <div className='card-value card-value--neutral'>
                        {formatAmount(accountInfo.balance ?? 0, currency, isKes)}
                    </div>
                    <div className='card-sub'>Current account balance</div>
                </div>
                <div className='account-page__summary-card account-page__summary-card--deposits'>
                    <div className='card-icon'>⬇️</div>
                    <div className='card-label'>Total Deposits</div>
                    <div className='card-value card-value--positive'>
                        {formatAmount(totalDeposits, currency, isKes)}
                    </div>
                    <div className='card-sub'>
                        {deposits.length} deposit{deposits.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div className='account-page__summary-card account-page__summary-card--withdrawals'>
                    <div className='card-icon'>⬆️</div>
                    <div className='card-label'>Total Withdrawals</div>
                    <div className='card-value card-value--negative'>
                        {formatAmount(totalWithdrawals, currency, isKes)}
                    </div>
                    <div className='card-sub'>
                        {withdrawals.length} withdrawal{withdrawals.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div className='account-page__summary-card account-page__summary-card--profit'>
                    <div className='card-icon'>📈</div>
                    <div className='card-label'>Total P&amp;L</div>
                    <div className={`card-value ${totalPnL >= 0 ? 'card-value--positive' : 'card-value--negative'}`}>
                        {totalPnL >= 0 ? '+' : ''}
                        {formatAmount(totalPnL, currency, isKes)}
                    </div>
                    <div className='card-sub'>{winRate}% win rate</div>
                </div>
                <div className='account-page__summary-card account-page__summary-card--trades'>
                    <div className='card-icon'>⚡</div>
                    <div className='card-label'>Trades</div>
                    <div className='card-value'>{profitTable.length}</div>
                    <div className='card-sub'>
                        {wins}W / {losses}L
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className='account-page__tabs'>
                {(['statement', 'deposits', 'withdrawals', 'pnl', 'strategies', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        className={`account-tab-btn ${activeTab === tab ? 'account-tab-btn--active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'pnl'
                            ? 'P&L'
                            : tab === 'strategies'
                              ? 'Strategy Profitability'
                              : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        color: '#ef4444',
                        fontSize: '0.82rem',
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(239,68,68,0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.2)',
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            {/* ── Statement Tab ── */}
            {activeTab === 'statement' && (
                <div className='account-page__panel'>
                    <div className='account-page__table-wrap'>
                        <div className='account-page__table-toolbar'>
                            <span className='toolbar-title'>Transaction History ({filteredStatement.length})</span>
                            <div className='toolbar-actions'>
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                    <option value='all'>All Types</option>
                                    <option value='deposit'>Deposits</option>
                                    <option value='withdrawal'>Withdrawals</option>
                                    <option value='buy'>Buy</option>
                                    <option value='sell'>Sell</option>
                                </select>
                            </div>
                        </div>
                        {loading && statement.length === 0 ? (
                            <div className='account-page__loading'>
                                <div className='spin' />
                                Loading statement…
                            </div>
                        ) : filteredStatement.length === 0 ? (
                            <div className='account-page__empty'>
                                <div className='empty-icon'>📋</div>
                                <p>No transactions found for the selected filter.</p>
                            </div>
                        ) : (
                            <>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Type</th>
                                            <th className='sortable' onClick={() => handleSort('date')}>
                                                Date{sortArrow('date')}
                                            </th>
                                            <th className='sortable' onClick={() => handleSort('amount')}>
                                                Amount{sortArrow('amount')}
                                            </th>
                                            <th className='sortable' onClick={() => handleSort('balance_after')}>
                                                Balance After{sortArrow('balance_after')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedStatement.map(e => (
                                            <tr key={e.transaction_id}>
                                                <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                    #{e.transaction_id}
                                                </td>
                                                <td>
                                                    <span className={`type-badge type-badge--${e.action_type}`}>
                                                        {e.action_type === 'deposit'
                                                            ? '⬇'
                                                            : e.action_type === 'withdrawal'
                                                              ? '⬆'
                                                              : e.action_type === 'buy'
                                                                ? '🟡'
                                                                : '🟣'}
                                                        {e.action_type.charAt(0).toUpperCase() + e.action_type.slice(1)}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#94a3b8' }}>{e.date}</td>
                                                <td className={e.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                                                    {e.amount >= 0 ? '+' : ''}
                                                    {formatAmount(e.amount, currency, isKes)}
                                                </td>
                                                <td className='amount-neutral'>
                                                    {formatAmount(e.balance_after, currency, isKes)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {paginatedStatement.length < filteredStatement.length && (
                                    <div className='account-page__pagination'>
                                        <button
                                            onClick={() => fetchStatement(stmtOffset + PAGE_SIZE)}
                                            disabled={loading}
                                        >
                                            {loading ? 'Loading…' : 'Load More'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Deposits Tab ── */}
            {activeTab === 'deposits' && (
                <div className='account-page__panel'>
                    <div className='account-page__table-wrap'>
                        <div className='account-page__table-toolbar'>
                            <span className='toolbar-title'>Deposits ({deposits.length})</span>
                        </div>
                        {loading && deposits.length === 0 ? (
                            <div className='account-page__loading'>
                                <div className='spin' /> Loading…
                            </div>
                        ) : deposits.length === 0 ? (
                            <div className='account-page__empty'>
                                <div className='empty-icon'>📥</div>
                                <p>No deposit records found in the loaded statement.</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Balance After</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deposits.map(e => (
                                        <tr key={e.transaction_id}>
                                            <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                #{e.transaction_id}
                                            </td>
                                            <td style={{ color: '#94a3b8' }}>{e.date}</td>
                                            <td className='amount-positive'>
                                                +{formatAmount(Math.abs(e.amount), currency, isKes)}
                                            </td>
                                            <td className='amount-neutral'>
                                                {formatAmount(e.balance_after, currency, isKes)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Withdrawals Tab ── */}
            {activeTab === 'withdrawals' && (
                <div className='account-page__panel'>
                    <div className='account-page__table-wrap'>
                        <div className='account-page__table-toolbar'>
                            <span className='toolbar-title'>Withdrawals ({withdrawals.length})</span>
                        </div>
                        {loading && withdrawals.length === 0 ? (
                            <div className='account-page__loading'>
                                <div className='spin' /> Loading…
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <div className='account-page__empty'>
                                <div className='empty-icon'>📤</div>
                                <p>No withdrawal records found in the loaded statement.</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Balance After</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map(e => (
                                        <tr key={e.transaction_id}>
                                            <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                #{e.transaction_id}
                                            </td>
                                            <td style={{ color: '#94a3b8' }}>{e.date}</td>
                                            <td className='amount-negative'>
                                                -{formatAmount(Math.abs(e.amount), currency, isKes)}
                                            </td>
                                            <td className='amount-neutral'>
                                                {formatAmount(e.balance_after, currency, isKes)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── P&L Tab ── */}
            {activeTab === 'pnl' && (
                <div className='account-page__panel'>
                    <div className='account-page__table-wrap'>
                        <div className='account-page__table-toolbar'>
                            <span className='toolbar-title'>Profit &amp; Loss — {profitTable.length} Contracts</span>
                            <div className='toolbar-actions'>
                                <span
                                    style={{
                                        fontSize: '0.8rem',
                                        color: totalPnL >= 0 ? '#22c55e' : '#ef4444',
                                        fontWeight: 700,
                                    }}
                                >
                                    Net: {totalPnL >= 0 ? '+' : ''}
                                    {formatAmount(totalPnL, currency, isKes)}
                                </span>
                            </div>
                        </div>
                        {loading && profitTable.length === 0 ? (
                            <div className='account-page__loading'>
                                <div className='spin' /> Loading…
                            </div>
                        ) : profitTable.length === 0 ? (
                            <div className='account-page__empty'>
                                <div className='empty-icon'>📊</div>
                                <p>No trade history found. Start trading to see your P&L here.</p>
                            </div>
                        ) : (
                            <>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Contract ID</th>
                                            <th>Date</th>
                                            <th>Market</th>
                                            <th>Buy</th>
                                            <th>Sell</th>
                                            <th>P&amp;L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profitTable.slice(0, (profitOffset + 1) * PAGE_SIZE).map(e => (
                                            <tr key={e.contract_id}>
                                                <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                    #{e.contract_id}
                                                </td>
                                                <td style={{ color: '#94a3b8' }}>{e.date}</td>
                                                <td
                                                    style={{
                                                        color: '#94a3b8',
                                                        fontSize: '0.75rem',
                                                        maxWidth: '150px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {e.shortcode?.split('_').slice(0, 2).join(' ') || '—'}
                                                </td>
                                                <td>{formatAmount(e.buy_price, currency, isKes)}</td>
                                                <td>{formatAmount(e.sell_price, currency, isKes)}</td>
                                                <td className={e.pnl >= 0 ? 'amount-positive' : 'amount-negative'}>
                                                    {e.pnl >= 0 ? '+' : ''}
                                                    {formatAmount(e.pnl, currency, isKes)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {profitTable.length > (profitOffset + 1) * PAGE_SIZE && (
                                    <div className='account-page__pagination'>
                                        <button
                                            onClick={() => fetchProfitTable(profitOffset + PAGE_SIZE)}
                                            disabled={loading}
                                        >
                                            {loading ? 'Loading…' : 'Load More'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Strategy Profitability Tab ── */}
            {activeTab === 'strategies' && (
                <div className='account-page__panel'>
                    {loading && profitTable.length === 0 ? (
                        <div className='account-page__loading'>
                            <div className='spin' /> Analyzing strategies…
                        </div>
                    ) : strategies.length === 0 ? (
                        <div className='account-page__empty'>
                            <div className='empty-icon'>🤖</div>
                            <p>No strategy data yet. Run some bots to see profitability by strategy here.</p>
                        </div>
                    ) : (
                        <div className='account-page__strategy-grid'>
                            {strategies.map((s, idx) => (
                                <div key={s.name} className='account-page__strategy-card'>
                                    <div className='strategy-rank'>#{idx + 1}</div>
                                    <div className='strategy-info'>
                                        <div className='strategy-name'>{s.name}</div>
                                        <div className='strategy-meta'>
                                            {s.wins} wins · {s.losses} losses ·{' '}
                                            {s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : 0}% win rate
                                        </div>
                                    </div>
                                    <div className='strategy-trades'>
                                        <span>{s.trades}</span>
                                        trades
                                    </div>
                                    <div className='strategy-pnl'>
                                        <div
                                            className={`pnl-value ${s.pnl >= 0 ? 'pnl-value--positive' : 'pnl-value--negative'}`}
                                        >
                                            {s.pnl >= 0 ? '+' : ''}
                                            {formatAmount(s.pnl, currency, isKes)}
                                        </div>
                                        <div className='win-rate'>Net P&amp;L</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Settings Tab ── */}
            {activeTab === 'settings' && (
                <div className='account-page__panel'>
                    <div className='account-page__settings-grid'>
                        <div className='account-page__settings-section'>
                            <h3>Account Details</h3>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Login ID</span>
                                <span className='setting-value'>{accountInfo.loginid || client?.loginid || '—'}</span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Full Name</span>
                                <span className='setting-value'>
                                    {accountInfo.full_name || client?.account_settings?.first_name || '—'}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Email</span>
                                <span className='setting-value'>
                                    {accountInfo.email || client?.account_settings?.email || '—'}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Country</span>
                                <span className='setting-value'>
                                    {accountInfo.country || client?.account_settings?.country_code || '—'}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Currency</span>
                                <span className='setting-value'>{currency}</span>
                            </div>
                        </div>
                        <div className='account-page__settings-section'>
                            <h3>Trading Stats</h3>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Total Trades</span>
                                <span className='setting-value'>{profitTable.length}</span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Win Rate</span>
                                <span className='setting-value' style={{ color: '#22c55e' }}>
                                    {winRate}%
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Net P&amp;L</span>
                                <span
                                    className='setting-value'
                                    style={{ color: totalPnL >= 0 ? '#22c55e' : '#ef4444' }}
                                >
                                    {totalPnL >= 0 ? '+' : ''}
                                    {formatAmount(totalPnL, currency, isKes)}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Total Deposits</span>
                                <span className='setting-value' style={{ color: '#22c55e' }}>
                                    {formatAmount(totalDeposits, currency, isKes)}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Total Withdrawals</span>
                                <span className='setting-value' style={{ color: '#ef4444' }}>
                                    {formatAmount(totalWithdrawals, currency, isKes)}
                                </span>
                            </div>
                            <div className='account-page__settings-row'>
                                <span className='setting-label'>Strategies Used</span>
                                <span className='setting-value'>{strategies.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default AccountPage;
