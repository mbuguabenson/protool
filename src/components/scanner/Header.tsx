import React from 'react';
import styles from '@/components/scanner/scanner.module.css';

const Header: React.FC = () => (
    <header className={styles.header}>
        <h1 className={styles.title}>AI Market Scanner</h1>
        <p className={styles.subtitle}>Intelligent signal detection using live market data</p>
    </header>
);

export default Header;
