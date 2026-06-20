import React from 'react';

interface SignalCardProps {
    signal: any;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal }) => (
    <div style={{ padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
        <strong>Signal:</strong> {JSON.stringify(signal)}
    </div>
);

export default SignalCard;
