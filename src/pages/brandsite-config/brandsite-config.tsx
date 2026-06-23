import React, { useState, useEffect } from 'react';
import {
    getBrandConfig,
    saveBrandConfig,
    applyBrandColors,
    BrandsiteConfigType,
} from '@/components/shared/utils/brand/brand-config';
import { ArrowLeft, Save, Globe, Eye, Palette, Phone, Share2, Key, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AccountInfoCard from '@/components/account/AccountInfoCard';
import './brandsite-config.scss';

const PRESETS = [
    { name: 'Binary Blue (Default)', primary: '#1e40af', secondary: '#10b981' },
    { name: 'Deriv Red Coral', primary: '#ff444f', secondary: '#ff5252' },
    { name: 'Forest Green', primary: '#059669', secondary: '#34d399' },
    { name: 'Gold Rush', primary: '#d97706', secondary: '#fbbf24' },
    { name: 'Cyberpunk Violet', primary: '#7c3aed', secondary: '#f472b6' },
];

const BrandsiteConfig = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<BrandsiteConfigType>({
        brand_name: '',
        domain_name: '',
        primary_color: '',
        secondary_color: '',
        whatsapp_url: '',
        telegram_url: '',
        youtube_url: '',
        support_email: '',
        support_phone: '',
        oauth_app_id: '',
        oauth_client_id: '',
    });

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const currentConfig = getBrandConfig();
        setConfig(currentConfig);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handlePresetClick = (primary: string, secondary: string) => {
        setConfig(prev => ({
            ...prev,
            primary_color: primary,
            secondary_color: secondary,
        }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        saveBrandConfig(config);
        applyBrandColors(config.primary_color, config.secondary_color);

        // Dynamically update document title from save
        const titleSuffix = 'Trading Hub - Professional Trading Bot Builder & Copy Trading Platform';
        document.title = `${config.brand_name} ${titleSuffix}`;

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleExportJSON = () => {
        const exportObj = {
            brand_name: config.brand_name,
            domain_name: config.domain_name,
            oauth: {
                app_id: config.oauth_app_id,
                client_id: config.oauth_client_id,
                server_base_url: 'https://auth.deriv.com',
                authorization_path: '/oauth2/auth',
                token_url: 'https://auth.deriv.com/oauth2/token',
                redirect_uri: '',
                scope: 'trade account_manage',
            },
        };

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', 'brand.config.json');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    return (
        <div className='brandsite-config-page'>
            <div className='brandsite-config-header'>
                <button className='back-btn' onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                </button>
                <h1 className='title'>Brandsite Configuration</h1>
                <p className='subtitle'>Customize branding, colors, credentials, and links for this deployment.</p>
            </div>

            <AccountInfoCard />

            <div className='brandsite-config-container'>
                <form onSubmit={handleSave} className='config-form'>
                    {/* General Settings */}
                    <div className='config-card'>
                        <div className='card-header'>
                            <Globe className='card-icon' />
                            <h2>General Site Settings</h2>
                        </div>
                        <div className='card-body'>
                            <div className='form-group'>
                                <label htmlFor='brand_name'>Brand / Site Name</label>
                                <input
                                    type='text'
                                    id='brand_name'
                                    name='brand_name'
                                    value={config.brand_name}
                                    onChange={handleChange}
                                    required
                                    placeholder='e.g. Protool'
                                />
                            </div>
                            <div className='form-group'>
                                <label htmlFor='domain_name'>Domain URL</label>
                                <input
                                    type='text'
                                    id='domain_name'
                                    name='domain_name'
                                    value={config.domain_name}
                                    onChange={handleChange}
                                    required
                                    placeholder='e.g. protool.com'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Color Styling */}
                    <div className='config-card'>
                        <div className='card-header'>
                            <Palette className='card-icon' />
                            <h2>Brand Color Palette</h2>
                        </div>
                        <div className='card-body'>
                            <div className='presets-container'>
                                <p className='label-heading'>Color Presets</p>
                                <div className='presets-grid'>
                                    {PRESETS.map(preset => (
                                        <button
                                            key={preset.name}
                                            type='button'
                                            className='preset-btn'
                                            onClick={() => handlePresetClick(preset.primary, preset.secondary)}
                                        >
                                            <span
                                                className='color-dot'
                                                style={{
                                                    background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)`,
                                                }}
                                            />
                                            <span className='preset-name'>{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className='colors-inputs-grid'>
                                <div className='form-group'>
                                    <label htmlFor='primary_color'>Primary Brand Color (Buttons & Logos)</label>
                                    <div className='color-input-wrapper'>
                                        <input
                                            type='color'
                                            id='primary_color_picker'
                                            name='primary_color'
                                            value={config.primary_color || '#1e40af'}
                                            onChange={handleChange}
                                        />
                                        <input
                                            type='text'
                                            id='primary_color'
                                            name='primary_color'
                                            value={config.primary_color}
                                            onChange={handleChange}
                                            required
                                            placeholder='#1e40af'
                                        />
                                    </div>
                                </div>
                                <div className='form-group'>
                                    <label htmlFor='secondary_color'>Secondary Color (Accents & Highlights)</label>
                                    <div className='color-input-wrapper'>
                                        <input
                                            type='color'
                                            id='secondary_color_picker'
                                            name='secondary_color'
                                            value={config.secondary_color || '#10b981'}
                                            onChange={handleChange}
                                        />
                                        <input
                                            type='text'
                                            id='secondary_color'
                                            name='secondary_color'
                                            value={config.secondary_color}
                                            onChange={handleChange}
                                            required
                                            placeholder='#10b981'
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* API Credentials */}
                    <div className='config-card'>
                        <div className='card-header'>
                            <Key className='card-icon' />
                            <h2>Deriv API Credentials</h2>
                        </div>
                        <div className='card-body'>
                            <div className='form-group'>
                                <label htmlFor='oauth_app_id'>OAuth App ID</label>
                                <input
                                    type='text'
                                    id='oauth_app_id'
                                    name='oauth_app_id'
                                    value={config.oauth_app_id}
                                    onChange={handleChange}
                                    placeholder="e.g. '33yStbGyLdNdqAyCuDk1d'"
                                    required
                                />
                            </div>
                            <div className='form-group'>
                                <label htmlFor='oauth_client_id'>OAuth Client ID (Optional)</label>
                                <input
                                    type='text'
                                    id='oauth_client_id'
                                    name='oauth_client_id'
                                    value={config.oauth_client_id}
                                    onChange={handleChange}
                                    placeholder='OAuth Client ID'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact & Support */}
                    <div className='config-card'>
                        <div className='card-header'>
                            <Phone className='card-icon' />
                            <h2>Support Contacts</h2>
                        </div>
                        <div className='card-body'>
                            <div className='form-group'>
                                <label htmlFor='support_email'>Support Email</label>
                                <input
                                    type='email'
                                    id='support_email'
                                    name='support_email'
                                    value={config.support_email}
                                    onChange={handleChange}
                                    placeholder='support@yourbrand.com'
                                />
                            </div>
                            <div className='form-group'>
                                <label htmlFor='support_phone'>Support Phone</label>
                                <input
                                    type='text'
                                    id='support_phone'
                                    name='support_phone'
                                    value={config.support_phone}
                                    onChange={handleChange}
                                    placeholder='+1 234 567 890'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Social Handles */}
                    <div className='config-card'>
                        <div className='card-header'>
                            <Share2 className='card-icon' />
                            <h2>Social Media & Communities</h2>
                        </div>
                        <div className='card-body'>
                            <div className='form-group'>
                                <label htmlFor='whatsapp_url'>WhatsApp Channel Link</label>
                                <input
                                    type='url'
                                    id='whatsapp_url'
                                    name='whatsapp_url'
                                    value={config.whatsapp_url}
                                    onChange={handleChange}
                                    placeholder='https://wa.me/channel-id'
                                />
                            </div>
                            <div className='form-group'>
                                <label htmlFor='telegram_url'>Telegram Link</label>
                                <input
                                    type='url'
                                    id='telegram_url'
                                    name='telegram_url'
                                    value={config.telegram_url}
                                    onChange={handleChange}
                                    placeholder='https://t.me/channel-username'
                                />
                            </div>
                            <div className='form-group'>
                                <label htmlFor='youtube_url'>YouTube Channel Link</label>
                                <input
                                    type='url'
                                    id='youtube_url'
                                    name='youtube_url'
                                    value={config.youtube_url}
                                    onChange={handleChange}
                                    placeholder='https://youtube.com/@channel-username'
                                />
                            </div>
                        </div>
                    </div>

                    <div className='form-actions'>
                        <button type='submit' className='save-btn'>
                            <Save size={18} />
                            <span>Save Configuration</span>
                        </button>
                    </div>

                    {saved && (
                        <div className='save-success-banner'>
                            Branding updated successfully! Custom styling, App ID, and handles applied.
                        </div>
                    )}
                </form>

                {/* Right side live preview and utilities */}
                <div className='config-preview-pane'>
                    {/* Live UI Preview Card */}
                    <div className='config-card preview-card'>
                        <div className='card-header'>
                            <Eye className='card-icon' />
                            <h2>Real-Time Brand Preview</h2>
                        </div>
                        <div className='card-body'>
                            <div className='mock-ui'>
                                <div className='mock-header'>
                                    <div className='logo-group'>
                                        <div
                                            className='logo-square'
                                            style={{ backgroundColor: config.primary_color || '#1e40af' }}
                                        />
                                        <div className='logo-title'>
                                            <span className='brand-title'>{config.brand_name || 'Protool'}</span>
                                            <span className='sub-title'>POWERED BY DERIV</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='mock-body'>
                                    <p className='preview-heading'>Primary Button Action</p>
                                    <button
                                        type='button'
                                        className='preview-primary-btn'
                                        style={{ backgroundColor: config.primary_color || '#1e40af' }}
                                    >
                                        Log In
                                    </button>

                                    <p className='preview-heading mt-4'>Active & Input Border Accent</p>
                                    <div
                                        className='preview-input'
                                        style={{ borderColor: config.secondary_color || '#10b981' }}
                                    >
                                        Active Field Highlight
                                    </div>

                                    <p className='preview-heading mt-4'>Support & Social Handles Status</p>
                                    <div className='social-status-list'>
                                        <div className='social-item'>
                                            <span>WhatsApp: </span>
                                            <span className={config.whatsapp_url ? 'status-active' : 'status-inactive'}>
                                                {config.whatsapp_url ? 'Linked' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div className='social-item'>
                                            <span>Telegram: </span>
                                            <span className={config.telegram_url ? 'status-active' : 'status-inactive'}>
                                                {config.telegram_url ? 'Linked' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div className='social-item'>
                                            <span>YouTube: </span>
                                            <span className={config.youtube_url ? 'status-active' : 'status-inactive'}>
                                                {config.youtube_url ? 'Linked' : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Export / Developers Card */}
                    <div className='config-card developer-card'>
                        <div className='card-header'>
                            <Download className='card-icon' />
                            <h2>Export Configuration</h2>
                        </div>
                        <div className='card-body'>
                            <p className='description'>
                                Export this setup as a <code>brand.config.json</code> file to save it permanently into
                                your source repository.
                            </p>
                            <button type='button' className='export-btn' onClick={handleExportJSON}>
                                <Download size={16} />
                                <span>Download brand.config.json</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandsiteConfig;
