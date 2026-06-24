import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAccountInfo } from '@/hooks/useAccountInfo';
import { Wallet, Copy, Check, ShieldCheck, User } from 'lucide-react';
import './AccountInfoCard.scss';

export const AccountInfoCard = observer(() => {
    const { loginid, currency, account_type, balance } = useAccountInfo();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!loginid) return;
        navigator.clipboard.writeText(loginid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!loginid) {
        return (
            <div className='account-info-card loading-state'>
                <div className='card-pulse-loader' />
                <p>Retrieving active account details...</p>
            </div>
        );
    }

    const isDemo = account_type === 'demo';

    return (
        <div className={`account-info-card ${isDemo ? 'is-demo' : 'is-real'}`}>
            <div className='card-glass-glow' />
            <div className='card-content'>
                <div className='card-header-section'>
                    <div className='header-title-group'>
                        <Wallet className='header-icon' size={20} />
                        <h3>Active Trading Account</h3>
                    </div>
                    <span className={`status-badge ${isDemo ? 'demo-badge' : 'real-badge'}`}>
                        {isDemo ? 'Demo Account' : 'Real Account'}
                    </span>
                </div>

                <div className='balance-display-section'>
                    <span className='balance-label'>Available Balance</span>
                    <h2 className='balance-amount'>
                        <span className='currency-symbol'>
                            {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''}
                        </span>
                        {parseFloat(balance).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                        <span className='currency-code'>{currency}</span>
                    </h2>
                </div>

                <div className='details-grid'>
                    <div className='detail-item'>
                        <span className='detail-label'>Account ID</span>
                        <div className='detail-value copyable' onClick={handleCopy}>
                            <User size={14} className='detail-icon' />
                            <span>{loginid}</span>
                            <button className='copy-action-btn' type='button' aria-label='Copy Account ID'>
                                {copied ? <Check size={14} className='success-icon' /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className='detail-item'>
                        <span className='detail-label'>Authentication</span>
                        <div className='detail-value secure'>
                            <ShieldCheck size={14} className='detail-icon secure-icon' />
                            <span>Authorized</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default AccountInfoCard;
