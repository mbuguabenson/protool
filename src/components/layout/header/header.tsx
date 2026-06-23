import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { navigateToTransfer } from '@/utils/transfer-utils';
import { Localize } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import { useGlobalToggle } from '@/hooks/useGlobalToggle';
import AccountSwitcher from './account-switcher';
import MenuItems from './menu-items';
import MobileMenu, { type MobileMenuRef } from './mobile-menu';
import './header.scss';

const AppHeader = observer(() => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid, setIsAuthorizing, authData } = useApiBase();
    const { client } = useStore() ?? {};
    const [authTimeout, setAuthTimeout] = useState(false);
    const is_account_regenerating = client?.is_account_regenerating || false;
    const mobileMenuRef = useRef<MobileMenuRef>(null);

    // Global toggles
    const [speedMode, setSpeedMode] = useGlobalToggle({ key: 'autoai_speed_mode', defaultValue: false });
    const [isKes, setIsKes] = useGlobalToggle({ key: 'currency_mode_kes', defaultValue: false });

    // Detect OAuth callback on mount (before App.tsx cleans up the URL).
    // When ?code=...&state=... is present the full auth flow can take 7-15 s
    // (token exchange → accounts fetch → OTP → WebSocket auth), so we must
    // suppress the short fallback timeout and keep the spinner throughout.
    const [isOAuthPending, setIsOAuthPending] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(params.get('code') && params.get('state'));
    });

    const { data: activeAccount } = useActiveAccount({
        allBalanceData: client?.all_accounts_balance,
        directBalance: client?.balance,
    });



    // Clear OAuth-pending flag once the account is set (auth succeeded)
    // or after a generous timeout in case something goes wrong.
    useEffect(() => {
        if (!isOAuthPending) return;

        if (activeLoginid) {
            setIsOAuthPending(false);
            return;
        }

        // Safety net: give up after 30 s and let the normal flow decide
        const timer = setTimeout(() => setIsOAuthPending(false), 30_000);
        return () => clearTimeout(timer);
    }, [isOAuthPending, activeLoginid]);

    // Handle direct URL access with legacy token param
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const account_id = urlParams.get('account_id');
        if (account_id) {
            setIsAuthorizing(true);
        }
    }, [setIsAuthorizing]);

    // Fallback timeout: show login button if auth never resolves.
    // Suppressed during the OAuth callback flow (isOAuthPending = true).
    useEffect(() => {
        if (isOAuthPending) return;

        const timer = setTimeout(() => {
            if (isAuthorizing && !activeLoginid) {
                setAuthTimeout(true);
                setIsAuthorizing(false);
            }
        }, 5000);

        if (activeLoginid || !isAuthorizing) {
            if (authTimeout) setAuthTimeout(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [isAuthorizing, activeLoginid, setIsAuthorizing, authTimeout, isOAuthPending]);

    const handleSignup = useCallback(async () => {
        try {
            setIsAuthorizing(true);
            const oauthUrl = await generateOAuthURL('registration');
            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL for signup');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Signup redirection failed:', error);
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleLogin = useCallback(async () => {
        try {
            // Set authorizing state immediately when login is clicked
            setIsAuthorizing(true);

            // Generate OAuth URL with CSRF token and PKCE parameters
            const oauthUrl = await generateOAuthURL();

            if (oauthUrl) {
                // Redirect to OAuth URL
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Login redirection failed:', error);
            // Reset authorizing state if redirection fails
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleTransfer = useCallback(() => {
        const transferCurrency = authData?.currency;
        if (!transferCurrency) {
            console.error('No currency available for transfer');
            return;
        }
        navigateToTransfer(transferCurrency);
    }, [authData?.currency]);

    /** Hamburger SVG — three stacked lines */
    const HamburgerIcon = () => (
        <svg
            className='hamburger-icon'
            width='22'
            height='22'
            viewBox='0 0 22 22'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
        >
            <rect x='2' y='5' width='18' height='2' rx='1' fill='currentColor' />
            <rect x='2' y='10' width='18' height='2' rx='1' fill='currentColor' />
            <rect x='2' y='15' width='18' height='2' rx='1' fill='currentColor' />
        </svg>
    );

    /** Lightning bolt SVG for speed mode */
    const LightningIcon = ({ active }: { active: boolean }) => (
        <svg
            width='13'
            height='13'
            viewBox='0 0 24 24'
            fill={active ? '#fff' : 'currentColor'}
            xmlns='http://www.w3.org/2000/svg'
        >
            <path d='M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z' />
        </svg>
    );

    /** Dollar circle SVG for currency */
    const CurrencyIcon = ({ active }: { active: boolean }) => (
        <svg
            width='13'
            height='13'
            viewBox='0 0 24 24'
            fill='none'
            stroke={active ? '#fff' : 'currentColor'}
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            xmlns='http://www.w3.org/2000/svg'
        >
            <circle cx='12' cy='12' r='10' />
            <path d='M12 6v2M12 16v2M9.5 9.5a2.5 2.5 0 0 1 5 0c0 2-5 2.5-5 4.5a2.5 2.5 0 0 0 5 0' />
        </svg>
    );

    const renderToggleButtons = () => (
        <div className='header-toggles'>
            <button
                id='header-speed-toggle'
                className={clsx('header-toggle-btn', 'header-toggle-btn--speed', {
                    'header-toggle-btn--active': speedMode,
                })}
                onClick={() => setSpeedMode(!speedMode)}
                title='Speed Mode: Trade on every tick'
            >
                <LightningIcon active={speedMode} />
                <span>SPEED</span>
                <span className='header-toggle-btn__state'>{speedMode ? 'ON' : 'OFF'}</span>
            </button>
            <button
                id='header-currency-toggle'
                className={clsx('header-toggle-btn', 'header-toggle-btn--currency', {
                    'header-toggle-btn--active': isKes,
                })}
                onClick={() => setIsKes(!isKes)}
                title='Toggle Currency (USD / KES)'
            >
                <CurrencyIcon active={isKes} />
                <span>{isKes ? 'KES' : 'USD'}</span>
            </button>
        </div>
    );

    const renderAccountSection = useCallback(
        (position: 'left' | 'right' = 'right') => {
            // Show account switcher and logout when user is fully authenticated
            if (activeLoginid && !is_account_regenerating) {
                if (position === 'left' && !isDesktop) {
                    // For mobile left section - toggles + account switcher
                    return (
                        <div className='auth-actions'>
                            {renderToggleButtons()}
                            <div className='account-info'>
                                <AccountSwitcher activeAccount={activeAccount} isKes={isKes} />
                            </div>
                        </div>
                    );
                } else if (position === 'right') {
                    // For right section - transfer button (and account switcher on desktop)
                    return (
                        <div className='auth-actions'>
                            {renderToggleButtons()}
                            {isDesktop && (
                                <div className='account-info'>
                                    <AccountSwitcher activeAccount={activeAccount} isKes={isKes} />
                                </div>
                            )}
                            <Button
                                primary
                                disabled={client?.is_logging_out || !authData?.currency}
                                onClick={handleTransfer}
                            >
                                <Localize i18n_default_text='Transfer' />
                            </Button>
                        </div>
                    );
                }
            }
            // Show login button only when fully settled (not during OAuth flow)
            else if (
                position === 'right' &&
                !isOAuthPending &&
                ((!is_account_regenerating && !isAuthorizing && !activeLoginid) || authTimeout)
            ) {
                return (
                    <div className='auth-actions'>
                        <Button tertiary onClick={handleLogin}>
                            <Localize i18n_default_text='Log in' />
                        </Button>
                        <Button primary_light onClick={handleSignup}>
                            <Localize i18n_default_text='Sign up' />
                        </Button>
                    </div>
                );
            }
            // Default: Show spinner during loading states or when authorizing
            else if (position === 'right') {
                return (
                    <div className='auth-actions auth-actions--loading'>
                        <svg
                            className='auth-actions__spinner'
                            viewBox='0 0 24 24'
                            fill='none'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <circle
                                cx='12'
                                cy='12'
                                r='10'
                                stroke='currentColor'
                                strokeWidth='2.5'
                                strokeLinecap='round'
                                strokeDasharray='31.416'
                                strokeDashoffset='10'
                            />
                        </svg>
                    </div>
                );
            }

            return null;
        },
        [
            isAuthorizing,
            isDesktop,
            activeLoginid,
            client,
            activeAccount,
            authTimeout,
            is_account_regenerating,
            isOAuthPending,
            authData,
            handleLogin,
            handleSignup,
            handleTransfer,
            speedMode,
            isKes,
        ]
    );

    if (client?.should_hide_header) return null;

    return (
        <>
            <Header
                className={clsx('app-header', {
                    'app-header--desktop': isDesktop,
                    'app-header--mobile': !isDesktop,
                })}
            >
                <Wrapper variant='left'>
                    {/* Hamburger button — mobile only, opens drawer */}
                    {!isDesktop && (
                        <button
                            id='header-hamburger-btn'
                            className='header-hamburger-btn'
                            aria-label='Open navigation menu'
                            onClick={() => mobileMenuRef.current?.openDrawer()}
                        >
                            <HamburgerIcon />
                        </button>
                    )}
                    <MobileMenu ref={mobileMenuRef} />
                    <AppLogo />
                    {isDesktop ? <MenuItems /> : renderAccountSection('left')}
                </Wrapper>
                <Wrapper variant='right'>{renderAccountSection('right')}</Wrapper>
            </Header>
        </>
    );
});

export default AppHeader;
