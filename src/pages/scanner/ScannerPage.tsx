import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore'; // assuming hook exists

const ScannerPage: React.FC = observer(() => {
    const { scanner } = useStore(); // use correct property name
    const { activeSignal, isScanning, selectedStrategy } = scanner;

    return (
        <div style={{ padding: '20px' }}>
            <h2>AI Market Scanner</h2>
            <p>Current Strategy: {selectedStrategy ?? 'None'}</p>
            <p>Scanning: {isScanning ? 'Yes' : 'No'}</p>
            <div>
                <strong>Active Signal:</strong>
                <pre>{JSON.stringify(activeSignal, null, 2)}</pre>
            </div>
        </div>
    );
});

export default ScannerPage;
