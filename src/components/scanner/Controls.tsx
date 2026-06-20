import React from 'react';

const Controls: React.FC = () => (
    <div style={{ padding: '8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button style={{ padding: '6px 12px' }}>Start Scan</button>
        <button style={{ padding: '6px 12px' }}>Stop Scan</button>
    </div>
);

export default Controls;
